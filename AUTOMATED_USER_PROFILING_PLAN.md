# Automated User Profiling Implementation Plan

**Goal:** Minimize manual data entry by importing user interests, preferences, and history from Facebook, Google, and calendar platforms.

**Use Case Example:**
> User likes "Brad Pitt" on Facebook → Loop recommends movies starring Brad Pitt during their free time

**Last Updated:** 2025-12-22

---

## 🎯 Strategic Vision

### Current State (Manual Entry - Bad UX)
- User signs up with email/password
- Must manually select 5-10 interests during onboarding
- No context about user's preferences, favorite places, or past activities
- Cold start problem: Algorithm has no data to work with
- **Result:** Poor recommendations for first 2-3 weeks

### Future State (Automated - Great UX)
- User signs up with Facebook or Google (1 tap)
- Loop automatically imports:
  - **Facebook:** Liked pages (actors, musicians, sports teams, brands)
  - **Google:** Places history, saved places, reviews, timeline data
  - **Calendar:** Recurring events, free time patterns, typical schedule
- Algorithm starts with rich user profile on Day 1
- **Result:** Highly personalized recommendations from first session

---

## 📋 Feature Breakdown

### Feature 1: Facebook OAuth + Interest Import

**What We'll Import:**
1. **User's Liked Pages** (actors, musicians, sports teams, brands)
2. **User's Interests** (hobbies, activities listed on profile)
3. **User's Events** (concerts, sports games, festivals they've attended/interested in)

**Example User Profile:**
```json
{
  "liked_pages": [
    { "id": "123", "name": "Brad Pitt", "category": "Actor" },
    { "id": "456", "name": "Dallas Mavericks", "category": "Sports Team" },
    { "id": "789", "name": "The Rolling Stones", "category": "Musician/Band" }
  ],
  "interests": [
    { "id": "001", "name": "Live Music" },
    { "id": "002", "name": "Basketball" },
    { "id": "003", "name": "Italian Cuisine" }
  ],
  "events": [
    { "id": "abc", "name": "Mavs vs Lakers", "category": "Sports", "date": "2025-12-15" }
  ]
}
```

**How This Drives Recommendations:**
- User likes "Brad Pitt" → Recommend movies starring Brad Pitt showing nearby
- User likes "Dallas Mavericks" → Recommend sports bars during game times
- User likes "The Rolling Stones" → Recommend rock concerts, music venues
- User attended "Mavs vs Lakers" → Increase score for sports-related activities

