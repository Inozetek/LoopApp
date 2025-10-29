# IMPORTANT: Restart Metro Bundler

## Fixed Issues:
1. ✅ Corrected Supabase URL (was typo in hardcoded value)
2. ✅ Now using environment variables from .env.local
3. ✅ Removed AbortSignal.timeout() error

## You MUST restart Metro with cleared cache:

### In your terminal where Metro is running:

**Step 1: Stop Metro**
```
Press Ctrl+C
```

**Step 2: Restart with cleared cache**
```bash
npm start -- --reset-cache
```

**Step 3: Reload app**
- In Expo Go, shake device → "Reload"
- OR press `r` in Metro terminal
- OR scan QR code again

---

## Why this is necessary:

Expo caches environment variables. Changing them requires:
1. Stopping Metro
2. Clearing cache
3. Restarting

Without this, the app will still use old (wrong) values.

---

## After restarting:

**Try signing up with:**
- Email: test@loopapp.com
- Password: password123

**You should see in console:**
```
Supabase fetch: https://yvedmxyfehjiigikitbo.supabase.co/auth/v1/signup
```

If you see the CORRECT URL (with "itbo" not "ibo"), it worked!

---

## If still getting errors:

Check console for:
- "Missing Supabase environment variables" → .env.local not loaded
- Network error → Firewall/VPN issue
- 404 error → Wrong URL (old cache still active)
- 401 error → This is GOOD (means connection works, just need auth)

---

## Quick Supabase Checklist:

Before signing up, make sure in Supabase Dashboard:

**1. Tables exist:**
- Go to Database → Tables
- Should see "users" table

**2. Auth trigger exists:**
- Go to SQL Editor
- Run: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
- Should return 1 row

**3. Email confirmation disabled (for testing):**
- Go to Authentication → Providers → Email
- Toggle OFF "Confirm email"
- Save

**4. RLS policies exist:**
- Go to Authentication → Policies
- Click "users" table
- Should see 3 policies (SELECT, INSERT, UPDATE)

If any are missing, run the migrations in `database/migrations/`
