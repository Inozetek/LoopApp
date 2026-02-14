-- Migration 032: Curated Recommendations System
-- Adds curated picks infrastructure, curators table, and user demographic fields

-- ============================================================================
-- 1. Curated Recommendations Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS curated_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(50) NOT NULL,

  -- Place data (same format as places_cache.place_data)
  place_name VARCHAR(255) NOT NULL,
  place_data JSONB NOT NULL, -- Full Activity object

  -- Curation metadata
  categories TEXT[] NOT NULL, -- Matches INTEREST_GROUPS keys (e.g., 'Dining', 'Coffee & Cafes')
  age_brackets TEXT[] DEFAULT ARRAY['18-24','25-34','35-44','45+'],
  time_of_day TEXT[] DEFAULT ARRAY['morning','afternoon','evening','night'],

  -- Hand-crafted explanation
  curated_explanation TEXT NOT NULL, -- e.g., "A Deep Ellum institution — 4.8★ with..."
  curator VARCHAR(100) DEFAULT 'loop_team',

  -- Display control
  priority INTEGER DEFAULT 50, -- Higher = shown first (1-100)
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curated_city ON curated_recommendations(city, state, is_active);
CREATE INDEX IF NOT EXISTS idx_curated_categories ON curated_recommendations USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_curated_age ON curated_recommendations USING GIN(age_brackets);
CREATE INDEX IF NOT EXISTS idx_curated_time ON curated_recommendations USING GIN(time_of_day);

-- RLS policies
ALTER TABLE curated_recommendations ENABLE ROW LEVEL SECURITY;

-- Anyone can read active curated recommendations
CREATE POLICY "curated_recommendations_read" ON curated_recommendations
  FOR SELECT USING (is_active = TRUE);

-- ============================================================================
-- 2. Curators Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS curators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  display_name VARCHAR(100) NOT NULL,
  bio TEXT,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(50) NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  picks_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE curators ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved curators
CREATE POLICY "curators_read" ON curators
  FOR SELECT USING (is_approved = TRUE);

-- ============================================================================
-- 3. User Demographic Fields (for age-bracket personalization)
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_year INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_bracket VARCHAR(10);
