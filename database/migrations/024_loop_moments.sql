/**
 * Migration: Loop Moments - User-generated content for places
 *
 * Creates tables for social content ecosystem where users capture and share
 * activity moments (Instagram/Snapchat-style stories).
 *
 * Features:
 * - Moments with 24h expiry (stories) or permanent (tagged to place)
 * - Friend-only or public visibility
 * - Like/view interactions
 * - Friend tagging
 * - Content moderation/reporting
 */

-- ============================================================
-- 1. Main moments table
-- ============================================================

CREATE TABLE IF NOT EXISTS moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Place reference (using Google Place ID pattern)
  place_id VARCHAR(255) NOT NULL,          -- Google Place ID
  place_name VARCHAR(255) NOT NULL,
  place_location GEOGRAPHY(POINT, 4326),
  place_address TEXT,

  -- Photo data
  photo_url TEXT NOT NULL,                 -- Supabase Storage URL
  thumbnail_url TEXT,                      -- Smaller version for avatars
  caption TEXT,

  -- Visibility & lifecycle
  visibility VARCHAR(20) DEFAULT 'friends' CHECK (visibility IN ('friends', 'everyone', 'private')),
  is_tagged_to_place BOOLEAN DEFAULT FALSE,  -- If true, becomes permanent place content
  expires_at TIMESTAMPTZ,                    -- NULL if tagged_to_place=true

  -- Engagement metrics (denormalized for performance)
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,

  -- Source tracking
  calendar_event_id UUID, -- References calendar_events(id) but optional
  capture_trigger VARCHAR(20) DEFAULT 'manual' CHECK (capture_trigger IN ('arrival', 'manual', 'post_activity')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- 2. Moment interactions (views, likes, saves)
-- ============================================================

CREATE TABLE IF NOT EXISTS moment_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id UUID NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('view', 'like', 'save', 'add_to_calendar')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(moment_id, user_id, interaction_type)
);

-- ============================================================
-- 3. Tagged friends in moments
-- ============================================================

CREATE TABLE IF NOT EXISTS moment_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id UUID NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  tagged_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(moment_id, tagged_user_id)
);

-- ============================================================
-- 4. Content moderation / reports
-- ============================================================

CREATE TABLE IF NOT EXISTS moment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id UUID NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  reporter_user_id UUID NOT NULL REFERENCES users(id),
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('inappropriate', 'spam', 'harassment', 'fake', 'other')),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. Indexes for performance
-- ============================================================

-- User's moments (for profile, ordered by newest)
CREATE INDEX IF NOT EXISTS idx_moments_user ON moments(user_id, created_at DESC) WHERE is_active = TRUE;

-- Place moments (for place details, only tagged permanent content)
CREATE INDEX IF NOT EXISTS idx_moments_place ON moments(place_id, created_at DESC) WHERE is_tagged_to_place = TRUE AND is_active = TRUE;

-- Expired moments cleanup job
CREATE INDEX IF NOT EXISTS idx_moments_expiry ON moments(expires_at) WHERE expires_at IS NOT NULL AND is_active = TRUE;

-- Location-based moment discovery (future feature)
CREATE INDEX IF NOT EXISTS idx_moments_location ON moments USING GIST(place_location);

-- Friends' stories feed (visibility + user + time)
CREATE INDEX IF NOT EXISTS idx_moments_friends ON moments(user_id, visibility, created_at DESC) WHERE is_active = TRUE;

-- Interaction lookups
CREATE INDEX IF NOT EXISTS idx_moment_interactions_moment ON moment_interactions(moment_id, interaction_type);
CREATE INDEX IF NOT EXISTS idx_moment_interactions_user ON moment_interactions(user_id, created_at DESC);

-- Reports moderation queue
CREATE INDEX IF NOT EXISTS idx_moment_reports_status ON moment_reports(status, created_at DESC) WHERE status = 'pending';

-- ============================================================
-- 6. Row Level Security (RLS) Policies
-- ============================================================

ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE moment_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE moment_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE moment_reports ENABLE ROW LEVEL SECURITY;

-- Moments policies
-- Users can manage their own moments (CRUD)
DROP POLICY IF EXISTS "moments_own" ON moments;
CREATE POLICY "moments_own" ON moments FOR ALL USING (auth.uid() = user_id);

-- Users can see friends' moments (friends-only visibility)
DROP POLICY IF EXISTS "moments_friends" ON moments;
CREATE POLICY "moments_friends" ON moments FOR SELECT USING (
  visibility = 'friends' AND
  is_active = TRUE AND
  EXISTS (
    SELECT 1 FROM friendships
    WHERE friendships.user_id = auth.uid()
    AND friendships.friend_id = moments.user_id
    AND friendships.status = 'accepted'
  )
);

-- Everyone can see public tagged moments
DROP POLICY IF EXISTS "moments_public" ON moments;
CREATE POLICY "moments_public" ON moments FOR SELECT USING (
  visibility = 'everyone' AND is_tagged_to_place = TRUE AND is_active = TRUE
);

