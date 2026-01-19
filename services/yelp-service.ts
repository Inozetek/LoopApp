/**
 * Yelp Fusion API Integration
 *
 * Provides access to Yelp's business data including:
 * - Restaurants, bars, cafes
 * - Enhanced reviews and ratings
 * - Happy hours and special deals
 * - Business hours and attributes
 *
 * API Limits (Free Tier):
 * - 5000 requests per day
 * - No per-second rate limit
 *
 * Documentation: https://www.yelp.com/developers/documentation/v3
 */

import { IActivitySource, activitySources } from './activity-source';
import type { UnifiedActivity, SearchParams, YelpMetadata, YelpDeal } from '@/types/activity';
import { FEATURE_FLAGS } from '@/constants/feature-flags';

const YELP_API_KEY = process.env.EXPO_PUBLIC_YELP_API_KEY;
const YELP_API_BASE = 'https://api.yelp.com/v3';

/**
 * Yelp Business response type
 */
interface YelpBusiness {
  id: string;
  name: string;
  image_url: string;
  is_closed: boolean;
  url: string;
  review_count: number;
  categories: Array<{
    alias: string;
    title: string;
  }>;
  rating: number;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  transactions: string[];
  price?: string; // '$', '$$', '$$$', '$$$$'
  location: {
    address1: string;
    address2?: string;
    address3?: string;
    city: string;
    zip_code: string;
    country: string;
    state: string;
    display_address: string[];
  };
  phone: string;
  display_phone: string;
  distance: number; // meters
}

/**
 * Yelp API search response
 */
interface YelpSearchResponse {
  businesses: YelpBusiness[];
  total: number;
  region: {
    center: {
      longitude: number;
      latitude: number;
    };
  };
}

class YelpService implements IActivitySource {
  readonly name = 'yelp' as const;

  /**
   * Check if Yelp integration is available
   */
  isAvailable(): boolean {
    const featureFlagEnabled = FEATURE_FLAGS.ENABLE_YELP;
    const apiKeyPresent = !!YELP_API_KEY && YELP_API_KEY !== 'your_key_here';

    if (!featureFlagEnabled) {
      console.log('[Yelp] Feature flag ENABLE_YELP is disabled');
    }

    if (!apiKeyPresent) {
      console.log('[Yelp] API key not configured or invalid');
    }

    return featureFlagEnabled && apiKeyPresent;
  }

  /**
   * Search for businesses near a location
   */
  async search(params: SearchParams): Promise<UnifiedActivity[]> {
    if (!this.isAvailable()) {
      console.log('[Yelp] Service not available');
      return [];
    }

    try {
      console.log('[Yelp] Searching with params:', {
        lat: params.latitude,
        lng: params.longitude,
        radius: params.radius,
        interests: params.interests,
      });

      const url = this.buildSearchUrl(params);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${YELP_API_KEY}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Yelp] API error:', response.status, errorText);
        return [];
      }

      const data: YelpSearchResponse = await response.json();
      const businesses = data.businesses || [];

      console.log(`[Yelp] Found ${businesses.length} businesses`);

      // Transform Yelp businesses to UnifiedActivity format
      const activities = businesses
        .map(business => this.transformToUnifiedActivity(business))
        .filter((activity): activity is UnifiedActivity => activity !== null);

