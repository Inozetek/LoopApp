-- Business Accounts Migration
-- Adds account_type to users and creates business_profiles + analytics tables

-- Add account_type to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) DEFAULT 'personal'
  CHECK (account_type IN ('personal', 'business'));

-- Business profiles table
CREATE TABLE IF NOT EXISTS business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL,
  business_category VARCHAR(100) NOT NULL,
  business_description TEXT,

  -- Location
  location GEOGRAPHY(POINT, 4326),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  phone VARCHAR(20),
  website TEXT,

  -- Details
  hours JSONB DEFAULT '{}'::jsonb,
  photos JSONB DEFAULT '[]'::jsonb,
  logo_url TEXT,
  price_range INTEGER CHECK (price_range BETWEEN 0 AND 4),

  -- Google Places link
  google_place_id VARCHAR(255),
  claimed BOOLEAN DEFAULT FALSE,

  -- Business subscription (separate from user subscription)
  business_tier VARCHAR(20) DEFAULT 'organic'
    CHECK (business_tier IN ('organic', 'boosted', 'premium')),
  business_subscription_status VARCHAR(20) DEFAULT 'active'
    CHECK (business_subscription_status IN ('active', 'cancelled', 'past_due', 'trialing', 'inactive')),
  trial_ends_at TIMESTAMPTZ,
  stripe_subscription_id VARCHAR(255),

  -- Analytics (denormalized for quick dashboard)
  total_impressions INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_calendar_adds INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_profiles_user ON business_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_business_profiles_location ON business_profiles USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_business_profiles_category ON business_profiles(business_category);
CREATE INDEX IF NOT EXISTS idx_business_profiles_tier ON business_profiles(business_tier);

-- Business analytics (daily aggregates)
CREATE TABLE IF NOT EXISTS business_daily_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  calendar_adds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_profile_id, date)
);

CREATE INDEX IF NOT EXISTS idx_bda_profile_date ON business_daily_analytics(business_profile_id, date DESC);

-- RLS policies
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_daily_analytics ENABLE ROW LEVEL SECURITY;

-- Business profiles: owners can read/update/insert their own, public can read all
CREATE POLICY "Users can read own business profile"
  ON business_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own business profile"
  ON business_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own business profile"
  ON business_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public can read business profiles"
  ON business_profiles FOR SELECT USING (true);

-- Business analytics: only owners
CREATE POLICY "Business owners read own analytics"
  ON business_daily_analytics FOR SELECT
  USING (business_profile_id IN (
    SELECT id FROM business_profiles WHERE user_id = auth.uid()
  ));
