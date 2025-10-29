# Sign Up Troubleshooting Guide

## Common Signup Issues & Fixes

### Issue 1: "Failed to create user profile" or signup succeeds but can't proceed

**Root Cause:** Auth trigger not set up in Supabase

**Fix:**
1. Go to your Supabase dashboard → SQL Editor
2. Run the migration: `database/migrations/002_auth_trigger.sql`

This trigger automatically creates a user profile in the `users` table when someone signs up via auth.

**Verify it worked:**
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

---

### Issue 2: Email confirmation required (signup seems to work but can't login)

**Root Cause:** Supabase requires email confirmation by default

**Quick Fix for Testing:**
1. Go to Supabase Dashboard → Authentication → Providers
2. Click on "Email" provider
3. **Disable** "Confirm email" (scroll down to find this setting)
4. Save

**Production Fix:**
- Keep email confirmation enabled
- Check your spam folder for confirmation email
- Or manually confirm user in Supabase dashboard:
  - Go to Authentication → Users
  - Find your user
  - Click "..." menu → "Confirm email"

---

### Issue 3: RLS policy violation

**Symptoms:** Error like "new row violates row-level security policy"

**Fix:**
1. Go to Supabase Dashboard → Authentication → Policies
2. Check the `users` table has these policies:
   - **INSERT**: `auth.uid() = id` OR allow public insert
   - **SELECT**: `auth.uid() = id`
   - **UPDATE**: `auth.uid() = id`

**Quick fix - Run this SQL:**
```sql
-- Allow authenticated users to insert their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;

CREATE POLICY "Users can insert their own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow anyone to insert (more permissive, for testing only)
-- DROP POLICY IF EXISTS "Enable insert for all users" ON users;
-- CREATE POLICY "Enable insert for all users"
-- ON users FOR INSERT
-- WITH CHECK (true);
```

---

### Issue 4: Database schema not created

**Symptoms:** Error like "relation 'users' does not exist"

**Fix:**
1. Go to Supabase Dashboard → SQL Editor
2. Run migration: `database/migrations/001_initial_schema.sql`
3. Verify tables exist: Database → Tables (should see 15 tables)

---

### Issue 5: Environment variables not set correctly

**Check your `.env.local` file:**
```env
EXPO_PUBLIC_SUPABASE_URL=https://[project].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
```

**Common mistakes:**
- ❌ Missing `EXPO_PUBLIC_` prefix
- ❌ Extra spaces or quotes around values
- ❌ Wrong project URL (copy from Supabase Dashboard → Settings → API)

**Test if keys work:**
```bash
# Restart Metro bundler after changing .env
npm start -- --reset-cache
```

---

## Step-by-Step Signup Test

### 1. Check Supabase Setup

**Run this SQL query in Supabase:**
```sql
-- Check if all required components exist
SELECT
  'users_table' AS component,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
    THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status
UNION ALL
SELECT
  'auth_trigger' AS component,
  CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created')
    THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status
UNION ALL
SELECT
  'postgis_extension' AS component,
  CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis')
    THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status;
```

**Expected output:**
```
users_table     ✅ EXISTS
auth_trigger    ✅ EXISTS
postgis_extension ✅ EXISTS
```

If any show ❌ MISSING, run the respective migration.

---

### 2. Test Signup from App

**Clear app cache:**
```bash
npm start -- --reset-cache
```

**Try signing up:**
1. Email: `test+$(date +%s)@loopapp.com` (use unique email)
2. Password: `password123` (min 6 characters)
3. Tap "Create Account"

**Watch console logs:**
```javascript
// Should see:
"Attempting signup with Supabase..."
"Signup response: { data: {...}, error: null }"
"User profile created successfully"
```

---

### 3. Verify User Creation

**In Supabase Dashboard:**

**Check auth.users table:**
```sql
SELECT id, email, created_at, email_confirmed_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;
```

**Check public.users table:**
```sql
SELECT id, email, name, created_at
FROM users
ORDER BY created_at DESC
LIMIT 5;
```

**Both tables should have matching records with the same `id`.**

---

## Quick Fix Script

If nothing else works, run this complete reset:

```sql
-- 1. Disable RLS temporarily (for testing only!)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 2. Delete all test users
DELETE FROM auth.users WHERE email LIKE 'test%@loopapp.com';
DELETE FROM users WHERE email LIKE 'test%@loopapp.com';

-- 3. Recreate auth trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 5. Recreate policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);
```

---

## Still Not Working?

### Enable Detailed Logging

**In `lib/supabase.ts`, add:**
```typescript
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    debug: true, // Enable debug logging
  },
});
```

**In `contexts/auth-context.tsx`, add more logs:**
```typescript
async function signUp(email: string, password: string) {
  try {
    console.log('=== SIGNUP DEBUG ===');
    console.log('Email:', email);
    console.log('Password length:', password.length);

    const { data, error } = await supabase.auth.signUp({ email, password });

    console.log('Signup response:', JSON.stringify({ data, error }, null, 2));

    if (error) {
      console.error('❌ Signup error:', error.message);
      throw error;
    }

    console.log('✅ Auth user created:', data.user?.id);

    // Check if profile was created
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user!.id)
      .single();

    if (profileError) {
      console.error('❌ Profile fetch error:', profileError.message);
    } else {
      console.log('✅ Profile created:', profile);
    }

    return data;
  } catch (error) {
    console.error('=== SIGNUP FAILED ===', error);
    throw error;
  }
}
```

---

## Contact Points

If still stuck, check:
1. **Supabase Logs:** Dashboard → Logs → Auth
2. **React Native Debugger:** Press `Cmd+D` (iOS) / `Cmd+M` (Android) → "Debug"
3. **Supabase Discord:** https://discord.supabase.com

---

## Most Common Solution

**90% of signup issues are fixed by:**

1. Running the auth trigger migration (`002_auth_trigger.sql`)
2. Disabling email confirmation in Supabase for testing

Try these two first!
