// @ts-nocheck - JSONB type handling from Supabase
/**
 * Recommendation Engine
 * Scores and ranks activities based on user preferences, location, and context
 */

// Import from new google-places.ts (mock data)
import { getMockActivities } from './google-places';
import type { User } from '@/types/database';
import type { Activity } from '@/types/activity';

// Type definitions (copied from legacy for compatibility)
export type PlaceLocation = { lat: number; lng: number };

export interface PlaceResult {
  place_id: string;
  name: string;
  vicinity?: string;
  formatted_address?: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types: string[];
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  photos?: Array<{ photo_reference: string }>;
  opening_hours?: {
    open_now?: boolean;
  };
}

// Helper function: Calculate distance between two points (Haversine formula)
function calculateDistance(point1: PlaceLocation, point2: PlaceLocation): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const dLon = ((point2.lng - point1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.lat * Math.PI) / 180) *
      Math.cos((point2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper function: Map place types to category
function mapPlaceTypeToCategory(types: string[]): string {
  const categoryMap: Record<string, string> = {
    restaurant: 'Dining',
    cafe: 'Coffee',
    bar: 'Bars',
    night_club: 'Nightlife',
    gym: 'Fitness',
    park: 'Outdoor',
    museum: 'Culture',
    movie_theater: 'Entertainment',
    shopping_mall: 'Shopping',
    art_gallery: 'Art',
  };

  for (const type of types) {
    if (categoryMap[type]) {
      return categoryMap[type];
    }
  }
  return 'Other';
}

// Helper function: Get photo URL from Google Places API (NEW v1)
function getPlacePhotoUrl(photoReference: string): string {
  const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!API_KEY || !photoReference) {
    // Return undefined so we can fallback to Unsplash
    return '';
  }

  // NEW API photo URL format: https://places.googleapis.com/v1/{name}/media
  // photoReference is the 'name' field like "places/ChIJ.../photos/..."
  return `https://places.googleapis.com/v1/${photoReference}/media?key=${API_KEY}&maxHeightPx=400&maxWidthPx=600`;
}

// Convert Activity to PlaceResult (for mock data compatibility)
function activityToPlaceResult(activity: Activity): PlaceResult {
  return {
    place_id: activity.googlePlaceId || activity.id,
    name: activity.name,
    vicinity: activity.location.address,
    formatted_address: activity.location.address,
    geometry: {
      location: {
        lat: activity.location.latitude,
        lng: activity.location.longitude,
      },
    },
    types: [activity.category.toLowerCase()],
    rating: activity.rating,
    user_ratings_total: activity.reviewsCount,
    price_level: activity.priceRange,
    photos: activity.photoUrl ? [{ photo_reference: activity.photoUrl }] : [],
    opening_hours: {
      open_now: true,
    },
  };
}

// Search nearby places using NEW Google Places API
async function searchNearbyPlaces(params: {
  location: PlaceLocation;
  radius: number;
  maxResults?: number;
}): Promise<PlaceResult[]> {
  const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!API_KEY) {
    console.warn('No Google Places API key found, using mock data');
    const mockActivities = getMockActivities();
    return mockActivities.map(activityToPlaceResult);
  }

  const { location, radius, maxResults = 20 } = params;

  try {
    console.log('🔍 Calling NEW Google Places API...');
    console.log(`📍 Location: ${location.lat}, ${location.lng}, Radius: ${radius}m`);

    // Call NEW Places API (New) - searchNearby endpoint
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        // Request essential fields including photos for visual feed
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.photos,places.currentOpeningHours',
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: {
            center: {
              latitude: location.lat,
              longitude: location.lng,
            },
            radius: radius,
          },
        },
        // Removed includedTypes - let it return all place types
        maxResultCount: Math.min(maxResults, 20), // Google max is 20
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Google Places API error:', response.status);
      console.error('❌ Error details:', errorText);
      console.error('❌ Request was:', {
        url: 'https://places.googleapis.com/v1/places:searchNearby',
        location: { lat: location.lat, lng: location.lng },
        radius: radius,
      });
      throw new Error(`Google Places API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ Found ${data.places?.length || 0} places from Google`);

    // Convert NEW API format to PlaceResult format
    const places: PlaceResult[] = (data.places || []).map((place: any) => ({
      place_id: place.id,
      name: place.displayName?.text || place.displayName || 'Unknown Place',
      vicinity: place.formattedAddress || '',
      formatted_address: place.formattedAddress || '',
      geometry: {
        location: {
          lat: place.location?.latitude || 0,
          lng: place.location?.longitude || 0,
        },
      },
      types: place.types || [],
      rating: place.rating || 0,
      user_ratings_total: place.userRatingCount || 0,
      price_level: 2, // Default to moderate since we didn't request priceLevel
      photos: place.photos?.map((photo: any) => ({
        photo_reference: photo.name || '', // NEW API uses 'name' field for photo reference
      })) || [],
      opening_hours: {
        open_now: place.currentOpeningHours?.openNow ?? true, // Use actual data or default to open
      },
    }));

    console.log(`📍 Sample place:`, places[0]?.name, places[0]?.types?.[0]);

    return places;

  } catch (error) {
    console.error('❌ Error calling Google Places API:', error);
    console.log('📦 Falling back to mock data');

    // Fallback to mock data
    const mockActivities = getMockActivities();
    return mockActivities.map(activityToPlaceResult);
  }
}

