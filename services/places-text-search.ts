/**
 * Google Places Text Search — Shared Service
 *
 * Extracted from recommendations.ts for reuse by:
 * - Recommendation feed (existing)
 * - Radar keyword matching (new)
 * - Explore search (future)
 *
 * Uses POST https://places.googleapis.com/v1/places:searchText
 * Cost: ~$32 per 1000 requests
 */

import type { PlaceLocation, PlaceResult } from './places-common';

export interface TextSearchParams {
  query: string;
  location: PlaceLocation;
  radius: number;
  maxResults?: number;
}

export interface TextSearchResult extends PlaceResult {
  // Additional fields useful for radar matching
  editorialSummary?: string;
}

/**
 * Search Google Places using Text Search API.
 * Includes rate limiting and cost control.
 */
export async function searchPlacesByText(params: TextSearchParams): Promise<PlaceResult[]> {
  // COST CONTROL: Block API calls if disabled
  if (process.env.EXPO_PUBLIC_DISABLE_GOOGLE_PLACES_API === 'true') {
    console.warn('[PlacesTextSearch] API disabled (cost control) — returning empty results.');
    return [];
  }

  const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!API_KEY) {
    console.error('[PlacesTextSearch] Google Places API key not configured');
    return [];
  }

  const { query, location, radius, maxResults = 20 } = params;

  try {
    // Track API usage BEFORE making request
    const { trackPlacesAPIRequest } = await import('@/utils/api-cost-tracker');
    const allowRequest = await trackPlacesAPIRequest('text_search');

    if (!allowRequest) {
      console.warn('[PlacesTextSearch] API request blocked — free tier limit reached.');
      return [];
    }

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
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
            radius,
          },
        },
        maxResultCount: Math.min(maxResults, 20),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PlacesTextSearch] API error:', response.status, errorText);
      return [];
    }

    const data = await response.json();

    // Convert new API format to PlaceResult
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
      price_level: place.priceLevel || 0,
      photos: place.photos?.map((photo: any) => ({
        photo_reference: photo.name || '',
      })) || [],
      opening_hours: {
        open_now: place.currentOpeningHours?.openNow ?? true,
      },
      source: 'google_places' as const,
    }));

    return places;
  } catch (error) {
    console.error('[PlacesTextSearch] Error:', error);
    return [];
  }
}
