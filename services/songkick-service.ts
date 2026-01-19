/**
 * Songkick API Integration
 *
 * Provides access to live music events and concerts including:
 * - Small venue shows (bars, clubs, local venues)
 * - Touring bands and local artists
 * - Music festivals
 * - Concert lineup information
 *
 * Complements Ticketmaster by covering smaller venues and indie artists.
 *
 * API Limits (Free Tier):
 * - 5,000 requests per day
 * - No per-second rate limit
 *
 * Documentation: https://www.songkick.com/developer/
 */

import { IActivitySource, activitySources } from './activity-source';
import type { UnifiedActivity, SearchParams, SongkickMetadata, EventMetadata } from '@/types/activity';
import { FEATURE_FLAGS } from '@/constants/feature-flags';

const SONGKICK_API_KEY = process.env.EXPO_PUBLIC_SONGKICK_API_KEY;
const SONGKICK_API_BASE = 'https://api.songkick.com/api/3.0';

/**
 * Songkick Event response type
 */
interface SongkickEvent {
  id: number;
  displayName: string;
  type: 'Concert' | 'Festival';
  uri: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  start: {
    date: string; // YYYY-MM-DD
    time: string; // HH:MM:SS
    datetime: string; // ISO 8601
  };
  performance: Array<{
    artist: {
      displayName: string;
      uri: string;
    };
    billing: 'headline' | 'support';
  }>;
  location: {
    city: string;
    lat: number;
    lng: number;
  };
  venue: {
    id: number;
    displayName: string;
    lat?: number;
    lng?: number;
  };
}

/**
 * Songkick API search response
 */
interface SongkickSearchResponse {
  resultsPage: {
    status: string;
    results: {
      event?: SongkickEvent[];
    };
    totalEntries: number;
    perPage: number;
    page: number;
  };
}

class SongkickService implements IActivitySource {
  readonly name = 'songkick' as const;

  /**
   * Check if Songkick integration is available
   */
  isAvailable(): boolean {
    const featureFlagEnabled = FEATURE_FLAGS.ENABLE_SONGKICK;
    const apiKeyPresent = !!SONGKICK_API_KEY && SONGKICK_API_KEY !== 'your_key_here';

    if (!featureFlagEnabled) {
      console.log('[Songkick] Feature flag ENABLE_SONGKICK is disabled');
    }

    if (!apiKeyPresent) {
      console.log('[Songkick] API key not configured or invalid');
    }

    return featureFlagEnabled && apiKeyPresent;
  }

  /**
   * Search for concerts near a location
   */
  async search(params: SearchParams): Promise<UnifiedActivity[]> {
    if (!this.isAvailable()) {
      console.log('[Songkick] Service not available');
      return [];
    }

    try {
      const { latitude, longitude } = params;

      console.log('[Songkick] Searching with params:', {
        lat: latitude,
        lng: longitude,
      });

      // Build URL with query parameters
      // Songkick uses "geo:" location format
      const searchParams = new URLSearchParams({
        apikey: SONGKICK_API_KEY!,
        location: `geo:${latitude},${longitude}`,
        per_page: '20',
      });

      const url = `${SONGKICK_API_BASE}/events.json?${searchParams.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Songkick] API error:', response.status, errorText);
        return [];
      }

      const data: SongkickSearchResponse = await response.json();
      const events = data.resultsPage?.results?.event || [];

      console.log(`[Songkick] Found ${events.length} events`);

      // Filter for confirmed events only, transform to UnifiedActivity
      const activities = events
        .filter(event => event.status === 'confirmed')
        .map(event => this.transformToUnifiedActivity(event))
        .filter((activity): activity is UnifiedActivity => activity !== null);

      return activities;
    } catch (error) {
      console.error('[Songkick] Search error:', error);
      return [];
    }
  }

  /**
   * Get details for a specific event
   * Note: Songkick search already returns full event data, so this may not be needed
   */
  async getDetails(id: string): Promise<UnifiedActivity | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const searchParams = new URLSearchParams({
        apikey: SONGKICK_API_KEY!,
      });

      const url = `${SONGKICK_API_BASE}/events/${id}.json?${searchParams.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        console.error('[Songkick] getDetails error:', response.status);
        return null;
      }

      const data: SongkickSearchResponse = await response.json();
      const event = data.resultsPage?.results?.event?.[0];

      if (!event) {
        return null;
      }

      return this.transformToUnifiedActivity(event);
    } catch (error) {
      console.error('[Songkick] getDetails error:', error);
      return null;
    }
  }

  /**
   * Transform Songkick event to UnifiedActivity
   */
  private transformToUnifiedActivity(event: SongkickEvent): UnifiedActivity | null {
    // Skip cancelled or tentative events
    if (event.status !== 'confirmed') {
      console.log(`[Songkick] Skipping ${event.status} event: ${event.displayName}`);
      return null;
    }

    // Extract headline artists (primary performers)
    const headlineArtists = event.performance
      .filter(p => p.billing === 'headline')
      .map(p => p.artist.displayName);

    // Use venue location if available, fallback to city location
    const lat = event.venue.lat || event.location.lat;
    const lng = event.venue.lng || event.location.lng;

    if (!lat || !lng) {
      console.warn(`[Songkick] Skipping event without coordinates: ${event.displayName}`);
      return null;
    }

    // Parse start time
    const startDateTime = new Date(event.start.datetime);

    // Build UnifiedActivity
    const activity: UnifiedActivity = {
      place_id: `songkick_${event.id}`,
      source: 'songkick',
      name: event.displayName,
      formatted_address: event.venue.displayName,
      vicinity: event.location.city,
      geometry: {
        location: {
          lat: lat,
          lng: lng,
        },
      },
      types: ['concert', 'live_music', 'event', 'point_of_interest'],
      event_metadata: {
        start_time: event.start.datetime,
        end_time: event.start.datetime, // Songkick doesn't provide end time
        duration_minutes: 180, // Assume 3-hour concert
        event_url: event.uri,
        is_free: false, // Most concerts require tickets
      },
      songkick_metadata: {
        event_id: event.id.toString(),
        event_url: event.uri,
        artist_names: headlineArtists,
        venue_name: event.venue.displayName,
        performance_time: event.start.time,
        status: event.status,
      },
    };

    return activity;
  }
}

// Create singleton instance
const songkickService = new SongkickService();

// Auto-register with the global registry
activitySources.register(songkickService);

console.log('[Songkick] Service registered with activity source registry');

export default songkickService;
