# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## CURRENT PROJECT STATUS

This is an Expo React Native application currently in **starter template** state. The sections below describe the existing setup, followed by the complete Loop app vision and architecture.

### Existing Tech Stack
- **Expo SDK 54** with the new architecture enabled
- **React Native 0.81.4** with React 19.1.0
- **Expo Router 6** for file-based routing with typed routes
- **React Native Reanimated 4.1** and **React Native Gesture Handler**
- **TypeScript** with strict mode enabled
- Platform support: iOS, Android, and Web

### Development Commands

**Start Development Server:**
```bash
npx expo start
```

**Platform-Specific Launches:**
```bash
npm run android  # Launch on Android emulator
npm run ios      # Launch on iOS simulator
npm run web      # Launch web version
```

**Code Quality:**
```bash
npm run lint     # Run ESLint with expo config
```

**Reset Project:**
```bash
npm run reset-project  # Moves starter code to app-example/ and creates blank app/
```

### Current Architecture & File Structure

**File-Based Routing:**
The app uses Expo Router's file-based routing system:
- `app/_layout.tsx` - Root layout with Stack navigator, theme provider, and StatusBar
- `app/(tabs)/_layout.tsx` - Tab navigator layout with bottom tabs
- `app/(tabs)/index.tsx` - Home screen (first tab)
- `app/(tabs)/explore.tsx` - Explore screen (second tab)
- `app/modal.tsx` - Modal screen example

The root layout sets `unstable_settings.anchor = '(tabs)'` to make tabs the default route.

**Theming System:**
The app has a comprehensive dark/light mode theming system:
- **Theme definitions**: `constants/theme.ts` exports `Colors` (light/dark color palettes) and `Fonts` (platform-specific font stacks)
- **Theme detection**: `hooks/use-color-scheme.ts` re-exports React Native's `useColorScheme` hook
- **Theme consumption**: `hooks/use-theme-color.ts` provides a hook that selects colors based on current theme
- **Themed components**: `components/themed-view.tsx` and `components/themed-text.tsx` automatically adapt to theme

The theme is applied app-wide via `@react-navigation/native`'s `ThemeProvider` in the root layout.

**Component Organization:**
- **`components/`** - Reusable components (ThemedView, ThemedText, ParallaxScrollView, ExternalLink, HelloWave, HapticTab)
- **`components/ui/`** - UI primitives (IconSymbol with iOS-specific implementation, Collapsible)
- **`hooks/`** - Custom React hooks for theming and color scheme
- **`constants/`** - Theme colors and fonts configuration

**Path Aliases:**
The project uses `@/*` as an alias for the root directory (configured in tsconfig.json):
```typescript
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
```

**Expo Configuration Notes:**
- **New Architecture**: React Native's new architecture is enabled (`newArchEnabled: true`)
- **React Compiler**: Experimental React compiler is enabled
- **Typed Routes**: Expo Router typed routes are enabled for type-safe navigation
- **Platform-specific files**: Use `.ios.tsx`, `.android.tsx`, or `.web.tsx` extensions
- **Edge-to-edge**: Android uses edge-to-edge layout with predictive back disabled

**Key Dependencies:**
- Navigation: `@react-navigation/native`, `@react-navigation/bottom-tabs`, `expo-router`
- UI: `@expo/vector-icons`, `expo-symbols` (iOS SF Symbols support)
- Platform APIs: `expo-haptics`, `expo-linking`, `expo-web-browser`, `expo-system-ui`
- Animations: `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`

---

# LOOP APP: COMPLETE ARCHITECTURE & VISION

## CORE VALUE PROPOSITION

Loop eliminates the time users waste searching for things to do and removes the complexity of coordinating with friends. The AI learns from continuous feedback, so after a year of use, Loop provides dramatically more insightful and personalized suggestions than for a new user.

**Key Benefits:**
- **Entertainment**: Discover concerts, shows, events you'd love
- **Productivity**: Optimize daily commute with convenient stops
- **Social Connection**: Coordinate group activities at optimal times/places
- **Life Enrichment**: Never miss out on experiences that matter to you
- **Travel Enhancement**: Make the most of trips to new cities

---

## MONETIZATION STRATEGY (Optimized for Profit)

### Revenue Model Philosophy
Loop is a **dual-sided marketplace**: users get free/cheap activity discovery, businesses get targeted customer acquisition. The key to profitability is making businesses pay for access to our engaged user base, while keeping user acquisition costs near zero through viral growth and ad-supported free tier.

### Revenue Stream 1: Business Subscriptions (Primary - 70-80% of revenue)

**Pricing Tiers:**

**Organic (Free):**
- Listed in database with basic info
- No algorithmic boost
- Appears in results only if best match

**Boosted ($49/month):**
- +15% algorithm score boost
- "Sponsored" label (transparent to users)
- Reach: 500-1,000 targeted users/month
- Analytics: Basic impressions, clicks
- ROI for business: 2% conversion → 10-20 new customers/month
- Average customer value: $25-50 → $250-1,000 revenue for $49 spend = **5-20x ROI**
- **Our margin: ~90% ($44 profit per business/month)**

**Premium ($149/month):**
- +30% algorithm score boost
- Top placement in recommendations
- "Featured" label (premium positioning)
- Reach: 1,500-3,000 targeted users/month
- Analytics dashboard: Impressions, clicks, conversions, demographics
- Priority support + dedicated account manager
- ROI for business: 2% conversion → 30-60 new customers/month
- **Our margin: ~85% ($127 profit per business/month)**

**Target Acquisition:**
- Month 6: 50 businesses → $4,450/mo
- Month 12: 200 businesses → $17,800/mo

### Revenue Stream 2: User Subscriptions (Secondary - 15-20% of revenue)

**Free Tier (Ad-Supported):**
- 5 AI recommendations per day
- Solo activity suggestions only
- Basic filters
- Sponsored activities included (clearly labeled)
- **Ads**: Banner ads (Google AdMob), native sponsored content
- **Cost to serve**: ~$0.40/user/month
- **Ad revenue**: ~$0.35-0.60/user/month
- **Net cost**: ~$0/user (ads offset costs)

**Loop Plus ($4.99/month):**
- Unlimited AI recommendations
- Group planning with up to 5 friends
- Advanced filters + saved preferences
- Calendar integration (Google, Apple)
- Ad-free experience
- **Target conversion**: 8-12% of free users
- **Profit margin**: 84% ($4.19 profit per user/month)

**Loop Premium ($9.99/month):**
- Everything in Plus
- Unlimited group planning (10+ friends)
- Multi-day itinerary planning for travel
- "Craft Your Perfect Day" AI mode
- Personal analytics dashboard
- Concierge mode: AI texts proactive suggestions
- **Target conversion**: 1-2% of free users
- **Profit margin**: 85% ($8.49 profit per user/month)

**User Revenue Targets (Month 12 with 10,000 active users):**
- Total user revenue: $10,068-12,268/month
- Total user profit: $8,968-11,168/month

### Revenue Stream 3: Affiliate Commissions (Phase 3 - 5-10% of revenue)

**Partnership Strategy:**
- OpenTable: 10% commission on reservations → $5-10 per booking
- Fandango: 15% commission on movie tickets → $2-3 per ticket
- Uber/Lyft: $2-3 per ride booked through Loop
- Eventbrite: 5-10% commission on event tickets
- Hotels.com / Airbnb: 3-5% commission on travel bookings

**Projected Revenue (Month 12):**
- 20% of users book monthly → 2,000 transactions
- Average commission: $3-5
- **Affiliate revenue: $6,000-10,000/month**

### Revenue Stream 4: Data Licensing (Phase 4 - Future)

**Anonymized Aggregate Data:**
- Urban planners: Activity patterns, foot traffic
- Tourism boards: Visitor preferences
- Real estate developers: Location insights
- Retailers: Consumer behavior trends

**Pricing:** $5,000-50,000 per custom report
**Projected revenue: $20,000-100,000/year**

### TOTAL REVENUE & PROFIT PROJECTIONS

**Month 12 (10,000 active users, 200 businesses):**
- Business subscriptions: $17,800/month
- User subscriptions: $6,988/month
- Ads: $3,080-5,280/month
- Affiliate commissions: $6,000-10,000/month
- **Total revenue: $33,868-40,068/month**
- **Operating costs**: $6,000-9,000/month
- **Net profit: $27,868-34,068/month** ($334,416-408,816/year)

**Key Profitability Metrics:**
- Gross margin: 78-85%
- Customer acquisition cost (CAC): ~$0 (viral/organic growth)
- LTV:CAC ratio: ∞ (viral growth = no paid acquisition)

---

## MVP CORE FEATURES (Build First - 10 Day Sprint)

### 1. Three-Screen Snapchat-Style Navigation

**Recommendation Feed Screen (center/main):**
- AI suggests tasks (activities) users can add to calendar
- Suggestions based on: free time, location, interests, commute route, past feedback
- Each card shows:
  - Activity name, category, location/distance, time, price range
  - AI explanation (why this suggestion)
  - High-quality photo
  - Sponsored activities marked with "Sponsored" badge
