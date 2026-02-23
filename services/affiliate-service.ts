/**
 * Affiliate Booking Service
 * Handles partner matching, deep link building, click tracking, and link opening
 * for "Book through Loop" affiliate commission buttons.
 */

import { Linking } from 'react-native';
import { supabase } from '@/lib/supabase';
import { AFFILIATE_CONFIG } from '@/constants/affiliate-config';
import {
  AffiliatePartnerId,
  PARTNER_COMMISSION_RATES,
  type BookingType,
  type AttributionSource,
} from '@/types/affiliate';
import { Recommendation } from '@/types/activity';
import { trackEvent } from '@/utils/analytics';

/** Describes a matching affiliate partner for a recommendation */
export interface MatchedPartner {
  partnerId: AffiliatePartnerId;
  ctaText: string;
  icon: string; // Ionicons name
  color: string; // Brand color
  bookingType: BookingType;
}

/** Result from building a booking URL */
export interface BookingUrls {
  deepLink?: string;
  webUrl: string;
}

/** Partner visual config (icon + color) */
const PARTNER_VISUALS: Record<AffiliatePartnerId, { icon: string; color: string }> = {
  opentable: { icon: 'restaurant-outline', color: '#DA3743' },
  fandango: { icon: 'film-outline', color: '#FF8C00' },
  ticketmaster: { icon: 'ticket-outline', color: '#026CDF' },
  eventbrite: { icon: 'calendar-outline', color: '#F05537' },
  uber: { icon: 'car-outline', color: '#000000' },
  lyft: { icon: 'car-sport-outline', color: '#FF00BF' },
  airbnb: { icon: 'bed-outline', color: '#FF5A5F' },
  groupon: { icon: 'pricetag-outline', color: '#53A318' },
};

/** Dining-related categories that match OpenTable */
const DINING_CATEGORIES = [
  'dining', 'restaurant', 'restaurants', 'food', 'cafe', 'coffee',
  'bar', 'bars', 'nightlife', 'brunch', 'breakfast', 'lunch', 'dinner',
  'italian', 'mexican', 'japanese', 'chinese', 'thai', 'indian',
  'american', 'seafood', 'steakhouse', 'sushi', 'pizza', 'bbq',
];

/**
 * Determines which affiliate partners are relevant for a recommendation
 */
export function getMatchingPartners(recommendation: Recommendation): MatchedPartner[] {
  const partners: MatchedPartner[] = [];
  const eventMetadata = (recommendation as any)?.event_metadata;
  const eventUrl: string | undefined = eventMetadata?.event_url;
  const category = recommendation.category?.toLowerCase() ?? '';
  const hasLocation = !!recommendation.activity?.location;

  // Dining → OpenTable
  if (DINING_CATEGORIES.includes(category)) {
    partners.push(buildMatchedPartner('opentable'));
  }

  // Event URL matching
  if (eventUrl && typeof eventUrl === 'string') {
    const urlLower = eventUrl.toLowerCase();
    if (urlLower.includes('ticketmaster')) {
      partners.push(buildMatchedPartner('ticketmaster'));
    }
    if (urlLower.includes('eventbrite')) {
      partners.push(buildMatchedPartner('eventbrite'));
    }
    if (urlLower.includes('fandango')) {
      partners.push(buildMatchedPartner('fandango'));
    }
  }

  // Ride-hail — always show when location exists
  if (hasLocation) {
    partners.push(buildMatchedPartner('uber'));
    partners.push(buildMatchedPartner('lyft'));
  }

  return partners;
}

function buildMatchedPartner(partnerId: AffiliatePartnerId): MatchedPartner {
  const rates = PARTNER_COMMISSION_RATES[partnerId];
  const visuals = PARTNER_VISUALS[partnerId];
  return {
    partnerId,
    ctaText: rates.ctaText,
    icon: visuals.icon,
    color: visuals.color,
    bookingType: rates.bookingType,
  };
}

/**
 * Builds a deep link + web fallback URL for a given affiliate partner
 */
