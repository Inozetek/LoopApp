# 🚀 Loop App Setup Instructions

**Time Required:** 10-15 minutes
**Difficulty:** Easy (just copy/paste)

---

## Step 1: Set Up Supabase (REQUIRED - 5 minutes)

Supabase provides your database and authentication. **You must do this step.**

### 1.1 Create Supabase Account
1. Go to: https://supabase.com
2. Click **"Start your project"**
3. Sign up with GitHub (easiest) or email
4. Verify your email if needed

### 1.2 Create a New Project
1. Click **"New Project"**
2. Fill in:
   - **Name:** `Loop` (or whatever you want)
   - **Database Password:** Create a strong password (SAVE THIS!)
   - **Region:** Choose closest to you (e.g., US West, US East)
   - **Pricing Plan:** Select **"Free"** ($0/month)
3. Click **"Create new project"**
4. Wait 2-3 minutes for project to provision (grab a coffee ☕)

### 1.3 Get Your API Credentials
Once your project is ready:

1. In the Supabase dashboard, click **"Settings"** (gear icon in left sidebar)
2. Click **"API"** in the Settings menu
3. You'll see two things you need:

   **Project URL:**
   ```
   Example: https://abcdefghijklmnop.supabase.co
   ```

   **anon/public key:**
   ```
   Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZi...
   (This will be VERY long - like 200+ characters)
   ```

4. **Keep this tab open** - you'll need these in Step 2

### 1.4 Set Up Database Tables
The app needs database tables to store users, activities, friends, etc.

**Option A: Manual Setup (Recommended for learning)**
1. In Supabase dashboard, click **"SQL Editor"** (left sidebar)
2. Click **"New query"**
3. Copy the entire contents of `database/schema.sql` from your Loop project
4. Paste into the SQL editor
5. Click **"Run"** (or press Ctrl+Enter)
6. You should see "Success. No rows returned" - that's good! ✅

**Option B: Quick Setup (If schema.sql exists)**
If you have `database/schema.sql` file in your project, just run it in the SQL Editor.

**Don't have schema.sql yet?** That's okay! I can create it for you if needed.

---

## Step 2: Configure Your Local Environment (REQUIRED - 2 minutes)

Now let's tell your app how to connect to Supabase.

### 2.1 Create Your .env File
Open your terminal in the Loop project folder and run:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Mac/Linux
cp .env.example .env
```

**OR** just manually:
1. Find `.env.example` file in your project folder
2. Copy it
3. Rename the copy to `.env` (remove the ".example")

### 2.2 Add Your Supabase Credentials
Open the new `.env` file in VS Code or any text editor.

Replace these two lines:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

With your actual values from Step 1.3:
```env
EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZi...
```

**Important:**
- Remove the quotes `""` if you added them
- Make sure there are no extra spaces
- The anon key should be ONE long line

### 2.3 Save the File
Save `.env` - you're done with required setup! ✅

---

## Step 3: Get Google Places API Key (OPTIONAL - 5 minutes)

**Do you need this?** NO! The app works with **mock data** without it.

**Why get it?** To see REAL nearby restaurants, activities, etc. instead of fake data.

### 3.1 Enable Google Places API
1. Go to: https://console.cloud.google.com/
2. Sign in with your Google account
3. Create a new project:
   - Click project dropdown (top left)
   - Click **"New Project"**
   - Name: `Loop App`
   - Click **"Create"**

### 3.2 Enable Places API
1. In the Google Cloud Console, go to **"APIs & Services" → "Library"**
2. Search for **"Places API"**
3. Click **"Places API (New)"**
4. Click **"Enable"**

### 3.3 Create API Key
1. Go to **"APIs & Services" → "Credentials"**
2. Click **"Create Credentials" → "API Key"**
3. Copy the API key (looks like: `AIzaSyC9X...`)
4. Click **"Restrict Key"** (recommended for security)
   - Under "API restrictions", select **"Restrict key"**
   - Choose **"Places API"**
   - Click **"Save"**

### 3.4 Add to .env File
Open your `.env` file again and replace:
```env
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_key_here
```

With your actual key:
```env
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSyC9X...
```

Save the file.

---

## Step 4: Install Dependencies & Run (REQUIRED - 2 minutes)

### 4.1 Install Node Modules
Open terminal in your Loop project folder:

```bash
npm install
```

Wait for it to finish (30 seconds - 2 minutes depending on internet speed).

### 4.2 Start the App
```bash
npm start
```

You should see:
```
› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
```

### 4.3 Run on Your Device/Simulator

**Option A: Physical Phone (Easiest)**
1. Install **Expo Go** app from App Store (iOS) or Play Store (Android)
2. Open Expo Go
3. Scan the QR code from your terminal
4. App loads on your phone! 🎉

**Option B: iOS Simulator (Mac only)**
```bash
npm run ios
```

**Option C: Android Emulator**
1. Make sure Android Studio is installed
2. Start an emulator from Android Studio
3. Run:
```bash
npm run android
```

**Option D: Web Browser**
```bash
npm run web
```
(Works but some features like haptics won't work)

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] App starts without errors
- [ ] You can navigate to Sign Up screen
- [ ] When you sign up, you see config validation messages in terminal
- [ ] No error about "SUPABASE_URL is not set"
- [ ] You can create an account
- [ ] You see the onboarding screen (select interests)

---

## 🚨 Common Issues & Solutions

### "EXPO_PUBLIC_SUPABASE_URL is not set"
**Fix:** Make sure your `.env` file exists and has the correct values (no quotes, no extra spaces)

**Verify:** Run this in terminal:
```bash
# Windows
type .env

