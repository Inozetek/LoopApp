/**
 * Groupon API Integration
 *
 * Provides access to Groupon's daily deals including:
 * - Restaurant deals and vouchers
 * - Activity and experience deals
 * - Spa and wellness deals
 * - Entertainment and events
 *
 * API Limits (Free Tier):
 * - 10,000 requests per day
 * - No per-second rate limit
 *
 * Documentation: https://partner-api.groupon.com/help/
 */

import { IActivitySource, activitySources } from './activity-source';
import type { UnifiedActivity, SearchParams, GrouponMetadata } from '@/types/activity';
import { FEATURE_FLAGS } from '@/constants/feature-flags';

const GROUPON_API_KEY = process.env.EXPO_PUBLIC_GROUPON_API_KEY;
const GROUPON_API_BASE = 'https://partner-api.groupon.com';

/**
 * Groupon Deal response type
 */
interface GrouponDeal {
  id: string;
  title: string;
  largeImageUrl: string;
  dealUrl: string;
  merchant: {
    name: string;
    websiteUrl?: string;
  };
  options: Array<{
    price: {
      formattedAmount: string;
      amount: number;
    };
    value: {
      formattedAmount: string;
      amount: number;
    };
    discountPercent: number;
  }>;
  locations?: Array<{
    lat: number;
    lng: number;
    streetAddress1: string;
    city: string;
    state: string;
    postalCode: string;
  }>;
  category: string;
  endAt: string; // ISO 8601 date when deal expires
  finePrint: string;
}

/**
 * Groupon API search response
 */
interface GrouponSearchResponse {
  deals: GrouponDeal[];
}

class GrouponService implements IActivitySource {
  readonly name = 'groupon' as const;

  /**
   * Check if Groupon integration is available
   */
  isAvailable(): boolean {
    const featureFlagEnabled = FEATURE_FLAGS.ENABLE_GROUPON;
    const apiKeyPresent = !!GROUPON_API_KEY && GROUPON_API_KEY !== 'your_key_here';

    if (!featureFlagEnabled) {
      console.log('[Groupon] Feature flag ENABLE_GROUPON is disabled');
    }

    if (!apiKeyPresent) {
      console.log('[Groupon] API key not configured or invalid');
    }

    return featureFlagEnabled && apiKeyPresent;
  }

  /**
   * Search for deals near a location
   */
  async search(params: SearchParams): Promise<UnifiedActivity[]> {
    if (!this.isAvailable()) {
      console.log('[Groupon] Service not available');
      return [];
    }

    try {
      const { latitude, longitude, radius = 8000 } = params;

      console.log('[Groupon] Searching with params:', {
        lat: latitude,
        lng: longitude,
        radius: radius / 1000, // Convert to km
      });

      // Build URL with query parameters
      const searchParams = new URLSearchParams({
        lat: latitude.toString(),
        lng: longitude.toString(),
        radius: (radius / 1000).toString(), // Groupon expects km
        limit: '20',
      });

      const url = `${GROUPON_API_BASE}/deals.json?${searchParams.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${GROUPON_API_KEY}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Groupon] API error:', response.status, errorText);
        return [];
      }

      const data: GrouponSearchResponse = await response.json();
      const deals = data.deals || [];

      console.log(`[Groupon] Found ${deals.length} deals`);

      // Transform Groupon deals to UnifiedActivity format
      const activities = deals
        .map(deal => this.transformToUnifiedActivity(deal))
        .filter((activity): activity is UnifiedActivity => activity !== null);

      return activities;
    } catch (error) {
      console.error('[Groupon] Search error:', error);
      return [];
    }
  }

  /**
   * Get details for a specific deal
   */
  async getDetails(id: string): Promise<UnifiedActivity | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const response = await fetch(`${GROUPON_API_BASE}/deals/${id}.json`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${GROUPON_API_KEY}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        console.error('[Groupon] getDetails error:', response.status);
        return null;
      }

      const deal: GrouponDeal = await response.json();
      return this.transformToUnifiedActivity(deal);
    } catch (error) {
      console.error('[Groupon] getDetails error:', error);
      return null;
    }
  }

  /**
   * Transform Groupon deal to UnifiedActivity
   */
  private transformToUnifiedActivity(deal: GrouponDeal): UnifiedActivity | null {
    // Skip deals without location data
    if (!deal.locations || deal.locations.length === 0) {
      console.warn(`[Groupon] Skipping deal without location: ${deal.title}`);
      return null;
    }

    // Use first location
    const location = deal.locations[0];

    // Use first pricing option
    const option = deal.options[0];

    if (!option) {
      console.warn(`[Groupon] Skipping deal without pricing: ${deal.title}`);
      return null;
    }

    // Build address string
    const address = `${location.streetAddress1}, ${location.city}, ${location.state} ${location.postalCode}`;

    // Parse expiration date
    const expiresAt = new Date(deal.endAt);
    const isActive = expiresAt > new Date();

    if (!isActive) {
      console.log(`[Groupon] Skipping expired deal: ${deal.title}`);
      return null;
    }

    // Build UnifiedActivity
    const activity: UnifiedActivity = {
      place_id: `groupon_${deal.id}`,
      source: 'groupon',
      name: deal.title,
      formatted_address: address,
      vicinity: `${location.city}, ${location.state}`,
      geometry: {
        location: {
          lat: location.lat,
          lng: location.lng,
        },
      },
      types: ['groupon_deal', 'point_of_interest'],
      photos: deal.largeImageUrl
        ? [
            {
              photo_reference: deal.largeImageUrl,
              height: 1000,
              width: 1000,
            },
          ]
        : undefined,
      dealExpiresAt: expiresAt,
      isActiveNow: true, // Groupon deals are always "active" until they expire
      groupon_metadata: {
        deal_id: deal.id,
        deal_url: deal.dealUrl,
        original_price: option.value.amount,
        deal_price: option.price.amount,
        discount_percent: option.discountPercent,
        voucher_expiration: deal.endAt,
        fine_print: deal.finePrint,
        merchant_name: deal.merchant.name,
      },
    };

    return activity;
  }
}

// Create singleton instance
const grouponService = new GrouponService();

// Auto-register with the global registry
activitySources.register(grouponService);

console.log('[Groupon] Service registered with activity source registry');

export default grouponService;
