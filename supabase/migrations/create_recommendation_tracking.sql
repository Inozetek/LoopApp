-- Create recommendation_tracking table for Phase 1
-- This table tracks generated recommendations and their status
-- Simpler than full schema - works with current Google Places API flow

CREATE TABLE IF NOT EXISTS recommendation_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Full recommendation data (stored as JSONB for flexibility)
  recommendation_data JSONB NOT NULL,

  -- Key fields for queries
  google_place_id TEXT NOT NULL,
  place_name TEXT NOT NULL,
  category TEXT NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'accepted', 'declined', 'not_interested', 'expired')),
  confidence_score DECIMAL(3,2) CHECK (confidence_score BETWEEN 0 AND 1),

  -- Timestamps
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  decline_reason TEXT,

  -- Resurfacing tracking (for Phase 3)
  resurfaced_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  CONSTRAINT recommendation_tracking_user_place_created UNIQUE (user_id, google_place_id, created_at)
);

-- Indexes for performance
CREATE INDEX idx_recommendation_tracking_user_status ON recommendation_tracking(user_id, status);
CREATE INDEX idx_recommendation_tracking_user_created ON recommendation_tracking(user_id, created_at DESC);
CREATE INDEX idx_recommendation_tracking_expires ON recommendation_tracking(expires_at) WHERE status = 'pending';
CREATE INDEX idx_recommendation_tracking_place ON recommendation_tracking(google_place_id);

-- Enable Row Level Security
ALTER TABLE recommendation_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own recommendations
CREATE POLICY "Users can view their own recommendations"
ON recommendation_tracking
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recommendations"
ON recommendation_tracking
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recommendations"
ON recommendation_tracking
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recommendations"
ON recommendation_tracking
FOR DELETE
USING (auth.uid() = user_id);

-- Add google_place_id column to calendar_events for feedback linkage
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS google_place_id TEXT;

-- Add feedback_submitted column for Phase 5
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS feedback_submitted BOOLEAN DEFAULT FALSE;

-- Index for feedback queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_google_place ON calendar_events(google_place_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_feedback ON calendar_events(user_id, feedback_submitted, status);

-- Comments for documentation
COMMENT ON TABLE recommendation_tracking IS 'Tracks generated recommendations and user interactions for learning';
COMMENT ON COLUMN recommendation_tracking.recommendation_data IS 'Full recommendation object from Google Places API';
COMMENT ON COLUMN recommendation_tracking.status IS 'pending: shown but no action, viewed: user saw details, accepted: added to calendar, declined: cleared, not_interested: explicitly rejected';
COMMENT ON COLUMN recommendation_tracking.resurfaced_count IS 'How many times this recommendation has been reshown after being declined';
