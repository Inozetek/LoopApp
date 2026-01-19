# Loop App - Data Integration Roadmap for User Personas

**Date:** 2026-01-11
**Purpose:** Plan data sources and integrations to serve diverse user types in the recommendation feed

---

## 🎯 USER PERSONAS & THEIR DATA NEEDS

### 1. **The Sports Person & Outdoor Adventurer**
**Characteristics:** Likes outdoor activities, sporting events, fitness

**Data Sources Needed:**
- **Ticketmaster Sports API** ✅ ALREADY INTEGRATED
  - NFL, NBA, MLB, NHL, MLS games
  - College sports events
  - Minor league games
  - Motorsports (NASCAR, F1)

- **AllTrails API** (NEW - Priority: HIGH)
  - Hiking trails with difficulty ratings
  - Mountain biking trails
  - Running routes
  - Trail conditions and weather
  - User reviews and photos
  - Cost: $0 (free tier) → $49/mo (pro tier)

- **Meetup.com API** (NEW - Priority: MEDIUM)
  - Outdoor adventure groups
  - Hiking meetups
  - Cycling clubs
  - Rock climbing groups
  - Cost: Free API access

- **Active.com API** (NEW - Priority: MEDIUM)
  - 5K/10K races
  - Marathons and triathlons
  - Obstacle course races (Tough Mudder, Spartan)
  - Cycling events
  - Cost: Partnership required

- **REI Events API** (NEW - Priority: LOW)
  - Outdoor classes and workshops
  - Gear demos
  - Adventure trips
  - Cost: Partnership required

**Recommendation Strategy:**
- Surface nearby games/races in free time slots
- Suggest trails based on fitness level
- Notify about upcoming sports events
- Group activities: Hiking groups, pickup basketball

---

### 2. **The Movie-Goer & Entertainment Seeker**
**Characteristics:** Loves movies, concerts, live shows

**Data Sources Needed:**
- **Ticketmaster Entertainment API** ✅ ALREADY INTEGRATED
  - Concerts
  - Theater shows
  - Comedy clubs
  - Music festivals

- **Fandango API** (NEW - Priority: HIGH)
  - Movie showtimes at nearby theaters
  - New releases this week
  - Upcoming premieres
  - Ticket prices and availability
  - Cost: Affiliate partnership (earn 15% commission)

- **SeatGeek API** (NEW - Priority: MEDIUM)
  - Alternative to Ticketmaster (often cheaper tickets)
  - Concerts, sports, theater
  - Cost: Free API + affiliate commission

- **Songkick API** (NEW - Priority: HIGH)
  - Concert discovery based on Spotify listening history
  - Artist tour dates
  - Local venue listings
  - Cost: Free for non-commercial use

- **Netflix/Hulu Release Calendar** (NEW - Priority: LOW)
  - Suggest "movie night at home" for new releases
  - Integration via public RSS feeds or web scraping
  - Cost: $0

**Recommendation Strategy:**
- "New movies this weekend" notifications
- Suggest concerts by artists user likes (Spotify integration)
- Dinner + movie combos (restaurant near theater)
- Advance ticket booking reminders

---

### 3. **The Bar-Crawler & Restaurant-Goer**
**Characteristics:** Social, loves dining out, trying new places

**Data Sources Needed:**
- **Google Places API** ✅ ALREADY INTEGRATED
  - Restaurants, bars, cafes
  - Ratings, reviews, photos
  - Hours, price range

- **Yelp Fusion API** (NEW - Priority: HIGH)
  - Additional restaurant data (often more up-to-date than Google)
  - Special features: "Good for groups", "Outdoor seating"
  - Happy hour listings
  - Wait times
  - Cost: Free API with 5000 requests/day

- **OpenTable API** (NEW - Priority: HIGH)
  - Real-time reservation availability
  - Exclusive dining rewards
  - Waitlist management
  - Cost: Free API + 10% commission per reservation

- **HappyHourFinder API** (NEW - Priority: MEDIUM)
  - Bar specials and happy hours
  - Daily deals at restaurants
  - Cost: Web scraping or partnership

