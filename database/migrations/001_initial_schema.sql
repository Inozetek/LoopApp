-- Loop App - Initial Database Schema Migration
-- This migration creates all core tables with PostGIS support for geospatial queries
-- Run this SQL in your Supabase SQL Editor

-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  profile_picture_url TEXT,

  -- Location data (PostGIS for efficient geospatial queries)
  home_location GEOGRAPHY(POINT, 4326),
  home_address TEXT,
  work_location GEOGRAPHY(POINT, 4326),
  work_address TEXT,
  current_location GEOGRAPHY(POINT, 4326),
  commute_route GEOGRAPHY(LINESTRING, 4326),

  -- Preferences (JSONB for flexibility)
  interests JSONB DEFAULT '[]'::jsonb,
  preferences JSONB DEFAULT '{
    "budget": 2,
    "max_distance_miles": 5,
    "preferred_times": ["evening"],
    "notification_enabled": true
  }'::jsonb,

  -- AI learning profile (updated by feedback loop)
  ai_profile JSONB DEFAULT '{
    "preferred_distance_miles": 5.0,
    "budget_level": 2,
    "favorite_categories": [],
    "disliked_categories": [],
    "price_sensitivity": "medium",
    "time_preferences": [],
    "distance_tolerance": "medium"
  }'::jsonb,

  -- Subscription status
  subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'plus', 'premium')),
  subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'trialing')),
  stripe_customer_id VARCHAR(255),
  subscription_end_date TIMESTAMPTZ,

  -- Gamification
  loop_score INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_active_date DATE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,

  -- Privacy settings
  privacy_settings JSONB DEFAULT '{
    "share_loop_with": "friends",
    "discoverable": true,
    "share_location": true,
    "group_invite_settings": {
      "who_can_invite": "friends",
      "require_mutual_friends": false,
      "blocked_from_invites": [],
      "auto_decline_from_strangers": true,
      "notification_preferences": {
        "group_invites": true,
        "new_friend_in_group": true
      }
    }
  }'::jsonb
);

-- Create indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription ON users(subscription_tier, subscription_status);
CREATE INDEX idx_users_home_location ON users USING GIST(home_location);
CREATE INDEX idx_users_work_location ON users USING GIST(work_location);
CREATE INDEX idx_users_current_location ON users USING GIST(current_location);

-- Calendar events (tasks in user's schedule)
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Task details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) CHECK (category IN ('work', 'personal', 'social', 'dining', 'fitness', 'entertainment', 'travel', 'other')),

  -- Location (REQUIRED for Loop visualization)
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT NOT NULL,

  -- Timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT FALSE,

  -- Source tracking
  source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('manual', 'recommendation', 'google_calendar', 'apple_calendar', 'group_plan')),
  activity_id UUID, -- Will reference activities(id) after activities table is created
  external_calendar_id VARCHAR(255),
  external_event_id VARCHAR(255),

  -- Status
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  completed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for calendar_events
CREATE INDEX idx_calendar_events_user_time ON calendar_events(user_id, start_time, end_time);
CREATE INDEX idx_calendar_events_location ON calendar_events USING GIST(location);
CREATE INDEX idx_calendar_events_status ON calendar_events(user_id, status);
CREATE INDEX idx_calendar_events_source ON calendar_events(source);

-- Businesses (venues that can sponsor activities)
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Business account info
  owner_email VARCHAR(255) UNIQUE NOT NULL,
  owner_name VARCHAR(255),
  business_name VARCHAR(255) NOT NULL,

  -- Business details
  category VARCHAR(100) NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  phone VARCHAR(20),
  website TEXT,
  description TEXT,
  logo_url TEXT,

  -- Hours
  hours JSONB DEFAULT '{}'::jsonb,

  -- Subscription
  subscription_tier VARCHAR(20) DEFAULT 'organic' CHECK (subscription_tier IN ('organic', 'boosted', 'premium')),
  subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'trialing', 'inactive')),
  trial_ends_at TIMESTAMPTZ,
  subscription_started_at TIMESTAMPTZ,

  -- Stripe integration
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  onboarded_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ
);

-- Create indexes for businesses
CREATE INDEX idx_businesses_email ON businesses(owner_email);
CREATE INDEX idx_businesses_subscription ON businesses(subscription_tier, subscription_status);
CREATE INDEX idx_businesses_location ON businesses USING GIST(location);

