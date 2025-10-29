# Google Places API Setup Guide

## Get Your API Key (5 minutes)

### Step 1: Go to Google Cloud Console
Visit: https://console.cloud.google.com/

### Step 2: Create/Select Project
- Click "Select a project" → "New Project"
- Name: "Loop App"
- Click "Create"

### Step 3: Enable Places API
- Go to "APIs & Services" → "Library"
- Search for "Places API"
- Click "Places API (New)"
- Click "Enable"

### Step 4: Create API Key
- Go to "APIs & Services" → "Credentials"
- Click "Create Credentials" → "API Key"
- Copy the key

### Step 5: Restrict the Key (Important for Security)
- Click "Edit API key"
- Under "API restrictions":
  - Select "Restrict key"
  - Check "Places API"
- Under "Application restrictions":
  - Select "HTTP referrers (web sites)"
  - Add: `localhost:*/*`
  - Add: `*.expo.dev/*`
- Click "Save"

### Step 6: Add to Your App
Open `.env.local` and replace:
```
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_key_here
```

With your actual key:
```
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSyC_YOUR_ACTUAL_KEY_HERE
```

### Step 7: Restart the App
```bash
npm start -- --reset-cache
```

## ✅ How to Verify It Works

1. Open the "For You" tab
2. Pull to refresh
3. Check console - should say:
   - ❌ Old: "Using mock activity data"
   - ✅ New: Real Google Places results

## 💰 Pricing

**Free Tier:**
- $200 credit per month
- ~6,000 free requests/month
- Perfect for MVP testing

**After Free Tier:**
- $0.017 per request
- Still very affordable!

## 🔒 Security Note

**DO NOT** commit your API key to GitHub!
- `.env.local` is in `.gitignore`
- Keep your key secret
- Use restrictions to prevent abuse