- **Thrillist / Eater RSS Feeds** (NEW - Priority: LOW)
  - "Best new restaurants" articles
  - Local food scene trends
  - Cost: $0 (public RSS)

**Recommendation Strategy:**
- Happy hour suggestions 4-6pm
- "Try this new restaurant" (opened <30 days ago)
- Group dinner planning with reservation booking
- Weekend brunch suggestions
- Dietary preference matching (vegan, gluten-free, etc.)

---

### 4. **The Site-Seer & Tourist**
**Characteristics:** Loves exploring landmarks, museums, attractions

**Data Sources Needed:**
- **Google Places API** ✅ ALREADY INTEGRATED
  - Tourist attractions, museums, landmarks

- **Viator / TripAdvisor API** (NEW - Priority: HIGH)
  - Tours and experiences
  - Museum tickets
  - City passes
  - Cost: Free API + 12% affiliate commission

- **Atlas Obscura API** (NEW - Priority: MEDIUM)
  - Unique hidden gems
  - Unusual attractions
  - Local secrets
  - Cost: Partnership required or web scraping

- **Official Tourism Board APIs** (NEW - Priority: MEDIUM)
  - City-specific events
  - Free museum days
  - Cultural festivals
  - Example: Visit Dallas, NYC Tourism, etc.
  - Cost: $0 (public data)

**Recommendation Strategy:**
- Multi-day itinerary planning for travelers
- "You're near [landmark]" location triggers
- Free museum days notifications
- Walking tour suggestions

---

### 5. **The Busy Parent & Chore-Runner**
**Characteristics:** Needs efficient routing, kid-friendly activities

**Data Sources Needed:**
- **Google Places API** ✅ ALREADY INTEGRATED
  - Grocery stores, pharmacies, banks
  - Kid-friendly restaurants
  - Parks and playgrounds

- **Target / Walmart / Kroger APIs** (NEW - Priority: LOW)
  - In-store pickup availability
  - Weekly sales
  - Cost: Partnership required

- **Eventbrite API** (NEW - Priority: HIGH)
  - Free community events
  - Library story time
  - Farmer's markets
  - Cost: Free API + 5-10% commission on paid events

- **Parks & Recreation Department APIs** (NEW - Priority: MEDIUM)
  - Youth sports leagues
  - Summer camps
  - Public pool hours
  - Cost: $0 (public data, city-specific)

**Recommendation Strategy:**
- Optimize chore routes: "Stop at Target on way home"
- "Kids are out of school - here are free activities"
- Weekend family activity suggestions
- Combine errands with kid activities

---

### 6. **The Social Teenager**
**Characteristics:** Hangout spots, trendy places, group activities

**Data Sources Needed:**
- **Google Places API** ✅ ALREADY INTEGRATED
  - Boba shops, arcades, malls
  - Ice cream shops, fast food

- **Snapchat Places / TikTok Trending Locations** (NEW - Priority: HIGH)
  - What's trending locally among teens
  - Viral food spots
  - Photo-worthy locations
  - Cost: Web scraping or social listening tools ($99-299/mo)

- **Eventbrite API** (NEW - Priority: MEDIUM)
  - All-ages concerts
  - Teen night at venues
  - Esports tournaments
  - Cost: Free API

- **Minecraft / Roblox Event APIs** (NEW - Priority: LOW)
  - In-person gaming events
  - Comic cons
  - Cost: Partnership required

**Recommendation Strategy:**
- "Your friends are here" social triggers
- Trendy food spot suggestions (viral TikTok places)
- Group hangout planning (arcade + boba)
- Budget-friendly suggestions ($0-$15)

---

### 7. **The Shopaholic College Daughter**
**Characteristics:** Shopping, fashion, beauty, social media

**Data Sources Needed:**
- **Google Places API** ✅ ALREADY INTEGRATED
  - Shopping malls, boutiques
  - Beauty salons, spas

- **RetailMeNot / Honey Deals API** (NEW - Priority: MEDIUM)
  - Store sales and discounts
  - Coupon codes
  - Cost: Affiliate partnership