export function buildBookingUrl(
  partnerId: AffiliatePartnerId,
  recommendation: Recommendation
): BookingUrls {
  const config = AFFILIATE_CONFIG[partnerId];
  const affiliateCode = config?.affiliateCode ?? '';
  const isEnabled = config?.enabled ?? false;
  const location = recommendation.activity?.location;
  const name = recommendation.title;
  const eventUrl: string | undefined = (recommendation as any)?.event_metadata?.event_url;
  const googlePlaceId = recommendation.activity?.googlePlaceId;

  switch (partnerId) {
    case 'uber': {
      if (!location) return { webUrl: 'https://www.uber.com' };
      const { latitude, longitude } = location;
      const encodedName = encodeURIComponent(name);
      const clientParam = isEnabled ? `&client_id=${affiliateCode}` : '';
      return {
        deepLink: `uber://?action=setPickup&dropoff[latitude]=${latitude}&dropoff[longitude]=${longitude}&dropoff[nickname]=${encodedName}${clientParam}`,
        webUrl: `https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${latitude}&dropoff[longitude]=${longitude}${clientParam}`,
      };
    }

    case 'lyft': {
      if (!location) return { webUrl: 'https://www.lyft.com' };
      const { latitude, longitude } = location;
      const clientParam = isEnabled ? `&partner=${affiliateCode}` : '';
      return {
        deepLink: `lyft://ridetype?id=lyft&destination[latitude]=${latitude}&destination[longitude]=${longitude}${clientParam}`,
        webUrl: `https://ride.lyft.com/ridetype?destination[latitude]=${latitude}&destination[longitude]=${longitude}${clientParam}`,
      };
    }

    case 'opentable': {
      const rid = googlePlaceId ?? '';
      const refParam = isEnabled ? affiliateCode : 'loop_app';
      return {
        webUrl: `https://www.opentable.com/restref/client/?rid=${rid}&ref=${refParam}`,
      };
    }

    case 'ticketmaster': {
      if (!eventUrl) return { webUrl: 'https://www.ticketmaster.com' };
      const separator = eventUrl.includes('?') ? '&' : '?';
      const camefrom = isEnabled ? affiliateCode : 'loop_app';
      return {
        webUrl: `${eventUrl}${separator}camefrom=${camefrom}`,
      };
    }

    case 'eventbrite': {
      if (!eventUrl) return { webUrl: 'https://www.eventbrite.com' };
      const separator = eventUrl.includes('?') ? '&' : '?';
      const aff = isEnabled ? affiliateCode : 'loop_app';
      return {
        webUrl: `${eventUrl}${separator}aff=${aff}`,
      };
    }

    case 'fandango': {
      if (!eventUrl) return { webUrl: 'https://www.fandango.com' };
      const separator = eventUrl.includes('?') ? '&' : '?';
      const ref = isEnabled ? affiliateCode : 'loop_app';
      return {
        webUrl: `${eventUrl}${separator}ref=${ref}`,
      };
    }

    case 'airbnb': {
      return {
        webUrl: `https://www.airbnb.com`,
      };
    }

    case 'groupon': {
      return {
        webUrl: `https://www.groupon.com`,
      };
    }

    default:
      return { webUrl: '' };
  }
}

/**
 * Logs an affiliate click to Supabase (fire-and-forget)
 */
export async function trackAffiliateClick(
  userId: string | undefined,
  partnerId: AffiliatePartnerId,
  recommendation: Recommendation,
  attributionSource: AttributionSource = 'feed'
): Promise<void> {
  if (!userId) return;

  const urls = buildBookingUrl(partnerId, recommendation);
  const rates = PARTNER_COMMISSION_RATES[partnerId];

  try {
    await supabase.from('affiliate_bookings').insert({
      user_id: userId,
      partner_id: partnerId,
      activity_name: recommendation.title,
      activity_category: recommendation.category,
      place_id: recommendation.activity?.googlePlaceId ?? null,
      booking_type: rates.bookingType,
      booking_url: urls.webUrl,
      commission_rate_at_booking: rates.rate,
      attribution_source: attributionSource,
      status: 'clicked',
      clicked_at: new Date().toISOString(),
    });
  } catch (error) {
    // Fire-and-forget — don't block the user
    console.warn('Failed to track affiliate click:', error);
  }
}

/**
 * Opens an affiliate link: builds URL, tracks click, opens in browser/app
 * Returns true if the link was opened successfully
 */
export async function openAffiliateLink(
  partnerId: AffiliatePartnerId,
  recommendation: Recommendation,
  userId?: string,
  attributionSource: AttributionSource = 'feed'
): Promise<boolean> {
  const urls = buildBookingUrl(partnerId, recommendation);

  // Track click (non-blocking)
  trackAffiliateClick(userId, partnerId, recommendation, attributionSource).catch((err) => {
    console.warn('[affiliate] trackAffiliateClick failed:', err?.message);
  });

  // Analytics tracking
  trackEvent('affiliate_link_clicked', { partnerId, activityName: recommendation.title, source: attributionSource }, userId);

  try {
    // Try deep link first
    if (urls.deepLink) {
      const canOpen = await Linking.canOpenURL(urls.deepLink);
      if (canOpen) {
        await Linking.openURL(urls.deepLink);
        return true;
      }
    }

    // Fall back to web URL
    if (urls.webUrl) {
      await Linking.openURL(urls.webUrl);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Failed to open ${partnerId} link:`, error);
    return false;
  }
}
