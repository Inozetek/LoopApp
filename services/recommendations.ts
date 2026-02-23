// JSONB type handling from Supabase - typed via local interfaces
/**
 * Recommendation Engine
 * Scores and ranks activities based on user preferences, location, and context
 *
 * Multi-Source Support (Phase 1):
 * - Google Places API (default)
 * - Eventbrite API (events)
 * - Yelp API (enhanced ratings) - Phase 2
 */

// Set to true to enable verbose per-place scoring logs (very noisy)
const DEBUG_RECS = false;

// Production-ready imports - NO MOCK DATA
import { getCachedUnsplashImage } from './unsplash';
import { getBusinessHours, suggestVisitTime } from '@/utils/business-hours';
import { supabase } from '@/lib/supabase';
import type { User, DiscoveryStyle } from '@/types/database';
import type { Activity, UnifiedActivity, SearchParams as MultiSourceSearchParams } from '@/types/activity';

// Multi-source integration
import { activitySources, isMixedFeedEnabled } from './activity-source';
import './google-places-service'; // Import to ensure Google Places service is registered
import './ticketmaster-service'; // Import to ensure Ticketmaster service is registered
// import './yelp-service'; // Import to ensure Yelp service is registered (postponed - no free tier)
// import './groupon-service'; // Import to ensure Groupon service is registered
// import './songkick-service'; // Import to ensure Songkick service is registered (postponed - $500/mo)
// import './eventbrite-service'; // Import to ensure Eventbrite service is registered (deprecated API)

// City-based caching (Phase 4)
import { detectUserCity, detectUserCityWithFallback } from './city-detection';
import { checkCityCache, seedCityData, getCachedPlaces } from './cache-manager';

// Curated recommendations (first-session magic)
import { getCuratedRecommendations, getAgeBracketFromUser } from './curated-service';

// Unified interest taxonomy
import {
  INTEREST_GROUPS,
  ACTIVITY_CATEGORIES,
  mapInterestsToCategoryIds,
  categoryMatchesInterests,
} from '@/constants/activity-categories';

// NEW: Data source integrations (Day 1 Sprint)
import { matchFacebookLikedPlace } from './facebook-graph';
import { matchTimelineVisitedPlace, calculateFreshnessFactor } from './google-timeline';
import type { FacebookData, GoogleTimelineData, AIProfile, CalendarPattern } from '@/types/user';

// ─── Supabase Json → typed helpers ──────────────────────────────────────
// The DB `User` type stores interests/preferences/ai_profile as opaque `Json`.
// These helpers cast them to the shapes the engine actually expects.

import type { Json } from '@/types/database';

/** Safely cast user.interests (Json) to string[] */
function asInterests(raw: Json): string[] {
  return Array.isArray(raw) ? (raw as string[]) : [];
}

/** Safely cast user.preferences (Json) to the expected shape */
interface UserPrefsShape {
  budget?: number;
  max_distance_miles?: number;
  preferred_times?: string[];
  notification_enabled?: boolean;
  discovery_style?: DiscoveryStyle;
}
function asPreferences(raw: Json): UserPrefsShape {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as unknown as UserPrefsShape;
  return {};
}

/** Safely cast user.ai_profile (Json) to AIProfile-like shape */
interface AIProfileShape {
  preferred_distance_miles?: number;
  budget_level?: number;
  favorite_categories?: string[];
  disliked_categories?: string[];
  price_sensitivity?: string;
  time_preferences?: string[];
  distance_tolerance?: string;
  calendar_patterns?: CalendarPattern[];
}
function asAIProfile(raw: Json): AIProfileShape {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as unknown as AIProfileShape;
  return {};
}

/**
 * Extended User that may carry optional OAuth/demographic fields
 * not present in the Supabase schema type but attached at runtime.
 */
interface ExtendedUser extends User {
  facebook_data?: FacebookData;
  google_timeline?: GoogleTimelineData;
  birth_year?: number | null;
  age_bracket?: string | null;
}

// Generic place patterns to filter (unless user has positive feedback history)
const GENERIC_PLACE_PATTERNS = [
  // Big box retail (with variations)
  /walmart/i, /wal-mart/i, /walmart supercenter/i, /walmart neighborhood market/i,
  /target/i, /costco/i, /sam'?s club/i, /bj'?s wholesale/i,
  /home depot/i, /lowe'?s/i, /best buy/i, /marshalls/i, /tj maxx/i, /ross/i,
  /dollar general/i, /dollar tree/i, /family dollar/i,

  // Fast food chains
  /mcdonald'?s/i, /burger king/i, /wendy'?s/i, /taco bell/i, /kfc/i,
  /subway/i, /dunkin'?/i, /domino'?s/i, /pizza hut/i, /papa john'?s/i,
  /chipotle/i, /panera/i, /arby'?s/i, /popeyes/i, /sonic/i, /jack in the box/i,
  /white castle/i, /carl'?s jr/i, /hardee'?s/i, /five guys/i,

  // Gas stations & convenience
  /shell/i, /chevron/i, /bp/i, /exxon/i, /mobil/i, /texaco/i, /valero/i,
  /7-eleven/i, /circle k/i, /wawa/i, /sheetz/i, /speedway/i, /quicktrip/i,
  /racetrac/i, /loves/i, /pilot/i, /flying j/i,

  // Pharmacies
  /cvs/i, /walgreens/i, /rite aid/i, /pharmacy/i,

  // Banks & ATMs
  /chase bank/i, /bank of america/i, /wells fargo/i, /citibank/i, /atm/i,
  /us bank/i, /pnc bank/i, /capital one/i, /td bank/i,

  // Religious places (unless user has this as interest)
  /church/i, /cathedral/i, /chapel/i, /temple/i, /mosque/i, /synagogue/i,
  /parish/i, /ministry/i, /congregation/i, /baptist/i, /methodist/i, /lutheran/i,

  // Generic services
  /ups store/i, /fedex/i, /post office/i, /usps/i, /dmv/i,
  /laundromat/i, /car wash/i, /storage/i, /self storage/i,
];

// Discovery style scoring configuration
// Shapes how aggressively Loop favours familiar vs novel places
export const DISCOVERY_STYLE_CONFIG = {
  explorer:          { nonMatchingBase: 18, visitMultiplier: 0.5, recencyMultiplier: 0.5, maxPerCategory: 2, categoryGroups: 8 },
  balanced:          { nonMatchingBase: 12, visitMultiplier: 1.0, recencyMultiplier: 1.0, maxPerCategory: 3, categoryGroups: 5 },
  creature_of_habit: { nonMatchingBase: 6,  visitMultiplier: 1.5, recencyMultiplier: 0.6, maxPerCategory: 4, categoryGroups: 3 },
} as const;

// Shared types — re-exported so existing consumers don't break
export type { PlaceLocation, PlaceResult } from './places-common';
import type { PlaceLocation, PlaceResult } from './places-common';

// Helper function: Check if place name matches generic patterns
function isGenericPlace(placeName: string): boolean {
  return GENERIC_PLACE_PATTERNS.some(pattern => pattern.test(placeName));
}

// Helper function: Check if user has positive feedback history for generic place type
function userFrequentsGenericPlace(place: PlaceResult, user: User): boolean {
  // Check if user has favorite categories that match this place type
  const userFavorites = asAIProfile(user.ai_profile).favorite_categories || [];
  const placeCategory = mapPlaceTypeToCategory(place.types);

  // If user has this category in favorites, allow generic places
  if (userFavorites.includes(placeCategory)) {
    return true;
  }

  // Check if user has positive feedback history for this specific place
  // TODO: When feedback system is implemented, check database for thumbs up on this place
  // For now, rely on favorite categories

  return false;
}

// Helper function: Check if place is popular/trending (high quality)
function isPopularPlace(place: PlaceResult): boolean {
  // Popular = high rating AND significant number of reviews
  const hasHighRating = (place.rating || 0) >= 4.0;
  const hasSignificantReviews = (place.user_ratings_total || 0) >= 50;

  return hasHighRating && hasSignificantReviews;
}

// Helper function: Check if place matches user interests
function matchesUserInterests(place: PlaceResult, user: User): boolean {
  const category = mapPlaceTypeToCategory(place.types);
  const userInterests = asInterests(user.interests);
  const topInterests = asAIProfile(user.ai_profile).favorite_categories || userInterests.slice(0, 3);

  return topInterests.includes(category) || userInterests.includes(category);
}

// Helper function: Map user interest categories to Google Places API types
// Uses unified taxonomy from constants/activity-categories.ts
// See: https://developers.google.com/maps/documentation/places/web-service/place-types
function mapInterestsToGoogleTypes(interests: string[]): string[] {
  const googleTypes = new Set<string>();

  // Get category IDs for user interests using unified taxonomy
  const categoryIds = mapInterestsToCategoryIds(interests);

  // Map each category ID to its Google Places types
  for (const categoryId of categoryIds) {
    const category = ACTIVITY_CATEGORIES.find(c => c.id === categoryId);
    if (category?.googlePlacesTypes) {
      category.googlePlacesTypes.forEach(type => googleTypes.add(type));
    }
  }

  // Fallback mappings for common interests that may not have direct category matches
  // This handles edge cases and ensures broad coverage
  const fallbackMap: Record<string, string[]> = {
    'Dining': ['restaurant', 'meal_takeaway', 'meal_delivery'],
    'Coffee & Cafes': ['cafe', 'coffee_shop'],
    'Bars & Nightlife': ['bar', 'night_club'],
    'Entertainment': ['movie_theater', 'bowling_alley', 'amusement_park', 'performing_arts_theater'],
    'Arts & Culture': ['art_gallery', 'museum', 'cultural_center', 'performing_arts_theater'],
    'Sports': ['stadium', 'sports_complex', 'sports_club'],
    'Fitness': ['gym', 'fitness_center', 'yoga_studio', 'sports_complex'],
    'Outdoor Activities': ['park', 'hiking_area', 'campground', 'national_park'],
    'Shopping': ['shopping_mall', 'store', 'clothing_store', 'book_store'],
  };

  // Add fallback types for interests that didn't map through taxonomy
  for (const interest of interests) {
    const fallbackTypes = fallbackMap[interest];
    if (fallbackTypes) {
      fallbackTypes.forEach(type => googleTypes.add(type));
    }
  }

  // If no mapping found or no interests, return empty array (will query all types)
  return Array.from(googleTypes);
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

// Helper function: Map place types to user-facing category label
// Uses unified taxonomy from constants/activity-categories.ts
function mapPlaceTypeToCategory(types: string[]): string {
  // Try to find a matching category using the unified taxonomy
  for (const type of types) {
    const category = ACTIVITY_CATEGORIES.find(c =>
      c.googlePlacesTypes?.includes(type)
    );
    if (category) {
      // Find which interest group contains this category
      for (const [interestLabel, group] of Object.entries(INTEREST_GROUPS)) {
        if (group.categoryIds.includes(category.id)) {
          return interestLabel;
        }
      }
      // If no interest group, return the category name
      return category.name;
    }
  }

  // Fallback mapping for types not in taxonomy
  const fallbackMap: Record<string, string> = {
    restaurant: 'Dining',
    cafe: 'Coffee & Cafes',
    bar: 'Bars & Nightlife',
    night_club: 'Bars & Nightlife',
    gym: 'Fitness',
    park: 'Outdoor Activities',
    museum: 'Arts & Culture',
    movie_theater: 'Entertainment',
    shopping_mall: 'Shopping',
    art_gallery: 'Arts & Culture',
  };

  for (const type of types) {
    if (fallbackMap[type]) {
      return fallbackMap[type];
    }
  }
  return 'Other';
}

// Helper function: Get photo URL from Google Places API (NEW v1)
function getPlacePhotoUrl(photoReference: string): string {
  const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!API_KEY || !photoReference) {
    return '';
  }

  // Reject full URLs — caller should handle these before calling this function
  if (photoReference.startsWith('http://') || photoReference.startsWith('https://')) {
    return '';
  }

  // Validate photo reference format: must be "places/PLACE_ID/photos/PHOTO_ID"
  if (!photoReference.startsWith('places/') || !photoReference.includes('/photos/')) {
    return '';
  }

  return `https://places.googleapis.com/v1/${photoReference}/media?key=${API_KEY}&maxHeightPx=400&maxWidthPx=600`;
}

/**
 * Enrich place with additional photos from Place Details API
 * Used for places with <2 photos to enable photo carousel
 *
 * Rate-limited + capped to avoid 429 quota errors.
 * Circuit breaker: stops all enrichment on first 429.
 */
let _enrichmentCallsThisBatch = 0;
let _enrichmentBlocked = false;
const MAX_ENRICHMENT_CALLS_PER_BATCH = 8;

/** Call at the start of each recommendation batch to reset enrichment limits */
function resetEnrichmentCounter() {
  _enrichmentCallsThisBatch = 0;
  _enrichmentBlocked = false;
}

