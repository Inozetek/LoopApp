# Google Places API Cost Optimization Strategy

## Problem Statement

At 1,000 active users with current on-demand API architecture:
- Each user gets 5 recommendations per session
- Average 3 sessions per day = 15 API calls per user per day
- 1,000 users × 15 calls = **15,000 API calls per day** (450K per month)
- Google Places API cost: **$0.032 per Nearby Search** + **$0.017 per Place Details**
- Monthly cost: **$50-200/month** at 1,000 users
- Monthly cost at 10,000 users: **$500-2,000/month** (unsustainable!)

## Solution: Database Caching with Weekly Sync

**Lean Startup Best Practice:** Download venue data once, cache in database, refresh weekly.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  User Request                                                │
│  "Show me recommendations"                                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Recommendation Engine                                       │
│  Query LOCAL database (Supabase)                            │
│  ✓ No API call                                              │
│  ✓ Instant response (<50ms)                                 │
│  ✓ $0 per recommendation                                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Weekly Batch Sync (Background Job)                         │
│  1. Query Google Places API for all categories              │
│  2. Download venue data for target cities                   │
│  3. Update database with new/changed venues                 │
│  4. Cost: ~500 API calls/week = $16-32/week                 │
└─────────────────────────────────────────────────────────────┘
```

### Cost Comparison

| Architecture | API Calls/Month | Cost/Month (1K users) | Cost/Month (10K users) |
|--------------|-----------------|----------------------|------------------------|
| **On-Demand (Current)** | 450,000 | $50-200 | $500-2,000 |
| **Weekly Caching (New)** | 2,000 | $64-128 | $64-128 |
| **Savings** | -448,000 | -$100 | -$1,900 |

**Result:** 99.5% cost reduction regardless of user count!

---

## Implementation Plan

### Phase 1: Database Schema for Cached Venues

```sql
-- Add to existing database schema

CREATE TABLE cached_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id VARCHAR(255) UNIQUE NOT NULL,

  -- Basic info
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,

  -- Location (PostGIS)
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(50),
  zip_code VARCHAR(20),

  -- Metadata
  phone VARCHAR(20),
  website TEXT,
  price_range INTEGER CHECK (price_range BETWEEN 0 AND 3),
  rating DECIMAL(2,1),
  reviews_count INTEGER DEFAULT 0,

  -- Hours (JSONB)
  hours JSONB DEFAULT '{}'::jsonb,

  -- Photos
  photos JSONB DEFAULT '[]'::jsonb,
  cover_photo_url TEXT,

  -- Sync tracking
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  is_closed BOOLEAN DEFAULT FALSE,

  -- Indexing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_cached_places_location ON cached_places USING GIST(location);
CREATE INDEX idx_cached_places_category ON cached_places(category);
CREATE INDEX idx_cached_places_city ON cached_places(city, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_cached_places_rating ON cached_places(rating DESC) WHERE is_active = TRUE;
CREATE INDEX idx_cached_places_sync ON cached_places(last_synced_at);
CREATE INDEX idx_cached_places_google_id ON cached_places(google_place_id);

-- Tracking table for sync jobs
CREATE TABLE places_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),

  places_added INTEGER DEFAULT 0,
  places_updated INTEGER DEFAULT 0,
  places_deactivated INTEGER DEFAULT 0,

  api_calls_made INTEGER DEFAULT 0,
  estimated_cost_cents INTEGER DEFAULT 0,

  error_message TEXT,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_places_sync_jobs_status ON places_sync_jobs(status, created_at DESC);
```

### Phase 2: Weekly Sync Service (Backend)

**File:** `services/places-sync-service.ts`

```typescript
import { supabase } from '@/lib/supabase';
import { searchNearbyActivities, getPlaceDetails } from './google-places';

interface SyncConfig {
  city: string;
  centerPoint: { latitude: number; longitude: number };
  radiusMiles: number;
  categories: string[];
}

// Cities to sync
const SYNC_CITIES: SyncConfig[] = [
  {
    city: 'San Francisco',
    centerPoint: { latitude: 37.7749, longitude: -122.4194 },
    radiusMiles: 10,
    categories: ['restaurant', 'cafe', 'bar', 'gym', 'park', 'museum'],
  },
  // Add more cities as you expand
];

export async function runWeeklySync(): Promise<void> {
  console.log('🔄 Starting weekly places sync...');

  for (const cityConfig of SYNC_CITIES) {
    await syncCity(cityConfig);
  }

  console.log('✅ Weekly sync complete!');
}

