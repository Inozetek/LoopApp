/**
 * Google Places Service (IActivitySource Implementation)
 *
 * Wraps the existing Google Places API functions into a service that implements
 * the IActivitySource interface for multi-source integration.
 */

import type { IActivitySource } from './activity-source';
import type {
  UnifiedActivity,
  SearchParams,
  GooglePlaceResult,
  YelpDeal,
} from '@/types/activity';
import { searchNearbyPlaces } from './recommendations';
import { getPlaceDetails } from './google-places';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

/**
 * Extract time-sensitive deals from Google Places editorial summaries
 *
 * Example summaries:
 * - "Great happy hour from 4-7pm daily with half-price drinks"
 * - "Popular lunch spot with daily specials from 11am-2pm"
 * - "Live music on weekends"
 *
 * @param editorialSummary Editorial summary text from Google Places
 * @returns Array of extracted deals
 */
export function extractDealsFromEditorial(editorialSummary?: string): YelpDeal[] {
  if (!editorialSummary) return [];

  const deals: YelpDeal[] = [];
  const lowerText = editorialSummary.toLowerCase();

  // Detect happy hour mentions
  if (lowerText.includes('happy hour')) {
    // Try to extract time range (e.g., "4-7pm", "4pm-7pm", "16:00-19:00")
    const timeMatch = editorialSummary.match(/(\d{1,2})\s*(?::|am|pm)?\s*[-–]\s*(\d{1,2})\s*(am|pm)/i);

    if (timeMatch) {
      let startHour = parseInt(timeMatch[1]);
      let endHour = parseInt(timeMatch[2]);
      const period = timeMatch[3].toLowerCase();

      // Convert to 24-hour format if PM
      if (period === 'pm' && startHour < 12) startHour += 12;
      if (period === 'pm' && endHour < 12) endHour += 12;

      deals.push({
        id: 'happy_hour',
        title: 'Happy Hour',
        description: editorialSummary,
        time_start: `${startHour.toString().padStart(2, '0')}:00`,
        time_end: `${endHour.toString().padStart(2, '0')}:00`,
      });
    } else {
      // No specific time found, use default happy hour times (4-7pm)
      deals.push({
        id: 'happy_hour',
        title: 'Happy Hour',
        description: editorialSummary,
        time_start: '16:00',
        time_end: '19:00',
      });
    }
  }

  // Detect lunch special mentions
  if (lowerText.includes('lunch special') || lowerText.includes('lunch deal') || lowerText.includes('daily lunch')) {
    deals.push({
      id: 'lunch_special',
      title: 'Lunch Special',
      description: editorialSummary,
      time_start: '11:00',
      time_end: '14:00',
    });
  }

  // Detect brunch mentions
  if (lowerText.includes('brunch') && (lowerText.includes('weekend') || lowerText.includes('sunday'))) {
    deals.push({
      id: 'weekend_brunch',
      title: 'Weekend Brunch',
      description: editorialSummary,
      time_start: '10:00',
      time_end: '14:00',
      days: ['saturday', 'sunday'],
    });
  }

  // Detect live music mentions
  if (lowerText.includes('live music')) {
    const hasWeekend = lowerText.includes('weekend') || lowerText.includes('friday') || lowerText.includes('saturday');
    deals.push({
      id: 'live_music',
      title: 'Live Music',
      description: editorialSummary,
      time_start: '19:00',
      time_end: '23:00',
      days: hasWeekend ? ['friday', 'saturday', 'sunday'] : undefined,
    });
  }

  return deals;
}

/**
 * Google Places Service Implementation
 */
class GooglePlacesService implements IActivitySource {
  readonly name = 'google_places' as const;

  /**
   * Check if Google Places is available
   * Google Places is our primary source, so it's always considered available
   * (even if API key is missing, we want to show the error)
   */
  isAvailable(): boolean {
    return !!GOOGLE_PLACES_API_KEY && GOOGLE_PLACES_API_KEY !== 'your_key_here';
  }

