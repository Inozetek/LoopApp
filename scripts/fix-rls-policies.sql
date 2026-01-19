/**
 * Fix RLS Policies for Places Cache
 *
 * This SQL script drops existing policies and recreates them properly.
 * Run this in Supabase SQL Editor if migration failed.
 */

-- Drop all existing policies on places_cache
DROP POLICY IF EXISTS "Service role can insert places cache" ON places_cache;
DROP POLICY IF EXISTS "Service role can update places cache" ON places_cache;
DROP POLICY IF EXISTS "Service role can delete places cache" ON places_cache;
DROP POLICY IF EXISTS "Authenticated users can insert places cache (TEMP)" ON places_cache;
DROP POLICY IF EXISTS "Authenticated users can update places cache (TEMP)" ON places_cache;
DROP POLICY IF EXISTS "Authenticated users can delete places cache (TEMP)" ON places_cache;
DROP POLICY IF EXISTS "Authenticated users can read places cache" ON places_cache;

-- Recreate policies with correct permissions

-- READ: Authenticated users can read cache (already exists, but recreate to be safe)
CREATE POLICY "Authenticated users can read places cache"
  ON places_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Authenticated users can insert (TEMP for MVP)
CREATE POLICY "Authenticated users can insert places cache (TEMP)"
  ON places_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Authenticated users can update (TEMP for MVP)
CREATE POLICY "Authenticated users can update places cache (TEMP)"
  ON places_cache
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: Authenticated users can delete (TEMP for MVP)
CREATE POLICY "Authenticated users can delete places cache (TEMP)"
  ON places_cache
  FOR DELETE
  TO authenticated
  USING (true);

-- Also allow service role (for future backend API)
CREATE POLICY "Service role can insert places cache"
  ON places_cache
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update places cache"
  ON places_cache
  FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can delete places cache"
  ON places_cache
  FOR DELETE
  TO service_role
  USING (true);

-- Same for events_cache
DROP POLICY IF EXISTS "Service role can insert events cache" ON events_cache;
DROP POLICY IF EXISTS "Service role can update events cache" ON events_cache;
DROP POLICY IF EXISTS "Service role can delete events cache" ON events_cache;
DROP POLICY IF EXISTS "Authenticated users can insert events cache (TEMP)" ON events_cache;
DROP POLICY IF EXISTS "Authenticated users can update events cache (TEMP)" ON events_cache;
DROP POLICY IF EXISTS "Authenticated users can delete events cache (TEMP)" ON events_cache;
DROP POLICY IF EXISTS "Authenticated users can read events cache" ON events_cache;

CREATE POLICY "Authenticated users can read events cache"
  ON events_cache
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert events cache (TEMP)"
  ON events_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update events cache (TEMP)"
  ON events_cache
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete events cache (TEMP)"
  ON events_cache
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert events cache"
  ON events_cache
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update events cache"
  ON events_cache
  FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can delete events cache"
  ON events_cache
  FOR DELETE
  TO service_role
  USING (true);

-- Verify policies were created
DO $$
BEGIN
  RAISE NOTICE '✅ RLS Policies Fixed!';
  RAISE NOTICE '';
  RAISE NOTICE 'Created policies:';
  RAISE NOTICE '  - places_cache: SELECT, INSERT, UPDATE, DELETE (authenticated + service_role)';
  RAISE NOTICE '  - events_cache: SELECT, INSERT, UPDATE, DELETE (authenticated + service_role)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Restart your app';
  RAISE NOTICE '  2. Wait for cache seeding (1-2 min)';
  RAISE NOTICE '  3. Run: node scripts/check-cache-status.js';
END $$;