# Mac/Linux
cat .env
```

You should see your actual credentials, not `your-project.supabase.co`

### "Metro bundler failed to start"
**Fix:** Delete node_modules and reinstall:
```bash
rm -rf node_modules
npm install
```

### "Unable to resolve module"
**Fix:** Clear Metro cache:
```bash
npm start -- --reset-cache
```

### App crashes on startup
**Fix:** Check terminal for error messages. Most likely:
1. Missing `.env` file
2. Wrong Supabase credentials
3. Database tables not created

### Google Places returns no results
**Fix:** This is normal if you didn't add the API key. The app will show mock data instead. That's fine for testing!

---

## 📱 What to Test After Setup

Once the app is running, test these flows:

### 1. Sign Up Flow
1. Click **"Sign Up"**
2. Enter email and password
3. Click **"Sign Up"**
4. Should show Onboarding screen ✅

### 2. Onboarding
1. Select 3+ interests
2. Tap **"Continue"**
3. Grant location permission (or skip)
4. Should land on Feed screen ✅

### 3. Feed Screen
1. Pull down to refresh
2. Should see activity cards (mock data or real if you added API key)
3. Tap heart icon on a card
4. Should see success animation ✅

### 4. Calendar Screen
1. Swipe to Calendar tab (or tap calendar icon)
2. Tap **"+"** button
3. Fill in task details
4. Should show skeleton loaders when loading ✅

### 5. Friends Screen
1. Swipe to Friends tab
2. Should see skeleton loaders while loading
3. Tap **"+"** to add friend
4. Try searching for an email (won't find anyone yet, that's okay) ✅

---

## 🎉 You're All Set!

If you can:
- ✅ Sign up with email
- ✅ See the onboarding screen
- ✅ See the feed with activity cards
- ✅ Navigate between tabs

**Congratulations! Loop is running!** 🚀

---

## 🆘 Still Having Issues?

If you're stuck, check:
1. Terminal output for error messages
2. `.env` file has correct values
3. Supabase project is running (check dashboard)
4. Database tables were created successfully

**Need more help?** Share the error message and I'll help debug!

---

## 📚 What's Next?

Once the app is running:
1. Test all features (use the testing checklist above)
2. Try adding a friend (you'll need two accounts)
3. Customize interests in onboarding
4. Try adding activities to calendar
5. Give feedback on activities you've completed

**Want to deploy?** Check `PRODUCTION_READINESS_CHECKLIST.md` (coming soon!)

---

*Last updated: October 21, 2025*
