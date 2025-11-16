# Phase 1: Exact Code Changes Required

## ✅ Step 1: Import Added (COMPLETE)
Line 31 now has:
```typescript
import { loadRecommendationsFromDB, saveRecommendationsToDB, clearPendingRecommendations, markAsAccepted } from '@/services/recommendation-persistence';
```

## Step 2: Update `fetchRecommendations` Function

**Location**: Lines 75-181 in `app/(tabs)/index.tsx`

**FIND this code** (starting at line 85):
```typescript
console.log('🔄 Fetching recommendations...');

// Log API usage summary before fetching (if API key is enabled)
if (process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY) {
```

**REPLACE WITH**:
```typescript
console.log('🔄 Fetching recommendations...');

// PHASE 1: Try loading from database first (unless force refresh)
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
  // PHASE 1: User is refreshing - clear old recommendations
  await clearPendingRecommendations(user.id);
  console.log('🔄 Force refresh - generating new recommendations');
}

// Log API usage summary before fetching (if API key is enabled)
if (process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY) {
```

**THEN FIND this code** (around line 172):
```typescript
console.log(`✅ Generated ${recommendations.length} recommendations`);
setRecommendations(recommendations);
```

**REPLACE WITH**:
```typescript
console.log(`✅ Generated ${recommendations.length} recommendations`);
setRecommendations(recommendations);

// PHASE 1: Save recommendations to database
await saveRecommendationsToDB(user.id, recommendations);
```

## Step 3: Update `handleScheduleConfirm` Function

**Location**: Lines 198-238 in `app/(tabs)/index.tsx`

**FIND this code** (around line 205):
```typescript
// Add to calendar_events table
const { error } = await (supabase.from('calendar_events') as any).insert({
  user_id: user.id,
  title: selectedRecommendation.title,
  description: selectedRecommendation.aiExplanation || '',
  category: selectedRecommendation.category.toLowerCase(),
  location: {
    type: 'Point',
    coordinates: [0, 0], // Will be replaced with actual coords
  },
  address: selectedRecommendation.location,
  start_time: scheduledTime.toISOString(),
  end_time: new Date(scheduledTime.getTime() + 60 * 60 * 1000).toISOString(),
  source: 'recommendation',
  status: 'scheduled',
});

if (error) throw error;
```

**REPLACE WITH**:
```typescript
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
    google_place_id: selectedRecommendation.activity?.googlePlaceId, // PHASE 1
    feedback_submitted: false, // PHASE 1 (for Phase 5)
  })
  .select()
  .single();

if (error) throw error;

// PHASE 1: Mark recommendation as accepted in tracking table
if (calendarEvent && selectedRecommendation.activity?.googlePlaceId) {
  await markAsAccepted(
    user.id,
    selectedRecommendation.activity.googlePlaceId,
    calendarEvent.id
  );
}
```

**THEN FIND this code** (around line 233):
```typescript
console.log('✅ Added to calendar');
```

**REPLACE WITH**:
```typescript
console.log('✅ Added to calendar and marked as accepted');
```

## Summary of Changes

1. **Import**: ✅ Added persistence service import
2. **fetchRecommendations**:
   - Load from DB first (unless refreshing)
   - Clear recommendations on refresh
   - Save newly generated recommendations to DB
3. **handleScheduleConfirm**:
   - Add google_place_id and feedback_submitted to calendar event
   - Mark recommendation as accepted in tracking table
   - Get calendar event ID from insert response

## Implementation

You can either:
1. **Manually apply** these changes in your editor (recommended for understanding)
2. **Let me create** a fully updated version of the file

Choose your preferred approach and I'll proceed.
