/**
 * Ticketmaster Discovery API Service
 *
 * Integrates Ticketmaster events into Loop's recommendation feed.
 * Uses Discovery API v2 for event search.
 *
 * API Documentation: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 * Rate Limits (Free Tier): 5000 requests/day, 5 requests/second
 *
 * Key Features:
 * - Search events near user's location
 * - Filter by user interests → Ticketmaster classifications
 * - Transform events → UnifiedActivity format
 * - Multiple high-quality images (16:9, 3:2, 4:3 aspect ratios)
 * - Concert, sports, theater, festival events
 */

import { FEATURE_FLAGS } from '@/constants/feature-flags';
import { activitySources, type IActivitySource } from './activity-source';
import type {
  UnifiedActivity,
  EventMetadata,
  SearchParams,
} from '@/types/activity';

// Ticketmaster API Base URL
const TICKETMASTER_API_BASE = 'https://app.ticketmaster.com/discovery/v2';

// Get API key from environment
const TICKETMASTER_API_KEY = process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY;

/**
 * Ticketmaster API Event Response
 * (Simplified - only fields we use)
 */
interface TicketmasterEvent {
  id: string;
  name: string;
  url: string;
  info?: string;              // General event information
  description?: string;        // Event description
  pleaseNote?: string;         // Important event notes
  images: Array<{
    ratio: string; // "16_9", "3_2", "4_3", etc.
    url: string;
    width: number;
    height: number;
    fallback: boolean;
  }>;
  dates: {
    start: {
      localDate: string; // "2026-01-15"
      localTime?: string; // "19:00:00"
      dateTime?: string; // ISO 8601 if available
    };
    end?: {
      localDate?: string;
      localTime?: string;
      dateTime?: string;
    };
    timezone?: string;
  };
  classifications?: Array<{
    primary: boolean;
    segment: {
      id: string;
      name: string; // "Music", "Sports", "Arts & Theatre"
    };
    genre: {
      id: string;
      name: string; // "Rock", "Basketball", "Musical"
    };
    subGenre?: {
      id: string;
      name: string;
    };
  }>;
  priceRanges?: Array<{
    type: string;
    currency: string;
    min: number;
    max: number;
  }>;
  _embedded?: {
    venues?: Array<{
      name: string;
      address?: {
        line1?: string;
        line2?: string;
      };
      city?: {
        name: string;
      };
      state?: {
        name: string;
        stateCode: string;
      };
      postalCode?: string;
      location?: {
        latitude: string;
        longitude: string;
      };
    }>;
  };
}

interface TicketmasterSearchResponse {
  _embedded?: {
    events: TicketmasterEvent[];
  };
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

/**
 * Map Loop interest categories to Ticketmaster classifications
 * Ticketmaster uses: segment (Music, Sports, Arts & Theatre) → genre → subGenre
 */
const CLASSIFICATION_MAPPING: Record<string, { segment?: string; genre?: string }> = {
  // Music
  music: { segment: 'Music' },
  live_music: { segment: 'Music' },
  concerts: { segment: 'Music' },
  rock: { segment: 'Music', genre: 'Rock' },
  pop: { segment: 'Music', genre: 'Pop' },
  jazz: { segment: 'Music', genre: 'Jazz' },
  country: { segment: 'Music', genre: 'Country' },
  hiphop: { segment: 'Music', genre: 'Hip-Hop/Rap' },
  electronic: { segment: 'Music', genre: 'Electronic' },
  classical: { segment: 'Music', genre: 'Classical' },

  // Sports
  sports: { segment: 'Sports' },
  basketball: { segment: 'Sports', genre: 'Basketball' },
  football: { segment: 'Sports', genre: 'Football' },
  baseball: { segment: 'Sports', genre: 'Baseball' },
  hockey: { segment: 'Sports', genre: 'Hockey' },
  soccer: { segment: 'Sports', genre: 'Soccer' },

  // Arts & Theatre
  theater: { segment: 'Arts & Theatre' },
  theatre: { segment: 'Arts & Theatre' },
  arts: { segment: 'Arts & Theatre' },
  musical: { segment: 'Arts & Theatre', genre: 'Musical' },
  comedy: { segment: 'Arts & Theatre', genre: 'Comedy' },

  // Entertainment
  entertainment: {}, // Match all segments

  // Family
  family: { segment: 'Family' },
};

/**
 * Simple rate limiter for Ticketmaster API
 * Ensures we don't exceed 5 requests/second (Ticketmaster limit)
 */
class RateLimiter {
  private queue: Array<() => void> = [];
  private requestTimes: number[] = [];
  private readonly maxRequestsPerSecond = 5;
  private processing = false;

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();