  /**
   * Search for places near a location using Google Places API
   */
  async search(params: SearchParams): Promise<UnifiedActivity[]> {
    if (!this.isAvailable()) {
      console.warn('[GooglePlaces] Service not available (API key missing or invalid)');
      return [];
    }

    try {
      console.log('[GooglePlaces] Searching places...');

      // Map SearchParams to the format expected by searchNearbyPlaces
      const results = await searchNearbyPlaces({
        location: {
          lat: params.latitude,
          lng: params.longitude,
        },
        radius: params.radius || 8000,
        maxResults: params.limit || 20,
        includedTypes: this.mapInterestsToTypes(params.interests),
      });

      console.log(`[GooglePlaces] Found ${results.length} places`);

      // Convert PlaceResult[] to UnifiedActivity[]
      // Extract time-sensitive deals from editorial summaries
      const activities: UnifiedActivity[] = results.map(place => {
        // PlaceResult uses 'description' while GooglePlaceResult uses 'editorial_summary'
        const editorialSummary = (place as any).editorial_summary || (place as any).description;
        const extractedDeals = extractDealsFromEditorial(editorialSummary);

        if (extractedDeals.length > 0) {
          console.log(`[GooglePlaces] Extracted ${extractedDeals.length} deals from ${place.name}:`, extractedDeals.map(d => d.title).join(', '));
        }

        return {
          ...place,
          // Ensure required fields have values
          formatted_address: place.formatted_address || place.vicinity || '',
          editorial_summary: editorialSummary,
          source: 'google_places' as const,
          extractedDeals: extractedDeals.length > 0 ? extractedDeals : undefined,
          // Check for time-sensitive indicators
          hasHappyHour: extractedDeals.some(d => d.id === 'happy_hour'),
          hasLiveMusic: extractedDeals.some(d => d.id === 'live_music'),
          // event_metadata, yelp_metadata, etc. are undefined for Google Places
        };
      });

      return activities;
    } catch (error) {
      console.error('[GooglePlaces] Search failed:', error);
      return [];
    }
  }

  /**
   * Get place details by ID
   */
  async getDetails(id: string): Promise<UnifiedActivity | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const details = await getPlaceDetails(id);

      if (!details) {
        return null;
      }

      // Convert to UnifiedActivity
      const activity: UnifiedActivity = {
        ...details,
        source: 'google_places',
      };

      return activity;
    } catch (error) {
      console.error('[GooglePlaces] GetDetails failed:', error);
      return null;
    }
  }

  /**
   * Map Loop interest categories to Google Place types
   */
  private mapInterestsToTypes(interests?: string[]): string[] | undefined {
    if (!interests || interests.length === 0) {
      return undefined;
    }

    const typeMapping: Record<string, string> = {
      // Food & Drink
      dining: 'restaurant',
      food: 'restaurant',
      restaurants: 'restaurant',
      coffee: 'cafe',
      cafes: 'cafe',
      bars: 'bar',
      nightlife: 'night_club',

      // Fitness & Wellness
      fitness: 'gym',
      gyms: 'gym',
      wellness: 'spa',
      yoga: 'gym',

      // Outdoor & Recreation
      outdoor: 'park',
      parks: 'park',
      hiking: 'park',

      // Arts & Culture
      arts: 'art_gallery',
      culture: 'museum',
      museums: 'museum',
      theater: 'performing_arts_theater',

      // Entertainment
      entertainment: 'tourist_attraction',
      movies: 'movie_theater',

      // Shopping
      shopping: 'shopping_mall',
      fashion: 'clothing_store',

      // Music
      music: 'night_club',
      live_music: 'night_club',
      concerts: 'night_club',
    };

    const types: string[] = [];
    const seen = new Set<string>();

    for (const interest of interests) {
      const type = typeMapping[interest.toLowerCase()];
      if (type && !seen.has(type)) {
        types.push(type);
        seen.add(type);
      }
    }

    return types.length > 0 ? types : undefined;
  }
}

// Export singleton instance
export const googlePlacesService = new GooglePlacesService();

// Auto-register with the global activity source registry
// CRITICAL: This must happen immediately when module loads
import { activitySources } from './activity-source';

// Register Google Places service
activitySources.register(googlePlacesService);

console.log('[GooglePlacesService] Registered with activity source registry');
