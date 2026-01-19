/**
 * TEMPORARY FIX: Allow authenticated users to write to places_cache
 *
 * This is a temporary workaround to allow client-side cache seeding during MVP testing.
 *
 * SECURITY WARNING: In production, cache seeding should be done server-side only.
 * This migration should be REVERTED once we implement a proper backend API.
 *
 * Proper architecture:
 * - Client: Read from cache (SELECT)
 * - Backend API: Write to cache (INSERT/UPDATE/DELETE)
 */

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Service role can insert places cache" ON places_cache;
DROP POLICY IF EXISTS "Service role can update places cache" ON places_cache;
DROP POLICY IF EXISTS "Service role can delete places cache" ON places_cache;

-- TEMPORARY: Allow authenticated users to INSERT
CREATE POLICY "Authenticated users can insert places cache (TEMP)"
  ON places_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- TEMPORARY: Allow authenticated users to UPDATE
CREATE POLICY "Authenticated users can update places cache (TEMP)"
  ON places_cache
  FOR UPDATE
  TO authenticated
  USING (true);

-- TEMPORARY: Allow authenticated users to DELETE (for cleanup)
CREATE POLICY "Authenticated users can delete places cache (TEMP)"
  ON places_cache
  FOR DELETE
  TO authenticated
  USING (true);

-- Keep service role policies for backward compatibility
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

-- Success message
DO $$
BEGIN
  RAISE NOTICE '⚠️  TEMPORARY RLS FIX APPLIED';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  - Authenticated users can now INSERT/UPDATE/DELETE places_cache';
  RAISE NOTICE '  - Authenticated users can now INSERT/UPDATE/DELETE events_cache';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  WARNING: This is a temporary fix for MVP testing';
  RAISE NOTICE '   In production, revert this and use backend API for cache operations';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Test cache seeding from mobile app';
  RAISE NOTICE '  2. Build backend API endpoint for cache operations';
  RAISE NOTICE '  3. Revert this migration (restore service_role-only policies)';
END $$;
