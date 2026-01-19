/**
 * Google Timeline API Service
 *
 * Handles Google Timeline (Location History) data import:
 * - Fetch 6 months of visited places history
 * - Extract place names, visit counts, last visit dates
 * - Store in google_timeline JSONB field
 *
 * Strategy: Visited places = HIGH confidence signals
 * - High visit count (20+) = +35 point boost
 * - Medium visit count (6-20) = +25 point boost
 * - Low visit count (1-5) = +20 point boost
 */

import { supabase } from '@/lib/supabase';
import type { GoogleTimelineData, GoogleTimelinePlace } from '@/types/user';

// Google Timeline API (via Google Maps Platform)
const TIMELINE_API_URL = 'https://www.googleapis.com/geolocation/v1';

/**
 * Import Google Timeline data for a user
 * Called after Google OAuth with timeline scope
 */
export async function importGoogleTimeline(
  userId: string,
  accessToken: string
): Promise<{
  success: boolean;
  data?: GoogleTimelineData;
  error?: string;
}> {
  try {
    // Fetch location history for last 6 months
    const visitedPlaces = await fetchLocationHistory(accessToken);

    const timelineData: GoogleTimelineData = {
      visited_places: visitedPlaces,
      last_synced: new Date().toISOString(),
    };

    // Save to database
    const { error } = await supabase
      .from('users')
      .update({ google_timeline: timelineData })
      .eq('id', userId);

    if (error) {
      console.error('Error saving Google Timeline data:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: timelineData };
  } catch (error) {
    console.error('Error importing Google Timeline:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Fetch location history from Google Timeline
 * Returns aggregated visited places with visit counts
 */
async function fetchLocationHistory(
  accessToken: string
): Promise<GoogleTimelinePlace[]> {
  try {
    // Calculate date range (last 6 months)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    // Fetch location history using Google Timeline API
    // Note: This uses the semantic location history endpoint
    const url = `https://www.googleapis.com/v1/timeline/semanticLocationHistory?key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Google Timeline API error:', data.error);
      return [];
    }

    // Aggregate visits by place
    const placeVisits: Map<
      string,
      {
        name: string;
        category: string;
        lat: number;
        lng: number;
        visits: Date[];
      }
    > = new Map();

    // Parse timeline objects
    for (const obj of data.timelineObjects || []) {
      if (obj.placeVisit) {
        const visit = obj.placeVisit;
        const location = visit.location;

        if (!location?.placeId) continue;

        const placeId = location.placeId;
        const placeName = location.name || 'Unknown Place';
        const category = inferCategoryFromPlaceType(location.placeType);
        const lat = location.latLng?.latitude || 0;
        const lng = location.latLng?.longitude || 0;
        const visitTime = new Date(visit.duration?.startTimestamp);

        if (placeVisits.has(placeId)) {
          placeVisits.get(placeId)!.visits.push(visitTime);
        } else {
          placeVisits.set(placeId, {
            name: placeName,
            category,
            lat,
            lng,
            visits: [visitTime],
          });
        }
      }
    }

    // Convert to GoogleTimelinePlace array
    const visitedPlaces: GoogleTimelinePlace[] = [];

    for (const [placeId, data] of placeVisits.entries()) {
      // Filter out home/work (user sets these separately)
      if (data.name.toLowerCase().includes('home') ||
          data.name.toLowerCase().includes('work')) {
        continue;
      }

      // Only include places visited at least once
      if (data.visits.length > 0) {
        visitedPlaces.push({
          place_name: data.name,
          category: data.category,
          visit_count: data.visits.length,
          last_visit: data.visits.sort((a, b) => b.getTime() - a.getTime())[0].toISOString(),
          lat: data.lat,
          lng: data.lng,
        });
      }
    }

    // Sort by visit count (descending)
    visitedPlaces.sort((a, b) => b.visit_count - a.visit_count);

    console.log(`Imported ${visitedPlaces.length} visited places from Google Timeline`);
    return visitedPlaces;
  } catch (error) {
    console.error('Error fetching location history:', error);
    return [];
  }
}

/**
 * Infer Loop category from Google place type
 */
function inferCategoryFromPlaceType(placeType: string): string {
  const typeMapping: Record<string, string> = {
    'RESTAURANT': 'restaurant',
    'CAFE': 'cafe',
    'BAR': 'bar',
    'GYM': 'gym',
    'PARK': 'park',
    'MUSEUM': 'museum',
    'SHOPPING_MALL': 'shopping_mall',
    'GROCERY_STORE': 'grocery',
    'MOVIE_THEATER': 'movie_theater',
    'CONCERT_HALL': 'live_music',
    'STADIUM': 'sports',
    'LIBRARY': 'library',
    'THEATER': 'theater',
    'NIGHT_CLUB': 'nightclub',
  };

  return typeMapping[placeType] || 'other';
}

/**
 * Match Google Timeline visited place with recommendation
 * Returns boost amount based on visit frequency
 */
export function matchTimelineVisitedPlace(
  timelineData: GoogleTimelineData,
  activityName: string,
  activityCategory: string
): { match: boolean; boost: number; visitCount: number } {
  const activityNameLower = activityName.toLowerCase().trim();

  // Check for exact place name match
  for (const place of timelineData.visited_places) {
    const placeName = place.place_name.toLowerCase().trim();

    if (placeName === activityNameLower || placeName.includes(activityNameLower)) {
      // Exact place match - boost based on visit frequency
      let boost = 20;
      if (place.visit_count >= 20) {
        boost = 35; // Regular spot
      } else if (place.visit_count >= 6) {
        boost = 25; // Frequent visitor
      }

      return { match: true, boost, visitCount: place.visit_count };
    }
  }

  // Check for category frequency (recommend similar places)
  const categoryVisits = timelineData.visited_places.filter(
    (p) => p.category === activityCategory
  );

  if (categoryVisits.length > 0) {
    const totalCategoryVisits = categoryVisits.reduce(
      (sum, p) => sum + p.visit_count,
      0
    );

    let boost = 10;
    if (totalCategoryVisits >= 10) {
      boost = 20; // Frequently visits this category
    } else if (totalCategoryVisits >= 5) {
      boost = 15; // Moderate category interest
    }

    return { match: true, boost, visitCount: totalCategoryVisits };
  }

  return { match: false, boost: 0, visitCount: 0 };
}

/**
 * Get most visited places (for showing user their patterns)
 */
export function getMostVisitedPlaces(
  timelineData: GoogleTimelineData,
  limit: number = 10
): GoogleTimelinePlace[] {
  return timelineData.visited_places
    .sort((a, b) => b.visit_count - a.visit_count)
    .slice(0, limit);
}

/**
 * Get favorite categories based on visit frequency
 */
export function getFavoriteCategories(
  timelineData: GoogleTimelineData
): Array<{ category: string; visitCount: number }> {
  const categoryVisits: Record<string, number> = {};

  for (const place of timelineData.visited_places) {
    categoryVisits[place.category] =
      (categoryVisits[place.category] || 0) + place.visit_count;
  }

  return Object.entries(categoryVisits)
    .map(([category, visitCount]) => ({ category, visitCount }))
    .sort((a, b) => b.visitCount - a.visitCount)
    .filter((item) => item.category !== 'other');
}

/**
 * Refresh Google Timeline data (re-sync)
 */
export async function refreshGoogleTimeline(
  userId: string,
  accessToken: string
): Promise<boolean> {
  const result = await importGoogleTimeline(userId, accessToken);
  return result.success;
}

/**
 * Get Google OAuth scopes needed for Timeline access
 */
export function getRequiredGoogleScopes(): string[] {
  return [
    'email',
    'profile',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/gmail.metadata',
    'https://www.googleapis.com/auth/timeline', // Location History / Timeline
  ];
}

/**
 * Extract interests from Google Timeline for onboarding pre-fill
 */
export function extractInterestsFromTimeline(
  timelineData: GoogleTimelineData
): string[] {
  const categories = getFavoriteCategories(timelineData);

  return categories
    .map((item) => item.category)
    .filter((cat) => cat !== 'other')
    .slice(0, 10); // Top 10 interests
}

/**
 * Detect if user frequently visits a specific place (could be work or favorite spot)
 */
export function detectFrequentLocations(
  timelineData: GoogleTimelineData,
  minVisits: number = 10
): GoogleTimelinePlace[] {
  return timelineData.visited_places.filter(
    (place) => place.visit_count >= minVisits
  );
}

/**
 * Calculate freshness factor (prefer recent visits)
 */
export function calculateFreshnessFactor(lastVisit: string): number {
  const lastVisitDate = new Date(lastVisit);
  const now = new Date();
  const daysSinceVisit = Math.floor(
    (now.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceVisit <= 7) {
    return 1.2; // Recent visit - 20% boost
  } else if (daysSinceVisit <= 30) {
    return 1.1; // Within last month - 10% boost
  } else if (daysSinceVisit <= 90) {
    return 1.0; // Within 3 months - no change
  } else {
    return 0.9; // Old visit - 10% penalty
  }
}

/**
 * Recommend similar places to frequently visited ones
 * (Don't recommend the exact same place they already know about)
 */
export function shouldRecommendSimilarPlace(
  timelineData: GoogleTimelineData,
  activityName: string,
  activityCategory: string
): { recommend: boolean; reason: string } {
  const activityNameLower = activityName.toLowerCase().trim();

  // Check if user already visits this exact place frequently
  const exactMatch = timelineData.visited_places.find((place) => {
    const placeName = place.place_name.toLowerCase().trim();
    return placeName === activityNameLower || placeName.includes(activityNameLower);
  });

  if (exactMatch && exactMatch.visit_count >= 5) {
    return {
      recommend: false,
      reason: `User already visits this place frequently (${exactMatch.visit_count} times)`,
    };
  }

  // Check if user frequently visits similar category
  const categoryVisits = timelineData.visited_places.filter(
    (p) => p.category === activityCategory
  );

  const totalCategoryVisits = categoryVisits.reduce(
    (sum, p) => sum + p.visit_count,
    0
  );

  if (totalCategoryVisits >= 10) {
    return {
      recommend: true,
      reason: `User frequently visits ${activityCategory} (${totalCategoryVisits} times total)`,
    };
  }

  return { recommend: true, reason: 'New category for user' };
}
