// @ts-nocheck - JSONB type handling from Supabase
/**
 * Recommendation Engine
 * Scores and ranks activities based on user preferences, location, and context
 */

// Production-ready imports - NO MOCK DATA
import { getCachedUnsplashImage } from './unsplash';
import { getBusinessHours, suggestVisitTime } from '@/utils/business-hours';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types/database';
import type { Activity } from '@/types/activity';

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

// Type definitions (copied from legacy for compatibility)
export type PlaceLocation = { lat: number; lng: number };

export interface PlaceResult {
  place_id: string;
  name: string;
  vicinity?: string;
  formatted_address?: string;
  description?: string; // Editorial summary from Google Places
  formatted_phone_number?: string;
  website?: string;
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

// Helper function: Check if place name matches generic patterns
function isGenericPlace(placeName: string): boolean {
  return GENERIC_PLACE_PATTERNS.some(pattern => pattern.test(placeName));
}

// Helper function: Check if user has positive feedback history for generic place type
function userFrequentsGenericPlace(place: PlaceResult, user: User): boolean {
  // Check if user has favorite categories that match this place type
  const userFavorites = user.ai_profile?.favorite_categories || [];
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
  const userInterests = user.interests || [];
  const topInterests = user.ai_profile?.favorite_categories || userInterests.slice(0, 3);

  return topInterests.includes(category) || userInterests.includes(category);
}

// Helper function: Map user interest categories to Google Places API types
// NOTE: Only using types supported by Google Places API (New) v1
// See: https://developers.google.com/maps/documentation/places/web-service/place-types
function mapInterestsToGoogleTypes(interests: string[]): string[] {
  const interestToTypeMap: Record<string, string[]> = {
    // Food & Drink
    'Dining': ['restaurant', 'meal_takeaway', 'meal_delivery'],
    'Coffee & Cafes': ['cafe', 'coffee_shop'],
    'Bars & Nightlife': ['bar', 'night_club'],
    'Breakfast': ['breakfast_restaurant', 'brunch_restaurant'],

    // Entertainment
    'Music': ['night_club', 'bar'], // Note: live_music_venue not supported by API
    'Entertainment': ['movie_theater', 'bowling_alley', 'amusement_park', 'performing_arts_theater'],
    'Arts & Culture': ['art_gallery', 'museum', 'cultural_center', 'performing_arts_theater'],
    'Live Music': ['night_club', 'bar'], // Note: music_venue not supported by API

    // Activities
    'Sports': ['stadium', 'sports_complex', 'sports_club'],
    'Fitness': ['gym', 'fitness_center', 'yoga_studio', 'sports_complex'],
    'Outdoor': ['park', 'hiking_area', 'campground', 'national_park'],
    'Shopping': ['shopping_mall', 'store', 'clothing_store', 'book_store'],

    // Other
    'Parks': ['park', 'dog_park'],
    'Events': ['event_venue', 'banquet_hall', 'convention_center'],
  };

  const googleTypes = new Set<string>();

  for (const interest of interests) {
    const types = interestToTypeMap[interest];
    if (types) {
      types.forEach(type => googleTypes.add(type));
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

  if (!API_KEY) {
    console.error('❌ getPlacePhotoUrl: No API key available');
    return '';
  }

  if (!photoReference) {
    console.error('❌ getPlacePhotoUrl: No photo reference provided');
    return '';
  }

  // CRITICAL: Validate input is a photo reference, NOT a full URL
  // This prevents double URL concatenation bugs
  if (photoReference.startsWith('http://') || photoReference.startsWith('https://')) {
    console.error(`❌ getPlacePhotoUrl: Received full URL instead of photo reference!`);
    console.error(`   Got: "${photoReference.substring(0, 100)}..."`);
    console.error('   Photo reference should be: "places/PLACE_ID/photos/PHOTO_ID"');
    console.error('   NOT a full URL like: "https://images.unsplash.com/..." or "https://places.googleapis.com/..."');
    return '';
  }

  // Validate photo reference format BEFORE concatenation
  if (!photoReference.startsWith('places/') || !photoReference.includes('/photos/')) {
    console.error(`❌ getPlacePhotoUrl: Invalid photo reference format: "${photoReference}"`);
    console.error(`   Expected format: "places/PLACE_ID/photos/PHOTO_ID"`);
    return '';
  }

  // NOW safe to concatenate - input is validated as a proper photo reference
  const url = `https://places.googleapis.com/v1/${photoReference}/media?key=${API_KEY}&maxHeightPx=400&maxWidthPx=600`;

  return url;
}

// Convert Activity to PlaceResult (for mock data compatibility)
function activityToPlaceResult(activity: Activity): PlaceResult {
  return {
    place_id: activity.googlePlaceId || activity.id,
    name: activity.name,
    vicinity: activity.location.address,
    formatted_address: activity.location.address,
    description: activity.description,
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

// Search places by text query using NEW Google Places API
async function searchPlacesByText(params: {
  query: string;
  location: PlaceLocation;
  radius: number;
  maxResults?: number;
}): Promise<PlaceResult[]> {
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
async function searchNearbyPlaces(params: {
  location: PlaceLocation;
  radius: number;
  maxResults?: number;
  includedTypes?: string[]; // Filter by place types (e.g., ['restaurant', 'cafe'])
}): Promise<PlaceResult[]> {
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
    // Call NEW Places API (New) - searchNearby endpoint
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
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
        open_now: place.currentOpeningHours?.openNow ?? true, // Use actual data or default to open
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
    recencyPenalty?: number; // NEW: Penalty for recently shown places (Phase 1.3)
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
  discoveryMode?: 'curated' | 'explore'; // Discovery mode: curated (conservative) vs explore (adventurous)
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

  data?.forEach(row => {
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
    maxDistance = user.preferences?.max_distance_miles || 5,
    maxResults = 30, // Increased for infinite scroll feed
    timeOfDay,
    priceRange,
    excludePlaceIds, // For infinite scroll: only exclude current feed items
    categories, // Filter by specific categories
    minRating, // Minimum rating filter
    date, // Search for specific date
    openNow, // Only show places that are currently open
  } = params;

  console.log('Generating recommendations for user:', user.id);
  console.log('User interests:', user.interests);
  console.log('Max distance:', maxDistance, 'miles');
  console.log('Advanced filters:', {
    categories: categories?.length || 0,
    minRating,
    openNow,
    date: date?.toLocaleDateString(),
  });

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
  const userInterests = user.interests || [];
  if (userInterests.length > 0) {
    console.log(`🎯 User interests: ${userInterests.join(', ')}`);
  }

  // CRITICAL FIX: Define isInfiniteScrollMode BEFORE using it
  // Infinite scroll mode = excludePlaceIds provided (user scrolling for more content)
  const isInfiniteScrollMode = excludePlaceIds && excludePlaceIds.length > 0;
  console.log(`🔄 Mode: ${isInfiniteScrollMode ? 'Infinite Scroll' : 'Fresh Load'}`);

  // Query 3-5 different category groups in parallel to get variety
  // Prioritize user interests, but also include some variety
  // For infinite scroll: Query ALL categories with higher maxResults to find fresh content
  const groupsToQuery = isInfiniteScrollMode ? categoryGroups : categoryGroups.slice(0, 3);
  const fetchLimit = isInfiniteScrollMode ? 50 : 20; // Fetch more during infinite scroll

  console.log(`🔍 Querying ${groupsToQuery.length} category groups in parallel (${fetchLimit} results each)`);

  let nearbyPlaces: PlaceResult[] = [];
  try {
    // Query multiple categories in parallel
    const placePromises = groupsToQuery.map(group =>
      searchNearbyPlaces({
        location: userLocation,
        radius: Math.min(radiusMeters, 50000),
        maxResults: fetchLimit,
        includedTypes: group.types,
      }).then(places => {
        console.log(`📍 ${group.name}: Found ${places.length} places`);
        return places;
      })
    );

    const placeArrays = await Promise.all(placePromises);

    // Combine and deduplicate
    const allPlaces = placeArrays.flat();
    const uniquePlaces = new Map<string, PlaceResult>();
    allPlaces.forEach(place => {
      if (!uniquePlaces.has(place.place_id)) {
        uniquePlaces.set(place.place_id, place);
      }
    });

    nearbyPlaces = Array.from(uniquePlaces.values());
    console.log(`✅ Combined ${allPlaces.length} places into ${nearbyPlaces.length} unique places`);

  } catch (error) {
    console.error('Error fetching nearby places:', error);
    // Fallback to single broad query
    nearbyPlaces = await searchNearbyPlaces({
      location: userLocation,
      radius: Math.min(radiusMeters, 50000),
      maxResults: 20,
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

    // Query multiple categories in parallel for expansion too
    const expandPlacePromises = groupsToQuery.map(group =>
      searchNearbyPlaces({
        location: userLocation,
        radius: expansionRadius,
        maxResults: fetchLimit, // Use same limit as initial query
        includedTypes: group.types,
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
        console.log(`⏭️  Skipping (category filter): ${place.name} (${category})`);
        continue;
      }
    }

    // ADVANCED FILTER: Minimum rating
    if (minRating && minRating > 0) {
      const placeRating = place.rating || 0;
      if (placeRating < minRating) {
        console.log(`⏭️  Skipping (low rating): ${place.name} (${placeRating} < ${minRating})`);
        continue;
      }
    }

    // ADVANCED FILTER: Open now
    if (openNow) {
      const isOpen = place.opening_hours?.open_now ?? false;
      if (!isOpen) {
        console.log(`⏭️  Skipping (closed): ${place.name}`);
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
      console.log(`⏭️  Skipping generic place (absolute filter): ${place.name}`);
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
        console.log(`⏭️  Skipping place outside price range: ${place.name} (${'$'.repeat(placePrice)} vs max ${'$'.repeat(priceRange)})`);
        continue;
      }
    }

    // Log place type for debugging (interest match vs discovery)
    console.log(`${matchesInterests ? '⭐' : '📍'} ${isPopular ? 'Popular place' : 'Place'}: ${place.name}`);

    // Calculate score (with recency penalty - Phase 1.3)
    const scoreBreakdown = calculateActivityScore({
      place,
      category,
      distance,
      user,
      homeLocation,
      workLocation,
      timeOfDay,
      recentlyShown, // Pass recency map for soft exclusion penalty
    });

    // Removed zero-score threshold filter - let all places through
    // Interest mismatch just means lower score, not removal
    // User feedback will teach the algorithm over time what they actually like

    // Log high-quality matches for debugging
    if (matchesInterests && isPopular) {
      console.log(`✨ EXCELLENT match: ${place.name} (interest + popular, score: ${scoreBreakdown.finalScore})`);
    } else if (matchesInterests) {
      console.log(`✓ Interest match: ${place.name} (score: ${scoreBreakdown.finalScore})`);
    } else if (isPopular) {
      console.log(`⭐ Popular place: ${place.name} (score: ${scoreBreakdown.finalScore})`);
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
      console.log(`📸 ${place.name} has ${place.photos.length} photos from Google API`);
      console.log(`📸 First photo object:`, JSON.stringify(place.photos[0], null, 2));
      console.log(`📸 First photo reference: "${place.photos[0]?.photo_reference}"`);

      // CRITICAL: Check if API key exists
      const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
      if (!API_KEY) {
        console.error('❌ CRITICAL: No Google Places API key found! Photos will not load.');
        console.log('📸 Falling back to Unsplash immediately');
        photoUrl = await getCachedUnsplashImage(category);
      } else {
        console.log('✅ API key exists, generating photo URLs...');

        // Get all available photos (up to 5 for performance)
        const allPhotos = place.photos.slice(0, 5).map((photo, idx) => {
          const photoRef = photo.photo_reference;
          console.log(`📸 Photo ${idx + 1}: ref="${photoRef?.substring(0, 80)}..."`);

          if (!photoRef) {
            console.error(`❌ Photo ${idx + 1} has no photo_reference!`);
            return '';
          }

          // CRITICAL: Validate it's a photo reference, not a full URL
          // This prevents double URL concatenation
          if (photoRef.startsWith('http://') || photoRef.startsWith('https://')) {
            console.error(`❌ Photo ${idx + 1}: photo_reference is a full URL, not a reference!`);
            console.error(`   Got: "${photoRef.substring(0, 100)}..."`);
            console.error(`   This indicates corrupted data - skipping this photo`);
            return '';
          }

          const url = getPlacePhotoUrl(photoRef);
          console.log(`📸 Photo ${idx + 1}: Generated URL="${url?.substring(0, 100)}..."`);

          if (!url) {
            console.error(`❌ getPlacePhotoUrl returned empty for photo ${idx + 1}`);
          }
          return url;
        }).filter(Boolean);

        console.log(`📸 ${place.name}: Generated ${allPhotos.length} valid photo URLs out of ${place.photos.length} photos`);

        if (allPhotos.length > 0) {
          photoUrl = allPhotos[0]; // Primary photo
          console.log(`✅ Using Google photo for ${place.name}: ${photoUrl.substring(0, 100)}...`);

          // Only populate photoUrls array if we have 3+ photos (for carousel)
          if (allPhotos.length >= 3) {
            photoUrls = allPhotos;
            console.log(`📸 ${place.name}: Carousel enabled with ${allPhotos.length} photos`);
          }
        } else {
          console.error(`❌ No valid photo URLs generated for ${place.name} - all URLs were empty!`);
        }
      }
    } else {
      console.log(`📸 ${place.name} has NO photos array from Google API (photos=${place.photos})`);
    }

    // If no Google photo, use Unsplash fallback for primary
    if (!photoUrl) {
      console.log(`📸 FALLBACK: Using Unsplash for ${place.name} (category: ${category})`);
      photoUrl = await getCachedUnsplashImage(category);
      console.log(`📸 FALLBACK: Unsplash returned: ${photoUrl?.substring(0, 100)}...`);
    }

    // Get business hours (from Google or estimated)
    const businessHoursInfo = getBusinessHours(place.opening_hours, category);

    // Suggest best time to visit based on business hours
    const suggestedTime = suggestVisitTime(businessHoursInfo.hours, timeOfDay, new Date());

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
  const shuffledRecommendations = scoredRecommendations.map((rec, index) => {
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

  // Step 4: Apply business rules
  const finalRecommendations = applyBusinessRules(shuffledRecommendations, maxResults);

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
  recentlyShown?: Map<string, { timestamp: number; hoursSince: number }>; // Phase 1.3
}): ScoredRecommendation['scoreBreakdown'] {
  const { place, category, distance, user, homeLocation, workLocation, timeOfDay, recentlyShown } = params;

  let baseScore = 0;
  let locationScore = 0;
  let timeScore = 0;
  let feedbackScore = 5; // Neutral default
  let collaborativeScore = 0;
  let sponsoredBoost = 0;

  // === BASE SCORE (50 points max) ===
  // Interest match guides scoring but doesn't filter - allow discovery
  const userInterests = user.interests || [];
  const topInterests = user.ai_profile?.favorite_categories || userInterests.slice(0, 3);
  const { discoveryMode = 'curated' } = params;

  if (topInterests.includes(category)) {
    baseScore = 30; // Top 3 interests - STRONG match
  } else if (userInterests.includes(category)) {
    baseScore = 20; // Other interests - GOOD match
  } else {
    // Discovery mode affects non-matching interests
    if (discoveryMode === 'explore') {
      baseScore = 15; // More generous in explore mode - encourage discovery
    } else {
      baseScore = 10; // Conservative in curated mode - focus on known interests
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

  baseScore = Math.min(baseScore, 50); // Cap at 50

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

  // === RECENCY PENALTY (Strengthened to prevent repetition) ===
  // Stronger exponential decay to prevent seeing same places repeatedly
  let recencyPenalty = 0;
  if (recentlyShown && recentlyShown.has(place.place_id)) {
    const { hoursSince } = recentlyShown.get(place.place_id)!;

    if (hoursSince < 6) {
      recencyPenalty = -40; // Just shown recently - strong penalty
      console.log(`⏱️  ${place.name}: -40 pts (shown ${hoursSince.toFixed(1)}h ago)`);
    } else if (hoursSince < 12) {
      recencyPenalty = -30; // Very recent - heavy penalty
      console.log(`⏱️  ${place.name}: -30 pts (shown ${hoursSince.toFixed(1)}h ago)`);
    } else if (hoursSince < 24) {
      recencyPenalty = -25; // Recent - significant penalty
      console.log(`⏱️  ${place.name}: -25 pts (shown ${hoursSince.toFixed(1)}h ago)`);
    } else if (hoursSince < 48) {
      recencyPenalty = -12; // Moderate penalty 24-48h
      console.log(`⏱️  ${place.name}: -12 pts (shown ${hoursSince.toFixed(1)}h ago)`);
    } else if (hoursSince < 72) {
      recencyPenalty = -5; // Light penalty 48-72h
      console.log(`⏱️  ${place.name}: -5 pts (shown ${hoursSince.toFixed(1)}h ago)`);
    }
    // After 72h: no penalty (fully eligible)
  }

  // === FINAL SCORE ===
  const finalScore = Math.round(
    baseScore + locationScore + timeScore + feedbackScore + collaborativeScore + sponsoredBoost + recencyPenalty
  );

  return {
    baseScore,
    locationScore,
    timeScore,
    feedbackScore,
    collaborativeScore,
    sponsoredBoost,
    recencyPenalty, // NEW: Included in Phase 1.3
    finalScore: Math.max(0, Math.min(finalScore, 100)), // Don't go below 0, cap at 100
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

  // 1. LOCATION CONTEXT (highest priority)
  const isOnRoute = scoreBreakdown.locationScore >= 15; // "on route" bonus from scoring

  if (isOnRoute) {
    parts.push("On your way home");
  } else if (distance <= 2) {
    parts.push("Right near you");
  } else if (distance <= 5) {
    parts.push(`${distance.toFixed(1)} mi away`);
  }

  // 2. TIME CONTEXT
  const now = new Date();
  const timeContext = getTimeContext(now.getHours());

  // Could add free time slot detection here in future
  // For now, use time-of-day context
  if (timeContext === 'morning' && (category.includes('cafe') || category.includes('bakery'))) {
    parts.push("perfect morning spot");
  } else if (timeContext === 'afternoon' && category.includes('restaurant')) {
    parts.push("great lunch option");
  } else if (timeContext === 'evening' && (category.includes('bar') || category.includes('restaurant'))) {
    parts.push("ideal for tonight");
  }

  // 3. INTEREST MATCH
  const interests = user.interests || [];
  const matchingInterest = interests.find(interest =>
    category.toLowerCase().includes(interest.toLowerCase()) ||
    place.name.toLowerCase().includes(interest.toLowerCase())
  );

  if (matchingInterest) {
    parts.push(`you love ${matchingInterest}`);
  } else if (place.rating && place.rating >= 4.5) {
    parts.push(`highly rated (${place.rating}★)`);
  } else if (interests.length > 0) {
    parts.push(`matches your vibe`);
  }

  // Combine with smart punctuation
  if (parts.length === 0) {
    return `Recommended for you`;
  } else if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } else if (parts.length === 2) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + ' - ' + parts[1];
  } else {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + ' - ' + parts.slice(1).join(' - ');
  }
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

  // Rule 3: Let all recommendations through (removed artificial high-score limit)
  // If you have 10 great Italian restaurants nearby, user sees all 10
  let balancedRecommendations = uniqueRecommendations;

  // Rule 4: AGGRESSIVE category diversity enforcement (min 7 categories in top 10)
  const MIN_CATEGORIES_IN_TOP_10 = 7; // Force variety
  const MIN_CATEGORIES_IN_TOP_20 = 10; // Enforce across top 20 too
  const diversityWindow = balancedRecommendations.slice(0, 15);
  const categoriesInTop10 = new Set(diversityWindow.slice(0, 10).map(r => r.category));

  if (categoriesInTop10.size < MIN_CATEGORIES_IN_TOP_10) {
    console.log(`⚠️ Low diversity: only ${categoriesInTop10.size} categories in top 10`);

    const categoryCount = new Map<string, number>();
    diversityWindow.slice(0, 10).forEach(r => {
      categoryCount.set(r.category, (categoryCount.get(r.category) || 0) + 1);
    });

    const overrepresentedCategories = Array.from(categoryCount.entries())
      .filter(([_, count]) => count >= 3)
      .map(([cat, _]) => cat);

    // Swap lowest-scoring overrepresented item with highest-scoring diverse item
    for (const overrepCat of overrepresentedCategories) {
      let lowestScoreIdx = -1;
      let lowestScore = Infinity;
      for (let i = 0; i < 10; i++) {
        if (diversityWindow[i].category === overrepCat && diversityWindow[i].score < lowestScore) {
          lowestScore = diversityWindow[i].score;
          lowestScoreIdx = i;
        }
      }

      let bestSwapIdx = -1;
      let bestSwapScore = 0;
      for (let i = 10; i < 15 && i < diversityWindow.length; i++) {
        const isNewCategory = !categoryCount.has(diversityWindow[i].category);
        if (isNewCategory && diversityWindow[i].score > bestSwapScore) {
          bestSwapScore = diversityWindow[i].score;
          bestSwapIdx = i;
        }
      }

      if (lowestScoreIdx !== -1 && bestSwapIdx !== -1) {
        console.log(`🔄 Diversity swap: ${diversityWindow[lowestScoreIdx].place.name} ↔ ${diversityWindow[bestSwapIdx].place.name}`);
        const temp = diversityWindow[lowestScoreIdx];
        diversityWindow[lowestScoreIdx] = diversityWindow[bestSwapIdx];
        diversityWindow[bestSwapIdx] = temp;
        break;
      }
    }

    balancedRecommendations = [...diversityWindow, ...balancedRecommendations.slice(15)];
  }

  // Rule 5: Respect price range filter
  // TODO: Filter by user budget preference

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
    type: placeType,
    maxResults: 20,
  });

  // Score and return
  return generateRecommendations({
    ...params,
    maxResults: 10,
  });
}
