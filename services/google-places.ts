import { Activity, GooglePlaceResult, GooglePlaceDetails, Location } from '@/types/activity';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
// New Places API (New) endpoints
const PLACES_API_BASE = 'https://places.googleapis.com/v1/places';

/**
 * Mock data REMOVED FOR PRODUCTION
 * All mock data has been removed to ensure production-ready code only uses real Google Places API data.
 */

/**
 * Search for nearby activities using Google Places API
 * Requires valid API key - no mock data fallback
 */
export async function searchNearbyActivities(
  location: { latitude: number; longitude: number },
  radius: number = 5000, // meters
  type?: string,
  keyword?: string
): Promise<Activity[]> {
  // Require valid API key - throw error if not configured
  if (!GOOGLE_PLACES_API_KEY || GOOGLE_PLACES_API_KEY === 'your_key_here') {
    throw new Error('Google Places API key is required. Please add EXPO_PUBLIC_GOOGLE_PLACES_API_KEY to your .env file');
  }

  try {
    // New Places API (New) uses POST with JSON body
    const requestBody: any = {
      includedTypes: type ? [type] : ['restaurant', 'cafe', 'bar', 'museum', 'park', 'gym'],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          radius: radius,
        },
      },
    };

    if (keyword) {
      requestBody.textQuery = keyword;
    }

    const response = await fetch(`${PLACES_API_BASE}:searchNearby`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.photos,places.currentOpeningHours,places.editorialSummary,places.reviews',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = `Google Places API error: ${response.status} - ${data.error?.message || 'Unknown error'}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    const results = data.places || [];
    return results.map((place: any) => convertNewAPIPlaceToActivity(place, location));
  } catch (error) {
    console.error('Error fetching nearby activities:', error);
    throw error; // Propagate error instead of falling back to mock data
  }
}

/**
 * Get detailed information about a specific place using new Places API
 */
export async function getPlaceDetails(placeId: string): Promise<GooglePlaceDetails | null> {
  if (!GOOGLE_PLACES_API_KEY || GOOGLE_PLACES_API_KEY === 'your_key_here') {
    console.log('📍 API key not configured');
    return null;
  }

  try {
    // New Places API (New) format
    const response = await fetch(`${PLACES_API_BASE}/${placeId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,internationalPhoneNumber,websiteUri,rating,userRatingCount,priceLevel,location,photos,currentOpeningHours,types,reviews,editorialSummary',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Google Places Details API error:', response.status, data);
      return null;
    }

    // Convert new API format to old format for compatibility
    return {
      place_id: data.id,
      name: data.displayName?.text || '',
      formatted_address: data.formattedAddress || '',
      formatted_phone_number: data.internationalPhoneNumber,
      website: data.websiteUri,
      rating: data.rating,
      user_ratings_total: data.userRatingCount,
      price_level: data.priceLevel ? getPriceLevelFromNew(data.priceLevel) : undefined,
      geometry: {
        location: {
          lat: data.location?.latitude || 0,
          lng: data.location?.longitude || 0,
        },
      },
      photos: data.photos?.map((photo: any) => ({
        photo_reference: photo.name,
        height: photo.heightPx || 400,
        width: photo.widthPx || 400,
      })),
      opening_hours: data.currentOpeningHours ? {
        open_now: data.currentOpeningHours.openNow || false,
        weekday_text: data.currentOpeningHours.weekdayDescriptions || [],
      } : undefined,
      types: data.types || [],
      reviews: data.reviews?.map((review: any) => ({
        author_name: review.authorAttribution?.displayName || 'Anonymous',
        rating: review.rating || 0,
        text: review.text?.text || '',
        time: review.publishTime ? new Date(review.publishTime).getTime() / 1000 : 0,
      })),
    };
  } catch (error) {
    console.error('Error fetching place details:', error);
    return null;
  }
}

/**
 * Get URL for a place photo (supports both old and new API formats)
 */
export function getPlacePhotoUrl(photoReference: string, maxWidth: number = 800): string {
  if (!GOOGLE_PLACES_API_KEY || GOOGLE_PLACES_API_KEY === 'your_key_here') {
    // Return placeholder image
    return `https://via.placeholder.com/${maxWidth}x${Math.floor(maxWidth * 0.6)}`;
  }

  // Check if it's a new API photo name (starts with "places/")
  if (photoReference.startsWith('places/')) {
    return getNewAPIPhotoUrl(photoReference, maxWidth);
  }

  // Legacy API format (fallback for old data)
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert Google Place result to Activity type
 */
function convertGooglePlaceToActivity(
  place: GooglePlaceResult,
  userLocation: { latitude: number; longitude: number }
): Activity {
  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    place.geometry.location.lat,
    place.geometry.location.lng
  );

  const category = mapGoogleTypesToCategory(place.types);

  const activity: Activity = {
    id: place.place_id,
    name: place.name,
    category,
    description: '',
    location: {
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      address: place.formatted_address,
    },
    distance,
    rating: place.rating,
    reviewsCount: place.user_ratings_total,
    priceRange: place.price_level || 1,
    photoUrl: place.photos?.[0]
      ? getPlacePhotoUrl(place.photos[0].photo_reference)
      : undefined,
    googlePlaceId: place.place_id,
    isSponsored: false,
    sponsorTier: 'organic',
  };

  return activity;
}

/**
 * Convert New Places API result to Activity type
 */
function convertNewAPIPlaceToActivity(
  place: any,
  userLocation: { latitude: number; longitude: number }
): Activity {
  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    place.location.latitude,
    place.location.longitude
  );

  const category = mapGoogleTypesToCategory(place.types || []);

  const activity: Activity = {
    id: place.id,
    name: place.displayName?.text || place.name || 'Unknown Place',
    category,
    description: place.editorialSummary?.text || '',
    location: {
      latitude: place.location.latitude,
      longitude: place.location.longitude,
      address: place.formattedAddress || '',
    },
    distance,
    rating: place.rating || 0,
    reviewsCount: place.userRatingCount || 0,
    priceRange: place.priceLevel ? getPriceLevelFromNew(place.priceLevel) : 1,
    photoUrl: place.photos?.[0]?.name
      ? getNewAPIPhotoUrl(place.photos[0].name)
      : undefined,
    googlePlaceId: place.id,
    isSponsored: false,
    sponsorTier: 'organic',
  };

  return activity;
}

