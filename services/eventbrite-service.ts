/**
 * Eventbrite API Integration
 *
 * ============================================================================
 * ⚠️  DEPRECATED - January 2026
 * ============================================================================
 *
 * The Eventbrite /events/search endpoint was deprecated in February 2020.
 * This service is currently DISABLED via feature flag.
 *
 * What still works:
 *   - GET /categories (21 event categories)
 *   - GET /formats (20 event formats)
 *   - GET /users/me/organizations (user's orgs)
 *   - GET /organizations/:id/events (events for specific org)
 *
 * What doesn't work:
 *   - GET /events/search (returns 404) ← This service uses this endpoint
 *   - GET /destination/search (internal API only)
 *
 * Future options:
 *   1. Build curated venue/org database per city, query their events directly
 *   2. Use PredictHQ ($500+/year) when we have revenue
 *   3. Pursue Eventbrite partnership for full API access
 *
 * See TESTING_REPORT.md for full analysis.
 * ============================================================================
 *
 * Original description:
 * Provides access to community events, workshops, classes, and meetups.
 * Uses smart filtering to ensure only high-quality, relevant events appear in feeds.
 *
 * Quality Filters Applied:
 * - Minimum 50 attendees (filters out low-traction events)
 * - Must have image (visual quality)
 * - Must have description (content quality)
 * - Interest matching (relevance to user preferences)
 * - Future events only (no past events)
 * - Within 30 days (timely recommendations)
 *
 * API Limits (Free Tier):
 * - 1000 requests per hour
 * - No daily limit
 *
 * Documentation: https://www.eventbrite.com/platform/api
 */

import { IActivitySource, activitySources } from './activity-source';
import type {
  UnifiedActivity,
  SearchParams,
  EventbriteMetadata,
  EventMetadata,
} from '@/types/activity';
import { FEATURE_FLAGS } from '@/constants/feature-flags';

const EVENTBRITE_API_KEY = process.env.EXPO_PUBLIC_EVENTBRITE_API_KEY;
const EVENTBRITE_API_BASE = 'https://www.eventbriteapi.com/v3';

// Quality thresholds - adjust these to control feed quality
const QUALITY_CONFIG = {
  /** Minimum number of attendees to be shown in feed */
  MIN_ATTENDEES: 50,
  /** Minimum description length (characters) */
  MIN_DESCRIPTION_LENGTH: 100,
  /** Maximum days in future to show events */
  MAX_DAYS_AHEAD: 30,
  /** Require event to have an image */
  REQUIRE_IMAGE: true,
};

/**
 * Eventbrite Event response type
 */