**Facebook Graph API Permissions Needed:**
- `public_profile` (basic info)
- `email` (user's email)
- `user_likes` (pages user has liked) ← **KEY**
- `user_events` (events user has attended/interested in) ← **KEY**

**Implementation Steps:**
1. Set up Facebook App in Meta Developer Portal
2. Configure OAuth redirect URLs
3. Add Facebook SDK to React Native app
4. Implement Facebook Sign-In button
5. Request permissions during sign-in flow
6. Fetch user's liked pages and events via Graph API
7. Map Facebook data to Loop interest categories
8. Store in `users.interests` JSONB field
9. Use in recommendation algorithm scoring

---

### Feature 2: Google OAuth + Places/Timeline Import

**What We'll Import:**
1. **Google Places History** (places user has visited)
2. **Google Maps Saved Places** (favorites, want-to-go lists)
3. **Google Maps Reviews** (places user rated 4-5 stars)
4. **Google Timeline** (location history, frequent places)
5. **Google Calendar Events** (past and future events)

**Example User Data:**
```json
{
  "places_history": [
    { "place_id": "ChIJ...", "name": "Blue Sushi Sake Grill", "visits": 8, "category": "Restaurant" },
    { "place_id": "ChIJ...", "name": "Katy Trail", "visits": 15, "category": "Park" }
  ],
  "saved_places": [
    { "place_id": "ChIJ...", "name": "Reunion Tower", "list": "Want to go" },
    { "place_id": "ChIJ...", "name": "Perot Museum", "list": "Favorites" }
  ],
  "reviews": [
    { "place_id": "ChIJ...", "name": "The Rustic", "rating": 5, "category": "Bar" },
    { "place_id": "ChIJ...", "name": "Dallas Arboretum", "rating": 5, "category": "Garden" }
  ],
  "frequent_locations": [
    { "name": "Work", "location": { "lat": 32.7767, "lng": -96.7970 }, "visits_per_week": 5 },
    { "name": "Gym", "location": { "lat": 32.8000, "lng": -96.8000 }, "visits_per_week": 3 }
  ]
}
```

**How This Drives Recommendations:**
- User visited "Blue Sushi" 8 times → High preference for sushi, Japanese food
- User saved "Reunion Tower" to "Want to go" → Recommend soon (user expressed intent)
- User rated "The Rustic" 5 stars → Recommend similar bars, live music venues
- User goes to gym 3x/week → Recommend fitness activities, healthy cafes

**Google APIs Needed:**
- **Google Places API** (already integrated)
- **Google Maps Timeline API** (location history)
- **Google Calendar API** (events)

**Google OAuth Scopes Needed:**
- `https://www.googleapis.com/auth/userinfo.profile` (basic profile)
- `https://www.googleapis.com/auth/userinfo.email` (email)
- `https://www.googleapis.com/auth/maps.readonly` (places, timeline) ← **NEW**
- `https://www.googleapis.com/auth/calendar.readonly` (calendar events) ← **NEW**

**Implementation Steps:**
1. Update Google OAuth configuration to request new scopes
2. After sign-in, fetch Google Places history via Maps API
3. Fetch saved places and reviews
4. Fetch timeline data (frequent locations)
5. Map Google data to Loop interest categories
6. Infer preferences:
   - Visited 5+ times → Top interest
   - Rated 5 stars → Positive feedback
   - Saved to "Want to go" → High intent
7. Store in `users.ai_profile` JSONB field
8. Use in recommendation algorithm scoring

---

### Feature 3: Calendar Sync During Onboarding

**What We'll Import:**
1. **Google Calendar Events** (work schedule, recurring events)
2. **Apple Calendar Events** (same as Google)
3. **Free Time Detection** (gaps ≥1 hour between busy blocks)

**Example Calendar Data:**
```json
{
  "recurring_events": [
    { "title": "Work", "days": ["Mon", "Tue", "Wed", "Thu", "Fri"], "time": "9am-5pm" },
    { "title": "Yoga Class", "days": ["Tue", "Thu"], "time": "6pm-7pm" }
  ],
  "one_time_events": [
    { "title": "Dentist Appointment", "date": "2025-12-25", "time": "2pm-3pm" }
  ],
  "free_time_blocks": [
    { "day": "Mon", "start": "5pm", "end": "9pm", "duration_hours": 4 },
    { "day": "Sat", "start": "10am", "end": "8pm", "duration_hours": 10 }
  ]
}
```

**How This Drives Recommendations:**
- Detect free time: Monday 5-9pm → Recommend dinner, happy hour, evening activities
- User has Yoga on Tue/Thu → Recommend fitness activities, healthy eating
- Weekend has 10 hours free → Recommend day trips, multi-activity itineraries

**Calendar APIs Needed:**
- **Google Calendar API** (already covered in Feature 2)
- **Apple Calendar** (via iOS Calendar framework)

**Implementation Steps:**
1. During onboarding, prompt: "Sync your calendar?"
2. Show benefits: "We'll find activities during your free time"
3. Request calendar permissions (iOS: Calendar.framework, Android: Calendar Provider)
4. Fetch events for next 30 days
5. Identify recurring patterns (work schedule, gym visits)
6. Calculate free time blocks (gaps ≥1 hour)
7. Store in `calendar_events` table
8. Use free time blocks to trigger proactive recommendations

---

## 🏗️ Technical Architecture

### Database Schema Updates

**Users Table:**
```sql
ALTER TABLE users ADD COLUMN facebook_user_id VARCHAR(255);
ALTER TABLE users ADD COLUMN google_user_id VARCHAR(255);
ALTER TABLE users ADD COLUMN facebook_access_token TEXT;
ALTER TABLE users ADD COLUMN google_access_token TEXT;
ALTER TABLE users ADD COLUMN google_refresh_token TEXT;
ALTER TABLE users ADD COLUMN token_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN imported_interests JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN imported_places JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN calendar_sync_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN calendar_last_synced_at TIMESTAMPTZ;

CREATE INDEX idx_users_facebook_id ON users(facebook_user_id);
CREATE INDEX idx_users_google_id ON users(google_user_id);
```

**Imported Interests Table (Optional - More Normalized):**
```sql
CREATE TABLE imported_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source VARCHAR(20) NOT NULL CHECK (source IN ('facebook', 'google', 'manual')),
  interest_type VARCHAR(50) NOT NULL, -- 'actor', 'musician', 'sport', 'cuisine', etc.
  interest_name VARCHAR(255) NOT NULL,
  external_id VARCHAR(255), -- Facebook page ID, Google place ID, etc.
  confidence_score DECIMAL(3,2), -- 0.0 to 1.0 (how confident we are)
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, source, external_id)
);

CREATE INDEX idx_imported_interests_user ON imported_interests(user_id, source);
```

**Imported Places Table:**
```sql
CREATE TABLE imported_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source VARCHAR(20) NOT NULL CHECK (source IN ('google_history', 'google_saved', 'google_review')),
  google_place_id VARCHAR(255) NOT NULL,
  place_name VARCHAR(255),
  place_category VARCHAR(100),
  visit_count INTEGER DEFAULT 1,
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  last_visited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, source, google_place_id)
);

CREATE INDEX idx_imported_places_user ON imported_places(user_id, source);
CREATE INDEX idx_imported_places_google_id ON imported_places(google_place_id);
```

---

## 🔄 OAuth Flow Design

### Facebook Sign-In Flow

**User Experience:**
1. User taps **"Continue with Facebook"** button on sign-in screen
2. Facebook OAuth modal opens (web view)
3. User logs in to Facebook, approves permissions
4. Redirect back to Loop app
5. Loading screen: "Importing your interests from Facebook..."
6. Show preview: "We found 15 interests from your liked pages!"
7. User can review/edit interests
8. Tap "Continue" → Main app

**Technical Flow:**
```
1. User taps "Continue with Facebook"
   ↓
2. Open Facebook OAuth URL:
   https://www.facebook.com/v12.0/dialog/oauth?
     client_id={APP_ID}
     &redirect_uri={REDIRECT_URI}
     &scope=public_profile,email,user_likes,user_events
   ↓
3. Facebook login → User approves permissions
   ↓
4. Redirect: myapp://oauth/facebook?code={AUTH_CODE}
   ↓
5. Exchange code for access token:
   POST https://graph.facebook.com/v12.0/oauth/access_token
     client_id={APP_ID}
     &client_secret={APP_SECRET}
     &redirect_uri={REDIRECT_URI}
     &code={AUTH_CODE}
   ↓
6. Get access token → Fetch user data:
   GET https://graph.facebook.com/v12.0/me?
     fields=id,name,email
     &access_token={ACCESS_TOKEN}
   ↓
7. Fetch liked pages:
   GET https://graph.facebook.com/v12.0/me/likes?
     fields=id,name,category
     &access_token={ACCESS_TOKEN}
   ↓
8. Fetch events:
   GET https://graph.facebook.com/v12.0/me/events?
     fields=id,name,category,start_time
     &access_token={ACCESS_TOKEN}
   ↓
9. Map interests → Store in database
   ↓
10. Create user account → Redirect to onboarding
```

**Code Example (React Native):**
```typescript
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

function SignInScreen() {
  const [request, response, promptAsync] = Facebook.useAuthRequest({
    clientId: 'YOUR_FACEBOOK_APP_ID',
    scopes: ['public_profile', 'email', 'user_likes', 'user_events'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.params;
      handleFacebookSignIn(access_token);
    }
  }, [response]);

  async function handleFacebookSignIn(accessToken: string) {
    // 1. Fetch user profile
    const userResponse = await fetch(
      `https://graph.facebook.com/v12.0/me?fields=id,name,email&access_token=${accessToken}`
    );
    const userData = await userResponse.json();

    // 2. Fetch liked pages
    const likesResponse = await fetch(
      `https://graph.facebook.com/v12.0/me/likes?fields=id,name,category&access_token=${accessToken}`
    );
    const likesData = await likesResponse.json();

    // 3. Map to Loop interests
    const interests = mapFacebookLikesToInterests(likesData.data);

    // 4. Create user account
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: generateRandomPassword(), // Auto-generated
    });

    // 5. Store Facebook data
    await supabase.from('users').update({
      name: userData.name,
      facebook_user_id: userData.id,
      facebook_access_token: accessToken,
      interests: interests,
    }).eq('id', data.user.id);

    // 6. Navigate to main app
    navigation.navigate('MainApp');
  }

  return (
    <Button
      title="Continue with Facebook"
      onPress={() => promptAsync()}
    />
  );
}
```

---

### Google Sign-In Flow (Enhanced)

**User Experience:**
1. User taps **"Continue with Google"** button
2. Google OAuth modal opens
3. User selects Google account, approves permissions:
   - ✅ View your email address
   - ✅ View your basic profile
   - ✅ View your Google Maps activity (NEW)
   - ✅ View your Google Calendar (NEW)
4. Redirect back to Loop app
5. Loading screen: "Importing your Google data..."
6. Show preview: "We found 25 places you've visited and 10 calendar events!"
7. User can review/edit
8. Tap "Continue" → Main app

**Technical Flow:**
```
1. User taps "Continue with Google"
   ↓
