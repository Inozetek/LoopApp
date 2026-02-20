-- Migration 036: Fix comments table FK to reference public.users
--
-- Problem: comments.user_id references auth.users(id) but PostgREST needs
-- a FK to public.users(id) to resolve the embedded join:
--   .select('*, users:user_id(name, profile_picture_url)')
--
-- This migration:
--   1. Creates the comments table if it doesn't exist yet
--   2. Drops the auth.users FK and adds a public.users FK
--   3. Re-applies RLS policies

-- Step 1: Create table if it doesn't exist (idempotent)
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  helpful_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'flagged', 'removed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Drop existing FK on user_id (if it exists)
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name
    AND kcu.table_schema = tc.table_schema
  WHERE tc.table_name = 'comments'
    AND tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'user_id';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.comments DROP CONSTRAINT %I', fk_name);
    RAISE NOTICE 'Dropped existing FK constraint: %', fk_name;
  END IF;
END $$;

-- Step 3: Add FK to public.users(id)
ALTER TABLE comments
  ADD CONSTRAINT comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Step 4: Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_comments_place ON comments(place_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status) WHERE status = 'active';

-- Step 5: RLS policies (idempotent)
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active comments" ON comments;
CREATE POLICY "Anyone can read active comments"
  ON comments FOR SELECT
  USING (status = 'active');

DROP POLICY IF EXISTS "Users can create comments" ON comments;
CREATE POLICY "Users can create comments"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own comments" ON comments;
CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);

-- Done
DO $$ BEGIN RAISE NOTICE 'Migration 036 complete: comments.user_id now references public.users(id)'; END $$;
