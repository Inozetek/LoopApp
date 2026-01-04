# Feed Optimization & New Data Sources Roadmap

**Priority:** HIGH (Everything flows from the feed)
**Updated:** 2026-01-03

---

## 🎯 Phase 1: Feed Core Optimization (HIGHEST PRIORITY)

### 1.1 Scrolling & Loading Performance
**Goal:** Buttery smooth 60fps scrolling, instant loads

**Tasks:**
- [ ] Implement FlatList optimization (windowSize, maxToRenderPerBatch)
- [ ] Add React.memo() to ActivityCard components
- [ ] Lazy load images (only load when in viewport)
- [ ] Implement recommendation caching (Redis/AsyncStorage)
- [ ] Prefetch next page of recommendations before user reaches bottom
- [ ] Add loading skeletons (Shimmer effect while loading)
- [ ] Optimize image sizes (compress, use CDN)

**Success Metrics:**
- First load < 3 seconds
- 60fps scrolling (no dropped frames)
- Infinite scroll feels instant

---

### 1.2 Intelligent Recommendation Generation
**Goal:** Smart, diverse, relevant recommendations that learn from user behavior

**Tasks:**
- [ ] **Diversity Algorithm**: Enforce "no more than 2 cards from same category in top 10"
- [ ] **De-duplication Logic**: Track shown places in session, never show twice
- [ ] **Freshness Factor**: Prioritize places user hasn't seen in last 7 days
- [ ] **Time-Based Scoring**: Coffee shops ranked higher in morning, bars in evening
- [ ] **Location Clustering**: Group nearby places, show best from each cluster
- [ ] **Novelty Boost**: Occasionally inject "discovery" places outside top interests
- [ ] **Trending Boost**: Recently opened places (< 6 months) get +5 points

**Algorithm Improvements:**
```typescript
// Current: Simple scoring (base + location + time + feedback)
// Future: Multi-stage ranking pipeline

Stage 1: Candidate Generation (200 places)
  → Query Google Places API with broad filters

Stage 2: Filtering (100 places)
  → Remove generic chains (unless user favorites them)
  → Remove previously declined places
  → Remove places outside preferred distance

Stage 3: Diversity Enforcement (50 places)
  → Cluster by location (max 3 per cluster)
  → Balance categories (no more than 30% from one category)

Stage 4: Personalized Ranking (20 places)
  → Score based on user interests, feedback history
  → Boost sponsored places (with cap)

Stage 5: Final Selection (10 places)
  → Re-rank for diversity (alternate categories)
  → Inject 1-2 "discovery" places
```

