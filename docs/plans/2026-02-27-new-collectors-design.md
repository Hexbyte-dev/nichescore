# New Collectors Design — Hacker News, Lemmy, Stack Exchange, Product Hunt

**Goal:** Expand NicheScore's data sources from 3 (App Store, Twitter, TikTok) to 7 by adding Hacker News, Lemmy, Stack Exchange, and Product Hunt.

**Rationale:** More data sources = better signal. These 4 platforms cover tech complaints (HN), community frustrations (Lemmy), specific Q&A pain points (SE), and product gaps (PH).

---

## 1. Hacker News Collector

- **API:** Algolia HN Search API (`hn.algolia.com/api/v1/search`)
- **Auth:** None required
- **Rate limit:** No documented limit (be polite, ~1 req/sec)
- **npm packages:** None needed — plain `fetch()` calls
- **Strategy:** Search frustration keywords, pull matching stories + comments
- **Source quality weight:** 7
- **Platform name in DB:** `hackernews`

## 2. Lemmy Collector

- **API:** Lemmy instance REST API (e.g., `lemmy.world/api/v3/`)
- **Auth:** None for read operations
- **Rate limit:** Per-instance, ~1-6 req/sec
- **npm packages:** `lemmy-js-client` (official)
- **Strategy:** Search niche communities matching our target sectors (real estate, gardening, homesteading, lifestyle). Mirror the Reddit subreddit structure.
- **Source quality weight:** 7
- **Platform name in DB:** `lemmy`

**Communities to monitor:**
- General: technology, asklemmy
- Real estate: realestate, homeowners
- Gardening: gardening, homesteading, permaculture
- Lifestyle: personalfinance, homeimprovement, interiordesign

## 3. Stack Exchange Collector

- **API:** `api.stackexchange.com/2.3/`
- **Auth:** Free API key (optional, gives 10K/day vs 300/day without)
- **Rate limit:** 10,000 requests/day with free key
- **npm packages:** None needed — simple REST API
- **Strategy:** Search questions on niche sites using frustration keywords. Focus on recent questions with answers that indicate unresolved pain.
- **Source quality weight:** 8
- **Platform name in DB:** `stackexchange`

**Sites to query:**
- `diy` (home improvement)
- `gardening`
- `money` (personal finance)
- `softwarerecs` (people explicitly asking for tools)
- `webapps` (people looking for web app solutions)

## 4. Product Hunt Collector

- **API:** GraphQL at `api.producthunt.com/v2`
- **Auth:** OAuth client_credentials flow (register free app)
- **Rate limit:** 6,250 complexity points / 15 min
- **npm packages:** None needed — `fetch()` with GraphQL queries
- **Strategy:** Pull recent product posts and comments, especially critical/negative feedback
- **Source quality weight:** 6
- **Platform name in DB:** `producthunt`
- **Env vars:** `PRODUCTHUNT_CLIENT_ID`, `PRODUCTHUNT_CLIENT_SECRET`

## Config Changes

Add to `config.js`:
- `hackernews` section (uses existing keywords array)
- `lemmy` section with communities list and instance URL
- `stackexchange` section with sites list
- `producthunt` section (minimal, just enabled flag)

Add to `sourceWeights`:
- `hackernews: 7`
- `lemmy: 7`
- `stackexchange: 8`
- `producthunt: 6`

## Pipeline Changes

- Add 4 new collectors to default platforms array
- Product Hunt is optional (like Reddit) since it needs credentials
- Hacker News, Lemmy, Stack Exchange work without any env vars

## .env.example Changes

Add optional env vars:
- `STACKEXCHANGE_API_KEY` (optional, increases rate limit)
- `PRODUCTHUNT_CLIENT_ID` (required for Product Hunt collector)
- `PRODUCTHUNT_CLIENT_SECRET` (required for Product Hunt collector)