- Banner ad at bottom (AdMob 320x50px)
- Actions per card: "Add to Calendar" (primary) or "See Details" (secondary)
- Filters: Time of day, max distance, price range
- Pull-to-refresh for new suggestions

**Calendar Screen (swipe left):**
- Full month calendar view with color-coded tasks
- Each task shows: icon (category), time, location
- Tasks require location (lat/lng + address) to be added
- "Loop View" button: Map showing day's tasks connected by route (react-native-maps polyline)
- Create task flow:
  1. Tap "+" button
  2. Enter title, select time
  3. **Location required**: Choose from Home, Work, or "Search address"
  4. Select category
  5. Save → appears on calendar + map
- Import from Google/Apple Calendar (with location data)
- Default locations: Home, Work (set during onboarding)

**Friends Screen (swipe right):**
- Friends list showing: profile pic, name, Loop Score
- Loop Score calculation: Based on tasks completed on time, activities accepted
- Tap friend → View their daily Loop (if permission granted)
- Privacy controls: "Who can see my Loop?"
- Friend groups: Create custom lists
- "Find Friends" button: Search by email/phone
- Group planning initiation: Select multiple friends → "Suggest group activity"

### 2. AI-Powered Recommendation Engine (MVP Algorithm)

**Core Algorithm Philosophy:**
Success = (User Satisfaction × Business Value) - API Cost

**Input Data:**
- User profile: interests, home/work addresses
- Calendar: free time slots (gaps ≥1 hour)
- Current location + typical commute route
- Time context: day of week, time of day, holidays
- Weather: Current conditions + forecast (OpenWeather API)
- Past feedback: Thumbs up/down history with tags
- Social context: Friends' locations and availability

**Recommendation Algorithm (MVP):**

1. **Query Google Places API:**
   - Search radius: User's max_distance preference (default 5 miles)
   - Categories matching user interests
   - Open now: Filter by current hours
   - Minimum rating: 3.5+ stars
   - Return: Top 50 results