**Success Metrics:**
- 80%+ of recommendations are relevant (user doesn't skip them)
- At least 4 different categories in top 10
- No duplicate places in feed
- 25%+ acceptance rate (user adds to calendar)

---

### 1.3 Intelligent Clearing & State Management
**Goal:** Clean, persistent feed state that respects user actions

**Tasks:**
- [ ] **Clear After Add**: Remove card from feed when added to calendar
- [ ] **Clear After Decline**: Remove card when user taps "Not Interested"
- [ ] **Persist Declined Places**: Save to `blocked_places` table, never show again
- [ ] **Refresh Logic**: Pull-to-refresh generates NEW recommendations (not same ones)
- [ ] **Session Persistence**: Save feed state to AsyncStorage, restore on app restart
- [ ] **Smart Pagination**: Load 10 cards initially, fetch 10 more when scrolling near bottom
- [ ] **Background Refresh**: Generate recommendations in background (while user is on calendar screen)

**Database Schema Addition:**
```sql
-- Track user actions on recommendations
CREATE TABLE recommendation_interactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  place_id TEXT NOT NULL,
  action VARCHAR(20) CHECK (action IN ('viewed', 'added', 'declined', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interactions_user ON recommendation_interactions(user_id, action);

-- Blocked places (user said "Not Interested")
CREATE TABLE blocked_places (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  place_id TEXT NOT NULL,
  place_name TEXT,
  reason TEXT, -- "too_expensive", "too_far", "not_my_vibe", etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, place_id)
);
```

**Success Metrics:**
- Cards disappear immediately after user action
- Pull-to-refresh shows 100% new places
- Feed state persists across app restarts
- No memory leaks after 20+ minutes of use

---

### 1.4 Calendar Integration Perfection
**Goal:** Flawless "Add to Calendar" flow with intelligent scheduling

**Tasks:**
- [ ] **Suggested Time Logic**: Calculate optimal visit time based on:
  - User's free time blocks (from calendar)
  - Place's opening hours
  - Travel time from previous event
  - Activity type (coffee = 1hr, dinner = 2hr, museum = 3hr)
  - Time of day preference (coffee in morning, dinner in evening)
- [ ] **Conflict Detection**: Check for overlapping events before suggesting time
- [ ] **Conflict Warning UI**: Show red warning if user picks conflicting time
- [ ] **Auto-Adjust Time**: If conflict, suggest next available slot
- [ ] **Commute Buffer**: Add 15-30 min travel time between events
- [ ] **Multi-Day Planning**: Allow adding events to future dates (not just today)
- [ ] **Batch Add**: Select multiple cards, add all to calendar with optimized routing

**Smart Scheduling Algorithm:**
```typescript
function suggestOptimalTime(place: Place, userCalendar: Event[]): TimeSlot {
  // 1. Get place's opening hours for next 7 days
  const openHours = getBusinessHours(place);

  // 2. Find user's free time blocks (gaps in calendar)
  const freeBlocks = findFreeTimeBlocks(userCalendar, next7Days);

  // 3. Filter free blocks that overlap with open hours
  const viableSlots = freeBlocks.filter(block =>
    overlaps(block, openHours) &&
    block.duration >= getTypicalDuration(place.category)
  );

  // 4. Score each slot based on:
  //    - Time of day match (coffee in AM = +20, bars in PM = +20)
  //    - Proximity to existing events (minimize commute = +15)
  //    - Avoid rush hour (avoid 8-9am, 5-6pm = +10)
  //    - User's historical preferences (if they always go to gym at 6pm = +25)

  const scoredSlots = viableSlots.map(slot => ({
    slot,
    score: scoreTimeSlot(slot, place, userCalendar, userPreferences)
  }));

  // 5. Return highest scoring slot
  return scoredSlots.sort((a, b) => b.score - a.score)[0].slot;
}
```

**Success Metrics:**
- 90%+ of suggested times are actually free (no conflicts)
- Suggested times respect business hours (100%)
- Users accept suggested time 70%+ of the time (rarely edit)
- Conflict warnings catch 100% of overlaps

---

## 🎯 Phase 2: New Data Sources Integration (AFTER FEED IS SOLID)

### 2.1 Eventbrite API Integration
**Goal:** Show local events, concerts, workshops, classes in feed

**Why:** Google Places doesn't show one-time events, Eventbrite fills this gap

**Implementation:**
```typescript
// services/eventbrite.ts
export async function searchEventbriteEvents(params: {
  location: { lat: number; lng: number };
  radius: number; // miles
  categories?: string[]; // "music", "food-and-drink", "arts", "sports"
  startDate?: Date;
  endDate?: Date;
}): Promise<Event[]> {
  const EVENTBRITE_API_KEY = process.env.EXPO_PUBLIC_EVENTBRITE_API_KEY;

  const response = await fetch(
    `https://www.eventbriteapi.com/v3/events/search/`, {
      params: {
        'location.latitude': params.location.lat,
        'location.longitude': params.location.lng,
        'location.within': `${params.radius}mi`,
        'start_date.range_start': params.startDate || new Date(),
        'start_date.range_end': params.endDate || addDays(new Date(), 30),
        token: EVENTBRITE_API_KEY,
      }
    }
  );

  return response.data.events.map(convertEventbriteToActivity);
}
```

**Feed Integration:**
- Mix Eventbrite events with Google Places results (20% events, 80% places)
- Tag event cards with "Event" badge
- Show event date/time prominently
- Link to Eventbrite ticket page

**Tasks:**
- [ ] Sign up for Eventbrite API key
- [ ] Create `services/eventbrite.ts` integration
- [ ] Add `Event` type to Activity interface
- [ ] Update recommendation engine to merge events + places
- [ ] Design event card UI (show date, ticket price, venue)
- [ ] Add "Get Tickets" button linking to Eventbrite

**Success Metrics:**
- Events appear in feed naturally (no separate section)
- Events are relevant (match user interests)
- Event cards are visually distinct (date/time badge)

---

### 2.2 Happy Hour & Local Offers APIs
**Goal:** Show time-sensitive deals, happy hours, limited-time offers

**Data Sources:**

1. **Yelp Fusion API** - Business deals and specials
   - Endpoint: `/v3/businesses/search`
   - Has `deals` field with active promotions
   - Shows happy hour times, discounts

2. **Foursquare Places API** - Specials and tips
   - Endpoint: `/v3/places/search`
   - Shows user tips about deals ("Happy hour 4-6pm")

3. **Custom Scraping** (Advanced)
   - Scrape restaurant websites for daily specials
   - Parse "Happy Hour" menus

**Implementation Priority:**
```
Phase 2.2A: Yelp Fusion API (easiest, has deals field)
Phase 2.2B: Foursquare tips parsing
Phase 2.2C: Custom scraping (if ROI is high)
```

**Feed Integration:**
- Show "Happy Hour Now!" badge on cards (4-6pm)
- Show "50% Off" badge for limited-time deals
- Sort deals higher during their active hours
- Expire cards after deal ends

**Tasks:**
- [ ] Sign up for Yelp Fusion API key
- [ ] Create `services/yelp.ts` integration
- [ ] Parse deals from Yelp response
- [ ] Add "deal_active" flag to Activity type
- [ ] Design deal badge UI (red "50% OFF" corner badge)
- [ ] Add time-based filtering (only show happy hour 4-7pm)
- [ ] Auto-remove expired deals from feed

**Success Metrics:**
- Deals are time-relevant (happy hour cards only show 4-7pm)
- Deal cards stand out visually (badges, colors)
- Users click on deals 30%+ more than regular cards

---

### 2.3 Ticketmaster API (Concerts, Sports, Theater)
**Goal:** Show live entertainment events in feed

**Why:** Complement Eventbrite with bigger ticketed events

**Implementation:**
```typescript
// services/ticketmaster.ts
export async function searchTicketmasterEvents(params: {
  location: { lat: number; lng: number };
  radius: number;
  categories?: string[]; // "music", "sports", "arts"
}): Promise<Event[]> {
  const TICKETMASTER_API_KEY = process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY;

  const response = await fetch(
    `https://app.ticketmaster.com/discovery/v2/events.json`, {
      params: {
        latlong: `${params.location.lat},${params.location.lng}`,
        radius: params.radius,
        unit: 'miles',
        apikey: TICKETMASTER_API_KEY,
      }
    }
  );

  return response.data._embedded.events.map(convertTicketmasterToActivity);
}
```

**Tasks:**
- [ ] Sign up for Ticketmaster API key
- [ ] Create `services/ticketmaster.ts` integration
- [ ] Add ticket price to Activity interface
- [ ] Update feed to show ticket pricing
- [ ] Add "Buy Tickets" button linking to Ticketmaster

---

### 2.4 Unified Feed Architecture (All Sources)
**Goal:** Seamless mixing of Google Places + Eventbrite + Yelp + Ticketmaster

**Architecture:**
```typescript
// services/unified-recommendations.ts

