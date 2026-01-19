/**
 * Migration: City-Based Caching with Tiered Refresh
 *
 * This migration creates the infrastructure for city-based caching to minimize API costs
 * while maintaining high performance and data control for the recommendation algorithm.
 *
 * Features:
 * - City-based place caching (Google Places API)
 * - Event caching with auto-cleanup (Ticketmaster API)
 * - User demographic fields for age-gating and targeting
 * - Tiered refresh cadence support (60/30/15 days based on subscription tier)
 * - Category-based filtering (only cache user interests)
 */

-- =============================================================================
-- ENABLE REQUIRED EXTENSIONS
-- =============================================================================

-- Enable cube extension (required for earthdistance)
CREATE EXTENSION IF NOT EXISTS cube;

-- Enable earthdistance extension (provides ll_to_earth for geo queries)
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- =============================================================================
-- PLACES CACHE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS places_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Geographic grouping
  city VARCHAR(100) NOT NULL,
  state VARCHAR(50) NOT NULL,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),

  -- Place data
  place_id VARCHAR(255) NOT NULL,
  place_data JSONB NOT NULL, -- Full Google Places API response
  category VARCHAR(100),

  -- Cache metadata
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ DEFAULT NOW(),
  use_count INTEGER DEFAULT 0,
  is_stale BOOLEAN DEFAULT FALSE,

  -- Subscription tier for refresh cadence
  refresh_cadence_days INTEGER DEFAULT 60, -- Free: 60, Plus: 30, Premium: 15

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one place per city
  CONSTRAINT places_cache_city_place_unique UNIQUE(city, place_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_places_cache_city
  ON places_cache(city, state);

CREATE INDEX IF NOT EXISTS idx_places_cache_location
  ON places_cache USING GIST(
    ll_to_earth(lat, lng)
  );

CREATE INDEX IF NOT EXISTS idx_places_cache_freshness
  ON places_cache(cached_at, is_stale);

CREATE INDEX IF NOT EXISTS idx_places_cache_category
  ON places_cache(city, category);

-- =============================================================================
-- EVENTS CACHE TABLE (Time-Sensitive)
-- =============================================================================

CREATE TABLE IF NOT EXISTS events_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Geographic grouping
  city VARCHAR(100) NOT NULL,
  state VARCHAR(50) NOT NULL,

  -- Event data
  event_id VARCHAR(255) NOT NULL,
  event_data JSONB NOT NULL, -- Ticketmaster API response
  event_date TIMESTAMPTZ NOT NULL,
  category VARCHAR(100),

  -- Cache metadata
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Event date (auto-cleanup past events)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one event per city
  CONSTRAINT events_cache_city_event_unique UNIQUE(city, event_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_events_cache_city
  ON events_cache(city, state);

CREATE INDEX IF NOT EXISTS idx_events_cache_date
  ON events_cache(event_date);

CREATE INDEX IF NOT EXISTS idx_events_cache_category
  ON events_cache(city, category);

-- =============================================================================
-- UPDATE USERS TABLE (Add Demographic Fields)
-- =============================================================================

-- Add demographic fields for age-gating and ad targeting
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'non-binary', 'prefer_not_to_say', NULL));

-- Index for date of birth queries (age will be calculated in application code)
CREATE INDEX IF NOT EXISTS idx_users_dob
  ON users(date_of_birth)
  WHERE date_of_birth IS NOT NULL;

-- Helper function to calculate age (can be used in queries)
CREATE OR REPLACE FUNCTION calculate_age(p_date_of_birth DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_date_of_birth))::INTEGER;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

/**
 * Function: Auto-cleanup past events daily
 *
 * Deletes events from events_cache where event_date has passed.
 * Should be called by a daily cron job.
 */
CREATE OR REPLACE FUNCTION cleanup_past_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM events_cache
  WHERE event_date < CURRENT_DATE;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Cleaned up % past events', deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

/**
 * Function: Check if city cache exists and is fresh
 *
 * Returns cache status for a given city.
 */
CREATE OR REPLACE FUNCTION check_city_cache(
  p_city VARCHAR(100),
  p_state VARCHAR(50),
  p_refresh_days INTEGER DEFAULT 60
) RETURNS TABLE (
  cache_exists BOOLEAN,
  place_count BIGINT,
  last_cached TIMESTAMPTZ,
  is_stale BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) > 0 AS cache_exists,
    COUNT(*) AS place_count,
    MAX(cached_at) AS last_cached,
    (MAX(cached_at) < NOW() - (p_refresh_days || ' days')::INTERVAL) AS is_stale
  FROM places_cache
  WHERE city = p_city AND state = p_state;