-- Activities (from Google Places + business listings)
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,

  -- Google Places data
  google_place_id VARCHAR(255) UNIQUE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  description TEXT,

  -- Location
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),

  -- Contact info
  phone VARCHAR(20),
  website TEXT,

  -- Business details
  price_range INTEGER CHECK (price_range BETWEEN 0 AND 3), -- 0=Free, 1=$, 2=$$, 3=$$$
  rating DECIMAL(2,1), -- Google rating 0.0-5.0
  reviews_count INTEGER DEFAULT 0,

  -- Hours (JSONB for flexibility)
  hours JSONB DEFAULT '{}'::jsonb,

  -- Media
  photos JSONB DEFAULT '[]'::jsonb,
  cover_photo_url TEXT,

  -- Tags for filtering
  tags JSONB DEFAULT '[]'::jsonb,

  -- Sponsorship
  sponsored_tier VARCHAR(20) DEFAULT 'organic' CHECK (sponsored_tier IN ('organic', 'boosted', 'premium')),
  sponsor_active BOOLEAN DEFAULT TRUE,
  sponsor_start_date TIMESTAMPTZ,
  sponsor_end_date TIMESTAMPTZ,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ
);

-- Create indexes for activities
CREATE INDEX idx_activities_location ON activities USING GIST(location);
CREATE INDEX idx_activities_category ON activities(category, subcategory);
CREATE INDEX idx_activities_sponsored ON activities(sponsored_tier, sponsor_active) WHERE sponsor_active = TRUE;
CREATE INDEX idx_activities_rating ON activities(rating DESC) WHERE is_active = TRUE;
CREATE INDEX idx_activities_google_place ON activities(google_place_id);

-- Now add the foreign key constraint for calendar_events.activity_id
ALTER TABLE calendar_events ADD CONSTRAINT fk_calendar_events_activity
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL;

-- Recommendations (generated by AI, tracked for analytics)
CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,

  -- Recommendation context
  recommended_for TIMESTAMPTZ NOT NULL,
  reason TEXT,
  confidence_score DECIMAL(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
  algorithm_version VARCHAR(20),

  -- Scoring breakdown (for debugging/analytics)
  score_breakdown JSONB,

  -- Business relationship
  is_sponsored BOOLEAN DEFAULT FALSE,
  business_id UUID REFERENCES businesses(id),

  -- User interaction
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'accepted', 'declined', 'expired')),
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- Create indexes for recommendations
CREATE INDEX idx_recommendations_user_status ON recommendations(user_id, status, created_at);
CREATE INDEX idx_recommendations_activity ON recommendations(activity_id, is_sponsored);
CREATE INDEX idx_recommendations_business ON recommendations(business_id, created_at) WHERE is_sponsored = TRUE;
CREATE INDEX idx_recommendations_expiry ON recommendations(expires_at) WHERE status = 'pending';

-- Feedback (user ratings after completing activities)
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,

  -- Rating
  rating VARCHAR(20) NOT NULL CHECK (rating IN ('thumbs_up', 'thumbs_down')),

  -- Detailed feedback
  feedback_tags JSONB DEFAULT '[]'::jsonb,
  feedback_notes TEXT,

  -- Context
  completed_at TIMESTAMPTZ NOT NULL,
  weather_at_time VARCHAR(50),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for feedback
CREATE INDEX idx_feedback_user ON feedback(user_id, created_at);
CREATE INDEX idx_feedback_activity ON feedback(activity_id, rating);
CREATE INDEX idx_feedback_recommendation ON feedback(recommendation_id);

-- Friendships (social graph)
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked', 'declined')),

  -- Friendship metadata
  friend_group VARCHAR(100),

  -- Permissions
  can_view_loop BOOLEAN DEFAULT TRUE,
  can_invite_to_activities BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,

  -- Prevent duplicate friendships
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Create indexes for friendships
CREATE INDEX idx_friendships_user ON friendships(user_id, status);
CREATE INDEX idx_friendships_friend ON friendships(friend_id, status);
CREATE INDEX idx_friendships_status ON friendships(status) WHERE status = 'accepted';