2. **Score each activity (0-100 point scale):**

   **Base score (40 points max):**
   - Interest match: +20 if category in top 3 interests
   - Interest match: +10 if category in interests (not top 3)
   - Interest match: 0 if no match (still eligible)

   **Location score (20 points max):**
   - On commute route: +20 (within 0.5 miles)
   - Near home/work: +15 (within 1 mile)
   - Within preferred distance: +10 (2-5 miles)
   - Too far: 0 (still shown, user might travel)

   **Time context score (15 points max):**
   - Perfect timing: +15 (coffee at 8am, dinner at 7pm)
   - Good timing: +10 (lunch at 12pm, evening entertainment at 8pm)
   - Acceptable: +5 (any other time)

   **Feedback history score (15 points max):**
   - Past thumbs up on similar category: +15
   - Past thumbs up on same price range: +10
   - No feedback history: +5 (neutral)
   - Past thumbs down on similar: -5 (penalize but don't eliminate)

   **Collaborative filtering (10 points max):**
   - Similar users liked this: +10 (70%+ interest overlap)
   - Some similar users liked: +5 (50-70% overlap)
   - No data: 0

   **Sponsored tier boost (Applied AFTER base scoring):**
   - Organic: 0% boost
   - Boosted: +15% boost (multiply base score by 1.15)
   - Premium: +30% boost (multiply base score by 1.30)
   - **Critical rule**: If sponsored activity scores <40 base points, cap boost at +10 points max (prevent irrelevant spam)

3. **Rank activities by final score (high to low)**

4. **Apply business rules:**
   - Max 2 sponsored activities in top 5 (40% sponsored mix)
   - Never show same business twice in one session
   - Diversity requirement: At least 3 different categories in top 5
   - Price range filter: Respect user's budget preference

5. **Generate AI explanation (OpenAI API):**
   - Prompt: "Explain why we're suggesting {activity_name} to a user who likes {interests}"
   - Example: "Based on your love of live music and Italian food, this venue combines both!"
   - Fallback if API fails: Template-based explanation

6. **Return top 5-10 activities** with cards showing:
   - Photo (Google Places photo API)
   - Name, category, rating
   - Distance, estimated travel time
   - Price range ($, $$, $$$)
   - AI explanation (1-2 sentences)
   - "Sponsored" badge if applicable

**Group Suggestions Algorithm:**
1. User selects 2-5 friends
2. Fetch friends' locations + calendars (with permission)
3. Find overlapping free time (≥2 hour window)
4. Calculate geographic midpoint using PostGIS ST_Centroid
5. Query Google Places API near midpoint (radius: 3 miles)
6. Score considering ALL participants' interests (average match)
7. Prioritize group-friendly categories: restaurants, bars, parks
8. Return top 3 suggestions with:
   - Activity details
   - Optimal meetup time
   - Total travel time for group
   - Who will travel farthest (empathy metric)

### 3. Feedback Loop & AI Learning System

**Post-Activity Feedback:**
After user completes a task (detected by: task time passed + user opens app):
- Prompt: "How was {activity_name}?" with thumbs up/down buttons
- Optional follow-up (if thumbs down): "What didn't work?"
  - Tags: Too expensive, Too far, Too crowded, Boring, Bad weather, Other
- Optional text note: "Tell us more (optional)"
- Incentive: "Your feedback helps us suggest better activities 🎯"

**Feedback Storage & Processing:**
- Save to feedback table: user_id, activity_id, rating, tags, notes, timestamp
- Update user.ai_profile JSON:
```json
{
  "preferred_distance_miles": 3.5,
  "budget_level": 2,
  "favorite_categories": ["coffee", "live_music", "hiking"],
  "disliked_categories": ["nightclubs"],
  "price_sensitivity": "high",
  "time_preferences": ["morning", "evening"],
  "distance_tolerance": "low"
}
```

**Continuous Learning (Weekly batch job):**
- Retrain collaborative filtering model using all feedback data
- Update activity base scores based on aggregate feedback
- Identify trending activities (high thumbs up rate this week)
- Adjust sponsored boost caps if user satisfaction drops <80%

**Algorithm Performance Monitoring:**
Track key metrics daily:
- Recommendation acceptance rate (target: 25-35%)
- Thumbs up rate on completed activities (target: 70%+)
- Sponsored activity acceptance rate (target: 15-20%)
- User retention after 7 days (target: 60%+)

Alert if metrics drop >10% week-over-week.

### 4. Calendar Integration & Free Time Detection

**Onboarding Calendar Setup:**
- Prompt: "Connect your calendar so Loop can find your free time"
- Options: Google Calendar, Apple Calendar, Skip for now
- OAuth flow: Request read-only calendar access
- Import events with location data

**Free Time Detection Logic:**
- Parse calendar for next 7 days
- Identify "busy" blocks: Any event marked as busy/tentative
- Calculate free time: Gaps ≥1 hour between busy blocks
- Consider commute time: Add 15-30 min buffer
- Exclude sleep hours: 11pm-7am (customizable)
- Proactive suggestions: "You have 2 hours free tomorrow at 3pm. Want suggestions?"

**Manual Time Blocking:**
- User can manually add "Free Time" blocks
- Example: "I'm free Saturday 2-5pm, suggest activities"
- Loop treats these as high-priority opportunities

**Smart Notifications:**
- Push notification: "You have free time in 30 minutes. Check your suggestions!"
- Timing: Send 30-60 min before free time block
- Frequency cap: Max 2 notifications per day

### 5. Location & Commute Awareness

**Location Data Collection:**
- Onboarding: User inputs home address, work address
- Runtime: Request "Always" location permission (for commute detection)
- Privacy: Explain clearly why we need location

**Commute Route Inference:**
- Track user's location daily 5-7pm (typical commute time)
- Build polyline of most common route home from work
- Store as LineString in PostGIS: user.commute_route
- Update monthly as patterns change

**On-Route Suggestions:**
- Query activities within 0.5 miles of commute route
- Push notification: "On your way home: Try this new coffee shop 2 min off your route"
- Show map with route + suggested detour
- Estimated time impact: "+5 min to your commute"

**Location-Based Triggers:**
- Geofence around user's free time destinations
- When user enters area: "You're near {activity}. Stop by?"
- Respect frequency: Max 1 location-triggered suggestion per day

### 6. Business Onboarding & Dashboard (MVP)

**Business Sign-Up Flow:**
- "Are you a business owner? Promote your venue on Loop"
- Create account: Email, business name, category, location
- Add details: Hours, photos, description, price range
- Choose plan: Boosted ($49/mo) or Premium ($149/mo) → 30-day free trial
- Enter payment: Stripe checkout (save card for recurring billing)
- Confirmation: "Your business is now live on Loop!"

**Business Dashboard (Premium tier only - MVP):**
Overview cards:
- Impressions this week: {number}
- Click-through rate: {percentage}
- Conversions (thumbs up after visit): {number}
- Estimated revenue attributed: ${amount}

Chart: Impressions over time (last 30 days)
User demographics: Age, interests of users who saw your business
Best performing times: "Most users engage 6-8pm"

**Business Analytics Tracking:**
- Log every recommendation shown: business_id, user_id, timestamp
- Log every click: When user taps "See Details"
- Log every conversion: When user gives thumbs up after visit

---

## FULL APP VISION (Post-MVP / Phase 2-3 Features)

### Phase 2: Enhanced Engagement & Retention

**Loop Score Gamification:**
- Visible metric on Friends Screen
- Score increases:
  - Complete task on time: +10 points
  - Accept AI suggestion: +5 points
  - Give feedback: +3 points
  - Attend group activity: +15 points
  - Maintain streak (7 days active): +20 bonus
- Score decreases:
  - Skip planned task: -5 points
  - Ignore suggestions: -2 points
- Leaderboard: Weekly top 10 among friend groups
- Badges: "Early Bird", "Social Butterfly", "Explorer"

**RSS-Style Interest Feed:**
- Users add custom tags: "Taylor Swift", "startup events", "taco Tuesday"
- Separate tab: "My Feed"
- Curated content matching tags (Eventbrite, local news, social media)
- Push notifications: "Taylor Swift concert announced in SF next month!"
- Monetization: Businesses can sponsor tags

**Traffic-Aware Navigation & Departure Alerts:**
- Integrate Google Maps Traffic API
- Real-time calculation: Current traffic → Recommended departure time
- Push notification: "Heavy traffic on I-5. Leave now to arrive on time."
- In-app route preview with alternates
- ETA updates

**User-Prompted Group Planning with Custom Tags:**
- New flow: "Plan an activity with friends"
- User inputs:
  - Select friends: Alice, Bob, Charlie
  - Add tags: "hiking", "budget-friendly", "dog-friendly", "evening"
  - Set date: "This Saturday"
- Algorithm:
  - Find overlapping free time
  - Filter activities matching ALL tags
  - Calculate optimal midpoint
  - Score by group preference match
  - Return top 3 with logistics
- Send invitations with RSVP
- Group chat: Built-in messaging

**Smart Scheduling (Intelligent Schedule Recognition):**

**Feature Vision:**
The ultimate "set it and forget it" calendar experience. Users enable background location tracking, and over 2-3 weeks, Loop automatically learns their routine schedule (work hours, gym visits, recurring coffee shops, weekend patterns) without manual calendar entry. This becomes Loop's competitive moat—a deeply personalized AI that knows your life patterns better than you do.

**Value Proposition:**
- **Zero Manual Entry**: No more tedious calendar data entry for recurring activities
- **Hyper-Personalized Recommendations**: Suggestions based on actual behavior, not stated preferences
- **Proactive Insights**: "You usually have free time on Thursdays at 3pm—want suggestions?"
- **Routine Optimization**: "You stop at Starbucks 4x/week. Try this new coffee shop on your route?"

**How It Works (User Experience):**

1. **Opt-In During Onboarding (Optional):**
   - Clear explanation: "Let Loop learn your routine so we can suggest better activities"
   - Shows value: "After 2-3 weeks, Loop will automatically know when you're free"
   - Privacy promise: "Your location data never leaves your device except as anonymized patterns"
   - Visual: Animation showing dots on map → recognized places → calendar entries

2. **Passive Background Tracking (2-3 Weeks):**
   - App tracks location in background using battery-efficient methods
   - User sees progress indicator: "Loop is learning... Day 5 of 14"
   - Periodic check-ins: "Loop recognized 3 recurring places. Review now?"

3. **Place Recognition & Labeling:**
   - Loop detects recurring locations using DBSCAN clustering
   - Prompts user: "Is this place 'Work', 'Gym', or 'Other'?"
   - User confirms/corrects place names
   - Loop learns: Home (Mon-Sun 9pm-7am), Work (Mon-Fri 9am-5pm), Gym (Tue/Thu 6pm)

4. **Automatic Calendar Population:**
   - Loop auto-creates calendar blocks for recognized patterns
   - Example: "Work" block Mon-Fri 9am-5pm (recurring)
   - User can edit/delete blocks as needed
   - Transparent: "Loop added 3 recurring events based on your routine"

5. **Smart Recommendations:**
   - "You have free time Thursday 3-5pm (like usual). Want suggestions?"
   - "You're leaving work early today. Stop by this new bar on your route?"
   - "You skipped the gym last Thursday. Going today?"

**Technical Implementation:**

**Phase 1.5 (Commute Learning - Low Complexity, 2-3 weeks development):**
- Focus: Learn home → work commute route only
- Background tracking: iOS Significant Location Change API (passive, low battery)
- Pattern recognition: Identify work location (most common weekday 9-5 location)
- Auto-suggest on-route activities during commute times
- No full schedule recognition yet
- Privacy: Only commute route stored, no other locations

**Phase 2 (Full Schedule Recognition - High Complexity, 6-8 weeks development):**

1. **Background Location Tracking:**
   - iOS: `Significant Location Change` API (updates every ~500m, low battery impact)
   - Android: Foreground service with location updates every 5-10 minutes
   - Battery optimization: Only track during "active hours" (7am-11pm)
   - Stop tracking when device is stationary for >30 minutes

2. **Location Data Storage:**
   ```sql
   CREATE TABLE location_history (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES users(id),
     location GEOGRAPHY(POINT, 4326) NOT NULL,
     timestamp TIMESTAMPTZ NOT NULL,
     accuracy_meters DECIMAL(6,2),
     activity_type VARCHAR(20), -- stationary, walking, driving, unknown
     battery_level INTEGER,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   CREATE INDEX idx_location_history_user_time ON location_history(user_id, timestamp DESC);
   ```

3. **Place Recognition Algorithm (DBSCAN Clustering):**
   - Run weekly batch job on last 14 days of location data
   - DBSCAN parameters: epsilon = 100m, min_points = 3
   - Clusters = recurring places (work, gym, coffee shop, etc.)
   - Calculate centroid of each cluster as "place location"

   ```python
   from sklearn.cluster import DBSCAN
   import numpy as np

   def recognize_places(location_history):
       # Convert to lat/lng numpy array
       coords = np.array([[loc.lat, loc.lng] for loc in location_history])

       # DBSCAN clustering (epsilon=100m in degrees ≈ 0.001)
       clustering = DBSCAN(eps=0.001, min_samples=3).fit(coords)

       # Extract clusters
       places = []
       for cluster_id in set(clustering.labels_):
           if cluster_id == -1:  # Skip noise
               continue
           cluster_points = coords[clustering.labels_ == cluster_id]
           centroid = cluster_points.mean(axis=0)
           places.append({
               'location': centroid,
               'visit_count': len(cluster_points),
               'cluster_id': cluster_id
           })

       return places
   ```

4. **Pattern Recognition (Time & Frequency Analysis):**
   - For each recognized place, analyze visit patterns:
     - Days of week: Mon-Fri (work), Tue/Thu (gym), Sat/Sun (brunch spot)
     - Time of day: 9am-5pm (work), 6pm-7pm (gym), 10am-12pm (brunch)
     - Duration: How long user typically stays
   - Confidence scoring: High confidence = visited 8+ times with consistent timing

   ```python
   def analyze_visit_pattern(place_visits):
       # place_visits = list of timestamps when user was at this place

       # Extract day of week pattern
       days = [visit.weekday() for visit in place_visits]
       day_frequency = Counter(days)

       # Extract time of day pattern
       hours = [visit.hour for visit in place_visits]
       avg_arrival_time = np.mean(hours)

       # Calculate duration
       durations = []  # Calculate time between arrival and departure
       avg_duration = np.mean(durations)

       return {
           'days_of_week': day_frequency.most_common(),
           'typical_arrival_hour': avg_arrival_time,
           'typical_duration_hours': avg_duration,
           'confidence_score': len(place_visits) / 30  # 30 visits = 100% confidence
       }
   ```

5. **User Confirmation Flow:**
   - Push notification: "Loop recognized 3 recurring places. Review now?"
   - In-app modal showing map with pins
   - For each place: "What is this place?"
     - Options: Home, Work, Gym, Coffee Shop, Restaurant, Friend's House, Other, Ignore
   - User can rename: "Work" → "Google Office"

6. **Auto-Calendar Population:**
   - Once place is labeled + pattern confirmed, create recurring calendar events
   - Example: "Work" (Mon-Fri 9am-5pm, recurring)
   - Status: "auto_generated" (different from "manual" or "recommendation")
   - User can edit/delete at any time
   - Sync to Google/Apple Calendar (if connected)

**Privacy Safeguards:**

1. **Data Minimization:**
   - Only store location data necessary for pattern recognition
   - Auto-delete location history >30 days old
   - Never share raw location data with third parties

2. **On-Device Processing (Optional Enhancement):**
   - Run DBSCAN clustering on-device (iOS: CoreML, Android: TensorFlow Lite)
   - Only send anonymized "place patterns" to server, not raw coordinates
   - More complex but maximizes privacy

3. **Transparency & Control:**
   - Settings page: "Smart Scheduling" with ON/OFF toggle
   - "View my location history" (map showing last 7 days)
   - "Delete all location data" button (immediate deletion)
   - "Export my data" (GDPR/CCPA compliance)

4. **Compliance:**
   - GDPR: Explicit opt-in, right to deletion, data portability
   - CCPA: Opt-out mechanism, data disclosure
   - App Store / Play Store: Clear location permission explanations

**Phased Rollout Strategy:**

**Phase 1.5: Commute Learning Only (Month 4-5, 2-3 weeks development)**
- Scope: Learn home → work commute route only
- Lower risk: Single use case, easier to debug
- User value: On-route activity suggestions during commute
- Technical: iOS Significant Location Change API only (passive)
- Success metric: 40%+ of users enable commute tracking

**Phase 2.0: Full Schedule Recognition (Month 6-8, 6-8 weeks development)**
- Scope: Recognize all recurring places + auto-populate calendar
- Beta: Invite 10% of most engaged users (Loop Score >500)
- A/B test: 50% get Smart Scheduling, 50% don't (control group)
- Monitor: Battery drain, user complaints, opt-out rate
- Success metrics:
  - <5% increase in battery drain
  - 60%+ of beta users keep feature enabled after 30 days
  - 20%+ increase in recommendation acceptance rate
  - <2% opt-out rate due to privacy concerns

**Phase 2.5: Refinement & Scale (Month 9-10)**
- Address feedback from beta
- Improve place recognition accuracy (goal: 90%+ correct labels)
- Reduce false positives (don't recognize one-time locations)
- Scale to 100% of users who opt-in

**Success Metrics:**

1. **Adoption:**
   - 50%+ of users enable Smart Scheduling
   - 70%+ of those users keep it enabled after 30 days

2. **Accuracy:**
   - 90%+ of recognized places correctly labeled by users
   - 85%+ of auto-generated calendar events kept (not deleted)

3. **Engagement:**
   - 25%+ increase in recommendation acceptance rate (vs non-Smart Scheduling users)
   - 15%+ increase in daily active usage

4. **Privacy:**
   - <2% opt-out rate due to privacy concerns
   - 0 privacy complaints or incidents
   - <5% increase in battery drain

5. **Business Impact:**
   - 30%+ increase in user retention (Day 30)
   - 20%+ increase in Loop Plus conversions (Smart Scheduling exclusive feature)
   - Competitive moat: Feature competitors can't easily replicate

**Development Timeline & Resources:**

**Phase 1.5 (Commute Learning):**
- **Time**: 2-3 weeks
- **Effort**: 1 mobile developer, 1 backend developer
- **Cost**: ~$5,000-8,000 (salaries) + $0 infrastructure (fits in existing backend)

**Phase 2.0 (Full Schedule Recognition):**
- **Time**: 6-8 weeks
- **Effort**: 1 mobile developer, 1 backend developer, 1 ML engineer (part-time)
- **Cost**: ~$20,000-30,000 (salaries) + $200-500/month (increased database + compute)
- **Dependencies**: PostGIS, Scikit-learn, iOS/Android background location APIs

**User Research Questions (Pre-Launch Survey):**
1. Would you let Loop learn your routine in the background to suggest better activities?
2. What's your biggest concern about location tracking? (Privacy, battery, accuracy)
3. How long would you give Loop to learn your schedule before deciding if it's useful? (1 week, 2 weeks, 1 month)
4. Would you pay $4.99/month for automatic schedule recognition? (Yes, No, Maybe)

**Competitive Analysis:**
- **Google Maps Timeline**: Tracks location but doesn't auto-populate calendar or suggest activities
- **Apple Screen Time**: Recognizes app usage patterns but not location-based routines
- **Timely (defunct)**: Tried automatic time tracking but poor UX and privacy concerns killed it
- **Loop's Advantage**: Combine location learning + calendar + recommendations in one seamless flow

**Why This Is a Competitive Moat:**
- Takes 6-8 weeks to build properly (high barrier to entry)
- Requires ML expertise (DBSCAN, pattern recognition)
- Network effects: More usage = better pattern recognition = more personalized suggestions
- Proprietary dataset: User routine patterns are unique to Loop
- After 1 year of use, Loop knows user's life so well they can't switch to competitor

### Phase 3: Advanced Features & Scale

**Multi-Day Itinerary Planning for Travel:**
- User inputs: "Traveling to NYC June 10-13"
- Loop generates full itinerary:
  - Friday 8pm: Broadway show
  - Saturday 10am: MoMA visit
  - Saturday 1pm: Lunch in Greenwich Village
  - Saturday 3pm: Central Park
  - Saturday 7pm: Rooftop bar in Brooklyn
- Advance booking: Direct links to tickets, reservations
- Calendar integration: Add all activities
- Budget tracking: Show total estimated cost
- Monetization: Earn affiliate commissions

**Interest-Based Friend Discovery:**
- Match users with similar interests
- Algorithm: Find users with 60%+ interest overlap + within 10 miles
- Suggestion: "5 Loop users near you love hiking. Join this group hike?"
- Privacy: Opt-in only, anonymous until both agree
- Safety: Suggest public locations, allow reporting/blocking

**Business Analytics Dashboard (Premium):**
- Advanced metrics:
  - Conversion funnel: Impressions → Clicks → Adds → Thumbs up
  - Customer lifetime value
  - Repeat visit rate
  - Competitive analysis
  - Day/time heatmap
  - Demographic breakdown
- Actionable insights
- Export reports: CSV download
- API access: CRM integration

**Affiliate Partnership Integrations:**
- OpenTable: "Reserve table for 7pm" → Commission
- Fandango: "Buy movie tickets" → Commission
- Uber/Lyft: "Book ride to venue" → Commission
- Eventbrite: "Get concert tickets" → Commission
- Hotels.com: "Book hotel for NYC trip" → Commission
- Seamless checkout: In-app purchase
- Revenue impact: $8,000/month at 10K users

**Wearable Device Support:**
- Apple Watch app: Quick glance at today's Loop
- Tap to view recommendations
- Add to calendar: Voice command "Hey Siri, add to Loop"
- Departure alerts: Haptic tap + notification
- Location-aware: "You're near a suggested activity"
- Fitness integration: Track walking/biking between activities

**Advanced AI Features:**
- Predictive suggestions: "Based on patterns, you'll have free time Thursday 3-5pm"
- Seasonal awareness: Beach in summer, indoor in winter
- Event anticipation: "Coachella in 2 months. Want to plan?"
- Habit formation: "You've gone to yoga 4 weeks in a row!"
- Weekly digest: Email every Sunday with top 5 suggestions
- Voice assistant: "Hey Loop, what should I do tonight?"

---

## TECHNICAL ARCHITECTURE

### Tech Stack (MVP - Latest Stable Versions)

**Frontend:**
- React Native 0.76.x (latest stable)
- Expo SDK 53 (latest stable)
- React 18.3.1 (latest stable production)
- Expo Router 4 (file-based routing)
- TypeScript 5.x
- React Native Maps (Loop visualization)
- Expo Calendar (calendar integration)
- Expo Location (GPS access, geofencing)
- React Native Reanimated 3

**Backend:**
- Node.js 20.x LTS
- Express 4.x (REST API)
- TypeScript

**Database & Auth:**
- Supabase (managed PostgreSQL + auth + storage)
  - PostgreSQL 15
  - PostGIS extension (geospatial queries)
  - Row-level security (RLS)
  - Built-in auth: Email/password, Google OAuth, Apple Sign-In
- Redis (managed via Upstash or Redis Cloud)
  - Cache recommendations (60 min TTL)
  - Session management
  - Rate limiting

**AI & External APIs:**
- OpenAI API (GPT-4 Turbo for explanations)
- Google Places API (search, details, photos)
- Google Maps API (Phase 2: distance, directions, traffic)
- OpenWeather API (free tier: current + 5-day forecast)
- Python microservice (optional, for complex ML)
  - FastAPI framework
  - Scikit-learn (collaborative filtering)
  - Pandas (data processing)

**Ads & Monetization:**
- Google AdMob (in-app ads for free tier)
  - Banner ads (320x50px)
  - Interstitial ads (full-screen)
  - Native ads (sponsored content cards)
- Stripe
  - Checkout (business subscriptions)
  - Billing Portal
  - Webhooks
  - Connect (future: affiliate payouts)

**Hosting & Infrastructure:**
- Backend: Render or Railway ($7-25/month)
- Database: Supabase Cloud (free → $25/month Pro)
- File storage: Supabase Storage or AWS S3
- CDN: Cloudflare (free tier for images)
- Monitoring: Sentry (errors), Posthog (analytics)

**Development Tools:**
- Version control: Git + GitHub
- CI/CD: GitHub Actions
- Testing: Jest (unit), Detox (E2E mobile)
- API testing: Postman or Insomnia
- Code quality: ESLint, Prettier, Husky (pre-commit hooks)
- App distribution: Expo EAS

### Database Schema (Optimized for Performance & Scalability)

**Core Principles:**
- Use PostGIS for all location queries (10-100x faster than lat/lng calculations)
- Index everything used in WHERE/JOIN clauses
- JSONB for flexible data but structured tables for critical queries
- Timestamps on everything for analytics

```sql
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  profile_picture_url TEXT,

  -- Location data (PostGIS)
  home_location GEOGRAPHY(POINT, 4326),
  home_address TEXT,
  work_location GEOGRAPHY(POINT, 4326),
  work_address TEXT,
  current_location GEOGRAPHY(POINT, 4326),
  commute_route GEOGRAPHY(LINESTRING, 4326),

  -- Preferences (JSONB for flexibility)
  interests JSONB DEFAULT '[]'::jsonb,
  preferences JSONB DEFAULT '{
    "budget": 2,
    "max_distance_miles": 5,
    "preferred_times": ["evening"],
    "notification_enabled": true
  }'::jsonb,

  -- AI learning profile
  ai_profile JSONB DEFAULT '{
    "preferred_distance_miles": 5.0,
    "budget_level": 2,
    "favorite_categories": [],
    "disliked_categories": [],
    "price_sensitivity": "medium",
    "time_preferences": [],
    "distance_tolerance": "medium"
  }'::jsonb,

  -- Subscription status
  subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'plus', 'premium')),
  subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'trialing')),
  stripe_customer_id VARCHAR(255),
  subscription_end_date TIMESTAMPTZ,

  -- Gamification
  loop_score INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_active_date DATE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,

  -- Privacy settings
  privacy_settings JSONB DEFAULT '{
    "share_loop_with": "friends",
    "discoverable": true,
    "share_location": true
  }'::jsonb
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription ON users(subscription_tier, subscription_status);
CREATE INDEX idx_users_home_location ON users USING GIST(home_location);
CREATE INDEX idx_users_work_location ON users USING GIST(work_location);
CREATE INDEX idx_users_current_location ON users USING GIST(current_location);

-- Calendar events
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) CHECK (category IN ('work', 'personal', 'social', 'dining', 'fitness', 'entertainment', 'travel', 'other')),

  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT NOT NULL,

  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT FALSE,

  source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('manual', 'recommendation', 'google_calendar', 'apple_calendar', 'group_plan')),
  activity_id UUID REFERENCES activities(id),
  external_calendar_id VARCHAR(255),
  external_event_id VARCHAR(255),

  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_user_time ON calendar_events(user_id, start_time, end_time);
CREATE INDEX idx_calendar_events_location ON calendar_events USING GIST(location);
CREATE INDEX idx_calendar_events_status ON calendar_events(user_id, status);
CREATE INDEX idx_calendar_events_source ON calendar_events(source);

-- Activities
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,

  google_place_id VARCHAR(255) UNIQUE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  description TEXT,

  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),

  phone VARCHAR(20),
  website TEXT,

  price_range INTEGER CHECK (price_range BETWEEN 0 AND 3),
  rating DECIMAL(2,1),
  reviews_count INTEGER DEFAULT 0,

  hours JSONB DEFAULT '{}'::jsonb,

  photos JSONB DEFAULT '[]'::jsonb,
  cover_photo_url TEXT,

  tags JSONB DEFAULT '[]'::jsonb,

  sponsored_tier VARCHAR(20) DEFAULT 'organic' CHECK (sponsored_tier IN ('organic', 'boosted', 'premium')),
  sponsor_active BOOLEAN DEFAULT TRUE,
  sponsor_start_date TIMESTAMPTZ,
  sponsor_end_date TIMESTAMPTZ,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ
);

CREATE INDEX idx_activities_location ON activities USING GIST(location);
CREATE INDEX idx_activities_category ON activities(category, subcategory);
CREATE INDEX idx_activities_sponsored ON activities(sponsored_tier, sponsor_active) WHERE sponsor_active = TRUE;
CREATE INDEX idx_activities_rating ON activities(rating DESC) WHERE is_active = TRUE;
CREATE INDEX idx_activities_google_place ON activities(google_place_id);

-- Recommendations
CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,

  recommended_for TIMESTAMPTZ NOT NULL,
  reason TEXT,
  confidence_score DECIMAL(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
  algorithm_version VARCHAR(20),

  score_breakdown JSONB,

  is_sponsored BOOLEAN DEFAULT FALSE,
  business_id UUID REFERENCES businesses(id),

  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'accepted', 'declined', 'expired')),
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX idx_recommendations_user_status ON recommendations(user_id, status, created_at);
CREATE INDEX idx_recommendations_activity ON recommendations(activity_id, is_sponsored);
CREATE INDEX idx_recommendations_business ON recommendations(business_id, created_at) WHERE is_sponsored = TRUE;
CREATE INDEX idx_recommendations_expiry ON recommendations(expires_at) WHERE status = 'pending';

-- Feedback
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,

  rating VARCHAR(20) NOT NULL CHECK (rating IN ('thumbs_up', 'thumbs_down')),

  feedback_tags JSONB DEFAULT '[]'::jsonb,
  feedback_notes TEXT,

  completed_at TIMESTAMPTZ NOT NULL,
  weather_at_time VARCHAR(50),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_user ON feedback(user_id, created_at);
CREATE INDEX idx_feedback_activity ON feedback(activity_id, rating);
CREATE INDEX idx_feedback_recommendation ON feedback(recommendation_id);

-- Friendships
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked', 'declined')),

  friend_group VARCHAR(100),

  can_view_loop BOOLEAN DEFAULT TRUE,
  can_invite_to_activities BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,

  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

CREATE INDEX idx_friendships_user ON friendships(user_id, status);
CREATE INDEX idx_friendships_friend ON friendships(friend_id, status);
CREATE INDEX idx_friendships_status ON friendships(status) WHERE status = 'accepted';

-- Group plans
CREATE TABLE group_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title VARCHAR(255),
  description TEXT,

  suggested_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,

  meeting_location GEOGRAPHY(POINT, 4326) NOT NULL,
  meeting_address TEXT NOT NULL,

  total_travel_time_minutes INTEGER,
  farthest_traveler_user_id UUID REFERENCES users(id),

  constraint_tags JSONB DEFAULT '[]'::jsonb,

  status VARCHAR(20) DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'completed', 'cancelled')),
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_group_plans_creator ON group_plans(creator_id, status);
CREATE INDEX idx_group_plans_time ON group_plans(suggested_time) WHERE status IN ('proposed', 'confirmed');
CREATE INDEX idx_group_plans_location ON group_plans USING GIST(meeting_location);

-- Plan participants
CREATE TABLE plan_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES group_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  rsvp_status VARCHAR(20) DEFAULT 'invited' CHECK (rsvp_status IN ('invited', 'accepted', 'declined', 'maybe', 'no_response')),
  responded_at TIMESTAMPTZ,

  travel_distance_miles DECIMAL(5,2),
  travel_time_minutes INTEGER,

  invited_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(plan_id, user_id)
);

CREATE INDEX idx_plan_participants_plan ON plan_participants(plan_id, rsvp_status);
CREATE INDEX idx_plan_participants_user ON plan_participants(user_id, rsvp_status);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES group_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'location', 'activity_suggestion')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_plan ON messages(plan_id, created_at DESC);
CREATE INDEX idx_messages_user ON messages(user_id, created_at DESC);

-- Businesses
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  owner_email VARCHAR(255) UNIQUE NOT NULL,
  owner_name VARCHAR(255),
  business_name VARCHAR(255) NOT NULL,

  category VARCHAR(100) NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  phone VARCHAR(20),
  website TEXT,
  description TEXT,
  logo_url TEXT,

  hours JSONB DEFAULT '{}'::jsonb,

  subscription_tier VARCHAR(20) DEFAULT 'organic' CHECK (subscription_tier IN ('organic', 'boosted', 'premium')),
  subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'trialing', 'inactive')),
  trial_ends_at TIMESTAMPTZ,
  subscription_started_at TIMESTAMPTZ,

  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  onboarded_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_businesses_email ON businesses(owner_email);
CREATE INDEX idx_businesses_subscription ON businesses(subscription_tier, subscription_status);
CREATE INDEX idx_businesses_location ON businesses USING GIST(location);

-- Business analytics
CREATE TABLE business_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  date DATE NOT NULL,

  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  calendar_adds INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,

  estimated_customers INTEGER DEFAULT 0,
  revenue_attributed DECIMAL(10,2),

  demographics JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(business_id, date)
);

CREATE INDEX idx_business_analytics_date ON business_analytics(business_id, date DESC);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  stripe_payment_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_invoice_id VARCHAR(255),

  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  description TEXT,

  status VARCHAR(20) NOT NULL CHECK (status IN ('succeeded', 'failed', 'pending', 'refunded')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_payments_business ON payments(business_id, created_at DESC);
CREATE INDEX idx_payments_status ON payments(status) WHERE status != 'succeeded';
CREATE INDEX idx_payments_stripe ON payments(stripe_payment_id);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
    'recommendation', 'departure_alert', 'friend_request', 'group_invite',
    'loop_score_milestone', 'feedback_reminder', 'location_trigger', 'other'
  )),

  deep_link TEXT,
  action_button_text VARCHAR(50),

  recommendation_id UUID REFERENCES recommendations(id),
  plan_id UUID REFERENCES group_plans(id),

  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(notification_type, sent_at);

-- App analytics
CREATE TABLE app_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,

  daily_active_users INTEGER DEFAULT 0,
  weekly_active_users INTEGER DEFAULT 0,
  monthly_active_users INTEGER DEFAULT 0,
  new_signups INTEGER DEFAULT 0,
  churned_users INTEGER DEFAULT 0,

  recommendations_generated INTEGER DEFAULT 0,
  recommendations_accepted INTEGER DEFAULT 0,
  acceptance_rate DECIMAL(5,2),
  activities_completed INTEGER DEFAULT 0,
  thumbs_up_count INTEGER DEFAULT 0,
  thumbs_down_count INTEGER DEFAULT 0,
  satisfaction_rate DECIMAL(5,2),

  revenue_users_cents INTEGER DEFAULT 0,
  revenue_businesses_cents INTEGER DEFAULT 0,
  revenue_affiliates_cents INTEGER DEFAULT 0,
  total_revenue_cents INTEGER DEFAULT 0,

  active_businesses INTEGER DEFAULT 0,
  boosted_businesses INTEGER DEFAULT 0,
  premium_businesses INTEGER DEFAULT 0,

  google_places_api_cost_cents INTEGER DEFAULT 0,
  openai_api_cost_cents INTEGER DEFAULT 0,
  maps_api_cost_cents INTEGER DEFAULT 0,
  total_api_cost_cents INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_app_analytics_date ON app_analytics(date DESC);
```

### API Endpoints (MVP)

**Authentication:**
- `POST /api/auth/signup` - Create account (email/password)
- `POST /api/auth/login` - Login
- `POST /api/auth/google` - Google OAuth
- `POST /api/auth/apple` - Apple Sign-In
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user profile

**Recommendations:**
- `GET /api/recommendations` - Get personalized activity suggestions
- `POST /api/recommendations/:id/accept` - Accept recommendation (add to calendar)
- `POST /api/recommendations/:id/decline` - Decline recommendation
- `POST /api/recommendations/:id/view` - Mark as viewed

**Calendar:**
- `GET /api/calendar/events` - Get user's calendar events
- `POST /api/calendar/events` - Create manual task
- `PUT /api/calendar/events/:id` - Update task
- `DELETE /api/calendar/events/:id` - Delete task
- `GET /api/calendar/free-time` - Get free time slots
- `POST /api/calendar/sync` - Sync with Google/Apple Calendar

**Feedback:**
- `POST /api/feedback` - Submit thumbs up/down after activity
- `GET /api/feedback/history` - Get user's past feedback

**Friends:**
- `GET /api/friends` - Get friends list
- `POST /api/friends/request` - Send friend request
- `POST /api/friends/:id/accept` - Accept friend request
- `DELETE /api/friends/:id` - Remove friend
- `GET /api/friends/:id/loop` - Get friend's daily Loop

**Group Plans:**
- `POST /api/plans` - Create group plan
- `GET /api/plans` - Get user's group plans
- `PUT /api/plans/:id/rsvp` - RSVP to group plan
- `POST /api/plans/:id/messages` - Send message in group chat
- `GET /api/plans/:id/messages` - Get group chat messages

**Activities:**
- `GET /api/activities/search` - Search activities
- `GET /api/activities/:id` - Get activity details

**Business:**
- `POST /api/business/signup` - Create business account
- `GET /api/business/profile` - Get business profile
- `PUT /api/business/profile` - Update business profile
- `POST /api/business/subscribe` - Start/update subscription
- `GET /api/business/analytics` - Get analytics dashboard data

**Admin:**
- `POST /api/admin/sync-places` - Trigger Google Places API sync
- `GET /api/admin/analytics` - Get app-wide analytics

---

## MVP DEVELOPMENT ROADMAP (10-Day Sprint)

### Day 1-2: Foundation & Database
- Set up Supabase project with PostGIS extension
- Create all database tables with indexes
- Set up Supabase Auth (email, Google OAuth)
- Initialize Expo React Native project (SDK 53, Router 4)
- Configure TypeScript, ESLint, Prettier
- Set up folder structure: /app, /components, /services, /utils, /types
- Create environment variables: Supabase keys, Google API keys

### Day 3-5: Recommendation Feed (Core MVP)
- Build recommendation feed UI:
  - FlatList with activity cards
  - Image, name, category, distance, AI explanation
  - "Add to Calendar" + "See Details" buttons
  - Time/distance filters
  - Banner ad placeholder
- Integrate Google Places API:
  - Create service: services/googlePlaces.ts
  - Functions: searchNearbyActivities(), getPlaceDetails(), getPlacePhotos()
- Build recommendation algorithm:
  - Create service: services/recommendations.ts
  - Implement scoring logic
  - Mock OpenAI explanations initially
- Connect to Supabase:
  - Fetch user preferences
  - Save recommendations to DB
  - Track views/accepts/declines
- "Add to Calendar" functionality

### Day 6-7: Calendar Screen & Loop Visualization
- Build calendar view:
  - Use react-native-calendars library
  - Display tasks with color-coded dots
  - Tap day to see tasks
- Manual task creation:
  - Modal form: title, time, location
  - Default locations: Home, Work
  - Save to DB
- Loop View (map visualization):
  - Use React Native Maps
  - Plot all day's tasks as markers
  - Draw polyline connecting tasks
  - Show route distance/time
- Swipe navigation: swipe left from Feed → Calendar

### Day 8-9: Friends Screen & Group Planning
- Build friends list:
  - FlatList with profile pics, names, Loop Scores
  - "Add Friend" button → search modal
  - Tap friend → view their Loop
- Friend search & add:
  - Search by email/phone
  - Send friend request
  - Accept/decline requests
- Basic group planning:
  - "Create Group Plan" flow
  - Select friends (multi-select)
  - Algorithm calculates midpoint using PostGIS
  - Show top 3 activity suggestions
  - Create plan, send invitations
- Swipe navigation: swipe right from Feed → Friends

### Day 10: Polish, Testing, & Demo Prep
- Bug fixes from testing
- UI polish:
  - Loading states (skeletons)
  - Empty states
  - Error handling
- Deploy backend to Render
- Create Expo development build
- Prepare demo:
  - Record screen recording
  - Create slide deck
  - Document what's left for launch

---

## GROWTH & GO-TO-MARKET STRATEGY

### Phase 1: Launch (Month 1-3) - Prove Product-Market Fit
**Target:** 1,000 active users, 10 businesses

**User Acquisition (Organic):**
- Beta launch in one city: Start with Dallas/Austin
- Post in local Facebook groups, Reddit
- Campus outreach (college students)
- Invite-only friends feature
- Content marketing: Blog, TikTok, Instagram, YouTube

**Business Acquisition:**
- Direct outreach: Email 100 local businesses
- Self-service signup: Stripe-powered
- Case study: First business success testimonial

**Success Metrics:**
- 20% weekly user growth (organic)
- 25% recommendation acceptance rate
- 70% user satisfaction (thumbs up rate)
- 5% conversion to Loop Plus

### Phase 2: Viral Growth (Month 4-6) - Social Features Drive Adoption
**Target:** 10,000 active users, 50 businesses

**Viral Mechanisms:**
- Referral program: $5 credit for both parties
- Group activity invites to non-users (SMS)
- Social sharing: "Share your Loop" feature
- Leaderboard among friends

**Paid Acquisition:**
- Facebook/Instagram ads ($500/month budget)
- Target: <$3 cost per install
- A/B test ad creative

**PR & Partnerships:**
- Product Hunt launch
- Tech blogs: TechCrunch, The Verge
- Local media partnerships
- Eventbrite, Meetup cross-promotion

**Success Metrics:**
- 40% monthly user growth
- 30% recommendation acceptance rate
- 10% conversion to Loop Plus
- K-factor >1 (viral coefficient)

### Phase 3: Scale & Monetize (Month 7-12) - Multi-City Expansion
**Target:** 50,000 active users, 200+ businesses

**Geographic Expansion:**
- Launch in 5 new cities: SF, LA, NYC, Chicago, Miami
- Playbook per city:
  1. Seed 50-100 users via targeted ads
  2. Onboard 10 businesses before launch
  3. Local influencer partnerships
  4. City-specific content

**Advanced Monetization:**
- Launch affiliate partnerships (OpenTable, Uber, Fandango)
- Premium tier push (multi-day itineraries, AI concierge)
- Business upsells (premium analytics, API access)

**B2B Partnerships:**
- Tourism boards: License Loop data
- Real estate developers: Foot traffic reports
- Urban planners: Activity pattern analysis

**Success Metrics:**
- 100K total users across 5 cities
- 35% recommendation acceptance rate
- 12% conversion to paid tiers
- $33K-40K MRR ($400K-480K annual revenue)
- $27K-34K monthly profit

### Phase 4: Exit Strategy (Year 2-3)

**Potential Acquirers:**
1. **Google** (Google Maps integration) - $50-150M valuation
2. **Apple** (Siri enhancement) - $100-300M valuation
3. **Uber/Lyft** (destination suggestions) - $30-80M valuation
4. **Meta/Facebook** (Events + social) - $75-200M valuation
5. **Airbnb/Expedia** (travel planning) - $40-120M valuation

**Acquisition Readiness:**
- Clean, well-documented codebase
- Strong unit economics: LTV:CAC >5:1
- Proven algorithm: Year-over-year improvement
- Proprietary dataset: Millions of feedback data points
- Strong retention: 60%+ month-over-month
- Revenue: $3-5M ARR minimum

**Alternative: Series A Fundraising**
- If growth strong but not acquisition-ready
- Raise $5-10M Series A
- Expand to 20+ cities, hire ML team
- Valuation: $30-50M post-money

---

## KEY DESIGN PRINCIPLES & BEST PRACTICES

### User Experience (UX)

1. **Minimize friction everywhere:**
   - Adding activity to calendar: 1 tap
   - Accepting group invite: 1 tap
   - Giving feedback: 1 tap
   - Never ask for info you can infer

2. **Trust through transparency:**
   - Sponsored activities clearly labeled
   - Explain WHY each suggestion was made
   - Show what data you're collecting
   - Allow users to delete their data easily

3. **Delight in small moments:**
   - Celebrate milestones
   - Personalized messages
   - Easter eggs for power users
   - Beautiful animations

4. **Mobile-first, always:**
   - Large tap targets (44x44pt minimum)
   - Thumb-friendly navigation
   - Offline mode
   - Fast load times

### Algorithm Design

1. **Balance user satisfaction with business value:**
   - Never sacrifice user trust for short-term revenue
   - If sponsored activity gets <70% satisfaction, reduce boost
   - Monitor algorithm fairness

2. **Continuous learning:**
   - Retrain models weekly
   - A/B test algorithm changes
   - Track cohort performance

3. **Diversity in suggestions:**
   - Don't show same category 3 times in a row
   - Introduce new interests occasionally
   - Balance safe suggestions with exploration

4. **Context awareness:**
   - Weather, time, social context, user energy

### Business Model

1. **Freemium with real value:**
   - Free tier must be genuinely useful
   - Paid tiers unlock convenience, not core features
   - Clear upgrade prompts at natural moments

2. **Business subscriptions priced for ROI:**
   - $49/month must generate $250-500 for business (5-10x ROI)
   - Show businesses the math
   - Offer 30-day free trial

3. **Align incentives:**
   - We win when users find great activities → businesses get customers

### Privacy & Ethics

1. **Data minimization:**
   - Only collect necessary data
   - Don't sell user data (ever)
   - Anonymous aggregates only for B2B

2. **Informed consent:**
   - Clear explanations
   - Granular controls
   - Easy opt-out

3. **Algorithmic fairness:**
   - Don't discriminate by demographics
   - Audit for bias
   - Publish algorithm principles

### Technical Excellence

1. **Performance:**
   - API response time: <200ms
   - App launch time: <2 seconds
   - Battery drain: Minimal
   - Offline mode

2. **Reliability:**
   - 99.9% uptime
   - Graceful degradation
   - Never crash

3. **Security:**
   - HTTPS everywhere
   - JWT tokens with short expiry
   - Rate limiting
   - Stripe for payments

4. **Scalability:**
   - Horizontal scaling
   - Database optimization
   - Caching with Redis
   - CDN for images

---

## CRITICAL SUCCESS FACTORS

### What Must Go Right (Non-Negotiables)

1. **Recommendation accuracy:**
   - If users don't accept 25%+ of suggestions, algorithm failed
   - Weekly monitoring of acceptance rate

2. **Viral growth:**
   - If K-factor <0.8, we're not growing organically
   - Group features MUST drive invites

3. **Business ROI:**
   - If businesses don't see 5x+ ROI, they'll churn
   - Track conversions accurately

4. **User retention:**
   - Day 7 retention must be >50%
   - Day 30 retention must be >30%

### What Could Go Wrong (Risk Mitigation)

**Risk 1: Low recommendation acceptance (<20%)**
- Mitigation: More aggressive feedback collection, better interest tagging
- Pivot: Human-curated city guides

**Risk 2: Privacy backlash**
- Mitigation: Clear privacy controls, transparent data policy
- Pivot: Location-optional mode

**Risk 3: Businesses don't see ROI**
- Mitigation: Better targeting, track actual visits
- Pivot: Pay per conversion model

**Risk 4: Slow user growth**
- Mitigation: Stronger referral incentives, paid ads
- Pivot: Focus on B2B (tourism boards, event organizers)

**Risk 5: Competition (Google/Apple)**
- Mitigation: Move fast, build proprietary dataset
- Pivot: Position for acquisition

---

## PRIVACY & SAFETY CONTROLS

### Group Invite Privacy System

**Privacy Settings (Add to users.privacy_settings JSONB):**
```json
{
  "group_invite_settings": {
    "who_can_invite": "friends",
    "require_mutual_friends": false,
    "blocked_from_invites": [],
    "auto_decline_from_strangers": true,
    "notification_preferences": {
      "group_invites": true,
      "new_friend_in_group": true
    }
  }
}
```

**Privacy Options:**

**who_can_invite (Default: "friends"):**
- "everyone" - Any Loop user can invite you (Phase 3)
- "friends" - Only accepted friends
- "close_friends" - Only users in "Close Friends" group
- "no_one" - Completely disable group invites

**require_mutual_friends (Default: false):**
- Only accept invites from people who share at least 1 friend

**blocked_from_invites:**
- Array of user IDs specifically blocked from inviting you

**auto_decline_from_strangers (Default: true):**
- Auto-set RSVP to "declined" for non-friend invites

**Safety Features:**
- Safe defaults (friends-only)
- Granular controls (4 levels of restriction)
- Block specific users
- Auto-decline strangers
- Mutual friends requirement
- Transparency (notify about non-friends in group)

---

## MACHINE LEARNING ARCHITECTURE (In-House)

### Philosophy: Start Simple, Scale with Data

**Why In-House ML Works for Loop (1-100K Users):**
Your competitive advantages:
- Behavioral data (what users actually do)
- Contextual signals (time, location, weather, social)
- Explicit feedback (thumbs up/down with tags)
- Continuous learning (algorithm improves daily)

### Three-Stage ML Evolution

**Stage 1: Rule-Based (MVP - Month 1-3, 1-1K users)**
- 90% scoring rules, 10% collaborative filtering
- Focus: Get basics right (distance, interest match, price)
- No training required, works immediately

**Stage 2: Hybrid (Growth - Month 4-12, 1K-50K users)**
- 40% scoring rules, 60% collaborative filtering
- Retrain models weekly
- Add contextual boosting (time, weather)
- Algorithm visibly improves over time

**Stage 3: Advanced ML (Scale - Year 2+, 50K+ users)**
- Deep learning for real-time personalization
- Predictive models (anticipate user needs)
- Multi-armed bandit for exploration vs exploitation

### MVP Algorithm Stack (All In-House, Low Cost)

**Components:**

1. **Scoring Engine (Rule-Based)**
   - Language: Python (FastAPI) or Node.js
   - Logic: Calculate base score for each activity
   - Cost: Free (part of backend server)

2. **Collaborative Filtering (Scikit-learn)**
   - Algorithm: Non-negative Matrix Factorization (NMF)
   - Training: Weekly batch job (5-10 min on $25/month server)
   - Purpose: "Users like you also liked..."
   - Works with: 50+ users, 5+ feedback points each
   - Cost: Free (open source)

3. **Context Boosting (Rules)**
   - Weather API (OpenWeather - free tier)
   - Time of day patterns (stored in user.ai_profile)
   - Location awareness (PostGIS queries)
   - Cost: $0-5/month

4. **Natural Language Explanations (OpenAI API)**
   - Generate human-readable reasons for suggestions
   - Example: "Based on your love of live music..."
   - Cost: $0.03 per 1K tokens (~$50-200/month for 1K-10K users)

**Total ML Infrastructure Cost: $75-250/month**

### Cold Start Strategy (New Users, No Feedback Yet)

**Solution: Content-Based Fallback**
- Rely heavily on stated interests from onboarding
- Weight interest match higher (60% vs 40%)
- Use popular activities (high ratings, many reviews)
- Introduce variety (show all interest categories)

### Algorithm Performance Monitoring

**Track daily:**
- Recommendation acceptance rate (target: 25-35%)
- Thumbs up rate on completed activities (target: 70%+)
- Sponsored activity acceptance rate (target: 15-20%)
- User retention Day 7/30 (target: 50%/30%)

**Weekly reviews:**
- A/B test scoring weights
- Analyze low-performing categories
- Identify patterns in thumbs-down feedback
- Retrain collaborative model

**Monthly audits:**
- Algorithmic fairness check
- Business satisfaction survey
- User satisfaction survey

---

## DEVELOPMENT STRATEGY: PARALLEL CLAUDE CODE AGENTS

### Architecture: 6 Specialized Agents Working in Parallel

To maximize development speed and maintain clean separation of concerns, use **6 parallel Claude Code instances**, each responsible for a specific part of the codebase.

**Why This Approach:**
- Faster development (work on multiple components simultaneously)
- Better context management (each agent specializes in one area)
- Cleaner code (separation of concerns)
- Easier debugging (isolate issues to specific agents)

### Agent Structure:

**Agent 1: Root/Architecture (Project Root)**
- **Location:** `/LoopApp/` (project root)
- **Responsibilities:**
  - Overall architecture decisions
  - CLAUDE.md maintenance (this file)
  - Documentation
  - Project roadmap
  - Deployment configuration
  - CI/CD setup
  - Integration between all components
- **Key Files:** `CLAUDE.md`, `README.md`, `package.json`, `.github/workflows/`

**Agent 2: Frontend/Mobile (React Native)**
- **Location:** `/LoopApp/mobile/` or `/LoopApp/app/`
- **Responsibilities:**
  - React Native components
  - Expo configuration
  - UI/UX implementation
  - Navigation (Expo Router)
  - State management
  - Mobile-specific features (camera, location, notifications)
  - Screens: Recommendation Feed, Calendar, Friends
- **Key Files:** `/app/**/*.tsx`, `/components/**/*.tsx`, `app.json`

**Agent 3: Backend API (Node.js/Express)**
- **Location:** `/LoopApp/backend/` or `/LoopApp/api/`
- **Responsibilities:**
  - REST API endpoints
  - Business logic
  - API route handlers
  - Middleware (auth, rate limiting)
  - External API integrations (Google Places, OpenWeather)
  - Stripe webhook handlers
- **Key Files:** `/routes/**/*.ts`, `/controllers/**/*.ts`, `/middleware/**/*.ts`, `server.ts`

**Agent 4: Database & Migrations (Supabase/PostgreSQL)**
- **Location:** `/LoopApp/database/` or `/LoopApp/supabase/`
- **Responsibilities:**
  - Database schema design
  - SQL migrations
  - PostGIS queries
  - Database indexes optimization
  - Seed data
  - Backup/restore scripts
- **Key Files:** `/migrations/*.sql`, `/seeds/*.sql`, `schema.sql`

**Agent 5: ML/Recommendation Engine (Python)**
- **Location:** `/LoopApp/ml-engine/` or `/LoopApp/recommendations/`
- **Responsibilities:**
  - Recommendation algorithm (scoring, collaborative filtering)
  - Python microservice (FastAPI)
  - Scikit-learn model training
  - Batch jobs (weekly model retraining)
  - Algorithm performance monitoring
- **Key Files:** `recommendation_engine.py`, `collaborative_filtering.py`, `train_model.py`

**Agent 6: Business Logic & Services (Shared)**
- **Location:** `/LoopApp/services/` or `/LoopApp/lib/`
- **Responsibilities:**
  - Shared business logic
  - Service layer (Google Places, OpenAI, Stripe)
  - Utility functions
  - Type definitions (TypeScript interfaces)
  - Constants and configuration
- **Key Files:** `/services/**/*.ts`, `/types/**/*.ts`, `/utils/**/*.ts`

### How to Use Multiple Agents:

**Step 1: Set Up Project Structure**
```
LoopApp/
├── CLAUDE.md (root - shared by all agents)
├── mobile/ (Agent 2: Frontend)
├── backend/ (Agent 3: Backend API)
├── database/ (Agent 4: Database)
├── ml-engine/ (Agent 5: ML/Recommendations)
├── services/ (Agent 6: Shared Services)
└── README.md
```

**Step 2: Open 6 Terminal Windows (One Per Agent)**

Terminal 1 (Root):
```bash
cd /path/to/LoopApp
claude-code
```

Terminal 2 (Frontend):
```bash
cd /path/to/LoopApp/mobile
claude-code
```

Terminal 3 (Backend):
```bash
cd /path/to/LoopApp/backend
claude-code
```

Terminal 4 (Database):
```bash
cd /path/to/LoopApp/database
claude-code
```

Terminal 5 (ML Engine):
```bash
cd /path/to/LoopApp/ml-engine
claude-code
```

Terminal 6 (Services):
```bash
cd /path/to/LoopApp/services
claude-code
```

**Step 3: Each Agent Has Context**

Before starting work in each terminal, tell the agent:
```
I'm working on [Frontend/Backend/Database/ML/Services] for the Loop app.
Read ../CLAUDE.md for full project context. Focus on [specific component].
```

**Step 4: Coordinate Between Agents**

When one agent needs something from another:

Example: Frontend agent needs new API endpoint

Frontend Agent: "I need a POST /api/recommendations/:id/accept endpoint."

Then in Backend terminal:

Backend Agent: "Create POST /api/recommendations/:id/accept endpoint
that marks recommendation as accepted and adds activity to calendar."

### Agent Communication Protocol

Since agents can't directly talk to each other, YOU act as coordinator.

**Workflow Example (Building Recommendation Feed):**

1. Root Agent: "Set up project structure, create folder hierarchy"
2. Database Agent: "Create recommendations, activities, feedback tables"
3. Backend Agent: "Create GET /api/recommendations endpoint"
4. ML Agent: "Build recommendation scoring algorithm"
5. Services Agent: "Create Google Places API integration service"
6. Frontend Agent: "Build recommendation feed UI that calls GET /api/recommendations"

### When to Use Single vs Multiple Agents

**Use Single Agent (Root) When:**
- Setting up initial project structure
- Making architecture decisions
- Updating CLAUDE.md
- Coordinating complex features across multiple components

**Use Multiple Agents When:**
- Building separate features in parallel
- You're in "heads-down coding" mode
- Each component is well-defined
- You want maximum speed

### Best Practices:

- Keep CLAUDE.md in sync
- Use Git branches: Each agent works on separate branch
- Share types/interfaces: Define in /services/types/
- Test integration frequently
- Document inter-agent dependencies

### 10-Day Sprint Using Multi-Agent Approach:

**Day 1-2: Setup (Use Root + Database Agents)**
- Root: Project scaffolding, dependencies, config
- Database: Schema creation, Supabase setup

**Day 3-5: Recommendation Feed (Use 4 Agents in Parallel)**
- Frontend: Build UI components
- Backend: Create recommendation endpoints
- ML: Build scoring algorithm
- Services: Google Places integration

**Day 6-7: Calendar Screen (Use 3 Agents)**
- Frontend: Calendar UI + Loop visualization
- Backend: Calendar CRUD endpoints
- Database: Optimize calendar queries

**Day 8-9: Friends Screen (Use 3 Agents)**
- Frontend: Friends list + group planning UI
- Backend: Friend/group endpoints
- ML: Group midpoint optimization

**Day 10: Integration (Use Root Agent)**
- Coordinate final integration
- Testing across all components
- Bug fixes
- Deploy

---

## IMMEDIATE NEXT STEPS

### After This Prompt:

1. **Start Day 1 tasks:**
   - Set up Supabase project
   - Create database schema
   - Initialize Expo project

2. **By end of Day 2:**
   - Working authentication (email + Google)
   - Database tables created with indexes
   - Basic app navigation (3 empty screens)

3. **By end of Day 5:**
   - Recommendation feed showing mock activities
   - Google Places API integrated
   - Basic scoring algorithm working

4. **By end of Day 10:**
   - Full 3-screen app with swipe navigation
   - Recommendation feed + Calendar + Friends screens
   - Ready to demo to mentor

### Budget Reality Check (10-Day Sprint):
- Claude Code API usage: $40-60 (10-15 hours of coding assistance)
- Google Places API: $0 (free tier covers MVP testing)
- Supabase: $0 (free tier)
- Render hosting: $0 (free tier for testing)
- **Total cost: $40-60** (entirely Claude Code usage)

### After 10 days, you'll have:
- Working prototype to show mentor ✓
- MTurk validation data (if AWS approved) ✓
- Clear roadmap for next 30 days ✓
- Fundable startup with proven concept ✓

---

**This CLAUDE.md file is the complete blueprint for building Loop from idea to Series A exit. Follow this document for all development decisions, architecture choices, and strategic planning.**
