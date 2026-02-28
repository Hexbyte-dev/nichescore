# NicheScore Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web dashboard served from the NicheScore Express server that shows stats, trend charts, and a ranked problem table.

**Architecture:** Three API endpoints (stats, top, trends) serve JSON from PostgreSQL. A single `public/index.html` file contains a React app (via CDN) that fetches the APIs and renders a dark-themed dashboard with Chart.js charts and a sortable table.

**Tech Stack:** Express.js (existing), React 18 via CDN, Babel standalone via CDN, Chart.js 4 via CDN

---

### Task 1: API Routes

**Files:**
- Create: `routes/api.js`
- Modify: `server.js`

**Step 1: Create routes/api.js**

This file has 3 GET endpoints. The SQL is adapted from cli.js — same queries, but returning JSON instead of printing to console.

```javascript
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

    // Also get platform breakdown
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
```

**Step 2: Update server.js**

Add two lines — mount the API routes and serve the public folder:

After `app.use(express.json());` add:
```javascript
const apiRoutes = require("./routes/api");
app.use("/api", apiRoutes);
app.use(express.static("public"));
```

**Step 3: Run existing tests**

Run: `npm test`
Expected: 23 tests PASS (no test changes needed)

**Step 4: Commit**

```bash
git add routes/api.js server.js
git commit -m "feat: add API routes for dashboard"
```

---

### Task 2: Dashboard HTML — Stats Bar

**Files:**
- Create: `public/index.html`

**Step 1: Create the base HTML with React, Babel, Chart.js CDN links and the StatsBar component**

