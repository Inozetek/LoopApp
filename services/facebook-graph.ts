/**
 * Facebook Graph API Service
 *
 * Handles Facebook OAuth with enhanced data import:
 * - Liked pages with EXACT place names (critical for +30 point boost)
 * - Facebook events (past/upcoming)
 * - Location data (city/home location)
 *
 * Strategy: Exact place name match = +30 points, category only = +15 points
 */

import { supabase } from '@/lib/supabase';
import type { FacebookData, FacebookLikedPlace } from '@/types/user';

// Facebook Graph API base URL
const GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Category mapping: Facebook page category → Loop activity category
 * Aligned with Google Places API categories
 */
const CATEGORY_MAPPING: Record<string, string> = {
  // Food & Drink
  'Restaurant': 'restaurant',
  'Cafe': 'cafe',
  'Coffee Shop': 'cafe',
  'Bar': 'bar',
  'Bakery': 'bakery',
  'Fast Food Restaurant': 'fast_food',
  'Food & Beverage': 'restaurant',
  'Pizza Place': 'restaurant',
  'Brewery': 'bar',
  'Wine Bar': 'bar',

  // Entertainment
  'Music Venue': 'live_music',
  'Concert Venue': 'live_music',
  'Theater': 'theater',
  'Movie Theater': 'movie_theater',
  'Comedy Club': 'comedy_club',
  'Night Club': 'nightclub',
  'Arts & Entertainment': 'entertainment',

  // Fitness & Recreation
  'Gym/Physical Fitness Center': 'gym',
  'Yoga Studio': 'gym',
  'Park': 'park',
  'Recreation & Fitness': 'gym',
  'Sports Venue': 'sports',

  // Shopping
  'Shopping Mall': 'shopping_mall',
  'Clothing Store': 'shopping',
  'Bookstore': 'bookstore',
  'Shopping & Retail': 'shopping',

  // Culture
  'Museum': 'museum',
  'Art Gallery': 'art_gallery',
  'Library': 'library',
  'Landmark': 'landmark',

  // Other
  'Event': 'event',
  'Community': 'community',
  'Local Business': 'local_business',
};

/**
 * Import Facebook data for a user
 * Called after Facebook OAuth login
 */
