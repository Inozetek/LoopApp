-- Migration 033: Comments table for Loop community reviews
-- Loop-native comments system (Google reviews are fetched on-demand, never cached)

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id VARCHAR(255) NOT NULL,
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  helpful_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'flagged', 'removed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_place ON comments(place_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status) WHERE status = 'active';

-- RLS policies
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read active comments
CREATE POLICY "Anyone can read active comments"
  ON comments FOR SELECT
  USING (status = 'active');

-- Authenticated users can insert their own comments
CREATE POLICY "Users can create comments"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);
