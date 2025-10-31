-- Migration 004: Add Daily Dashboard and Friend Group Privacy Features
-- Created: 2025-10-30
-- Purpose: Extend privacy settings for granular friend group controls and add dashboard infrastructure

-- ============================================================================
-- EXTEND USERS TABLE PRIVACY SETTINGS
-- ============================================================================

-- Update existing users to have the new privacy settings structure
UPDATE users
SET privacy_settings = privacy_settings || jsonb_build_object(
  'friend_groups', jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'name', 'Close Friends',
      'member_ids', '[]'::jsonb,
      'visibility', 'full_access'
    ),
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'name', 'Family',
      'member_ids', '[]'::jsonb,
      'visibility', 'full_access'
    ),
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'name', 'Work',
      'member_ids', '[]'::jsonb,
      'visibility', 'busy_only'
    )
  ),
  'task_visibility_rules', jsonb_build_object(
    'hidden_categories', jsonb_build_array('personal'),
    'public_categories', jsonb_build_array('dining', 'entertainment', 'social', 'fitness', 'travel')
  ),
  'default_group_visibility', 'public_tasks_only'
)
WHERE NOT privacy_settings ? 'friend_groups';

-- ============================================================================
-- USER SESSIONS TABLE (for first-load tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  last_dashboard_view TIMESTAMPTZ,
  dashboard_views_count INTEGER DEFAULT 0,

  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  first_load_today BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_date ON user_sessions(user_id, session_date DESC);

-- ============================================================================
-- DASHBOARD NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dashboard_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
    'loops_planned',
    'friend_activity',
    'new_recommendations',
    'featured_venue',
    'featured_movie',
    'pending_invite',
    'family_in_town',
    'lunch_suggestion',
    'event_reminder',
    'other'
  )),

  priority VARCHAR(20) DEFAULT 'info' CHECK (priority IN ('info', 'attention', 'urgent')),

  title VARCHAR(255) NOT NULL,
  message TEXT,

  data JSONB DEFAULT '{}'::jsonb,

  action_button_text VARCHAR(100),
  action_deep_link TEXT,

  -- Related entities
  related_event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
  related_friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
  related_plan_id UUID,

  -- State tracking
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  is_actioned BOOLEAN DEFAULT FALSE,

  dismissed_at TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_notifications_user ON dashboard_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_notifications_unread ON dashboard_notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_dashboard_notifications_priority ON dashboard_notifications(user_id, priority) WHERE priority = 'urgent';
CREATE INDEX IF NOT EXISTS idx_dashboard_notifications_expiry ON dashboard_notifications(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- FRIEND ACTIVITY LOG (for "X friends embarking on loops" stats)
-- ============================================================================

CREATE TABLE IF NOT EXISTS friend_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
    'loop_started',
    'loop_completed',
    'event_added',
    'recommendation_accepted',
    'group_plan_created'
  )),

  related_event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,

  -- Activity metadata
  event_title VARCHAR(255),
  event_category VARCHAR(50),
  event_location GEOGRAPHY(POINT, 4326),
  event_address TEXT,
  event_time TIMESTAMPTZ,

  -- Privacy: who can see this activity
  visible_to_groups JSONB DEFAULT '[]'::jsonb,
  is_public BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_friend_activity_user ON friend_activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friend_activity_time ON friend_activity_log(created_at DESC) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_friend_activity_location ON friend_activity_log USING GIST(event_location) WHERE event_location IS NOT NULL;

