# ✅ Supabase Migration Checklist

**Last Updated:** 2025-10-28
**Purpose:** Track which migrations have been run in your Supabase database

---

## 🔴 REQUIRED for MVP (Must Run These)

### ☐ 1. Initial Schema (`001_initial_schema.sql`)
**Status:** ❓ Not Confirmed
**Lines:** 720
**Purpose:** Creates all core database tables
**Tables Created:**
- `users` - User profiles and preferences
- `calendar_events` - User's calendar/tasks
- `activities` - Activities/places from Google
- `recommendations` - AI-generated suggestions
- `feedback` - User feedback on activities
- `friendships` - Friend connections
- `group_plans` - Group activity plans
- `plan_participants` - Group plan participants
- `messages` - Group chat messages
- `businesses` - Business accounts
- `business_analytics` - Business dashboard data
- `payments` - Payment records
- `notifications` - Push notifications
- `app_analytics` - App-wide analytics

**Extensions Created:**
- PostGIS (for location queries)

**How to Run:**
1. Open Supabase Dashboard → SQL Editor
2. Click "New query"
3. Copy entire contents of `database/migrations/001_initial_schema.sql`
4. Paste and click "Run"
5. Should see: "Success. No rows returned" ✅

**Verify It Worked:**
```sql
-- Run this query to check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Expected output: 13-15 table names including `users`, `activities`, `calendar_events`, etc.

---

### ☐ 2. Auth Trigger (`002_auth_trigger.sql`)
**Status:** ❓ Not Confirmed
**Lines:** 38
**Purpose:** Automatically creates user profile when someone signs up
**Critical:** WITHOUT THIS, SIGNUP WILL FAIL! ⚠️

**What It Does:**
- When user signs up via auth, creates matching record in `users` table
- Extracts name from metadata or email
- Sets default timestamps

**How to Run:**
1. Supabase Dashboard → SQL Editor
2. New query
3. Copy contents of `database/migrations/002_auth_trigger.sql`
4. Paste and click "Run"

**Verify It Worked:**
```sql
-- Check if trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

Expected output: 1 row showing the trigger

**Test It:**
1. Sign up a new test user in your app
2. Check if user appears in both tables:
```sql
-- Check auth table
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- Check public users table (should have matching ID)
SELECT id, email, name, created_at FROM public.users ORDER BY created_at DESC LIMIT 1;
```

---

## 🟡 OPTIONAL (Nice to Have, Not Required)

### ☐ 3. Demo User (`003_add_demo_user.sql`)
**Status:** ❓ Not Confirmed
**Lines:** 60
**Purpose:** Adds a demo user for testing
**Required:** No (you can create test users manually)

**When to Run:**
- If you want pre-populated test data
- If you're demoing to someone and want a ready account

---

### ☐ 4. Refresh Tracking (`008_refresh_tracking.sql`)
**Status:** ❓ Not Confirmed
**Lines:** 117
**Purpose:** Tracks when users refresh recommendations
**Required:** No (analytics feature)

**When to Run:**
- After MVP is working
- When you want to track user engagement metrics

---

## 🟢 PHASE 2/3 (Don't Run Yet)

### ☐ 5. Referral System (`009_referral_system.sql`)
**Status:** Not Needed Yet
**Lines:** 270
**Purpose:** Referral program tables and functions
**Phase:** Phase 2 monetization feature

**When to Run:**
- After MVP is complete and tested
- When implementing referral rewards system

---

### ☐ 6. Phase 2 Tables (`010_phase2_tables_consolidated.sql`)
**Status:** Not Needed Yet
**Lines:** 403
**Purpose:** Advanced features (multi-day itineraries, badges, etc.)
**Phase:** Phase 2+ features

**When to Run:**
- After MVP is launched
- When building advanced features

---

## 🎯 Quick Verification Script

Run this in Supabase SQL Editor to check your database status:

```sql
-- Database Health Check
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
```

**Expected Output (for MVP):**
```
PostGIS Extension     ✅ Installed
Users Table           ✅ Exists
Auth Trigger          ✅ Active
Activities Table      ✅ Exists
Recommendations Table ✅ Exists
```

---

## 🚀 What You Need RIGHT NOW

For the app to work, you MUST have:

1. ✅ `001_initial_schema.sql` - Run this FIRST
2. ✅ `002_auth_trigger.sql` - Run this SECOND

Everything else is optional or for later phases.

---

## 🐛 Troubleshooting

### Error: "relation 'users' does not exist"
**Fix:** You haven't run migration #1 (`001_initial_schema.sql`)

### Error: "Failed to create user profile" on signup
**Fix:** You haven't run migration #2 (`002_auth_trigger.sql`)

### Error: "extension 'postgis' already exists"
**This is fine!** It means PostGIS was already installed. Continue with the rest of the migration.

### Error: "trigger 'on_auth_user_created' already exists"
**This is fine!** The migration drops it first, but if you see this, the trigger exists. You're good.

---

## ✅ Final Checklist Before Development

Before you start coding, verify:

- [ ] Ran `001_initial_schema.sql` successfully
- [ ] Ran `002_auth_trigger.sql` successfully
- [ ] Ran the verification script (all ✅)
- [ ] Can sign up a test user without errors
- [ ] Test user appears in both `auth.users` AND `public.users`
- [ ] `.env` file has correct Supabase credentials
- [ ] App starts without "SUPABASE_URL is not set" error

---

**Once all critical migrations are confirmed, reply:** "All migrations complete! ✅"

Then I can help with next steps!
