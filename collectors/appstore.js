// ============================================================
// APP STORE COLLECTOR
//
// Scrapes 1-2 star reviews from Google Play and the iOS App
// Store. These are gold — reviewers describe exactly what's
// broken and what they wish the app did instead.
//
// No API keys needed. The npm packages handle scraping.
// ============================================================

const gplay = require("google-play-scraper").default || require("google-play-scraper");
const appStore = require("app-store-scraper");
const db = require("../db");
const config = require("../config");

function transformGoogleReview(review, appId) {
  return {
    platform: "appstore_google",
    platform_id: review.id,
    author: review.userName || "anonymous",
    content: review.text || "",
    url: review.url || `https://play.google.com/store/apps/details?id=${appId}`,
    posted_at: review.date ? new Date(review.date) : null,
    metadata: {
      app_id: appId,
      star_rating: review.score,
    },
  };
}

function transformAppleReview(review, appId) {
  return {
    platform: "appstore_ios",
    platform_id: review.id,
    author: review.userName || "anonymous",
    content: review.text || "",
    url: review.url || `https://apps.apple.com/app/id${appId}`,
    posted_at: review.updated ? new Date(review.updated) : null,
    metadata: {
      app_id: String(appId),
      star_rating: review.score,
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
      console.error(`  [AppStore] Failed to save review ${post.platform_id}:`, err.message);
    }
  }
  return saved;
}

async function collectGooglePlay() {
  const appIds = config.appStore.googlePlay;
  const num = config.appStore.reviewsPerApp;
  let totalSaved = 0;

  for (const appId of appIds) {
    try {
      const reviews = await gplay.reviews({
        appId,
        num,
        sort: gplay.sort.NEWEST,
      });
      const lowRated = reviews.data.filter((r) => r.score <= 2);
      const transformed = lowRated.map((r) => transformGoogleReview(r, appId));
      const saved = await savePosts(transformed);
      totalSaved += saved;
      console.log(`  [GooglePlay] ${appId}: ${saved} new low-rated reviews saved`);
    } catch (err) {
      console.error(`  [GooglePlay] ${appId} failed:`, err.message);
    }
  }
  return totalSaved;
}

async function collectAppStore() {
  const appIds = config.appStore.appStoreIos;
  let totalSaved = 0;

  for (const appId of appIds) {
    try {
      const reviews = await appStore.reviews({ id: appId, sort: appStore.sort.RECENT, page: 1 });
      const lowRated = reviews.filter((r) => r.score <= 2);
      const transformed = lowRated.map((r) => transformAppleReview(r, appId));
      const saved = await savePosts(transformed);
      totalSaved += saved;
      console.log(`  [AppStore iOS] ${appId}: ${saved} new low-rated reviews saved`);
    } catch (err) {
      console.error(`  [AppStore iOS] ${appId} failed:`, err.message);
    }
  }
  return totalSaved;
}

async function collect() {
  console.log("  [AppStore] Starting collection...");
  const gplaySaved = await collectGooglePlay();
  const iosSaved = await collectAppStore();
  const total = gplaySaved + iosSaved;
  console.log(`  [AppStore] Done. ${total} total new reviews saved.`);
  return total;
}

module.exports = { collect, transformGoogleReview, transformAppleReview };
