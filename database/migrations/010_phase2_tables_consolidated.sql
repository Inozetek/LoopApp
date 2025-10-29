/**
 * Consolidated Migration: Phase 2 Tables (Referral System + Refresh Tracking)
 *
 * Run this in Supabase SQL Editor to enable Phase 2 features:
 * 1. Go to https://supabase.com/dashboard/project/[your-project]/sql
 * 2. Paste this entire file
 * 3. Click "Run"
 *
 * This migration adds:
 * - Referral system (viral growth engine)
 * - Refresh tracking (tier-based cooldowns)
 */

-- =============================================================================
-- PART 1: REFERRAL SYSTEM
-- =============================================================================

-- Add referral tracking columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(10) UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_credits_cents INTEGER DEFAULT 0;

-- Create indexes for referral code lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by_user_id);

-- Referrals table (track all referral relationships)
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  referral_code VARCHAR(10) NOT NULL,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'invalid')),
  completed_at TIMESTAMPTZ,

  -- Attribution
  source VARCHAR(50), -- 'sms', 'whatsapp', 'instagram', 'facebook', 'link', 'other'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(referrer_user_id, referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status, created_at);

-- Referral rewards table (track rewards earned)
CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL,

  reward_type VARCHAR(50) NOT NULL CHECK (reward_type IN (
    'inviter_bonus',
    'invitee_welcome',
    'milestone_3',
    'milestone_10',
    'milestone_25',
    'milestone_100'
  )),

  -- Reward details
  reward_description TEXT NOT NULL,
  reward_value_cents INTEGER,
  reward_plus_days INTEGER,

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'granted', 'revoked', 'expired')),
  granted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, referral_id, reward_type)
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_user ON referral_rewards(user_id, status);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_expiry ON referral_rewards(expires_at) WHERE status = 'granted';

-- Function: Generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS VARCHAR(10) AS $$
DECLARE
  new_code VARCHAR(10);
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate random 6-character code (uppercase letters + numbers)
    new_code := UPPER(
      SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6)
    );

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = new_code) INTO code_exists;

    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;

  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Function: Auto-generate referral code for new users
CREATE OR REPLACE FUNCTION auto_generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-generate referral code on user creation
DROP TRIGGER IF EXISTS trigger_auto_generate_referral_code ON users;
CREATE TRIGGER trigger_auto_generate_referral_code
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_referral_code();

-- Function: Process referral when user signs up with code
CREATE OR REPLACE FUNCTION process_referral(
  p_referred_user_id UUID,
  p_referral_code VARCHAR(10),
  p_source VARCHAR(50) DEFAULT 'link'
) RETURNS JSONB AS $$
DECLARE
  v_referrer_user_id UUID;
  v_referral_id UUID;
BEGIN
  -- Find referrer by code
  SELECT id INTO v_referrer_user_id
  FROM users
  WHERE referral_code = p_referral_code;

  -- If referrer not found, return error
  IF v_referrer_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  -- Don't allow self-referral
  IF v_referrer_user_id = p_referred_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  -- Create referral record
  INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, source, status)
  VALUES (v_referrer_user_id, p_referred_user_id, p_referral_code, p_source, 'pending')
  RETURNING id INTO v_referral_id;

  -- Update referred user
  UPDATE users
  SET referred_by_user_id = v_referrer_user_id
  WHERE id = p_referred_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'referral_id', v_referral_id,
    'referrer_user_id', v_referrer_user_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Complete referral and grant rewards
