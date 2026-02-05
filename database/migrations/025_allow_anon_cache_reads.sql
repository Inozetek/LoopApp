/**
 * Migration: Allow Anonymous Cache Reads
 *
 * Problem: places_cache RLS policy blocks anonymous users
 * Solution: Allow anon reads since it's public place data (Google Places API)
 *
 * Security: Safe because:
 * - places_cache only stores public Google Places data
 * - No user PII or private data
 * - Writes still restricted to authenticated/service_role
 */

-- Drop the restrictive authenticated-only policy
DROP POLICY IF EXISTS "Authenticated users can read places cache" ON places_cache;

-- Allow BOTH authenticated AND anonymous users to read
CREATE POLICY "Public can read places cache"
  ON places_cache
  FOR SELECT
  USING (true);  -- Allow all reads (no auth required)

-- Same for events cache (also public data)
DROP POLICY IF EXISTS "Authenticated users can read events cache" ON events_cache;

CREATE POLICY "Public can read events cache"
  ON events_cache
  FOR SELECT
  USING (true);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Anonymous cache reads enabled!';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  - Anonymous users can now read places_cache';
  RAISE NOTICE '  - Anonymous users can now read events_cache';
  RAISE NOTICE '';
  RAISE NOTICE 'Security: Safe because cache only stores public API data';
  RAISE NOTICE '  - Google Places API results (public)';
  RAISE NOTICE '  - Ticketmaster events (public)';
  RAISE NOTICE '  - No user PII or private data';
  RAISE NOTICE '';
  RAISE NOTICE 'Writes still restricted to authenticated/service_role only';
END $$;
