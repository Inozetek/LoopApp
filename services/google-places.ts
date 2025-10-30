import { Activity, GooglePlaceResult, GooglePlaceDetails, Location } from '@/types/activity';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
// New Places API (New) endpoints
const PLACES_API_BASE = 'https://places.googleapis.com/v1/places';

// Mock data for development/testing when API key is not configured
// Expanded dataset with 25 diverse activities across all categories, price ranges, and distances
const MOCK_ACTIVITIES: Activity[] = [
  // Coffee & Cafes (3)
  {
    id: 'mock-1',
    name: 'Blue Bottle Coffee',
    category: 'Coffee',
    description: 'Artisanal coffee roaster with minimalist cafes serving single-origin pour-overs',
    location: {
      latitude: 37.7749,
      longitude: -122.4194,
      address: '315 Linden St, San Francisco, CA 94102',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 0.8,
    rating: 4.5,
    reviewsCount: 1250,
    priceRange: 2,
    photoUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
    phone: '(415) 123-4567',
    isSponsored: false,
  },
  {
    id: 'mock-6',
    name: 'Sightglass Coffee',
    category: 'Coffee',
    description: 'Light-filled roastery and cafe with expertly crafted espresso drinks',
    location: {
      latitude: 37.7699,
      longitude: -122.4209,
      address: '270 7th St, San Francisco, CA 94103',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 0.5,
    rating: 4.6,
    reviewsCount: 2100,
    priceRange: 2,
    photoUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800',
    isSponsored: true,
    sponsorTier: 'boosted',
  },
  {
    id: 'mock-7',
    name: 'The Mill',
    category: 'Coffee',
    description: 'Iconic cafe famous for toast and house-roasted coffee',
    location: {
      latitude: 37.7767,
      longitude: -122.4376,
      address: '736 Divisadero St, San Francisco, CA 94117',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 1.2,
    rating: 4.4,
    reviewsCount: 1890,
    priceRange: 2,
    photoUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800',
    isSponsored: false,
  },

  // Dining & Restaurants (5)
  {
    id: 'mock-5',
    name: 'State Bird Provisions',
    category: 'Dining',
    description: 'Innovative small plates with California flair served dim sum style',
    location: {
      latitude: 37.7858,
      longitude: -122.4364,
      address: '1529 Fillmore St, San Francisco, CA 94115',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 1.1,
    rating: 4.7,
    reviewsCount: 2340,
    priceRange: 3,
    photoUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
    isSponsored: true,
    sponsorTier: 'boosted',
  },
  {
    id: 'mock-8',
    name: 'Nopa',
    category: 'Dining',
    description: 'Contemporary American comfort food in a lively neighborhood bistro',
    location: {
      latitude: 37.7747,
      longitude: -122.4376,
      address: '560 Divisadero St, San Francisco, CA 94117',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 1.3,
    rating: 4.6,
    reviewsCount: 1750,
    priceRange: 3,
    photoUrl: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800',
    isSponsored: false,
  },
  {
    id: 'mock-9',
    name: 'Tacolicious',
    category: 'Dining',
    description: 'Vibrant taqueria with craft cocktails and California-Mexican cuisine',
    location: {
      latitude: 37.7956,
      longitude: -122.4338,
      address: '2250 Chestnut St, San Francisco, CA 94123',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 2.1,
    rating: 4.5,
    reviewsCount: 1450,
    priceRange: 2,
    photoUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800',
    isSponsored: false,
  },
  {
    id: 'mock-10',
    name: 'Rich Table',
    category: 'Dining',
    description: 'Inventive new American cuisine in an intimate setting',
    location: {
      latitude: 37.7811,
      longitude: -122.4237,
      address: '199 Gough St, San Francisco, CA 94102',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 0.9,
    rating: 4.8,
    reviewsCount: 980,
    priceRange: 3,
    photoUrl: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800',
    isSponsored: true,
    sponsorTier: 'premium',
  },
  {
    id: 'mock-11',
    name: 'The Yard',
    category: 'Dining',
    description: 'Farm-to-table brunch spot with outdoor seating and healthy options',
    location: {
      latitude: 37.7694,
      longitude: -122.4216,
      address: '1 Ferry Building, San Francisco, CA 94111',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 1.5,
    rating: 4.4,
    reviewsCount: 720,
    priceRange: 2,
    photoUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
    isSponsored: false,
  },

  // Live Music & Entertainment (3)
  {
    id: 'mock-2',
    name: 'The Fillmore',
    category: 'Live Music',
    description: 'Historic music venue hosting legendary performances since 1912',
    location: {
      latitude: 37.7833,
      longitude: -122.4333,
      address: '1805 Geary Blvd, San Francisco, CA 94115',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 2.3,
    rating: 4.8,
    reviewsCount: 3420,
    priceRange: 2,
    photoUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800',
    isSponsored: true,
    sponsorTier: 'premium',
  },
  {
    id: 'mock-12',
    name: 'Great American Music Hall',
    category: 'Live Music',
    description: 'Ornate 1907 venue with balcony seating and eclectic lineup',
    location: {
      latitude: 37.7845,
      longitude: -122.4183,
      address: '859 O\'Farrell St, San Francisco, CA 94109',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 1.8,
    rating: 4.7,
    reviewsCount: 2100,
    priceRange: 2,
    photoUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    isSponsored: false,
  },
  {
    id: 'mock-13',
    name: 'The Chapel',
    category: 'Live Music',
    description: 'Intimate concert venue in a converted 1914 chapel',
    location: {
      latitude: 37.7489,
      longitude: -122.4194,
      address: '777 Valencia St, San Francisco, CA 94110',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 2.8,
    rating: 4.6,
    reviewsCount: 890,
    priceRange: 2,
    photoUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800',
    isSponsored: false,
  },

  // Fitness & Wellness (4)
  {
    id: 'mock-3',
    name: 'Yoga Flow Studio',
    category: 'Fitness',
    description: 'Welcoming yoga studio with classes for all levels and meditation',
    location: {
      latitude: 37.7694,
      longitude: -122.4862,
      address: '2150 Fillmore St, San Francisco, CA 94115',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 1.5,
    rating: 4.6,
    reviewsCount: 890,
    priceRange: 2,
    photoUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800',
    isSponsored: false,
  },
  {
    id: 'mock-14',
    name: 'Barry\'s Bootcamp',
    category: 'Fitness',
    description: 'High-intensity interval training in red-lit studio',
    location: {
      latitude: 37.7916,
      longitude: -122.4053,
      address: '2161 Union St, San Francisco, CA 94123',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 2.5,
    rating: 4.7,
    reviewsCount: 1230,
    priceRange: 3,
    photoUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800',
    isSponsored: true,
    sponsorTier: 'boosted',
  },
  {
    id: 'mock-15',
    name: 'The Pad Climbing',
    category: 'Fitness',
    description: 'Indoor bouldering gym with routes for all skill levels',
    location: {
      latitude: 37.7622,
      longitude: -122.4111,
      address: '1550 Bryant St, San Francisco, CA 94103',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 1.9,
    rating: 4.8,
    reviewsCount: 670,
    priceRange: 2,
    photoUrl: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800',
    isSponsored: false,
  },
  {
    id: 'mock-16',
    name: 'Equinox',
    category: 'Fitness',
    description: 'Premium fitness club with spa, pool, and personal training',
    location: {
      latitude: 37.7886,
      longitude: -122.4076,
      address: '2 Embarcadero Center, San Francisco, CA 94111',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 1.3,
    rating: 4.5,
    reviewsCount: 1580,
    priceRange: 3,
    photoUrl: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800',
    isSponsored: true,
    sponsorTier: 'premium',
  },

  // Outdoor & Parks (3)
  {
    id: 'mock-4',
    name: 'Golden Gate Park',
    category: 'Outdoor',
    description: 'Urban park with gardens, museums, and trails spanning 1,017 acres',
    location: {
      latitude: 37.7694,
      longitude: -122.4862,
      address: 'Golden Gate Park, San Francisco, CA 94122',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 3.2,
    rating: 4.9,
    reviewsCount: 12500,
    priceRange: 0,
    photoUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    isSponsored: false,
  },
  {
    id: 'mock-17',
    name: 'Lands End Trail',
    category: 'Outdoor',
    description: 'Coastal hiking trail with stunning ocean and Golden Gate Bridge views',
    location: {
      latitude: 37.7849,
      longitude: -122.5055,
      address: '680 Point Lobos Ave, San Francisco, CA 94121',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 4.5,
    rating: 4.9,
    reviewsCount: 5670,
    priceRange: 0,
    photoUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
    isSponsored: false,
  },
  {
    id: 'mock-18',
    name: 'Dolores Park',
    category: 'Outdoor',
    description: 'Popular hillside park with skyline views and vibrant community vibe',
    location: {
      latitude: 37.7596,
      longitude: -122.4269,
      address: '19th St & Dolores St, San Francisco, CA 94114',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 1.7,
    rating: 4.7,
    reviewsCount: 8900,
    priceRange: 0,
    photoUrl: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800',
    isSponsored: false,
  },

  // Arts & Culture (3)
  {
    id: 'mock-19',
    name: 'SFMOMA',
    category: 'Culture',
    description: 'Expansive modern art museum with rotating exhibitions',
    location: {
      latitude: 37.7857,
      longitude: -122.4011,
      address: '151 3rd St, San Francisco, CA 94103',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 0.6,
    rating: 4.6,
    reviewsCount: 4320,
    priceRange: 2,
    photoUrl: 'https://images.unsplash.com/photo-1514905552197-0610a4d8fd73?w=800',
    isSponsored: false,
  },
  {
    id: 'mock-20',
    name: 'de Young Museum',
    category: 'Culture',
    description: 'Fine arts museum in Golden Gate Park featuring American art',
    location: {
      latitude: 37.7712,
      longitude: -122.4687,
      address: '50 Hagiwara Tea Garden Dr, San Francisco, CA 94118',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 3.5,
    rating: 4.7,
    reviewsCount: 3890,
    priceRange: 2,
    photoUrl: 'https://images.unsplash.com/photo-1564399580075-5dfe19c205f3?w=800',
    isSponsored: true,
    sponsorTier: 'boosted',
  },
  {
    id: 'mock-21',
    name: 'The Exploratorium',
    category: 'Culture',
    description: 'Interactive science museum with hands-on exhibits at Pier 15',
    location: {
      latitude: 37.8018,
      longitude: -122.3976,
      address: 'Pier 15, San Francisco, CA 94111',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 2.2,
    rating: 4.8,
    reviewsCount: 6720,
    priceRange: 2,
    photoUrl: 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=800',
    isSponsored: false,
  },

  // Bars & Nightlife (2)
  {
    id: 'mock-22',
    name: 'Trick Dog',
    category: 'Bars',
    description: 'Inventive cocktails with themed menus in hip Mission District bar',
    location: {
      latitude: 37.7613,
      longitude: -122.4133,
      address: '3010 20th St, San Francisco, CA 94110',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 2.4,
    rating: 4.6,
    reviewsCount: 2340,
    priceRange: 2,
    photoUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
    isSponsored: false,
  },
  {
    id: 'mock-23',
    name: 'Top of the Mark',
    category: 'Bars',
    description: 'Iconic rooftop bar with 360-degree city views and live jazz',
    location: {
      latitude: 37.7921,
      longitude: -122.4104,
      address: '999 California St, San Francisco, CA 94108',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 1.6,
    rating: 4.5,
    reviewsCount: 1890,
    priceRange: 3,
    photoUrl: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800',
    isSponsored: true,
    sponsorTier: 'premium',
  },

  // Shopping & Unique (2)
  {
    id: 'mock-24',
    name: 'Ferry Building Marketplace',
    category: 'Shopping',
    description: 'Historic ferry terminal with artisan food vendors and farmers market',
    location: {
      latitude: 37.7956,
      longitude: -122.3933,
      address: '1 Ferry Building, San Francisco, CA 94111',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 1.8,
    rating: 4.7,
    reviewsCount: 9870,
    priceRange: 2,
    photoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
    isSponsored: false,
  },
  {
    id: 'mock-25',
    name: 'City Lights Bookstore',
    category: 'Shopping',
    description: 'Legendary independent bookstore and Beat Generation landmark',
    location: {
      latitude: 37.7977,
      longitude: -122.4076,
      address: '261 Columbus Ave, San Francisco, CA 94133',
      city: 'San Francisco',
      state: 'CA',
    },
    distance: 1.1,
    rating: 4.8,
    reviewsCount: 2670,
    priceRange: 1,
    photoUrl: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800',
    isSponsored: false,
  },
];

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
 * Get mock activities for testing
 */
export function getMockActivities(): Activity[] {
  return MOCK_ACTIVITIES;
}