-- Moment interactions policies
-- Users can view/create their own interactions
DROP POLICY IF EXISTS "moment_interactions_own" ON moment_interactions;
CREATE POLICY "moment_interactions_own" ON moment_interactions FOR ALL USING (auth.uid() = user_id);

-- Moment tags policies
-- Users can see tags on moments they can see
DROP POLICY IF EXISTS "moment_tags_read" ON moment_tags;
CREATE POLICY "moment_tags_read" ON moment_tags FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM moments
    WHERE moments.id = moment_tags.moment_id
    AND (
      moments.user_id = auth.uid()
      OR (moments.visibility = 'everyone' AND moments.is_active = TRUE)
      OR (moments.visibility = 'friends' AND moments.is_active = TRUE AND EXISTS (
        SELECT 1 FROM friendships
        WHERE friendships.user_id = auth.uid()
        AND friendships.friend_id = moments.user_id
        AND friendships.status = 'accepted'
      ))
    )
  )
);

-- Only moment owner can add tags
DROP POLICY IF EXISTS "moment_tags_owner" ON moment_tags;
CREATE POLICY "moment_tags_owner" ON moment_tags FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM moments WHERE moments.id = moment_tags.moment_id AND moments.user_id = auth.uid()
  )
);

-- Moment reports policies
-- Users can create reports
DROP POLICY IF EXISTS "moment_reports_create" ON moment_reports;
CREATE POLICY "moment_reports_create" ON moment_reports FOR INSERT WITH CHECK (auth.uid() = reporter_user_id);

-- Users can only see their own reports
DROP POLICY IF EXISTS "moment_reports_own" ON moment_reports;
CREATE POLICY "moment_reports_own" ON moment_reports FOR SELECT USING (auth.uid() = reporter_user_id);

-- ============================================================
-- 7. Helper Functions
-- ============================================================

-- Function to increment view count atomically
CREATE OR REPLACE FUNCTION increment_moment_views(p_moment_id UUID, p_viewer_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Try to insert view interaction (unique constraint prevents duplicates)
  INSERT INTO moment_interactions (moment_id, user_id, interaction_type)
  VALUES (p_moment_id, p_viewer_id, 'view')
  ON CONFLICT (moment_id, user_id, interaction_type) DO NOTHING;

  -- Only increment if insert succeeded (new view)
  IF FOUND THEN
    UPDATE moments SET views_count = views_count + 1 WHERE id = p_moment_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to toggle like (returns new like state)
CREATE OR REPLACE FUNCTION toggle_moment_like(p_moment_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_liked BOOLEAN;
BEGIN
  -- Check if already liked
  IF EXISTS (
    SELECT 1 FROM moment_interactions
    WHERE moment_id = p_moment_id AND user_id = p_user_id AND interaction_type = 'like'
  ) THEN
    -- Unlike
    DELETE FROM moment_interactions
    WHERE moment_id = p_moment_id AND user_id = p_user_id AND interaction_type = 'like';
    UPDATE moments SET likes_count = likes_count - 1 WHERE id = p_moment_id;
    v_liked := FALSE;
  ELSE
    -- Like
    INSERT INTO moment_interactions (moment_id, user_id, interaction_type)
    VALUES (p_moment_id, p_user_id, 'like');
    UPDATE moments SET likes_count = likes_count + 1 WHERE id = p_moment_id;
    v_liked := TRUE;
  END IF;

  RETURN v_liked;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired moments (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_moments()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Soft delete expired moments (set is_active = false)
  UPDATE moments
  SET is_active = FALSE, updated_at = NOW()
  WHERE expires_at < NOW()
    AND is_active = TRUE
    AND expires_at IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. Triggers
-- ============================================================

-- Auto-set expires_at on insert (24h by default, null if tagged to place)
CREATE OR REPLACE FUNCTION set_moment_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_tagged_to_place = TRUE THEN
    NEW.expires_at := NULL;  -- Permanent
  ELSIF NEW.expires_at IS NULL THEN
    NEW.expires_at := NOW() + INTERVAL '24 hours';  -- Default 24h
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS moment_set_expiry ON moments;
CREATE TRIGGER moment_set_expiry
BEFORE INSERT ON moments
FOR EACH ROW EXECUTE FUNCTION set_moment_expiry();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_moment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS moment_update_timestamp ON moments;
CREATE TRIGGER moment_update_timestamp
BEFORE UPDATE ON moments
FOR EACH ROW EXECUTE FUNCTION update_moment_timestamp();

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 024_loop_moments completed successfully';
  RAISE NOTICE 'Created: moments table';
  RAISE NOTICE 'Created: moment_interactions table';
  RAISE NOTICE 'Created: moment_tags table';
  RAISE NOTICE 'Created: moment_reports table';
  RAISE NOTICE 'Created: increment_moment_views() function';
  RAISE NOTICE 'Created: toggle_moment_like() function';
  RAISE NOTICE 'Created: cleanup_expired_moments() function';
  RAISE NOTICE 'Created: RLS policies for all tables';
END $$;