-- ============================================================================
-- DASHBOARD STATS CACHE (for performance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS dashboard_stats_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  cache_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Cached stats
  loops_planned_count INTEGER DEFAULT 0,
  friends_active_count INTEGER DEFAULT 0,
  new_recommendations_count INTEGER DEFAULT 0,
  pending_invites_count INTEGER DEFAULT 0,

  -- JSON cache for detailed data
  loops_summary JSONB DEFAULT '{}'::jsonb,
  friends_activity JSONB DEFAULT '[]'::jsonb,
  featured_items JSONB DEFAULT '[]'::jsonb,

  -- Cache management
  is_stale BOOLEAN DEFAULT FALSE,
  last_refreshed_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, cache_date)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_cache_user_date ON dashboard_stats_cache(user_id, cache_date DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_stale ON dashboard_stats_cache(is_stale) WHERE is_stale = TRUE;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_stats_cache ENABLE ROW LEVEL SECURITY;

-- User Sessions: Users can only view/modify their own sessions
CREATE POLICY user_sessions_policy ON user_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Dashboard Notifications: Users can only view their own notifications
CREATE POLICY dashboard_notifications_policy ON dashboard_notifications
  FOR ALL USING (auth.uid() = user_id);

-- Friend Activity Log: Users can view their own + friends' public activity
CREATE POLICY friend_activity_own_policy ON friend_activity_log
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY friend_activity_friends_policy ON friend_activity_log
  FOR SELECT USING (
    is_public = TRUE AND
    EXISTS (
      SELECT 1 FROM friendships
      WHERE (friendships.user_id = auth.uid() AND friendships.friend_id = friend_activity_log.user_id)
        OR (friendships.friend_id = auth.uid() AND friendships.user_id = friend_activity_log.user_id)
      AND friendships.status = 'accepted'
    )
  );

-- Dashboard Stats Cache: Users can only view their own cache
CREATE POLICY dashboard_cache_policy ON dashboard_stats_cache
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user should see first-load dashboard today
CREATE OR REPLACE FUNCTION should_show_dashboard_today(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_last_view TIMESTAMPTZ;
  v_today DATE;
BEGIN
  v_today := CURRENT_DATE;

  SELECT last_dashboard_view INTO v_last_view
  FROM user_sessions
  WHERE user_id = p_user_id AND session_date = v_today;

  -- Show if no view today or if it's the first time today
  RETURN v_last_view IS NULL OR DATE(v_last_view) < v_today;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark dashboard as viewed
CREATE OR REPLACE FUNCTION mark_dashboard_viewed(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_sessions (user_id, session_date, last_dashboard_view, dashboard_views_count, first_load_today)
  VALUES (p_user_id, CURRENT_DATE, NOW(), 1, FALSE)
  ON CONFLICT (user_id, session_date)
  DO UPDATE SET
    last_dashboard_view = NOW(),
    dashboard_views_count = user_sessions.dashboard_views_count + 1,
    first_load_today = FALSE,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get friend groups for a user
CREATE OR REPLACE FUNCTION get_user_friend_groups(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_groups JSONB;
BEGIN
  SELECT privacy_settings->'friend_groups' INTO v_groups
  FROM users
  WHERE id = p_user_id;

  RETURN COALESCE(v_groups, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SEED DATA FOR DEMO USER
-- ============================================================================

-- Add demo dashboard notifications if demo user exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE email = 'demo@loop.app') THEN
    INSERT INTO dashboard_notifications (user_id, notification_type, priority, title, message, data)
    SELECT
      u.id,
      'friend_activity',
      'info',
      '3 friends are embarking on loops today',
      'Sarah is grabbing coffee at Blue Bottle, John is seeing a movie at AMC, Emma is dining at The Cheesecake Factory',
      jsonb_build_object(
        'friend_count', 3,
        'friends', jsonb_build_array(
          jsonb_build_object('name', 'Sarah', 'activity', 'Coffee'),
          jsonb_build_object('name', 'John', 'activity', 'Movies'),
          jsonb_build_object('name', 'Emma', 'activity', 'Dinner')
        )
      )
    FROM users u
    WHERE u.email = 'demo@loop.app'
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

COMMENT ON TABLE user_sessions IS 'Tracks user app sessions for first-load detection';
COMMENT ON TABLE dashboard_notifications IS 'Stores personalized dashboard notifications and action items';
COMMENT ON TABLE friend_activity_log IS 'Logs friend activities for dashboard "X friends on loops" stat';
COMMENT ON TABLE dashboard_stats_cache IS 'Performance cache for dashboard stats to reduce query load';
