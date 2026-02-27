// ============================================================
// NICHESCORE CALCULATOR & TREND AGGREGATOR
//
// NicheScore formula:
//   (Sentiment*2 + Frequency*3 + SourceQuality*2 + Solvability*3) / 10
//
// The trend aggregator runs daily, rolling up scored_problems
// into trend_snapshots for fast dashboard queries.
// ============================================================

const db = require("./db");
const config = require("./config");

function calculateNicheScore({ sentiment, frequency, sourceQuality, solvability }) {
  const raw = (sentiment * 2) + (frequency * 3) + (sourceQuality * 2) + (solvability * 3);
  return Math.min(Math.round(raw / 10 * 10), 100);
}

function getFrequencyScore(count) {
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  if (count <= 10) return 4;
  if (count <= 15) return 5;
  if (count <= 25) return 6;
  if (count <= 40) return 7;
  if (count <= 60) return 8;
  if (count <= 80) return 9;
  return 10;
}

function getSourceQuality(platform, metadata) {
  if (platform === "appstore_ios") return config.sourceWeights.appstore_ios;
  if (platform === "appstore_google") return config.sourceWeights.appstore_google;
  if (platform === "x") return config.sourceWeights.x;
  if (platform === "tiktok") return config.sourceWeights.tiktok;
  if (platform === "reddit") {
    const tier = metadata?.tier || "niche_subreddit";
    return config.sourceWeights[tier] || config.sourceWeights.niche_subreddit;
  }
  if (platform === "hackernews") return config.sourceWeights.hackernews;
  if (platform === "lemmy") return config.sourceWeights.lemmy;
  if (platform === "stackexchange") return config.sourceWeights.stackexchange;
  if (platform === "producthunt") return config.sourceWeights.producthunt;
  return 5;
}

async function aggregateTrends(date) {
  const dateStr = date || new Date().toISOString().split("T")[0];
  console.log(`  [Trends] Aggregating for ${dateStr}...`);

  const result = await db.query(
    `SELECT
       sp.category,
       COUNT(*)::int AS post_count,
       ROUND(AVG(sp.sentiment_score), 1) AS avg_sentiment,
       ARRAY_AGG(DISTINCT rp.platform) AS platforms,
       (ARRAY_AGG(sp.summary ORDER BY sp.sentiment_score DESC))[1] AS top_example
     FROM scored_problems sp
     JOIN raw_posts rp ON rp.id = sp.raw_post_id
     WHERE DATE(rp.collected_at) = $1
       AND sp.is_app_solvable = true
     GROUP BY sp.category
     ORDER BY post_count DESC`,
    [dateStr]
  );

  let saved = 0;
  for (const row of result.rows) {
    try {
      await db.query(
        `INSERT INTO trend_snapshots (date, category, post_count, avg_sentiment, platforms, top_example)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (date, category) DO UPDATE SET
           post_count = EXCLUDED.post_count,
           avg_sentiment = EXCLUDED.avg_sentiment,
           platforms = EXCLUDED.platforms,
           top_example = EXCLUDED.top_example`,
        [dateStr, row.category, row.post_count, row.avg_sentiment, row.platforms, row.top_example]
      );
      saved++;
    } catch (err) {
      console.error(`  [Trends] Failed for ${row.category}:`, err.message);
    }
  }

  console.log(`  [Trends] Done. ${saved} categories aggregated.`);
  return saved;
}

module.exports = { calculateNicheScore, getFrequencyScore, getSourceQuality, aggregateTrends };