async function enrichPlacePhotos(placeId: string): Promise<Array<{ photo_reference: string }>> {
  // ⭐ CRITICAL: Check kill switch first
  if (process.env.EXPO_PUBLIC_DISABLE_GOOGLE_PLACES_API === 'true') {
    return [];
  }

  // Circuit breaker: stop if we hit a 429 earlier this batch
  if (_enrichmentBlocked) {
    return [];
  }

  // Cap total enrichment calls per batch to protect quota
  if (_enrichmentCallsThisBatch >= MAX_ENRICHMENT_CALLS_PER_BATCH) {
    return [];
  }

  const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!API_KEY) {
    console.error('❌ No Google Places API key - cannot enrich photos');
    return [];
  }

  _enrichmentCallsThisBatch++;

  try {
    // The new Places API (v1) requires resource name format: places/PLACE_ID
    // Convert plain place ID to resource name if needed
    const resourceName = placeId.startsWith('places/') ? placeId : `places/${placeId}`;

    // Use rate limiter to prevent 429 quota errors
    const { rateLimitedPlacesRequest } = await import('@/utils/api-rate-limiter');

    const response = await rateLimitedPlacesRequest(() =>
      fetch(
        `https://places.googleapis.com/v1/${resourceName}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'photos', // Only request photos to minimize cost
          },
        }
      )
    );

    if (!response.ok) {
      // On 429 rate limit, activate circuit breaker to stop all further enrichment
      if (response.status === 429) {
        console.warn(`⚠️ Rate limited (429) on photo enrichment — pausing all enrichment this batch`);
        _enrichmentBlocked = true;
        return [];
      }
      const errorText = await response.text().catch(() => 'Could not read error body');
      console.error(`❌ Failed to fetch place details for ${resourceName}: ${response.status}`);
      console.error(`   Error details: ${errorText.substring(0, 200)}`);
      return [];
    }

    const data = await response.json();
    const photos = data.photos || [];

    console.log(`📸 Place Details returned ${photos.length} photos`);

    return photos.map((photo: any) => ({
      photo_reference: photo.name, // 'places/PLACE_ID/photos/PHOTO_ID' format
    }));
  } catch (error) {
    console.error('❌ Error enriching photos:', error);
    return [];
  }
}

// Search places by text query using NEW Google Places API
async function searchPlacesByText(params: {
  query: string;
  location: PlaceLocation;
  radius: number;
  maxResults?: number;
}): Promise<PlaceResult[]> {
  // COST CONTROL: Block API calls if disabled (use cache only)
  if (process.env.EXPO_PUBLIC_DISABLE_GOOGLE_PLACES_API === 'true') {
    console.warn('🚫 Google Places API disabled (cost control) - searchPlacesByText blocked. Use cached data.');
    return [];
  }

  const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!API_KEY) {
    console.error('❌ Google Places API key not configured');
    throw new Error('Google Places API key is required. Please set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in your environment.');
  }

  const { query, location, radius, maxResults = 20 } = params;

  try {
    // Track API usage BEFORE making request
    const { trackPlacesAPIRequest } = await import('@/utils/api-cost-tracker');
    const allowRequest = await trackPlacesAPIRequest('text_search');

    if (!allowRequest) {
      console.error('🚨 API request blocked - free tier limit reached!');
      console.log('⚠️ Returning empty results to prevent charges');
      return [];
    }

    console.log('🔍 Calling Google Places Text Search API...');
    console.log(`📍 Query: "${query}", Location: ${location.lat}, ${location.lng}, Radius: ${radius}m`);

    // Call NEW Places API (New) - searchText endpoint
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        // Request essential fields including photos for visual feed
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.currentOpeningHours,places.internationalPhoneNumber,places.websiteUri,places.editorialSummary',
      },
      body: JSON.stringify({
        textQuery: query,
        locationBias: {
          circle: {
            center: {
              latitude: location.lat,
              longitude: location.lng,
            },
            radius: radius,
          },
        },
        maxResultCount: Math.min(maxResults, 20), // Google max is 20
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Google Places API error:', response.status);
      console.error('❌ Error details:', errorText);
      throw new Error(`Google Places API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ Found ${data.places?.length || 0} places matching "${query}"`);

    // Convert NEW API format to PlaceResult format
    const places: PlaceResult[] = (data.places || []).map((place: any) => ({
      place_id: place.id,
      name: place.displayName?.text || place.displayName || 'Unknown Place',
      vicinity: place.formattedAddress || '',
      formatted_address: place.formattedAddress || '',
      description: place.editorialSummary?.text || place.editorialSummary,
      formatted_phone_number: place.internationalPhoneNumber,
      website: place.websiteUri,
      geometry: {
        location: {
          lat: place.location?.latitude || 0,
          lng: place.location?.longitude || 0,
        },
      },
      types: place.types || [],
      rating: place.rating || 0,
      user_ratings_total: place.userRatingCount || 0,
      price_level: place.priceLevel || 0, // 0 = free/unknown (was: default to 2)
      photos: place.photos?.map((photo: any) => ({
        photo_reference: photo.name || '',
      })) || [],
      opening_hours: {
        open_now: place.currentOpeningHours?.openNow ?? true,
        periods: place.currentOpeningHours?.periods?.map((p: any) => ({
          open: { day: p.open?.day ?? 0, time: p.open?.hour != null ? `${String(p.open.hour).padStart(2, '0')}${String(p.open.minute ?? 0).padStart(2, '0')}` : '0000' },
          close: p.close ? { day: p.close.day ?? 0, time: `${String(p.close.hour).padStart(2, '0')}${String(p.close.minute ?? 0).padStart(2, '0')}` } : undefined,
        })),
      },
    }));

    console.log(`📍 Sample result:`, places[0]?.name, `(${places[0]?.rating}★)`);

    return places;

  } catch (error) {
    console.error('❌ Error calling Google Places Text Search API:', error);
    // Return empty array instead of mock data
    return [];
  }
}

// Search nearby places using NEW Google Places API
export async function searchNearbyPlaces(params: {
  location: PlaceLocation;
  radius: number;
  maxResults?: number;
  includedTypes?: string[]; // Filter by place types (e.g., ['restaurant', 'cafe'])
}): Promise<PlaceResult[]> {
  // COST CONTROL: Block API calls if disabled (use cache only)
  if (process.env.EXPO_PUBLIC_DISABLE_GOOGLE_PLACES_API === 'true') {
    console.warn('🚫 Google Places API disabled (cost control) - searchNearbyPlaces blocked. Use cached data.');
    return [];
  }

  const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!API_KEY) {
    console.error('❌ Google Places API key not configured');
    throw new Error('Google Places API key is required. Please set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in your environment.');
  }

  const { location, radius, maxResults = 20, includedTypes } = params;

  try {
    // Track API usage BEFORE making request
    const { trackPlacesAPIRequest } = await import('@/utils/api-cost-tracker');
    const allowRequest = await trackPlacesAPIRequest('nearby_search');

    if (!allowRequest) {
      console.error('🚨 API request blocked - free tier limit reached!');
      console.log('⚠️ Returning empty results to prevent charges');
      return [];
    }

    console.log('🔍 Calling NEW Google Places API...');
    console.log(`📍 Location: ${location.lat}, ${location.lng}, Radius: ${radius}m`);

    console.log('📸 DEBUG: Requesting photos in field mask...');

    // Import rate limiter for controlled API access
    const { rateLimitedPlacesRequest } = await import('@/utils/api-rate-limiter');

    // Call NEW Places API (New) - searchNearby endpoint with rate limiting
    const response = await rateLimitedPlacesRequest(() =>
      fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          // Request essential fields including photos for visual feed
          // CRITICAL: Must include places.photos to get photo data
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.currentOpeningHours,places.internationalPhoneNumber,places.websiteUri',
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
          // Filter by user interests if provided
          ...(includedTypes && includedTypes.length > 0 ? { includedTypes } : {}),
          maxResultCount: Math.min(maxResults, 20), // Google max is 20
        }),
      })
    );

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

    // DEBUG: Log first place's photos to see actual API response format
    if (data.places && data.places.length > 0 && data.places[0]) {
      console.log('📸 DEBUG: First place from API:', data.places[0].displayName?.text || data.places[0].displayName);
      console.log('📸 DEBUG: Photos array:', JSON.stringify(data.places[0].photos, null, 2));
      if (data.places[0].photos && data.places[0].photos.length > 0) {
        console.log('📸 DEBUG: First photo:', JSON.stringify(data.places[0].photos[0], null, 2));
      } else {
        console.log('📸 DEBUG: No photos in first place!');
      }
    }

    // Convert NEW API format to PlaceResult format
    const places: PlaceResult[] = (data.places || []).map((place: any) => ({
      place_id: place.id,
      name: place.displayName?.text || place.displayName || 'Unknown Place',
      vicinity: place.formattedAddress || '',
      formatted_address: place.formattedAddress || '',
      formatted_phone_number: place.internationalPhoneNumber,
      website: place.websiteUri,
      geometry: {
        location: {
          lat: place.location?.latitude || 0,
          lng: place.location?.longitude || 0,
        },
      },
      types: place.types || [],
      rating: place.rating || 0,
      user_ratings_total: place.userRatingCount || 0,
      price_level: place.priceLevel || 0, // 0 = free/unknown (was: default to 2)
      photos: place.photos?.map((photo: any) => ({
        photo_reference: photo.name || '', // NEW API uses 'name' field for photo reference
      })) || [],
      opening_hours: {
        open_now: place.currentOpeningHours?.openNow ?? true,
        periods: place.currentOpeningHours?.periods?.map((p: any) => ({
          open: { day: p.open?.day ?? 0, time: p.open?.hour != null ? `${String(p.open.hour).padStart(2, '0')}${String(p.open.minute ?? 0).padStart(2, '0')}` : '0000' },
          close: p.close ? { day: p.close.day ?? 0, time: `${String(p.close.hour).padStart(2, '0')}${String(p.close.minute ?? 0).padStart(2, '0')}` } : undefined,
        })),
      },
    }));

    console.log(`📍 Sample place:`, places[0]?.name, places[0]?.types?.[0]);

    return places;

  } catch (error) {
    console.error('❌ Error calling Google Places API:', error);
    // Return empty array instead of mock data
    return [];
  }
}

/**
 * Multi-Source Activity Search (Phase 1)
 *
 * Searches all available activity sources (Google Places, Eventbrite, Yelp)
 * Falls back to Google Places only if mixed feed is disabled
 *
 * @param params Search parameters
 * @returns Combined results from all sources (or Google Places only)
 */
async function searchActivitiesMultiSource(params: {
  location: PlaceLocation;
  radius: number;
  maxResults?: number;
  includedTypes?: string[];
  userInterests?: string[];
}): Promise<PlaceResult[]> {
  const { location, radius, maxResults = 20, includedTypes, userInterests } = params;

  // Check if mixed feed is enabled
  const mixedFeedEnabled = isMixedFeedEnabled();
  console.log(`[MultiSource] ========================================`);
  console.log(`[MultiSource] Mixed feed check:`, mixedFeedEnabled);
  console.log(`[MultiSource] ENABLE_MIXED_FEED env:`, process.env.EXPO_PUBLIC_ENABLE_MIXED_FEED);
  console.log(`[MultiSource] ENABLE_TICKETMASTER env:`, process.env.EXPO_PUBLIC_ENABLE_TICKETMASTER);
  console.log(`[MultiSource] ========================================`);

  if (!mixedFeedEnabled) {
    console.log('[MultiSource] Mixed feed disabled, using Google Places only');
    return searchNearbyPlaces({ location, radius, maxResults, includedTypes });
  }

  console.log('[MultiSource] Mixed feed enabled, searching all sources...');

  // Build multi-source search params
  const searchParams: MultiSourceSearchParams = {
    latitude: location.lat,
    longitude: location.lng,
    radius,
    interests: userInterests,
    limit: maxResults,
  };

  try {
    // Search all available sources in parallel
    const activities: UnifiedActivity[] = await activitySources.searchAll(searchParams);

    console.log(`[MultiSource] Received ${activities.length} activities from all sources`);

    // Log source breakdown
    const sourceBreakdown = activities.reduce((acc, activity) => {
      acc[activity.source] = (acc[activity.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('[MultiSource] Source breakdown:', sourceBreakdown);

    // Convert UnifiedActivity[] to PlaceResult[]
    // Map editorial_summary to description for consistency
    return activities.map(activity => ({
      ...activity,
      description: activity.editorial_summary, // Map Ticketmaster/Google descriptions
    })) as PlaceResult[];

  } catch (error) {
    console.error('[MultiSource] Search failed, falling back to Google Places:', error);

    // Graceful degradation: Fall back to Google Places only
    return searchNearbyPlaces({ location, radius, maxResults, includedTypes });
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
    eventUrgencyScore: number; // NEW: Urgency bonus for events happening soon
    sponsoredBoost: number;
    recencyPenalty?: number; // NEW: Penalty for recently shown places (Phase 1.3)
    // NEW: 8 Data Source Boosts (Day 1 Sprint + Feedback Loop)
    facebookExactPlaceBoost?: number; // +30 points for exact liked place match
    facebookCategoryBoost?: number; // +15 points for liked category match
    googleTimelineVisitBoost?: number; // +20-35 points for visited places
    googleTimelineCategoryBoost?: number; // +10-20 points for category frequency
    calendarPatternBoost?: number; // +10-25 points for time-based patterns
    budgetBoost?: number; // +15/-10 points for price match/mismatch
    loopVisitHistoryBoost?: number; // +15-40 points for Loop app visit history
    loopFeedbackBoost?: number; // +20/-20 points for Loop app ratings
    // NEW: Friend visit/moment boosts (Loop Moments)
    friendVisitBoost?: number; // +25 if friend visited in last 7 days
    friendPhotoBoost?: number; // +15 if place has friend moments
    trendingFriendsBoost?: number; // +20 if 2+ friends visited this week
    finalScore: number;
  };
  distance: number; // miles
  category: string;
  photoUrl?: string; // Primary photo (first one)
  photoUrls?: string[]; // All photos for carousel (when 3+ available)
  aiExplanation: string;
  isSponsored: boolean;
  businessHours?: any; // Google opening_hours object
  hasEstimatedHours?: boolean;
  suggestedTime?: Date;
  groupMemberMatches?: GroupMemberMatch[];
}

export interface RecommendationParams {
  user: User;
  userLocation: PlaceLocation;
  homeLocation?: PlaceLocation;
  workLocation?: PlaceLocation;
  maxDistance?: number; // miles
  maxResults?: number;
  timeOfDay?: 'any' | 'morning' | 'afternoon' | 'evening' | 'night' | string[] | undefined;
  priceRange?: 'any' | 1 | 2 | 3 | 4;
  excludePlaceIds?: string[]; // For infinite scroll: only exclude current feed items
  categories?: string[]; // Filter by specific categories
  minRating?: number; // Minimum rating (0-5)
  date?: Date; // Search for specific date (future recommendations)
  openNow?: boolean; // Only show places that are currently open
  discoveryMode?: 'for_you' | 'explore'; // Discovery mode: for_you (conservative) vs explore (adventurous)
}

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

/**
 * Get list of Google Places types to cache based on user's interests
 * Uses category-based lazy loading strategy
 */
function getUserCategoriesForCaching(interests: string[]): string[] {
  // Map user interests to Google Places types
  const allTypes = mapInterestsToGoogleTypes(interests);

  // Deduplicate and return
  const uniqueTypes = Array.from(new Set(allTypes));

  console.log(`📦 User categories for caching: ${uniqueTypes.slice(0, 5).join(', ')}${uniqueTypes.length > 5 ? ` and ${uniqueTypes.length - 5} more...` : ''}`);

  return uniqueTypes;
}

/**
 * Convert Activity object (from cache) to PlaceResult format (for scoring)
 */
function activityToPlaceResult(activity: Activity): PlaceResult {
  return {
    place_id: activity.googlePlaceId || activity.id,
    name: activity.name,
    vicinity: activity.location.address,
    formatted_address: activity.location.address,
    description: activity.description,
    ai_description: activity.aiDescription,
    formatted_phone_number: activity.phone,
    website: activity.website,
    geometry: {
      location: {
        lat: activity.location.latitude,
        lng: activity.location.longitude,
      },
    },
    types: activity.category ? [activity.category] : [],
    rating: activity.rating,
    user_ratings_total: activity.reviewsCount,
    price_level: activity.priceRange,
    photos: activity.photoUrl ? [{ photo_reference: activity.photoUrl }] : [],
    opening_hours: {
      open_now: undefined,
      periods: activity.openingHoursPeriods,
    },
    source: 'google_places',
  };
}

/**
 * Get recently shown places with timestamps for decay-based penalty (Phase 1.3)
 */
async function getRecentlyShownWithTimestamps(
  userId: string,
  hoursBack: number = 72
): Promise<Map<string, { timestamp: number; hoursSince: number }>> {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  const { data } = await supabase
    .from('recommendation_tracking')
    .select('google_place_id, last_shown_at')
    .eq('user_id', userId)
    .gte('last_shown_at', cutoff.toISOString())
    .not('google_place_id', 'is', null);

  const map = new Map<string, { timestamp: number; hoursSince: number }>();
  const now = Date.now();

  data?.forEach((row: { google_place_id: string | null; last_shown_at: string }) => {
    if (row.google_place_id && !map.has(row.google_place_id)) {
      const timestamp = new Date(row.last_shown_at).getTime();
      const hoursSince = (now - timestamp) / (1000 * 60 * 60);
      map.set(row.google_place_id, { timestamp, hoursSince });
    }
  });

  return map;
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
    maxDistance = asPreferences(user.preferences).max_distance_miles || 5,
    maxResults = 30, // Increased for infinite scroll feed
    timeOfDay,
    priceRange,
    excludePlaceIds, // For infinite scroll: only exclude current feed items
    categories, // Filter by specific categories
    minRating, // Minimum rating filter
    date, // Search for specific date
    openNow, // Only show places that are currently open
  } = params;

  // Reset photo enrichment circuit breaker for this batch
  resetEnrichmentCounter();

  console.log('Generating recommendations for user:', user.id);
  console.log('User interests:', user.interests);
  console.log('Max distance:', maxDistance, 'miles');
  console.log('Advanced filters:', {
    categories: categories?.length || 0,
    minRating,
    openNow,
    date: date?.toLocaleDateString(),
  });

  // ========================================================================
  // FIRST SESSION DETECTION: Use curated picks for instant personalization
  // If user has no AI profile and no prior activity, serve hand-curated picks
  // ========================================================================
  const aiProfile = asAIProfile(user.ai_profile);
  const hasFavoriteCategories = (aiProfile.favorite_categories?.length ?? 0) > 0;
  const isFirstSession = !hasFavoriteCategories && !user.last_active_date;

  if (isFirstSession) {
    console.log('🌟 FIRST SESSION DETECTED — trying curated picks for instant feed');

    try {
      // Detect city for curated lookup
      const cityInfo = await detectUserCityWithFallback(user, {
        lat: userLocation.lat,
        lng: userLocation.lng,
      });

      if (cityInfo) {
        const currentTOD = getCurrentTimeOfDay();
        const ageBracket = getAgeBracketFromUser(user as unknown as ExtendedUser);
        const userInterestList = asInterests(user.interests);

        const curatedPicks = await getCuratedRecommendations(
          cityInfo.city,
          cityInfo.state,
          userInterestList,
          currentTOD,
          ageBracket,
          maxResults
        );

        if (curatedPicks.length >= 5) {
          console.log(`🌟 Got ${curatedPicks.length} curated picks — scoring and returning`);

          // Score curated picks through the normal pipeline for consistency
          const scoredCurated: ScoredRecommendation[] = [];

          for (const place of curatedPicks) {
            const category = mapPlaceTypeToCategory(place.types);
            const distance = calculateDistance(userLocation, place.geometry.location);

            const scoreBreakdown = calculateActivityScore({
              place,
              category,
              distance,
              user,
              homeLocation,
              workLocation,
              timeOfDay: currentTOD,
            });

            // Use curated explanation if available, otherwise generate one
            const curatedExplanation = (place as any)._curatedExplanation;
            const aiExplanation = curatedExplanation || generateExplanation({
              place,
              category,
              distance,
              user,
              scoreBreakdown,
            });

            // Get photo URL
            let photoUrl = '';
            if (place.photos && place.photos.length > 0) {
              const photoRef = place.photos[0].photo_reference;
              if (photoRef) {
                if (photoRef.startsWith('http://') || photoRef.startsWith('https://')) {
                  photoUrl = photoRef;
                } else {
                  photoUrl = getPlacePhotoUrl(photoRef);
                }
              }
            }
            if (!photoUrl) {
              photoUrl = await getCachedUnsplashImage(category);
            }

            scoredCurated.push({
              place,
              score: scoreBreakdown.finalScore,
              scoreBreakdown,
              distance,
              category,
              photoUrl,
              aiExplanation,
              isSponsored: false,
            });
          }

          // Sort by score and return
          scoredCurated.sort((a, b) => b.score - a.score);

          // Fire-and-forget: seed city cache in background for next load
          if (cityInfo) {
            const userCategories = getUserCategoriesForCaching(asInterests(user.interests));
            seedCityData(cityInfo.city, cityInfo.state, cityInfo.lat, cityInfo.lng, userCategories.slice(0, 10), 60)
              .then(count => console.log(`🌱 Background seed complete: ${count} places cached`))
              .catch(err => console.warn('⚠️ Background seed failed:', err));
          }

          return scoredCurated.slice(0, maxResults);
        }

        console.log(`🌟 Only ${curatedPicks.length} curated picks — falling through to normal algorithm`);
      }
    } catch (error) {
      console.error('⚠️ Curated picks error, falling through to normal algorithm:', error);
    }
  }

  // Step 0.5: Get recently shown places for soft exclusion (Phase 1.3)
  // Instead of hard exclusion, we apply a decay-based penalty
  const recentlyShown = await getRecentlyShownWithTimestamps(user.id, 72);
  console.log(`🕒 ${recentlyShown.size} places shown in last 72 hours (will penalize, not exclude)`);

  // For infinite scroll: Still hard-exclude places currently in feed to avoid duplicates
  let excludedPlaceIds: Set<string>;
  if (excludePlaceIds && excludePlaceIds.length > 0) {
    excludedPlaceIds = new Set(excludePlaceIds);
    console.log(`🔄 Infinite scroll mode: Hard-excluding ${excludedPlaceIds.size} places currently in feed`);
  } else {
    excludedPlaceIds = new Set(); // No hard exclusion for pull-to-refresh
  }

  // Step 0.7: Fetch upcoming calendar events for context-aware location scoring
  let upcomingCalendarEvents: Array<{
    id: string;
    title: string;
    start_time: string;
    location: { coordinates: [number, number] };
  }> = [];

  try {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const { data, error } = await supabase
      .from('calendar_events')
      .select('id, title, start_time, location')
      .eq('user_id', user.id)
      .eq('status', 'scheduled')
      .gte('start_time', new Date().toISOString())
      .lte('start_time', sevenDaysFromNow.toISOString())
      .not('location', 'is', null)
      .order('start_time', { ascending: true })
      .limit(5);

    if (error) {
      console.error('⚠️ Error fetching calendar events:', error);
    } else if (data) {
      upcomingCalendarEvents = data as any[];
      console.log(`📅 Context: ${upcomingCalendarEvents.length} upcoming events for context-aware scoring`);
    }
  } catch (error) {
    console.error('⚠️ Exception fetching calendar events:', error);
  }

  // Step 0.8: Fetch Loop app visit history (completed calendar events by address)
  // Build map: address -> visit count
  const visitHistoryByAddress = new Map<string, number>();
  const visitHistoryByPlaceId = new Map<string, number>();

  try {
    const { data: completedEvents, error } = await supabase
      .from('calendar_events')
      .select('address, activity_id')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .not('address', 'is', null);

    if (error) {
      console.error('⚠️ Error fetching visit history:', error);
    } else if (completedEvents) {
      completedEvents.forEach((event: any) => {
        if (event.address) {
          const normalizedAddress = event.address.toLowerCase().trim();
          visitHistoryByAddress.set(
            normalizedAddress,
            (visitHistoryByAddress.get(normalizedAddress) || 0) + 1
          );
        }
        if (event.activity_id) {
          visitHistoryByPlaceId.set(
            event.activity_id,
            (visitHistoryByPlaceId.get(event.activity_id) || 0) + 1
          );
        }
      });
      console.log(`🏛️ Visit history: ${visitHistoryByAddress.size} unique addresses visited`);
    }
  } catch (error) {
    console.error('⚠️ Exception fetching visit history:', error);
  }

  // Step 0.9: Fetch Loop app feedback (ratings by place_id or activity name)
  // Build map: place_id -> { thumbsUp: number, thumbsDown: number, tags: string[] }
  const feedbackByPlaceId = new Map<string, { thumbsUp: number; thumbsDown: number; tags: string[] }>();

  try {
    const { data: feedbackData, error } = await supabase
      .from('feedback')
      .select('activity_id, rating, feedback_tags')
      .eq('user_id', user.id);

    if (error) {
      console.error('⚠️ Error fetching feedback:', error);
    } else if (feedbackData) {
      feedbackData.forEach((fb: any) => {
        if (!fb.activity_id) return;

        const existing = feedbackByPlaceId.get(fb.activity_id) || {
          thumbsUp: 0,
          thumbsDown: 0,
          tags: [],
        };

        if (fb.rating === 'thumbs_up') {
          existing.thumbsUp++;
        } else if (fb.rating === 'thumbs_down') {
          existing.thumbsDown++;
          if (fb.feedback_tags) {
            existing.tags.push(...(fb.feedback_tags as string[]));
          }
        }

        feedbackByPlaceId.set(fb.activity_id, existing);
      });
      console.log(`👍 Feedback: ${feedbackByPlaceId.size} places rated`);
    }
  } catch (error) {
    console.error('⚠️ Exception fetching feedback:', error);
  }

  // Step 1: Query Google Places API for nearby activities
  const radiusMeters = maxDistance * 1609.34; // Convert miles to meters

  // Define category groups to query in parallel for diversity
  // Expanded to 12 groups with 150+ specific place types for variety
  const categoryGroups = [
    {
      name: 'Restaurants',
      types: ['restaurant', 'meal_takeaway', 'meal_delivery', 'american_restaurant',
              'italian_restaurant', 'mexican_restaurant', 'japanese_restaurant',
              'chinese_restaurant', 'thai_restaurant', 'indian_restaurant',
              'seafood_restaurant', 'steak_house', 'hamburger_restaurant', 'pizza_restaurant',
              'barbecue_restaurant', 'vegan_restaurant', 'vegetarian_restaurant', 'sushi_restaurant',
              'ramen_restaurant', 'korean_restaurant', 'vietnamese_restaurant', 'greek_restaurant',
              'mediterranean_restaurant', 'french_restaurant', 'fast_food_restaurant']
    },
    {
      name: 'Coffee & Breakfast',
      types: ['cafe', 'coffee_shop', 'bakery', 'breakfast_restaurant', 'brunch_restaurant',
              'donut_shop', 'bagel_shop', 'juice_bar', 'tea_house']
    },
    {
      name: 'Bars & Nightlife',
      types: ['bar', 'night_club', 'pub', 'brewery', 'wine_bar', 'cocktail_bar',
              'dance_club', 'sports_bar', 'karaoke', 'live_music_venue', 'jazz_club']
    },
    {
      name: 'Entertainment & Recreation',
      types: ['movie_theater', 'bowling_alley', 'amusement_park', 'performing_arts_theater',
              'casino', 'sports_club', 'stadium', 'comedy_club', 'arcade', 'escape_room',
              'miniature_golf', 'go_kart_track', 'trampoline_park', 'laser_tag', 'billiards',
              'skate_park', 'roller_rink', 'golf_course', 'driving_range', 'tennis_court',
              'pickleball_court', 'basketball_court', 'volleyball_court', 'batting_cage']
    },
    {
      name: 'Arts & Culture',
      types: ['museum', 'art_gallery', 'cultural_center', 'historical_landmark',
              'library', 'planetarium', 'science_museum', 'childrens_museum',
              'art_studio', 'pottery_studio', 'music_venue', 'theater', 'opera_house']
    },
    {
      name: 'Shopping & Retail',
      types: ['shopping_mall', 'clothing_store', 'book_store', 'electronics_store',
              'furniture_store', 'home_goods_store', 'jewelry_store', 'shoe_store',
              'thrift_store', 'antique_store', 'flea_market', 'farmers_market',
              'sporting_goods_store', 'toy_store', 'pet_store', 'florist',
              'hardware_store', 'garden_center', 'bicycle_store', 'department_store',
              'discount_store', 'gift_shop', 'hobby_shop', 'music_store',
              'video_game_store', 'comic_book_store', 'sports_memorabilia_store']
    },
    {
      name: 'Fitness & Wellness',
      types: ['gym', 'fitness_center', 'yoga_studio', 'spa', 'beauty_salon',
              'hair_salon', 'massage', 'pilates_studio', 'crossfit_gym',
              'martial_arts_school', 'dance_studio', 'boxing_gym', 'cycling_studio']
    },
    {
      name: 'Parks & Outdoors',
      types: ['park', 'hiking_area', 'campground', 'dog_park', 'playground',
              'botanical_garden', 'nature_reserve', 'beach', 'lake', 'river',
              'fishing_area', 'picnic_area', 'skate_park', 'bike_trail',
              'walking_trail', 'scenic_viewpoint', 'outdoor_recreation_area']
    },
    {
      name: 'Events & Venues',
      types: ['event_venue', 'banquet_hall', 'conference_center', 'convention_center',
              'wedding_venue', 'concert_hall', 'amphitheater', 'fairground',
              'exhibition_center', 'community_center']
    },
    {
      name: 'Family & Kids',
      types: ['childrens_museum', 'playground', 'trampoline_park', 'arcade',
              'amusement_park', 'water_park', 'zoo', 'aquarium', 'petting_zoo',
              'childrens_theater', 'family_entertainment_center', 'indoor_playground']
    },
    {
      name: 'Tourist Attractions',
      types: ['tourist_attraction', 'visitor_center', 'observation_deck',
              'monument', 'memorial', 'landmark']
    },
    {
      name: 'Everyday & Specialty',
      types: ['grocery_store', 'convenience_store', 'supermarket', 'ice_cream_shop',
              'dessert_shop', 'sandwich_shop', 'food_court', 'smoothie_shop',
              'wine_shop', 'liquor_store', 'specialty_food_shop', 'cheese_shop']
    },
  ];

  // Map user interests to prioritize certain category groups
  const userInterests = asInterests(user.interests);
  if (userInterests.length > 0) {
    console.log(`🎯 User interests: ${userInterests.join(', ')}`);
  }

  // CRITICAL FIX: Define isInfiniteScrollMode BEFORE using it
  // Infinite scroll mode = excludePlaceIds provided (user scrolling for more content)
  const isInfiniteScrollMode = excludePlaceIds && excludePlaceIds.length > 0;
  const isExploreMode = params.discoveryMode === 'explore';
  console.log(`🔄 Mode: ${isInfiniteScrollMode ? 'Infinite Scroll' : 'Fresh Load'} | ${isExploreMode ? 'Explore' : 'Curated'}`);

  // Read discovery style preference (defaults to 'balanced')
  const discoveryStyle: DiscoveryStyle = asPreferences(user.preferences).discovery_style || 'balanced';
  const styleConfig = DISCOVERY_STYLE_CONFIG[discoveryStyle];

  // Query category groups in parallel for variety
  // Discovery style influences base count: explorer=8, balanced=5, creature_of_habit=3
  // Explore mode always overrides to 8; infinite scroll uses styleConfig base
  const groupsToQuery = isExploreMode
    ? categoryGroups.slice(0, 8) // Explore mode: 8 category groups for variety
    : isInfiniteScrollMode
      ? categoryGroups.slice(0, Math.max(styleConfig.categoryGroups, 5))
      : categoryGroups.slice(0, styleConfig.categoryGroups);
  const fetchLimit = isExploreMode ? 40 : isInfiniteScrollMode ? 50 : 20; // Explore mode: 40 per category

  console.log(`🔍 Querying ${groupsToQuery.length} category groups in parallel (${fetchLimit} results each)`);

  let nearbyPlaces: PlaceResult[] = [];
  try {
    // ========================================================================
    // CITY-BASED CACHING (Phase 4)
    // Query database cache instead of Google Places API for cost optimization
    // ========================================================================

    // Step 1: Detect user's city from current GPS location (where user is NOW)
    console.log('🏙️ Detecting user city for cache lookup...');
    const cityInfo = await detectUserCityWithFallback(user, {
      lat: userLocation.lat,
      lng: userLocation.lng
    });

    if (!cityInfo) {
      console.log('ℹ️ No city data available (user needs to set home address) - using API mode');
      // Fallback: Use original API-based approach if city detection fails
      const placePromises = groupsToQuery.map(group =>
        searchActivitiesMultiSource({
          location: userLocation,
          radius: Math.min(radiusMeters, 50000),
          maxResults: fetchLimit,
          includedTypes: group.types,
          userInterests: asInterests(user.interests),
        })
      );
      const placeArrays = await Promise.all(placePromises);
      const allPlaces = placeArrays.flat();
      const uniquePlaces = new Map<string, PlaceResult>();
      allPlaces.forEach(place => {
        if (!uniquePlaces.has(place.place_id)) {
          uniquePlaces.set(place.place_id, place);
        }
      });
      nearbyPlaces = Array.from(uniquePlaces.values());
      console.log(`✅ Fallback: ${nearbyPlaces.length} places from API`);
    } else {
      console.log(`📍 User city: ${cityInfo.city}, ${cityInfo.state}`);

      // Step 2: Check if cache exists and is fresh
      const refreshCadence = getCadenceForUser(user);
      console.log(`⏰ Cache refresh cadence: ${refreshCadence} days (${user.subscription_tier} tier)`);

      const apiDisabled = process.env.EXPO_PUBLIC_DISABLE_GOOGLE_PLACES_API === 'true';
      const cacheStatus = await checkCityCache(cityInfo.city, cityInfo.state, refreshCadence);

      // Step 3: Seed cache if needed (first time or stale)
      // Skip seeding when API is disabled — use whatever cache exists
      if ((!cacheStatus.exists || cacheStatus.isStale) && !apiDisabled) {
        console.log(`🌱 Cache ${!cacheStatus.exists ? 'missing' : 'stale'} - seeding ${cityInfo.city}...`);

        const userCategories = getUserCategoriesForCaching(asInterests(user.interests) || []);

        // Seed cache with user's interested categories only
        const seedCount = await seedCityData(
          cityInfo.city,
          cityInfo.state,
          cityInfo.lat,
          cityInfo.lng,
          userCategories.slice(0, 10), // Limit to 10 categories to avoid excessive API calls
          refreshCadence
        );

        console.log(`✅ Seeded ${seedCount} places for ${cityInfo.city}`);
      } else if (apiDisabled) {
        console.log(`🚫 API disabled — using existing cache (${cacheStatus.count} places, stale=${cacheStatus.isStale})`);
      } else {
        console.log(`✅ Cache fresh: ${cacheStatus.count} places, last cached ${cacheStatus.lastCached?.toLocaleDateString()}`);
      }

      // Step 4: Query cached places from database
      console.log('📥 Loading places from cache...');
      const cacheMultiplier = isExploreMode ? 10 : 5; // Explore mode: fetch 10x more for variety
      const cachedActivities = await getCachedPlaces(
        cityInfo.city,
        cityInfo.state,
        categories ? categories[0] : undefined, // Category filter if specified
        maxResults * cacheMultiplier // Over-fetch for filtering and diversity
      );

      console.log(`✅ Loaded ${cachedActivities.length} cached places`);

      // ⭐ CRITICAL: Handle empty cache gracefully
      if (cachedActivities.length === 0) {
        console.warn(`⚠️ No cached activities for ${cityInfo.city}, ${cityInfo.state} after seed attempt — check RLS policies and API key`);
        return [];
      }

      // Step 5: Convert Activity objects to PlaceResult format for scoring
      nearbyPlaces = cachedActivities.map(activity => activityToPlaceResult(activity));

      console.log(`✅ Converted ${nearbyPlaces.length} activities to place results`);

      // Step 6: ALWAYS fetch Ticketmaster events (time-sensitive, not cached)
      // Events should be fresh since they're date-specific and change daily
      if (isMixedFeedEnabled()) {
        console.log('🎟️ Fetching fresh Ticketmaster events to supplement cached Google Places...');
        try {
          const ticketmasterResults = await searchActivitiesMultiSource({
            location: userLocation,
            radius: Math.min(radiusMeters, 50000),
            maxResults: 20,
            userInterests: asInterests(user.interests),
          });

          // Filter to only keep Ticketmaster events (exclude Google Places duplicates)
          const ticketmasterEvents = ticketmasterResults.filter(place => place.source === 'ticketmaster');

          console.log(`✅ Found ${ticketmasterEvents.length} Ticketmaster events to add to feed`);

          // Merge Ticketmaster events with cached Google Places
          nearbyPlaces = [...nearbyPlaces, ...ticketmasterEvents];

          console.log(`✅ Final: ${nearbyPlaces.length} total places (${cachedActivities.length} cached + ${ticketmasterEvents.length} events)`);
        } catch (error) {
          console.error('⚠️ Failed to fetch Ticketmaster events:', error);
          // Continue with cached Google Places only
        }
      }
    }

  } catch (error) {
    console.error('Error fetching nearby places:', error);
    // Fallback to single broad query (with multi-source support)
    nearbyPlaces = await searchActivitiesMultiSource({
      location: userLocation,
      radius: Math.min(radiusMeters, 50000),
      maxResults: 20,
      userInterests: asInterests(user.interests),
    });
  }

  // Filter out recently shown places
  let freshPlaces = nearbyPlaces.filter(place => {
    const isExcluded = excludedPlaceIds.has(place.place_id);
    if (isExcluded) {
      console.log(`🚫 Excluding place: ${place.name} (ID: ${place.place_id})`);
    }
    return !isExcluded;
  });
  console.log(`Found ${nearbyPlaces.length} nearby places, ${freshPlaces.length} are fresh (not shown recently)`);

  if (freshPlaces.length > 0) {
    console.log(`✅ Fresh place IDs (first 5):`, freshPlaces.slice(0, 5).map(p => `${p.name}: ${p.place_id}`));
  }

  // CRITICAL FIX: If we have very few fresh places, ignore exclusion to prevent empty feed
  // Better to show repeated places than no places at all
  // BUT: Only apply this fallback for pull-to-refresh, NOT for infinite scroll
  // Infinite scroll should never return duplicates - better to return fewer items
  const MIN_FRESH_THRESHOLD = 10;
  // Note: isInfiniteScrollMode already defined earlier (line ~694)

  if (isInfiniteScrollMode) {
    console.log(`♾️ Infinite scroll mode: Strict deduplication enabled - will NOT return duplicates even if few results`);
  }

  if (!isInfiniteScrollMode && freshPlaces.length < MIN_FRESH_THRESHOLD && nearbyPlaces.length > 0) {
    console.log(`⚠️ Only ${freshPlaces.length} fresh places found - ignoring exclusion to prevent empty feed`);
    freshPlaces = nearbyPlaces; // Use all places, including recently shown ones
  }

  // If we need more places for infinite scroll feed, expand search radius a few times
  // Target: Get at least 30 fresh places for reasonable variety
  // Reduced from 150 to prevent excessive API calls (Google returns ~20 places per call)
  let expansionAttempts = 0;
  const targetFreshPlaces = 30;

  while (freshPlaces.length < targetFreshPlaces && radiusMeters < 50000 && expansionAttempts < 3) {
    expansionAttempts++;
    const expansionRadius = Math.min(radiusMeters * (1 + expansionAttempts * 0.5), 50000);

    console.log(`⚠️ Need more places (${freshPlaces.length}/${targetFreshPlaces}), expanding search radius (attempt ${expansionAttempts})...`);

    // Query multiple categories in parallel for expansion too (with multi-source support)
    const expandPlacePromises = groupsToQuery.map(group =>
      searchActivitiesMultiSource({
        location: userLocation,
        radius: expansionRadius,
        maxResults: fetchLimit, // Use same limit as initial query
        includedTypes: group.types,
        userInterests: asInterests(user.interests),
      })
    );

    const expandedPlaceArrays = await Promise.all(expandPlacePromises);
    const expandedPlaces = expandedPlaceArrays.flat();

    // Deduplicate expanded places
    const uniqueExpanded = new Map<string, PlaceResult>();
    expandedPlaces.forEach(place => {
      if (!uniqueExpanded.has(place.place_id)) {
        uniqueExpanded.set(place.place_id, place);
      }
    });

    const deduplicatedExpanded = Array.from(uniqueExpanded.values());
    let additionalFresh = deduplicatedExpanded.filter(place => !excludedPlaceIds.has(place.place_id));

    console.log(`📍 Expansion: Queried ${expandedPlaces.length} places, ${deduplicatedExpanded.length} unique, ${additionalFresh.length} fresh`);

    // Apply same fallback logic during expansion (but only for pull-to-refresh, not infinite scroll)
    if (!isInfiniteScrollMode && additionalFresh.length < MIN_FRESH_THRESHOLD && deduplicatedExpanded.length > 0) {
      console.log(`⚠️ Expansion found only ${additionalFresh.length} fresh places - including all places to prevent empty feed`);
      additionalFresh = deduplicatedExpanded;
    }

    freshPlaces.push(...additionalFresh);
    console.log(`✅ Found ${additionalFresh.length} additional fresh places (total: ${freshPlaces.length})`);

    // If we didn't find any new places, break early
    if (additionalFresh.length === 0) {
      console.log('⚠️ No new places found, stopping expansion');
      break;
    }
  }

  nearbyPlaces = freshPlaces;

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

    // ADVANCED FILTER: Category filter
    if (categories && categories.length > 0) {
      // Map UI categories to internal categories (must match CategorySelector categories)
      const categoryMappings: Record<string, string[]> = {
        dining: ['Dining', 'Restaurant', 'Food'],
        coffee: ['Coffee', 'Cafe'],
        nightlife: ['Nightlife', 'Bars', 'Bar'],
        entertainment: ['Entertainment', 'Movies', 'Recreation'],
        culture: ['Art', 'Culture', 'Arts & Culture', 'Museum'],
        shopping: ['Shopping', 'Store', 'Mall'],
        fitness: ['Fitness', 'Gym', 'Wellness', 'Spa'],
        outdoors: ['Outdoor', 'Park', 'Nature'],
        events: ['Events', 'Venue', 'Concert', 'Theater'],
        family: ['Family', 'Kids'],
        attractions: ['Tourist', 'Attraction', 'Landmark', 'Sightseeing'],
        everyday: ['Everyday', 'Specialty', 'Service'],
      };

      let matchesCategory = false;
      for (const filterCategory of categories) {
        const allowedCategories = categoryMappings[filterCategory] || [filterCategory];
        if (allowedCategories.some(c => category.toLowerCase().includes(c.toLowerCase()))) {
          matchesCategory = true;
          break;
        }
      }

      if (!matchesCategory) {
        if (DEBUG_RECS) console.log(`⏭️  Skipping (category filter): ${place.name} (${category})`);
        continue;
      }
    }

    // ADVANCED FILTER: Minimum rating
    if (minRating && minRating > 0) {
      const placeRating = place.rating || 0;
      if (placeRating < minRating) {
        if (DEBUG_RECS) console.log(`⏭️  Skipping (low rating): ${place.name} (${placeRating} < ${minRating})`);
        continue;
      }
    }

    // ADVANCED FILTER: Open now
    if (openNow) {
      const isOpen = place.opening_hours?.open_now ?? false;
      if (!isOpen) {
        if (DEBUG_RECS) console.log(`⏭️  Skipping (closed): ${place.name}`);
        continue;
      }
    }

    // QUALITY THRESHOLD: Prioritize interesting places
    // Skip if:
    // 1. Generic place (Walmart, churches, etc.) AND user doesn't have interest in that category
    // 2. Low quality: doesn't match interests AND not popular/trending

    const matchesInterests = matchesUserInterests(place, user);
    const isPopular = isPopularPlace(place);
    const isGeneric = isGenericPlace(place.name);

    // ABSOLUTE FILTER: Never show generic big-box stores, gas stations, etc.
    // These are low-value recommendations that clutter the feed
    // Even if user has "Shopping" interest, they don't want Walmart recommendations
    if (isGeneric) {
      if (DEBUG_RECS) console.log(`⏭️  Skipping generic place (absolute filter): ${place.name}`);
      continue;
    }

    // PRICE RANGE FILTER: Skip places that don't match user's price filter
    // Filter shows "up to and including" the selected price level
    // e.g., $ filter shows free and $ places, $$ shows free/$/$$, etc.
    if (priceRange && priceRange !== 'any') {
      const placePrice = place.price_level || 0; // 0 = free/unknown

      // Include places that are:
      // 1. Free/unknown (price_level = 0) - always include
      // 2. At or below user's max price (price_level <= priceRange)
      if (placePrice > 0 && placePrice > priceRange) {
        if (DEBUG_RECS) console.log(`⏭️  Skipping place outside price range: ${place.name} (${'$'.repeat(placePrice)} vs max ${'$'.repeat(priceRange)})`);
        continue;
      }
    }

    // Log place type for debugging (interest match vs discovery)
    if (DEBUG_RECS) console.log(`${matchesInterests ? '⭐' : '📍'} ${isPopular ? 'Popular place' : 'Place'}: ${place.name}`);

    // Calculate score (with recency penalty - Phase 1.3)
    const scoreBreakdown = calculateActivityScore({
      place,
      category,
      distance,
      user,
      homeLocation,
      workLocation,
      timeOfDay: Array.isArray(timeOfDay) ? timeOfDay[0] : timeOfDay,
      recentlyShown, // Pass recency map for soft exclusion penalty
      upcomingCalendarEvents, // NEW: Pass calendar events for context-aware location scoring
      discoveryStyle, // Discovery style preference shapes scoring
      discoveryMode: params.discoveryMode, // Fix: pass through for explore vs for_you scoring
    });

    // Removed zero-score threshold filter - let all places through
    // Interest mismatch just means lower score, not removal
    // User feedback will teach the algorithm over time what they actually like

    // Log high-quality matches for debugging
    if (matchesInterests && isPopular) {
      if (DEBUG_RECS) console.log(`✨ EXCELLENT match: ${place.name} (interest + popular, score: ${scoreBreakdown.finalScore})`);
    } else if (matchesInterests) {
      if (DEBUG_RECS) console.log(`✓ Interest match: ${place.name} (score: ${scoreBreakdown.finalScore})`);
    } else if (isPopular) {
      if (DEBUG_RECS) console.log(`⭐ Popular place: ${place.name} (score: ${scoreBreakdown.finalScore})`);
    }

    // Generate AI explanation
    const aiExplanation = generateExplanation({
      place,
      category,
      distance,
      user,
      scoreBreakdown,
    });

    // Get photo URLs (single + array for carousel)
    let photoUrl = '';
    let photoUrls: string[] | undefined;

    // Try to get multiple photos from Google Places
    if (place.photos && place.photos.length > 0) {
      const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
      if (!API_KEY) {
        photoUrl = await getCachedUnsplashImage(category);
      } else {
        // Get all available photos (up to 5 for performance)
        const allPhotos = place.photos.slice(0, 5).map((photo) => {
          const photoRef = photo.photo_reference;
          if (!photoRef) return '';
          if (photoRef.startsWith('http://') || photoRef.startsWith('https://')) {
            return photoRef;
          }
          return getPlacePhotoUrl(photoRef);
        }).filter(Boolean);

        if (allPhotos.length > 0) {
          photoUrl = allPhotos[0];

          if (allPhotos.length >= 2) {
            photoUrls = allPhotos;
          } else if (allPhotos.length === 1 && place.place_id) {
            if (!place.source || place.source === 'google_places') {
              const additionalPhotos = await enrichPlacePhotos(place.place_id);
              if (additionalPhotos.length > 0) {
                const enrichedPhotos = [
                  ...allPhotos,
                  ...additionalPhotos.slice(1, 5).map(photo => getPlacePhotoUrl(photo.photo_reference)).filter(Boolean)
                ];
                if (enrichedPhotos.length >= 2) {
                  photoUrls = enrichedPhotos;
                }
              }
            }
          }
        }
      }
    }

    // If no Google photo, use Unsplash fallback for primary
    if (!photoUrl) {
      photoUrl = await getCachedUnsplashImage(category);
    }

    // Get business hours (from Google or estimated)
    const businessHoursInfo = getBusinessHours(place.opening_hours, category);

    // Suggest best time to visit based on business hours
    const normalizedTimeOfDay = (Array.isArray(timeOfDay) ? timeOfDay[0] : timeOfDay) as 'morning' | 'afternoon' | 'evening' | undefined;
    const suggestedTime = suggestVisitTime(businessHoursInfo.hours, normalizedTimeOfDay, new Date());

    scoredRecommendations.push({
      place,
      score: scoreBreakdown.finalScore,
      scoreBreakdown,
      distance,
      category,
      photoUrl,
      photoUrls, // Only set if 3+ real photos available
      aiExplanation,
      isSponsored: false, // TODO: Check if business has sponsored tier
      businessHours: place.opening_hours, // Store Google hours data
      hasEstimatedHours: businessHoursInfo.isEstimated,
      suggestedTime,
    });
  }

  // Step 3: Rank by score (high to low)
  scoredRecommendations.sort((a, b) => b.score - a.score);

  // Step 3.5: Add slight randomization to introduce variety on refresh
  // Keep top-scored items near the top, but shuffle middle/lower items more
  // IMPORTANT: Skip randomization for events - they need precise urgency ranking
  let shuffledRecommendations = scoredRecommendations.map((rec, index) => {
    // Events need precise urgency ranking - NO randomization
    // Concert tonight must stay ranked above concert next week
    if (rec.place.source === 'ticketmaster') {
      if (DEBUG_RECS) console.log(`🎫 Event (no randomization): ${rec.place.name} - score: ${rec.score}`);
      return rec;
    }

    // Randomize Google Places for variety
    // Higher ranked items get less randomization
    const rankFactor = index / scoredRecommendations.length; // 0 to 1
    const randomOffset = (Math.random() - 0.5) * 10 * rankFactor; // ±5 points max, scaled by rank
    return {
      ...rec,
      score: rec.score + randomOffset,
    };
  });

  // Re-sort with randomized scores
  shuffledRecommendations.sort((a, b) => b.score - a.score);

  // Step 3.5: Filter out activities already scheduled for today
  // Prevents showing duplicate recommendations for same-day calendar events
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  try {
    // Query calendar events for today with activity_ids
    const { data: todayEvents, error: eventsError } = await supabase
      .from('calendar_events')
      .select('activity_id')
      .eq('user_id', user.id)
      .eq('status', 'scheduled')
      .gte('start_time', todayStart.toISOString())
      .lte('start_time', todayEnd.toISOString())
      .not('activity_id', 'is', null);

    if (eventsError) {
      console.error('⚠️ Error fetching today\'s calendar events:', eventsError);
    } else if (todayEvents && todayEvents.length > 0) {
      const activityIds = todayEvents.map((e: any) => e.activity_id).filter(Boolean);

      if (activityIds.length > 0) {
        // Get google_place_ids from activities table
        const { data: activities, error: activitiesError } = await supabase
          .from('activities')
          .select('google_place_id')
          .in('id', activityIds);

        if (activitiesError) {
          console.error('⚠️ Error fetching activity place IDs:', activitiesError);
        } else if (activities && activities.length > 0) {
          const scheduledPlaceIds = new Set(
            activities.map((a: any) => a.google_place_id).filter(Boolean)
          );

          if (scheduledPlaceIds.size > 0) {
            if (DEBUG_RECS) console.log(`📅 Filtering out ${scheduledPlaceIds.size} activities already scheduled for today`);

            // Filter out recommendations matching today's scheduled activities
            shuffledRecommendations = shuffledRecommendations.filter(rec => {
              if (scheduledPlaceIds.has(rec.place.place_id)) {
                if (DEBUG_RECS) console.log(`  ⏭️ Skipping "${rec.place.name}" (already scheduled today)`);
                return false;
              }
              return true;
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('⚠️ Exception during same-day duplicate filtering:', error);
    // Continue without filtering - don't break recommendations if this fails
  }

  // Step 4: Apply business rules (discovery style shapes category diversity)
  const finalRecommendations = applyBusinessRules(shuffledRecommendations, maxResults, discoveryStyle, user, priceRange);

  console.log(`Returning ${finalRecommendations.length} recommendations`);

  return finalRecommendations;
}

/**
 * Calculate activity score (0-100 points)
 * Based on MVP algorithm from CLAUDE.md
 * NOW WITH 8 DATA SOURCE INTEGRATIONS (Day 1 Sprint + Feedback Loop):
 * 1. Facebook exact place matches (+30)
 * 2. Facebook category matches (+15)
 * 3. Google Timeline visited places (+20-35)
 * 4. Google Timeline category frequency (+10-20)
 * 5. Calendar patterns (+10-25)
 * 6. Budget/price matching (+15/-10)
 * 7. Loop app visit history (+15-40) - NEW!
 * 8. Loop app feedback ratings (+20/-20) - NEW!
 */
function calculateActivityScore(params: {
  place: PlaceResult;
  category: string;
  distance: number;
  user: User;
  homeLocation?: PlaceLocation;
  workLocation?: PlaceLocation;
  timeOfDay?: string;
  recentlyShown?: Map<string, { timestamp: number; hoursSince: number }>; // Phase 1.3
  upcomingCalendarEvents?: Array<{
    id: string;
    title: string;
    start_time: string;
    location: { coordinates: [number, number] };
  }>;
  visitHistoryByAddress?: Map<string, number>; // NEW: Loop app visit counts by address
  visitHistoryByPlaceId?: Map<string, number>; // NEW: Loop app visit counts by place ID
  feedbackByPlaceId?: Map<string, { thumbsUp: number; thumbsDown: number; tags: string[] }>; // NEW: Loop app feedback
  // NEW: Friend social context from Loop Moments
  friendSocialContext?: Map<string, { // placeId -> context
    friendVisits: { userId: string; userName: string; visitedAt: string; hasMoment: boolean }[];
    totalFriendVisits: number;
    recentFriendVisits: number;
    hasFriendMoments: boolean;
    friendMomentsCount: number;
  }>;
  discoveryStyle?: DiscoveryStyle;
  discoveryMode?: 'for_you' | 'explore';
}): ScoredRecommendation['scoreBreakdown'] {
  const {
    place,
    category,
    distance,
    user,
    homeLocation,
    workLocation,
    timeOfDay,
    recentlyShown,
    upcomingCalendarEvents,
    visitHistoryByAddress,
    visitHistoryByPlaceId,
    feedbackByPlaceId,
    friendSocialContext,
    discoveryStyle = 'balanced',
  } = params;
  const styleConfig = DISCOVERY_STYLE_CONFIG[discoveryStyle];

  let baseScore = 0;
  let locationScore = 0;
  let timeScore = 0;
  let feedbackScore = 5; // Neutral default
  let collaborativeScore = 0;
  let eventUrgencyScore = 0; // NEW: Urgency bonus for events happening soon
  let sponsoredBoost = 0;

  // NEW: 8 Data Source Boosts (Day 1 Sprint + Feedback Loop)
  let facebookExactPlaceBoost = 0;
  let facebookCategoryBoost = 0;
  let googleTimelineVisitBoost = 0;
  let googleTimelineCategoryBoost = 0;
  let calendarPatternBoost = 0;
  let budgetBoost = 0;
  let loopVisitHistoryBoost = 0; // NEW: Visits in Loop app
  let loopFeedbackBoost = 0; // NEW: User ratings in Loop app

  // NEW: Friend social context boosts (Loop Moments)
  let friendVisitBoost = 0; // +25 if friend visited in last 7 days
  let friendPhotoBoost = 0; // +15 if place has friend moments
  let trendingFriendsBoost = 0; // +20 if 2+ friends visited this week

  // NEW: Age bracket boost (Step 4)
  let ageBracketBoost = 0;

  // === BASE SCORE (50 → 55 points max for events) ===
  // Interest match guides scoring but doesn't filter - allow discovery
  const userInterests = asInterests(user.interests);
  const topInterests = asAIProfile(user.ai_profile).favorite_categories || userInterests.slice(0, 3);
  const { discoveryMode = 'for_you' } = params;
  const isEvent = place.source === 'ticketmaster';

  if (topInterests.includes(category)) {
    baseScore = 30; // Top 3 interests - STRONG match
    if (isEvent) baseScore += 5; // Event bonus: unique, one-time opportunities → 35 total
  } else if (userInterests.includes(category)) {
    baseScore = 20; // Other interests - GOOD match
    if (isEvent) baseScore += 3; // Event bonus → 23 total
  } else {
    // Discovery mode + discovery style affect non-matching interests
    if (discoveryMode === 'explore') {
      baseScore = 15; // More generous in explore mode - encourage discovery
      if (isEvent) baseScore += 2; // Event bonus → 17 total
    } else {
      baseScore = styleConfig.nonMatchingBase; // Shaped by discovery style preference
      if (isEvent) baseScore += 2; // Event bonus
    }
  }

  // Boost based on rating (quality signal)
  if (place.rating) {
    if (place.rating >= 4.5) baseScore += 12;
    else if (place.rating >= 4.0) baseScore += 8;
    else if (place.rating >= 3.5) baseScore += 4;
  }

  // POPULARITY BOOST: Trending places with many reviews
  // This helps surface popular destinations even if not perfect interest match
  const reviewCount = place.user_ratings_total || 0;
  if (reviewCount >= 500) baseScore += 8; // Very popular (trending)
  else if (reviewCount >= 200) baseScore += 5; // Popular
  else if (reviewCount >= 50) baseScore += 2; // Moderately popular

  baseScore = Math.min(baseScore, 55); // Cap at 55 (raised from 50 to accommodate event bonus)

  // === LOCATION SCORE (20 points max) ===
  const userMaxDistance = asPreferences(user.preferences).max_distance_miles || 5;

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

  // === FUTURE CONTEXT BONUS (adds to location score) ===
  // Boost activities near user's upcoming calendar events
  let futureContextBonus = 0;

  if (upcomingCalendarEvents && upcomingCalendarEvents.length > 0) {
    for (const calendarEvent of upcomingCalendarEvents) {
      // DEFENSIVE CHECK: Ensure location data exists and is properly formatted
      if (!calendarEvent.location ||
          !calendarEvent.location.coordinates ||
          !Array.isArray(calendarEvent.location.coordinates) ||
          calendarEvent.location.coordinates.length < 2) {
        if (DEBUG_RECS) console.log(`⚠️ Skipping calendar event "${calendarEvent.title}" - invalid location data`);
        continue;
      }

      const eventLocation = {
        lat: calendarEvent.location.coordinates[1], // PostGIS stores [lng, lat]
        lng: calendarEvent.location.coordinates[0],
      };

      const distanceFromEvent = calculateDistance(eventLocation, place.geometry.location);
      const hoursUntilEvent = (new Date(calendarEvent.start_time).getTime() - Date.now()) / (1000 * 60 * 60);

      // Only consider events in next 7 days
      if (hoursUntilEvent > 0 && hoursUntilEvent <= 168) {
        if (distanceFromEvent <= 0.5) {
          // Very close to upcoming event (within 0.5 miles)
          const timeRelevance = hoursUntilEvent <= 24 ? 15 : 10; // Higher if event is tomorrow
          futureContextBonus = Math.max(futureContextBonus, timeRelevance);
          if (DEBUG_RECS) console.log(`🎯 Near "${calendarEvent.title}" (${distanceFromEvent.toFixed(2)}mi): +${timeRelevance}`);
        } else if (distanceFromEvent <= 1.5) {
          // Nearby upcoming event (within 1.5 miles)
          const timeRelevance = hoursUntilEvent <= 24 ? 10 : 6;
          futureContextBonus = Math.max(futureContextBonus, timeRelevance);
        }
      }
    }
  }

  locationScore += futureContextBonus;
  locationScore = Math.min(locationScore, 30); // Cap raised from 20 → 30 for future context

  // === TIME CONTEXT SCORE (25 points max — enhanced with category weights) ===
  const currentTimeOfDay = timeOfDay || getCurrentTimeOfDay();

  // Check user's time preferences
  const preferredTimes = asPreferences(user.preferences).preferred_times || [];
  if (preferredTimes.includes(currentTimeOfDay)) {
    timeScore += 5;
  }

  // Activity type vs time of day matching (legacy 0-10)
  const timeContextMatches = checkTimeContext(category, currentTimeOfDay);
  if (timeContextMatches === 'perfect') timeScore += 10;
  else if (timeContextMatches === 'good') timeScore += 5;
  else timeScore += 2; // Acceptable

  // NEW: Time-category weight boost (Step 3)
  // Additive boost making morning feeds surface coffee, evening feeds surface restaurants
  const timeCategoryBoost = getTimeCategoryBoost(category, currentTimeOfDay);
  timeScore += timeCategoryBoost;

  timeScore = Math.min(Math.max(timeScore, -10), 25); // Cap at 25, floor at -10

  // === DATA SOURCE INTEGRATIONS (Day 1 Sprint) ===
  // Source 1 & 2: Facebook Liked Places (EXACT match = +30, category only = +15)
  const extUser = user as unknown as ExtendedUser;
  if (extUser.facebook_data) {
    const facebookData = extUser.facebook_data;
    if (facebookData.liked_places && facebookData.liked_places.length > 0) {
      const facebookMatch = matchFacebookLikedPlace(
        facebookData.liked_places[0], // TODO: Check all liked places, not just first
        place.name,
        category
      );

      if (facebookMatch.type === 'exact') {
        facebookExactPlaceBoost = 30;
        if (DEBUG_RECS) console.log(`🎯 FB EXACT MATCH: ${place.name} (+30 points)`);
      } else if (facebookMatch.type === 'category') {
        facebookCategoryBoost = 15;
        if (DEBUG_RECS) console.log(`📂 FB CATEGORY MATCH: ${category} (+15 points)`);
      }
    }
  }

  // Source 3 & 4: Google Timeline Visited Places (+20-35 for exact, +10-20 for category frequency)
  if (extUser.google_timeline) {
    const timelineData = extUser.google_timeline;
    if (timelineData.visited_places && timelineData.visited_places.length > 0) {
      const timelineMatch = matchTimelineVisitedPlace(
        timelineData,
        place.name,
        category
      );

      if (timelineMatch.match) {
        if (timelineMatch.visitCount >= 1) {
          // This is an exact place match or strong category match
          googleTimelineVisitBoost = timelineMatch.boost;
          if (DEBUG_RECS) console.log(`📍 TIMELINE MATCH: ${place.name} (${timelineMatch.visitCount} visits, +${timelineMatch.boost} points)`);

          // Apply freshness factor (prefer recent visits)
          const visitedPlace = timelineData.visited_places.find(
            p => p.place_name.toLowerCase().includes(place.name.toLowerCase())
          );
          if (visitedPlace) {
            const freshness = calculateFreshnessFactor(visitedPlace.last_visit);
            googleTimelineVisitBoost = Math.round(googleTimelineVisitBoost * freshness);
            if (DEBUG_RECS) console.log(`  ⏰ Freshness factor: ${freshness}x → ${googleTimelineVisitBoost} points`);
          }
        } else {
          // Category frequency match
          googleTimelineCategoryBoost = timelineMatch.boost;
          if (DEBUG_RECS) console.log(`📊 CATEGORY FREQUENCY: ${category} (+${timelineMatch.boost} points)`);
        }
      }
    }
  }

  // Source 5: Calendar Patterns (time-based boosting based on user's schedule)
  // Analyze user's calendar for recurring patterns (e.g., "Dinner every Friday 7pm")
  const aiProfileData = asAIProfile(user.ai_profile);
  if (aiProfileData.calendar_patterns) {
    const patterns = aiProfileData.calendar_patterns;
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentHour = now.getHours();

    for (const pattern of patterns) {
      // Check if current day matches pattern
      const dayMatch = pattern.day === currentDay ||
                      (pattern.days && pattern.days.includes(currentDay));

      if (dayMatch && pattern.category === category) {
        // Parse pattern time (e.g., "19:00")
        const [patternHour] = pattern.time.split(':').map(Number);

        // Strong match if within 2 hours of usual time
        if (Math.abs(currentHour - patternHour) <= 2) {
          calendarPatternBoost = 25;
          if (DEBUG_RECS) console.log(`📅 STRONG CALENDAR PATTERN: ${category} on ${currentDay} at ${pattern.time} (+25 points)`);
          break;
        }
        // Moderate match if same day
        else {
          calendarPatternBoost = Math.max(calendarPatternBoost, 15);
          if (DEBUG_RECS) console.log(`📅 CALENDAR PATTERN: ${category} on ${currentDay} (+15 points)`);
        }
      }
    }
  }

  // Source 6: Budget/Price Matching (inferred from user's budget level)
  const userBudgetLevel = aiProfileData.budget_level || asPreferences(user.preferences).budget || 2;
  const placePriceLevel = place.price_level || 0;

  if (placePriceLevel > 0) {
    // Perfect match (same price level)
    if (placePriceLevel === userBudgetLevel) {
      budgetBoost = 15;
      if (DEBUG_RECS) console.log(`💰 PERFECT PRICE MATCH: ${'$'.repeat(placePriceLevel)} (+15 points)`);
    }
    // One level off (acceptable)
    else if (Math.abs(placePriceLevel - userBudgetLevel) === 1) {
      budgetBoost = 5;
      if (DEBUG_RECS) console.log(`💵 CLOSE PRICE MATCH: ${'$'.repeat(placePriceLevel)} vs ${'$'.repeat(userBudgetLevel)} (+5 points)`);
    }
    // Two levels off (too expensive or too cheap)
    else if (Math.abs(placePriceLevel - userBudgetLevel) >= 2) {
      budgetBoost = -10;
      if (DEBUG_RECS) console.log(`💸 PRICE MISMATCH: ${'$'.repeat(placePriceLevel)} vs ${'$'.repeat(userBudgetLevel)} (-10 points)`);
    }
  }

  // Source 7: Loop App Visit History (user has been here before via Loop!)
  if (visitHistoryByPlaceId || visitHistoryByAddress) {
    let visitCount = 0;

    // Try matching by place ID first (most accurate)
    if (visitHistoryByPlaceId && place.place_id) {
      visitCount = visitHistoryByPlaceId.get(place.place_id) || 0;
    }

    // Fallback: Try matching by address (fuzzy match)
    if (visitCount === 0 && visitHistoryByAddress && place.formatted_address) {
      const normalizedAddress = place.formatted_address.toLowerCase().trim();
      visitCount = visitHistoryByAddress.get(normalizedAddress) || 0;
    }

    if (visitCount > 0) {
      // Boost based on frequency, scaled by discovery style visitMultiplier
      // explorer: 0.5x (de-emphasise repeats), creature_of_habit: 1.5x (love repeats)
      let rawBoost = 0;
      if (visitCount >= 10) {
        rawBoost = 40; // Frequent favorite (10+ visits via Loop)
      } else if (visitCount >= 5) {
        rawBoost = 30; // Regular spot (5-9 visits)
      } else if (visitCount >= 2) {
        rawBoost = 20; // Repeat visitor (2-4 visits)
      } else {
        rawBoost = 15; // Been here once (1 visit)
      }
      loopVisitHistoryBoost = Math.round(rawBoost * styleConfig.visitMultiplier);
      if (DEBUG_RECS) console.log(`🔄 LOOP VISIT: ${place.name} (${visitCount} visits, +${loopVisitHistoryBoost} pts, ${discoveryStyle} ×${styleConfig.visitMultiplier})`);
    }
  }

  // Source 8: Loop App Feedback (user has rated this place!)
  if (feedbackByPlaceId && place.place_id) {
    const feedback = feedbackByPlaceId.get(place.place_id);

    if (feedback) {
      const { thumbsUp, thumbsDown, tags } = feedback;
      const netRating = thumbsUp - thumbsDown;

      // Strong positive feedback
      if (netRating >= 2) {
        loopFeedbackBoost = 20; // Multiple thumbs up
        if (DEBUG_RECS) console.log(`👍👍 LOVED THIS: ${place.name} (+${thumbsUp}, -${thumbsDown}, +20 points)`);
      } else if (netRating === 1) {
        loopFeedbackBoost = 15; // Positive overall
        if (DEBUG_RECS) console.log(`👍 LIKED THIS: ${place.name} (+${thumbsUp}, -${thumbsDown}, +15 points)`);
      }
      // Neutral feedback (mixed reviews)
      else if (netRating === 0) {
        loopFeedbackBoost = 0; // Neutral
        if (DEBUG_RECS) console.log(`😐 MIXED FEELINGS: ${place.name} (+${thumbsUp}, -${thumbsDown}, 0 points)`);
      }
      // Negative feedback
      else if (netRating === -1) {
        loopFeedbackBoost = -10; // Slight dislike
        if (DEBUG_RECS) console.log(`👎 DISLIKED: ${place.name} (+${thumbsUp}, -${thumbsDown}, -10 points)`);
      } else {
        loopFeedbackBoost = -20; // Strong negative
        if (DEBUG_RECS) console.log(`👎👎 DID NOT LIKE: ${place.name} (+${thumbsUp}, -${thumbsDown}, -20 points)`);

        // Extra penalty if specific negative tags match this category
        if (tags.includes('Too expensive') && placePriceLevel >= 3) {
          loopFeedbackBoost -= 5;
          if (DEBUG_RECS) console.log(`  💸 User said "too expensive" before → -5 more`);
        }
        if (tags.includes('Too far') && distance > 3) {
          loopFeedbackBoost -= 5;
          if (DEBUG_RECS) console.log(`  🚗 User said "too far" before → -5 more`);
        }
      }
    }
  }

  // === FEEDBACK HISTORY SCORE (15 points max) ===
  // Now integrated above as loopFeedbackBoost!
  // Keep this neutral base score for backwards compatibility
  feedbackScore = 5;

  // === FRIEND SOCIAL CONTEXT BOOSTS (Loop Moments) ===
  // Boost places where friends have visited or shared moments
  if (friendSocialContext && place.place_id && friendSocialContext.has(place.place_id)) {
    const socialContext = friendSocialContext.get(place.place_id)!;

    // Friend visit boost: +25 if any friend visited in last 7 days
    if (socialContext.recentFriendVisits > 0) {
      friendVisitBoost = 25;
      if (DEBUG_RECS) console.log(`\ud83d\udc65 FRIEND VISITED: ${place.name} (${socialContext.recentFriendVisits} recent visits, +25 points)`);
    }

    // Friend photo boost: +15 if place has friend moments
    if (socialContext.hasFriendMoments) {
      friendPhotoBoost = 15;
      if (DEBUG_RECS) console.log(`\ud83d\udcf8 FRIEND MOMENT: ${place.name} (${socialContext.friendMomentsCount} moments, +15 points)`);
    }

    // Trending with friends: +20 if 2+ friends visited this week
    if (socialContext.recentFriendVisits >= 2) {
      trendingFriendsBoost = 20;
      if (DEBUG_RECS) console.log(`\ud83d\udd25 TRENDING WITH FRIENDS: ${place.name} (${socialContext.recentFriendVisits} friends, +20 points)`);
    }
  }

  // === AGE BRACKET BOOST (Step 4: Demographic tuning) ===
  // Starting weights that feedback overrides over time
  const AGE_BRACKET_PREFERENCES: Record<string, Record<string, number>> = {
    '18-24': {
      'Bars & Nightlife': 10, 'Entertainment': 10, 'Live Music': 8,
      'Movies': 8, 'Fitness': 5,
      'Arts & Culture': -3, 'Wellness': -3,
    },
    '25-34': {
      'Dining': 8, 'Bars & Nightlife': 5, 'Fitness': 8,
      'Live Music': 8, 'Coffee & Cafes': 5, 'Outdoor Activities': 5,
    },
    '35-44': {
      'Dining': 10, 'Outdoor Activities': 8, 'Arts & Culture': 8,
      'Wellness': 8, 'Shopping': 5,
      'Bars & Nightlife': -5,
    },
    '45+': {
      'Dining': 10, 'Arts & Culture': 10, 'Outdoor Activities': 8,
      'Wellness': 10, 'Shopping': 5,
      'Bars & Nightlife': -8, 'Entertainment': -3,
    },
  };

  const userAgeBracket = getAgeBracketFromUser(extUser);
  if (userAgeBracket && AGE_BRACKET_PREFERENCES[userAgeBracket]) {
    const prefs = AGE_BRACKET_PREFERENCES[userAgeBracket];
    ageBracketBoost = prefs[category] || 0;
    if (ageBracketBoost !== 0) {
      if (DEBUG_RECS) console.log(`🎂 AGE BRACKET (${userAgeBracket}): ${category} → ${ageBracketBoost > 0 ? '+' : ''}${ageBracketBoost} points`);
    }
  }

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

  // === RECENCY PENALTY (Strengthened to prevent repetition) ===
  // Stronger exponential decay to prevent seeing same places repeatedly
  // Scaled by discovery style: creature_of_habit gets softer penalty (0.6x),
  // explorer gets softer penalty too (0.5x — they won't see repeats often anyway)
  let recencyPenalty = 0;
  if (recentlyShown && recentlyShown.has(place.place_id)) {
    const { hoursSince } = recentlyShown.get(place.place_id)!;

    let rawPenalty = 0;
    if (hoursSince < 6) {
      rawPenalty = -40; // Just shown recently - strong penalty
    } else if (hoursSince < 12) {
      rawPenalty = -30; // Very recent - heavy penalty
    } else if (hoursSince < 24) {
      rawPenalty = -25; // Recent - significant penalty
    } else if (hoursSince < 48) {
      rawPenalty = -12; // Moderate penalty 24-48h
    } else if (hoursSince < 72) {
      rawPenalty = -5; // Light penalty 48-72h
    }
    recencyPenalty = Math.round(rawPenalty * styleConfig.recencyMultiplier);
    if (recencyPenalty !== 0) {
      if (DEBUG_RECS) console.log(`⏱️  ${place.name}: ${recencyPenalty} pts (shown ${hoursSince.toFixed(1)}h ago, ${discoveryStyle} ×${styleConfig.recencyMultiplier})`);
    }
    // After 72h: no penalty (fully eligible)
  }

  // === EVENT URGENCY SCORE (15 points max) ===
  // Events happening soon get higher priority than distant events
  if (isEvent && place.event_metadata) {
    const eventStartTime = new Date(place.event_metadata.start_time);
    const hoursUntilEvent = (eventStartTime.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilEvent < 0) {
      // Event already passed - exclude from results
      eventUrgencyScore = -100;
      if (DEBUG_RECS) console.log(`⏳ Event passed: -100 (removed from feed)`);
    } else if (hoursUntilEvent <= 24) {
      // Event TODAY or tomorrow - MAXIMUM urgency
      eventUrgencyScore = 15;
      if (DEBUG_RECS) console.log(`🚨 URGENT (${hoursUntilEvent.toFixed(1)}h): +15`);
    } else if (hoursUntilEvent <= 72) {
      // Event in 1-3 days - HIGH urgency
      eventUrgencyScore = 12;
      if (DEBUG_RECS) console.log(`⏰ Soon (${(hoursUntilEvent/24).toFixed(1)}d): +12`);
    } else if (hoursUntilEvent <= 168) {
      // Event this week (3-7 days) - MODERATE urgency
      eventUrgencyScore = 8;
      if (DEBUG_RECS) console.log(`📅 This week: +8`);
    } else if (hoursUntilEvent <= 720) {
      // Event this month (7-30 days) - MILD urgency
      eventUrgencyScore = 4;
      if (DEBUG_RECS) console.log(`📆 This month: +4`);
    } else {
      // Event 30+ days away - LOW urgency
      eventUrgencyScore = 2;
      if (DEBUG_RECS) console.log(`🗓️  Distant: +2`);
    }
  }

  // === FINAL SCORE ===
  // Now includes 8 data source boosts! (6 from Day 1 + 2 from Loop app feedback loop)
  const finalScore = Math.round(
    baseScore +
    locationScore +
    timeScore +
    feedbackScore +
    collaborativeScore +
    eventUrgencyScore +
    sponsoredBoost +
    recencyPenalty +
    // NEW: 8 Data Source Boosts (Day 1 Sprint + Feedback Loop)
    facebookExactPlaceBoost +
    facebookCategoryBoost +
    googleTimelineVisitBoost +
    googleTimelineCategoryBoost +
    calendarPatternBoost +
    budgetBoost +
    loopVisitHistoryBoost + // NEW: Loop app visit history (+15 to +40)
    loopFeedbackBoost + // NEW: Loop app feedback ratings (+20 to -20)
    // NEW: Friend social context boosts (Loop Moments)
    friendVisitBoost +
    friendPhotoBoost +
    trendingFriendsBoost +
    // NEW: Age bracket boost (Step 4)
    ageBracketBoost
  );

  return {
    baseScore,
    locationScore,
    timeScore,
    feedbackScore,
    collaborativeScore,
    eventUrgencyScore, // NEW: Urgency bonus for events happening soon
    sponsoredBoost,
    recencyPenalty, // NEW: Included in Phase 1.3
    // NEW: 8 Data Source Boosts (Day 1 Sprint + Feedback Loop)
    facebookExactPlaceBoost,
    facebookCategoryBoost,
    googleTimelineVisitBoost,
    googleTimelineCategoryBoost,
    calendarPatternBoost,
    budgetBoost,
    loopVisitHistoryBoost, // NEW: Loop app visit history (+15 to +40)
    loopFeedbackBoost, // NEW: Loop app feedback ratings (+20 to -20)
    // NEW: Friend social context boosts (Loop Moments)
    friendVisitBoost, // +25 if friend visited in last 7 days
    friendPhotoBoost, // +15 if place has friend moments
    trendingFriendsBoost, // +20 if 2+ friends visited this week
    finalScore: Math.max(0, Math.min(finalScore, 160)), // Raised cap to accommodate age bracket boost
  };
}

/**
 * Time-of-day category weight matrix (Step 3: Time-of-Day Category Weighting)
 * Returns additive point boost/penalty per category per time slot.
 * Positive = great fit, Negative = poor fit, 0 = neutral.
 */
const TIME_CATEGORY_WEIGHTS: Record<string, Record<string, number>> = {
  morning: {
    'Coffee & Cafes': 25, 'Dining': 15, 'Fitness': 20,
    'Outdoor Activities': 15, 'Wellness': 10,
    'Bars & Nightlife': -10, 'Entertainment': 0,
    'Arts & Culture': 5, 'Shopping': 5,
  },
  afternoon: {
    'Shopping': 15, 'Arts & Culture': 15, 'Outdoor Activities': 15,
    'Dining': 20, 'Entertainment': 10, 'Fitness': 10,
    'Coffee & Cafes': 10, 'Bars & Nightlife': 0,
  },
  evening: {
    'Dining': 25, 'Bars & Nightlife': 20, 'Entertainment': 20,
    'Live Music': 20, 'Movies': 15,
    'Coffee & Cafes': -5, 'Fitness': 0,
    'Arts & Culture': 5, 'Shopping': 5,
  },
  night: {
    'Bars & Nightlife': 25, 'Live Music': 25, 'Entertainment': 15,
    'Dining': 10, 'Coffee & Cafes': -15, 'Fitness': -10,
    'Arts & Culture': -5, 'Shopping': -10,
  },
};

/**
 * Get time-category weight boost for scoring
 */
function getTimeCategoryBoost(category: string, timeOfDay: string): number {
  const weights = TIME_CATEGORY_WEIGHTS[timeOfDay];
  if (!weights) return 0;
  return weights[category] || 0;
}

/**
 * Check if activity type matches time of day (legacy compatibility)
 */
function checkTimeContext(
  category: string,
  timeOfDay: string
): 'perfect' | 'good' | 'acceptable' {
  const boost = getTimeCategoryBoost(category, timeOfDay);
  if (boost >= 15) return 'perfect';
  if (boost >= 5) return 'good';
  return 'acceptable';
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
/**
 * Extract neighborhood from address string for more specific explanations
 * e.g., "2702 Main St, Dallas, TX 75226" → "Deep Ellum" (if zip matches known neighborhoods)
 */
function extractNeighborhood(address: string): string | null {
  // Known Dallas neighborhoods by zip code or street patterns
  const NEIGHBORHOOD_MAP: Record<string, string> = {
    '75226': 'Deep Ellum',
    '75201': 'Downtown',
    '75204': 'Uptown',
    '75219': 'Oak Lawn',
    '75206': 'Lower Greenville',
    '75207': 'Design District',
    '75208': 'Oak Cliff',
    '75209': 'University Park',
    '75225': 'Highland Park',
    '75214': 'Lakewood',
    '75218': 'White Rock',
    '75205': 'Highland Park',
    '75202': 'Downtown',
    '75215': 'South Dallas',
  };

  // Try zip code match
  const zipMatch = address.match(/\b(\d{5})\b/);
  if (zipMatch && NEIGHBORHOOD_MAP[zipMatch[1]]) {
    return NEIGHBORHOOD_MAP[zipMatch[1]];
  }

  // Try street/area pattern match
  const areaPatterns: [RegExp, string][] = [
    [/deep ellum/i, 'Deep Ellum'],
    [/bishop arts/i, 'Bishop Arts'],
    [/uptown/i, 'Uptown'],
    [/oak lawn/i, 'Oak Lawn'],
    [/downtown/i, 'Downtown'],
    [/greenville/i, 'Greenville'],
    [/knox/i, 'Knox-Henderson'],
    [/henderson/i, 'Knox-Henderson'],
    [/trinity grove/i, 'Trinity Groves'],
    [/design district/i, 'Design District'],
    [/victory/i, 'Victory Park'],
  ];

  for (const [pattern, name] of areaPatterns) {
    if (pattern.test(address)) return name;
  }

  return null;
}

/**
 * Get a more specific place type descriptor instead of generic category
 * e.g., "sushi spot" instead of "dining", "yoga studio" instead of "fitness"
 */
function getSpecificPlaceType(place: PlaceResult, fallbackCategory: string): string {
  const types = place.types || [];
  const name = place.name.toLowerCase();

  // Specific type mappings
  const specificTypes: [RegExp | string, string][] = [
    ['sushi_restaurant', 'sushi spot'],
    ['ramen_restaurant', 'ramen shop'],
    ['pizza_restaurant', 'pizza place'],
    ['mexican_restaurant', 'Mexican restaurant'],
    ['italian_restaurant', 'Italian spot'],
    ['japanese_restaurant', 'Japanese restaurant'],
    ['thai_restaurant', 'Thai restaurant'],
    ['indian_restaurant', 'Indian restaurant'],
    ['korean_restaurant', 'Korean restaurant'],
    ['vietnamese_restaurant', 'Vietnamese restaurant'],
    ['seafood_restaurant', 'seafood spot'],
    ['steak_house', 'steakhouse'],
    ['barbecue_restaurant', 'BBQ joint'],
    ['cafe', 'cafe'],
    ['coffee_shop', 'coffee shop'],
    ['bakery', 'bakery'],
    ['brewery', 'brewery'],
    ['wine_bar', 'wine bar'],
    ['cocktail_bar', 'cocktail bar'],
    ['yoga_studio', 'yoga studio'],
    ['art_gallery', 'gallery'],
    ['museum', 'museum'],
    ['spa', 'spa'],
    ['gym', 'gym'],
  ];

  for (const [type, label] of specificTypes) {
    if (typeof type === 'string' && types.includes(type)) return label;
    if (type instanceof RegExp && types.some(t => type.test(t))) return label;
  }

  // Check name for hints
  if (name.includes('sushi')) return 'sushi spot';
  if (name.includes('coffee')) return 'coffee shop';
  if (name.includes('brewery') || name.includes('brewing')) return 'brewery';
  if (name.includes('bbq') || name.includes('barbecue')) return 'BBQ joint';
  if (name.includes('taco')) return 'taco spot';
  if (name.includes('pizza')) return 'pizza place';
  if (name.includes('bakery') || name.includes('bake')) return 'bakery';

  return fallbackCategory.toLowerCase();
}

/**
 * Helper: Get time context based on hour
 */
function getTimeContext(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Helper: Format time as "3pm" or "11am"
 */
function formatTime(date: Date): string {
  const hour = date.getHours();
  const ampm = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour % 12 || 12;
  return `${hour12}${ampm}`;
}

/**
 * Helper: Estimate travel time between two locations
 */
function estimateTravelTime(
  from: { lat: number; lng: number } | null,
  to: { lat: number; lng: number }
): number | undefined {
  if (!from) return undefined;

  // Simple Haversine distance calculation
  const R = 3959; // Earth radius in miles
  const dLat = (to.lat - from.lat) * Math.PI / 180;
  const dLng = (to.lng - from.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distanceMiles = R * c;

  // Estimate: 25 mph urban average
  return Math.ceil((distanceMiles / 25) * 60);
}

/**
 * Generate contextual AI explanation based on location, time, and interests
 * Replaces generic OpenAI API calls with smart template-based explanations
 */
function generateExplanation(params: {
  place: PlaceResult;
  category: string;
  distance: number;
  user: User;
  scoreBreakdown: ScoredRecommendation['scoreBreakdown'];
}): string {
  const { place, category, distance, user, scoreBreakdown } = params;
  const parts: string[] = [];

  // EVENT-SPECIFIC EXPLANATIONS (Ticketmaster events)
  if (place.source === 'ticketmaster' && place.event_metadata) {
    const eventStart = new Date(place.event_metadata.start_time);
    const hoursUntil = (eventStart.getTime() - Date.now()) / (1000 * 60 * 60);
    const daysUntil = Math.floor(hoursUntil / 24);

    // Event timing (highest priority for events)
    if (hoursUntil <= 24 && hoursUntil > 0) {
      parts.push("🎟️ Tonight!");
    } else if (daysUntil === 1) {
      parts.push("🎟️ Tomorrow");
    } else if (daysUntil <= 3) {
      parts.push(`🎟️ This ${eventStart.toLocaleDateString('en-US', { weekday: 'long' })}`);
    } else if (daysUntil <= 7) {
      parts.push("🎟️ This week");
    } else if (daysUntil <= 14) {
      parts.push("🎟️ Next week");
    } else if (daysUntil <= 30) {
      parts.push(`🎟️ ${eventStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
    } else {
      parts.push(`🎟️ ${eventStart.toLocaleDateString('en-US', { month: 'short' })}`);
    }

    // Event location context
    if (distance <= 2) {
      parts.push("nearby");
    } else if (distance <= 10) {
      parts.push(`${distance.toFixed(1)} mi away`);
    }

    // Interest match for events
    const interests = asInterests(user.interests);
    const matchingInterest = interests.find((interest: string) =>
      category.toLowerCase().includes(interest.toLowerCase()) ||
      place.name.toLowerCase().includes(interest.toLowerCase())
    );

    if (matchingInterest) {
      parts.push(`you love ${matchingInterest}`);
    }

    // Combine event parts
    return parts.join(' • ');
  }

  // 0. CURATED EXPLANATION PASSTHROUGH (Step 5: highest priority)
  // If this is a curated pick with a hand-crafted explanation, use it directly
  if ((place as any)._curatedExplanation) {
    const curatorName = (place as any)._curatorName;
    if (curatorName) {
      return `${(place as any)._curatedExplanation} — Curated by ${curatorName}`;
    }
    return (place as any)._curatedExplanation;
  }

  // REGULAR PLACE EXPLANATIONS (Google Places, restaurants, etc.)
  // v4.0 - Richer "why" explanations with feedback awareness and specificity

  const interests = asInterests(user.interests);
  const rating = place.rating || 0;
  const reviewCount = place.user_ratings_total || 0;
  const isOnRoute = scoreBreakdown.locationScore >= 15;
  const now = new Date();
  const hour = now.getHours();

  // Find matching interest
  const matchingInterest = interests.find((interest: string) =>
    category.toLowerCase().includes(interest.toLowerCase()) ||
    place.name.toLowerCase().includes(interest.toLowerCase())
  );

  // Extract neighborhood from address for specificity
  const address = place.formatted_address || place.vicinity || '';
  const neighborhood = extractNeighborhood(address);

  // Get place-specific descriptor instead of generic category
  const specificType = getSpecificPlaceType(place, category);

  // 1. BUILD COMPELLING OPENING (what makes this special)
  // Priority: Use Gemini AI description if available (cached at seed time)
  if (place.ai_description) {
    parts.push(place.ai_description);
  } else if (matchingInterest && rating >= 4.5 && reviewCount >= 100) {
    // Strong match: interest + highly rated + popular
    parts.push(`Perfect for your ${matchingInterest} craving — ${rating}★ with ${reviewCount.toLocaleString()}+ reviews`);
  } else if (matchingInterest && rating >= 4.0) {
    // Good match: interest + decent rating
    const locationTag = neighborhood ? ` in ${neighborhood}` : '';
    parts.push(`Great ${specificType} pick${locationTag} — ${rating}★ local favorite`);
  } else if (rating >= 4.7 && reviewCount >= 200) {
    // Hidden gem: exceptional rating and popularity
    const locationTag = neighborhood ? ` in ${neighborhood}` : '';
    parts.push(`Local gem${locationTag} — ${rating}★ with ${reviewCount.toLocaleString()}+ glowing reviews`);
  } else if (rating >= 4.5 && reviewCount >= 50) {
    // Solid choice: well-rated
    parts.push(`Highly rated ${specificType} spot — ${rating}★`);
  } else if (matchingInterest) {
    // Interest match without strong ratings
    parts.push(`Matches your love of ${matchingInterest}`);
  }

  // 2. ADD CONVENIENCE CONTEXT (if we have room and it's relevant)
  if (parts.length < 2) {
    if (isOnRoute) {
      parts.push("right on your commute");
    } else if (distance <= 0.5) {
      parts.push("just steps away");
    } else if (distance <= 1.5) {
      parts.push("quick walk from you");
    } else if (distance <= 3) {
      parts.push("short drive away");
    }
  }

  // 3. ADD TIME CONTEXT (if relevant to the category)
  if (parts.length < 2) {
    const isCafe = category.includes('cafe') || category.includes('coffee') || category.includes('bakery');
    const isRestaurant = category.includes('restaurant') || category.includes('food');
    const isBar = category.includes('bar') || category.includes('nightlife') || category.includes('pub');
    const isBreakfast = category.includes('breakfast') || category.includes('brunch');

    if (hour >= 6 && hour < 11 && (isCafe || isBreakfast)) {
      parts.push("perfect morning spot");
    } else if (hour >= 11 && hour < 14 && isRestaurant) {
      parts.push("ideal lunch choice");
    } else if (hour >= 17 && hour < 20 && isRestaurant) {
      parts.push("great dinner option");
    } else if (hour >= 18 && hour < 24 && isBar) {
      parts.push("perfect for tonight");
    }
  }

  // 4. FALLBACK: Build something reasonable if we have nothing
  if (parts.length === 0) {
    if (rating >= 4.0) {
      const locationTag = neighborhood ? ` in ${neighborhood}` : '';
      parts.push(`Well-rated ${specificType}${locationTag} — ${rating}★`);
    } else if (distance <= 5) {
      parts.push(`${specificType} nearby — worth checking out`);
    } else {
      const locationTag = neighborhood ? ` in ${neighborhood}` : ' in your area';
      parts.push(`Trending ${specificType}${locationTag}`);
    }
  }

  // Combine intelligently
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } else {
    // Join with em-dash for elegant separation
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + ' — ' + parts[1];
  }
}

