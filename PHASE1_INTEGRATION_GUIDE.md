# Phase 1: Recommendation Persistence Integration Guide

## Overview
This document explains how to integrate recommendation persistence into the Feed screen.

## Files Created
1. ✅ `services/recommendation-persistence.ts` - Persistence adapter layer
2. ✅ `supabase/migrations/create_recommendation_tracking.sql` - Database schema

## Database Migration Required

**Run this SQL in your Supabase dashboard:**
```sql
-- Copy contents of supabase/migrations/create_recommendation_tracking.sql
-- This creates the recommendation_tracking table and adds columns to calendar_events
```

## Feed Screen Integration (`app/(tabs)/index.tsx`)

### Step 1: Add Import
Add this import at the top with other service imports:
```typescript
import {
  loadRecommendationsFromDB,
  saveRecommendationsToDB,
  clearPendingRecommendations,
  markAsAccepted,
} from '@/services/recommendation-persistence';
```

### Step 2: Update `fetchRecommendations` Function

Replace the function starting at line 75 with this updated version:

```typescript
// Fetch recommendations
const fetchRecommendations = async (showRefreshIndicator = false) => {
  if (!user) return;

  try {
    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    console.log('🔄 Fetching recommendations...');

    // PHASE 1 ADDITION: Try loading from database first (unless force refresh)
    if (!showRefreshIndicator) {
      const cachedRecs = await loadRecommendationsFromDB(user.id);

      if (cachedRecs && cachedRecs.length > 0) {
        console.log(`✅ Loaded ${cachedRecs.length} recommendations from database`);
        setRecommendations(cachedRecs);
        setLoading(false);
        setRefreshing(false);
        return; // Use cached recommendations
      }
    } else {
      // PHASE 1 ADDITION: User is refreshing - clear old recommendations
      await clearPendingRecommendations(user.id);
      console.log('🔄 Force refresh - generating new recommendations');
    }

    // Log API usage summary before fetching (if API key is enabled)
    if (process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY) {
      const { logAPIUsageSummary } = await import('@/utils/api-cost-tracker');
      await logAPIUsageSummary();
    }

    // Get user's current location
    const location = await getCurrentLocation();
    const userLocation: PlaceLocation = {
      lat: location.latitude,
      lng: location.longitude,
    };

    console.log(`📍 Location: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`);

    // Get home/work locations if available
    const homeLocation = user.home_location
      ? { lat: (user.home_location as any).coordinates[1], lng: (user.home_location as any).coordinates[0] }
      : undefined;

    const workLocation = user.work_location
      ? { lat: (user.work_location as any).coordinates[1], lng: (user.work_location as any).coordinates[0] }
      : undefined;

    // Generate recommendations
    const params: RecommendationParams = {
      user,
      userLocation,
      homeLocation,
      workLocation,
      maxResults: 25,
    };

    const scored = await generateRecommendations(params);

    // Convert ScoredRecommendation[] to Recommendation[]
    const recommendations: Recommendation[] = scored.map((s, index) => ({
      id: s.place.place_id || `rec-${index}`,
      title: s.place.name,
      category: s.category,
      location: s.place.vicinity || s.place.formatted_address || 'Unknown location',
      distance: `${s.distance.toFixed(1)} mi`,
      priceRange: s.place.price_level || 2,
      rating: s.place.rating || 0,
      imageUrl: s.photoUrl || '',
      photos: s.photoUrls,
      aiExplanation: s.aiExplanation,
      description: s.place.description,
      openNow: s.place.opening_hours?.open_now,
      isSponsored: s.isSponsored,
      score: s.score,
      businessHours: s.businessHours,
      hasEstimatedHours: s.hasEstimatedHours,
      suggestedTime: s.suggestedTime,
      scoreBreakdown: {
        baseScore: s.scoreBreakdown.baseScore,
        locationScore: s.scoreBreakdown.locationScore,
        timeScore: s.scoreBreakdown.timeScore,
        feedbackScore: s.scoreBreakdown.feedbackScore,
        collaborativeScore: s.scoreBreakdown.collaborativeScore,
        sponsorBoost: s.scoreBreakdown.sponsoredBoost,
        finalScore: s.scoreBreakdown.finalScore,
      },
      activity: {
        id: s.place.place_id || `act-${index}`,
        name: s.place.name,
        category: s.category,
        description: s.place.description,
        location: {
          latitude: s.place.geometry.location.lat,
          longitude: s.place.geometry.location.lng,
          address: s.place.vicinity || s.place.formatted_address || '',
        },
        distance: s.distance,
        rating: s.place.rating,
        reviewsCount: s.place.user_ratings_total,
        priceRange: s.place.price_level || 2,
        photoUrl: s.photoUrl,
        phone: s.place.formatted_phone_number,
        website: s.place.website,
        googlePlaceId: s.place.place_id,
      },
    }));

    console.log(`✅ Generated ${recommendations.length} recommendations`);
    setRecommendations(recommendations);

    // PHASE 1 ADDITION: Save recommendations to database
    await saveRecommendationsToDB(user.id, recommendations);

  } catch (error) {
    console.error('❌ Error fetching recommendations:', error);
    handleError(error, 'Failed to load recommendations');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};
```

