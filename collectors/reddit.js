// ============================================================
// REDDIT COLLECTOR
//
// Uses the "snoowrap" library to connect to Reddit's API.
// For each subreddit in our config, it fetches recent posts
// and searches for frustration keywords.
//
// "snoowrap" handles Reddit's OAuth for us — we just give
// it our app credentials and it manages tokens automatically.
// ============================================================

// snoowrap is optional — Reddit API requires pre-approval (Responsible Builder Policy)
let Snoowrap;
try { Snoowrap = require("snoowrap"); } catch (e) { /* not installed */ }

const db = require("../db");
const config = require("../config");

function createClient() {
  if (!process.env.REDDIT_CLIENT_ID) {
    throw new Error("REDDIT_CLIENT_ID not set — register at reddit.com/prefs/apps");
  }
  return new Snoowrap({
    userAgent: "nichescore:v1.0.0 (by /u/" + process.env.REDDIT_USERNAME + ")",
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    username: process.env.REDDIT_USERNAME,
    password: process.env.REDDIT_PASSWORD,
  });
}

function getAllSubreddits() {
  const subs = config.reddit.subreddits;
  return [
    ...subs.general,
    ...subs.realEstate,
    ...subs.gardening,
    ...subs.lifestyle,
  ];
}

function getSubredditTier(subredditName) {
  const tiers = config.subredditTiers;
  if (tiers.idea.includes(subredditName)) return "idea_subreddit";
  if (tiers.general.includes(subredditName)) return "general_subreddit";
  return "niche_subreddit";
}

function transformRedditPost(post) {
  const content = post.title + (post.selftext ? "\n\n" + post.selftext : "");
  return {
    platform: "reddit",
    platform_id: post.id,
    author: post.author?.name || "[deleted]",
    content,
    url: "https://reddit.com" + post.permalink,
    posted_at: new Date(post.created_utc * 1000),
    metadata: {
      subreddit: post.subreddit?.display_name || post.subreddit,
      score: post.score,
      num_comments: post.num_comments,
      tier: getSubredditTier(post.subreddit?.display_name || post.subreddit),
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
      console.error(`  [Reddit] Failed to save post ${post.platform_id}:`, err.message);
    }
  }
  return saved;
}

async function collect() {
  console.log("  [Reddit] Starting collection...");
  const reddit = createClient();
  const subreddits = getAllSubreddits();
  const limit = config.reddit.postsPerSubreddit;
  let totalSaved = 0;

  for (const sub of subreddits) {
    try {
      const posts = await reddit.getSubreddit(sub).getNew({ limit });
      const transformed = posts.map(transformRedditPost);
      const saved = await savePosts(transformed);
      totalSaved += saved;
      console.log(`  [Reddit] r/${sub}: ${saved}/${posts.length} new posts saved`);
    } catch (err) {
      console.error(`  [Reddit] r/${sub} failed:`, err.message);
    }
  }

  console.log(`  [Reddit] Done. ${totalSaved} total new posts saved.`);
  return totalSaved;
}

module.exports = { collect, transformRedditPost, getSubredditTier, getAllSubreddits };