/**
 * Convert new API price level string to number
 */
function getPriceLevelFromNew(priceLevel: string): number {
  const mapping: Record<string, number> = {
    'PRICE_LEVEL_FREE': 0,
    'PRICE_LEVEL_INEXPENSIVE': 1,
    'PRICE_LEVEL_MODERATE': 2,
    'PRICE_LEVEL_EXPENSIVE': 3,
    'PRICE_LEVEL_VERY_EXPENSIVE': 3,
  };
  return mapping[priceLevel] || 1;
}

/**
 * Get photo URL from new API photo name
 */
function getNewAPIPhotoUrl(photoName: string, maxWidth: number = 800): string {
  if (!GOOGLE_PLACES_API_KEY || GOOGLE_PLACES_API_KEY === 'your_key_here') {
    return `https://via.placeholder.com/${maxWidth}x${Math.floor(maxWidth * 0.6)}`;
  }

  // New API photo URL format
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_PLACES_API_KEY}`;
}

/**
 * Map Google Place types to our activity categories
 */
function mapGoogleTypesToCategory(types: string[]): string {
  const categoryMap: Record<string, string> = {
    restaurant: 'Dining',
    cafe: 'Coffee',
    bar: 'Bars',
    night_club: 'Nightlife',
    gym: 'Fitness',
    park: 'Outdoor',
    museum: 'Culture',
    art_gallery: 'Arts',
    movie_theater: 'Entertainment',
    shopping_mall: 'Shopping',
    spa: 'Wellness',
    stadium: 'Sports',
    library: 'Education',
    tourist_attraction: 'Travel',
  };

  for (const type of types) {
    if (categoryMap[type]) {
      return categoryMap[type];
    }
  }

  return 'Other';
}

/**
 * getMockActivities() - REMOVED FOR PRODUCTION
 * This function has been removed to ensure production-ready code only uses real Google Places API data.
 */
