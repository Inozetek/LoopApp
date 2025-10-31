# Dashboard Setup Instructions

## 🚨 Required: Run Database Migration

The Daily Dashboard feature requires new database tables and functions. Follow these steps:

### Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your Loop project
3. Click **SQL Editor** in left sidebar
4. Click **New Query**

### Step 2: Copy Migration SQL

1. Open file: `database/migrations/004_add_dashboard_and_privacy_groups.sql`
2. Copy the ENTIRE file contents (400+ lines)

### Step 3: Execute Migration

1. Paste the SQL into Supabase SQL Editor
2. Click **Run** (or press Cmd/Ctrl + Enter)
3. Wait for "Success. No rows returned" message

### Step 4: Verify Tables Created

Run this query to verify:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'user_sessions',
  'dashboard_notifications',
  'friend_activity_log',
  'dashboard_stats_cache'
);
```

You should see 4 rows returned.

### Step 5: Verify Functions Created

Run this query:

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'should_show_dashboard_today',
  'mark_dashboard_viewed',
  'get_user_friend_groups'
);
```

You should see 3 rows returned.

---

## ✅ Verification Checklist

- [ ] Migration executed without errors
- [ ] 4 new tables exist
- [ ] 3 new functions exist
- [ ] RLS policies enabled
- [ ] App no longer shows PGRST errors

---

## 🐛 Troubleshooting

### Error: "relation already exists"
- **Cause:** Migration already ran
- **Fix:** Skip to verification step

### Error: "permission denied"
- **Cause:** Not project owner
- **Fix:** Ask project owner to run migration

### Error: "function already exists"
- **Cause:** Migration partially ran
- **Fix:** Safe to ignore, verify functions exist

### Dashboard still shows errors after migration
- **Cause:** App cache or connection issue
- **Fix:**
  1. Restart Expo dev server
  2. Clear app data (iOS: Delete app, Android: Clear storage)
  3. Reload app

---

## 🎯 Expected Behavior After Migration

1. **First Load:** Dashboard appears automatically (if no data, shows 0s)
2. **No PGRST Errors:** Console should be clean
3. **Swipe-Down:** Should work from Loop logo
4. **Stats View:** Shows 0 loops, 0 friends, etc. (empty state is normal)
5. **Map View:** Shows "No loops planned" empty state

---

## 📊 Add Test Data (Optional)

Want to see dashboard with data? Run this:

```sql
-- Add a test calendar event for today
INSERT INTO calendar_events (
  user_id,
  title,
  description,
  category,
  location,
  address,
  start_time,
  end_time,
  status
) VALUES (
  (SELECT id FROM users WHERE email = auth.email() LIMIT 1),
  'Coffee at Blue Bottle',
  'Morning coffee with AI recommendations',
  'dining',
  ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326),
  '66 Mint St, San Francisco, CA',
  NOW() + INTERVAL '2 hours',
  NOW() + INTERVAL '3 hours',
  'scheduled'
);

-- Add a test dashboard notification
INSERT INTO dashboard_notifications (
  user_id,
  notification_type,
  priority,
  title,
  message,
  is_read,
  is_dismissed
) VALUES (
  (SELECT id FROM users WHERE email = auth.email() LIMIT 1),
  'friend_activity',
  'info',
  '3 friends are embarking on loops today',
  'Sarah is grabbing coffee, John is seeing a movie, Emma is at dinner',
  false,
  false
);
```

Now restart the app and you should see:
- **1 loop planned**
- **1 notification**
- **Task on map view**

---

## 🔄 Reset Dashboard State (for Testing)

To test first-load behavior again:

```typescript
// In React Native debug console
import { resetDashboardState } from '@/utils/dashboard-tracker';
await resetDashboardState();
```

Or delete AsyncStorage:
- **iOS:** Delete app and reinstall
- **Android:** Settings → Apps → Loop → Storage → Clear Data
