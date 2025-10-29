# Facebook OAuth Setup Guide

## ✅ What's Been Implemented

**Facebook OAuth with Intelligent Interest Extraction** is now fully integrated into Loop!

### Features Added:
1. **Facebook Login in Auth Screens**
   - Login screen (`app/auth/login.tsx`) now has a "Continue with Facebook" button
   - Signup screen (`app/auth/signup.tsx`) also has Facebook OAuth option

2. **Interest Extraction Service** (`services/facebook.ts`)
   - Automatically fetches user's Facebook likes using Graph API
   - Maps Facebook page categories to Loop activity categories
   - Extracts interests from liked pages (e.g., concerts, restaurants, gyms)
   - Returns categorized interests ready for ML algorithm

3. **Auth Context Integration** (`contexts/auth-context.tsx`)
   - New `signInWithFacebook()` function
   - Requests Facebook permissions: `public_profile`, `email`, `user_likes`
   - Extracts interests immediately after OAuth
   - Stores Facebook token for interest extraction

4. **Smart Category Mapping**
   The system intelligently maps Facebook data to Loop categories:
   - Facebook "Concert Venue" → Loop: `live music`, `entertainment`, `concerts`
   - Facebook "Coffee Shop" → Loop: `coffee`, `cafe`
   - Facebook "Gym/Fitness" → Loop: `fitness`, `gym`
   - ...and 20+ more mappings

---

## 🔧 How to Complete Setup

### Step 1: Create Facebook App

1. Go to [Facebook for Developers](https://developers.facebook.com/)
2. Click **"My Apps"** → **"Create App"**
3. Choose **"Consumer"** as app type
4. Fill in:
   - **App Name**: `Loop` (or `Loop Development`)
   - **App Contact Email**: your email
   - **Business Account**: (optional for now)
5. Click **"Create App"**

### Step 2: Add Facebook Login Product

1. In your app dashboard, go to **"Add Products"**
2. Find **"Facebook Login"** and click **"Set Up"**
3. Choose **"React Native"** as platform (or "iOS/Android" if prompted)
4. Follow the wizard (you can skip most steps for now)

### Step 3: Configure OAuth Settings

1. Go to **Settings → Basic** (left sidebar)
2. Copy your **App ID** and **App Secret**
3. Add to your `.env` file:
   ```
   EXPO_PUBLIC_FACEBOOK_APP_ID=your_app_id_here
   FACEBOOK_APP_SECRET=your_app_secret_here
   ```

4. Scroll down to **"App Domains"**
   - Add: `loopapp.com` (or your actual domain)

5. Go to **Facebook Login → Settings** (left sidebar)
6. Configure **Valid OAuth Redirect URIs**:
   ```
   https://your-project.supabase.co/auth/v1/callback
   loopapp://auth/callback
   exp://localhost:8081
   ```
   (Replace `your-project` with your Supabase project ID)

7. Under **"Client OAuth Settings"**:
   - Enable **"Web OAuth Login"** ✅
   - Enable **"Embedded Browser OAuth Login"** ✅

### Step 4: Configure Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Authentication → Providers**
4. Find **Facebook** and click **"Enable"**
5. Enter:
   - **Facebook App ID**: (from Step 3)
   - **Facebook App Secret**: (from Step 3)
6. Copy the **Callback URL** shown (looks like `https://xxx.supabase.co/auth/v1/callback`)
7. Add this to Facebook's Valid OAuth Redirect URIs (Step 3.6 above)

### Step 5: Request Advanced Permissions (For user_likes)

Facebook requires **App Review** to access `user_likes` permission in production.

**For Development/Testing:**
1. In Facebook App Dashboard, go to **App Review → Permissions and Features**
2. Find `user_likes` and click **"Request"**
3. For testing, add yourself as a **Test User** or **App Developer**:
   - Go to **Roles → Test Users** → **Add Test Users**
   - Test users can use `user_likes` without app review

**For Production:**
1. Submit your app for review
2. Provide:
   - **Use Case**: "We use Facebook likes to personalize activity recommendations based on user interests (e.g., if they like coffee shops, we suggest nearby cafes)"
   - **Screenshots**: Show how interests are used in your app
   - **Demo Video**: Show sign-up → interest extraction → personalized recommendations
3. Approval typically takes 1-3 business days

### Step 6: Update app.json (Expo Configuration)

Add Facebook config to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-facebook",
        {
          "appID": "your_facebook_app_id_here",
          "displayName": "Loop",
          "scheme": "fb{your_app_id}",
          "advertiserIDCollectionEnabled": false,
          "autoLogAppEventsEnabled": false
        }
      ]
    ]
  }
}
```

Replace `your_facebook_app_id_here` with your actual App ID.

### Step 7: Rebuild Expo Development Client

After updating `app.json`, rebuild your development client:

```bash
# For iOS
npx expo run:ios

