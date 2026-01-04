# Recommendation Diversity Strategy

## Current Fix (Implemented)

### Problem
- Single Google Places API query returned only ~20 results
- Same popular places repeated (NorthPark, Galleria, etc.)
- Feed exhausted after 17 recommendations, resorting to gas stations/Walmart

### Solution
**Multi-Category Parallel Queries**
- Query 3-5 different category groups simultaneously
- Each category returns 20 places = 60+ unique places per fetch
- Categories: Dining, Entertainment, Culture, Shopping, Fitness

**Expected Results:**
- Initial load: ~60 unique places (vs 20 before)
- Each infinite scroll: ~60 more unique places
- Hundreds of recommendations before exhaustion
- Better variety in feed (not just malls and hospitals)

---

## Future: Multi-Source Recommendation System

### Phase 2: Adding Events & Movies

#### Recommendation Types
1. **Places** (Current) - Google Places API
   - Restaurants, cafes, parks, museums, etc.

2. **Events** (Phase 2) - Eventbrite API, Ticketmaster API
   - Concerts, festivals, meetups, workshops

3. **Movies** (Phase 2) - TMDb API, Fandango API
   - Currently playing movies, showtimes nearby

4. **Activities** (Phase 3) - Custom integrations
   - Classes (yoga, cooking), tours, experiences

#### Unified Recommendation Interface

```typescript
interface BaseRecommendation {
  id: string;
  type: 'place' | 'event' | 'movie' | 'activity';
  title: string;
  description: string;
  imageUrl: string;
  location: {
    name: string;
    address: string;
    distance: number;
  };
  timing: {
    suggestedTime?: Date;
    startTime?: Date; // For events/movies
    endTime?: Date;
    duration?: number; // minutes
  };
  score: number;
  category: string;
  priceRange: number;
  aiExplanation: string;
}

interface PlaceRecommendation extends BaseRecommendation {
  type: 'place';
  googlePlaceId: string;
  rating: number;
  openNow: boolean;
}

interface EventRecommendation extends BaseRecommendation {
  type: 'event';
  eventbriteId: string;
  ticketPrice: { min: number; max: number };
  attendees: number;
  organizer: string;
}

interface MovieRecommendation extends BaseRecommendation {
  type: 'movie';
  tmdbId: string;
  theater: string;
  showtimes: Date[];
  runtime: number;
  rating: string; // PG, PG-13, R, etc.
}
```

#### Mixing Strategy

**Algorithm:**
1. Fetch from all sources in parallel
2. Score all recommendations using unified scoring system
3. Apply diversity rules:
   - Max 2 movies in top 10
   - Max 3 events in top 10
   - Rest are places
4. Sort by score with randomization for variety
5. Return mixed feed

**Visual Differentiation:**
- **Places**: Default blue card (current)
- **Events**: Purple/pink card with calendar icon
- **Movies**: Red card with film icon
- **Activities**: Green card with activity icon

**Example Feed (Mixed):**
```
1. [PLACE] Blue Sushi Sake Grill (dining)
2. [EVENT] Dallas Mavericks Game Tonight (sports)
3. [PLACE] Klyde Warren Park (outdoor)
4. [MOVIE] Dune: Part Two at AMC (entertainment)
5. [PLACE] Perot Museum (culture)
6. [PLACE] Katy Trail (fitness)
7. [EVENT] Deep Ellum Art Walk (culture)
8. [PLACE] The Rustic (dining)
9. [PLACE] Dallas Arboretum (outdoor)
10. [PLACE] Reunion Tower (tourist)
```

#### Scoring Adjustments by Type

**Places** (Base scoring - existing algorithm)
- Interest match, location, time, rating

**Events** (Time-sensitive scoring)
- +20 points if happening today
- +10 points if happening this week
- -10 points if sold out
- Category match with user interests