/**
 * Deduplicate events by name and date
 * Prevents showing the same event multiple times (e.g., "Tianyu Lights Festival" appearing 4-5 times)
 */
function deduplicateEventsByNameAndDate(
  recommendations: ScoredRecommendation[]
): ScoredRecommendation[] {
  const seen = new Map<string, ScoredRecommendation>();

  for (const rec of recommendations) {
    if (rec.place.source === 'ticketmaster' && rec.place.event_metadata) {
      // Create unique key: event name + date
      const eventDate = new Date(rec.place.event_metadata.start_time);
      const dateKey = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const nameKey = rec.place.name.toLowerCase().trim();
      const uniqueKey = `${nameKey}|${dateKey}`;

      if (seen.has(uniqueKey)) {
        // Keep higher-scored version
        const existing = seen.get(uniqueKey)!;
        if (rec.score > existing.score) {
          seen.set(uniqueKey, rec);
          if (DEBUG_RECS) console.log(`🔄 Duplicate event replaced: ${rec.place.name} on ${dateKey} (higher score)`);
        } else {
          if (DEBUG_RECS) console.log(`🔄 Duplicate event removed: ${rec.place.name} on ${dateKey}`);
        }
      } else {
        seen.set(uniqueKey, rec);
      }
    } else {
      // Non-events: use place_id as key (will be handled by existing deduplication)
      const key = rec.place.place_id;
      if (!seen.has(key)) {
        seen.set(key, rec);
      }
    }
  }

  const result = Array.from(seen.values());
  if (result.length < recommendations.length) {
    console.log(`🧹 Event deduplication: ${recommendations.length} → ${result.length} (removed ${recommendations.length - result.length} duplicate events)`);
  }
  return result;
}

