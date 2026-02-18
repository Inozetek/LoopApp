-- Migration 035: Add photo_url column to recommendation_tracking
-- Used by getRecommendationHistory() to display activity photos in the history tab

ALTER TABLE recommendation_tracking
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Backfill from recommendation_data JSONB where available
UPDATE recommendation_tracking
SET photo_url = recommendation_data->>'photoUrl'
WHERE photo_url IS NULL
  AND recommendation_data->>'photoUrl' IS NOT NULL;
