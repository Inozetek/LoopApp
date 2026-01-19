/**
 * Migration: Dual Feed Architecture
 *
 * Adds support for Daily and Explore feed modes with subscription tier limits.
 *
 * Changes:
 * - Add feed_preferences column to users table
 * - Create daily_feed_history table for tracking daily usage
 * - Create SQL function for incrementing daily views
 * - Add indexes for performance
 */

-- ============================================
-- 1. Add feed_preferences to users table
-- ============================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS feed_preferences JSONB DEFAULT '{
  "default_mode": "daily",
  "last_daily_refresh": null,
  "daily_recommendations_viewed_today": 0
}'::jsonb;

-- Index for querying last refresh time
CREATE INDEX IF NOT EXISTS idx_users_daily_refresh
ON users((feed_preferences->>'last_daily_refresh'));

-- ============================================
-- 2. Create daily_feed_history table
-- ============================================

CREATE TABLE IF NOT EXISTS daily_feed_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Recommendation counts
  recommendations_generated INTEGER NOT NULL DEFAULT 0,
  recommendations_viewed INTEGER DEFAULT 0,
  recommendations_accepted INTEGER DEFAULT 0,

  -- Subscription tracking
  subscription_tier VARCHAR(20) NOT NULL,
  daily_limit INTEGER NOT NULL,

  -- Time-sensitive tracking
  time_sensitive_shown INTEGER DEFAULT 0,
  time_sensitive_accepted INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one record per user per day
  UNIQUE(user_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_feed_history_user
ON daily_feed_history(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_feed_history_date
ON daily_feed_history(date DESC);

-- ============================================
-- 3. SQL Function: Increment Daily Views
-- ============================================

CREATE OR REPLACE FUNCTION increment_daily_views(
  p_user_id UUID,
  p_date DATE
)
RETURNS VOID AS $$
DECLARE
  v_subscription_tier VARCHAR(20);
  v_daily_limit INTEGER;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO v_subscription_tier
  FROM users
  WHERE id = p_user_id;

  -- Default to free if not found
  v_subscription_tier := COALESCE(v_subscription_tier, 'free');

  -- Calculate daily limit based on tier
  v_daily_limit := CASE v_subscription_tier
    WHEN 'free' THEN 5
    WHEN 'plus' THEN 15
    WHEN 'premium' THEN 30
    ELSE 5
  END;

  -- Insert or update daily_feed_history
  INSERT INTO daily_feed_history (
    user_id,
    date,
    recommendations_viewed,
    subscription_tier,
    daily_limit,
    recommendations_generated
  )
  VALUES (
    p_user_id,
    p_date,
    1,
    v_subscription_tier,
    v_daily_limit,
    0
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    recommendations_viewed = daily_feed_history.recommendations_viewed + 1,
    subscription_tier = v_subscription_tier,
    daily_limit = v_daily_limit;

END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Add subscription_tier to users if missing
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE users
    ADD COLUMN subscription_tier VARCHAR(20) DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'plus', 'premium'));
  END IF;
END $$;

-- Index for subscription queries
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier
ON users(subscription_tier);

-- ============================================
-- 5. Grant permissions
-- ============================================

-- Allow authenticated users to read/write their own feed history
ALTER TABLE daily_feed_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Users can view own feed history" ON daily_feed_history;
CREATE POLICY "Users can view own feed history"
ON daily_feed_history FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own feed history" ON daily_feed_history;
CREATE POLICY "Users can insert own feed history"
ON daily_feed_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own feed history" ON daily_feed_history;
CREATE POLICY "Users can update own feed history"
ON daily_feed_history FOR UPDATE
USING (auth.uid() = user_id);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 023_dual_feed_architecture completed successfully';
  RAISE NOTICE 'Created: daily_feed_history table';
  RAISE NOTICE 'Created: increment_daily_views() function';
  RAISE NOTICE 'Added: feed_preferences column to users';
END $$;