interface EventbriteEvent {
  id: string;
  name: {
    text: string;
    html: string;
  };
  description: {
    text: string;
    html: string;
  };
  url: string;
  start: {
    timezone: string;
    local: string; // "2026-01-20T19:00:00"
    utc: string; // ISO 8601
  };
  end: {
    timezone: string;
    local: string;
    utc: string;
  };
  organization_id: string;
  created: string;
  changed: string;
  capacity: number;
  capacity_is_custom: boolean;
  status: 'draft' | 'live' | 'started' | 'ended' | 'completed' | 'canceled';
  currency: string;
  listed: boolean;
  shareable: boolean;
  online_event: boolean;
  tx_time_limit: number;
  hide_start_date: boolean;
  hide_end_date: boolean;
  locale: string;
  is_locked: boolean;
  privacy_setting: 'unlocked' | 'locked';
  is_series: boolean;
  is_series_parent: boolean;
  is_reserved_seating: boolean;
  show_pick_a_seat: boolean;
  show_seatmap_thumbnail: boolean;
  show_colors_in_seatmap_thumbnail: boolean;
  source: string;
  is_free: boolean;
  version: string;
  summary: string;
  logo_id: string;
  organizer_id: string;
  venue_id: string;
  category_id: string;
  subcategory_id: string;
  format_id: string;
  resource_uri: string;
  // Expanded fields (when using expand parameter)
  logo?: {
    id: string;
    url: string;
    aspect_ratio: string;
    edge_color: string;
    edge_color_set: boolean;
    original: {
      url: string;
      width: number;
      height: number;
    };
  };
  venue?: {
    id: string;
    name: string;
    address: {
      address_1: string;
      address_2?: string;
      city: string;
      region: string;
      postal_code: string;
      country: string;
      latitude: string;
      longitude: string;
      localized_address_display: string;
      localized_area_display: string;
      localized_multi_line_address_display: string[];
    };
  };
  organizer?: {
    id: string;
    name: string;
    description?: {
      text: string;
      html: string;
    };
    long_description?: {
      text: string;
      html: string;
    };
    logo_id?: string;
    logo?: {
      id: string;
      url: string;
    };
    resource_uri: string;
    url: string;
    vanity_url?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    num_past_events?: number;
    num_future_events?: number;
  };
  category?: {
    id: string;
    name: string;
    name_localized: string;
    short_name: string;
    short_name_localized: string;
  };
  subcategory?: {
    id: string;
    name: string;
  };
  format?: {
    id: string;
    name: string;
    name_localized: string;
    short_name: string;
    short_name_localized: string;
  };
  ticket_availability?: {
    has_available_tickets: boolean;
    minimum_ticket_price?: {
      currency: string;
      value: number;
      major_value: string;
      display: string;
    };
    maximum_ticket_price?: {
      currency: string;
      value: number;
      major_value: string;
      display: string;
    };
    is_sold_out: boolean;
    start_sales_date?: {
      timezone: string;
      local: string;
      utc: string;
    };
  };
}

/**
 * Eventbrite API search response
 */
interface EventbriteSearchResponse {
  pagination: {
    object_count: number;
    page_number: number;
    page_size: number;
    page_count: number;
    has_more_items: boolean;
  };
  events: EventbriteEvent[];
}

/**
 * Mapping from Eventbrite category IDs to Loop interest categories
 * Eventbrite category IDs: https://www.eventbrite.com/platform/api#/reference/category
 */
const EVENTBRITE_CATEGORY_MAP: Record<string, string[]> = {
  // Music
  '103': ['live_music', 'music', 'entertainment', 'nightlife'],
  // Business & Professional
  '101': ['education', 'networking'],
  // Food & Drink
  '110': ['dining', 'food', 'coffee', 'bars'],
  // Community & Culture
  '113': ['culture', 'community', 'arts'],
  // Performing & Visual Arts
  '105': ['arts', 'entertainment', 'culture'],
  // Film, Media & Entertainment
  '104': ['entertainment', 'arts'],
  // Sports & Fitness
  '108': ['fitness', 'sports', 'outdoor'],
  // Health & Wellness
  '107': ['wellness', 'fitness'],
  // Science & Technology
  '102': ['education', 'tech'],
  // Travel & Outdoor
  '109': ['outdoor', 'travel'],
  // Charity & Causes
  '111': ['community'],
  // Religion & Spirituality
  '114': ['wellness', 'community'],
  // Family & Education
  '115': ['family', 'education'],
  // Seasonal & Holiday
  '116': ['entertainment', 'family'],
  // Home & Lifestyle
  '117': ['shopping', 'wellness'],
  // Auto, Boat & Air
  '118': ['entertainment'],
  // Hobbies & Special Interest
  '119': ['entertainment', 'community'],
  // Other
  '199': ['other'],
};

/**
 * Reverse mapping: Loop interests to Eventbrite category IDs
 */
const INTEREST_TO_EVENTBRITE_CATEGORIES: Record<string, string[]> = {
  live_music: ['103'],
  music: ['103'],
  dining: ['110'],
  food: ['110'],
  coffee: ['110'],
  bars: ['110'],
  fitness: ['108', '107'],
  sports: ['108'],
  outdoor: ['108', '109'],
  wellness: ['107'],
  arts: ['105', '113'],
  entertainment: ['103', '104', '105'],
  culture: ['113', '105'],
  education: ['101', '102', '115'],
  family: ['115', '116'],
  travel: ['109'],
  shopping: ['117'],
  nightlife: ['103'],
  tech: ['102'],
  networking: ['101'],
  community: ['111', '113', '114'],
};