- **Eventbrite API** (NEW - Priority: LOW)
  - Pop-up shops
  - Sample sales
  - Fashion shows
  - Cost: Free API

**Recommendation Strategy:**
- "Sale at [store] - 40% off your favorite brand"
- Shopping + lunch combo suggestions
- Spa day planning
- Instagram-worthy photo spots

---

### 8. **The Event-Attending Business Professional**
**Characteristics:** Networking events, conferences, professional development

**Data Sources Needed:**
- **Eventbrite API** (NEW - Priority: HIGH)
  - Business conferences
  - Networking happy hours
  - Industry meetups
  - Professional development workshops
  - Cost: Free API + 5-10% commission

- **Meetup.com API** (NEW - Priority: HIGH)
  - Professional networking groups
  - Tech meetups (e.g., React Native Dallas)
  - Industry-specific gatherings
  - Cost: Free API

- **LinkedIn Events** (NEW - Priority: MEDIUM)
  - Professional conferences
  - Career fairs
  - Company-hosted events
  - Cost: Partnership required

- **Convention Center / Hotel APIs** (NEW - Priority: LOW)
  - Large conferences and expos
  - Cost: Public calendar scraping

**Recommendation Strategy:**
- "Networking event near you tonight"
- Conference + hotel + restaurant planning
- "Your connections are attending [event]"
- Professional development suggestions based on job title

---

### 9. **The Studious Yet Social College Student**
**Characteristics:** Study spots, social events, budget-conscious

**Data Sources Needed:**
- **Google Places API** ✅ ALREADY INTEGRATED
  - Coffee shops, libraries
  - Cheap eats, student discounts

- **Eventbrite API** (NEW - Priority: HIGH)
  - Campus events
  - Student organization activities
  - Free concerts and shows
  - Cost: Free API

- **University Event Calendars** (NEW - Priority: MEDIUM)
  - Campus lectures
  - Student performances
  - Career fairs
  - Cost: $0 (public calendar scraping)

- **StudyBreak / SpareRoom APIs** (NEW - Priority: LOW)
  - Study groups
  - Roommate-finding events
  - Cost: Partnership required

**Recommendation Strategy:**
- Quiet study spots with WiFi
- Free/cheap campus events
- Group study session planning
- "Study break" suggestions (coffee nearby)

---

### 10. **The Business Traveler & World Traveler**
**Characteristics:** Efficient, seeking best local experiences

**Data Sources Needed:**
- **Google Places API** ✅ ALREADY INTEGRATED
  - Hotels, airports, coworking spaces

- **Airbnb Experiences API** (NEW - Priority: HIGH)
  - Local tours and activities
  - Cooking classes
  - Cultural experiences
  - Cost: Free API + 3-5% affiliate commission

- **TripAdvisor / Viator API** (NEW - Priority: HIGH)
  - Tours, day trips
  - Skip-the-line tickets
  - Multi-day packages
  - Cost: Free API + 12% commission

- **Lounge Buddy / Priority Pass APIs** (NEW - Priority: LOW)
  - Airport lounge access
  - Cost: Partnership required

- **WorkFrom / Coworker APIs** (NEW - Priority: LOW)
  - Best coworking spaces
  - Remote work-friendly cafes
  - Cost: Partnership or web scraping

**Recommendation Strategy:**
- Multi-day itinerary planning
- "You have 4 hours between meetings - visit [museum]"
- Hotel + restaurant + activity combos
- Local hidden gems near hotel

---

## 📊 DATA INTEGRATION PRIORITY MATRIX