### Step 3: Update `handleScheduleConfirm` Function

Replace the function starting around line 198 with this updated version:

```typescript
// Handle schedule confirmation
const handleScheduleConfirm = async (scheduledTime: Date) => {
  if (!selectedRecommendation || !user) return;

  try {
    console.log(`📅 Adding ${selectedRecommendation.title} to calendar`);

    // Add to calendar_events table
    const { data: calendarEvent, error } = await (supabase.from('calendar_events') as any)
      .insert({
        user_id: user.id,
        title: selectedRecommendation.title,
        description: selectedRecommendation.aiExplanation || '',
        category: selectedRecommendation.category.toLowerCase(),
        location: {
          type: 'Point',
          coordinates: [
            selectedRecommendation.activity?.location.longitude || 0,
            selectedRecommendation.activity?.location.latitude || 0
          ],
        },
        address: selectedRecommendation.location,
        start_time: scheduledTime.toISOString(),
        end_time: new Date(scheduledTime.getTime() + 60 * 60 * 1000).toISOString(),
        source: 'recommendation',
        status: 'scheduled',
        google_place_id: selectedRecommendation.activity?.googlePlaceId, // PHASE 1 ADDITION
        feedback_submitted: false, // PHASE 1 ADDITION (for Phase 5)
      })
      .select()
      .single();

    if (error) throw error;

    // PHASE 1 ADDITION: Mark recommendation as accepted in tracking table
    if (calendarEvent && selectedRecommendation.activity?.googlePlaceId) {
      await markAsAccepted(
        user.id,
        selectedRecommendation.activity.googlePlaceId,
        calendarEvent.id
      );
    }

    // Show success animation
    setShowScheduleModal(false);
    setShowSuccessAnimation(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setTimeout(() => {
      setShowSuccessAnimation(false);
    }, 2000);

    console.log('✅ Added to calendar and marked as accepted');

  } catch (error) {
    console.error('❌ Error adding to calendar:', error);
    handleError(error, 'Failed to add to calendar');
  }
};
```

## Testing Phase 1

After applying these changes and running the migration:

### Test 1: Database Persistence
1. Open app → recommendations load from Google Places API
2. Close app
3. Reopen app → recommendations load from database (instant, no API calls)
4. Check console logs: Should see "Loaded X recommendations from database"

### Test 2: Refresh Clears Old Recommendations
1. Pull to refresh on feed
2. Old recommendations marked as "declined"
3. New recommendations generated and saved
4. Check console: "Force refresh - generating new recommendations"

### Test 3: Acceptance Tracking
1. Add recommendation to calendar
2. Check Supabase `recommendation_tracking` table
3. Should see status = "accepted", responded_at timestamp
4. Check `calendar_events` table
5. Should see google_place_id populated

### Test 4: Verify No API Waste
1. Open app multiple times within 7 days
2. Should only call Google Places API once (first time)
3. Subsequent opens use cached recommendations

## What This Achieves

✅ **Persistence**: Recommendations survive app restarts
✅ **Tracking**: Every recommendation status is tracked (pending → accepted/declined)
✅ **Performance**: No redundant Google Places API calls
✅ **Foundation for Phase 2-5**: Enables "Not Interested", smart resurfacing, AI learning, and feedback loop

## Next Steps After Phase 1

Once Phase 1 is working:
- **Phase 2**: Add "Not Interested" button to recommendation cards
- **Phase 3**: Smart resurfacing of declined recommendations
- **Phase 4**: AI learning from decline patterns
- **Phase 5**: Post-activity feedback loop (CRITICAL for recommendation improvement)

## Token Usage Alert

Current usage: ~72K / 200K tokens (36%)
Alert threshold: 175K tokens (87%)

We're good to continue through Phase 2-3 before needing to save state.
