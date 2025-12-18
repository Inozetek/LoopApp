/**
 * Migration: Recommendation Tracking with Smart Resurfacing
 *
 * This migration creates the recommendation_tracking table for MVP recommendation persistence
 * with smart resurfacing logic.
 *
 * Features:
 * - Track when recommendations are shown (last_shown_at)
 * - Count how many times a recommendation has been shown (refresh_count)
 * - Support for "Never show again" functionality (not_interested status)
 * - Time-based resurfacing (3 days for declined, 7 days for ignored)
 */

-- =============================================================================
-- RECOMMENDATION TRACKING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS recommendation_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User and activity reference
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_place_id VARCHAR(255) NOT NULL,
  place_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,

  -- Store the full recommendation JSON for quick retrieval
  recommendation_data JSONB NOT NULL,

  -- Tracking fields
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
    'pending',        -- Not yet shown or just shown
    'viewed',         -- User saw the card
    'accepted',       -- Added to calendar
    'declined',       -- Explicitly declined or refreshed away
    'not_interested', -- Permanent block ("Never show again")
    'expired'         -- Recommendation expired
  )),

  -- Scoring
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),

  -- Resurfacing logic fields (NEW)
  last_shown_at TIMESTAMPTZ DEFAULT NOW(),
  refresh_count INTEGER DEFAULT 0,
  block_reason TEXT, -- Optional reason for not_interested status

  -- Response tracking
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  decline_reason VARCHAR(100), -- Quick decline reasons

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),

  -- Unique constraint: one tracking record per user per place
  UNIQUE(user_id, google_place_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_recommendation_tracking_user_status
  ON recommendation_tracking(user_id, status, last_shown_at);

CREATE INDEX IF NOT EXISTS idx_recommendation_tracking_place
  ON recommendation_tracking(google_place_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_tracking_resurfacing
  ON recommendation_tracking(user_id, last_shown_at)
  WHERE status IN ('declined', 'viewed');

CREATE INDEX IF NOT EXISTS idx_recommendation_tracking_expiry
  ON recommendation_tracking(expires_at)
  WHERE status = 'pending';

-- =============================================================================
-- BLOCKED ACTIVITIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS blocked_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_place_id VARCHAR(255) NOT NULL,
  place_name VARCHAR(255) NOT NULL,

  -- Why was this blocked?
  reason TEXT,

  blocked_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one block per user per place
  UNIQUE(user_id, google_place_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_activities_user
  ON blocked_activities(user_id);

CREATE INDEX IF NOT EXISTS idx_blocked_activities_place
  ON blocked_activities(google_place_id);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

/**
 * Function: Get recommendations eligible for resurfacing
 *
 * Logic:
 * - Exclude not_interested (permanently blocked)
 * - Exclude recently shown (< 3 days for declined, < 7 days for ignored)
 * - Include recommendations older than threshold
 */
CREATE OR REPLACE FUNCTION get_resurfaceable_recommendations(
  p_user_id UUID,
  p_declined_days INTEGER DEFAULT 3,
  p_ignored_days INTEGER DEFAULT 7
) RETURNS TABLE (
  google_place_id VARCHAR(255),
  last_shown_at TIMESTAMPTZ,
  refresh_count INTEGER,
  status VARCHAR(30)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rt.google_place_id,
    rt.last_shown_at,
    rt.refresh_count,
    rt.status
  FROM recommendation_tracking rt
  WHERE rt.user_id = p_user_id
    -- Exclude permanently blocked
    AND rt.status != 'not_interested'
    -- Exclude accepted (already on calendar)
    AND rt.status != 'accepted'
    -- Resurfacing logic
    AND (
      (rt.status = 'declined' AND rt.last_shown_at < NOW() - (p_declined_days || ' days')::INTERVAL)
      OR
      (rt.status IN ('viewed', 'expired') AND rt.last_shown_at < NOW() - (p_ignored_days || ' days')::INTERVAL)
    );
END;
$$ LANGUAGE plpgsql;

/**
 * Function: Check if place is blocked
 */
CREATE OR REPLACE FUNCTION is_place_blocked(
  p_user_id UUID,
  p_google_place_id VARCHAR(255)
) RETURNS BOOLEAN AS $$
DECLARE
  v_blocked BOOLEAN;
BEGIN
  -- Check if place is in blocked_activities
  SELECT EXISTS(
    SELECT 1 FROM blocked_activities
    WHERE user_id = p_user_id AND google_place_id = p_google_place_id
  ) INTO v_blocked;

  -- Also check if it's marked as not_interested in recommendation_tracking
  IF NOT v_blocked THEN
    SELECT EXISTS(
      SELECT 1 FROM recommendation_tracking
      WHERE user_id = p_user_id
        AND google_place_id = p_google_place_id
        AND status = 'not_interested'
    ) INTO v_blocked;
  END IF;

  RETURN v_blocked;
END;
$$ LANGUAGE plpgsql;

/**
 * Function: Update recommendation last_shown_at on refresh
 */
CREATE OR REPLACE FUNCTION mark_recommendation_shown(
  p_user_id UUID,
  p_google_place_id VARCHAR(255)
) RETURNS VOID AS $$
BEGIN
  UPDATE recommendation_tracking
  SET
    last_shown_at = NOW(),
    refresh_count = refresh_count + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id AND google_place_id = p_google_place_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE recommendation_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_activities ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tracking records
CREATE POLICY "Users can view own recommendation tracking"
  ON recommendation_tracking
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recommendation tracking"
  ON recommendation_tracking
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recommendation tracking"
  ON recommendation_tracking
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recommendation tracking"
  ON recommendation_tracking
  FOR DELETE USING (auth.uid() = user_id);

-- Users can only see their own blocked activities
CREATE POLICY "Users can view own blocked activities"
  ON blocked_activities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own blocked activities"
  ON blocked_activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own blocked activities"
  ON blocked_activities
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Recommendation tracking with smart resurfacing created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  - recommendation_tracking table with resurfacing fields';
  RAISE NOTICE '  - blocked_activities table';
  RAISE NOTICE '  - 3 helper functions for resurfacing logic';
  RAISE NOTICE '  - RLS policies for security';
  RAISE NOTICE '';
  RAISE NOTICE 'Resurfacing logic:';
  RAISE NOTICE '  - Declined recommendations: resurface after 3 days';
  RAISE NOTICE '  - Ignored recommendations: resurface after 7 days';
  RAISE NOTICE '  - not_interested: never resurface (unless unblocked)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Run this migration in Supabase SQL Editor';
  RAISE NOTICE '  2. Update recommendation-persistence.ts to use new fields';
  RAISE NOTICE '  3. Implement "Not Interested" button in activity cards';
END $$;