export async function importFacebookData(
  userId: string,
  accessToken: string
): Promise<{
  success: boolean;
  data?: FacebookData;
  error?: string;
}> {
  try {
    // Fetch liked pages (with place data)
    const likedPlaces = await fetchLikedPages(accessToken);

    // Fetch Facebook events
    const events = await fetchFacebookEvents(accessToken);

    // Fetch user location
    const location = await fetchUserLocation(accessToken);

    const facebookData: FacebookData = {
      liked_places: likedPlaces,
      events,
      location,
      last_synced: new Date().toISOString(),
    };

    // Save to database
    const { error } = await supabase
      .from('users')
      .update({ facebook_data: facebookData })
      .eq('id', userId);

    if (error) {
      console.error('Error saving Facebook data:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: facebookData };
  } catch (error) {
    console.error('Error importing Facebook data:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Fetch user's liked pages from Facebook
 * CRITICAL: Get EXACT place names for +30 point boost
 */
async function fetchLikedPages(
  accessToken: string
): Promise<FacebookLikedPlace[]> {
  try {
    const likedPlaces: FacebookLikedPlace[] = [];
    let url = `${GRAPH_API_URL}/me/likes?fields=id,name,category,location,about&access_token=${accessToken}&limit=100`;

    while (url) {
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        console.error('Facebook API error:', data.error);
        break;
      }

      // Process each liked page
      for (const page of data.data || []) {
        // Only include pages with location data (actual places)
        if (page.location) {
          const category = mapFacebookCategory(page.category);

          likedPlaces.push({
            name: page.name, // EXACT place name (e.g., "Blue Bottle Coffee Oakland")
            category,
            place_id: page.id,
            liked_at: new Date().toISOString(), // Facebook doesn't provide like timestamp
          });
        } else if (page.category) {
          // Non-place pages (brands, artists, etc.) - still useful for interests
          const category = mapFacebookCategory(page.category);
          if (category !== 'other') {
            likedPlaces.push({
              name: page.name,
              category,
              place_id: page.id,
            });
          }
        }
      }

      // Pagination
      url = data.paging?.next || null;
    }

    console.log(`Imported ${likedPlaces.length} liked pages from Facebook`);
    return likedPlaces;
  } catch (error) {
    console.error('Error fetching liked pages:', error);
    return [];
  }
}

/**
 * Fetch user's Facebook events (past and upcoming)
 */
async function fetchFacebookEvents(accessToken: string): Promise<any[]> {
  try {
    const events: any[] = [];
    const url = `${GRAPH_API_URL}/me/events?fields=id,name,description,start_time,end_time,place&access_token=${accessToken}&limit=100`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('Facebook API error:', data.error);
      return [];
    }

    for (const event of data.data || []) {
      events.push({
        id: event.id,
        name: event.name,
        start_time: event.start_time,
        end_time: event.end_time,
        place: event.place?.name,
        location: event.place?.location,
      });
    }

    console.log(`Imported ${events.length} events from Facebook`);
    return events;
  } catch (error) {
    console.error('Error fetching Facebook events:', error);
    return [];
  }
}

/**
 * Fetch user's location from Facebook profile
 */
async function fetchUserLocation(
  accessToken: string
): Promise<{ city?: string; state?: string; country?: string } | null> {
  try {
    const url = `${GRAPH_API_URL}/me?fields=location&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error || !data.location) {
      return null;
    }

    // Parse location string (e.g., "San Francisco, California")
    const locationParts = data.location.name.split(',').map((s: string) => s.trim());

    return {
      city: locationParts[0],
      state: locationParts[1],
      country: locationParts[2] || 'United States',
    };
  } catch (error) {
    console.error('Error fetching user location:', error);
    return null;
  }
}

/**
 * Map Facebook page category to Loop activity category
 */
function mapFacebookCategory(facebookCategory: string): string {
  // Exact match
  if (CATEGORY_MAPPING[facebookCategory]) {
    return CATEGORY_MAPPING[facebookCategory];
  }

  // Partial match (case-insensitive)
  const lowerCategory = facebookCategory.toLowerCase();
  for (const [fbCat, loopCat] of Object.entries(CATEGORY_MAPPING)) {
    if (lowerCategory.includes(fbCat.toLowerCase())) {
      return loopCat;
    }
  }

  // Default
  return 'other';
}

/**
 * Match Facebook liked place with Google Places activity
 * Returns match type: 'exact' (+30 points) or 'category' (+15 points)
 */
export function matchFacebookLikedPlace(
  likedPlace: FacebookLikedPlace,
  activityName: string,
  activityCategory: string
): { match: boolean; type: 'exact' | 'category' | null; boost: number } {
  // Normalize names for comparison
  const likedName = likedPlace.name.toLowerCase().trim();
  const activityNameLower = activityName.toLowerCase().trim();

  // EXACT name match (highest priority)
  if (likedName === activityNameLower) {
    return { match: true, type: 'exact', boost: 30 };
  }

  // Fuzzy exact match (allow minor variations)
  if (
    likedName.includes(activityNameLower) ||
    activityNameLower.includes(likedName)
  ) {
    return { match: true, type: 'exact', boost: 30 };
  }

  // Category match only
  if (likedPlace.category === activityCategory) {
    return { match: true, type: 'category', boost: 15 };
  }

  return { match: false, type: null, boost: 0 };
}

/**
 * Get all exact place name matches for boosting recommendations
 */
export function getExactPlaceMatches(
  facebookData: FacebookData,
  activityName: string
): FacebookLikedPlace[] {
  const activityNameLower = activityName.toLowerCase().trim();

  return facebookData.liked_places.filter((place) => {
    const placeName = place.name.toLowerCase().trim();
    return placeName === activityNameLower || placeName.includes(activityNameLower);
  });
}

/**
 * Get category matches (for activities user hasn't exactly liked before)
 */
export function getCategoryMatches(
  facebookData: FacebookData,
  category: string
): FacebookLikedPlace[] {
  return facebookData.liked_places.filter((place) => place.category === category);
}

/**
 * Refresh Facebook data (re-sync)
 */
export async function refreshFacebookData(
  userId: string,
  accessToken: string
): Promise<boolean> {
  const result = await importFacebookData(userId, accessToken);
  return result.success;
}

/**
 * Get Facebook OAuth URL for login
 * Note: This needs to be configured in Facebook App settings
 */
export function getFacebookOAuthURL(redirectUri: string): string {
  const appId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  const permissions = [
    'email',
    'user_location',
    'user_likes',
    'user_events',
  ].join(',');

  return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${permissions}&response_type=token`;
}

/**
 * Extract interests from Facebook data for onboarding pre-fill
 */
export function extractInterestsFromFacebook(
  facebookData: FacebookData
): string[] {
  const categoryCount: Record<string, number> = {};

  // Count category frequencies
  for (const place of facebookData.liked_places) {
    categoryCount[place.category] = (categoryCount[place.category] || 0) + 1;
  }

  // Sort by frequency and return top categories
  return Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category)
    .filter((cat) => cat !== 'other')
    .slice(0, 10); // Top 10 interests
}
