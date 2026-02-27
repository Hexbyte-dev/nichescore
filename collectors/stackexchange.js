// ============================================================
// STACK EXCHANGE COLLECTOR
//
// Stack Exchange has 170+ Q&A sites covering nearly every niche.
// The API is free — 300 requests/day without a key, 10K/day
// with a free key from stackapps.com.
//
// We search for frustration-related questions on niche sites.
// Responses are gzip-compressed by default.
// ============================================================

const db = require("../db");
const config = require("../config");

function buildSearchUrl(site, keyword, apiKey) {
  const base = config.stackexchange.baseUrl;
  const limit = config.stackexchange.questionsPerSite;
  let url = `${base}/search/excerpts?order=desc&sort=creation&q=${encodeURIComponent(keyword)}&site=${site}&pagesize=${limit}`;
  if (apiKey) url += `&key=${apiKey}`;
  return url;
}

function transformSEQuestion(item, site) {
  const title = item.title || "";
  const body = item.body || item.excerpt || "";
  const content = body ? `${title}\n\n${body}` : title;

  return {
    platform: "stackexchange",
    platform_id: `se_${site}_${item.question_id}`,
    author: item.owner ? item.owner.display_name || "anonymous" : "anonymous",
    content,
    url: item.link || `https://${site}.stackexchange.com/questions/${item.question_id}`,
    posted_at: item.creation_date ? new Date(item.creation_date * 1000) : null,
    metadata: {
      site,
      tags: item.tags || [],
      score: item.score || 0,
    },
  };
}

async function savePosts(posts) {
  let saved = 0;
  for (const post of posts) {
    try {
      await db.query(
        `INSERT INTO raw_posts (platform, platform_id, author, content, url, posted_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (platform, platform_id) DO NOTHING`,
        [post.platform, post.platform_id, post.author, post.content,
         post.url, post.posted_at, JSON.stringify(post.metadata)]
      );
      saved++;
    } catch (err) {
      console.error(`  [StackExchange] Failed to save question ${post.platform_id}:`, err.message);
    }
  }
  return saved;
}

async function collect() {
  console.log("  [StackExchange] Starting collection...");
  const sites = config.stackexchange.sites;
  const keywords = config.keywords.slice(0, 3);
  const apiKey = config.stackexchange.apiKey;
  let totalSaved = 0;

  for (const site of sites) {
    for (const keyword of keywords) {
      try {
        const url = buildSearchUrl(site, keyword, apiKey);
        const response = await fetch(url, {
          headers: { "Accept-Encoding": "gzip" },
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
          console.error(`  [StackExchange] ${site}/"${keyword}": HTTP ${response.status}`);
          continue;
        }
        const data = await response.json();
        const items = data.items || [];
        const transformed = items.map((q) => transformSEQuestion(q, site));
        const saved = await savePosts(transformed);
        totalSaved += saved;
        console.log(`  [StackExchange] ${site}/"${keyword}": ${saved} questions saved`);

        if (data.quota_remaining !== undefined && data.quota_remaining < 10) {
          console.log(`  [StackExchange] Quota low (${data.quota_remaining}), stopping.`);
          return totalSaved;
        }
      } catch (err) {
        console.error(`  [StackExchange] ${site}/"${keyword}" failed:`, err.message);
      }
    }
  }

  console.log(`  [StackExchange] Done. ${totalSaved} total new questions saved.`);
  return totalSaved;
}

module.exports = { collect, transformSEQuestion, buildSearchUrl };
