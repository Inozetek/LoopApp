/**
 * Migration: Create Referrals Tracking Table
 *
 * Tracks referral flow:
 * - User A invites User B with referral link
 * - User B signs up with code → referral marked 'completed'
 * - Both users get 1 month Premium → referral marked 'rewarded'
 */

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  referral_code VARCHAR(10) NOT NULL,

  -- Status flow: pending → completed → rewarded
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rewarded', 'expired')),

  -- Metadata
  referred_email VARCHAR(255),  -- Invited email (before signup)
  referred_phone VARCHAR(20),   -- Invited phone (before signup)
  invite_method VARCHAR(20) CHECK (invite_method IN ('sms', 'email', 'link', 'contact_sync')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,  -- When referred user signed up
  rewarded_at TIMESTAMPTZ,   -- When Premium granted
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',  -- Referral link expires

  -- Constraints
  UNIQUE(referrer_user_id, referred_email),
  UNIQUE(referrer_user_id, referred_phone),
  CHECK (referred_user_id IS NULL OR (completed_at IS NOT NULL))
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referred_user_id) WHERE referred_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code, status);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status, created_at);

-- Drop existing functions if they exist (try all possible signatures)
DROP FUNCTION IF EXISTS complete_referral(VARCHAR, UUID) CASCADE;
DROP FUNCTION IF EXISTS complete_referral(VARCHAR(10), UUID) CASCADE;
DROP FUNCTION IF EXISTS complete_referral(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS complete_referral CASCADE;

DROP FUNCTION IF EXISTS reward_referral(UUID) CASCADE;
DROP FUNCTION IF EXISTS reward_referral CASCADE;

DROP FUNCTION IF EXISTS expire_old_referrals() CASCADE;
DROP FUNCTION IF EXISTS expire_old_referrals CASCADE;

-- Function to mark referral as completed when referred user signs up
CREATE FUNCTION complete_referral(
  p_referral_code VARCHAR(10),
  p_referred_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  referral_record RECORD;
BEGIN
  -- Find pending referral with this code
  SELECT * INTO referral_record
  FROM referrals
  WHERE referral_code = p_referral_code
    AND status = 'pending'
    AND expires_at > NOW()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Mark as completed
  UPDATE referrals
  SET
    referred_user_id = p_referred_user_id,
    status = 'completed',
    completed_at = NOW()
  WHERE id = referral_record.id;

  -- Increment referrer's referral count
  UPDATE users
  SET referral_count = referral_count + 1
  WHERE id = referral_record.referrer_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to grant Premium rewards to both users
CREATE FUNCTION reward_referral(p_referral_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  referral_record RECORD;
BEGIN
  -- Get completed referral
  SELECT * INTO referral_record
  FROM referrals
  WHERE id = p_referral_id
    AND status = 'completed'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Grant 1 month Premium to BOTH users
  UPDATE users
  SET
    subscription_tier = 'premium',
    subscription_status = 'trialing',
    subscription_end_date = GREATEST(
      COALESCE(subscription_end_date, NOW()),
      NOW()
    ) + INTERVAL '30 days'
  WHERE id IN (referral_record.referrer_user_id, referral_record.referred_user_id);

  -- Mark referral as rewarded
  UPDATE referrals
  SET
    status = 'rewarded',
    rewarded_at = NOW()
  WHERE id = p_referral_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Scheduled job to expire old pending referrals (run daily)
CREATE FUNCTION expire_old_referrals()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE referrals
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE referrals IS 'Tracks referral flow for viral growth (pending → completed → rewarded)';
COMMENT ON FUNCTION complete_referral IS 'Marks referral as completed when referred user signs up';
COMMENT ON FUNCTION reward_referral IS 'Grants 1 month Premium to both referrer and referred user';
COMMENT ON FUNCTION expire_old_referrals IS 'Expires pending referrals older than 30 days';