**Movies** (Recency & popularity scoring)
- +15 points if new release (< 2 weeks)
- +10 points if high IMDb rating (>8.0)
- +5 points if genre matches user interests
- Location proximity to theater

#### API Integration Plan

**Phase 2.1: Events (Month 3-4)**
1. Integrate Eventbrite API
2. Add event cards to UI
3. Mix 20% events, 80% places
4. Test with Dallas events

**Phase 2.2: Movies (Month 4-5)**
1. Integrate TMDb + Fandango APIs
2. Add movie cards with showtimes
3. Mix 10% movies, 20% events, 70% places
4. Add "Buy Tickets" action

**Phase 2.3: Refinement (Month 5-6)**
1. User feedback on mix ratios
2. A/B test different mixing strategies
3. Optimize for engagement

#### Database Schema Updates

```sql
-- Extend recommendation_tracking for multi-type
ALTER TABLE recommendation_tracking ADD COLUMN recommendation_type VARCHAR(20) DEFAULT 'place';
ALTER TABLE recommendation_tracking ADD COLUMN external_id VARCHAR(255); -- eventbrite_id, tmdb_id, etc.

-- New table for event recommendations
CREATE TABLE event_recommendations (
  id UUID PRIMARY KEY,
  eventbrite_id VARCHAR(255),
  title VARCHAR(255),
  category VARCHAR(100),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  location GEOGRAPHY(POINT),
  ticket_price_min DECIMAL(10,2),
  ticket_price_max DECIMAL(10,2),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- New table for movie recommendations
CREATE TABLE movie_recommendations (
  id UUID PRIMARY KEY,
  tmdb_id VARCHAR(255),
  title VARCHAR(255),
  theater VARCHAR(255),
  location GEOGRAPHY(POINT),
  showtimes JSONB, -- Array of datetime strings
  runtime INTEGER, -- minutes
  rating VARCHAR(10), -- PG, PG-13, R
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Cost Considerations

**Current (Places only):**
- Google Places API: ~$50/month for 1K users

**With Events + Movies:**
- Google Places API: $50/month
- Eventbrite API: FREE (up to 50K requests/day)
- TMDb API: FREE (40 requests/10 seconds)
- **Total: ~$50/month** (no increase!)

---

## User Experience Flow

**Feed Interaction:**

1. **Place Card** (Blue)
   - Primary action: "Add to Calendar"
   - Secondary action: "See Details"

2. **Event Card** (Purple)
   - Primary action: "Get Tickets" → Eventbrite
   - Secondary action: "Add to Calendar"

3. **Movie Card** (Red)
   - Primary action: "Buy Tickets" → Fandango
   - Secondary action: "View Showtimes"

**Filters:**
- All (current)
- Places only
- Events only
- Movies only
- Happening Today (events + movies)

---

## Success Metrics

**Variety:**
- Unique recommendations per session: 100+ (vs 20 current)
- Categories represented in top 20: 8+ (vs 3 current)

**Engagement:**
- Acceptance rate: 30%+ (currently 25%)
- Time in feed: 5+ minutes (currently 2-3 min)
- Infinite scrolls per session: 3+ (currently 1)

**Revenue:**
- Affiliate commissions (events/movies): $500-1K/month (Phase 2)
- Business subscriptions remain primary revenue

---

## Implementation Priority

✅ **Week 1-2: Multi-Category Places (DONE)**
- Immediate fix for current issue
- 3x more place variety

🔄 **Week 3-4: Testing & Refinement**
- Monitor feed diversity
- User feedback on variety
- Adjust category mix

📅 **Month 3-4: Events Integration**
- Eventbrite API
- Event cards UI
- Mixed feed algorithm

🎬 **Month 4-5: Movies Integration**
- TMDb + Fandango APIs
- Movie cards UI
- Showtime integration

🚀 **Month 6+: Advanced Features**
- Multi-day itinerary planning
- Travel mode (events in other cities)
- Personalized event discovery
