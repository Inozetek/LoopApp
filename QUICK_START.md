# ⚡ Loop Quick Start (5 Minutes)

## What You Need to Do

### ✅ REQUIRED (Must do this)
1. Create Supabase account
2. Get Supabase credentials
3. Create database tables
4. Copy credentials to .env file

### 🎯 OPTIONAL (Can skip for now)
- Google Places API key (app works with mock data without it)

---

## Step-by-Step

### 1. Supabase Setup (5 min)

**Create Account:**
```
1. Go to: https://supabase.com
2. Sign up with GitHub or email
3. Click "New Project"
4. Name: "Loop"
5. Choose "Free" plan
6. Wait 2-3 minutes
```

**Get Credentials:**
```
1. Click Settings → API
2. Copy these two things:
   - Project URL (looks like: https://abc...xyz.supabase.co)
   - anon public key (long ~200 character string)
3. Keep tab open
```

**Create Database Tables:**
```
1. In Supabase, click "SQL Editor" (left sidebar)
2. Click "New query"
3. Copy ALL of database/schema.sql from your project
4. Paste into editor
5. Click "Run" (or Ctrl+Enter)
6. Should see "Success" ✅
```

### 2. Configure .env File (2 min)

**Create .env file:**
```bash
# Windows PowerShell
Copy-Item .env.example .env

# Mac/Linux
cp .env.example .env
```

**Edit .env file:**
Open `.env` and replace:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

With your ACTUAL values from Step 1:
```env
EXPO_PUBLIC_SUPABASE_URL=https://abcdefg.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5c...
```

**Save the file.**

### 3. Run the App (2 min)

```bash
# Install dependencies (first time only)
npm install

# Start the app
npm start

# Then press:
# - 'i' for iOS simulator (Mac only)
# - 'a' for Android emulator
# - 'w' for web browser
# - Or scan QR code with Expo Go app on your phone
```

---

## ✅ Verification

You'll know it worked if:
- No error about "SUPABASE_URL is not set"
- You can sign up with email
- You see the onboarding screen
- You can select interests
- You land on the feed screen

---

## 🚨 If Something Goes Wrong

**"SUPABASE_URL is not set"**
→ Check your `.env` file exists and has real values (not "your-project...")

**"Failed to run query"**
→ Make sure you copied the ENTIRE schema.sql file (all ~400 lines)

**App won't start**
→ Try: `npm start -- --reset-cache`

**"Cannot find module"**
→ Delete `node_modules` and run `npm install` again

---

## 📱 What to Test

Once running:
1. ✅ Sign up with email
2. ✅ Select 3+ interests
3. ✅ See the feed with activity cards
4. ✅ Tap calendar tab
5. ✅ Tap friends tab
6. ✅ Try adding a task to calendar

---

## 🎯 That's It!

**Time:** ~10 minutes total
**Cost:** $0 (everything is free tier)
**Result:** Fully working Loop app!

For detailed instructions: See `SETUP_INSTRUCTIONS.md`
For troubleshooting: See the Common Issues section in SETUP_INSTRUCTIONS.md

---

*Ready to test! 🚀*
