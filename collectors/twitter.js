// ============================================================
// X/TWITTER COLLECTOR (via Nitter)
//
// Nitter is an open-source alternative Twitter frontend.
// We scrape its HTML to get tweets without needing an API key.
//
// This is the least reliable collector — Nitter instances go
// down frequently. We rotate through several and skip failures.
//
// "cheerio" is like jQuery but for Node.js. It parses HTML
// and lets us extract data using CSS selectors.
// ============================================================

const cheerio = require("cheerio");
const db = require("../db");
const config = require("../config");

function buildSearchUrl(instance, keyword) {
  const encoded = encodeURIComponent(keyword).replace(/%20/g, "+");
  return `https://${instance}/search?f=tweets&q=${encoded}`;
}

function transformTweet(tweet, instance) {
  return {
    platform: "x",
    platform_id: tweet.id,
    author: tweet.author || "unknown",
    content: tweet.content,
    url: `https://${instance}${tweet.permalink}`,
    posted_at: tweet.timestamp ? new Date(tweet.timestamp) : null,
    metadata: {},
  };
}

async function scrapePage(instance, keyword) {
  const url = buildSearchUrl(instance, keyword);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NicheScore/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const tweets = [];

    $(".timeline-item").each((_, el) => {
      const $el = $(el);
      const content = $el.find(".tweet-content").text().trim();
      const author = $el.find(".username").first().text().replace("@", "").trim();
      const permalink = $el.find(".tweet-link").attr("href") || "";
      const id = permalink.split("/").pop() || `nitter_${Date.now()}_${Math.random()}`;
      const timestamp = $el.find(".tweet-date a").attr("title") || null;

      if (content) {
        tweets.push({ id, author, content, permalink, timestamp });
      }
    });

    return tweets;
  } catch (err) {
    console.error(`  [Twitter] ${instance} failed for "${keyword}":`, err.message);
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
      console.error(`  [Twitter] Failed to save tweet ${post.platform_id}:`, err.message);
    }
  }
  return saved;
}

async function collect() {
  console.log("  [Twitter] Starting collection...");
  const instances = config.twitter.nitterInstances;
  const keywords = config.keywords;
  let totalSaved = 0;

  for (const keyword of keywords) {
    let scraped = false;
    for (const instance of instances) {
      const tweets = await scrapePage(instance, keyword);
      if (tweets.length > 0) {
        const transformed = tweets.map((t) => transformTweet(t, instance));
        const saved = await savePosts(transformed);
        totalSaved += saved;
        console.log(`  [Twitter] "${keyword}": ${saved} tweets saved via ${instance}`);
        scraped = true;
        break;
      }
    }
    if (!scraped) {
      console.log(`  [Twitter] "${keyword}": no results from any instance`);
    }
  }

  console.log(`  [Twitter] Done. ${totalSaved} total new tweets saved.`);
  return totalSaved;
}

module.exports = { collect, transformTweet, buildSearchUrl };
