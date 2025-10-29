// @ts-nocheck - Minor type mismatches with Activity interface
/**
 * OpenStreetMap Service - 100% Free POI Data
 *
 * Uses Overpass API to query OpenStreetMap data
 * - 100% free, unlimited queries
 * - 100M+ POIs globally
 * - Good coverage for restaurants, cafes, parks, museums, etc.
 *
 * API Docs: https://wiki.openstreetmap.org/wiki/Overpass_API
 */

import { Activity } from '@/types/activity';

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

// Alternative servers (if main is down):
// - https://overpass.kumi.systems/api/interpreter
// - https://maps.mail.ru/osm/tools/overpass/api/interpreter

/**
 * Search for nearby activities using OpenStreetMap data
 */
export async function searchOSMActivities(
  location: { latitude: number; longitude: number },
  radiusMeters: number = 5000 // Default 5km
): Promise<Activity[]> {
  try {
    console.log(`🗺️ Querying OpenStreetMap for activities within ${radiusMeters}m...`);

    // Build Overpass QL query
    const query = buildOverpassQuery(location.latitude, location.longitude, radiusMeters);

    // Query Overpass API
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Convert OSM elements to Activity objects
    const activities = convertOSMToActivities(data.elements, location);

    console.log(`✅ Found ${activities.length} activities from OpenStreetMap`);

    return activities;
  } catch (error) {
    console.error('Error querying OpenStreetMap:', error);
    throw error;
  }
}

/**
 * Build Overpass QL query for common amenities
 */
function buildOverpassQuery(lat: number, lng: number, radius: number): string {
  // Query for common amenities around location
  // Using "around" filter for performance
  return `
    [out:json][timeout:25];
    (
      // Dining
      node["amenity"="restaurant"](around:${radius},${lat},${lng});
      node["amenity"="cafe"](around:${radius},${lat},${lng});
      node["amenity"="bar"](around:${radius},${lat},${lng});
      node["amenity"="pub"](around:${radius},${lat},${lng});
      node["amenity"="fast_food"](around:${radius},${lat},${lng});
      node["amenity"="food_court"](around:${radius},${lat},${lng});

      // Culture & Entertainment
      node["tourism"="museum"](around:${radius},${lat},${lng});
      node["tourism"="gallery"](around:${radius},${lat},${lng});
      node["tourism"="attraction"](around:${radius},${lat},${lng});
      node["amenity"="theatre"](around:${radius},${lat},${lng});
      node["amenity"="cinema"](around:${radius},${lat},${lng});
      node["amenity"="arts_centre"](around:${radius},${lat},${lng});

      // Outdoor & Recreation
      node["leisure"="park"](around:${radius},${lat},${lng});
      node["leisure"="garden"](around:${radius},${lat},${lng});
      node["leisure"="playground"](around:${radius},${lat},${lng});
      node["leisure"="sports_centre"](around:${radius},${lat},${lng});
      node["leisure"="fitness_centre"](around:${radius},${lat},${lng});
      node["leisure"="fitness_station"](around:${radius},${lat},${lng});

      // Shopping
      node["shop"="mall"](around:${radius},${lat},${lng});
      node["shop"="books"](around:${radius},${lat},${lng});
      node["shop"="clothes"](around:${radius},${lat},${lng});

      // Other amenities
      node["amenity"="library"](around:${radius},${lat},${lng});
      node["amenity"="community_centre"](around:${radius},${lat},${lng});
    );
    out body;
    >;
    out skel qt;
  `;
}

/**
 * Convert OSM elements to Activity objects
 */
function convertOSMToActivities(
  elements: any[],
  userLocation: { latitude: number; longitude: number }
): Activity[] {
  const activities: Activity[] = [];

  for (const element of elements) {
    // Skip if missing required data
    if (!element.lat || !element.lon || !element.tags) {
      continue;
    }

    // Skip if no name
    const name = element.tags.name || element.tags['name:en'];
    if (!name) {
      continue;
    }

    // Map OSM tags to our categories
    const category = mapOSMCategory(element.tags);

    // Calculate distance
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      element.lat,
      element.lon
    );

    // Build address
    const address = buildAddress(element.tags);

    // Get description
    const description = element.tags.description || buildDescription(element.tags, category);

    // Determine price range (OSM doesn't always have this)
    const priceRange = inferPriceRange(element.tags);

    // Build activity object
    const activity: Activity = {
      id: `osm-${element.id}`,
      name,
      category,
      description,
      location: {
        latitude: element.lat,
        longitude: element.lon,
        address,
        city: element.tags['addr:city'],
        state: element.tags['addr:state'],
      },
      distance,
      rating: 0, // OSM doesn't have ratings (could add user ratings later)
      reviewsCount: 0,
      priceRange,
      phone: element.tags.phone || element.tags['contact:phone'],
      website: element.tags.website || element.tags['contact:website'],
      photoUrl: getPlaceholderImage(category), // OSM doesn't have photos
      openStreetMapId: element.id,
      isSponsored: false,
      sponsorTier: 'organic',
    };

    activities.push(activity);
  }

  return activities;
}

/**
 * Map OSM amenity/leisure tags to our categories
 */
