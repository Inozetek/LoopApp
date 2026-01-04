/**
 * Google Places API Service
 * Fetches real-world activities, venues, and businesses near user's location
 */

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export interface PlaceLocation {
  lat: number;
  lng: number;
}

export interface PlacePhoto {
  photo_reference: string;
  height: number;
  width: number;
  html_attributions: string[];
}

export interface PlaceResult {
  place_id: string;
  name: string;
  vicinity?: string;
  formatted_address?: string;
  geometry: {
    location: PlaceLocation;
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number; // 0-4 (0 = Free, 1 = $, 2 = $$, 3 = $$$, 4 = $$$$)
  types: string[];
  photos?: PlacePhoto[];
  opening_hours?: {
    open_now?: boolean;
  };
  business_status?: string;
}

export interface PlaceDetails extends PlaceResult {
  formatted_phone_number?: string;
  website?: string;
  url?: string;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  reviews?: {
    author_name: string;
    rating: number;
    text: string;
    time: number;
  }[];
}

export interface NearbySearchParams {
  location: PlaceLocation;
  radius: number; // meters (max 50000)
  type?: string; // e.g., "restaurant", "cafe", "gym"
  keyword?: string; // e.g., "coffee", "live music"
  minRating?: number; // 0-5
  openNow?: boolean;
  maxResults?: number;
}

/**
 * Search for nearby places using Google Places API
 * Docs: https://developers.google.com/maps/documentation/places/web-service/search-nearby
 */
export async function searchNearbyPlaces(
  params: NearbySearchParams
): Promise<PlaceResult[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.error('❌ Google Places API key not configured. Cannot fetch places.');
    throw new Error('Google Places API key is required. Please set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in your environment.');
  }

  try {
    const {
      location,
      radius,
      type,
      keyword,
      openNow = false,
      maxResults = 20,
    } = params;

    const allResults: PlaceResult[] = [];
    let nextPageToken: string | undefined;
    let pageCount = 0;
    const maxPages = Math.ceil(maxResults / 20); // Each page returns ~20 results

    console.log(`🔍 Fetching up to ${maxResults} places (${maxPages} pages max):`, { location, radius, type, keyword });

    // Fetch multiple pages until we have enough results or run out of pages
    while (allResults.length < maxResults && pageCount < maxPages) {
      // Build API URL
      const baseUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
      const queryParams = new URLSearchParams({
        location: `${location.lat},${location.lng}`,
        radius: radius.toString(),
        key: GOOGLE_PLACES_API_KEY,
      });

      if (type) queryParams.append('type', type);
      if (keyword) queryParams.append('keyword', keyword);
      if (openNow) queryParams.append('opennow', 'true');
      if (nextPageToken) queryParams.append('pagetoken', nextPageToken);

      const url = `${baseUrl}?${queryParams.toString()}`;

      // IMPORTANT: Google requires a short delay between pagination requests
      if (nextPageToken && pageCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK') {
        allResults.push(...(data.results as PlaceResult[]));
        nextPageToken = data.next_page_token;
        pageCount++;
        console.log(`📄 Page ${pageCount}: Found ${data.results.length} places (${allResults.length} total so far)`);

        // If no next page token, we've reached the end
        if (!nextPageToken) {
          console.log(`✅ No more pages available (fetched all ${allResults.length} places)`);
          break;
        }
      } else if (data.status === 'ZERO_RESULTS') {
        console.log('ℹ️ No places found matching criteria');
        break;
      } else if (data.status === 'INVALID_REQUEST' && nextPageToken) {
        // Next page token might have expired, stop pagination
        console.warn('⚠️ Next page token expired, stopping pagination');
        break;
      } else {
        console.error('❌ Google Places API error:', data.status, data.error_message);
        // Return whatever results we have, even if empty
        break;
      }
    }

    // Return up to maxResults
    const finalResults = allResults.slice(0, maxResults);
    console.log(`✅ Returning ${finalResults.length} places (requested ${maxResults})`);
    return finalResults;
  } catch (error) {
    console.error('❌ Error fetching nearby places:', error);
    // Return empty array instead of mock data
    return [];
  }
}