| Data Source | User Personas Served | Priority | Cost | Commission | Time to Integrate |
|-------------|---------------------|----------|------|------------|-------------------|
| **Yelp Fusion API** | Bar-crawler, Restaurant-goer, Busy Parent | HIGH | $0 | N/A | 1 week |
| **Fandango API** | Movie-goer | HIGH | $0 | 15% | 1 week |
| **OpenTable API** | Restaurant-goer | HIGH | $0 | 10% | 2 weeks |
| **Eventbrite API** | All personas (events) | HIGH | $0 | 5-10% | 1 week |
| **Meetup.com API** | Sports person, Business pro, Student | HIGH | $0 | N/A | 1 week |
| **Songkick API** | Movie-goer, Teenager | HIGH | $0 | N/A | 1 week |
| **Airbnb Experiences** | Traveler, Site-seer | HIGH | $0 | 3-5% | 2 weeks |
| **Viator / TripAdvisor** | Traveler, Site-seer | HIGH | $0 | 12% | 2 weeks |
| **AllTrails API** | Sports person, Outdoor adventurer | MEDIUM | $49/mo | N/A | 1 week |
| **SeatGeek API** | Movie-goer | MEDIUM | $0 | Yes | 1 week |
| **HappyHourFinder** | Bar-crawler | MEDIUM | TBD | N/A | 2 weeks |
| **Social Media Trending** | Teenager, Shopaholic | HIGH | $99-299/mo | N/A | 3 weeks |
| **RetailMeNot / Honey** | Shopaholic | MEDIUM | $0 | Yes | 1 week |
| **University Calendars** | Student | MEDIUM | $0 | N/A | 1 week (per uni) |
| **Tourism Board APIs** | Site-seer, Traveler | MEDIUM | $0 | N/A | 1 week (per city) |

---

## 🚀 PHASED ROLLOUT PLAN

### Phase 1: Month 1-2 (Immediate Value)
**Goal:** Add 3-5 high-impact data sources for most common user types

**Integrations:**
1. **Yelp Fusion API** - Restaurant reviews, happy hours
2. **Eventbrite API** - Events for all personas
3. **Meetup.com API** - Group activities
4. **Fandango API** - Movie showtimes
5. **OpenTable API** - Restaurant reservations

**Why These First:**
- Free APIs (low risk)
- High commission potential (OpenTable 10%, Fandango 15%)
- Serve 80% of user personas
- Quick integration (1-2 weeks each)

**Expected Impact:**
- 40% increase in recommendation diversity
- 25% increase in acceptance rate (more relevant suggestions)
- $500-1,000/month affiliate revenue from OpenTable + Fandango

---

### Phase 2: Month 3-4 (Traveler Focus)
**Goal:** Make Loop the go-to travel companion

**Integrations:**
1. **Airbnb Experiences API** - Local tours
2. **Viator / TripAdvisor API** - Tourist activities
3. **Songkick API** - Concert discovery
4. **AllTrails API** - Outdoor adventures

**Why These Second:**
- High commission potential (Viator 12%, Airbnb 3-5%)
- Serve high-value travelers (spend more)
- Expand Loop's use case beyond daily activities

**Expected Impact:**
- 30% increase in user engagement for travelers
- $1,000-2,000/month affiliate revenue from tours/experiences
- Position Loop as "TripAdvisor meets AI"

---

### Phase 3: Month 5-6 (Niche Personas)
**Goal:** Serve every user type with tailored data

**Integrations:**
1. **Social Media Trending API** - Viral spots for teens
2. **LinkedIn Events / Business Networking**
3. **University Event Calendars** (top 10 campuses)
4. **HappyHourFinder** - Drink specials
5. **RetailMeNot** - Shopping deals

**Why These Third:**
- More complex integrations (social listening tools)
- Niche but high-engagement audiences (teens, students, professionals)
- Requires custom scrapers and partnerships

**Expected Impact:**
- 100% persona coverage (every user type served)
- 15% increase in younger user adoption (13-25 age group)
- Viral potential (teens share trendy spots on social media)

---

## 🏗️ TECHNICAL IMPLEMENTATION PLAN

### Database Schema Updates

