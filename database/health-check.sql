-- Database Health Check
-- Run this in Supabase SQL Editor to verify your setup

SELECT
  'PostGIS Extension' AS component,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'postgis'
  ) THEN '✅ Installed' ELSE '❌ Missing' END AS status
UNION ALL
SELECT
  'Users Table' AS component,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'users' AND table_schema = 'public'
  ) THEN '✅ Exists' ELSE '❌ Missing' END AS status
UNION ALL
SELECT
  'Auth Trigger' AS component,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'on_auth_user_created'
  ) THEN '✅ Active' ELSE '❌ Missing' END AS status
UNION ALL
SELECT
  'Activities Table' AS component,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'activities' AND table_schema = 'public'
  ) THEN '✅ Exists' ELSE '❌ Missing' END AS status
UNION ALL
SELECT
  'Recommendations Table' AS component,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'recommendations' AND table_schema = 'public'
  ) THEN '✅ Exists' ELSE '❌ Missing' END AS status;