/**
 * Prevent consecutive duplicates in feed
 * Ensures no two consecutive recommendations are the same place
 */
function preventConsecutiveDuplicates(
  recommendations: ScoredRecommendation[]
): ScoredRecommendation[] {
  const result: ScoredRecommendation[] = [];
  let lastPlaceId: string | null = null;

  for (const rec of recommendations) {
    if (rec.place.place_id !== lastPlaceId) {
      result.push(rec);
      lastPlaceId = rec.place.place_id;
    } else {
      if (DEBUG_RECS) console.log(`⏭️ Skipping consecutive duplicate: ${rec.place.name}`);
    }
  }

  if (result.length < recommendations.length) {
    console.log(`🧹 Consecutive duplicate prevention: ${recommendations.length} → ${result.length} (removed ${recommendations.length - result.length} consecutive duplicates)`);
  }
  return result;
}

/**
 * Apply business rules to final recommendations
 */
function applyBusinessRules(
  recommendations: ScoredRecommendation[],
  maxResults: number,
  discoveryStyle: DiscoveryStyle = 'balanced',
  user?: User,
  priceRange?: 'any' | 1 | 2 | 3 | 4,
): ScoredRecommendation[] {
  // Rule 1: Max 2 sponsored activities in top 5
  const top5 = recommendations.slice(0, 5);
  const sponsoredInTop5 = top5.filter(r => r.isSponsored).length;
  if (sponsoredInTop5 > 2) {
    // Move excess sponsored activities lower
    // TODO: Implement sponsored activity management
  }

  // Rule 2: Never show same business twice (by place_id AND by normalized name)
  const seenPlaceIds = new Set<string>();
  const seenNames = new Set<string>();
  const uniqueRecommendations = recommendations.filter(r => {
    if (seenPlaceIds.has(r.place.place_id)) {
      return false;
    }
    // Deduplicate chains: "Planet Fitness" appearing 3x with different place_ids
    const normalizedName = r.place.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenNames.has(normalizedName)) {
      return false;
    }
    seenPlaceIds.add(r.place.place_id);
    seenNames.add(normalizedName);
    return true;
  });

  // Rule 2a: Deduplicate events by name+date (prevents "Tianyu Lights" appearing 4x)
  let dedupedRecommendations = deduplicateEventsByNameAndDate(uniqueRecommendations);

  // Rule 2b: Prevent consecutive duplicates (same place twice in a row)
  dedupedRecommendations = preventConsecutiveDuplicates(dedupedRecommendations);

  // Rule 3: Let all recommendations through (removed artificial high-score limit)
  // If you have 10 great Italian restaurants nearby, user sees all 10
  let balancedRecommendations = dedupedRecommendations;

  // Rule 4: Category diversity — limit shaped by discovery style
  // explorer=2 (force variety), balanced=3, creature_of_habit=4 (allow repeats)
  const MAX_PER_CATEGORY_IN_TOP_10 = DISCOVERY_STYLE_CONFIG[discoveryStyle].maxPerCategory;
  const top10 = balancedRecommendations.slice(0, 10);
  const rest = balancedRecommendations.slice(10);

  const categoryCount = new Map<string, number>();
  top10.forEach(r => {
    categoryCount.set(r.category, (categoryCount.get(r.category) || 0) + 1);
  });

  // Find categories with too many entries
  const overrepresented = Array.from(categoryCount.entries())
    .filter(([_, count]) => count > MAX_PER_CATEGORY_IN_TOP_10);

  if (overrepresented.length > 0) {
    const categoriesInTop10 = new Set(top10.map(r => r.category));

    for (const [overrepCat] of overrepresented) {
      // Remove excess items from this category (keep the highest-scored ones)
      let removed = 0;
      const excess = categoryCount.get(overrepCat)! - MAX_PER_CATEGORY_IN_TOP_10;

      for (let i = top10.length - 1; i >= 0 && removed < excess; i--) {
        if (top10[i].category === overrepCat) {
          // Find best replacement from rest that brings a new category
          const swapIdx = rest.findIndex(r => !categoriesInTop10.has(r.category));
          if (swapIdx !== -1) {
            const replacement = rest.splice(swapIdx, 1)[0];
            categoriesInTop10.add(replacement.category);
            rest.push(top10[i]); // Move demoted item to rest
            top10[i] = replacement;
            removed++;
          }
        }
      }
    }

    balancedRecommendations = [...top10, ...rest];
  }

  // Rule 5: Event balance (prevent spam, ensure visibility)
  const MAX_EVENTS_IN_TOP_10 = 4; // Cap at 40% events in top 10
  const MIN_EVENTS_IN_TOP_20 = 2; // Ensure minimum event visibility

  const eventsInTop10 = balancedRecommendations
    .slice(0, 10)
    .filter(r => r.place.source === 'ticketmaster').length;

  if (eventsInTop10 > MAX_EVENTS_IN_TOP_10) {
    console.log(`⚠️ Too many events in top 10: ${eventsInTop10} (max ${MAX_EVENTS_IN_TOP_10})`);

    // Keep highest-scoring events, move others down
    const top10Events = balancedRecommendations
      .slice(0, 10)
      .filter(r => r.place.source === 'ticketmaster')
      .sort((a, b) => b.score - a.score);

    const eventsToKeep = top10Events.slice(0, MAX_EVENTS_IN_TOP_10);
    const eventsToMove = top10Events.slice(MAX_EVENTS_IN_TOP_10);

    // Rebuild top 10: keep best events + all non-events
    const top10NonEvents = balancedRecommendations
      .slice(0, 10)
      .filter(r => r.place.source !== 'ticketmaster');

    const newTop10 = [...eventsToKeep, ...top10NonEvents]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // Merge moved events back into rest of list
    const rest = balancedRecommendations.slice(10);
    const newRest = [...eventsToMove, ...rest].sort((a, b) => b.score - a.score);

    balancedRecommendations = [...newTop10, ...newRest];

    console.log(`✅ Event balance: Moved ${eventsToMove.length} events down, kept ${eventsToKeep.length} in top 10`);
  }

  // Ensure minimum event visibility if available
  const totalEvents = balancedRecommendations.filter(r => r.place.source === 'ticketmaster').length;
  if (totalEvents >= MIN_EVENTS_IN_TOP_20) {
    const eventsInTop20 = balancedRecommendations
      .slice(0, 20)
      .filter(r => r.place.source === 'ticketmaster').length;

    if (eventsInTop20 < MIN_EVENTS_IN_TOP_20) {
      console.log(`⚠️ Too few events in top 20: ${eventsInTop20} (min ${MIN_EVENTS_IN_TOP_20})`);

      // Promote best events to ensure 2 in top 20
      const allEvents = balancedRecommendations
        .filter(r => r.place.source === 'ticketmaster')
        .sort((a, b) => b.score - a.score);

      const eventsToPromote = allEvents.slice(0, MIN_EVENTS_IN_TOP_20);
      const nonEvents = balancedRecommendations.filter(r => r.place.source !== 'ticketmaster');

      // Merge and re-sort
      balancedRecommendations = [...eventsToPromote, ...nonEvents].sort((a, b) => b.score - a.score);

      console.log(`✅ Event visibility: Promoted events to ensure ${MIN_EVENTS_IN_TOP_20} in top 20`);
    }
  }

  // Rule 6: Soft budget filter — exclude places 2+ levels above user's budget
  // Only applies when no explicit UI price filter is set
  if (!priceRange || priceRange === 'any') {
    const userBudget = (user ? asAIProfile(user.ai_profile).budget_level : undefined) || (user ? asPreferences(user.preferences).budget : undefined) || 2;
    const beforeCount = balancedRecommendations.length;
    balancedRecommendations = balancedRecommendations.filter(rec => {
      const price = rec.place?.price_level || 0;
      return price === 0 || price <= userBudget + 1; // Allow one level above
    });
    const removed = beforeCount - balancedRecommendations.length;
    if (removed > 0) {
      console.log(`💰 Budget filter: Removed ${removed} places above user budget level ${userBudget}`);
    }
  }

  // Return top N results
  return balancedRecommendations.slice(0, maxResults);
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
    includedTypes: [placeType],
    maxResults: 20,
  });

  // Score and return
  return generateRecommendations({
    ...params,
    maxResults: 10,
  });
}