/**
 * Get detailed information about a specific place
 * Docs: https://developers.google.com/maps/documentation/places/web-service/details
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('Google Places API key not configured.');
    return null;
  }

  try {
    const baseUrl = 'https://maps.googleapis.com/maps/api/place/details/json';
    const queryParams = new URLSearchParams({
      place_id: placeId,
      key: GOOGLE_PLACES_API_KEY,
      fields: 'name,formatted_address,formatted_phone_number,website,url,geometry,rating,user_ratings_total,price_level,photos,opening_hours,reviews,types',
    });

    const url = `${baseUrl}?${queryParams.toString()}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK') {
      return data.result as PlaceDetails;
    } else {
      console.error('Google Places Details API error:', data.status, data.error_message);
      return null;
    }
  } catch (error) {
    console.error('Error fetching place details:', error);
    return null;
  }
}

/**
 * Get photo URL from photo reference
 * Docs: https://developers.google.com/maps/documentation/places/web-service/photos
 */
export function getPlacePhotoUrl(
  photoReference: string,
  maxWidth: number = 400
): string {
  if (!GOOGLE_PLACES_API_KEY) {
    return 'https://via.placeholder.com/400x300?text=No+Image';
  }

  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in miles
 */
export function calculateDistance(
  point1: PlaceLocation,
  point2: PlaceLocation
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(point2.lat - point1.lat);
  const dLng = toRad(point2.lng - point1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) *
      Math.cos(toRad(point2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Map Google Place types to Loop activity categories
 */
export function mapPlaceTypeToCategory(types: string[]): string {
  const typeMapping: Record<string, string> = {
    // Food & Dining
    restaurant: 'dining',
    cafe: 'coffee',
    bar: 'nightlife',
    bakery: 'dining',
    meal_delivery: 'dining',
    meal_takeaway: 'dining',

    // Entertainment
    movie_theater: 'movies',
    night_club: 'nightlife',
    bowling_alley: 'entertainment',
    amusement_park: 'entertainment',
    aquarium: 'entertainment',
    art_gallery: 'art',
    museum: 'culture',

    // Recreation
    park: 'outdoors',
    gym: 'fitness',
    spa: 'wellness',
    campground: 'outdoors',
    hiking_area: 'hiking',

    // Shopping
    shopping_mall: 'shopping',
    clothing_store: 'shopping',
    book_store: 'books',

    // Culture
    library: 'culture',
    tourist_attraction: 'sightseeing',
    stadium: 'sports',
  };

  // Find first matching type
  for (const type of types) {
    if (typeMapping[type]) {
      return typeMapping[type];
    }
  }

  // Default to 'other'
  return 'other';
}

/**
 * Get price range string from price_level
 */
export function getPriceRangeString(priceLevel?: number): string {
  if (priceLevel === undefined || priceLevel === null) return 'Price varies';

  const priceMap: Record<number, string> = {
    0: 'Free',
    1: '$',
    2: '$$',
    3: '$$$',
    4: '$$$$',
  };

  return priceMap[priceLevel] || 'Price varies';
}

/**
 * Mock places data - REMOVED FOR PRODUCTION
 * This function has been removed to ensure production-ready code only uses real Google Places API data.
 * No mock data fallbacks are allowed in production.
 */

/**
 * Search for places by text query (alternative to nearby search)
 * Useful for specific searches like "coffee shops near me"
 */
export async function textSearch(query: string, location?: PlaceLocation): Promise<PlaceResult[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('Google Places API key not configured.');
    return [];
  }

  try {
    const baseUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
    const queryParams = new URLSearchParams({
      query,
      key: GOOGLE_PLACES_API_KEY,
    });

    if (location) {
      queryParams.append('location', `${location.lat},${location.lng}`);
      queryParams.append('radius', '5000'); // 5km default
    }

    const url = `${baseUrl}?${queryParams.toString()}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK') {
      return data.results as PlaceResult[];
    } else {
      console.error('Google Places Text Search error:', data.status);
      return [];
    }
  } catch (error) {
    console.error('Error in text search:', error);
    return [];
  }
}
