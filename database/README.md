# Loop App Database Setup

This directory contains all database-related files for the Loop app, including migrations, seed data, and utility scripts.

## Quick Start (Day 1 Setup)

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in details:
   - **Name**: `loop-app` (or your preferred name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your location (e.g., `us-west-1` for California)
   - **Pricing Plan**: Free tier is sufficient for MVP
4. Click "Create new project" and wait ~2 minutes for provisioning

### Step 2: Run Initial Schema Migration

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New query**
3. Copy the entire contents of `migrations/001_initial_schema.sql`
4. Paste into the SQL Editor
5. Click **Run** (or press Ctrl+Enter / Cmd+Enter)
6. You should see: "Success. No rows returned" with a success message in the output

**What this migration creates:**
- ✅ PostGIS extension (for geospatial queries)
- ✅ 15 core tables (users, activities, calendar_events, etc.)
- ✅ All indexes for performance
- ✅ Row Level Security (RLS) policies
- ✅ Triggers for `updated_at` timestamps

### Step 2b: Run Auth Trigger Migration (Day 2)

After setting up authentication in your app, run this migration to auto-create user profiles:

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Copy the entire contents of `migrations/002_auth_trigger.sql`
4. Paste into the SQL Editor
5. Click **Run**

**What this migration creates:**
- ✅ Auto-creates user profile in `users` table when someone signs up
- ✅ Extracts name from OAuth metadata or email
- ✅ Ensures every authenticated user has a corresponding database record

### Step 3: Verify Schema Creation

In Supabase dashboard:
1. Go to **Database** → **Tables**
2. You should see 15 tables:
   - users
   - calendar_events
   - activities
   - businesses
   - recommendations
   - feedback
   - friendships
   - group_plans
   - plan_participants
   - messages
   - business_analytics
   - payments
   - notifications
   - app_analytics

### Step 4: Set Up Authentication

1. Go to **Authentication** → **Providers** in Supabase dashboard
2. Enable **Email** provider:
   - Toggle "Enable Email provider" to ON
   - Enable "Confirm email" (recommended for production, can disable for testing)
3. Enable **Google** provider:
   - Toggle "Enable Sign in with Google" to ON
   - You'll need Google OAuth credentials:
     - Go to [Google Cloud Console](https://console.cloud.google.com/)
     - Create a new project or use existing
     - Enable Google+ API
     - Create OAuth 2.0 credentials (Web application)
     - Add authorized redirect URI: `https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback`
     - Copy Client ID and Client Secret to Supabase

### Step 5: Get API Keys

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy these values (you'll need them for your app):
   - **Project URL**: `https://[YOUR-PROJECT-REF].supabase.co`
   - **anon public key**: Used in your frontend (safe to expose)
   - **service_role key**: Used in your backend (keep secret!)

3. Create a `.env.local` file in the root of your project:
```env
# Supabase
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]

# Google Places API (get from Google Cloud Console)
GOOGLE_PLACES_API_KEY=[YOUR-GOOGLE-PLACES-KEY]

# OpenAI API (get from platform.openai.com)
OPENAI_API_KEY=[YOUR-OPENAI-KEY]

# OpenWeather API (get from openweathermap.org - free tier)
OPENWEATHER_API_KEY=[YOUR-OPENWEATHER-KEY]
```

**IMPORTANT**: Add `.env.local` to your `.gitignore` to avoid committing secrets!

### Step 6: Test Database Connection

Create a simple test script to verify everything works:

```javascript
// test-db-connection.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

async function testConnection() {
  // Test 1: Check if PostGIS extension is enabled
  const { data: extensions } = await supabase
    .rpc('get_extensions')

  console.log('PostGIS enabled:', extensions?.some(ext => ext.name === 'postgis'))

  // Test 2: Check if tables exist
  const { data: tables, error } = await supabase
    .from('users')
    .select('count')
    .limit(1)

  if (error) {
    console.error('Database error:', error)
  } else {
    console.log('✅ Database connection successful!')
    console.log('✅ Tables created successfully!')
  }
}

testConnection()
```

Run: `node test-db-connection.js`

---

## Directory Structure

```
database/
├── README.md                    # This file
├── migrations/                  # SQL migration files
│   ├── 001_initial_schema.sql  # Initial database schema
│   └── 002_seed_data.sql       # (Coming in Day 2) Test data
├── queries/                     # Reusable SQL queries
│   ├── get-nearby-activities.sql
│   └── calculate-midpoint.sql
└── scripts/                     # Utility scripts
    ├── backup-database.sh
    └── reset-test-data.sh
```

---

## Common Database Operations

### Querying Nearby Activities (Using PostGIS)

```sql
-- Find all activities within 5 miles of a location
SELECT
  id,
  name,
  category,
  ST_Distance(
    location,
    ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography
  ) / 1609.34 AS distance_miles
FROM activities
WHERE ST_DWithin(
  location,
  ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography,
  8046.72  -- 5 miles in meters
)
AND is_active = TRUE
ORDER BY distance_miles ASC
LIMIT 10;
```

### Calculating Midpoint for Group Plans

```sql
-- Calculate geographic midpoint for group planning
SELECT
  ST_AsText(
    ST_Centroid(
      ST_Collect(home_location::geometry)
    )
  ) AS midpoint
FROM users
WHERE id IN ('user_id_1', 'user_id_2', 'user_id_3');
```

### Finding Free Time Slots

```sql
-- Find free time gaps in user's calendar
WITH busy_times AS (
  SELECT
    start_time,
    end_time
  FROM calendar_events
  WHERE user_id = '[USER_ID]'
    AND start_time >= NOW()
    AND start_time < NOW() + INTERVAL '7 days'
    AND status = 'scheduled'
  ORDER BY start_time
),
gaps AS (
  SELECT
    LAG(end_time) OVER (ORDER BY start_time) AS free_start,
    start_time AS free_end
  FROM busy_times
)
SELECT
  free_start,
  free_end,
  EXTRACT(EPOCH FROM (free_end - free_start)) / 3600 AS hours
FROM gaps
WHERE free_start IS NOT NULL
  AND EXTRACT(EPOCH FROM (free_end - free_start)) >= 3600  -- At least 1 hour
ORDER BY free_start;
```

---

## Row Level Security (RLS) Policies

All tables have RLS enabled by default. Key policies:

**Users table:**
- Users can only view/edit their own data
- Auth: `auth.uid() = id`

**Calendar events:**
- Users can only see their own calendar events
- Auth: `auth.uid() = user_id`

**Activities:**
- Everyone can view active activities (no auth required)
- Only admins can create/edit activities

**Recommendations:**
- Users can only see their own recommendations
- Auth: `auth.uid() = user_id`

**Group plans:**
- Users can see plans where they're the creator OR a participant
- Complex policy checking plan_participants table

To modify RLS policies, go to **Authentication** → **Policies** in Supabase dashboard.

---

## Next Steps (Day 2)

1. **Create seed data** (`002_seed_data.sql`):
   - 5-10 test users
   - 50-100 activities (mock Google Places data)
   - Sample calendar events
   - Friend relationships
   - Test recommendations

2. **Set up Google Places API**:
   - Enable Places API in Google Cloud Console
   - Create API key
   - Add to `.env.local`

3. **Test spatial queries**:
   - Verify PostGIS functions work
   - Test nearby activity searches
   - Test midpoint calculations

4. **Create database utility functions**:
   - User profile helpers
   - Activity search functions
   - Recommendation scoring queries

---

## Troubleshooting

**Issue: "extension postgis does not exist"**
- Solution: PostGIS should be enabled automatically. If not, run:
  ```sql
  CREATE EXTENSION IF NOT EXISTS postgis;
  ```

**Issue: "permission denied for table users"**
- Solution: Check RLS policies are correctly set
- Verify you're authenticated when querying from frontend

**Issue: "could not connect to server"**
- Solution: Check your `SUPABASE_URL` and API keys are correct
- Verify Supabase project is active (not paused)

**Issue: Slow geospatial queries**
- Solution: Ensure GIST indexes are created on GEOGRAPHY columns:
  ```sql
  CREATE INDEX idx_activities_location ON activities USING GIST(location);
  ```

---

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostGIS Documentation](https://postgis.net/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
