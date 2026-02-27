// ============================================================
// NICHESCORE PIPELINE ORCHESTRATOR
//
// Ties everything together:
// 1. Runs all collectors
// 2. Runs the AI classifier on new posts
// 3. Aggregates trends
//
// Can be triggered by cron (automatic) or CLI (manual).
// ============================================================

const cron = require("node-cron");
const config = require("./config");

const redditCollector = require("./collectors/reddit");
const appstoreCollector = require("./collectors/appstore");
const twitterCollector = require("./collectors/twitter");
const tiktokCollector = require("./collectors/tiktok");
const classifier = require("./classifier");
const scorer = require("./scorer");

async function runPipeline(options = {}) {
  const startTime = Date.now();
  const platforms = options.platforms || ["reddit", "appstore", "twitter", "tiktok"];

  console.log("");
  console.log("  ╔══════════════════════════════════════╗");
  console.log("  ║      NicheScore Pipeline Running      ║");
  console.log("  ╚══════════════════════════════════════╝");
  console.log("");

  const results = { collected: 0, classified: 0, trends: 0 };

  if (platforms.includes("reddit")) {
    try { results.collected += await redditCollector.collect(); } catch (e) {
      console.error("  [Pipeline] Reddit collector error:", e.message);
    }
  }
  if (platforms.includes("appstore")) {
    try { results.collected += await appstoreCollector.collect(); } catch (e) {
      console.error("  [Pipeline] AppStore collector error:", e.message);
    }
  }
  if (platforms.includes("twitter")) {
    try { results.collected += await twitterCollector.collect(); } catch (e) {
      console.error("  [Pipeline] Twitter collector error:", e.message);
    }
  }
  if (platforms.includes("tiktok")) {
    try { results.collected += await tiktokCollector.collect(); } catch (e) {
      console.error("  [Pipeline] TikTok collector error:", e.message);
    }
  }

  try { results.classified = await classifier.classify(); } catch (e) {
    console.error("  [Pipeline] Classifier error:", e.message);
  }

  try { results.trends = await scorer.aggregateTrends(); } catch (e) {
    console.error("  [Pipeline] Trend aggregation error:", e.message);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("");
  console.log(`  Pipeline complete in ${elapsed}s:`);
  console.log(`    Collected:  ${results.collected} new posts`);
  console.log(`    Classified: ${results.classified} posts`);
  console.log(`    Trends:     ${results.trends} categories updated`);
  console.log("");

  return results;
}

function startScheduler() {
  const schedule = config.schedule;
  console.log(`  [Scheduler] NicheScore cron set: ${schedule}`);

  cron.schedule(schedule, async () => {
    console.log(`  [Scheduler] Triggered at ${new Date().toISOString()}`);
    await runPipeline();
  });
}

module.exports = { runPipeline, startScheduler };
