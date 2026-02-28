# NicheScore Dashboard Design

**Goal:** A web dashboard served from the NicheScore Express server that displays collected data, trend charts, and ranked problem categories in a clean, sortable interface.

**Approach:** Single-file React app (via CDN, no build step) + Chart.js, served as static files from the same Express server. Three new API endpoints provide the data.

---

## API Endpoints

All read-only, no authentication:

- **`GET /api/stats`** — Total posts per platform, classified/unclassified counts
- **`GET /api/top?period=week&limit=20&category=gardening`** — Ranked problems with NicheScore
- **`GET /api/trends?days=30`** — Daily trend snapshots for charting

SQL queries adapted from existing cli.js.

## Dashboard Layout

Three sections, top to bottom:

### 1. Stats Bar (top)
Row of cards: total posts, classified count, active source count + names, top category.

### 2. Trend Charts (middle)
- **Line chart:** Top 5 categories over last 30 days (post count over time)
- **Bar chart:** Posts by platform

Uses Chart.js via CDN.

### 3. Ranked Problem Table (bottom)
- Columns: Rank, NicheScore, Category, Posts, Avg Sentiment, Solvability, Platforms
- Color-coded NicheScore badges (green/yellow/gray)
- Platform badges with colors
- Period filter dropdown (day/week/month)
- Category search/filter

### Style
Dark theme, clean and minimal, monospace font for numbers.

## File Structure

```
nichescore/
  public/
    index.html     <- Single-file React dashboard
  routes/
    api.js         <- Express routes for 3 API endpoints
  server.js        <- Serve public/ + mount /api routes
```

No new npm dependencies. React, Babel, Chart.js all via CDN.

## Hosting

Served from the same Railway deployment. Visit `nichescore-production.up.railway.app` to see the dashboard.