2. Open Google OAuth URL with enhanced scopes:
   https://accounts.google.com/o/oauth2/v2/auth?
     client_id={CLIENT_ID}
     &redirect_uri={REDIRECT_URI}
     &response_type=code
     &scope=openid email profile
           https://www.googleapis.com/auth/maps.readonly
           https://www.googleapis.com/auth/calendar.readonly
   ↓
3. Google login → User approves permissions
   ↓
4. Redirect: myapp://oauth/google?code={AUTH_CODE}
   ↓
5. Exchange code for access token + refresh token:
   POST https://oauth2.googleapis.com/token
     code={AUTH_CODE}
     &client_id={CLIENT_ID}
     &client_secret={CLIENT_SECRET}
     &redirect_uri={REDIRECT_URI}
     &grant_type=authorization_code
   ↓
6. Get tokens → Fetch user profile:
   GET https://www.googleapis.com/oauth2/v1/userinfo?
     access_token={ACCESS_TOKEN}
   ↓
7. Fetch Google Places history:
   GET https://maps.googleapis.com/maps/api/place/textsearch/json?
     query={user's location}
     &key={API_KEY}
   (Note: Google doesn't provide direct access to user's Places history via API)
   (Alternative: Ask user to export Google Timeline data)
   ↓
8. Fetch Google Calendar events:
   GET https://www.googleapis.com/calendar/v3/calendars/primary/events?
     timeMin={NOW}
     &timeMax={30_DAYS_FROM_NOW}
     &access_token={ACCESS_TOKEN}
   ↓
9. Store tokens + data → Create user account
   ↓
10. Navigate to main app
```

**IMPORTANT NOTE:** Google Maps doesn't provide direct API access to user's Places history or Timeline. Workarounds:
1. **Google Takeout:** Ask user to export their Google Timeline data as JSON
2. **Infer from Calendar:** Use calendar events at restaurants/venues
3. **Manual Entry:** Ask user to link Google My Maps saved places

---

## 🧠 Interest Mapping Strategy

### Facebook Liked Pages → Loop Interests

**Mapping Logic:**

| Facebook Category | Loop Interest Category | Algorithm Boost |
|-------------------|------------------------|-----------------|
| Actor | Movies, Theaters | +20 points for movies starring this actor |
| Musician/Band | Live Music, Concerts | +20 points for concerts by this artist |
| Sports Team | Sports Bars, Stadiums | +20 points during game times |
| Restaurant | Cuisine (Italian, Mexican, etc.) | +15 points for similar restaurants |
| TV Show | Entertainment | +10 points for themed events |
| Brand (Nike, Patagonia) | Fitness, Outdoor | +10 points for related activities |

**Example Mapping Function:**
```typescript
function mapFacebookLikesToInterests(likes: FacebookLike[]): Interest[] {
  const interests: Interest[] = [];

  for (const like of likes) {
    switch (like.category) {
      case 'Actor':
        interests.push({
          type: 'celebrity',
          name: like.name,
          category: 'movies',
          boost_keywords: [like.name], // Boost movies with this actor
          confidence: 0.9,
        });
        break;

      case 'Musician/Band':
        interests.push({
          type: 'artist',
          name: like.name,
          category: 'live_music',
          boost_keywords: [like.name, 'concert', 'live music'],
          confidence: 0.9,
        });
        break;

      case 'Sports Team':
        interests.push({
          type: 'sports_team',
          name: like.name,
          category: 'sports',
          boost_keywords: [like.name, 'sports bar', 'game'],
          confidence: 0.95,
        });
        break;

      case 'Restaurant/Cafe':
        // Infer cuisine type from name
        const cuisine = inferCuisine(like.name);
        interests.push({
          type: 'cuisine',
          name: cuisine,
          category: 'dining',
          boost_keywords: [cuisine, like.name],
          confidence: 0.8,
        });
        break;

      // ... more mappings
    }
  }

  return interests;
}
```

---

### Google Places History → Loop Preferences

**Inference Logic:**

| User Behavior | Loop Inference | Algorithm Impact |
|---------------|----------------|------------------|
| Visited 5+ times | Top preference | +25 points for similar places |
| Rated 5 stars | Highly enjoyed | +20 points for similar categories |
| Saved to "Want to go" | High intent | +30 points, recommend ASAP |
| Visited during mornings | Time preference | Boost morning recommendations |
| Visited with friends (group GPS) | Social preference | Boost group-friendly venues |

**Example Inference Function:**
```typescript
function inferPreferencesFromPlaces(places: ImportedPlace[]): UserPreferences {
  const preferences: UserPreferences = {
    favorite_categories: [],
    preferred_price_range: 2,
    preferred_times: [],
    distance_tolerance: 'medium',
  };

  // Count category occurrences
  const categoryCounts = new Map<string, number>();
  for (const place of places) {
    const count = categoryCounts.get(place.category) || 0;
    categoryCounts.set(place.category, count + place.visit_count);
  }

  // Top 3 categories = favorite categories
  const sortedCategories = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category);

  preferences.favorite_categories = sortedCategories;

  // Infer price range from average place price
  const avgPrice = places.reduce((sum, p) => sum + (p.price_level || 2), 0) / places.length;
  preferences.preferred_price_range = Math.round(avgPrice);

  return preferences;
}
```

---

## 📊 Recommendation Algorithm Integration

### Enhanced Scoring with Imported Data

**Current Algorithm (Base Score):**
```typescript
baseScore =
  interestMatch (20 pts) +
  locationScore (20 pts) +
  timeContext (15 pts) +
  feedbackHistory (15 pts) +
  collaborativeFiltering (10 pts)