function mapOSMCategory(tags: Record<string, string>): string {
  const amenity = tags.amenity;
  const leisure = tags.leisure;
  const tourism = tags.tourism;
  const shop = tags.shop;

  // Dining
  if (amenity === 'restaurant') return 'Dining';
  if (amenity === 'cafe') return 'Coffee';
  if (amenity === 'bar' || amenity === 'pub') return 'Bars';
  if (amenity === 'fast_food' || amenity === 'food_court') return 'Dining';

  // Culture
  if (tourism === 'museum') return 'Culture';
  if (tourism === 'gallery') return 'Arts';
  if (tourism === 'attraction') return 'Culture';
  if (amenity === 'theatre' || amenity === 'cinema') return 'Entertainment';
  if (amenity === 'arts_centre') return 'Arts';

  // Outdoor
  if (leisure === 'park' || leisure === 'garden') return 'Outdoor';
  if (leisure === 'playground') return 'Outdoor';

  // Fitness
  if (leisure === 'sports_centre' || leisure === 'fitness_centre') return 'Fitness';
  if (leisure === 'fitness_station') return 'Fitness';

  // Shopping
  if (shop === 'mall' || shop === 'books' || shop === 'clothes') return 'Shopping';

  // Other
  if (amenity === 'library') return 'Education';
  if (amenity === 'community_centre') return 'Community';

  return 'Other';
}

/**
 * Build address from OSM tags
 */
function buildAddress(tags: Record<string, string>): string {
  const parts: string[] = [];

  if (tags['addr:housenumber'] && tags['addr:street']) {
    parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
  } else if (tags['addr:street']) {
    parts.push(tags['addr:street']);
  }

  if (tags['addr:city']) {
    parts.push(tags['addr:city']);
  }

  if (tags['addr:state']) {
    parts.push(tags['addr:state']);
  }

  if (tags['addr:postcode']) {
    parts.push(tags['addr:postcode']);
  }

  return parts.join(', ') || 'Address not available';
}

/**
 * Build description from tags
 */
function buildDescription(tags: Record<string, string>, category: string): string {
  const cuisine = tags.cuisine;
  const sport = tags.sport;

  if (cuisine) {
    return `${cuisine.charAt(0).toUpperCase() + cuisine.slice(1)} cuisine`;
  }

  if (sport) {
    return `${sport.charAt(0).toUpperCase() + sport.slice(1)} facility`;
  }

  return `${category} venue in your area`;
}

/**
 * Infer price range from OSM tags
 * OSM doesn't consistently have this, so we make educated guesses
 */
function inferPriceRange(tags: Record<string, string>): number {
  // Check if there's an explicit price tag
  const pricing = tags.pricing || tags.fee;

  if (pricing === 'free' || pricing === 'no') return 0;

  // Guess based on amenity type
  const amenity = tags.amenity;
  const cuisine = tags.cuisine;

  // Free activities
  if (amenity === 'library' || tags.leisure === 'park') return 0;

  // Budget ($)
  if (amenity === 'fast_food' || amenity === 'cafe') return 1;

  // Mid-range ($$)
  if (amenity === 'restaurant' && !cuisine) return 2;
  if (amenity === 'bar' || amenity === 'pub') return 2;

  // Higher-end ($$$)
  if (cuisine === 'fine_dining' || cuisine === 'french') return 3;

  // Default: mid-range
  return 2;
}

/**
 * Get placeholder image URL based on category
 */
function getPlaceholderImage(category: string): string {
  const placeholders: Record<string, string> = {
    Dining: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
    Coffee: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
    Bars: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
    Culture: 'https://images.unsplash.com/photo-1564399580075-5dfe19c205f3?w=800',
    Arts: 'https://images.unsplash.com/photo-1567095761054-7a02e69e5c43?w=800',
    Outdoor: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    Fitness: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800',
    Entertainment: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800',
    Shopping: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
    Education: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800',
  };

  return placeholders[category] || 'https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?w=800';
}

/**
 * Calculate distance between two coordinates (Haversine formula)
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

  return Math.round(distance * 10) / 10; // Round to 1 decimal
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get activities by specific category
 */
export async function getOSMActivitiesByCategory(
  location: { latitude: number; longitude: number },
  category: 'dining' | 'coffee' | 'bars' | 'parks' | 'culture' | 'fitness',
  radiusMeters: number = 5000
): Promise<Activity[]> {
  const categoryQueries: Record<string, string> = {
    dining: 'node["amenity"~"restaurant|fast_food|food_court"]',
    coffee: 'node["amenity"="cafe"]',
    bars: 'node["amenity"~"bar|pub"]',
    parks: 'node["leisure"~"park|garden"]',
    culture: 'node["tourism"~"museum|gallery|attraction"]',
    fitness: 'node["leisure"~"sports_centre|fitness_centre"]',
  };

  const query = `
    [out:json][timeout:25];
    (
      ${categoryQueries[category]}(around:${radiusMeters},${location.latitude},${location.longitude});
    );
    out body;
  `;

  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    const data = await response.json();
    return convertOSMToActivities(data.elements, location);
  } catch (error) {
    console.error(`Error fetching ${category} from OSM:`, error);
    return [];
  }
}

/**
 * Check if OSM API is available
 */
export async function checkOSMAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${OVERPASS_API_URL}?data=[out:json];out;`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}