async function getUnifiedRecommendations(user: User): Promise<Activity[]> {
  // Fetch from all sources in parallel
  const [
    googlePlaces,
    eventbriteEvents,
    yelpDeals,
    ticketmasterEvents,
  ] = await Promise.all([
    searchGooglePlaces({ location, radius, interests }),
    searchEventbriteEvents({ location, radius, categories }),
    searchYelpDeals({ location, radius }),
    searchTicketmasterEvents({ location, radius }),
  ]);

  // Merge all results
  const allActivities = [
    ...googlePlaces,
    ...eventbriteEvents,
    ...yelpDeals,
    ...ticketmasterEvents,
  ];

  // Deduplicate (same venue might appear in Google + Yelp)
  const dedupedActivities = deduplicateByVenue(allActivities);

  // Score and rank
  const scoredActivities = dedupedActivities.map(activity => ({
    activity,
    score: scoreActivity(activity, user),
  }));

  // Sort by score
  scoredActivities.sort((a, b) => b.score - a.score);

  // Enforce diversity (max 20% events, 80% places)
  const diversified = enforceDiversity(scoredActivities, {
    maxEventPercentage: 0.2,
    maxCategoryPercentage: 0.3,
  });

  return diversified.slice(0, 20);
}
```

**Tasks:**
- [ ] Create `unified-recommendations.ts` service
- [ ] Implement deduplication logic (match by name + address)
- [ ] Add source attribution (show "via Eventbrite" on cards)
- [ ] Enforce diversity rules (20% events max)
- [ ] Update feed UI to handle different activity types
- [ ] Add filters for "Events Only", "Places Only", "Deals Only"

---

## 📊 Implementation Timeline

### Week 1: Feed Optimization
- Days 1-2: Scrolling performance + loading optimization
- Days 3-4: Intelligent recommendation generation
- Day 5: Clearing logic + state management
- Days 6-7: Calendar integration perfection + testing

### Week 2: New Data Sources
- Days 1-2: Eventbrite integration
- Days 3-4: Yelp deals integration
- Day 5: Ticketmaster integration
- Days 6-7: Unified feed architecture + testing

### Week 3: Polish & Testing
- Days 1-3: User testing + bug fixes
- Days 4-5: Performance optimization
- Days 6-7: Final QA + deployment prep

---

## 🎯 Success Criteria (How We Know We're Done)

**Feed Performance:**
- [ ] 60fps scrolling on mid-range Android phones
- [ ] < 3 second first load
- [ ] Zero crashes during 30-minute session

**Recommendation Quality:**
- [ ] 80%+ relevance (user doesn't skip)
- [ ] 25%+ acceptance rate (adds to calendar)
- [ ] 0 duplicate places in feed
- [ ] 4+ categories in top 10

**Calendar Integration:**
- [ ] 90%+ suggested times are conflict-free
- [ ] 70%+ users accept suggested time (don't edit)
- [ ] 100% conflict detection accuracy

**New Data Sources:**
- [ ] Events appear naturally in feed
- [ ] Deals show during active hours only
- [ ] Source attribution clear (user knows it's Eventbrite)
- [ ] No duplicate venues from multiple sources

---

**This roadmap gets the feed to production-quality, then expands it with rich data sources.** 🚀

**Let's test first, then tackle Phase 1!**
