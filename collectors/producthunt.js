// ============================================================
// PRODUCT HUNT COLLECTOR
//
// Product Hunt is where new products launch. Comments often
// contain frustrations with existing solutions and requests
// for features — great for spotting gaps.
//
// Requires a free OAuth app registration to get API access.
// Uses client_credentials flow (no user login needed).
// ============================================================

const db = require("../db");
const config = require("../config");

function buildGraphQLQuery() {
  return `query {
    posts(order: NEWEST, first: ${config.producthunt.postsPerQuery}) {
      edges {
        node {
          id
          name
          tagline
          description
          url
          createdAt
          user { name }
          votesCount
          commentsCount
          topics { edges { node { name } } }
        }
      }
    }
  }`;
}

function transformPHPost(node) {
  const topics = node.topics
    ? node.topics.edges.map((e) => e.node.name)
    : [];
  const content = `${node.name}: ${node.tagline}${node.description ? "\n\n" + node.description : ""}`;

  return {
    platform: "producthunt",
    platform_id: node.id,
    author: node.user ? node.user.name : "anonymous",
    content,
    url: node.url || "https://www.producthunt.com",
    posted_at: node.createdAt ? new Date(node.createdAt) : null,
    metadata: {
      votes: node.votesCount || 0,
      comments: node.commentsCount || 0,
      topics,
    },
  };
}

async function getAccessToken() {
  const { clientId, clientSecret } = config.producthunt;
  if (!clientId || !clientSecret) return null;

  const response = await fetch("https://api.producthunt.com/v2/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    throw new Error(`OAuth failed: ${response.status}`);
  }
  const data = await response.json();
  return data.access_token;
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
      console.error(`  [ProductHunt] Failed to save post ${post.platform_id}:`, err.message);
    }
  }
  return saved;
}

async function collect() {
  console.log("  [ProductHunt] Starting collection...");

  const token = await getAccessToken();
  if (!token) {
    console.log("  [ProductHunt] Skipped — no API credentials configured");
    console.log("  [ProductHunt] Set PRODUCTHUNT_CLIENT_ID and PRODUCTHUNT_CLIENT_SECRET");
    return 0;
  }

  try {
    const query = buildGraphQLQuery();
    const response = await fetch(config.producthunt.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`  [ProductHunt] API error: ${response.status}`);
      return 0;
    }

    const data = await response.json();
    const edges = data.data?.posts?.edges || [];
    const transformed = edges.map((e) => transformPHPost(e.node));
    const saved = await savePosts(transformed);
    console.log(`  [ProductHunt] Done. ${saved} new posts saved.`);
    return saved;
  } catch (err) {
    console.error(`  [ProductHunt] Collection failed:`, err.message);
    return 0;
  }
}

module.exports = { collect, transformPHPost, buildGraphQLQuery };