async function syncCity(config: SyncConfig): Promise<void> {
  // Create sync job record
  const { data: job } = await supabase
    .from('places_sync_jobs')
    .insert({
      city: config.city,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (!job) {
    console.error(`Failed to create sync job for ${config.city}`);
    return;
  }

  let apiCalls = 0;
  let placesAdded = 0;
  let placesUpdated = 0;

  try {
    // Query Google Places API for each category
    for (const category of config.categories) {
      const radiusMeters = config.radiusMiles * 1609.34; // Convert miles to meters

      const places = await searchNearbyActivities(
        config.centerPoint,
        radiusMeters,
        category
      );

      apiCalls += 1; // searchNearby call

      // For each place, check if it exists in database
      for (const place of places) {
        const { data: existing } = await supabase
          .from('cached_places')
          .select('id, last_synced_at')
          .eq('google_place_id', place.googlePlaceId)
          .single();

        if (existing) {
          // Update existing place
          await supabase
            .from('cached_places')
            .update({
              name: place.name,
              category: place.category,
              description: place.description,
              rating: place.rating,
              reviews_count: place.reviewsCount,
              price_range: place.priceRange,
              photo_url: place.photoUrl,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          placesUpdated++;
        } else {
          // Insert new place
          await supabase
            .from('cached_places')
            .insert({
              google_place_id: place.googlePlaceId,
              name: place.name,
              category: place.category,
              description: place.description,
              location: `POINT(${place.location.longitude} ${place.location.latitude})`,
              address: place.location.address,
              city: config.city,
              state: place.location.state,
              rating: place.rating,
              reviews_count: place.reviewsCount,
              price_range: place.priceRange,
              cover_photo_url: place.photoUrl,
              last_synced_at: new Date().toISOString(),
            });

          placesAdded++;
        }
      }

      // Rate limit: wait 1 second between category queries
      await sleep(1000);
    }

    // Deactivate places not synced in 30 days (likely closed)
    const { data: deactivated } = await supabase
      .from('cached_places')
      .update({ is_active: false })
      .eq('city', config.city)
      .lt('last_synced_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .select();

    // Calculate cost
    const estimatedCostCents = apiCalls * 3.2; // $0.032 per Nearby Search

    // Mark job complete
    await supabase
      .from('places_sync_jobs')
      .update({
        status: 'completed',
        places_added: placesAdded,
        places_updated: placesUpdated,
        places_deactivated: deactivated?.length || 0,
        api_calls_made: apiCalls,
        estimated_cost_cents: estimatedCostCents,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    console.log(`✅ ${config.city} sync complete: +${placesAdded} added, ~${placesUpdated} updated`);

  } catch (error) {
    console.error(`❌ Sync failed for ${config.city}:`, error);

    await supabase
      .from('places_sync_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Phase 3: Update Recommendation Engine

**File:** `services/recommendation-engine.ts` (modify to use cached places)

```typescript
// BEFORE (on-demand API calls):
const places = await searchNearbyActivities(userLocation, radiusMeters);

// AFTER (query cached database):
const { data: places } = await supabase
  .from('cached_places')
  .select('*')
  .eq('is_active', true)
  .eq('city', userCity)
  .within('location', userLocation.latitude, userLocation.longitude, radiusMiles);

// Transform cached places to Activity format
const activities = places.map(place => ({
  id: place.google_place_id,
  name: place.name,
  category: place.category,
  description: place.description,
  location: {
    latitude: place.location.coordinates[1],
    longitude: place.location.coordinates[0],
    address: place.address,
  },
  rating: place.rating,
  reviewsCount: place.reviews_count,
  priceRange: place.price_range,
  photoUrl: place.cover_photo_url,
  isSponsored: false,
}));
```

### Phase 4: Scheduled Cron Job

**Option A: Supabase Edge Functions (Recommended)**

1. Create Edge Function:
```bash
supabase functions new weekly-places-sync
```

2. Deploy:
```typescript
// supabase/functions/weekly-places-sync/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { runWeeklySync } from './places-sync-service.ts';

serve(async (req) => {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  await runWeeklySync();

  return new Response('Sync complete', { status: 200 });
});
```

3. Schedule with cron (via Supabase dashboard or pg_cron):
```sql
-- Run every Sunday at 2 AM
SELECT cron.schedule(
  'weekly-places-sync',
  '0 2 * * 0',
  $$
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/weekly-places-sync',
    headers:='{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  ) as request_id;
  $$
);
```

**Option B: Render/Railway Cron Job**

If using Render or Railway for backend:

```typescript
// backend/cron.ts
import cron from 'node-cron';
import { runWeeklySync } from './services/places-sync-service';

// Run every Sunday at 2 AM
cron.schedule('0 2 * * 0', async () => {
  console.log('🕐 Starting scheduled places sync...');
  await runWeeklySync();
});

console.log('✅ Cron job scheduled: Weekly places sync');
```

---

## Cost Breakdown (Updated)

### With Weekly Caching Strategy

**Initial Sync (One-time):**
- 1 city, 6 categories × 20 results each = 120 places
- API calls: 6 Nearby Search = 6 × $0.032 = **$0.19**
- Time: ~10 seconds

**Weekly Sync (Recurring):**
- Update 120 places (refresh ratings, hours, etc.)
- API calls: 6 Nearby Search = 6 × $0.032 = **$0.19/week**
- Monthly cost: $0.19 × 4 = **$0.76/month per city**

**Scaling to 5 Cities:**
- Monthly cost: $0.76 × 5 = **$3.80/month**

**Scaling to 10 Cities:**
- Monthly cost: $0.76 × 10 = **$7.60/month**

### User-Facing Costs (FREE for users!)

- Database queries: Supabase free tier covers 500MB, easily handles 10K+ venues
- Cost to serve recommendations: **$0 per user** (just database queries)
- Supabase Pro ($25/month) supports up to 100K active users

**Result:** Predictable costs that don't scale with user count!

---

## Migration Plan

### Week 1: Setup
- [ ] Create database tables (cached_places, places_sync_jobs)
- [ ] Write sync service (places-sync-service.ts)
- [ ] Test sync with 1 city (San Francisco)
- [ ] Verify data quality

### Week 2: Integration
- [ ] Update recommendation engine to query cached_places
- [ ] Add fallback to live API if cache miss
- [ ] Test recommendations with cached data
- [ ] Compare quality vs live API

### Week 3: Automation
- [ ] Deploy cron job (Supabase Edge Function or Render)
- [ ] Schedule weekly sync (Sunday 2 AM)
- [ ] Monitor first automated sync
- [ ] Set up alerts for sync failures

### Week 4: Scaling
- [ ] Add 4 more cities (LA, NYC, Austin, Chicago)
- [ ] Monitor API costs (should be <$5/month)
- [ ] Optimize sync (only update places with changes)
- [ ] Add admin dashboard to view sync status

---

## Monitoring & Alerts

**Track These Metrics:**

1. **Sync Success Rate:** 95%+ jobs complete successfully
2. **API Cost:** <$10/month for 5 cities
3. **Data Freshness:** 90%+ places synced within 7 days
4. **Cache Hit Rate:** 99%+ recommendations served from cache
5. **User Satisfaction:** No drop in recommendation quality

**Set Up Alerts:**

```typescript
// In places-sync-service.ts
import { logError } from '@/utils/error-logger';

if (apiCalls > 100) {
  logError(new Error('Sync used too many API calls'), {
    context: 'places-sync',
    apiCalls,
    city: config.city,
  });
}

if (placesAdded + placesUpdated < 50) {
  logError(new Error('Sync returned too few places'), {
    context: 'places-sync',
    placesAdded,
    placesUpdated,
    city: config.city,
  });
}
```

---

## Advanced Optimizations (Phase 2)

### 1. Incremental Sync
Only fetch Place Details for venues that changed (e.g., rating increased)

```typescript
// Before fetching details, check if place needs update
const needsUpdate = place.rating !== existing.rating ||
                    place.reviewsCount > existing.reviews_count;

if (needsUpdate) {
  const details = await getPlaceDetails(place.googlePlaceId);
  apiCalls += 1; // Only charge for updated places
}
```

**Savings:** 80% reduction in API calls (only update ~20% of places per week)

### 2. User-Contributed Data
Allow users to submit new venues → only validate with API

```typescript
// User submits "New coffee shop on Main St"
// 1. Add to cached_places with is_verified: false
// 2. Next sync: verify with Google Places API
// 3. If valid: mark is_verified: true
// 4. If invalid: delete
```

**Savings:** Discover new venues without proactive searching

### 3. Demand-Based Sync
Sync popular areas more frequently, rural areas less often

```typescript
// High traffic: Sync weekly
// Medium traffic: Sync bi-weekly
// Low traffic: Sync monthly
```

---

## FAQ

**Q: What if a new restaurant opens between sync cycles?**
A: Fallback to live API on cache miss. If user searches "new restaurant name" and not in cache, query Google Places API and add to cache.

**Q: What if a venue's hours change?**
A: Weekly sync updates hours. For time-sensitive data, consider daily sync for high-traffic venues.

**Q: What about photo updates?**
A: Photos rarely change. Re-download photos quarterly or on user report.

**Q: How do we handle sponsored venues?**
A: Sponsored venues stored separately in `businesses` table. Recommendation algorithm merges cached + sponsored results.

**Q: What's the database storage cost?**
A: 10,000 venues × 5KB per venue = 50MB. Negligible within Supabase free tier (500MB).

---

## Expected Results

### Before (On-Demand API)
- Cost at 1K users: $50-200/month
- Cost at 10K users: $500-2,000/month
- API latency: 200-500ms per recommendation
- Scalability: Poor (cost grows linearly with users)

### After (Weekly Caching)
- Cost at 1K users: **$3.80/month** (5 cities)
- Cost at 10K users: **$3.80/month** (same!)
- API latency: **<50ms** (database query)
- Scalability: **Excellent** (cost grows with cities, not users)

**Cost Savings:** 98-99% reduction in API costs
**Performance:** 4-10x faster recommendation generation
**Scalability:** Ready for 100K+ users with no cost increase

---

## Conclusion

This caching strategy is **exactly what lean startups do** to validate product-market fit before spending on infrastructure. By caching venue data weekly:

1. **Cut costs by 98%:** From $50-200/month → $3.80/month
2. **Improve speed by 4-10x:** From 200-500ms → <50ms
3. **Enable profitability:** User subscription revenue ($5-10/month) > venue API costs
4. **Scale confidently:** Costs don't explode with user growth

**Next Step:** Implement Phase 1 (database schema) this week. Run first sync. Monitor results.

**Timeline:** 2-3 weeks to full implementation, then $3.80/month forever.
