#!/usr/bin/env node

// ============================================================
// NICHESCORE CLI
//
// Command-line interface for interacting with NicheScore data.
//
// Usage:
//   node cli.js top              — top problems this week
//   node cli.js top --period=month --limit=20
//   node cli.js stats            — collection statistics
//   node cli.js collect          — run collection now
//   node cli.js collect --platform=reddit
//   node cli.js classify         — run classifier now
// ============================================================

require("dotenv").config();
const db = require("./db");
const { runPipeline } = require("./pipeline");
const classifier = require("./classifier");
const { calculateNicheScore, getFrequencyScore, getSourceQuality } = require("./scorer");

function parseArgs(args) {
  const command = args[0] || "help";
  const flags = {};
  for (const arg of args.slice(1)) {
    const match = arg.match(/^--(\w+)=(.+)$/);
    if (match) flags[match[1]] = match[2];
  }
  return { command, flags };
}

async function cmdTop(flags) {
  const period = flags.period || "week";
  const limit = parseInt(flags.limit || "10", 10);
  const category = flags.category || null;

  const days = period === "day" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 7;

  let query = `
    SELECT
      sp.category,
      COUNT(*)::int AS post_count,
      ROUND(AVG(sp.sentiment_score), 1) AS avg_sentiment,
      ARRAY_AGG(DISTINCT rp.platform) AS platforms,
      ROUND(AVG(CASE WHEN sp.is_app_solvable THEN 1 ELSE 0 END) * 10, 0)::int AS solvability,
      (ARRAY_AGG(sp.summary ORDER BY sp.sentiment_score DESC))[1] AS top_example
    FROM scored_problems sp
    JOIN raw_posts rp ON rp.id = sp.raw_post_id
    WHERE rp.collected_at > NOW() - INTERVAL '${days} days'
      AND sp.is_app_solvable = true
  `;
  const params = [];

  if (category) {
    params.push(`%${category}%`);
    query += ` AND sp.category ILIKE $${params.length}`;
  }

  query += ` GROUP BY sp.category ORDER BY post_count DESC LIMIT ${limit}`;

  const result = await db.query(query, params);

  if (result.rows.length === 0) {
    console.log("\n  No problems found for this period.\n");
    return;
  }

  console.log(`\n  Top ${limit} problems (last ${period}):\n`);
  console.log("  Rank  NicheScore  Category                    Posts  Avg Sentiment  Platforms");
  console.log("  ────  ──────────  ──────────────────────────  ─────  ─────────────  ─────────");

  result.rows.forEach((row, i) => {
    const frequency = getFrequencyScore(row.post_count);
    const avgSourceQuality = 6;
    const nicheScore = calculateNicheScore({
      sentiment: Math.round(parseFloat(row.avg_sentiment)),
      frequency,
      sourceQuality: avgSourceQuality,
      solvability: row.solvability,
    });

    const rank = String(i + 1).padStart(4);
    const score = String(nicheScore).padStart(10);
    const cat = row.category.padEnd(28).slice(0, 28);
    const posts = String(row.post_count).padStart(5);
    const sent = String(row.avg_sentiment).padStart(13);
    const plats = row.platforms.join(", ");

    console.log(`  ${rank}  ${score}  ${cat}  ${posts}  ${sent}  ${plats}`);
  });
  console.log("");
}

async function cmdStats() {
  const totals = await db.query(
    `SELECT platform, COUNT(*)::int AS count FROM raw_posts GROUP BY platform ORDER BY count DESC`
  );
  const classified = await db.query(
    `SELECT COUNT(*)::int AS count FROM scored_problems`
  );
  const unclassified = await db.query(
    `SELECT COUNT(*)::int AS count FROM raw_posts rp
     LEFT JOIN scored_problems sp ON sp.raw_post_id = rp.id
     WHERE sp.id IS NULL`
  );

  console.log("\n  NicheScore Statistics:\n");
  console.log("  Platform         Posts");
  console.log("  ────────────────  ─────");
  for (const row of totals.rows) {
    console.log(`  ${row.platform.padEnd(18)} ${row.count}`);
  }
  console.log("");
  console.log(`  Classified:   ${classified.rows[0].count}`);
  console.log(`  Unclassified: ${unclassified.rows[0].count}`);
  console.log("");
}

async function cmdCollect(flags) {
  const platform = flags.platform || null;
  const platforms = platform ? [platform] : undefined;
  await runPipeline({ platforms });
}

async function cmdClassify() {
  await classifier.classify();
}

function cmdHelp() {
  console.log(`
  NicheScore CLI — Social Media Problem Discovery

  Usage:
    node cli.js <command> [flags]

  Commands:
    top       Show top-scoring problems
              --period=day|week|month  (default: week)
              --limit=N                (default: 10)
              --category=text          (filter by category)

    stats     Show collection statistics

    collect   Run collectors now
              --platform=reddit|appstore|twitter|tiktok

    classify  Run AI classifier on unclassified posts

    help      Show this help message
  `);
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  try {
    switch (command) {
      case "top": await cmdTop(flags); break;
      case "stats": await cmdStats(flags); break;
      case "collect": await cmdCollect(flags); break;
      case "classify": await cmdClassify(); break;
      case "help": default: cmdHelp(); break;
    }
  } catch (err) {
    console.error("\n  Error:", err.message, "\n");
    process.exit(1);
  }

  await db.end();
}

main();