-- Group plans (coordinated activities with multiple users)
CREATE TABLE group_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Plan details
  title VARCHAR(255),
  description TEXT,

  -- Timing
  suggested_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,

  -- Location (calculated optimal midpoint)
  meeting_location GEOGRAPHY(POINT, 4326) NOT NULL,
  meeting_address TEXT NOT NULL,

  -- Logistics
  total_travel_time_minutes INTEGER,
  farthest_traveler_user_id UUID REFERENCES users(id),

  -- Custom constraints (from user-prompted planning)
  constraint_tags JSONB DEFAULT '[]'::jsonb,

  -- Status
  status VARCHAR(20) DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'completed', 'cancelled')),
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for group_plans
CREATE INDEX idx_group_plans_creator ON group_plans(creator_id, status);
CREATE INDEX idx_group_plans_time ON group_plans(suggested_time) WHERE status IN ('proposed', 'confirmed');
CREATE INDEX idx_group_plans_location ON group_plans USING GIST(meeting_location);

-- Group plan participants (many-to-many relationship)
CREATE TABLE plan_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES group_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- RSVP status
  rsvp_status VARCHAR(20) DEFAULT 'invited' CHECK (rsvp_status IN ('invited', 'accepted', 'declined', 'maybe', 'no_response')),
  responded_at TIMESTAMPTZ,

  -- Participant logistics
  travel_distance_miles DECIMAL(5,2),
  travel_time_minutes INTEGER,

  -- Metadata
  invited_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate participants
  UNIQUE(plan_id, user_id)
);

-- Create indexes for plan_participants
CREATE INDEX idx_plan_participants_plan ON plan_participants(plan_id, rsvp_status);
CREATE INDEX idx_plan_participants_user ON plan_participants(user_id, rsvp_status);

-- Messages (group chat for coordinating plans)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES group_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Message content
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'location', 'activity_suggestion')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Create indexes for messages
CREATE INDEX idx_messages_plan ON messages(plan_id, created_at DESC);
CREATE INDEX idx_messages_user ON messages(user_id, created_at DESC);

-- Business analytics (for premium tier businesses)
CREATE TABLE business_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Date bucket
  date DATE NOT NULL,

  -- Metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  calendar_adds INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,

  -- Revenue tracking
  estimated_customers INTEGER DEFAULT 0,
  revenue_attributed DECIMAL(10,2),

  -- Demographics (aggregated, anonymized)
  demographics JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One row per business per day
  UNIQUE(business_id, date)
);

-- Create indexes for business_analytics
CREATE INDEX idx_business_analytics_date ON business_analytics(business_id, date DESC);

-- Payments (transaction log for accounting)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Stripe details
  stripe_payment_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_invoice_id VARCHAR(255),

  -- Payment info
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  description TEXT,

  -- Status
  status VARCHAR(20) NOT NULL CHECK (status IN ('succeeded', 'failed', 'pending', 'refunded')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- Create indexes for payments
CREATE INDEX idx_payments_business ON payments(business_id, created_at DESC);
CREATE INDEX idx_payments_status ON payments(status) WHERE status != 'succeeded';
CREATE INDEX idx_payments_stripe ON payments(stripe_payment_id);

-- Notifications (push notification log)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Notification details
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
    'recommendation', 'departure_alert', 'friend_request', 'group_invite',
    'loop_score_milestone', 'feedback_reminder', 'location_trigger', 'other'
  )),

  -- Links/Actions
  deep_link TEXT,
  action_button_text VARCHAR(50),

  -- Related entities
  recommendation_id UUID REFERENCES recommendations(id),
  plan_id UUID REFERENCES group_plans(id),

  -- Delivery status
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for notifications
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(notification_type, sent_at);

