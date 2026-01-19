/**
 * Migration: Add OAuth Data and Referral Fields to Users
 *
 * Adds support for:
 * - Facebook liked places data (exact place names + categories)
 * - Google Timeline visited places history (6 months)
 * - Referral codes for viral growth
 * - Subscription tier fields for Premium rewards
 */

-- Add OAuth data fields to users table (split into individual statements for compatibility)
ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_data JSONB DEFAULT '{
  "liked_places": [],
  "events": [],
  "location": null
}'::jsonb;

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_timeline JSONB DEFAULT '{
  "visited_places": [],
  "last_synced": null
}'::jsonb;

ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;

-- Add unique constraint to referral_code if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_referral_code_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);
  END IF;
END
$$;

-- Create index on referral_code for quick lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- Create index on facebook_data for JSONB queries
CREATE INDEX IF NOT EXISTS idx_users_facebook_data ON users USING GIN(facebook_data);

-- Create index on google_timeline for JSONB queries
CREATE INDEX IF NOT EXISTS idx_users_google_timeline ON users USING GIN(google_timeline);

-- Drop existing function if it exists (to handle return type changes)
DROP FUNCTION IF EXISTS generate_referral_code();

-- Function to generate unique 6-character alphanumeric referral codes
CREATE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER := 0;
  code_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = result) INTO code_exists;

    -- If code doesn't exist, return it
    IF NOT code_exists THEN
      RETURN result;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS users_set_referral_code ON users;
DROP FUNCTION IF EXISTS set_referral_code();

-- Trigger to auto-generate referral codes for new users
CREATE FUNCTION set_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_referral_code ON users;
CREATE TRIGGER users_set_referral_code
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION set_referral_code();

-- Backfill referral codes for existing users (only if column exists and is null)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'referral_code'
  ) THEN
    UPDATE users SET referral_code = generate_referral_code() WHERE referral_code IS NULL;
  END IF;
END
$$;

COMMENT ON COLUMN users.facebook_data IS 'Facebook OAuth data: liked_places (exact names + categories), events, location';
COMMENT ON COLUMN users.google_timeline IS 'Google Timeline data: visited_places with visit counts, last_synced timestamp';
COMMENT ON COLUMN users.referral_code IS 'Unique 6-character referral code for viral growth';
COMMENT ON COLUMN users.referred_by_user_id IS 'User who referred this user (for Premium rewards)';
COMMENT ON COLUMN users.referral_count IS 'Number of successful referrals by this user';
