/**
 * Migration: Unified Likes System
 *
 * Creates a unified social engagement system inspired by Instagram's like patterns:
 * - Activity/place likes that feed into algorithm and social proof
 * - Privacy-aware categories (sensitive places default to private)
 * - Aggregated place ratings for community score
 *
 * Features:
 * - 1 Like = 5 Stars (full endorsement to algo)
 * - Instagram-style "Liked by [friend] and X others" display
 * - Friends who liked visibility (respects privacy settings)
 * - Sensitive category auto-classification
 */

-- ============================================================
-- 1. Activity/Place Likes Table
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Place identification (Google Place ID as primary key)
  place_id VARCHAR(255) NOT NULL,
  place_name VARCHAR(255) NOT NULL,
  place_category VARCHAR(100),
  place_location GEOGRAPHY(POINT, 4326),
  place_address TEXT,

  -- Optional references to existing tables
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,

  -- Privacy controls
  visibility VARCHAR(20) DEFAULT 'friends' CHECK (visibility IN ('private', 'friends', 'public')),
  is_sensitive_category BOOLEAN DEFAULT FALSE,

  -- Metadata
  liked_at TIMESTAMPTZ DEFAULT NOW(),
  source VARCHAR(30) DEFAULT 'feed' CHECK (source IN ('feed', 'details', 'search', 'friend_profile', 'likers_list')),

  -- Ensure one like per user per place
  UNIQUE(user_id, place_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_activity_likes_user ON activity_likes(user_id, liked_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_likes_place ON activity_likes(place_id, liked_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_likes_visibility ON activity_likes(place_id, visibility) WHERE visibility != 'private';
CREATE INDEX IF NOT EXISTS idx_activity_likes_category ON activity_likes(place_category, liked_at DESC);

-- ============================================================
-- 2. Aggregated Place Ratings Table
-- ============================================================

CREATE TABLE IF NOT EXISTS place_ratings_aggregate (
  place_id VARCHAR(255) PRIMARY KEY,
  place_name VARCHAR(255),
  place_category VARCHAR(100),

  -- Engagement metrics
  total_likes INTEGER DEFAULT 0,
  total_thumbs_up INTEGER DEFAULT 0,      -- From feedback table
  total_thumbs_down INTEGER DEFAULT 0,    -- From feedback table

  -- Calculated score (0.00-5.00)
  loop_community_score DECIMAL(3,2) DEFAULT NULL,

  -- Trending detection
  likes_last_7_days INTEGER DEFAULT 0,
  likes_last_30_days INTEGER DEFAULT 0,
  is_trending BOOLEAN DEFAULT FALSE,
  trending_rank INTEGER DEFAULT NULL,

  -- Privacy flag
  is_sensitive_category BOOLEAN DEFAULT FALSE,

  -- Metadata
  first_liked_at TIMESTAMPTZ,
  last_liked_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for trending and lookup
CREATE INDEX IF NOT EXISTS idx_place_ratings_trending ON place_ratings_aggregate(is_trending, trending_rank) WHERE is_trending = TRUE;
CREATE INDEX IF NOT EXISTS idx_place_ratings_score ON place_ratings_aggregate(loop_community_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_place_ratings_category ON place_ratings_aggregate(place_category, total_likes DESC);

-- ============================================================
-- 3. Sensitive Categories Configuration Table
-- ============================================================

CREATE TABLE IF NOT EXISTS sensitive_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_pattern VARCHAR(100) NOT NULL UNIQUE,
  category_name VARCHAR(100) NOT NULL,
  default_visibility VARCHAR(20) DEFAULT 'private' CHECK (default_visibility IN ('private', 'friends')),
  reason TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default sensitive categories
INSERT INTO sensitive_categories (category_pattern, category_name, default_visibility, reason) VALUES
  ('adult_entertainment', 'Adult Entertainment', 'private', 'Adult content'),
  ('sex_shop', 'Adult Stores', 'private', 'Adult products'),
  ('strip_club', 'Strip Clubs', 'private', 'Adult entertainment'),
  ('liquor_store', 'Liquor Stores', 'private', 'Alcohol purchases'),
  ('cannabis_dispensary', 'Cannabis Dispensary', 'private', 'Cannabis purchases'),
  ('marijuana_dispensary', 'Marijuana Dispensary', 'private', 'Cannabis purchases'),
  ('casino', 'Casinos', 'private', 'Gambling venues'),
  ('gambling', 'Gambling', 'private', 'Gambling venues'),
  ('gun_store', 'Gun Stores', 'private', 'Firearms'),
  ('firearms', 'Firearms Store', 'private', 'Firearms'),
  ('psychiatric_hospital', 'Psychiatric Hospital', 'private', 'Healthcare privacy'),
  ('mental_health', 'Mental Health Services', 'private', 'Healthcare privacy'),
  ('fertility_clinic', 'Fertility Clinic', 'private', 'Healthcare privacy'),
  ('rehab_center', 'Rehab Center', 'private', 'Healthcare privacy'),
  ('addiction', 'Addiction Services', 'private', 'Healthcare privacy'),
  ('std_clinic', 'STD Clinic', 'private', 'Healthcare privacy'),
  ('abortion_clinic', 'Abortion Clinic', 'private', 'Healthcare privacy'),
  ('weight_loss_clinic', 'Weight Loss Clinic', 'private', 'Healthcare privacy'),
  ('plastic_surgery', 'Plastic Surgery', 'private', 'Healthcare privacy'),
  ('pawn_shop', 'Pawn Shop', 'private', 'Financial privacy'),
  ('payday_loan', 'Payday Loan', 'private', 'Financial privacy')
ON CONFLICT (category_pattern) DO NOTHING;

-- ============================================================
-- 4. Row Level Security (RLS) Policies
-- ============================================================

ALTER TABLE activity_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_ratings_aggregate ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensitive_categories ENABLE ROW LEVEL SECURITY;

-- Activity Likes: Users can manage their own likes
DROP POLICY IF EXISTS "activity_likes_own" ON activity_likes;
CREATE POLICY "activity_likes_own" ON activity_likes
  FOR ALL USING (auth.uid() = user_id);

-- Activity Likes: Users can see friends' public/friends-visible likes
DROP POLICY IF EXISTS "activity_likes_friends_read" ON activity_likes;
CREATE POLICY "activity_likes_friends_read" ON activity_likes
  FOR SELECT USING (
    visibility IN ('friends', 'public') AND
    is_sensitive_category = FALSE AND
    EXISTS (
      SELECT 1 FROM friendships
      WHERE friendships.user_id = auth.uid()
      AND friendships.friend_id = activity_likes.user_id
      AND friendships.status = 'accepted'
    )
  );

-- Activity Likes: Everyone can see public likes (non-sensitive only)
DROP POLICY IF EXISTS "activity_likes_public_read" ON activity_likes;
CREATE POLICY "activity_likes_public_read" ON activity_likes
  FOR SELECT USING (
    visibility = 'public' AND
    is_sensitive_category = FALSE
  );

-- Place Ratings: Everyone can read aggregates (no personal data)
DROP POLICY IF EXISTS "place_ratings_aggregate_read" ON place_ratings_aggregate;
CREATE POLICY "place_ratings_aggregate_read" ON place_ratings_aggregate
  FOR SELECT USING (true);

-- Sensitive Categories: Everyone can read (config data)
DROP POLICY IF EXISTS "sensitive_categories_read" ON sensitive_categories;
CREATE POLICY "sensitive_categories_read" ON sensitive_categories
  FOR SELECT USING (true);

-- ============================================================
-- 5. Helper Functions
-- ============================================================

-- Function to toggle like (returns new state + counts)
CREATE OR REPLACE FUNCTION toggle_activity_like(
  p_user_id UUID,
  p_place_id VARCHAR(255),
  p_place_name VARCHAR(255),
  p_place_category VARCHAR(100) DEFAULT NULL,
  p_place_lat DOUBLE PRECISION DEFAULT NULL,
  p_place_lng DOUBLE PRECISION DEFAULT NULL,
  p_place_address TEXT DEFAULT NULL,
  p_activity_id UUID DEFAULT NULL,
  p_recommendation_id UUID DEFAULT NULL,
  p_source VARCHAR(30) DEFAULT 'feed'
)
RETURNS TABLE (
  is_liked BOOLEAN,
  total_likes INTEGER,
  friends_who_liked_count INTEGER
) AS $$
DECLARE
  v_is_liked BOOLEAN;
  v_total_likes INTEGER;
  v_friends_count INTEGER;
  v_is_sensitive BOOLEAN := FALSE;
  v_visibility VARCHAR(20) := 'friends';
  v_location GEOGRAPHY(POINT, 4326) := NULL;
BEGIN
  -- Check if category is sensitive
  SELECT EXISTS (
    SELECT 1 FROM sensitive_categories sc
    WHERE sc.is_active = TRUE
    AND (
      lower(p_place_category) LIKE '%' || lower(sc.category_pattern) || '%'
      OR lower(p_place_name) LIKE '%' || lower(sc.category_pattern) || '%'
    )
  ) INTO v_is_sensitive;

  -- Set visibility based on sensitivity
  IF v_is_sensitive THEN
    v_visibility := 'private';
  END IF;

  -- Create location geography if coordinates provided
  IF p_place_lat IS NOT NULL AND p_place_lng IS NOT NULL THEN
    v_location := ST_SetSRID(ST_MakePoint(p_place_lng, p_place_lat), 4326)::GEOGRAPHY;
  END IF;

  -- Check if already liked
  IF EXISTS (
    SELECT 1 FROM activity_likes
    WHERE user_id = p_user_id AND place_id = p_place_id
  ) THEN
    -- Unlike: Delete the like
    DELETE FROM activity_likes
    WHERE user_id = p_user_id AND place_id = p_place_id;
    v_is_liked := FALSE;
  ELSE
    -- Like: Insert new like
    INSERT INTO activity_likes (
      user_id, place_id, place_name, place_category,
      place_location, place_address, activity_id, recommendation_id,
      visibility, is_sensitive_category, source
    ) VALUES (
      p_user_id, p_place_id, p_place_name, p_place_category,
      v_location, p_place_address, p_activity_id, p_recommendation_id,
      v_visibility, v_is_sensitive, p_source
    );
    v_is_liked := TRUE;
  END IF;

  -- Update aggregate counts
  PERFORM update_place_ratings_aggregate(p_place_id);

  -- Get total likes for this place
  SELECT COUNT(*) INTO v_total_likes
  FROM activity_likes WHERE place_id = p_place_id;

  -- Get count of friends who liked (non-sensitive, visible to current user)
  SELECT COUNT(*) INTO v_friends_count
  FROM activity_likes al
  JOIN friendships f ON f.friend_id = al.user_id
  WHERE al.place_id = p_place_id
    AND f.user_id = p_user_id
    AND f.status = 'accepted'
    AND al.visibility IN ('friends', 'public')
    AND al.is_sensitive_category = FALSE;

  RETURN QUERY SELECT v_is_liked, v_total_likes, v_friends_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get friends who liked a place
CREATE OR REPLACE FUNCTION get_friends_who_liked(
  p_user_id UUID,
  p_place_id VARCHAR(255),
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  user_id UUID,
  name VARCHAR(255),
  profile_picture_url TEXT,
  liked_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.name,
    u.profile_picture_url,
    al.liked_at
  FROM activity_likes al
  JOIN users u ON u.id = al.user_id
  JOIN friendships f ON f.friend_id = al.user_id
  WHERE al.place_id = p_place_id
    AND f.user_id = p_user_id
    AND f.status = 'accepted'
    AND al.visibility IN ('friends', 'public')
    AND al.is_sensitive_category = FALSE
  ORDER BY al.liked_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update aggregate ratings for a place
CREATE OR REPLACE FUNCTION update_place_ratings_aggregate(p_place_id VARCHAR(255))
RETURNS VOID AS $$
DECLARE
  v_total_likes INTEGER;
  v_likes_7d INTEGER;
  v_likes_30d INTEGER;
  v_thumbs_up INTEGER;
  v_thumbs_down INTEGER;
  v_community_score DECIMAL(3,2);
  v_is_trending BOOLEAN;
  v_place_name VARCHAR(255);
  v_place_category VARCHAR(100);
  v_is_sensitive BOOLEAN;
BEGIN
  -- Get latest place info from likes
  SELECT al.place_name, al.place_category, al.is_sensitive_category
  INTO v_place_name, v_place_category, v_is_sensitive
  FROM activity_likes al
  WHERE al.place_id = p_place_id
  ORDER BY al.liked_at DESC
  LIMIT 1;

  -- Count total likes
  SELECT COUNT(*) INTO v_total_likes
  FROM activity_likes WHERE place_id = p_place_id;

  -- Count likes in last 7 days
  SELECT COUNT(*) INTO v_likes_7d
  FROM activity_likes
  WHERE place_id = p_place_id
    AND liked_at >= NOW() - INTERVAL '7 days';

  -- Count likes in last 30 days
  SELECT COUNT(*) INTO v_likes_30d
  FROM activity_likes
  WHERE place_id = p_place_id
    AND liked_at >= NOW() - INTERVAL '30 days';

  -- Get feedback counts (if activity exists)
  SELECT
    COALESCE(SUM(CASE WHEN f.rating = 'thumbs_up' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN f.rating = 'thumbs_down' THEN 1 ELSE 0 END), 0)
  INTO v_thumbs_up, v_thumbs_down
  FROM feedback f
  JOIN activities a ON a.id = f.activity_id
  WHERE a.google_place_id = p_place_id;

  -- Calculate community score (0-5 scale)
  -- Formula: (likes * 5 + thumbs_up * 5) / (likes + thumbs_up + thumbs_down)
  -- With minimum threshold of 3 engagements
  IF (v_total_likes + v_thumbs_up + v_thumbs_down) >= 3 THEN
    v_community_score := LEAST(5.00, GREATEST(0.00,
      ((v_total_likes + v_thumbs_up) * 5.0) /
      NULLIF((v_total_likes + v_thumbs_up + v_thumbs_down), 0)
    ));
  ELSE
    v_community_score := NULL;
  END IF;

  -- Determine trending status (10+ likes in 7 days)
  v_is_trending := v_likes_7d >= 10;

  -- Upsert aggregate record
  INSERT INTO place_ratings_aggregate (
    place_id, place_name, place_category,
    total_likes, total_thumbs_up, total_thumbs_down,
    loop_community_score, likes_last_7_days, likes_last_30_days,
    is_trending, is_sensitive_category,
    first_liked_at, last_liked_at, last_updated_at
  ) VALUES (
    p_place_id, v_place_name, v_place_category,
    v_total_likes, v_thumbs_up, v_thumbs_down,
    v_community_score, v_likes_7d, v_likes_30d,
    v_is_trending, COALESCE(v_is_sensitive, FALSE),
    NOW(), NOW(), NOW()
  )
  ON CONFLICT (place_id) DO UPDATE SET
    place_name = COALESCE(EXCLUDED.place_name, place_ratings_aggregate.place_name),
    place_category = COALESCE(EXCLUDED.place_category, place_ratings_aggregate.place_category),
    total_likes = EXCLUDED.total_likes,
    total_thumbs_up = EXCLUDED.total_thumbs_up,
    total_thumbs_down = EXCLUDED.total_thumbs_down,
    loop_community_score = EXCLUDED.loop_community_score,
    likes_last_7_days = EXCLUDED.likes_last_7_days,
    likes_last_30_days = EXCLUDED.likes_last_30_days,
    is_trending = EXCLUDED.is_trending,
    is_sensitive_category = COALESCE(EXCLUDED.is_sensitive_category, place_ratings_aggregate.is_sensitive_category),
    last_liked_at = NOW(),
    last_updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a user liked a place
CREATE OR REPLACE FUNCTION check_if_liked(p_user_id UUID, p_place_id VARCHAR(255))
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM activity_likes
    WHERE user_id = p_user_id AND place_id = p_place_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all likers for a place (Instagram-style list)
CREATE OR REPLACE FUNCTION get_likers_list(
  p_user_id UUID,
  p_place_id VARCHAR(255),
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  user_id UUID,
  name VARCHAR(255),
  profile_picture_url TEXT,
  liked_at TIMESTAMPTZ,
  is_friend BOOLEAN,
  is_current_user BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.name,
    u.profile_picture_url,
    al.liked_at,
    (f.id IS NOT NULL) AS is_friend,
    (u.id = p_user_id) AS is_current_user
  FROM activity_likes al
  JOIN users u ON u.id = al.user_id
  LEFT JOIN friendships f ON (
    f.user_id = p_user_id
    AND f.friend_id = al.user_id
    AND f.status = 'accepted'
  )
  WHERE al.place_id = p_place_id
    AND (
      -- User can see their own likes
      al.user_id = p_user_id
      -- Or public likes (non-sensitive)
      OR (al.visibility = 'public' AND al.is_sensitive_category = FALSE)
      -- Or friends' likes that are visible
      OR (
        al.visibility IN ('friends', 'public')
        AND al.is_sensitive_category = FALSE
        AND f.id IS NOT NULL
      )
    )
  ORDER BY
    -- Current user first, then friends, then others
    (u.id = p_user_id) DESC,
    (f.id IS NOT NULL) DESC,
    al.liked_at DESC
  OFFSET p_offset
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. Triggers
-- ============================================================

-- Auto-update timestamp on activity_likes
CREATE OR REPLACE FUNCTION update_activity_likes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.liked_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: We don't add a trigger to update liked_at on UPDATE since likes are immutable
-- (they're either inserted or deleted, never updated)

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 028_unified_likes_system completed successfully';
  RAISE NOTICE 'Created: activity_likes table';
  RAISE NOTICE 'Created: place_ratings_aggregate table';
  RAISE NOTICE 'Created: sensitive_categories table (with seed data)';
  RAISE NOTICE 'Created: toggle_activity_like() function';
  RAISE NOTICE 'Created: get_friends_who_liked() function';
  RAISE NOTICE 'Created: update_place_ratings_aggregate() function';
  RAISE NOTICE 'Created: check_if_liked() function';
  RAISE NOTICE 'Created: get_likers_list() function';
  RAISE NOTICE 'Created: RLS policies for privacy-aware access';
END $$;