class EventbriteService implements IActivitySource {
  readonly name = 'eventbrite' as const;

  /**
   * Check if Eventbrite integration is available
   */
  isAvailable(): boolean {
    const featureFlagEnabled = FEATURE_FLAGS.ENABLE_EVENTBRITE;
    const apiKeyPresent = !!EVENTBRITE_API_KEY && EVENTBRITE_API_KEY !== 'your_key_here';

    if (!featureFlagEnabled) {
      console.log('[Eventbrite] Feature flag ENABLE_EVENTBRITE is disabled');
    }

    if (!apiKeyPresent) {
      console.log('[Eventbrite] API key not configured or invalid');
    }

    return featureFlagEnabled && apiKeyPresent;
  }

  /**
   * Search for events near a location
   * Applies quality filtering to ensure only relevant, popular events appear
   */
  async search(params: SearchParams): Promise<UnifiedActivity[]> {
    if (!this.isAvailable()) {
      console.log('[Eventbrite] Service not available');
      return [];
    }

    try {
      const { latitude, longitude, radius = 8000, interests = [] } = params;

      console.log('[Eventbrite] Searching with params:', {
        lat: latitude,
        lng: longitude,
        radius: radius / 1000, // km
        interests,
      });

      // If no interests match Eventbrite categories, skip search
      // This prevents showing random events to users who haven't indicated interest
      const relevantCategories = this.getRelevantCategories(interests);
      if (interests.length > 0 && relevantCategories.length === 0) {
        console.log('[Eventbrite] No matching categories for user interests, skipping');
        return [];
      }

      const url = this.buildSearchUrl(params, relevantCategories);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${EVENTBRITE_API_KEY}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Eventbrite] API error:', response.status, errorText);
        return [];
      }

      const data: EventbriteSearchResponse = await response.json();
      const events = data.events || [];

      console.log(`[Eventbrite] Found ${events.length} events before filtering`);

      // Apply quality filters
      const qualityEvents = events.filter(event => this.passesQualityFilters(event, interests));

      console.log(`[Eventbrite] ${qualityEvents.length} events passed quality filters`);

      // Transform to UnifiedActivity format
      const activities = qualityEvents
        .map(event => this.transformToUnifiedActivity(event))
        .filter((activity): activity is UnifiedActivity => activity !== null);

