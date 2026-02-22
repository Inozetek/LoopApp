-- Migration 037: Add visibility column and event_id to feedback table
--
-- visibility: future privacy controls (default public for community scores)
-- event_id: links feedback to the calendar event, enabling proper dedup
--           for manually created events that lack activity_id

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS
  visibility VARCHAR(20) DEFAULT 'public'
  CHECK (visibility IN ('private', 'friends', 'public'));

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS
  event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_event
  ON feedback(user_id, event_id) WHERE event_id IS NOT NULL;

COMMENT ON COLUMN feedback.visibility IS 'Controls who can see this feedback: private (only user), friends, or public (community scores)';
COMMENT ON COLUMN feedback.event_id IS 'Calendar event this feedback is for (enables dedup for events without activity_id)';
