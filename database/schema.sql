-- Loop App Database Schema
-- Run this in Supabase SQL Editor to create all necessary tables
-- Last updated: October 21, 2025

-- Enable PostGIS extension for location queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  profile_picture_url TEXT,

  -- Location data (PostGIS)
  home_location GEOGRAPHY(POINT, 4326),
  home_address TEXT,
  work_location GEOGRAPHY(POINT, 4326),
  work_address TEXT,
  current_location GEOGRAPHY(POINT, 4326),

  -- Preferences (JSONB for flexibility)
  interests JSONB DEFAULT '[]'::jsonb,
  preferences JSONB DEFAULT '{
    "budget": 2,
    "max_distance_miles": 5,
    "preferred_times": ["evening"],
    "notification_enabled": true
  }'::jsonb,

  -- Gamification
  loop_score INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_home_location ON users USING GIST(home_location);
CREATE INDEX IF NOT EXISTS idx_users_work_location ON users USING GIST(work_location);

-- ============================================================================
-- CALENDAR EVENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) CHECK (category IN ('work', 'personal', 'social', 'dining', 'fitness', 'entertainment', 'travel', 'other')),

  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT NOT NULL,

  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT FALSE,

  source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('manual', 'recommendation', 'google_calendar', 'apple_calendar', 'group_plan')),
  activity_id UUID,

  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for calendar_events table
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_time ON calendar_events(user_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_location ON calendar_events USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(user_id, status);

-- ============================================================================
-- ACTIVITIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  google_place_id VARCHAR(255) UNIQUE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,

  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(50),

  phone VARCHAR(20),
  website TEXT,

  price_range INTEGER CHECK (price_range BETWEEN 0 AND 3),
  rating DECIMAL(2,1),
  reviews_count INTEGER DEFAULT 0,

  photos JSONB DEFAULT '[]'::jsonb,
  cover_photo_url TEXT,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for activities table
CREATE INDEX IF NOT EXISTS idx_activities_location ON activities USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category);
CREATE INDEX IF NOT EXISTS idx_activities_rating ON activities(rating DESC) WHERE is_active = TRUE;

-- ============================================================================
-- RECOMMENDATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,

  recommended_for TIMESTAMPTZ NOT NULL,
  reason TEXT,
  confidence_score DECIMAL(3,2) CHECK (confidence_score BETWEEN 0 AND 1),

  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'accepted', 'declined', 'expired')),
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- Indexes for recommendations table
CREATE INDEX IF NOT EXISTS idx_recommendations_user_status ON recommendations(user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_recommendations_activity ON recommendations(activity_id);

-- ============================================================================
-- FEEDBACK TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,

  rating VARCHAR(20) NOT NULL CHECK (rating IN ('thumbs_up', 'thumbs_down')),

  feedback_tags JSONB DEFAULT '[]'::jsonb,
  feedback_notes TEXT,

  completed_at TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for feedback table
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_activity ON feedback(activity_id, rating);

-- ============================================================================
-- FRIENDSHIPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked', 'declined')),

  can_view_loop BOOLEAN DEFAULT TRUE,
  can_invite_to_activities BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,

  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Indexes for friendships table
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id, status);

-- ============================================================================
-- GROUP PLANS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS group_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title VARCHAR(255),
  description TEXT,

  suggested_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,

  meeting_location GEOGRAPHY(POINT, 4326) NOT NULL,
  meeting_address TEXT NOT NULL,

  constraint_tags JSONB DEFAULT '[]'::jsonb,

  status VARCHAR(20) DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'completed', 'cancelled')),
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for group_plans table
CREATE INDEX IF NOT EXISTS idx_group_plans_creator ON group_plans(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_group_plans_time ON group_plans(suggested_time) WHERE status IN ('proposed', 'confirmed');

-- ============================================================================
-- PLAN PARTICIPANTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES group_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  rsvp_status VARCHAR(20) DEFAULT 'invited' CHECK (rsvp_status IN ('invited', 'accepted', 'declined', 'maybe', 'no_response')),
  responded_at TIMESTAMPTZ,

  invited_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(plan_id, user_id)
);

-- Indexes for plan_participants table
CREATE INDEX IF NOT EXISTS idx_plan_participants_plan ON plan_participants(plan_id, rsvp_status);
CREATE INDEX IF NOT EXISTS idx_plan_participants_user ON plan_participants(user_id, rsvp_status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_participants ENABLE ROW LEVEL SECURITY;

-- Users: Can only see and update their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Calendar Events: Can only see and manage their own events
CREATE POLICY "Users can view own calendar events" ON calendar_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar events" ON calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar events" ON calendar_events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar events" ON calendar_events
  FOR DELETE USING (auth.uid() = user_id);

-- Activities: Everyone can view
CREATE POLICY "Activities are viewable by everyone" ON activities
  FOR SELECT USING (true);

-- Recommendations: Users can only see their own
CREATE POLICY "Users can view own recommendations" ON recommendations
  FOR SELECT USING (auth.uid() = user_id);

-- Feedback: Users can only submit and view their own
CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Friendships: Users can view friendships they're part of
CREATE POLICY "Users can view own friendships" ON friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friendships" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friendships" ON friendships
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Group Plans: Participants can view
CREATE POLICY "Users can view group plans they're part of" ON group_plans
  FOR SELECT USING (
    auth.uid() = creator_id OR
    EXISTS (SELECT 1 FROM plan_participants WHERE plan_id = group_plans.id AND user_id = auth.uid())
  );

CREATE POLICY "Users can create group plans" ON group_plans
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Plan Participants: Can view if part of plan
CREATE POLICY "Users can view plan participants" ON plan_participants
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM group_plans WHERE id = plan_participants.plan_id AND creator_id = auth.uid())
  );

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_group_plans_updated_at BEFORE UPDATE ON group_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Loop database schema created successfully!';
  RAISE NOTICE 'Tables created: users, calendar_events, activities, recommendations, feedback, friendships, group_plans, plan_participants';
  RAISE NOTICE 'RLS policies enabled for security';
  RAISE NOTICE 'You can now use the Loop app!';
END $$;
