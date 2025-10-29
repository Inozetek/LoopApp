# Phase 2 Database Migration Instructions

This guide walks you through adding the Phase 2 tables (Referral System + Refresh Tracking) to your Supabase database.

## 📋 What This Migration Adds

### Referral System (Viral Growth Engine)
- **`referrals`** table - Track referral relationships
- **`referral_rewards`** table - Track rewards earned
- **`referral_stats`** view - User referral statistics
- Auto-generate unique referral codes for every user
- Reward system: "Invite 3 friends → Get 1 month Loop Plus free"

### Refresh Tracking (Tier-Based Cooldowns)
- **`refresh_history`** table - Track recommendation refreshes
- Cooldown enforcement: 4h (free), 1h (plus), 0h (premium)
- Cost tracking for Google Places API usage

### User Table Updates
- `referral_code` - Unique 6-character code per user
- `referred_by_user_id` - Who referred this user
- `referral_count` - Total successful referrals
- `referral_credits_cents` - Credits earned from referrals
- `last_refresh_at` - Last recommendation refresh time

---

## 🚀 Migration Steps

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your Loop project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Migration

1. Open the migration file:
   ```
   database/migrations/010_phase2_tables_consolidated.sql
   ```

2. Copy the **entire contents** of that file

3. Paste it into the Supabase SQL Editor

4. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)

5. Wait for execution to complete (should take 5-10 seconds)

6. You should see a success message in the Results panel:
   ```
   ✅ Phase 2 tables created successfully!

   Created:
     - referrals table
     - referral_rewards table
     - refresh_history table
     - referral_stats view
     - 4 helper functions
     - Referral code auto-generation trigger
   ```

### Step 3: Verify Tables Were Created

Run this query in the SQL Editor to verify:

```sql
-- Check that all Phase 2 tables exist
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('referrals', 'referral_rewards', 'refresh_history');

-- Check that referral_stats view exists
SELECT viewname
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'referral_stats';

-- Check that new columns were added to users table
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('referral_code', 'referred_by_user_id', 'referral_count', 'last_refresh_at');
```

Expected results:
- 3 tables: `referrals`, `referral_rewards`, `refresh_history`
- 1 view: `referral_stats`
- 4 new columns in `users` table

### Step 4: Test Referral Code Generation

Referral codes are auto-generated for new users. Test it:

```sql
-- Check if existing users have referral codes
SELECT id, name, email, referral_code
FROM users
LIMIT 5;

-- If you see NULL referral_codes, generate them manually:
UPDATE users
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;

-- Verify all users now have codes:
SELECT COUNT(*) as total_users,
       COUNT(referral_code) as users_with_codes
FROM users;
```

### Step 5: Enable Phase 2 Features in App

Once the migration completes successfully:

1. **Remove `@ts-nocheck`** from these files:
   - `services/referral-service.ts`
   - `services/refresh-service.ts`
   - `components/referral-dashboard.tsx`
   - `components/referral-share-modal.tsx`

2. **Rebuild TypeScript** to verify no errors:
   ```bash
   npx tsc --noEmit
   ```

3. **Restart the development server**:
   ```bash
   npm start
   ```

---

## 🧪 Testing Phase 2 Features

### Test 1: Referral Code Generation

```typescript
// In your app, check user's referral code
const { data: user } = await supabase.auth.getUser();
console.log('My referral code:', user.referral_code);
```

Expected: Should print a 6-character code like `A3F9D2`

### Test 2: Process a Referral

```sql
-- Simulate user A referring user B
SELECT process_referral(
  'user_b_uuid'::uuid,     -- User B's ID
  'A3F9D2',                 -- User A's referral code
  'link'                    -- Source
);
```

Expected: Returns success JSON with referral_id

### Test 3: Complete Referral & Grant Rewards

```sql
-- When User B completes onboarding
SELECT complete_referral('user_b_uuid'::uuid);
```

Expected:
- User B gets 7 days Loop Plus
- User A's referral_count increments
- If User A now has 3, 6, 9, etc. referrals, they get 30 days Loop Plus

### Test 4: Check Referral Stats

```sql
-- View referral performance
SELECT * FROM referral_stats
WHERE user_id = 'user_a_uuid'::uuid;
```

Expected: Shows completed_referrals, rewards_earned, total_plus_days_earned

### Test 5: Refresh Rate Limiting

```typescript
// Check if user can refresh
import { checkRefreshCooldown } from '@/services/refresh-service';

const result = await checkRefreshCooldown(userId);
console.log('Can refresh:', result.canRefresh);
console.log('Seconds until refresh:', result.secondsUntilRefresh);
```

Expected:
- Free users: 4-hour cooldown
- Plus users: 1-hour cooldown
- Premium users: No cooldown

---

## 🔧 Troubleshooting

### Issue: "table already exists" error

**Cause:** You've run the migration before

**Solution:** The migration uses `IF NOT EXISTS`, so it's safe to re-run. If you see this error, the tables are already created.

### Issue: "column already exists" error

**Cause:** Columns were added in a previous partial run

**Solution:** Also safe to ignore. The migration uses `ADD COLUMN IF NOT EXISTS`.

### Issue: Users don't have referral codes

**Solution:** Run this update:
```sql
UPDATE users
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;
```

### Issue: TypeScript errors after migration

**Cause:** The `@ts-nocheck` directives are still active

**Solution:**
1. Remove `// @ts-nocheck` from the top of these files:
   - `services/referral-service.ts`
   - `services/refresh-service.ts`
2. Run `npx tsc --noEmit` to verify no errors
3. Restart development server

---

## 🎯 Success Checklist

After running this migration, you should have:

- ✅ All Phase 2 tables created
- ✅ Users have unique referral codes
- ✅ Referral rewards system functional
- ✅ Refresh cooldown tracking working
- ✅ Zero TypeScript errors
- ✅ App runs without database errors

---

## 📚 Related Documentation

- **Referral System Design:** See `CLAUDE.md` Section "Revenue Stream 2: User Subscriptions"
- **Refresh Tracking Logic:** See `services/refresh-service.ts`
- **Database Schema:** See `database/migrations/010_phase2_tables_consolidated.sql`

---

## 🆘 Need Help?

If you encounter issues:

1. Check the Supabase logs: **Database → Logs → Postgres Logs**
2. Verify your Supabase project has sufficient resources
3. Make sure you have permission to create tables (Project Admin role)
4. Try running the migration in smaller chunks if timeout occurs

---

**Migration created:** 2025-01-26
**Database types updated:** `types/database.ts`
**Ready for production:** After successful testing ✅