CREATE OR REPLACE FUNCTION complete_referral(
  p_referred_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_referral RECORD;
  v_invitee_reward_id UUID;
  v_inviter_reward_id UUID;
BEGIN
  -- Get referral record
  SELECT r.*
  INTO v_referral
  FROM referrals r
  WHERE r.referred_user_id = p_referred_user_id
  AND r.status = 'pending';

  -- If no pending referral, return
  IF v_referral IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pending referral found');
  END IF;

  -- Mark referral as completed
  UPDATE referrals
  SET status = 'completed', completed_at = NOW()
  WHERE id = v_referral.id;

  -- Increment referrer's referral count
  UPDATE users
  SET referral_count = referral_count + 1
  WHERE id = v_referral.referrer_user_id;

  -- Grant reward to invitee (referred user): 1 week Loop Plus
  INSERT INTO referral_rewards (
    user_id, referral_id, reward_type, reward_description,
    reward_plus_days, status, granted_at, expires_at
  )
  VALUES (
    p_referred_user_id, v_referral.id, 'invitee_welcome',
    'Welcome bonus: 7 days of Loop Plus free!',
    7, 'granted', NOW(), NOW() + INTERVAL '7 days'
  )
  RETURNING id INTO v_invitee_reward_id;

  -- Grant reward to inviter: Progress toward 1 month Plus (every 3 invites)
  IF (SELECT referral_count FROM users WHERE id = v_referral.referrer_user_id) % 3 = 0 THEN
    INSERT INTO referral_rewards (
      user_id, referral_id, reward_type, reward_description,
      reward_plus_days, status, granted_at, expires_at
    )
    VALUES (
      v_referral.referrer_user_id, v_referral.id, 'inviter_bonus',
      'Invited 3 friends! 1 month of Loop Plus free!',
      30, 'granted', NOW(), NOW() + INTERVAL '90 days'
    )
    RETURNING id INTO v_inviter_reward_id;
  END IF;

  -- Check for milestone: 10 referrals
  IF (SELECT referral_count FROM users WHERE id = v_referral.referrer_user_id) = 10 THEN
    INSERT INTO referral_rewards (
      user_id, reward_type, reward_description,
      reward_plus_days, status, granted_at
    )
    VALUES (
      v_referral.referrer_user_id, 'milestone_10',
      '🎉 10 referrals! 3 months Loop Premium!',
      90, 'granted', NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'referral_id', v_referral.id,
    'invitee_reward_id', v_invitee_reward_id,
    'inviter_reward_id', v_inviter_reward_id
  );
END;
$$ LANGUAGE plpgsql;

-- Helper view: Referral stats per user
CREATE OR REPLACE VIEW referral_stats AS
SELECT
  u.id as user_id,
  u.referral_code,
  u.referral_count,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'completed') as completed_referrals,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'pending') as pending_referrals,
  COUNT(DISTINCT rr.id) FILTER (WHERE rr.status = 'granted') as rewards_earned,
  SUM(rr.reward_plus_days) FILTER (WHERE rr.status = 'granted') as total_plus_days_earned
FROM users u
LEFT JOIN referrals r ON r.referrer_user_id = u.id
LEFT JOIN referral_rewards rr ON rr.user_id = u.id
GROUP BY u.id, u.referral_code, u.referral_count;

-- =============================================================================
-- PART 2: REFRESH TRACKING
-- =============================================================================

-- Add last_refresh_at to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMPTZ DEFAULT NOW();

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_users_last_refresh ON users(id, last_refresh_at);

-- Track refresh history for analytics
CREATE TABLE IF NOT EXISTS refresh_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  tier VARCHAR(20) NOT NULL,
  recommendations_count INTEGER NOT NULL,
  data_source VARCHAR(50) NOT NULL,

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

-- =============================================================================
-- DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE referrals IS 'Track all referral relationships between users (viral growth engine)';
COMMENT ON TABLE referral_rewards IS 'Track rewards earned from referrals (Loop Plus time, credits)';
COMMENT ON TABLE refresh_history IS 'Analytics: Track all recommendation refreshes for cost/usage analysis';

COMMENT ON FUNCTION process_referral IS 'Process a referral when new user signs up with referral code';
COMMENT ON FUNCTION complete_referral IS 'Complete referral and grant rewards when user finishes onboarding';
COMMENT ON FUNCTION can_user_refresh IS 'Check if user can refresh recommendations based on tier cooldown';
COMMENT ON FUNCTION seconds_until_refresh IS 'Get seconds until user can refresh again (0 if ready now)';

COMMENT ON VIEW referral_stats IS 'Summary stats for each user''s referral performance';

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Phase 2 tables created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  - referrals table';
  RAISE NOTICE '  - referral_rewards table';
  RAISE NOTICE '  - refresh_history table';
  RAISE NOTICE '  - referral_stats view';
  RAISE NOTICE '  - 4 helper functions';
  RAISE NOTICE '  - Referral code auto-generation trigger';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Update TypeScript types';
  RAISE NOTICE '  2. Remove @ts-nocheck from Phase 2 services';
  RAISE NOTICE '  3. Test referral system in app';
END $$;