```

**Enhanced Algorithm (With Imported Data):**
```typescript
baseScore =
  interestMatch (20 pts) +
  locationScore (20 pts) +
  timeContext (15 pts) +
  feedbackHistory (15 pts) +
  collaborativeFiltering (10 pts) +
  importedInterestBoost (20 pts) ← NEW +
  importedPlacesBoost (15 pts) ← NEW +
  calendarContextBoost (10 pts) ← NEW

maxBaseScore = 125 points (up from 80)
```

**New Scoring Components:**

#### 1. Imported Interest Boost (20 points max)
```typescript
function calculateImportedInterestBoost(activity: Activity, userInterests: ImportedInterest[]): number {
  let boost = 0;

  for (const interest of userInterests) {
    // Exact match on keywords (e.g., "Brad Pitt" movie)
    if (activity.description?.includes(interest.name) ||
        activity.title?.includes(interest.name)) {
      boost += 20 * interest.confidence_score;
      console.log(`🎯 Exact interest match: ${interest.name} (+${boost} pts)`);
      break;
    }

    // Category match (e.g., user likes "live music", activity is a concert)
    if (activity.category === interest.category) {
      boost += 10 * interest.confidence_score;
    }
  }

  return Math.min(boost, 20); // Cap at 20 points
}
```

#### 2. Imported Places Boost (15 points max)
```typescript
function calculateImportedPlacesBoost(activity: Activity, importedPlaces: ImportedPlace[]): number {
  let boost = 0;

  // Check if this is a place user has visited before
  const previousVisit = importedPlaces.find(p => p.google_place_id === activity.google_place_id);

  if (previousVisit) {
    // User visited before → Strong signal
    boost += previousVisit.visit_count * 2; // +2 pts per visit

    if (previousVisit.user_rating === 5) {
      boost += 5; // +5 pts for 5-star rating
    }
  }

  // Check if similar category to places user frequents
  const similarPlaces = importedPlaces.filter(p => p.place_category === activity.category);
  if (similarPlaces.length >= 3) {
    boost += 8; // User frequently visits this category
  }

  return Math.min(boost, 15); // Cap at 15 points
}
```

#### 3. Calendar Context Boost (10 points max)
```typescript
function calculateCalendarContextBoost(activity: Activity, freeTimeBlocks: FreeTimeBlock[]): number {
  let boost = 0;

  // Check if activity fits into user's known free time
  const activityDay = new Date(activity.suggested_time).getDay();
  const activityHour = new Date(activity.suggested_time).getHours();

  for (const block of freeTimeBlocks) {
    if (block.day === activityDay &&
        activityHour >= block.start_hour &&
        activityHour <= block.end_hour) {
      boost += 10; // Perfect timing!
      console.log(`📅 Activity fits free time block: ${block.day} ${block.start_hour}-${block.end_hour}`);
      break;
    }
  }

  return boost;
}
```

---

## 🚦 Implementation Roadmap

### Phase 1: Facebook OAuth + Interest Import (Week 1-2)
**Effort:** 2-3 weeks
**Priority:** HIGH

**Tasks:**
1. ✅ Set up Facebook App in Meta Developer Portal
2. ✅ Add Facebook SDK to React Native app
3. ✅ Implement Facebook Sign-In button
4. ✅ Request `user_likes` and `user_events` permissions
5. ✅ Fetch liked pages and events via Graph API
6. ✅ Map Facebook data to Loop interests
7. ✅ Store in database (`imported_interests` table)
8. ✅ Integrate into recommendation algorithm
9. ✅ Test with 10 beta users
10. ✅ A/B test: Facebook import vs manual entry

**Success Metrics:**
- 40%+ of new users choose Facebook sign-in
- Imported users have 2x higher recommendation acceptance rate (vs manual)
- 80%+ of imported interests are relevant (user doesn't delete them)

---

### Phase 2: Google OAuth Enhancements (Week 3-4)
**Effort:** 2-3 weeks
**Priority:** HIGH

**Tasks:**
1. ✅ Update Google OAuth scopes (maps.readonly, calendar.readonly)
2. ✅ Implement Google Calendar sync
3. ✅ Fetch calendar events for next 30 days
4. ✅ Identify free time blocks
5. ✅ Store in `calendar_events` table
6. ✅ Trigger proactive recommendations during free time
7. ⏳ **Google Places history workaround:**
   - Option A: Google Takeout import (manual)
   - Option B: Infer from calendar events at venues
   - Option C: Manual linking of Google My Maps
8. ✅ Integrate into recommendation algorithm
9. ✅ Test with beta users

**Success Metrics:**
- 50%+ of new users enable calendar sync
- Calendar users get 3x more proactive recommendations
- 70%+ of proactive recommendations are accepted

---

### Phase 3: Calendar Sync During Onboarding (Week 5)
**Effort:** 1 week
**Priority:** MEDIUM

**Tasks:**
1. ✅ Add "Sync Calendar" step to onboarding flow
2. ✅ Show benefits: "We'll find activities during your free time"
3. ✅ Request iOS Calendar / Android Calendar Provider permissions
4. ✅ Fetch recurring events (work, gym, etc.)
5. ✅ Calculate free time blocks
6. ✅ Show preview: "You have 4 hours free on Saturday!"
7. ✅ Store in database
8. ✅ Enable proactive notifications

**Success Metrics:**
- 60%+ of users complete calendar sync during onboarding
- Synced users have 2x higher retention (Day 30)

---

### Phase 4: Refinement & Optimization (Week 6-8)
**Effort:** 2-3 weeks
**Priority:** LOW

**Tasks:**
1. ✅ Improve interest mapping accuracy
2. ✅ Add more Facebook category mappings
3. ✅ Implement Google Places history (if possible)
4. ✅ A/B test different interest boost weights
5. ✅ Monitor algorithm performance
6. ✅ User feedback: "Did we get your interests right?"
7. ✅ Implement interest editing UI
8. ✅ Automated interest updates (refresh monthly)

**Success Metrics:**
- 90%+ interest mapping accuracy
- 50%+ increase in recommendation acceptance rate
- <5% of users delete imported interests

---

## 🔒 Privacy & Security Considerations

### Data Storage
- **Encrypt access tokens** in database (AES-256)
- **Refresh tokens regularly** to minimize risk
- **Store minimal data** - only what's needed for recommendations
- **Allow deletion** - Users can delete all imported data

### Permissions
- **Clear explanations** - Tell users exactly what we're importing
- **Granular controls** - Allow users to opt-out of specific imports
- **Transparent usage** - Show users how we're using their data

### Compliance
- **GDPR compliance** - Right to deletion, data portability
- **CCPA compliance** - Opt-out mechanism
- **Facebook Platform Policy** - Follow data usage restrictions
- **Google API Services User Data Policy** - Follow usage restrictions

**Example Permission Screen:**
```
"Why we need access to your Facebook likes"

