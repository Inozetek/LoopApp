-- Migration 020 Rollback: Remove Multi-Source Support
-- Purpose: Safely revert activities table to Google Places-only state
-- Created: 2026-01-04
-- Use this if multi-source integration needs to be completely removed

BEGIN;

-- Drop constraints first (foreign keys must be dropped before columns)
ALTER TABLE activities DROP CONSTRAINT IF EXISTS check_event_required_fields;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS check_yelp_metadata;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS check_event_metadata;

-- Drop indexes
DROP INDEX IF EXISTS idx_activities_yelp_metadata_gin;
DROP INDEX IF EXISTS idx_activities_event_metadata_gin;
DROP INDEX IF EXISTS idx_activities_event_time;
DROP INDEX IF EXISTS idx_activities_source;

-- Drop columns (this removes all Eventbrite and Yelp data)
-- WARNING: This is destructive - all event and Yelp data will be lost
-- Ensure you have backups before running this rollback
ALTER TABLE activities DROP COLUMN IF EXISTS yelp_metadata;
ALTER TABLE activities DROP COLUMN IF EXISTS event_metadata;
ALTER TABLE activities DROP COLUMN IF EXISTS source;

COMMIT;

-- Verification queries (run after rollback):
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'activities' AND column_name IN ('source', 'event_metadata', 'yelp_metadata');
-- Result should be empty (0 rows) if rollback successful