**New Table: `data_sources`**
```sql
CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name VARCHAR(100) NOT NULL, -- 'yelp', 'eventbrite', 'fandango', etc.
  api_endpoint TEXT,
  api_key_env_var VARCHAR(100), -- Environment variable name
  rate_limit_per_hour INTEGER,
  cost_per_1000_requests DECIMAL(6,2),
  commission_rate DECIMAL(5,2), -- e.g., 0.15 for 15%
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New Table: `user_persona_preferences`**
```sql
CREATE TABLE user_persona_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_type VARCHAR(50) NOT NULL, -- 'sports_person', 'movie_goer', etc.
  confidence_score DECIMAL(3,2), -- How confident we are (0.0-1.0)
  data_sources JSONB DEFAULT '[]'::jsonb, -- Preferred data sources for this persona
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_persona_user ON user_persona_preferences(user_id);
```

**Update `activities` Table:**
```sql
ALTER TABLE activities
ADD COLUMN source_api VARCHAR(50), -- 'google_places', 'yelp', 'eventbrite', etc.
ADD COLUMN source_metadata JSONB DEFAULT '{}'::jsonb, -- Store source-specific data
ADD COLUMN commission_eligible BOOLEAN DEFAULT FALSE,
ADD COLUMN commission_rate DECIMAL(5,2),
ADD COLUMN affiliate_link TEXT;

CREATE INDEX idx_activities_source ON activities(source_api);
```

---

### Service Layer Architecture

**New File: `services/data-aggregator.ts`**
```typescript
/**
 * Data Aggregator Service
 *
 * Fetches and normalizes data from multiple sources:
 * - Google Places API
 * - Yelp Fusion API
 * - Eventbrite API
 * - Ticketmaster API
 * - Fandango API
 * - OpenTable API
 * - etc.
 *
 * Returns unified Activity[] format
 */

import { Activity } from '@/types/activity';
import { searchGooglePlaces } from './google-places';
import { searchYelpPlaces } from './yelp-fusion';
import { searchEventbriteEvents } from './eventbrite';
import { searchTicketmasterEvents } from './ticketmaster-service';

export interface DataSourceConfig {
  name: string;
  enabled: boolean;
  weight: number; // 0.0-1.0 (how much to prioritize this source)
  maxResults: number;
}

export async function aggregateActivities(
  location: { latitude: number; longitude: number },
  userPersona: string[], // e.g., ['sports_person', 'movie_goer']
  preferences: any
): Promise<Activity[]> {
  const allActivities: Activity[] = [];

  // Determine which data sources to query based on user persona
  const sources = getDataSourcesForPersona(userPersona);

  // Fetch from all sources in parallel
  const promises = sources.map(source => {
    switch (source.name) {
      case 'google_places':
        return searchGooglePlaces(location, preferences);
      case 'yelp':
        return searchYelpPlaces(location, preferences);
      case 'eventbrite':
        return searchEventbriteEvents(location, preferences);
      case 'ticketmaster':
        return searchTicketmasterEvents(location, preferences);
      default:
        return Promise.resolve([]);
    }
  });

  const results = await Promise.allSettled(promises);

  // Aggregate results
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const activities = result.value;
      allActivities.push(...activities);
    } else {
      console.error(`Data source ${sources[index].name} failed:`, result.reason);
    }
  });

  // Deduplicate (same place may appear in multiple sources)
  const deduped = deduplicateActivities(allActivities);

  return deduped;
}

function getDataSourcesForPersona(personas: string[]): DataSourceConfig[] {
  const sourceMap: Record<string, DataSourceConfig[]> = {
    sports_person: [
      { name: 'ticketmaster', enabled: true, weight: 1.0, maxResults: 20 },
      { name: 'meetup', enabled: true, weight: 0.8, maxResults: 10 },
      { name: 'alltrails', enabled: true, weight: 0.9, maxResults: 10 },
    ],
    movie_goer: [
      { name: 'fandango', enabled: true, weight: 1.0, maxResults: 15 },
      { name: 'ticketmaster', enabled: true, weight: 0.7, maxResults: 10 },
      { name: 'songkick', enabled: true, weight: 0.8, maxResults: 10 },
    ],
    restaurant_goer: [
      { name: 'yelp', enabled: true, weight: 1.0, maxResults: 20 },
      { name: 'opentable', enabled: true, weight: 0.9, maxResults: 15 },
      { name: 'google_places', enabled: true, weight: 0.7, maxResults: 10 },
    ],
    // ... more personas
  };

  // Merge sources for all user personas
  const allSources = new Map<string, DataSourceConfig>();

  personas.forEach(persona => {
    const sources = sourceMap[persona] || [];
    sources.forEach(source => {
      if (!allSources.has(source.name)) {
        allSources.set(source.name, source);
      } else {
        // Increase weight if multiple personas want this source
        const existing = allSources.get(source.name)!;
        existing.weight = Math.max(existing.weight, source.weight);
      }
    });
  });

  return Array.from(allSources.values());
}

