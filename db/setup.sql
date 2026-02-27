-- ============================================================
-- NICHESCORE DATABASE SETUP
--
-- Run this once to create all tables:
--   psql $DATABASE_URL -f db/setup.sql
--
-- Safe to run multiple times (IF NOT EXISTS prevents errors).
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Raw posts collected from all platforms
CREATE TABLE IF NOT EXISTS raw_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      TEXT NOT NULL,
  platform_id   TEXT NOT NULL,
  author        TEXT,
  content       TEXT NOT NULL,
  url           TEXT,
  collected_at  TIMESTAMPTZ DEFAULT NOW(),
  posted_at     TIMESTAMPTZ,
  metadata      JSONB DEFAULT '{}',
  UNIQUE(platform, platform_id)
);

-- Classified problems (one per raw_post)
CREATE TABLE IF NOT EXISTS scored_problems (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_post_id     UUID NOT NULL REFERENCES raw_posts(id),
  category        TEXT NOT NULL,
  subcategory     TEXT,
  sentiment_score INTEGER NOT NULL CHECK (sentiment_score BETWEEN 1 AND 10),
  is_app_solvable BOOLEAN DEFAULT false,
  summary         TEXT,
  classified_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Daily trend aggregates (pre-computed for dashboards)
CREATE TABLE IF NOT EXISTS trend_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date          DATE NOT NULL,
  category      TEXT NOT NULL,
  post_count    INTEGER NOT NULL DEFAULT 0,
  avg_sentiment DECIMAL(3,1),
  platforms     TEXT[] DEFAULT '{}',
  top_example   TEXT,
  UNIQUE(date, category)
);

-- Canonical categories (for merging synonyms)
CREATE TABLE IF NOT EXISTS categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical     TEXT UNIQUE NOT NULL,
  aliases       TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_raw_posts_platform ON raw_posts(platform);
CREATE INDEX IF NOT EXISTS idx_raw_posts_collected_at ON raw_posts(collected_at);
CREATE INDEX IF NOT EXISTS idx_scored_problems_category ON scored_problems(category);
CREATE INDEX IF NOT EXISTS idx_scored_problems_sentiment ON scored_problems(sentiment_score);
CREATE INDEX IF NOT EXISTS idx_trend_snapshots_date ON trend_snapshots(date);
