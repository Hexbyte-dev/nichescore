// ============================================================
// TIKTOK COLLECTOR
//
// TikTok has no public API for this, so we scrape their web
// interface using cheerio. This is the most fragile collector
// because TikTok actively fights scraping.
//
// We focus on comments rather than video content because
// text is what we can classify. We search by hashtag.
//
// If this collector stops working, it's expected — TikTok
// changes their markup often. The other 3 collectors carry
// the pipeline while this one is being repaired.
// ============================================================

const cheerio = require("cheerio");
const db = require("../db");
const config = require("../config");

function transformTikTokComment(comment) {
  return {
    platform: "tiktok",
    platform_id: comment.cid || `tt_${Date.now()}_${Math.random()}`,
    author: comment.uniqueId || "anonymous",
    content: comment.text || "",
    url: comment.videoUrl || "https://www.tiktok.com",
    posted_at: comment.createTime ? new Date(comment.createTime * 1000) : null,
    metadata: {
      hashtag: comment.hashtag || null,
    },
  };
}

async function scrapeHashtag(hashtag) {
  const url = `https://www.tiktok.com/tag/${hashtag}`;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const comments = [];

    $("script#__UNIVERSAL_DATA_FOR_REHYDRATION__").each((_, el) => {
      try {
        const data = JSON.parse($(el).html());
        const items = data?.["__DEFAULT_SCOPE__"]?.["webapp.search"]?.itemList || [];
        for (const item of items) {
          if (item.desc) {
            comments.push({
              cid: item.id,
              text: item.desc,
              uniqueId: item.author?.uniqueId || "unknown",
              createTime: item.createTime,
              videoUrl: `https://www.tiktok.com/@${item.author?.uniqueId}/video/${item.id}`,
              hashtag,
            });
          }
        }
      } catch {
        // JSON parse failed — page structure changed
      }
    });

    return comments;
  } catch (err) {
    console.error(`  [TikTok] #${hashtag} failed:`, err.message);
    return [];
  }
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
      console.error(`  [TikTok] Failed to save ${post.platform_id}:`, err.message);
    }
  }
  return saved;
}

async function collect() {
  console.log("  [TikTok] Starting collection...");
  const hashtags = config.tiktok.hashtags;
  let totalSaved = 0;

  for (const hashtag of hashtags) {
    const comments = await scrapeHashtag(hashtag);
    if (comments.length > 0) {
      const transformed = comments.map(transformTikTokComment);
      const saved = await savePosts(transformed);
      totalSaved += saved;
      console.log(`  [TikTok] #${hashtag}: ${saved} posts saved`);
    } else {
      console.log(`  [TikTok] #${hashtag}: no results`);
    }
  }

  console.log(`  [TikTok] Done. ${totalSaved} total new posts saved.`);
  return totalSaved;
}

module.exports = { collect, transformTikTokComment };