      return activities;
    } catch (error) {
      console.error('[Eventbrite] Search error:', error);
      return [];
    }
  }

  /**
   * Get details for a specific event
   */
  async getDetails(id: string): Promise<UnifiedActivity | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const url = `${EVENTBRITE_API_BASE}/events/${id}/?expand=venue,organizer,category,subcategory,format,ticket_availability`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${EVENTBRITE_API_KEY}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        console.error('[Eventbrite] getDetails error:', response.status);
        return null;
      }

      const event: EventbriteEvent = await response.json();
      return this.transformToUnifiedActivity(event);
    } catch (error) {
      console.error('[Eventbrite] getDetails error:', error);
      return null;
    }
  }

  /**
   * Get Eventbrite category IDs that match user's interests
   */
  private getRelevantCategories(interests: string[]): string[] {
    const categories = new Set<string>();

    for (const interest of interests) {
      const mappedCategories = INTEREST_TO_EVENTBRITE_CATEGORIES[interest.toLowerCase()];
      if (mappedCategories) {
        mappedCategories.forEach(cat => categories.add(cat));
      }
    }

    return Array.from(categories);
  }

  /**
   * Build search URL with query parameters
   */
  private buildSearchUrl(params: SearchParams, categoryIds: string[]): string {
    const { latitude, longitude, radius = 8000 } = params;

    // Convert radius from meters to miles (Eventbrite uses miles)
    const radiusMiles = Math.round(radius * 0.000621371);

    const searchParams = new URLSearchParams({
      'location.latitude': latitude.toString(),
      'location.longitude': longitude.toString(),
      'location.within': `${Math.max(radiusMiles, 10)}mi`, // Minimum 10 miles
      'expand': 'venue,organizer,category,subcategory,format,ticket_availability,logo',
      'status': 'live', // Only live (published) events
      'start_date.range_start': new Date().toISOString().split('.')[0] + 'Z',
      'start_date.range_end': this.getMaxDateAhead().toISOString().split('.')[0] + 'Z',
      'page_size': '50', // Get more to filter down
    });

    // Add category filter if user has matching interests
    if (categoryIds.length > 0) {
      searchParams.append('categories', categoryIds.join(','));
    }

    return `${EVENTBRITE_API_BASE}/events/search/?${searchParams.toString()}`;
  }

  /**
   * Get the maximum date ahead to search for events
   */
  private getMaxDateAhead(): Date {
    const date = new Date();
    date.setDate(date.getDate() + QUALITY_CONFIG.MAX_DAYS_AHEAD);
    return date;
  }

  /**
   * Check if an event passes quality filters
   * This is the key function that prevents junk from appearing in feeds
   */
  private passesQualityFilters(event: EventbriteEvent, userInterests: string[]): boolean {
    // Filter 1: Must be a live (published) event
    if (event.status !== 'live') {
      console.log(`[Eventbrite] Filtered out: ${event.name.text} (status: ${event.status})`);
      return false;
    }

    // Filter 2: Must not be sold out
    if (event.ticket_availability?.is_sold_out) {
      console.log(`[Eventbrite] Filtered out: ${event.name.text} (sold out)`);
      return false;
    }

    // Filter 3: Must have venue with coordinates (skip online-only unless that's what user wants)
    if (!event.venue?.address?.latitude || !event.venue?.address?.longitude) {
      if (!event.online_event) {
        console.log(`[Eventbrite] Filtered out: ${event.name.text} (no venue coordinates)`);
        return false;
      }
    }

    // Filter 4: Require image for visual quality
    if (QUALITY_CONFIG.REQUIRE_IMAGE && !event.logo?.url) {
      console.log(`[Eventbrite] Filtered out: ${event.name.text} (no image)`);
      return false;
    }

    // Filter 5: Minimum description length
    const descriptionLength = event.description?.text?.length || 0;
    if (descriptionLength < QUALITY_CONFIG.MIN_DESCRIPTION_LENGTH) {
      console.log(`[Eventbrite] Filtered out: ${event.name.text} (description too short: ${descriptionLength})`);
      return false;
    }

    // Filter 6: Capacity/popularity check
    // Use capacity as proxy for popularity (events with higher capacity tend to be more established)
    if (event.capacity && event.capacity < QUALITY_CONFIG.MIN_ATTENDEES) {
      console.log(`[Eventbrite] Filtered out: ${event.name.text} (capacity too low: ${event.capacity})`);
      return false;
    }

    // Filter 7: Interest relevance check
    // If user has interests, event category should match at least one
    if (userInterests.length > 0 && event.category_id) {
      const eventInterests = EVENTBRITE_CATEGORY_MAP[event.category_id] || [];
      const hasMatchingInterest = userInterests.some(
        interest => eventInterests.includes(interest.toLowerCase())
      );

      if (!hasMatchingInterest) {
        console.log(`[Eventbrite] Filtered out: ${event.name.text} (no interest match)`);
        return false;
      }
    }

    // Filter 8: Organizer quality (prefer organizers with history)
    // If organizer has done many past events, they're likely more reliable
    const pastEvents = event.organizer?.num_past_events || 0;
    if (pastEvents < 3) {
      // Be more lenient - allow new organizers if event has good capacity
      if (!event.capacity || event.capacity < 100) {
        console.log(`[Eventbrite] Filtered out: ${event.name.text} (new organizer, low capacity)`);
        return false;
      }
    }

    return true;
  }

  /**
   * Transform Eventbrite event to UnifiedActivity
   */
  private transformToUnifiedActivity(event: EventbriteEvent): UnifiedActivity | null {
    // Validate venue coordinates
    const lat = event.venue?.address?.latitude;
    const lng = event.venue?.address?.longitude;

    if (!lat || !lng) {
      if (!event.online_event) {
        console.warn(`[Eventbrite] Skipping event without coordinates: ${event.name.text}`);
        return null;
      }
      // For online events, use a placeholder (they won't show on map anyway)
    }

    // Calculate duration in minutes
    const startTime = new Date(event.start.utc);
    const endTime = new Date(event.end.utc);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    // Build address string
    const venue = event.venue;
    const address = venue?.address?.localized_address_display ||
                    venue?.address?.localized_multi_line_address_display?.join(', ') ||
                    (event.online_event ? 'Online Event' : 'Address not available');

    // Get price info
    const ticketAvail = event.ticket_availability;
    const priceRange = ticketAvail?.minimum_ticket_price && ticketAvail?.maximum_ticket_price
      ? {
          min: Math.round(ticketAvail.minimum_ticket_price.value * 100), // Convert to cents
          max: Math.round(ticketAvail.maximum_ticket_price.value * 100),
          currency: ticketAvail.minimum_ticket_price.currency,
        }
      : undefined;

    // Map Loop interests from Eventbrite category
    const loopInterests = event.category_id
      ? EVENTBRITE_CATEGORY_MAP[event.category_id] || []
      : [];

    // Build event metadata
    const eventMetadata: EventMetadata = {
      start_time: event.start.utc,
      end_time: event.end.utc,
      duration_minutes: durationMinutes,
      event_url: event.url,
      organizer: event.organizer?.name,
      is_online: event.online_event,
      is_free: event.is_free,
      ticket_price: priceRange,
    };

    // Build Eventbrite-specific metadata
    const eventbriteMetadata: EventbriteMetadata = {
      event_id: event.id,
      event_url: event.url,
      organizer_name: event.organizer?.name || 'Unknown Organizer',
      organizer_url: event.organizer?.url,
      is_verified_organizer: (event.organizer?.num_past_events || 0) >= 10,
      category: event.category?.name || 'Event',
      subcategory: event.subcategory?.name,
      format: event.format?.name,
      attendee_count: undefined, // Not available in search results
      capacity: event.capacity,
      is_online: event.online_event,
      is_free: event.is_free,
      price_range: priceRange,
      tags: loopInterests,
    };

    // Calculate price level (0-4 scale)
    let priceLevel: number | undefined;
    if (event.is_free) {
      priceLevel = 0;
    } else if (priceRange) {
      const avgPrice = (priceRange.min + priceRange.max) / 2 / 100; // Convert cents to dollars
      if (avgPrice < 20) priceLevel = 1;
      else if (avgPrice < 50) priceLevel = 2;
      else if (avgPrice < 100) priceLevel = 3;
      else priceLevel = 4;
    }

    // Build UnifiedActivity
    const activity: UnifiedActivity = {
      place_id: `eventbrite_${event.id}`,
      source: 'eventbrite',
      name: event.name.text,
      formatted_address: address,
      editorial_summary: event.summary || event.description?.text?.substring(0, 200) || undefined,
      geometry: {
        location: {
          lat: parseFloat(lat || '0'),
          lng: parseFloat(lng || '0'),
        },
      },
      types: ['event', 'community_event', ...loopInterests],
      rating: undefined, // Eventbrite doesn't have ratings
      user_ratings_total: undefined,
      price_level: priceLevel,
      photos: event.logo?.url
        ? [
            {
              photo_reference: event.logo.url,
              height: event.logo.original?.height || 400,
              width: event.logo.original?.width || 600,
            },
          ]
        : undefined,
      event_metadata: eventMetadata,
      eventbrite_metadata: eventbriteMetadata,
    };

    return activity;
  }
}

// Create singleton instance
const eventbriteService = new EventbriteService();

// Auto-register with the global registry
activitySources.register(eventbriteService);

console.log('[Eventbrite] Service registered with activity source registry');

export default eventbriteService;
