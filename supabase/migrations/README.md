# Supabase Migrations

This directory contains SQL migrations for the Loop app database.

## Running Migrations

### Option 1: Supabase Dashboard (Recommended for Development)

1. Go to your Supabase project: https://supabase.com/dashboard/project/YOUR_PROJECT_ID
2. Navigate to **SQL Editor**
3. Run migrations in order:
   - `20260110_add_oauth_and_referral_data.sql`
   - `20260110_create_referrals_table.sql`
   - `20260110_add_loop_routing_to_events.sql`

### Option 2: Supabase CLI

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Initialize Supabase (if not initialized)
supabase init

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

## Migration Files

### 1. `20260110_add_oauth_and_referral_data.sql`
**Purpose:** Add OAuth data and referral fields to users table

**Changes:**
- Adds `facebook_data` JSONB column (liked places with exact names + categories)
- Adds `google_timeline` JSONB column (visited places with visit counts)
- Adds `referral_code` VARCHAR(10) with auto-generation trigger
- Adds `referred_by_user_id` UUID foreign key
- Adds `referral_count` INTEGER counter
- Creates GIN indexes for JSONB queries
- Creates trigger to auto-generate unique 6-char referral codes

**Functions:**
- `generate_referral_code()` - Generates unique alphanumeric codes
- `set_referral_code()` - Trigger to auto-set code on insert

### 2. `20260110_create_referrals_table.sql`
**Purpose:** Create referrals tracking table for viral growth

**Table Structure:**
```sql
referrals (
  id UUID PRIMARY KEY,
  referrer_user_id UUID,
  referee_user_id UUID,
  referral_code VARCHAR(10),
  status VARCHAR(20),  -- pending, completed, rewarded, expired
  referee_email, referee_phone,
  invite_method,
  created_at, completed_at, rewarded_at, expires_at
)
```

**Functions:**
- `complete_referral(code, user_id)` - Marks referral complete when referee signs up
- `reward_referral(referral_id)` - Grants 1 month Premium to both users
- `expire_old_referrals()` - Expires pending referrals older than 30 days

### 3. `20260110_add_loop_routing_to_events.sql`
**Purpose:** Add smart Loop routing to calendar events

**Changes:**
- Adds `loop_routing` JSONB column to `calendar_events`
  - `is_chained`: Boolean
  - `chain_with_event_id`: UUID
  - `recommended_departure_time`: TIMESTAMPTZ
  - `estimated_travel_minutes`: INTEGER
- Adds notification tracking fields
- Creates GIN index for JSONB queries

**Functions:**
- `should_chain_events(event_a, event_b)` - Determines if events should chain
- `calculate_departure_time(event_id)` - Calculates when to leave
- `update_loop_routing_for_user(user_id)` - Auto-updates routing for all events

## Testing Migrations

After running migrations, verify with:

```sql
-- Check users table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('facebook_data', 'google_timeline', 'referral_code');

-- Check referrals table exists
SELECT COUNT(*) FROM referrals;

-- Check calendar_events has loop_routing
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'calendar_events'
  AND column_name = 'loop_routing';

-- Test referral code generation
SELECT referral_code FROM users LIMIT 5;
```

## Rollback (if needed)

```sql
-- Rollback OAuth/referral data migration
DROP TRIGGER IF EXISTS users_set_referral_code ON users;
DROP FUNCTION IF EXISTS set_referral_code();
DROP FUNCTION IF EXISTS generate_referral_code();
ALTER TABLE users DROP COLUMN IF EXISTS facebook_data;
ALTER TABLE users DROP COLUMN IF EXISTS google_timeline;
ALTER TABLE users DROP COLUMN IF EXISTS referral_code;
ALTER TABLE users DROP COLUMN IF EXISTS referred_by_user_id;
ALTER TABLE users DROP COLUMN IF EXISTS referral_count;

-- Rollback referrals table
DROP FUNCTION IF EXISTS expire_old_referrals();
DROP FUNCTION IF EXISTS reward_referral(UUID);
DROP FUNCTION IF EXISTS complete_referral(VARCHAR, UUID);
DROP TABLE IF EXISTS referrals;

-- Rollback loop routing migration
DROP FUNCTION IF EXISTS update_loop_routing_for_user(UUID);
DROP FUNCTION IF EXISTS calculate_departure_time(UUID);
DROP FUNCTION IF EXISTS should_chain_events(UUID, UUID);
ALTER TABLE calendar_events DROP COLUMN IF EXISTS loop_routing;
ALTER TABLE calendar_events DROP COLUMN IF EXISTS notifications_scheduled;
ALTER TABLE calendar_events DROP COLUMN IF EXISTS departure_notification_id;
ALTER TABLE calendar_events DROP COLUMN IF EXISTS warning_notification_id;
```
