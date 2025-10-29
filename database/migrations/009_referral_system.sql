/**
 * Migration: Referral System (Viral Growth Engine)
 *
 * Strategy: "Invite 3 friends → Get 1 month Loop Plus free"
 * - Each user gets unique referral code
 * - Both inviter and invitee get rewards
 * - Track referrals for analytics and gamification
 */

-- Add referral tracking columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(10) UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_credits_cents INTEGER DEFAULT 0; -- Store as cents for precision

-- Create index for referral code lookups
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
  completed_at TIMESTAMPTZ, -- When referred user completed signup/onboarding

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
    'inviter_bonus',      -- Inviter gets reward when invitee signs up
    'invitee_welcome',    -- Invitee gets welcome bonus
    'milestone_3',        -- Invited 3 friends
    'milestone_10',       -- Invited 10 friends
    'milestone_25',       -- Invited 25 friends
    'milestone_100'       -- Invited 100 friends
  )),

  -- Reward details
  reward_description TEXT NOT NULL,
  reward_value_cents INTEGER, -- Monetary value (e.g., 499 = $4.99)
  reward_plus_days INTEGER,   -- Days of Loop Plus (e.g., 30 = 1 month)

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
  v_result JSONB;
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
  v_referrer_name TEXT;
  v_invitee_reward_id UUID;
  v_inviter_reward_id UUID;
BEGIN
  -- Get referral record
  SELECT r.*, u.name as referrer_name
  INTO v_referral
  FROM referrals r
  JOIN users u ON u.id = r.referrer_user_id
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
  -- Check if this is their 3rd, 6th, 9th, etc. referral
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

  -- Check for milestones (10, 25, 100 referrals)
  -- Milestone: 10 referrals
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

-- Comments for documentation
COMMENT ON TABLE referrals IS 'Track all referral relationships between users';
COMMENT ON TABLE referral_rewards IS 'Track rewards earned from referrals (Loop Plus time, credits)';
COMMENT ON FUNCTION process_referral IS 'Process a referral when new user signs up with referral code';
COMMENT ON FUNCTION complete_referral IS 'Complete referral and grant rewards when user finishes onboarding';
COMMENT ON VIEW referral_stats IS 'Summary stats for each user''s referral performance';
