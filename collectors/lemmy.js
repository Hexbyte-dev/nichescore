// ============================================================
// LEMMY COLLECTOR
//
// Lemmy is a federated Reddit alternative. Each instance has
// its own communities (like subreddits). We query lemmy.world
// (the largest instance) using the official API.
//
// No authentication needed for read operations.
// ============================================================

const db = require("../db");
const config = require("../config");

function getAllCommunities() {
  const groups = config.lemmy.communities;
  return Object.values(groups).flat();
}

function transformLemmyPost(postView) {
  const post = postView.post;
  const creator = postView.creator;
  const community = postView.community;
  const title = post.name || "";
  const body = post.body || "";
  const content = body ? `${title}\n\n${body}` : title;

  return {
    platform: "lemmy",
    platform_id: `lemmy_${post.id}`,
    author: creator.name || "anonymous",
    content,
    url: post.ap_id || `${config.lemmy.instance}/post/${post.id}`,
    posted_at: post.published ? new Date(post.published) : null,
    metadata: {
      community: community.name || null,
      score: postView.counts ? postView.counts.score : null,
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
      console.error(`  [Lemmy] Failed to save post ${post.platform_id}:`, err.message);
    }
  }
  return saved;
}

async function collect() {
  console.log("  [Lemmy] Starting collection...");
  const instance = config.lemmy.instance;
  const communities = getAllCommunities();
  const limit = config.lemmy.postsPerCommunity;
  let totalSaved = 0;

  for (const community of communities) {
    try {
      const url = `${instance}/api/v3/post/list?community_name=${community}&sort=New&limit=${limit}`;
      const response = await fetch(url, {
        headers: { "User-Agent": "NicheScore/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        console.error(`  [Lemmy] ${community}: HTTP ${response.status}`);
        continue;
      }
      const data = await response.json();
      const posts = data.posts || [];
      const transformed = posts.map(transformLemmyPost);
      const saved = await savePosts(transformed);
      totalSaved += saved;
      console.log(`  [Lemmy] ${community}: ${saved} posts saved`);
    } catch (err) {
      console.error(`  [Lemmy] ${community} failed:`, err.message);
    }
  }

  console.log(`  [Lemmy] Done. ${totalSaved} total new posts saved.`);
  return totalSaved;
}

module.exports = { collect, transformLemmyPost, getAllCommunities };
