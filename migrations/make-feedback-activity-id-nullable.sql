-- Make activity_id nullable in feedback table to support feedback on manual calendar events
-- Manual calendar events don't have an associated activity in the activities table

ALTER TABLE feedback
ALTER COLUMN activity_id DROP NOT NULL;

-- Add a check constraint to ensure at least one ID is present
-- Either activity_id (for recommendations) or a valid feedback record
-- This ensures we can track feedback even for manual tasks
