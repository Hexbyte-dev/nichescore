// ============================================================
// AI CLASSIFIER
//
// Reads unclassified posts from raw_posts, sends them to
// Claude Haiku in batches, and saves the classification
// results to scored_problems.
//
// The "batch" approach is key for cost control — one API call
// classifies 50 posts instead of making 50 separate calls.
// ============================================================

const Anthropic = require("@anthropic-ai/sdk");
const db = require("./db");
const config = require("./config");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function stripHtml(text) {
  return text
    .replace(/<[^>]+>/g, " ")    // remove HTML tags
    .replace(/&[a-z]+;/gi, " ")  // remove HTML entities (&amp; etc.)
    .replace(/\s+/g, " ")        // collapse whitespace
    .trim();
}

function buildClassifierPrompt(posts) {
  const numbered = posts
    .map((p, i) => `${i + 1}. "${stripHtml(p.content).slice(0, 300)}"`)
    .join("\n\n");

  return `You are a problem classifier for market research. For each numbered post below, determine if it describes a real problem that could be solved by a mobile or web app.

Return ONLY a JSON array. Each element must have:
- "index": the post number (1-based)
- "category": broad problem area (e.g. "property management", "gardening", "meal planning"). Use lowercase.
- "subcategory": specific issue (e.g. "tenant screening", "plant disease identification"). Use lowercase.
- "sentiment_score": 1-10, how frustrated/urgent the person sounds (10 = extremely frustrated)
- "is_app_solvable": true/false, could a mobile or web app realistically help?
- "summary": one plain-English sentence summarizing the problem

If a post is not about a real problem (just joking, off-topic, etc.), set is_app_solvable to false and sentiment_score to 1.

Posts:

${numbered}

Return ONLY the JSON array, no other text.`;
}

function parseClassifierResponse(text) {
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  return JSON.parse(cleaned);
}

async function getUnclassifiedPosts(limit) {
  const result = await db.query(
    `SELECT rp.id, rp.content, rp.platform, rp.metadata
     FROM raw_posts rp
     LEFT JOIN scored_problems sp ON sp.raw_post_id = rp.id
     WHERE sp.id IS NULL
     ORDER BY rp.collected_at ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function saveClassifications(posts, classifications) {
  let saved = 0;
  for (const cls of classifications) {
    const post = posts[cls.index - 1];
    if (!post) continue;

    try {
      await db.query(
        `INSERT INTO scored_problems (raw_post_id, category, subcategory, sentiment_score, is_app_solvable, summary)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [post.id, cls.category, cls.subcategory, cls.sentiment_score,
         cls.is_app_solvable, cls.summary]
      );
      saved++;
    } catch (err) {
      console.error(`  [Classifier] Failed to save classification for ${post.id}:`, err.message);
    }
  }
  return saved;
}

async function classifyBatch(posts) {
  const prompt = buildClassifierPrompt(posts);

  const response = await anthropic.messages.create({
    model: config.classifier.model,
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text;
  return parseClassifierResponse(text);
}

async function classify() {
  console.log("  [Classifier] Starting classification...");
  const batchSize = config.classifier.batchSize;
  let totalClassified = 0;

  while (true) {
    const posts = await getUnclassifiedPosts(batchSize);
    if (posts.length === 0) break;

    try {
      const classifications = await classifyBatch(posts);
      const saved = await saveClassifications(posts, classifications);
      totalClassified += saved;
      console.log(`  [Classifier] Batch done: ${saved}/${posts.length} classified`);
    } catch (err) {
      console.error("  [Classifier] Batch failed:", err.message);
      // Skip this batch and try the next one instead of stopping
      // Mark these posts as unclassifiable so we don't retry forever
      for (const post of posts) {
        try {
          await db.query(
            `INSERT INTO scored_problems (raw_post_id, category, subcategory, sentiment_score, is_app_solvable, summary)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [post.id, "unclassified", "parse_error", 1, false, "Classifier could not parse this post"]
          );
        } catch (e) { /* skip duplicates */ }
      }
      console.log(`  [Classifier] Skipped ${posts.length} posts, continuing...`);
    }
  }

  console.log(`  [Classifier] Done. ${totalClassified} posts classified.`);
  return totalClassified;
}

module.exports = { classify, buildClassifierPrompt, parseClassifierResponse };