// ─── Group Recommendations ──────────────────────────────────────────────

export interface GroupMemberMatch {
  userId: string;
  name: string;
  matchedInterests: string[];
  distanceMiles: number;
  profilePicUrl?: string;
}

export interface GroupRecommendationParams {
  groupId: string;
  participants: {
    userId: string;
    name: string;
    homeLocation?: PlaceLocation;
    interests: string[];
    preferences: { budget_level?: number; max_distance_miles?: number };
    profilePicUrl?: string;
  }[];
  userLocation: PlaceLocation;
  tags?: string[];
  maxDistance?: number;
  maxResults?: number;
}

/**
 * Generate group-scored recommendations.
 * Scoring differences from solo:
 * - Interest averaging: shared by all → 2x, majority (>50%) → 1.5x, any single → 1x
 * - Budget: use LOWEST budget_level in group (most conservative)
 * - Distance: penalise based on MAX travel distance (worst-case)
 * - Group-friendly boost: +10 for restaurants/bars/parks, -5 for solo-oriented
 * - Tag filtering: constraint tags mapped to Google Places types
 */
export async function generateGroupRecommendations(
  params: GroupRecommendationParams
): Promise<ScoredRecommendation[]> {
  const {
    participants,
    userLocation,
    tags = [],
    maxDistance = 5,
    maxResults = 10,
  } = params;

  if (participants.length === 0) return [];

  // Calculate midpoint from participant home locations
  const locations = participants
    .filter((p) => p.homeLocation)
    .map((p) => p.homeLocation!);

  const midpoint: PlaceLocation =
    locations.length > 0
      ? {
          lat: locations.reduce((s, l) => s + l.lat, 0) / locations.length,
          lng: locations.reduce((s, l) => s + l.lng, 0) / locations.length,
        }
      : userLocation;

  // Map tags to Google Places types
  const tagToType: Record<string, string[]> = {
    'Food & Drink': ['restaurant', 'bar', 'cafe'],
    'Indoor': ['museum', 'movie_theater', 'bowling_alley'],
    'Outdoor': ['park', 'tourist_attraction'],
    'Live Music': ['night_club', 'bar'],
    'Active': ['gym', 'park', 'bowling_alley'],
    'Relaxing': ['spa', 'cafe', 'park'],
    'Cultural': ['museum', 'art_gallery', 'library'],
    'Family-Friendly': ['park', 'museum', 'zoo', 'aquarium'],
    'Budget-Friendly': ['park', 'library'],
    'Evening': ['restaurant', 'bar', 'night_club'],
    'Weekend': ['park', 'museum', 'restaurant'],
    'Dog-Friendly': ['park'],
  };

  const typeFilter = new Set<string>();
  for (const tag of tags) {
    const types = tagToType[tag];
    if (types) types.forEach((t) => typeFilter.add(t));
  }

  // Search nearby places around midpoint
  const radiusMeters = maxDistance * 1609.34;
  const places = await searchNearbyPlaces({
    location: midpoint,
    radius: Math.min(radiusMeters, 50000),
    includedTypes: typeFilter.size > 0 ? [...typeFilter] : undefined,
    maxResults: 50,
  });

  if (places.length === 0) return [];

  // Collect all interests
  const allInterests = participants.flatMap((p) => p.interests || []);
  const interestCounts = new Map<string, number>();
  for (const interest of allInterests) {
    interestCounts.set(interest, (interestCounts.get(interest) || 0) + 1);
  }

  // Conservative budget: lowest in group
  const lowestBudget = Math.min(
    ...participants.map((p) => p.preferences?.budget_level ?? 3)
  );

  // Group-friendly categories
  const GROUP_FRIENDLY_TYPES = new Set([
    'restaurant', 'bar', 'cafe', 'park', 'night_club', 'bowling_alley',
    'amusement_park', 'zoo', 'aquarium', 'tourist_attraction', 'museum',
  ]);
  const SOLO_ORIENTED_TYPES = new Set([
    'spa', 'yoga_studio', 'gym', 'fitness_center', 'library',
  ]);

  // Score each place
  const scored: ScoredRecommendation[] = [];

  for (const place of places) {
    const category = mapPlaceTypeToCategory(place.types);

    // Filter by tag types if tags specified
    if (typeFilter.size > 0) {
      const matchesAnyType = place.types.some((t) => typeFilter.has(t));
      if (!matchesAnyType) continue;
    }

    // Budget filter
    if (place.price_level !== undefined && place.price_level > lowestBudget) continue;

    // ── Interest Score (0-40) ──
    let interestScore = 0;
    const matchCount = interestCounts.get(category) || 0;
    if (participants.length === 0) {
      interestScore = 5; // No participants → base score
    } else if (matchCount === participants.length) {
      interestScore = 40; // Shared by all → 2x weight (20 * 2)
    } else if (matchCount > participants.length / 2) {
      interestScore = 30; // Majority → 1.5x weight (20 * 1.5)
    } else if (matchCount > 0) {
      interestScore = 20; // Any single → 1x weight
    } else {
      interestScore = 5; // No match but still eligible
    }

    // ── Location Score (0-20) ──
    // Penalise based on MAX travel distance (worst-case member)
    let maxMemberDistance = 0;
    const placeLocation: PlaceLocation = {
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
    };

    for (const p of participants) {
      const from = p.homeLocation || userLocation;
      const dist = calculateDistance(from, placeLocation);
      if (dist > maxMemberDistance) maxMemberDistance = dist;
    }

    let locationScore = 0;
    if (maxMemberDistance <= 1) locationScore = 20;
    else if (maxMemberDistance <= 3) locationScore = 15;
    else if (maxMemberDistance <= maxDistance) locationScore = 10;
    else locationScore = 5;

    // ── Group-friendly Boost (0-10 or -5) ──
    let groupFriendlyScore = 0;
    if (place.types.some((t) => GROUP_FRIENDLY_TYPES.has(t))) {
      groupFriendlyScore = 10;
    } else if (place.types.some((t) => SOLO_ORIENTED_TYPES.has(t))) {
      groupFriendlyScore = -5;
    }

    // ── Rating Score (0-15) ──
    const ratingScore = place.rating ? Math.min(15, Math.round((place.rating / 5) * 15)) : 5;

    // ── Final Score ──
    const totalScore = interestScore + locationScore + groupFriendlyScore + ratingScore;

    // Get photo
    let photoUrl: string | undefined;
    if (place.photos?.[0]?.photo_reference) {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
      if (apiKey) {
        photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${place.photos[0].photo_reference}&key=${apiKey}`;
      }
    }
    if (!photoUrl) {
      photoUrl = await getCachedUnsplashImage(category);
    }

    // ── Per-member matching ──
    const groupMemberMatches: GroupMemberMatch[] = participants.map((p) => {
      const from = p.homeLocation || userLocation;
      const dist = calculateDistance(from, placeLocation);
      const matched = (p.interests || []).filter(
        (interest) => interest === category || interestMatchesCategory(interest, category)
      );
      return {
        userId: p.userId,
        name: p.name,
        matchedInterests: matched,
        distanceMiles: Math.round(dist * 10) / 10,
        profilePicUrl: p.profilePicUrl,
      };
    });

    scored.push({
      place,
      score: totalScore,
      scoreBreakdown: {
        baseScore: interestScore,
        locationScore,
        timeScore: 0,
        feedbackScore: 0,
        collaborativeScore: 0,
        eventUrgencyScore: 0,
        sponsoredBoost: 0,
        finalScore: totalScore,
      },
      distance: maxMemberDistance,
      category,
      photoUrl,
      aiExplanation: buildGroupExplanation(place.name, category, groupMemberMatches),
      isSponsored: false,
      groupMemberMatches,
    });
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxResults);
}

/**
 * Check if a user interest label loosely matches a place category.
 * Handles cases like "Dining" matching "Food & Drink", "Coffee & Cafes" matching "Coffee", etc.
 */
export function interestMatchesCategory(interest: string, category: string): boolean {
  const a = interest.toLowerCase();
  const b = category.toLowerCase();
  if (a === b) return true;

  // Build a mapping of related terms
  const aliases: Record<string, string[]> = {
    'dining': ['food', 'restaurant', 'food & drink'],
    'food & drink': ['dining', 'restaurant'],
    'coffee & cafes': ['coffee', 'cafe'],
    'coffee': ['coffee & cafes', 'cafe'],
    'bars & nightlife': ['nightlife', 'bar', 'bars'],
    'nightlife': ['bars & nightlife', 'bar', 'bars'],
    'outdoor activities': ['outdoor', 'parks', 'nature', 'hiking'],
    'outdoor': ['outdoor activities', 'parks'],
    'arts & culture': ['culture', 'museum', 'art', 'gallery'],
    'culture': ['arts & culture', 'museum'],
    'entertainment': ['fun', 'movies', 'theater'],
    'fitness': ['gym', 'sports', 'active'],
    'shopping': ['store', 'mall', 'retail'],
    'wellness': ['spa', 'relaxing'],
    'live music': ['music', 'concerts'],
  };

  const aAliases = aliases[a] || [];
  if (aAliases.includes(b)) return true;

  // Substring containment as last resort
  if (a.includes(b) || b.includes(a)) return true;

  return false;
}

function buildGroupExplanation(
  placeName: string,
  category: string,
  members: GroupMemberMatch[]
): string {
  const matchingMembers = members.filter((m) => m.matchedInterests.length > 0);
  const farthest = members.reduce((prev, curr) => curr.distanceMiles > prev.distanceMiles ? curr : prev, members[0]);

  if (matchingMembers.length === members.length && members.length > 0) {
    const names = matchingMembers.map((m) => m.name.split(' ')[0]);
    if (names.length === 1) {
      return `${names[0]} loves ${category.toLowerCase()} — ${placeName} is a perfect pick.`;
    }
    if (names.length === 2) {
      return `${names[0]} and ${names[1]} both love ${category.toLowerCase()} — great match for everyone!`;
    }
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]} all love ${category.toLowerCase()}!`;
  }

  if (matchingMembers.length > 0) {
    const names = matchingMembers.map((m) => m.name.split(' ')[0]);
    const nameStr = names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
    return `${nameStr} ${matchingMembers.length === 1 ? 'likes' : 'like'} ${category.toLowerCase()} — and it's only ${farthest.distanceMiles.toFixed(1)} mi from ${farthest.name.split(' ')[0]}.`;
  }

  return `${placeName} is a group-friendly ${category.toLowerCase()} spot ${farthest.distanceMiles.toFixed(1)} mi from ${farthest.name.split(' ')[0]}.`;
}