Create `public/index.html` with the full HTML skeleton, CSS variables for dark theme, and just the StatsBar component working first. The StatsBar fetches `/api/stats` and displays 4 cards.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NicheScore Dashboard</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f0f0f;
      color: #e0e0e0;
      min-height: 100vh;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; font-weight: 600; margin-bottom: 24px; color: #fff; }
    h2 { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #ccc; }

    /* Stats Bar */
    .stats-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .stat-card {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      padding: 20px;
    }
    .stat-card .label { font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .stat-card .value { font-size: 28px; font-weight: 700; font-family: 'SF Mono', 'Consolas', monospace; color: #fff; }
    .stat-card .detail { font-size: 12px; color: #666; margin-top: 4px; }

    /* Charts */
    .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
    .chart-card {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      padding: 20px;
    }
    @media (max-width: 768px) { .charts { grid-template-columns: 1fr; } }

    /* Table */
    .table-controls { display: flex; gap: 12px; margin-bottom: 16px; align-items: center; }
    .table-controls select, .table-controls input {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      color: #e0e0e0;
      padding: 8px 12px;
      font-size: 14px;
    }
    .table-controls input { flex: 1; max-width: 300px; }
    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left;
      padding: 12px 16px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #888;
      border-bottom: 1px solid #2a2a2a;
      cursor: pointer;
      user-select: none;
    }
    th:hover { color: #fff; }
    td { padding: 12px 16px; border-bottom: 1px solid #1a1a1a; font-size: 14px; }
    tr:hover { background: #1a1a1a; }
    .score-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 700;
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 13px;
    }
    .score-high { background: #0a3d1a; color: #4ade80; }
    .score-med { background: #3d3a0a; color: #facc15; }
    .score-low { background: #2a2a2a; color: #888; }
    .platform-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      margin: 1px 2px;
      font-weight: 500;
    }
    .plat-hackernews { background: #3d2a0a; color: #ff6600; }
    .plat-stackexchange { background: #0a2a3d; color: #5bb3e0; }
    .plat-lemmy { background: #0a3d2a; color: #4ade80; }
    .plat-appstore_ios { background: #2a0a3d; color: #bf7af0; }
    .plat-appstore_google { background: #0a3d3d; color: #4adede; }
    .plat-producthunt { background: #3d1a0a; color: #da552f; }
    .plat-x { background: #2a2a2a; color: #aaa; }
    .plat-tiktok { background: #2a0a2a; color: #fe2c55; }

    .loading { text-align: center; padding: 40px; color: #666; }
    .example-text { font-size: 12px; color: #666; font-style: italic; max-width: 300px; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useRef } = React;

    function StatsBar() {
      const [stats, setStats] = useState(null);

      useEffect(() => {
        fetch("/api/stats").then(r => r.json()).then(setStats);
      }, []);

      if (!stats) return <div className="loading">Loading stats...</div>;

      const sources = stats.platforms.map(p => p.platform).join(", ");

      return (
        <div className="stats-bar">
          <div className="stat-card">
            <div className="label">Total Posts</div>
            <div className="value">{stats.totalPosts.toLocaleString()}</div>
            <div className="detail">{stats.platforms.length} sources</div>
          </div>
          <div className="stat-card">
            <div className="label">Classified</div>
            <div className="value">{stats.classified.toLocaleString()}</div>
            <div className="detail">{stats.unclassified} remaining</div>
          </div>
          <div className="stat-card">
            <div className="label">Active Sources</div>
            <div className="value">{stats.platforms.length}</div>
            <div className="detail">{sources}</div>
          </div>
          <div className="stat-card">
            <div className="label">Top Source</div>
            <div className="value">{stats.platforms[0]?.platform || "—"}</div>
            <div className="detail">{stats.platforms[0]?.count || 0} posts</div>
          </div>
        </div>
      );
    }

    function App() {
      return (
        <div className="container">
          <h1>NicheScore Dashboard</h1>
          <StatsBar />
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById("root")).render(<App />);
  </script>
</body>
</html>
```

**Step 2: Test locally**

Run: `node server.js`
Visit: `http://localhost:3002`
Expected: See 4 stat cards with real data

**Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: add dashboard with stats bar"
```

---

### Task 3: Dashboard — Trend Charts

**Files:**
- Modify: `public/index.html`

**Step 1: Add TrendCharts component**

Add the component after StatsBar. Uses Chart.js with `useRef` and `useEffect` to render:

```jsx
function TrendCharts() {
  const [data, setData] = useState(null);
  const lineRef = useRef(null);
  const barRef = useRef(null);
  const lineChart = useRef(null);
  const barChart = useRef(null);

  useEffect(() => {
    fetch("/api/trends?days=30").then(r => r.json()).then(setData);
  }, []);

  useEffect(() => {
    if (!data || !lineRef.current || !barRef.current) return;

    // Destroy previous charts if they exist
    if (lineChart.current) lineChart.current.destroy();
    if (barChart.current) barChart.current.destroy();

    // Line chart: top 5 categories over time
    const categories = {};
    data.trends.forEach(t => {
      if (!categories[t.category]) categories[t.category] = { dates: [], counts: [], total: 0 };
      categories[t.category].dates.push(t.date.split("T")[0]);
      categories[t.category].counts.push(t.post_count);
      categories[t.category].total += t.post_count;
    });
    const top5 = Object.entries(categories)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
    const colors = ["#4ade80", "#facc15", "#5bb3e0", "#bf7af0", "#ff6600"];

    lineChart.current = new Chart(lineRef.current, {
      type: "line",
      data: {
        labels: top5[0] ? top5[0][1].dates : [],
        datasets: top5.map(([cat, d], i) => ({
          label: cat,
          data: d.counts,
          borderColor: colors[i],
          backgroundColor: colors[i] + "20",
          tension: 0.3,
          fill: true,
        })),
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: "#888" } } },
        scales: {
          x: { ticks: { color: "#666" }, grid: { color: "#1a1a1a" } },
          y: { ticks: { color: "#666" }, grid: { color: "#1a1a1a" } },
        },
      },
    });

    // Bar chart: posts by platform
    const platColors = {
      hackernews: "#ff6600", stackexchange: "#5bb3e0", lemmy: "#4ade80",
      appstore_ios: "#bf7af0", appstore_google: "#4adede", producthunt: "#da552f",
      x: "#aaa", tiktok: "#fe2c55",
    };
    barChart.current = new Chart(barRef.current, {
      type: "bar",
      data: {
        labels: data.platformBreakdown.map(p => p.platform),
        datasets: [{
          label: "Posts",
          data: data.platformBreakdown.map(p => p.count),
          backgroundColor: data.platformBreakdown.map(p => platColors[p.platform] || "#888"),
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#888" }, grid: { color: "#1a1a1a" } },
          y: { ticks: { color: "#666" }, grid: { color: "#1a1a1a" } },
        },
      },
    });
  }, [data]);

  if (!data) return <div className="loading">Loading trends...</div>;

  return (
    <div className="charts">
      <div className="chart-card">
        <h2>Top Categories (30 days)</h2>
        <canvas ref={lineRef}></canvas>
      </div>
      <div className="chart-card">
        <h2>Posts by Platform</h2>
        <canvas ref={barRef}></canvas>
      </div>
    </div>
  );
}
```

Then add `<TrendCharts />` to the App component between StatsBar and the table.

**Step 2: Test locally**

Run: `node server.js`
Visit: `http://localhost:3002`
Expected: Stats cards + 2 charts rendering with real data

**Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: add trend charts to dashboard"
```

---

### Task 4: Dashboard — Ranked Problem Table

**Files:**
- Modify: `public/index.html`

**Step 1: Add ProblemTable component**

This is the main data view — a sortable, filterable table with NicheScore badges and platform colors.

```jsx
function ProblemTable() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("week");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("nicheScore");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    fetch(`/api/top?period=${period}&limit=50`)
      .then(r => r.json())
      .then(setData);
  }, [period]);

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  function scoreClass(score) {
    if (score >= 70) return "score-badge score-high";
    if (score >= 50) return "score-badge score-med";
    return "score-badge score-low";
  }

  function platClass(platform) {
    return `platform-badge plat-${platform}`;
  }

  if (!data) return <div className="loading">Loading problems...</div>;

  let rows = [...data.rows];
  if (search) {
    rows = rows.filter(r => r.category.toLowerCase().includes(search.toLowerCase()));
  }
  rows.sort((a, b) => {
    const aVal = a[sortCol];
    const bVal = b[sortCol];
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }
    return sortDir === "asc"
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const arrow = (col) => sortCol === col ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <div>
      <h2>Ranked Problems</h2>
      <div className="table-controls">
        <select value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="day">Last 24 hours</option>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
        </select>
        <input
          type="text"
          placeholder="Filter by category..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <table>
        <thead>
          <tr>
            <th onClick={() => handleSort("rank")}>#{ arrow("rank")}</th>
            <th onClick={() => handleSort("nicheScore")}>Score{arrow("nicheScore")}</th>
            <th onClick={() => handleSort("category")}>Category{arrow("category")}</th>
            <th onClick={() => handleSort("postCount")}>Posts{arrow("postCount")}</th>
            <th onClick={() => handleSort("avgSentiment")}>Sentiment{arrow("avgSentiment")}</th>
            <th onClick={() => handleSort("solvability")}>Solvability{arrow("solvability")}</th>
            <th>Sources</th>
            <th>Example</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.category}>
              <td>{row.rank}</td>
              <td><span className={scoreClass(row.nicheScore)}>{row.nicheScore}</span></td>
              <td>{row.category}</td>
              <td>{row.postCount}</td>
              <td>{row.avgSentiment}</td>
              <td>{row.solvability}</td>
              <td>{row.platforms.map(p => (
                <span key={p} className={platClass(p)}>{p}</span>
              ))}</td>
              <td><span className="example-text">{row.topExample}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Then update App:
```jsx
function App() {
  return (
    <div className="container">
      <h1>NicheScore Dashboard</h1>
      <StatsBar />
      <TrendCharts />
      <ProblemTable />
    </div>
  );
}
```

**Step 2: Test locally**

Run: `node server.js`
Visit: `http://localhost:3002`
Expected: Full dashboard — stats cards, 2 charts, sortable/filterable table

**Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: add ranked problem table to dashboard"
```

---

### Task 5: Push and verify on Railway

**Step 1: Run tests**

Run: `npm test`
Expected: 23 tests PASS

**Step 2: Push**

```bash
git push
```

Railway auto-deploys.

**Step 3: Verify**

Visit: `https://nichescore-production.up.railway.app`
Expected: Full dashboard with live data

Visit: `https://nichescore-production.up.railway.app/health`
Expected: Still returns JSON health check
