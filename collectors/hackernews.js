// ============================================================
// HACKER NEWS COLLECTOR
//
// Uses the Algolia-powered HN Search API to find frustration
// posts. No auth needed, no rate limit documented.
//
// API docs: https://hn.algolia.com/api
// ============================================================

const db = require("../db");
const config = require("../config");

function buildSearchUrl(keyword) {
  const encoded = encodeURIComponent(keyword);
  const base = config.hackernews.baseUrl;
  const limit = config.hackernews.resultsPerKeyword;
  return `${base}/search_by_date?query=${encoded}&tags=(story,comment)&hitsPerPage=${limit}`;
}

function transformHNItem(item) {
  const content = item.comment_text || item.story_text || item.title || "";
  return {
    platform: "hackernews",
    platform_id: item.objectID,
    author: item.author || "anonymous",
    content,
    url: `https://news.ycombinator.com/item?id=${item.objectID}`,
    posted_at: item.created_at ? new Date(item.created_at) : null,
    metadata: {
      type: item.comment_text ? "comment" : "story",
      story_title: item.story_title || item.title || null,
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
      console.error(`  [HackerNews] Failed to save item ${post.platform_id}:`, err.message);
    }
  }
  return saved;
}

async function collect() {
  console.log("  [HackerNews] Starting collection...");
  const keywords = config.keywords;
  let totalSaved = 0;

  for (const keyword of keywords) {
    try {
      const url = buildSearchUrl(keyword);
      const response = await fetch(url, {
        headers: { "User-Agent": "NicheScore/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        console.error(`  [HackerNews] Search failed for "${keyword}": ${response.status}`);
        continue;
      }
      const data = await response.json();
      const items = data.hits || [];
      const transformed = items.map(transformHNItem);
      const saved = await savePosts(transformed);
      totalSaved += saved;
      console.log(`  [HackerNews] "${keyword}": ${saved} items saved`);
    } catch (err) {
      console.error(`  [HackerNews] "${keyword}" failed:`, err.message);
    }
  }

  console.log(`  [HackerNews] Done. ${totalSaved} total new items saved.`);
  return totalSaved;
}

module.exports = { collect, transformHNItem, buildSearchUrl };
