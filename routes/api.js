// ============================================================
// NICHESCORE API ROUTES
//
// Read-only JSON endpoints for the dashboard.
// No authentication — this is a personal tool.
// ============================================================

const express = require("express");
const router = express.Router();
const db = require("../db");
const { calculateNicheScore, getFrequencyScore } = require("../scorer");

// GET /api/stats — overview numbers for the stats bar
router.get("/stats", async (req, res) => {
  try {
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
    const totalPosts = totals.rows.reduce((sum, r) => sum + r.count, 0);

    res.json({
      totalPosts,
      classified: classified.rows[0].count,
      unclassified: unclassified.rows[0].count,
      platforms: totals.rows,
    });
  } catch (err) {
    console.error("[API] /stats error:", err.message);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// GET /api/top — ranked problems with NicheScore
// Query params: period (day|week|month), limit (number), category (text)
router.get("/top", async (req, res) => {
  try {
    const period = req.query.period || "week";
    const limit = parseInt(req.query.limit || "20", 10);
    const category = req.query.category || null;
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
      WHERE rp.collected_at > NOW() - INTERVAL '1 day' * $1
        AND sp.is_app_solvable = true
    `;
    const params = [days];

    if (category) {
      params.push(`%${category}%`);
      query += ` AND sp.category ILIKE $${params.length}`;
    }

    query += ` GROUP BY sp.category ORDER BY post_count DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(query, params);

    const rows = result.rows.map((row, i) => {
      const frequency = getFrequencyScore(row.post_count);
      const nicheScore = calculateNicheScore({
        sentiment: Math.round(parseFloat(row.avg_sentiment)),
        frequency,
        sourceQuality: 6,
        solvability: row.solvability,
      });
      return {
        rank: i + 1,
        nicheScore,
        category: row.category,
        postCount: row.post_count,
        avgSentiment: parseFloat(row.avg_sentiment),
        solvability: row.solvability,
        platforms: row.platforms,
        topExample: row.top_example,
      };
    });

    res.json({ period, rows });
  } catch (err) {
    console.error("[API] /top error:", err.message);
    res.status(500).json({ error: "Failed to fetch top problems" });
  }
});

// GET /api/trends — daily trend data for charts
// Query params: days (number, default 30)
router.get("/trends", async (req, res) => {
  try {
    const days = parseInt(req.query.days || "30", 10);

    const result = await db.query(
      `SELECT date, category, post_count, avg_sentiment, platforms
       FROM trend_snapshots
       WHERE date > CURRENT_DATE - $1
       ORDER BY date ASC, post_count DESC`,
      [days]
    );

    const platformStats = await db.query(
      `SELECT platform, COUNT(*)::int AS count
       FROM raw_posts
       WHERE collected_at > NOW() - INTERVAL '1 day' * $1
       GROUP BY platform ORDER BY count DESC`,
      [days]
    );

    res.json({
      days,
      trends: result.rows,
      platformBreakdown: platformStats.rows,
    });
  } catch (err) {
    console.error("[API] /trends error:", err.message);
    res.status(500).json({ error: "Failed to fetch trends" });
  }
});

module.exports = router;
