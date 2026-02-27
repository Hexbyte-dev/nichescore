# New Collectors Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 4 new data source collectors (Hacker News, Lemmy, Stack Exchange, Product Hunt) to expand NicheScore from 3 to 7 sources.

**Architecture:** Each collector follows the existing pattern: a `collect()` function that fetches data, `transform*()` functions that normalize to raw_posts format, and `savePosts()` that inserts with ON CONFLICT dedup. Config goes in config.js, source weights in sourceWeights, pipeline.js gets updated to include new collectors.

**Tech Stack:** Node.js, fetch API, lemmy-js-client (npm), cheerio (already installed), PostgreSQL

---

### Task 1: Install dependencies and update config

**Files:**
- Modify: `package.json`
- Modify: `config.js:8-127`
- Modify: `.env.example`

**Step 1: Install lemmy-js-client**

Run: `npm install lemmy-js-client`

**Step 2: Add new source configs to config.js**

Add after the `twitter` section (line 101):

```javascript
  // Hacker News settings (Algolia Search API — no auth needed)
  hackernews: {
    baseUrl: "https://hn.algolia.com/api/v1",
    resultsPerKeyword: 20,
  },

  // Lemmy settings (federated Reddit alternative — no auth needed)
  lemmy: {
    instance: "https://lemmy.world",
    communities: {
      general: ["technology", "asklemmy"],
      realEstate: ["realestate", "homeowners"],
      gardening: ["gardening", "homesteading", "permaculture"],
      lifestyle: ["personalfinance", "homeimprovement", "interiordesign"],
    },
    postsPerCommunity: 15,
  },

  // Stack Exchange settings (free API — optional key for higher rate limit)
  stackexchange: {
    baseUrl: "https://api.stackexchange.com/2.3",
    sites: ["diy", "gardening", "money", "softwarerecs", "webapps"],
    questionsPerSite: 20,
    apiKey: process.env.STACKEXCHANGE_API_KEY || null,
  },

  // Product Hunt settings (requires free OAuth app registration)
  producthunt: {
    apiUrl: "https://api.producthunt.com/v2/api/graphql",
    clientId: process.env.PRODUCTHUNT_CLIENT_ID || null,
    clientSecret: process.env.PRODUCTHUNT_CLIENT_SECRET || null,
    postsPerQuery: 20,
  },
```

**Step 3: Add source weights**

Add to `sourceWeights` object in config.js:

```javascript
    hackernews: 7,
    lemmy: 7,
    stackexchange: 8,
    producthunt: 6,
```

**Step 4: Update .env.example**

Add after the Reddit section:

```
# Stack Exchange API key (optional — increases rate limit from 300 to 10K/day)
# Register free at https://stackapps.com
# STACKEXCHANGE_API_KEY=your-key-here

# Product Hunt API (optional — register free app at https://www.producthunt.com/v2/oauth/applications)
# PRODUCTHUNT_CLIENT_ID=your-client-id
# PRODUCTHUNT_CLIENT_SECRET=your-client-secret
```

**Step 5: Commit**

```bash
git add package.json package-lock.json config.js .env.example
git commit -m "feat: add config for 4 new collectors"
```

---

### Task 2: Hacker News Collector

**Files:**
- Create: `collectors/hackernews.js`
- Create: `collectors/hackernews.test.js`

**Step 1: Write the test file**

```javascript
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { transformHNItem, buildSearchUrl } = require("./hackernews");

describe("Hacker News Collector", () => {
  it("transforms an HN story into raw_posts format", () => {
    const item = {
      objectID: "12345",
      author: "pg",
      title: "I wish there was a better way to manage properties",
      story_text: null,
      url: "https://example.com/article",
      created_at: "2026-02-20T10:00:00.000Z",
    };
    const result = transformHNItem(item);
    assert.equal(result.platform, "hackernews");
    assert.equal(result.platform_id, "12345");
    assert.equal(result.author, "pg");
    assert.ok(result.content.includes("I wish there was"));
    assert.equal(result.url, "https://news.ycombinator.com/item?id=12345");
    assert.ok(result.posted_at instanceof Date);
  });

  it("transforms an HN comment into raw_posts format", () => {
    const item = {
      objectID: "67890",
      author: "someone",
      comment_text: "So frustrated that no app handles this correctly",
      story_title: "Ask HN: What tools do you wish existed?",
      created_at: "2026-02-21T15:30:00.000Z",
    };
    const result = transformHNItem(item);
    assert.equal(result.platform, "hackernews");
    assert.equal(result.platform_id, "67890");
    assert.ok(result.content.includes("So frustrated"));
  });

  it("builds a search URL with encoded keyword", () => {
    const url = buildSearchUrl("I wish there was");
    assert.ok(url.includes("hn.algolia.com"));
    assert.ok(url.includes("I%20wish%20there%20was"));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test collectors/hackernews.test.js`