export interface ScoredRecommendation {
  place: PlaceResult;
  score: number;
  scoreBreakdown: {
    baseScore: number;
    locationScore: number;
    timeScore: number;
    feedbackScore: number;
    collaborativeScore: number;
    sponsoredBoost: number;
    finalScore: number;
  };
  distance: number; // miles
  category: string;
  photoUrl?: string;
  aiExplanation: string;
  isSponsored: boolean;
}

export interface RecommendationParams {
  user: User;
  userLocation: PlaceLocation;
  homeLocation?: PlaceLocation;
  workLocation?: PlaceLocation;
  maxDistance?: number; // miles
  maxResults?: number;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
}

/**
 * Generate personalized activity recommendations
 * Implements the MVP scoring algorithm from CLAUDE.md
 */
export async function generateRecommendations(
  params: RecommendationParams
): Promise<ScoredRecommendation[]> {
  const {
    user,
    userLocation,
    homeLocation,
    workLocation,
    maxDistance = user.preferences?.max_distance_miles || 5,
    maxResults = 10,
    timeOfDay,
  } = params;

  console.log('Generating recommendations for user:', user.id);
  console.log('User interests:', user.interests);
  console.log('Max distance:', maxDistance, 'miles');

  // Step 1: Query Google Places API for nearby activities
  const radiusMeters = maxDistance * 1609.34; // Convert miles to meters

  let nearbyPlaces: PlaceResult[] = [];
  try {
    nearbyPlaces = await searchNearbyPlaces({
      location: userLocation,
      radius: Math.min(radiusMeters, 50000), // Google max is 50km
      maxResults: 20, // NEW API maximum limit (1-20 allowed)
    });
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    // searchNearbyPlaces will automatically fallback to mock data
    nearbyPlaces = await searchNearbyPlaces({
      location: userLocation,
      radius: Math.min(radiusMeters, 50000),
      maxResults: 20, // NEW API maximum limit (1-20 allowed)
    });
  }

  console.log(`Found ${nearbyPlaces.length} nearby places`);

  // If still no places, return empty array
  if (nearbyPlaces.length === 0) {
    console.warn('No places found, returning empty recommendations');
    return [];
  }

  // Step 2: Score each activity
  const scoredRecommendations: ScoredRecommendation[] = [];

  for (const place of nearbyPlaces) {
    const category = mapPlaceTypeToCategory(place.types);
    const distance = calculateDistance(userLocation, place.geometry.location);

    // Calculate score
    const scoreBreakdown = calculateActivityScore({
      place,
      category,
      distance,
      user,
      homeLocation,
      workLocation,
      timeOfDay,
    });

    // Skip if score is too low (below 20 points)
    if (scoreBreakdown.finalScore < 20) {
      continue;
    }

    // Generate AI explanation
    const aiExplanation = generateExplanation({
      place,
      category,
      distance,
      user,
      scoreBreakdown,
    });

    // Get photo URL
    const photoUrl = place.photos?.[0]
      ? getPlacePhotoUrl(place.photos[0].photo_reference)
      : undefined;

    scoredRecommendations.push({
      place,
      score: scoreBreakdown.finalScore,
      scoreBreakdown,
      distance,
      category,
      photoUrl,
      aiExplanation,
      isSponsored: false, // TODO: Check if business has sponsored tier
    });
  }

  // Step 3: Rank by score (high to low)
  scoredRecommendations.sort((a, b) => b.score - a.score);

  // Step 4: Apply business rules
  const finalRecommendations = applyBusinessRules(scoredRecommendations, maxResults);

  console.log(`Returning ${finalRecommendations.length} recommendations`);

  return finalRecommendations;
}

