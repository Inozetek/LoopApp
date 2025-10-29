# Authentication Testing Guide

This guide will help you test the complete authentication flow for the Loop app.

## Prerequisites

Before testing, ensure you've completed these steps:

1. ✅ Supabase project created with all tables
2. ✅ Run `database/migrations/001_initial_schema.sql` in Supabase SQL Editor
3. ✅ **IMPORTANT**: Run `database/migrations/002_auth_trigger.sql` in Supabase SQL Editor
4. ✅ Email authentication enabled in Supabase dashboard
5. ✅ Google OAuth configured (optional for initial testing)
6. ✅ Environment variables set in `.env.local` with `EXPO_PUBLIC_` prefix
7. ✅ Dependencies installed (`npm install` or `yarn install`)

## Testing Checklist

### 1. Start the Development Server

```bash
# Start Expo development server
npm start
# or
yarn start
```

Then choose a platform:
- Press `i` for iOS Simulator (macOS only)
- Press `a` for Android Emulator
- Scan QR code with Expo Go app on physical device

### 2. Test Sign Up Flow

**Steps:**
1. App should load and redirect to `/auth/login` (since you're not authenticated)
2. Tap "Sign Up" link at bottom
3. Enter test credentials:
   - Email: `test@loopapp.com`
   - Password: `password123`
   - Confirm Password: `password123`
4. Tap "Create Account" button

**Expected Results:**
- ✅ Loading indicator appears
- ✅ Account created successfully
- ✅ Automatically redirected to `/auth/onboarding`
- ✅ User record created in Supabase `auth.users` table
- ✅ User profile record auto-created in `public.users` table (via trigger)

**Common Errors:**
- "Password must be at least 6 characters" → Use longer password
- "Passwords do not match" → Ensure both fields match
- "Sign Up Failed: User already registered" → Use different email or delete user in Supabase

### 3. Test Onboarding Flow

**Step 1 - Name:**
1. Should see "What's your name?" screen with progress dots (1/3 filled)
2. Enter name: "Test User"
3. Tap "Next"

**Step 2 - Interests:**
1. Should see "What are you interested in?" with 18 interest chips
2. Select at least 1 interest (e.g., "Dining", "Fitness", "Entertainment")
3. Try selecting more than 10 → should show "Maximum Interests" alert
4. Counter should show "X / 10 selected"
5. Tap "Back" to test navigation → should return to Step 1
6. Tap "Next" to proceed to Step 3

**Step 3 - Locations:**
1. Should see "Where are you based?" with 2 address fields
2. Enter home address: "123 Main St, San Francisco, CA 94102"
3. Optionally enter work address: "456 Market St, San Francisco, CA 94105"
4. Tap "Get Started"

**Expected Results:**
- ✅ Loading indicator appears
- ✅ User profile updated in `public.users` table with:
  - name
  - interests array
  - home_address
  - work_address (if provided)
  - default preferences
  - default privacy_settings
- ✅ Automatically redirected to `/(tabs)` (main app)
- ✅ Bottom tab navigation visible

**Common Errors:**
- "Please select at least one interest" → Select 1+ interests
- "Please enter your home address" → Home address is required
- "Failed to complete profile setup" → Check Supabase logs, ensure RLS policies allow updates

### 4. Test Sign Out

**Steps:**
1. Navigate to Profile tab (rightmost tab)
2. Look for "Sign Out" button
3. Tap "Sign Out"

**Expected Results:**
- ✅ Session cleared from AsyncStorage
- ✅ Automatically redirected to `/auth/login`
- ✅ User state cleared in AuthContext

### 5. Test Sign In Flow

**Steps:**
1. Should be on `/auth/login` screen after signing out
2. Enter the same credentials used during signup:
   - Email: `test@loopapp.com`
   - Password: `password123`
3. Tap "Sign In" button

**Expected Results:**
- ✅ Loading indicator appears
- ✅ Successfully authenticated
- ✅ User profile fetched from database
- ✅ Automatically redirected to `/(tabs)` (main app)
- ✅ Profile data persists (name, interests, addresses visible in Profile tab)

**Common Errors:**
- "Invalid login credentials" → Check email/password, ensure user exists
- "Email not confirmed" → If you enabled email confirmation in Supabase, check spam folder

### 6. Test Google OAuth (Optional)

**Prerequisites:**
- Google OAuth configured in Supabase with valid Client ID/Secret
- Authorized redirect URI set in Google Cloud Console

**Steps:**
1. On `/auth/login` or `/auth/signup` screen
2. Tap "Continue with Google" button
3. Browser should open with Google sign-in page
4. Select Google account
5. Grant permissions

**Expected Results:**
- ✅ Redirected back to app via deep link (`loopapp://auth/callback`)
- ✅ Session created in Supabase
- ✅ User record auto-created in `public.users` table (via trigger)
- ✅ If new user: redirected to `/auth/onboarding`
- ✅ If existing user: redirected to `/(tabs)`

**Common Errors:**
- "Invalid OAuth credentials" → Check Google Cloud Console setup
- "Redirect URI mismatch" → Verify redirect URI matches in both Google Console and Supabase
- Deep link not working → Ensure `app.json` has correct `scheme` configured

### 7. Test Session Persistence

**Steps:**
1. Sign in successfully
2. Force quit the app (swipe up on iOS, back button on Android)
3. Reopen the app

**Expected Results:**
- ✅ Session restored from AsyncStorage
- ✅ User automatically logged in (no redirect to login)
- ✅ App loads directly to `/(tabs)`
- ✅ User data loaded in AuthContext

**Common Errors:**
- Always redirects to login → Check AsyncStorage permissions
- Session expired → Token may have expired, try signing in again

### 8. Test Auth Protection

**Steps:**
1. While logged in, try navigating to `/auth/login` manually
2. Should automatically redirect to `/(tabs)`

**Expected Results:**
- ✅ Cannot access auth screens while authenticated
- ✅ Auth protection works in both directions

### 9. Test Error Handling

**Invalid Email Format:**
1. Try signing up with invalid email: `notanemail`
2. Should show validation error

**Short Password:**
1. Try signing up with password: `12345`
2. Should show "Password must be at least 6 characters"

**Mismatched Passwords:**
1. Enter password: `password123`
2. Enter confirm: `password456`
3. Should show "Passwords do not match"

**Empty Fields:**
1. Try signing in with empty email/password
2. Should show "Please fill in all fields"

### 10. Verify Database Records

After completing signup and onboarding, verify data in Supabase:

**Check auth.users table:**
```sql
SELECT id, email, created_at
FROM auth.users
WHERE email = 'test@loopapp.com';
```

**Check public.users table:**
```sql
SELECT id, email, name, interests, home_address, work_address, created_at
FROM users
WHERE email = 'test@loopapp.com';
```

**Expected Results:**
- ✅ User exists in both `auth.users` and `public.users`
- ✅ IDs match between tables
- ✅ Name, interests, and addresses populated
- ✅ Timestamps set correctly

---

## Debugging Tips

### Enable Supabase Debug Logging

In `lib/supabase.ts`, you can enable debug logging:

```typescript
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    debug: true, // Add this line
  },
});
```

### View AsyncStorage Contents

In React Native Debugger or Chrome DevTools:

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// View all keys
AsyncStorage.getAllKeys().then(keys => console.log('AsyncStorage keys:', keys));

// View auth session
AsyncStorage.getItem('supabase.auth.token').then(token => console.log('Session:', token));

// Clear all (for testing)
AsyncStorage.clear();
```

### Check Network Requests

In Expo DevTools:
1. Press `m` in terminal to open DevTools
2. Navigate to "Network" tab
3. Watch for requests to `*.supabase.co`
4. Check for 401 (unauthorized) or 403 (forbidden) errors

### Common Issues

**Issue: "Network request failed"**
- Check internet connection
- Verify `EXPO_PUBLIC_SUPABASE_URL` is correct
- Ensure Supabase project is not paused (free tier pauses after 1 week inactivity)

**Issue: "Row Level Security policy violation"**
- Check RLS policies in Supabase dashboard
- Ensure policies allow authenticated users to read/write their own data
- Verify user is authenticated when making request

**Issue: "User profile not found"**
- Check if `002_auth_trigger.sql` migration was run
- Verify trigger is working: manually insert test user and check if profile created
- Check Supabase logs for errors

**Issue: App crashes on startup**
- Check console for errors
- Verify all dependencies installed correctly
- Try clearing Metro bundler cache: `npm start -- --reset-cache`

---

## Success Criteria

Authentication flow is working correctly if:

✅ Users can sign up with email/password
✅ Users can sign in with existing credentials
✅ Users can sign in with Google OAuth (if configured)
✅ Onboarding flow collects name, interests, and locations
✅ User profile saved correctly in database
✅ Session persists after app restart
✅ Users cannot access main app without authentication
✅ Users cannot access auth screens when logged in
✅ Sign out works and redirects to login
✅ All errors handled gracefully with user-friendly messages

---

## Next Steps (Day 3)

Once authentication is working:

1. ✅ Create Profile Settings screen
2. ✅ Add ability to edit profile information
3. ✅ Add calendar integration (Google Calendar, Apple Calendar)
4. ✅ Start building activity discovery (Google Places API)
5. ✅ Build recommendation engine MVP

---

## Troubleshooting Contacts

- **Supabase Support**: support@supabase.com
- **Expo Support**: https://expo.dev/support
- **GitHub Issues**: https://github.com/your-username/loop-app/issues