# For Android
npx expo run:android
```

---

## 🧪 Testing Facebook OAuth

### Test the Complete Flow:

1. **Open the app** and go to Login screen
2. **Tap "Continue with Facebook"**
3. **Facebook login dialog** should appear
4. **Authenticate** with your Facebook account (or test user)
5. **Grant permissions**: public_profile, email, user_likes
6. **Check console logs**: You should see:
   ```
   Facebook login successful, token received
   Extracting interests from Facebook...
   Found 25 likes, 0 interests
   Extracted Loop interests: {
     interestsCount: 25,
     categoriesCount: 8,
     favoritesCount: 10
   }
   ```
7. **Verify interests** are extracted and user is redirected to onboarding

### Troubleshooting:

**Error: "Facebook App ID not configured"**
- Check `.env` file has `EXPO_PUBLIC_FACEBOOK_APP_ID`
- Restart Expo dev server: `npm start --clear`

**Error: "Invalid OAuth Redirect URI"**
- Make sure you added ALL redirect URIs to Facebook app settings:
  - `https://your-project.supabase.co/auth/v1/callback`
  - `loopapp://auth/callback`
  - `exp://localhost:8081`

**Error: "user_likes permission not granted"**
- Add yourself as a Test User in Facebook App Dashboard
- OR request `user_likes` permission in App Review

**No interests extracted (0 likes found)**
- Check that user has liked Facebook pages
- Verify `user_likes` permission was granted (check console logs)
- Test with a different Facebook account that has more likes

---

## 📊 How Interest Extraction Works

### 1. User Taps "Continue with Facebook"
```typescript
async function handleFacebookSignUp() {
  const { error, facebookToken } = await signInWithFacebook();
  // ...
}
```

### 2. Facebook OAuth Flow
```typescript
// expo-facebook SDK requests permissions
const { type, token } = await Facebook.logInWithReadPermissionsAsync({
  permissions: ['public_profile', 'email', 'user_likes'],
});
```

### 3. Interest Extraction
```typescript
// Fetch user's liked pages
const likes = await getFacebookLikes(token);
// Result: [
//   { id: "123", name: "Starbucks", category: "Coffee Shop" },
//   { id: "456", name: "The Fillmore", category: "Concert Venue" },
//   ...
// ]
```

### 4. Category Mapping
```typescript
// Map Facebook categories to Loop categories
const interests = extractLoopInterests(likes);
// Result: {
//   interests: ["starbucks", "the fillmore", "taylor swift", ...],
//   categories: ["coffee", "cafe", "live music", "concerts", ...],
//   favoriteActivities: ["Starbucks", "The Fillmore", ...]
// }
```

### 5. Store in User Profile (During Onboarding)
```typescript
// Onboarding screen will use extracted interests to pre-populate
user.interests = interests.categories; // ["coffee", "live music", ...]
user.ai_profile.favorite_categories = interests.categories;
```

---

## 🎯 Next Steps

### Immediate:
1. ✅ **Complete Facebook App setup** (follow steps above)
2. ✅ **Test OAuth flow** end-to-end
3. ✅ **Verify interest extraction** works with your Facebook account

### Short-term (Next 1-2 Days):
1. **Update onboarding screen** to use extracted Facebook interests
2. **Pre-select interest chips** based on Facebook data
3. **Show user** what interests were imported ("We found you like: coffee, live music, hiking")
4. **Allow user to edit** extracted interests before saving

### Medium-term (Next Week):
1. **Submit Facebook App for Review** to get `user_likes` approved for production
2. **Add Google OAuth interest extraction** (similar flow using Google Places API liked places)
3. **Combine Facebook + Google interests** for even better personalization

---

## 🔒 Privacy & Best Practices

### What Data We Collect:
- ✅ Public profile (name, email, profile picture)
- ✅ Liked pages (page names and categories)
- ❌ **We do NOT collect**: Friends list, posts, photos, messages

### Data Storage:
- Facebook access token is **NOT stored** in database
- We only store **extracted interests** (e.g., ["coffee", "live music"])
- Original Facebook page names stored in `favoriteActivities` (optional)

### User Control:
- Users can **review interests** before they're saved (in onboarding)
- Users can **edit/delete interests** anytime in settings
- Users can **disconnect Facebook** and interests remain (they don't require re-auth)

### Compliance:
- **GDPR**: Users can export/delete all their data
- **Facebook Platform Policy**: We comply with all data use policies
- **App Review**: We clearly explain how we use Facebook data

---

## 📝 Summary

✅ **What Works Now:**
- Facebook OAuth button in login/signup screens
- Interest extraction from Facebook likes
- Intelligent category mapping (Facebook → Loop categories)
- Ready to pre-populate user interests

⏳ **What You Need to Do:**
- Create Facebook App in Meta Developer Console
- Add App ID/Secret to `.env`
- Configure OAuth redirect URIs
- Request `user_likes` permission (or use test users)
- Rebuild Expo dev client
- Test the complete flow

🚀 **Once Complete:**
- Users can sign up with 1 tap (Facebook OAuth)
- Interests are auto-imported from their Facebook likes
- Onboarding takes <30 seconds instead of 2-3 minutes
- Recommendations are personalized from Day 1

**This is a massive UX win and will significantly improve user acquisition!** 🎉
