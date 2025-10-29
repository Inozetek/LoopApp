# Google Places API Setup Guide

**Status:** Code is ready! Just need to add your API key ✅
**Time Required:** 10-15 minutes
**Cost:** FREE (Google gives $200/month credit, enough for ~40,000 requests)

---

## 🎯 What This Unlocks

Once configured, your app will:
- ✅ Show **real nearby activities** instead of mock data
- ✅ Display actual restaurants, cafes, bars, events near user
- ✅ Pull real photos, ratings, reviews from Google
- ✅ Calculate accurate distances
- ✅ Show real opening hours, phone numbers, addresses

**The code is already built and waiting for your API key!** 🚀

---

## 📋 Step-by-Step Setup

### Step 1: Create Google Cloud Project (2 minutes)

1. Go to **[Google Cloud Console](https://console.cloud.google.com/)**
2. Sign in with your Google account
3. Click **"Select a project"** at the top
4. Click **"New Project"**
5. Name it: **"Loop App"**
6. Click **"Create"**

**Screenshot Location:** Top navigation bar → "Select a project" → "New Project"

---

### Step 2: Enable Places API (1 minute)

1. In the Google Cloud Console, go to **[APIs & Services > Library](https://console.cloud.google.com/apis/library)**
2. Search for: **"Places API"**
3. Click on **"Places API"** (the main one, not "Places API (New)")
4. Click **"Enable"** button
5. Wait ~10 seconds for it to activate

**Direct Link:** https://console.cloud.google.com/apis/library/places-backend.googleapis.com

---

### Step 3: Create API Key (2 minutes)

1. Go to **[APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)**
2. Click **"+ Create Credentials"** at the top
3. Select **"API Key"**
4. Your key will be generated (looks like: `AIzaSyD...`)
5. Click **"Restrict Key"** (IMPORTANT for security)

**Direct Link:** https://console.cloud.google.com/apis/credentials

---

### Step 4: Restrict API Key (CRITICAL - 3 minutes)

**Why:** Unrestricted keys can be stolen and rack up huge bills. Always restrict!

1. After creating the key, you'll see the "Restrict Key" screen
2. **API Restrictions:**
   - Select **"Restrict key"**
   - Check **"Places API"**
   - Click **"Save"**

3. **Application Restrictions (Optional but Recommended):**
   - For development: Select **"None"** (we'll restrict later)
   - For production: Select **"HTTP referrers"** or **"iOS/Android apps"**

**IMPORTANT:** For now, just restrict to "Places API" only. We can add app restrictions later.

---

### Step 5: Copy Your API Key

1. Go back to **[Credentials](https://console.cloud.google.com/apis/credentials)**
2. Find your API key in the list
3. Click the **"Copy"** icon (📋) next to the key
4. Save it somewhere temporarily (you'll paste it in the next step)

**Your key looks like:** `AIzaSyDnFm_xxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

### Step 6: Add Key to Your App (2 minutes)

**Option A: Using .env file (Recommended)**

1. In your Loop app folder, create a file named `.env`
   ```
   Location: C:\Users\nick_\LoopApp\.env
   ```

2. Add this line (replace with your actual key):
   ```
   EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSyDnFm_your_actual_key_here
   ```

3. Save the file

4. **IMPORTANT:** Make sure `.env` is in your `.gitignore` so you don't commit your key!

**Option B: Using app.json (Not Recommended - Less Secure)**

1. Open `app.json`
2. Add to the `extra` section:
   ```json
   {
     "expo": {
       "extra": {
         "googlePlacesApiKey": "AIzaSyDnFm_your_actual_key_here"
       }
     }
   }
   ```

**⚠️ WARNING:** Don't commit `app.json` with your API key! Use `.env` instead.

---

### Step 7: Restart Your App (1 minute)

**Stop your current Expo server:**
- Press `Ctrl+C` in the terminal where `npm start` is running

**Clear cache and restart:**
```bash
npx expo start --clear
```

**You should see in the console:**
```
✅ Google Places API key detected!
```

If you see:
```
📍 Using mock activity data (Google Places API key not configured)
```
Then the key wasn't loaded. Double-check your `.env` file.

---

## ✅ Testing Your Setup

### Test 1: Check Console Logs

1. Start the app: `npx expo start`
2. Open the app on your device/simulator
3. Go to the "For You" tab
4. Pull down to refresh
5. Check the terminal/console

**Expected Output:**
```
✅ Fetching real activities from Google Places API
📍 Found 20 activities near you
```

**If you see mock data message:**
- API key not configured correctly
- Check `.env` file exists
- Check key format (starts with `AIzaSy`)
- Restart with `--clear` flag

---

### Test 2: See Real Activities

1. Open the "For You" tab
2. Pull down to refresh
3. You should now see **real businesses** near Dallas (or your configured location)

**What to expect:**
- Different activity names (real business names from Google)
- Real photos from Google Places
- Real ratings and review counts
- Real addresses
- Real phone numbers (if available)

**Debug Tips:**
- If you see the same 25 activities (Blue Bottle Coffee, State Bird, etc.) → Still using mock data
- If you see errors → Check API key is enabled and restricted correctly
- If you see 0 activities → Location might be in the ocean or middle of nowhere (check coordinates)

---

### Test 3: Verify API Calls

1. Open **[Google Cloud Console > APIs & Services > Dashboard](https://console.cloud.google.com/apis/dashboard)**
2. Click on **"Places API"**
3. Check the **"Metrics"** tab
4. You should see API requests being logged

**Expected:**
- 1-5 requests per app refresh
- Requests should spike when you pull-to-refresh

**If you see 0 requests:**
- API key might not be configured
- App is still using mock data

---

## 💰 Cost & Free Tier

**Google Places API Pricing:**
- **FREE Tier:** $200 credit per month (renews automatically)
- **Nearby Search:** $0.032 per request
- **With $200 credit:** ~6,250 free requests per month
- **For MVP:** ~40,000 requests (way more than enough!)

**Estimated Usage for Loop:**
- Average user: ~20 requests per day
- 100 users: 2,000 requests/day = 60,000/month
- **Cost with free tier:** $0 (under the $200 credit limit)

**You won't pay anything for MVP testing! 🎉**

---

## 🔐 Security Best Practices

### DO:
- ✅ Store API key in `.env` file
- ✅ Add `.env` to `.gitignore`
- ✅ Restrict API key to "Places API" only
- ✅ Set up billing alerts in Google Cloud (optional)
- ✅ Rotate key if ever exposed publicly

### DON'T:
- ❌ Commit API key to GitHub
- ❌ Share API key publicly
- ❌ Leave key unrestricted
- ❌ Hardcode key in source code
- ❌ Forget to add `.gitignore` entry

**Check your `.gitignore` has:**
```
.env
.env.local
*.env
```

---

## 🐛 Troubleshooting

### "API key not configured" in console

**Cause:** `.env` file not found or key not exported

**Fix:**
1. Check `.env` exists in project root
2. Check key starts with `EXPO_PUBLIC_`
3. Restart with `npx expo start --clear`
4. Check no typos in variable name

---

### "Places API has not been used in project"

**Cause:** Places API not enabled for your project

**Fix:**
1. Go to [API Library](https://console.cloud.google.com/apis/library)
2. Search "Places API"
3. Click "Enable"
4. Wait 2 minutes for propagation

---

### "API key invalid"

**Cause:** Key was copied incorrectly or revoked

**Fix:**
1. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
2. Delete old key
3. Create new key
4. Copy carefully (no spaces)
5. Update `.env` file

---

### "This API key is not authorized to use this service"

**Cause:** API key is restricted to wrong APIs

**Fix:**
1. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your API key
3. Under "API restrictions", select "Restrict key"
4. Check "Places API"
5. Save

---

### Still seeing mock data

**Checklist:**
- [ ] `.env` file exists in root
- [ ] Key starts with `EXPO_PUBLIC_`
- [ ] No quotes around the key in `.env`
- [ ] Restarted app with `--clear` flag
- [ ] Places API is enabled in Google Cloud
- [ ] API key is not restricted by IP (for now)

**Debug command:**
```bash
# Print environment variables (check if key is loaded)
npx expo start
# Then in the console, look for logs about API key
```

---

## 📝 Environment File Example

**File:** `.env`
**Location:** `C:\Users\nick_\LoopApp\.env`

```bash
# Google Places API Key
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSyDnFm_your_actual_key_here

# Future: Add other API keys here
# EXPO_PUBLIC_OPENAI_API_KEY=sk-...
# EXPO_PUBLIC_SUPABASE_URL=https://...
# EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**IMPORTANT:**
- Variables must start with `EXPO_PUBLIC_` to be available in Expo
- No quotes needed around values
- No spaces around `=` sign
- File must be named exactly `.env` (not `env.txt` or `.env.local`)

---

## 🎉 Success Checklist

You'll know it's working when:
- [ ] Console shows "Fetching real activities from Google Places API"
- [ ] "For You" tab shows different activities each time
- [ ] Activity names are real businesses (not "Blue Bottle Coffee", etc.)
- [ ] Photos change (real Google photos)
- [ ] Ratings and reviews are real
- [ ] Google Cloud Console shows API requests in Metrics

---

## 📊 What Happens Next

**After API is configured:**
1. App will call Google Places API instead of using mock data
2. You'll see real businesses near the configured location (Dallas by default)
3. When you add location services (Step D), it will use your actual GPS location
4. Recommendations will be personalized based on real nearby places

**Current Flow:**
```
User opens "For You" tab
  ↓
App checks if API key exists
  ↓ YES
Call Google Places API with location
  ↓
Get 20 real nearby places
  ↓
Convert to Activity format
  ↓
Show in feed with real photos/ratings
  ↓ NO (no API key)
Return mock data (25 hardcoded activities)
```

---

## 🚀 Ready to Test!

**Once you've added your API key:**

1. Run: `npx expo start --clear`
2. Open app on your device
3. Go to "For You" tab
4. Pull down to refresh
5. You should see REAL nearby places! 🎉

**Let me know when you've:**
- ✅ Created your API key
- ✅ Added it to `.env` file
- ✅ Restarted the app
- ✅ Seeing real data (or encountering issues)

---

**Next Steps After This Works:**
- ✅ **Option C:** Polish & bug fixes
- ✅ **Option D:** Location services (GPS permissions)
- ✅ **Option C:** Polish again
- ✅ **Option D:** Enhanced location features
- ✅ **Option B:** Group planning
- ✅ **Option C:** Final polish

---

*Setup Guide Created: October 19, 2025*
*Estimated Time: 10-15 minutes*
*Cost: FREE (with $200/month credit)*
