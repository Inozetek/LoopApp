-- Migration 020: Add Multi-Source Support for Activities
-- Purpose: Add support for Eventbrite events and Yelp places without breaking existing Google Places data
-- Created: 2026-01-04
-- Phase 0.3 of multi-source integration

BEGIN;

-- Add source column (defaults to 'google_places' for all existing rows)
-- This ensures 100% backward compatibility - existing data automatically tagged as Google Places
ALTER TABLE activities
ADD COLUMN source VARCHAR(20) DEFAULT 'google_places' NOT NULL
CHECK (source IN ('google_places', 'eventbrite', 'yelp'));

-- Add event metadata column (JSONB for flexibility)
-- Only populated for Eventbrite events, NULL for places
-- Structure: {
--   "start_time": "2026-01-15T19:00:00Z",
--   "end_time": "2026-01-15T22:00:00Z",
--   "duration_minutes": 180,
--   "event_url": "https://eventbrite.com/...",
--   "organizer": "Event Organizer Name",
--   "is_online": false,
--   "is_free": false,
--   "ticket_price": {
--     "min": 2500,
--     "max": 5000,
--     "currency": "USD"
--   }
-- }
ALTER TABLE activities
ADD COLUMN event_metadata JSONB DEFAULT NULL;

-- Add Yelp metadata column (JSONB for flexibility)
-- Only populated for Yelp-sourced places, NULL for Google/Eventbrite
-- Structure: {
--   "yelp_id": "abc123",
--   "review_count": 1234,
--   "yelp_url": "https://yelp.com/biz/..."
-- }
ALTER TABLE activities
ADD COLUMN yelp_metadata JSONB DEFAULT NULL;

-- Create indexes for performance
-- Index on source for filtering by data source
CREATE INDEX idx_activities_source
  ON activities(source)
  WHERE is_active = TRUE;

-- Index on event start time for chronological queries
-- Using JSONB path extraction for event metadata start_time
CREATE INDEX idx_activities_event_time
  ON activities((event_metadata->>'start_time'))
  WHERE source = 'eventbrite' AND is_active = TRUE;

-- GIN index on event_metadata for faster JSONB queries
CREATE INDEX idx_activities_event_metadata_gin
  ON activities USING GIN(event_metadata)
  WHERE event_metadata IS NOT NULL;

-- GIN index on yelp_metadata for faster JSONB queries
CREATE INDEX idx_activities_yelp_metadata_gin
  ON activities USING GIN(yelp_metadata)
  WHERE yelp_metadata IS NOT NULL;

-- Add constraints to enforce data integrity
-- Rule 1: Eventbrite activities MUST have event_metadata
-- Rule 2: Non-Eventbrite activities MUST NOT have event_metadata
ALTER TABLE activities
ADD CONSTRAINT check_event_metadata
CHECK (
  (source = 'eventbrite' AND event_metadata IS NOT NULL) OR
  (source != 'eventbrite' AND event_metadata IS NULL)
);

-- Rule 3: Yelp activities MUST have yelp_metadata
-- Rule 4: Non-Yelp activities MUST NOT have yelp_metadata
ALTER TABLE activities
ADD CONSTRAINT check_yelp_metadata
CHECK (
  (source = 'yelp' AND yelp_metadata IS NOT NULL) OR
  (source != 'yelp' AND yelp_metadata IS NULL)
);

-- Rule 5: Eventbrite events should have valid ISO 8601 timestamps
-- Validates that event_metadata contains required fields
ALTER TABLE activities
ADD CONSTRAINT check_event_required_fields
CHECK (
  source != 'eventbrite' OR (
    event_metadata ? 'start_time' AND
    event_metadata ? 'end_time' AND
    event_metadata ? 'duration_minutes'
  )
);

-- Add comment to document migration
COMMENT ON COLUMN activities.source IS 'Data source: google_places (default), eventbrite (events), or yelp (enhanced ratings)';
COMMENT ON COLUMN activities.event_metadata IS 'Eventbrite event details (start/end time, tickets, organizer). Only populated when source = eventbrite';
COMMENT ON COLUMN activities.yelp_metadata IS 'Yelp-specific data (yelp_id, review_count, yelp_url). Only populated when source = yelp';

COMMIT;

-- Verification queries (run after migration):
-- SELECT source, COUNT(*) FROM activities GROUP BY source;
-- SELECT COUNT(*) FROM activities WHERE source = 'google_places'; -- Should match all existing rows
-- SELECT COUNT(*) FROM activities WHERE event_metadata IS NOT NULL; -- Should be 0 initially
-- SELECT COUNT(*) FROM activities WHERE yelp_metadata IS NOT NULL; -- Should be 0 initially