      return activities;
    } catch (error) {
      console.error('[Yelp] Search error:', error);
      return [];
    }
  }

  /**
   * Get details for a specific business
   */
  async getDetails(id: string): Promise<UnifiedActivity | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const response = await fetch(`${YELP_API_BASE}/businesses/${id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${YELP_API_KEY}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        console.error('[Yelp] getDetails error:', response.status);
        return null;
      }

      const business: YelpBusiness = await response.json();
      return this.transformToUnifiedActivity(business);
    } catch (error) {
      console.error('[Yelp] getDetails error:', error);
      return null;
    }
  }

  /**
   * Build search URL with query parameters
   */
  private buildSearchUrl(params: SearchParams): string {
    const { latitude, longitude, radius = 8000, limit = 20, interests } = params;

    const searchParams = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radius: Math.min(radius, 40000).toString(), // Yelp max: 40km
      limit: Math.min(limit, 50).toString(), // Yelp max: 50
      sort_by: 'best_match', // or 'rating', 'distance'
    });

    // Map user interests to Yelp categories
    if (interests && interests.length > 0) {
      const yelpCategories = this.mapInterestsToYelpCategories(interests);
      if (yelpCategories.length > 0) {
        searchParams.append('categories', yelpCategories.join(','));
      }
    }

    return `${YELP_API_BASE}/businesses/search?${searchParams.toString()}`;
  }

  /**
   * Transform Yelp business to UnifiedActivity
   */
  private transformToUnifiedActivity(business: YelpBusiness): UnifiedActivity | null {
    // Skip closed businesses
    if (business.is_closed) {
      console.log(`[Yelp] Skipping closed business: ${business.name}`);
      return null;
    }

    // Validate coordinates
    if (!business.coordinates) {
      console.warn(`[Yelp] Skipping business without coordinates: ${business.name}`);
      return null;
    }

    // Map price level from Yelp format ($, $$, $$$, $$$$) to Google format (0-4)
    const priceLevel = this.mapPriceLevel(business.price);

    // Build address string
    const address = business.location.display_address.join(', ');

    // Extract category names
    const categories = business.categories.map(cat => cat.title);

    // Build UnifiedActivity
    const activity: UnifiedActivity = {
      place_id: `yelp_${business.id}`,
      source: 'yelp',
      name: business.name,
      formatted_address: address,
      vicinity: address,
      geometry: {
        location: {
          lat: business.coordinates.latitude,
          lng: business.coordinates.longitude,
        },
      },
      types: ['restaurant', 'food', 'point_of_interest'],
      rating: business.rating,
      user_ratings_total: business.review_count,
      price_level: priceLevel,
      photos: business.image_url
        ? [
            {
              photo_reference: business.image_url,
              height: 1000,
              width: 1000,
            },
          ]
        : undefined,
      yelp_metadata: {
        yelp_id: business.id,
        yelp_url: business.url,
        review_count: business.review_count,
        categories: categories,
        transactions: business.transactions || [],
        // Note: Yelp Fusion API v3 doesn't provide deals in search results
        // Deals would need to be fetched from Yelp's website or a separate API
        deals: undefined,
      },
    };

    return activity;
  }

  /**
   * Map Yelp price format to Google Places price_level
   * @param price Yelp price string ($, $$, $$$, $$$$)
   * @returns Google price level (0-4)
   */
  private mapPriceLevel(price?: string): number {
    if (!price) return 1; // Default to inexpensive if no price info
    return price.length; // '$' = 1, '$$' = 2, '$$$' = 3, '$$$$' = 4
  }

  /**
   * Map user interests to Yelp category aliases
   */
  private mapInterestsToYelpCategories(interests: string[]): string[] {
    // Comprehensive mapping from Loop interests to Yelp categories
    // Yelp category list: https://www.yelp.com/developers/documentation/v3/all_category_list
    const interestMap: Record<string, string[]> = {
      // Food & Drink
      coffee: ['coffee', 'cafes'],
      dining: ['restaurants'],
      restaurants: ['restaurants'],
      bars: ['bars', 'cocktailbars', 'beer_and_wine'],
      nightlife: ['nightlife'],
      brunch: ['breakfast_brunch'],

      // Cuisine types
      italian: ['italian'],
      mexican: ['mexican'],
      sushi: ['sushi', 'japanese'],
      japanese: ['japanese'],
      chinese: ['chinese'],
      thai: ['thai'],
      pizza: ['pizza'],
      burgers: ['burgers'],
      seafood: ['seafood'],
      steak: ['steak'],

      // Entertainment
      live_music: ['musicvenues', 'jazzandblues'],
      music: ['musicvenues'],
      entertainment: ['arts', 'entertainment'],
      arts: ['arts'],

      // Activities
      fitness: ['gyms', 'yoga', 'pilates'],
      outdoor: ['hiking', 'parks'],
      wellness: ['spas', 'massage'],
      shopping: ['shopping'],
      sports: ['active'],

      // Special categories
      wine: ['wine_bars', 'wineries'],
      beer: ['breweries', 'beergardens'],
      dessert: ['desserts', 'icecream'],
      bakery: ['bakeries'],
    };

    const yelpCategories: string[] = [];

    interests.forEach(interest => {
      const categories = interestMap[interest.toLowerCase()];
      if (categories) {
        yelpCategories.push(...categories);
      }
    });

    // Remove duplicates
    return [...new Set(yelpCategories)];
  }
}

// Create singleton instance
const yelpService = new YelpService();

// Auto-register with the global registry
activitySources.register(yelpService);

console.log('[Yelp] Service registered with activity source registry');

export default yelpService;