/**
 * Calculate activity score (0-100 points)
 * Based on MVP algorithm from CLAUDE.md
 */
function calculateActivityScore(params: {
  place: PlaceResult;
  category: string;
  distance: number;
  user: User;
  homeLocation?: PlaceLocation;
  workLocation?: PlaceLocation;
  timeOfDay?: string;
}): ScoredRecommendation['scoreBreakdown'] {
  const { place, category, distance, user, homeLocation, workLocation, timeOfDay } = params;

  let baseScore = 0;
  let locationScore = 0;
  let timeScore = 0;
  let feedbackScore = 5; // Neutral default
  let collaborativeScore = 0;
  let sponsoredBoost = 0;

  // === BASE SCORE (40 points max) ===
  const userInterests = user.interests || [];
  const topInterests = user.ai_profile?.favorite_categories || userInterests.slice(0, 3);

  if (topInterests.includes(category)) {
    baseScore = 20; // Top 3 interests
  } else if (userInterests.includes(category)) {
    baseScore = 10; // Other interests
  } else {
    baseScore = 0; // No match (still eligible)
  }

  // Boost based on rating
  if (place.rating) {
    if (place.rating >= 4.5) baseScore += 10;
    else if (place.rating >= 4.0) baseScore += 5;
    else if (place.rating >= 3.5) baseScore += 2;
  }

  // === LOCATION SCORE (20 points max) ===
  const userMaxDistance = user.preferences?.max_distance_miles || 5;

  if (distance <= 0.5) {
    locationScore = 20; // Very close
  } else if (distance <= 1) {
    locationScore = 15; // Walking distance
  } else if (distance <= userMaxDistance) {
    locationScore = 10; // Within preferred range
  } else {
    locationScore = Math.max(0, 10 - (distance - userMaxDistance) * 2); // Penalty for far
  }

  // Bonus if near home or work
  if (homeLocation && calculateDistance(homeLocation, place.geometry.location) <= 1) {
    locationScore += 5;
  }
  if (workLocation && calculateDistance(workLocation, place.geometry.location) <= 1) {
    locationScore += 5;
  }

  locationScore = Math.min(locationScore, 20); // Cap at 20

  // === TIME CONTEXT SCORE (15 points max) ===
  const currentTimeOfDay = timeOfDay || getCurrentTimeOfDay();

  // Check user's time preferences
  const preferredTimes = user.preferences?.preferred_times || [];
  if (preferredTimes.includes(currentTimeOfDay)) {
    timeScore += 5;
  }

  // Activity type vs time of day matching
  const timeContextMatches = checkTimeContext(category, currentTimeOfDay);
  if (timeContextMatches === 'perfect') timeScore += 10;
  else if (timeContextMatches === 'good') timeScore += 5;
  else timeScore += 2; // Acceptable

  timeScore = Math.min(timeScore, 15); // Cap at 15

  // === FEEDBACK HISTORY SCORE (15 points max) ===
  // TODO: Implement once we have feedback data
  // For now, use neutral score
  feedbackScore = 5;

  // === COLLABORATIVE FILTERING (10 points max) ===
  // TODO: Implement once we have multiple users
  collaborativeScore = 0;

  // === SPONSORED TIER BOOST ===
  // TODO: Check database for sponsored status
  // For now, all organic
  const isSponsored = false;
  if (isSponsored) {
    const baseTotal = baseScore + locationScore + timeScore + feedbackScore + collaborativeScore;
    if (baseTotal >= 40) {
      sponsoredBoost = baseTotal * 0.30; // 30% boost for Premium
    } else {
      sponsoredBoost = Math.min(10, baseTotal * 0.30); // Cap irrelevant sponsored at +10
    }
  }

  // === FINAL SCORE ===
  const finalScore = Math.round(
    baseScore + locationScore + timeScore + feedbackScore + collaborativeScore + sponsoredBoost
  );

  return {
    baseScore,
    locationScore,
    timeScore,
    feedbackScore,
    collaborativeScore,
    sponsoredBoost,
    finalScore: Math.min(finalScore, 100), // Cap at 100
  };
}