-- App analytics (aggregate metrics for monitoring)
CREATE TABLE app_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,

  -- User metrics
  daily_active_users INTEGER DEFAULT 0,
  weekly_active_users INTEGER DEFAULT 0,
  monthly_active_users INTEGER DEFAULT 0,
  new_signups INTEGER DEFAULT 0,
  churned_users INTEGER DEFAULT 0,

  -- Engagement metrics
  recommendations_generated INTEGER DEFAULT 0,
  recommendations_accepted INTEGER DEFAULT 0,
  acceptance_rate DECIMAL(5,2),
  activities_completed INTEGER DEFAULT 0,
  thumbs_up_count INTEGER DEFAULT 0,
  thumbs_down_count INTEGER DEFAULT 0,
  satisfaction_rate DECIMAL(5,2),

  -- Monetization metrics
  revenue_users_cents INTEGER DEFAULT 0,
  revenue_businesses_cents INTEGER DEFAULT 0,
  revenue_affiliates_cents INTEGER DEFAULT 0,
  total_revenue_cents INTEGER DEFAULT 0,

  -- Business metrics
  active_businesses INTEGER DEFAULT 0,
  boosted_businesses INTEGER DEFAULT 0,
  premium_businesses INTEGER DEFAULT 0,

  -- API costs
  google_places_api_cost_cents INTEGER DEFAULT 0,
  openai_api_cost_cents INTEGER DEFAULT 0,
  maps_api_cost_cents INTEGER DEFAULT 0,
  total_api_cost_cents INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for app_analytics
CREATE INDEX idx_app_analytics_date ON app_analytics(date DESC);

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at on tables that have this column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_group_plans_updated_at BEFORE UPDATE ON group_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic policies, can be refined later)

-- Users: Users can only see their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Calendar events: Users can only see/edit their own events
CREATE POLICY "Users can view own calendar events" ON calendar_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar events" ON calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar events" ON calendar_events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar events" ON calendar_events
  FOR DELETE USING (auth.uid() = user_id);

-- Activities: Everyone can view active activities
CREATE POLICY "Anyone can view active activities" ON activities
  FOR SELECT USING (is_active = TRUE);

-- Recommendations: Users can only see their own recommendations
CREATE POLICY "Users can view own recommendations" ON recommendations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own recommendations" ON recommendations
  FOR UPDATE USING (auth.uid() = user_id);

-- Feedback: Users can only see/create their own feedback
CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Friendships: Users can see friendships where they're involved
CREATE POLICY "Users can view own friendships" ON friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friendship requests" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friendship status" ON friendships
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Group plans: Users can see plans where they're participants or creator
CREATE POLICY "Users can view group plans they're part of" ON group_plans
  FOR SELECT USING (
    auth.uid() = creator_id OR
    EXISTS (
      SELECT 1 FROM plan_participants
      WHERE plan_id = group_plans.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create group plans" ON group_plans
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Plan participants: Users can view participants of plans they're in
CREATE POLICY "Users can view plan participants" ON plan_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_plans
      WHERE id = plan_participants.plan_id AND
      (creator_id = auth.uid() OR EXISTS (
        SELECT 1 FROM plan_participants pp
        WHERE pp.plan_id = group_plans.id AND pp.user_id = auth.uid()
      ))
    )
  );

-- Messages: Users can view/send messages in plans they're part of
CREATE POLICY "Users can view messages in their plans" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_plans
      WHERE id = messages.plan_id AND
      (creator_id = auth.uid() OR EXISTS (
        SELECT 1 FROM plan_participants
        WHERE plan_id = group_plans.id AND user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can send messages in their plans" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM group_plans
      WHERE id = plan_id AND
      (creator_id = auth.uid() OR EXISTS (
        SELECT 1 FROM plan_participants
        WHERE plan_id = group_plans.id AND user_id = auth.uid()
      ))
    )
  );

-- Businesses: Business owners can only see/edit their own business
CREATE POLICY "Business owners can view own business" ON businesses
  FOR SELECT USING (owner_email = auth.email());

CREATE POLICY "Business owners can update own business" ON businesses
  FOR UPDATE USING (owner_email = auth.email());

-- Business analytics: Business owners can only see their own analytics
CREATE POLICY "Business owners can view own analytics" ON business_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = business_analytics.business_id AND owner_email = auth.email()
    )
  );

-- Notifications: Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Migration complete message
DO $$
BEGIN
  RAISE NOTICE 'Loop App database schema created successfully!';
  RAISE NOTICE 'PostGIS extension enabled for geospatial queries.';
  RAISE NOTICE 'All tables created with proper indexes and RLS policies.';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Set up Supabase Auth (email + Google OAuth)';
  RAISE NOTICE '2. Create seed data for testing';
  RAISE NOTICE '3. Test database queries';
END $$;
