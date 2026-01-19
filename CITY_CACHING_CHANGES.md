# City-Based Caching: Recommendation Engine Changes

## Summary

Modifying `services/recommendations.ts` to use city-based caching instead of direct Google Places API calls.

---

## Current Flow (BEFORE)

```typescript
export async function generateRecommendations(params) {
  // Step 1: Query Google Places API for nearby activities
  const radiusMeters = maxDistance * 1609.34;

  // Query multiple category groups in parallel
  const results = await Promise.all(
    categoryGroups.map(group =>
      searchNearbyActivities(userLocation, radiusMeters, group.types)
    )
  );

  // Flatten and deduplicate
  const allPlaces = results.flat();

  // Step 2: Score activities
  const scored = scoreActivities(allPlaces, params);

  return scored;
}
```

**Problems:**
- Every recommendation request hits Google Places API
- Expensive: $0.032 per Nearby Search request
- Can't handle more than a few concurrent users without exceeding free tier

---

## New Flow (AFTER City-Based Caching)

```typescript
export async function generateRecommendations(params) {
  // Step 0: Detect user's city
  const cityInfo = await detectUserCity(params.user);

  // Step 1: Check if city cache exists and is fresh
  const cacheStatus = await checkCityCache(
    cityInfo.city,
    cityInfo.state,
    getCadenceForUser(params.user) // 60/30/15 days based on tier
  );

  // Step 2: Seed cache if needed
  if (!cacheStatus.exists || cacheStatus.isStale) {
    const userCategories = getUserCategories(params.user.interests);
    await seedCityData(
      cityInfo.city,
      cityInfo.state,
      cityInfo.lat,
      cityInfo.lng,
      userCategories,
      getCadenceForUser(params.user)
    );
  }

  // Step 3: Query cached places from database
  const cachedPlaces = await getCachedPlaces(
    cityInfo.city,
    cityInfo.state,
    params.categories ? params.categories[0] : undefined,
    100 // limit
  );

  // Step 4: Score activities (NO API CALLS)
  const scored = scoreActivities(cachedPlaces, params);

  return scored;
}
```

**Benefits:**
- Zero API costs for repeat queries in same city
- Stays within Google Places API free tier ($200/month)
- Faster response times (database query vs API call)
- Better control over data quality (filter during seeding)

---

## Specific Code Changes

### Change 1: Add imports

```typescript
// Add to top of file
import { detectUserCity } from './city-detection';
import { checkCityCache, seedCityData, getCachedPlaces } from './cache-manager';
```

### Change 2: Add helper function for user's refresh cadence

```typescript
/**
 * Get cache refresh cadence based on user's subscription tier
 * Free: 60 days, Plus: 30 days, Premium: 15 days
 */
function getCadenceForUser(user: User): number {
  switch (user.subscription_tier) {
    case 'premium':
      return 15;
    case 'plus':
      return 30;
    case 'free':
    default:
      return 60;
  }
}
```

### Change 3: Add helper to map interests to categories

```typescript
/**
 * Get list of categories to cache based on user's interests
 * Uses category-based lazy loading strategy
 */
function getUserCategories(interests: string[]): string[] {
  // Map user interests to Google Places types
  const allTypes = mapInterestsToGoogleTypes(interests);

  // Deduplicate and return
  return Array.from(new Set(allTypes));
}
```

### Change 4: Replace Google Places API query with cache query

```typescript
// BEFORE (lines ~715-850):
// Step 1: Query Google Places API for nearby activities
const results = await Promise.allSettled(...);

// AFTER:
// Step 1: Detect user's city
const cityInfo = await detectUserCity(user);

// Step 2: Check cache status
const cacheStatus = await checkCityCache(
  cityInfo.city,
  cityInfo.state,
  getCadenceForUser(user)
);

// Step 3: Seed cache if needed
if (!cacheStatus.exists || cacheStatus.isStale) {
  const userCategories = getUserCategories(user.interests || []);
  await seedCityData(
    cityInfo.city,
    cityInfo.state,
    cityInfo.lat,
    cityInfo.lng,
    userCategories,
    getCadenceForUser(user)
  );
}

// Step 4: Query cached places
const cachedPlaces = await getCachedPlaces(
  cityInfo.city,
  cityInfo.state,
  categories ? categories[0] : undefined,
  maxResults * 3 // Over-fetch for filtering
);
```

### Change 5: Convert cached places to expected format

The cache stores `Activity` objects in `place_data` JSONB, but the scoring function expects `PlaceResult` format.

```typescript
// Convert Activity[] to PlaceResult[] for scoring
const placesForScoring: PlaceResult[] = cachedPlaces.map(activity => ({
  place_id: activity.googlePlaceId || activity.id,
  name: activity.name,
  vicinity: activity.location.address,
  formatted_address: activity.location.address,
  description: activity.description,
  formatted_phone_number: activity.phone,
  website: activity.website,
  geometry: {
    location: {
      lat: activity.location.latitude,
      lng: activity.location.longitude,
    },
  },
  types: [], // Will need to infer from activity.category
  rating: activity.rating,
  user_ratings_total: activity.reviewsCount,
  price_level: activity.priceRange,
  photos: activity.photoUrl ? [{ photo_reference: activity.photoUrl }] : [],
  opening_hours: {
    open_now: undefined, // Not stored in cache
  },
  source: 'google_places',
}));
```

---

## Testing Plan

1. **Unit Tests** (verify-cache-based-recommendations.js):
   - Test city detection works
   - Test cache check works
   - Test cache seeding works
   - Test cached place retrieval works
   - Test recommendations generated from cache

2. **Manual Testing**:
   - User with home_location set → should detect city
   - First request → should seed cache
   - Second request → should use cache (no API calls)
   - User in different city → should seed that city's cache

3. **Performance Testing**:
   - Measure API call count (should be zero after first seed)
   - Measure response time (database should be faster than API)

---

## Rollback Plan

If issues occur:
1. Keep old code commented out below new code
2. Can revert by uncommenting old code and commenting new code
3. Cache tables remain in database (no data loss)

---

## Cost Impact Analysis

**Before (Current):**
- Every generateRecommendations() call → 5-10 API requests
- 1,000 users × 5 requests/day × 30 days = 150,000 API calls/month
- Cost: ~$4,800/month (exceeds free tier by 24x)

**After (City-Based Caching):**
- Seed Dallas cache: 200 places × 3 API calls = 600 calls (one-time)
- Seed 5 cities: 3,000 calls total
- Refresh every 60 days: 3,000 calls / 60 days = 50 calls/day
- Cost: **$0/month** (well within $200 free tier)

**Savings: $4,800/month → $0/month**

---

## Implementation Checklist

- [ ] Add imports (city-detection, cache-manager)
- [ ] Add getCadenceForUser helper
- [ ] Add getUserCategories helper
- [ ] Replace API query with cache flow
- [ ] Add Activity → PlaceResult conversion
- [ ] Test with real user data
- [ ] Verify no API calls after first seed
- [ ] Update feed screen loading state (Phase 5)

---

## Next Steps After This Change

1. Phase 5: Update feed screen
   - Add loading state for first-time city seed
   - Show message: "Setting up recommendations for [City]..."
   - Remove refresh button (cache handles staleness automatically)

2. Create background job to refresh stale caches
   - Run daily: `markStalePlaces()`
   - Run weekly: `cleanupOldStalePlaces()`

3. Monitor cache statistics
   - Track: cities cached, places per city, API calls saved
   - Admin dashboard showing cost savings
