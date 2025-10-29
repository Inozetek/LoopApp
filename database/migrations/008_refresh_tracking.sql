/**
 * Migration: Refresh Tracking for Tier-Based Cooldowns
 *
 * Purpose: Track when users last refreshed recommendations
 * to enforce cooldown periods (4h for free, 1h for plus, 0h for premium)
 */

-- Add last_refresh_at to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMPTZ DEFAULT NOW();

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_users_last_refresh ON users(id, last_refresh_at);

-- Create function to update last refresh time
CREATE OR REPLACE FUNCTION update_last_refresh()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_refresh_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Optional: Track refresh history for analytics
CREATE TABLE IF NOT EXISTS refresh_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  tier VARCHAR(20) NOT NULL,
  recommendations_count INTEGER NOT NULL,
  data_source VARCHAR(50) NOT NULL, -- 'database', 'google_places', 'osm'

  refresh_time TIMESTAMPTZ DEFAULT NOW(),

  -- For cost tracking
  google_api_calls INTEGER DEFAULT 0,
  estimated_cost_cents INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_history_user ON refresh_history(user_id, refresh_time DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_history_date ON refresh_history(DATE(refresh_time), tier);

-- Helper function to check if user can refresh
CREATE OR REPLACE FUNCTION can_user_refresh(
  p_user_id UUID,
  p_tier VARCHAR(20)
) RETURNS BOOLEAN AS $$
DECLARE
  v_last_refresh TIMESTAMPTZ;
  v_cooldown_hours INTEGER;
BEGIN
  -- Get user's last refresh time
  SELECT last_refresh_at INTO v_last_refresh
  FROM users
  WHERE id = p_user_id;

  -- Get cooldown for tier
  v_cooldown_hours := CASE p_tier
    WHEN 'free' THEN 4
    WHEN 'plus' THEN 1
    WHEN 'premium' THEN 0
    ELSE 4
  END;

  -- Premium has no cooldown
  IF v_cooldown_hours = 0 THEN
    RETURN TRUE;
  END IF;

  -- Check if cooldown has passed
  RETURN (NOW() - v_last_refresh) >= (v_cooldown_hours * INTERVAL '1 hour');
END;
$$ LANGUAGE plpgsql;

-- Helper function to get time until next refresh (in seconds)
CREATE OR REPLACE FUNCTION seconds_until_refresh(
  p_user_id UUID,
  p_tier VARCHAR(20)
) RETURNS INTEGER AS $$
DECLARE
  v_last_refresh TIMESTAMPTZ;
  v_cooldown_hours INTEGER;
  v_next_refresh TIMESTAMPTZ;
BEGIN
  -- Get user's last refresh time
  SELECT last_refresh_at INTO v_last_refresh
  FROM users
  WHERE id = p_user_id;

  -- Get cooldown for tier
  v_cooldown_hours := CASE p_tier
    WHEN 'free' THEN 4
    WHEN 'plus' THEN 1
    WHEN 'premium' THEN 0
    ELSE 4
  END;

  -- Premium has no cooldown
  IF v_cooldown_hours = 0 THEN
    RETURN 0;
  END IF;

  -- Calculate next refresh time
  v_next_refresh := v_last_refresh + (v_cooldown_hours * INTERVAL '1 hour');

  -- Return seconds until next refresh (or 0 if ready now)
  RETURN GREATEST(0, EXTRACT(EPOCH FROM (v_next_refresh - NOW()))::INTEGER);
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON COLUMN users.last_refresh_at IS 'Timestamp of last recommendation refresh (for cooldown enforcement)';
COMMENT ON TABLE refresh_history IS 'Analytics: Track all recommendation refreshes for cost analysis';
COMMENT ON FUNCTION can_user_refresh IS 'Check if user can refresh recommendations based on tier cooldown';
COMMENT ON FUNCTION seconds_until_refresh IS 'Get seconds until user can refresh again (0 if ready now)';