✅ To recommend movies with actors you love
✅ To suggest concerts by your favorite bands
✅ To find activities matching your interests

We NEVER post to Facebook or share your data with third parties.

[ Continue ] [ Skip ]
```

---

## 📱 UI/UX Design

### Onboarding Flow (With Social Sign-In)

**Screen 1: Welcome**
```
┌─────────────────────────┐
│   🎯 Welcome to Loop    │
│                         │
│ Discover activities you │
│ love during your free   │
│ time                    │
│                         │
│ [Continue with Facebook]│
│ [Continue with Google]  │
│ [Sign in with Email]    │
└─────────────────────────┘
```

**Screen 2: Permission Explanation (Facebook)**
```
┌─────────────────────────┐
│ 🔐 Why we need access   │
│                         │
│ ✅ Import your interests│
│   from liked pages      │
│                         │
│ ✅ Recommend movies with│
│   actors you love       │
│                         │
│ ✅ Suggest concerts by  │
│   your favorite bands   │
│                         │
│ We NEVER post to        │
│ Facebook or share data. │
│                         │
│ [Approve] [Skip]        │
└─────────────────────────┘
```

**Screen 3: Importing Data**
```
┌─────────────────────────┐
│ 📥 Importing from       │
│    Facebook...          │
│                         │
│ [=========>    ] 70%    │
│                         │
│ Found 15 interests!     │
│ ✅ Brad Pitt            │
│ ✅ Dallas Mavericks     │
│ ✅ The Rolling Stones   │
│ ✅ Live Music           │
│ ... and 11 more         │
└─────────────────────────┘
```

**Screen 4: Review & Edit Interests**
```
┌─────────────────────────┐
│ ✏️ Review your interests│
│                         │
│ ✅ Movies               │
│ ✅ Live Music           │
│ ✅ Sports (Basketball)  │
│ ✅ Italian Cuisine      │
│                         │
│ Tap to remove, or add:  │
│ [+ Add More]            │
│                         │
│ [Continue]              │
└─────────────────────────┘
```

**Screen 5: Calendar Sync (Optional)**
```
┌─────────────────────────┐
│ 📅 Sync your calendar?  │
│                         │
│ We'll find activities   │
│ during your free time:  │
│                         │
│ 🕐 Monday 5-9pm (4h)    │
│ 🕐 Saturday all day     │
│                         │
│ [Sync Calendar]         │
│ [Skip for now]          │
└─────────────────────────┘
```

**Screen 6: Location Permission**
```
┌─────────────────────────┐
│ 📍 Enable location?     │
│                         │
│ We'll suggest nearby    │
│ activities and places   │
│ on your commute route.  │
│                         │
│ Your location is NEVER  │
│ shared with businesses  │
│ or other users.         │
│                         │
│ [Allow] [Not Now]       │
└─────────────────────────┘
```

**Screen 7: Done!**
```
┌─────────────────────────┐
│ 🎉 You're all set!      │
│                         │
│ We've personalized Loop │
│ with your interests.    │
│                         │
│ Check your feed for     │
│ recommendations!        │
│                         │
│ [Start Exploring]       │
└─────────────────────────┘
```

---

## 🧪 Testing Plan

### Test 1: Facebook Import Accuracy
1. Create test Facebook account with specific likes:
   - Brad Pitt (Actor)
   - Dallas Mavericks (Sports Team)
   - Radiohead (Musician)
2. Sign in to Loop with Facebook
3. Verify interests imported correctly
4. Check recommendation feed for Brad Pitt movies, Mavs games, Radiohead concerts
5. ✅ PASS if all interests appear and drive relevant recommendations

### Test 2: Google Calendar Sync
1. Create test Google Calendar with events:
   - Work (Mon-Fri 9am-5pm, recurring)
   - Gym (Tue/Thu 6pm-7pm, recurring)
2. Sign in to Loop with Google
3. Verify free time blocks detected:
   - Mon-Fri 5pm-9pm (free)
   - Weekends (free)
4. Check if recommendations appear during free time
5. ✅ PASS if free time blocks calculated correctly

### Test 3: Cold Start Comparison
1. **User A:** Manual interest entry (no imports)
2. **User B:** Facebook import
3. **User C:** Google calendar sync
4. Compare recommendation acceptance rates after 7 days:
   - User A: Expected 20-25%
   - User B: Expected 35-40%
   - User C: Expected 30-35%
5. ✅ PASS if imported users have higher acceptance rates

---

## 💰 Cost & ROI Analysis

### Development Cost
- **Facebook OAuth:** 2 weeks × $150/day = $2,100
- **Google OAuth enhancements:** 2 weeks × $150/day = $2,100
- **Calendar sync:** 1 week × $150/day = $1,050
- **Testing & refinement:** 2 weeks × $150/day = $2,100
- **Total:** ~$7,350

### API Costs (Monthly)
- **Facebook Graph API:** FREE (up to 200 requests/user/hour)
- **Google Maps API:** $0 (using existing quota)
- **Google Calendar API:** FREE (1 million requests/day)
- **Total:** $0/month

### ROI Metrics
- **Improved retention:** 2x higher Day 30 retention → $50K additional revenue/year
- **Higher recommendation acceptance:** 50% increase → Better business conversion → $30K additional revenue/year
- **Lower onboarding friction:** 40% more users complete onboarding → $20K additional revenue/year
- **Total additional revenue:** ~$100K/year
- **ROI:** $100K / $7.4K = **13.5x return**

---

## 🎯 Success Criteria

### MVP Launch (After Phase 1-3)
- ✅ 40%+ of users sign in with Facebook or Google (vs email)
- ✅ Imported users have 2x higher recommendation acceptance rate
- ✅ 80%+ of imported interests are accurate (not deleted by user)
- ✅ 60%+ of users complete calendar sync during onboarding
- ✅ <5% error rate during import process
- ✅ 0 privacy complaints or data leaks

### 30-Day Post-Launch
- ✅ 50%+ of active users have imported interests
- ✅ 70%+ of calendar-synced users still have sync enabled
- ✅ 3x increase in proactive recommendations sent
- ✅ Day 30 retention: 40%+ (vs 30% before)
- ✅ Recommendation acceptance rate: 35%+ (vs 25% before)

---

## 🚀 Next Steps

1. **Review this plan** with team/mentor
2. **Get API credentials:**
   - Facebook App ID + Secret
   - Google OAuth Client ID + Secret
3. **Start Phase 1:** Facebook OAuth + Interest Import
4. **Test with beta users** (10-20 users)
5. **Iterate based on feedback**
6. **Scale to Phase 2 & 3**

---

**This plan provides Loop with a massive competitive advantage: hyper-personalized recommendations from Day 1, with zero manual effort from users.**

**Estimated completion:** 6-8 weeks for all 3 phases.