/**
 * Check if activity type matches time of day
 */
function checkTimeContext(
  category: string,
  timeOfDay: string
): 'perfect' | 'good' | 'acceptable' {
  const timeMatches: Record<string, string[]> = {
    morning: ['coffee', 'cafe', 'breakfast', 'gym', 'fitness', 'park'],
    afternoon: ['dining', 'shopping', 'culture', 'museums', 'parks'],
    evening: ['dining', 'nightlife', 'movies', 'entertainment', 'live music'],
    night: ['nightlife', 'bars', 'live music', 'entertainment'],
  };

  const perfectMatches = timeMatches[timeOfDay] || [];

  if (perfectMatches.includes(category)) {
    return 'perfect';
  } else if (category === 'dining' || category === 'entertainment') {
    return 'good'; // These work most times
  } else {
    return 'acceptable';
  }
}

/**
 * Get current time of day
 */
function getCurrentTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Generate AI explanation for recommendation
 */
function generateExplanation(params: {
  place: PlaceResult;
  category: string;
  distance: number;
  user: User;
  scoreBreakdown: ScoredRecommendation['scoreBreakdown'];
}): string {
  const { place, category, distance, user } = params;

  const interests = user.interests || [];
  const topInterest = interests[0] || 'exploring new places';

  // Template-based explanations (will be replaced with OpenAI in Phase 2)
  const templates = [
    `Based on your love of ${topInterest}, this ${category} spot is just ${distance} miles away.`,
    `Perfect for ${topInterest} enthusiasts! ${place.name} has ${place.rating || 4.0}★ ratings.`,
    `Only ${distance} miles from you - great for ${topInterest}.`,
    `This ${category} venue matches your interests in ${topInterest}.`,
  ];

  // Pick random template
  const template = templates[Math.floor(Math.random() * templates.length)];

  return template;
}

/**
 * Apply business rules to final recommendations
 */
function applyBusinessRules(
  recommendations: ScoredRecommendation[],
  maxResults: number
): ScoredRecommendation[] {
  // Rule 1: Max 2 sponsored activities in top 5
  const top5 = recommendations.slice(0, 5);
  const sponsoredInTop5 = top5.filter(r => r.isSponsored).length;
  if (sponsoredInTop5 > 2) {
    // Move excess sponsored activities lower
    // TODO: Implement sponsored activity management
  }

  // Rule 2: Never show same business twice
  const seenPlaceIds = new Set<string>();
  const uniqueRecommendations = recommendations.filter(r => {
    if (seenPlaceIds.has(r.place.place_id)) {
      return false;
    }
    seenPlaceIds.add(r.place.place_id);
    return true;
  });

  // Rule 3: Diversity requirement (at least 3 different categories in top 5)
  const finalTop5 = uniqueRecommendations.slice(0, 5);
  const categoriesInTop5 = new Set(finalTop5.map(r => r.category));

  // If not enough diversity, try to swap in diverse categories
  if (categoriesInTop5.size < 3) {
    // TODO: Implement category diversity enforcement
    console.warn('Low category diversity in top 5 recommendations');
  }

  // Rule 4: Respect price range filter
  // TODO: Filter by user budget preference

  // Return top N results
  return uniqueRecommendations.slice(0, maxResults);
}

/**
 * Get recommendations for a specific category
 */
export async function getRecommendationsByCategory(
  params: RecommendationParams & { category: string }
): Promise<ScoredRecommendation[]> {
  const { category, userLocation, maxDistance = 5 } = params;

  // Map Loop category to Google Place type
  const categoryTypeMap: Record<string, string> = {
    coffee: 'cafe',
    dining: 'restaurant',
    nightlife: 'bar',
    fitness: 'gym',
    outdoors: 'park',
    shopping: 'shopping_mall',
    movies: 'movie_theater',
    culture: 'museum',
  };

  const placeType = categoryTypeMap[category] || category;

  const radiusMeters = maxDistance * 1609.34;
  const places = await searchNearbyPlaces({
    location: userLocation,
    radius: Math.min(radiusMeters, 50000),
    type: placeType,
    maxResults: 20,
  });

  // Score and return
  return generateRecommendations({
    ...params,
    maxResults: 10,
  });
}