function deduplicateActivities(activities: Activity[]): Activity[] {
  const seen = new Map<string, Activity>();

  activities.forEach(activity => {
    // Create unique key: name + address
    const key = `${activity.name.toLowerCase().trim()}|${activity.location.address}`;

    if (!seen.has(key)) {
      seen.set(key, activity);
    } else {
      // Keep the one with more data (higher source priority)
      const existing = seen.get(key)!;
      if (activity.reviewsCount > existing.reviewsCount) {
        seen.set(key, activity);
      }
    }
  });

  return Array.from(seen.values());
}
```

---

## 🧠 PERSONA DETECTION ALGORITHM

**How to Identify User Persona:**

1. **Onboarding Survey (Explicit):**
   - "What describes you best?" (Multi-select)
   - Options: Sports fan, Movie lover, Foodie, Traveler, Student, Business pro, etc.

2. **Behavioral Inference (Implicit):**
   - Accepted recommendations analysis
   - Feedback patterns
   - Search history
   - Time-of-day patterns

**Example Algorithm:**
```typescript
function detectUserPersona(userId: string): Promise<string[]> {
  // Analyze user's accepted recommendations
  const acceptedActivities = await getAcceptedActivities(userId);

  const personaScores = {
    sports_person: 0,
    movie_goer: 0,
    restaurant_goer: 0,
    traveler: 0,
    student: 0,
    business_pro: 0,
    // ... etc.
  };

  acceptedActivities.forEach(activity => {
    if (activity.category === 'sporting_event') personaScores.sports_person += 1;
    if (activity.category === 'movie') personaScores.movie_goer += 1;
    if (activity.category === 'restaurant') personaScores.restaurant_goer += 1;
    // ... etc.
  });

  // Return personas with score > threshold
  const personas = Object.entries(personaScores)
    .filter(([_, score]) => score > 2)
    .map(([persona, _]) => persona);

  return personas;
}
```

---

## 💰 REVENUE IMPACT PROJECTION

### Month 12 (with 10,000 active users):

**Affiliate Commissions from New Data Sources:**

| Source | Commission Rate | Est. Conversions/Month | Revenue/Month |
|--------|-----------------|------------------------|---------------|
| OpenTable | 10% ($5/booking) | 500 bookings | $2,500 |
| Fandango | 15% ($2/ticket) | 800 tickets | $1,600 |
| Viator/TripAdvisor | 12% ($8/tour) | 300 tours | $2,400 |
| Airbnb Experiences | 3-5% ($4/experience) | 200 bookings | $800 |
| Eventbrite | 5-10% ($3/ticket) | 600 tickets | $1,800 |
| **TOTAL** | | | **$9,100/month** |

**Combined with existing revenue streams:**
- Business subscriptions: $17,800/month
- User subscriptions: $10,068/month
- Uber affiliate: $1,500/month
- **Total revenue: $38,468/month** ($461,616/year)

---

## ✅ NEXT STEPS

1. **User Persona Survey** - Add to onboarding (1 week)
2. **Integrate Top 5 APIs** - Yelp, Eventbrite, Meetup, Fandango, OpenTable (6 weeks)
3. **Build Data Aggregator Service** - Unify all sources (2 weeks)
4. **Test with Beta Users** - 100 users across different personas (2 weeks)
5. **Launch Phase 1** - Full rollout with monitoring (ongoing)

---

**This roadmap ensures Loop serves every type of user with the most relevant, timely, and valuable recommendations possible.**