      // Ticketmaster requires even spacing: 1000ms / 5 requests = 200ms minimum between requests
      // This respects both the rate limit (5/sec) AND burst limit (no simultaneous requests)
      const minSpacing = 1000 / this.maxRequestsPerSecond; // 200ms

      // If we made a request recently, wait for minimum spacing
      if (this.requestTimes.length > 0) {
        const lastRequestTime = this.requestTimes[this.requestTimes.length - 1];
        const timeSinceLastRequest = now - lastRequestTime;

        if (timeSinceLastRequest < minSpacing) {
          const waitTime = minSpacing - timeSinceLastRequest;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // Clean up old request times (older than 1 second)
      this.requestTimes = this.requestTimes.filter(time => Date.now() - time < 1000);

      // Execute next request
      const nextRequest = this.queue.shift();
      if (nextRequest) {
        this.requestTimes.push(Date.now());
        await nextRequest();
      }
    }

    this.processing = false;
  }
}

// Global rate limiter instance for Ticketmaster
const ticketmasterRateLimiter = new RateLimiter();

/**
 * Ticketmaster Service Implementation
 */
class TicketmasterService implements IActivitySource {
  readonly name = 'ticketmaster' as const;

  /**
   * Check if Ticketmaster is available
   */
  isAvailable(): boolean {
    const featureFlagEnabled = FEATURE_FLAGS.ENABLE_TICKETMASTER;
    const apiKeyPresent = !!TICKETMASTER_API_KEY && TICKETMASTER_API_KEY !== 'your_key_here';

    console.log('[Ticketmaster] isAvailable check:', {
      featureFlagEnabled,
      apiKeyPresent,
      apiKey: TICKETMASTER_API_KEY ? `${TICKETMASTER_API_KEY.substring(0, 10)}...` : 'undefined',
    });

    return featureFlagEnabled && apiKeyPresent;
  }

  /**
   * Search for events near a location
   * Uses rate limiter to respect Ticketmaster's 5 requests/second limit
   */
  async search(params: SearchParams): Promise<UnifiedActivity[]> {
    if (!this.isAvailable()) {
      console.log('[Ticketmaster] Service not available (feature flag or API key missing)');
      return [];
    }

    // Wrap the actual search in rate limiter
    return ticketmasterRateLimiter.throttle(async () => {
      try {
        // Build Ticketmaster API request
        const url = this.buildSearchUrl(params);

        console.log('[Ticketmaster] Searching events:', url);

        const response = await fetch(url);

        if (!response.ok) {
          const errorBody = await response.text();
          console.error('[Ticketmaster] API error response:', {
            status: response.status,
            statusText: response.statusText,
            body: errorBody,
            url: url,
          });
          throw new Error(`Ticketmaster API error: ${response.status} ${response.statusText}`);
        }

        const data: TicketmasterSearchResponse = await response.json();

        const events = data._embedded?.events || [];
        console.log(`[Ticketmaster] Found ${events.length} events`);

        // Transform events to UnifiedActivity format
        const activities = events
          .map(event => this.transformToUnifiedActivity(event))
          .filter((activity): activity is UnifiedActivity => activity !== null);

        // Validate scheduling to prevent impossible events
        const { validateEventScheduling } = await import('@/utils/event-validation');
        const validActivities = validateEventScheduling(activities);

        return validActivities;
      } catch (error) {
        console.error('[Ticketmaster] Search failed:', error);
        return [];
      }
    });
  }