Expected: FAIL — module not found

**Step 3: Write the collector**

```javascript
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
```

**Step 4: Run test to verify it passes**

Run: `node --test collectors/hackernews.test.js`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add collectors/hackernews.js collectors/hackernews.test.js
git commit -m "feat: add Hacker News collector"
```

---

### Task 3: Lemmy Collector

**Files:**
- Create: `collectors/lemmy.js`
- Create: `collectors/lemmy.test.js`

**Step 1: Write the test file**

```javascript
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { transformLemmyPost, getAllCommunities } = require("./lemmy");

describe("Lemmy Collector", () => {
  it("transforms a Lemmy post into raw_posts format", () => {
    const post = {
      post: {
        id: 99001,
        name: "Why is property management software so terrible?",
        body: "Every app I try is missing basic features. So frustrated.",
        ap_id: "https://lemmy.world/post/99001",
        published: "2026-02-20T12:00:00Z",
      },
      creator: { name: "testuser" },
      community: { name: "realestate" },
    };
    const result = transformLemmyPost(post);
    assert.equal(result.platform, "lemmy");
    assert.equal(result.platform_id, "lemmy_99001");
    assert.equal(result.author, "testuser");
    assert.ok(result.content.includes("property management"));
    assert.ok(result.content.includes("So frustrated"));
    assert.equal(result.metadata.community, "realestate");
  });

  it("returns all communities as a flat array", () => {
    const communities = getAllCommunities();
    assert.ok(Array.isArray(communities));
    assert.ok(communities.length > 0);
    assert.ok(communities.includes("gardening"));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test collectors/lemmy.test.js`
Expected: FAIL — module not found

**Step 3: Write the collector**

```javascript
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
```

**Step 4: Run test to verify it passes**

Run: `node --test collectors/lemmy.test.js`
Expected: 2 tests PASS

**Step 5: Commit**

```bash
git add collectors/lemmy.js collectors/lemmy.test.js
git commit -m "feat: add Lemmy collector"
```

---

### Task 4: Stack Exchange Collector

**Files:**
- Create: `collectors/stackexchange.js`
- Create: `collectors/stackexchange.test.js`

**Step 1: Write the test file**

```javascript
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { transformSEQuestion, buildSearchUrl } = require("./stackexchange");

describe("Stack Exchange Collector", () => {
  it("transforms an SE question into raw_posts format", () => {
    const question = {
      question_id: 55001,
      title: "Why is there no good tool for tracking garden plant schedules?",
      body: "I've tried 5 different apps and none of them work properly.",
      owner: { display_name: "greenthumb42" },
      link: "https://gardening.stackexchange.com/questions/55001",
      creation_date: 1708430400,
      tags: ["tools", "scheduling"],
      score: -2,
    };
    const result = transformSEQuestion(question, "gardening");
    assert.equal(result.platform, "stackexchange");
    assert.equal(result.platform_id, "se_gardening_55001");
    assert.equal(result.author, "greenthumb42");
    assert.ok(result.content.includes("no good tool"));
    assert.equal(result.metadata.site, "gardening");
    assert.deepEqual(result.metadata.tags, ["tools", "scheduling"]);
  });

  it("builds a search URL with API key when available", () => {
    const url = buildSearchUrl("diy", "wish there was", "test-key");
    assert.ok(url.includes("api.stackexchange.com"));
    assert.ok(url.includes("site=diy"));
    assert.ok(url.includes("key=test-key"));
  });

  it("builds a search URL without API key", () => {
    const url = buildSearchUrl("gardening", "frustrated", null);
    assert.ok(url.includes("site=gardening"));
    assert.ok(!url.includes("key="));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test collectors/stackexchange.test.js`
Expected: FAIL — module not found

**Step 3: Write the collector**

```javascript
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
  const keywords = config.keywords.slice(0, 3); // Use top 3 keywords to stay within rate limits
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

        // Respect rate limits — check quota
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
```

**Step 4: Run test to verify it passes**

Run: `node --test collectors/stackexchange.test.js`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add collectors/stackexchange.js collectors/stackexchange.test.js
git commit -m "feat: add Stack Exchange collector"
```

---

### Task 5: Product Hunt Collector

**Files:**
- Create: `collectors/producthunt.js`
- Create: `collectors/producthunt.test.js`

**Step 1: Write the test file**

```javascript
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { transformPHPost, buildGraphQLQuery } = require("./producthunt");

describe("Product Hunt Collector", () => {
  it("transforms a PH post into raw_posts format", () => {
    const post = {
      id: "ph_44001",
      name: "GardenTracker Pro",
      tagline: "Track your garden plants and schedules",
      url: "https://www.producthunt.com/posts/gardentracker-pro",
      createdAt: "2026-02-22T08:00:00Z",
      user: { name: "plantlover" },
      votesCount: 42,
      commentsCount: 8,
    };
    const result = transformPHPost(post);
    assert.equal(result.platform, "producthunt");
    assert.equal(result.platform_id, "ph_44001");
    assert.equal(result.author, "plantlover");
    assert.ok(result.content.includes("GardenTracker Pro"));
    assert.ok(result.content.includes("Track your garden"));
    assert.equal(result.metadata.votes, 42);
  });

  it("builds a valid GraphQL query", () => {
    const query = buildGraphQLQuery();
    assert.ok(query.includes("posts"));
    assert.ok(query.includes("name"));
    assert.ok(query.includes("tagline"));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test collectors/producthunt.test.js`
Expected: FAIL — module not found

**Step 3: Write the collector**

```javascript
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
```

**Step 4: Run test to verify it passes**

Run: `node --test collectors/producthunt.test.js`
Expected: 2 tests PASS

**Step 5: Commit**

```bash
git add collectors/producthunt.js collectors/producthunt.test.js
git commit -m "feat: add Product Hunt collector"
```

---

### Task 6: Pipeline and scorer integration

**Files:**
- Modify: `pipeline.js:12-53`
- Modify: `scorer.js` (getSourceQuality function — ensure new platforms are handled)

**Step 1: Update pipeline.js**

Add imports for new collectors (after existing imports):

```javascript
const hackernewsCollector = require("./collectors/hackernews");
const lemmyCollector = require("./collectors/lemmy");
const stackexchangeCollector = require("./collectors/stackexchange");

// Product Hunt is optional — needs API credentials
let producthuntCollector;
try { producthuntCollector = require("./collectors/producthunt"); } catch (e) { /* skip */ }
```

Update the default platforms array:

```javascript
const platforms = options.platforms || ["appstore", "twitter", "tiktok", "hackernews", "lemmy", "stackexchange", "producthunt"];
```

Add collector blocks for each new platform (same pattern as existing):

```javascript
  if (platforms.includes("hackernews")) {
    try { results.collected += await hackernewsCollector.collect(); } catch (e) {
      console.error("  [Pipeline] Hacker News collector error:", e.message);
    }
  }
  if (platforms.includes("lemmy")) {
    try { results.collected += await lemmyCollector.collect(); } catch (e) {
      console.error("  [Pipeline] Lemmy collector error:", e.message);
    }
  }
  if (platforms.includes("stackexchange")) {
    try { results.collected += await stackexchangeCollector.collect(); } catch (e) {
      console.error("  [Pipeline] Stack Exchange collector error:", e.message);
    }
  }
  if (platforms.includes("producthunt")) {
    if (!producthuntCollector) {
      console.log("  [Pipeline] Product Hunt skipped — collector not available");
    } else {
      try { results.collected += await producthuntCollector.collect(); } catch (e) {
        console.error("  [Pipeline] Product Hunt collector error:", e.message);
      }
    }
  }
```

**Step 2: Run all tests**

Run: `npm test`
Expected: All existing + new tests PASS

**Step 3: Commit**

```bash
git add pipeline.js scorer.js
git commit -m "feat: integrate 4 new collectors into pipeline"
```

---

### Task 7: Push and verify on Railway

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests PASS (should be ~23 tests across 10 suites)

**Step 2: Push to GitHub**

```bash
git push
```

Railway will auto-deploy.

**Step 3: Verify health check**

Visit: `https://nichescore-production.up.railway.app/health`
Expected: `{"status":"ok","service":"nichescore",...}`

**Step 4: Test collection locally**

Run: `node cli.js collect --platform=hackernews`
Then: `node cli.js collect --platform=lemmy`
Then: `node cli.js collect --platform=stackexchange`
Then: `node cli.js stats`

Verify each collector pulls data successfully.

**Step 5: Commit any fixes**

If any collector needs adjustments based on real API responses, fix and commit.