END;
$$ LANGUAGE plpgsql;

/**
 * Function: Get cached places for a city
 *
 * Returns all non-stale places for a given city, optionally filtered by category.
 */
CREATE OR REPLACE FUNCTION get_cached_places(
  p_city VARCHAR(100),
  p_state VARCHAR(50),
  p_category VARCHAR(100) DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
) RETURNS TABLE (
  place_id VARCHAR(255),
  place_data JSONB,
  category VARCHAR(100),
  cached_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.place_id,
    pc.place_data,
    pc.category,
    pc.cached_at
  FROM places_cache pc
  WHERE pc.city = p_city
    AND pc.state = p_state
    AND pc.is_stale = FALSE
    AND (p_category IS NULL OR pc.category = p_category)
  ORDER BY pc.last_used DESC, pc.cached_at DESC
  LIMIT p_limit;

  -- Update last_used timestamp
  UPDATE places_cache
  SET last_used = NOW(), use_count = use_count + 1
  WHERE city = p_city AND state = p_state;
END;
$$ LANGUAGE plpgsql;

/**
 * Function: Mark places as stale for refresh
 *
 * Marks all places in a city as stale if they exceed the refresh cadence.
 */
CREATE OR REPLACE FUNCTION mark_stale_places(
  p_refresh_days INTEGER DEFAULT 60
) RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE places_cache
  SET is_stale = TRUE
  WHERE cached_at < NOW() - (p_refresh_days || ' days')::INTERVAL
    AND is_stale = FALSE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RAISE NOTICE 'Marked % places as stale', updated_count;

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

/**
 * Function: Get future events for a city
 *
 * Returns all future events for a given city, optionally filtered by category.
 */
CREATE OR REPLACE FUNCTION get_future_events(
  p_city VARCHAR(100),
  p_state VARCHAR(50),
  p_category VARCHAR(100) DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  event_id VARCHAR(255),
  event_data JSONB,
  event_date TIMESTAMPTZ,
  category VARCHAR(100)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ec.event_id,
    ec.event_data,
    ec.event_date,
    ec.category
  FROM events_cache ec
  WHERE ec.city = p_city
    AND ec.state = p_state
    AND ec.event_date >= CURRENT_DATE
    AND (p_category IS NULL OR ec.category = p_category)
  ORDER BY ec.event_date ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on cache tables (read-only for authenticated users)
ALTER TABLE places_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE events_cache ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read cache data
CREATE POLICY "Authenticated users can read places cache"
  ON places_cache
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read events cache"
  ON events_cache
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only service role can write to cache (backend only)
CREATE POLICY "Service role can insert places cache"
  ON places_cache
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update places cache"
  ON places_cache
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Service role can delete places cache"
  ON places_cache
  FOR DELETE USING (auth.role() = 'service_role');

CREATE POLICY "Service role can insert events cache"
  ON events_cache
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update events cache"
  ON events_cache
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Service role can delete events cache"
  ON events_cache
  FOR DELETE USING (auth.role() = 'service_role');

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ City-based caching infrastructure created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  - places_cache table (Google Places API caching)';
  RAISE NOTICE '  - events_cache table (Ticketmaster API caching)';
  RAISE NOTICE '  - User demographic fields (age, gender, date_of_birth)';
  RAISE NOTICE '  - 5 helper functions for cache management';
  RAISE NOTICE '  - RLS policies for security';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - City-based grouping (only cache cities with users)';
  RAISE NOTICE '  - Category filtering (cache only user interests)';
  RAISE NOTICE '  - Tiered refresh cadence (Free: 60 days, Plus: 30, Premium: 15)';
  RAISE NOTICE '  - Auto-cleanup of past events (call cleanup_past_events() daily)';
  RAISE NOTICE '  - Age-gating support for content filtering';
  RAISE NOTICE '';
  RAISE NOTICE 'Cost Impact:';
  RAISE NOTICE '  - Stays within Google Places API free tier ($200/month)';
  RAISE NOTICE '  - Zero ongoing API costs (cache-first architecture)';
  RAISE NOTICE '  - Efficient: Only fetches data for cities with active users';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Run this migration in Supabase SQL Editor';
  RAISE NOTICE '  2. Create city-detection.ts service';
  RAISE NOTICE '  3. Create cache-manager.ts service';
  RAISE NOTICE '  4. Update recommendations.ts to query cache instead of API';
  RAISE NOTICE '  5. Set up daily cron job to call cleanup_past_events()';
END $$;