  /**
   * Get event details by ID
   */
  async getDetails(id: string): Promise<UnifiedActivity | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const url = `${TICKETMASTER_API_BASE}/events/${id}.json?apikey=${TICKETMASTER_API_KEY}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Ticketmaster API error: ${response.status}`);
      }

      const event: TicketmasterEvent = await response.json();

      return this.transformToUnifiedActivity(event);
    } catch (error) {
      console.error('[Ticketmaster] GetDetails failed:', error);
      return null;
    }
  }

  /**
   * Build Ticketmaster search URL with parameters
   */
  private buildSearchUrl(params: SearchParams): string {
    const url = new URL(`${TICKETMASTER_API_BASE}/events.json`);

    // API key (required)
    url.searchParams.set('apikey', TICKETMASTER_API_KEY!);

    // Location parameters (required)
    url.searchParams.set('latlong', `${params.latitude},${params.longitude}`);

    // Radius (convert meters to miles: 1 meter = 0.000621371 miles)
    // For events, use larger radius (min 25 miles) since users travel further for concerts/games
    const radiusMeters = params.radius || 8000;
    const radiusMiles = Math.max(
      25, // Minimum 25 miles for events (covers DFW metroplex)
      Math.round(radiusMeters * 0.000621371)
    );
    url.searchParams.set('radius', radiusMiles.toString());
    url.searchParams.set('unit', 'miles');

    // Date range (only future events)
    // CRITICAL: Ticketmaster requires format YYYY-MM-DDTHH:mm:ssZ (no milliseconds)
    const now = new Date();
    const startDateTime = now.toISOString().split('.')[0] + 'Z'; // Remove milliseconds
    url.searchParams.set('startDateTime', startDateTime);

    // MVP: Don't filter by classifications - get all events and let our algorithm score them
    // This prevents missing events due to incorrect ID mapping
    // Our scoring algorithm already handles interest matching (base score boost for matching categories)
    // Future: Add proper Ticketmaster classification ID mapping once we have the complete list

    // Sort by date (soonest first) so urgent events appear at top
    url.searchParams.set('sort', 'date,asc');

    // Limit results
    url.searchParams.set('size', (params.limit || 20).toString());

    return url.toString();
  }

  /**
   * Transform Ticketmaster event to UnifiedActivity
   */
  private transformToUnifiedActivity(event: TicketmasterEvent): UnifiedActivity | null {
    try {
      // Get venue information
      const venue = event._embedded?.venues?.[0];

      if (!venue?.location?.latitude || !venue?.location?.longitude) {
        console.log(`[Ticketmaster] Skipping event without location: ${event.name}`);
        return null;
      }

      // Parse location
      const latitude = parseFloat(venue.location.latitude);
      const longitude = parseFloat(venue.location.longitude);

      // Build formatted address
      const addressParts = [
        venue.address?.line1,
        venue.city?.name,
        venue.state?.stateCode,
        venue.postalCode,
      ].filter(Boolean);
      const address = addressParts.join(', ');

      // Parse event times
      const startDate = event.dates.start.localDate;
      const startTime = event.dates.start.localTime || '19:00:00'; // Default to 7pm
      const startDateTime = `${startDate}T${startTime}`;

      // Calculate duration (default 2 hours for most events)
      const durationMinutes = 120;
      const endDateTime = new Date(new Date(startDateTime).getTime() + durationMinutes * 60000).toISOString();

      // Extract pricing
      const priceRange = event.priceRanges?.[0];
      const isFree = !priceRange || (priceRange.min === 0 && priceRange.max === 0);

      // Extract event metadata
      const eventMetadata: EventMetadata = {
        start_time: startDateTime,
        end_time: endDateTime,
        duration_minutes: durationMinutes,
        event_url: event.url,
        organizer: venue.name,
        is_online: false, // Ticketmaster events are always physical
        is_free: isFree,
        ticket_price: priceRange
          ? {
              min: Math.round(priceRange.min * 100), // Convert to cents
              max: Math.round(priceRange.max * 100),
              currency: priceRange.currency,
            }
          : undefined,
      };

      // Filter images by quality (minimum 600x400px resolution)
      const MIN_WIDTH = 600;
      const MIN_HEIGHT = 400;

      const highQualityImages = event.images.filter(
        img => img.width >= MIN_WIDTH && img.height >= MIN_HEIGHT
      );

      if (highQualityImages.length < event.images.length) {
        console.log(`📸 Filtered ${event.name} images: ${event.images.length} → ${highQualityImages.length} (removed low-res)`);
      }

      // Build photo array (prefer 16:9 aspect ratio for feed, must meet minimum quality)
      const preferredImage = highQualityImages.find(img => img.ratio === '16_9') || highQualityImages[0];
      const photos = preferredImage
        ? [
            {
              photo_reference: preferredImage.url,
              height: preferredImage.height,
              width: preferredImage.width,
            },
          ]
        : undefined;

      // Determine category from classification
      const classification = event.classifications?.find(c => c.primary);
      const category = classification?.segment?.name?.toLowerCase() || 'event';

      // Transform to UnifiedActivity
      const activity: UnifiedActivity = {
        place_id: `ticketmaster_${event.id}`,
        source: 'ticketmaster',
        name: event.name,
        formatted_address: address,
        editorial_summary: event.info || event.description || event.pleaseNote ||
          `${classification?.segment?.name || 'Event'} at ${venue.name}`,
        geometry: {
          location: {
            lat: latitude,
            lng: longitude,
          },
        },
        types: ['event', 'point_of_interest', category],
        rating: undefined, // Ticketmaster doesn't provide ratings
        user_ratings_total: undefined,
        price_level: this.calculatePriceLevel(priceRange),
        photos,
        opening_hours: undefined, // Events don't have business hours
        event_metadata: eventMetadata,
      };

      return activity;
    } catch (error) {
      console.error('[Ticketmaster] Transform failed:', error, event);
      return null;
    }
  }

  /**
   * Map Loop interests to Ticketmaster segment/genre IDs
   * Note: This is a simplified mapping. For production, you'd query Ticketmaster's
   * classifications endpoint to get actual IDs.
   */
  private mapInterestsToClassifications(interests: string[]): {
    segmentIds: string[];
    genreIds: string[];
  } {
    const segments = new Set<string>();
    const genres = new Set<string>();

    for (const interest of interests) {
      const classification = CLASSIFICATION_MAPPING[interest.toLowerCase()];
      if (classification) {
        if (classification.segment) {
          segments.add(classification.segment);
        }
        if (classification.genre) {
          genres.add(classification.genre);
        }
      }
    }

    // For MVP, we'll use segment/genre names as IDs
    // In production, you'd map these to actual Ticketmaster IDs
    return {
      segmentIds: Array.from(segments),
      genreIds: Array.from(genres),
    };
  }

  /**
   * Calculate price level (0-3) from ticket pricing
   */
  private calculatePriceLevel(
    priceRange?: { min: number; max: number }
  ): number | undefined {
    if (!priceRange) {
      return undefined;
    }

    if (priceRange.min === 0 && priceRange.max === 0) {
      return 0; // Free
    }

    const avgPrice = (priceRange.min + priceRange.max) / 2;

    // Map to Google Places price scale
    if (avgPrice < 30) return 1; // $ (under $30)
    if (avgPrice < 75) return 2; // $$ ($30-$75)
    return 3; // $$$ ($75+)
  }
}

// Export singleton instance
export const ticketmasterService = new TicketmasterService();

// Auto-register with the global activity source registry
activitySources.register(ticketmasterService);

console.log('[TicketmasterService] Registered with activity source registry');
