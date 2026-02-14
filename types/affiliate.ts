/**
 * Affiliate Commission & Booking Tracking Types
 * Supports: OpenTable, Fandango, Uber, Lyft, Eventbrite, Ticketmaster, Airbnb, Groupon
 */

export type AffiliatePartnerId =
  | 'opentable'
  | 'fandango'
  | 'uber'
  | 'lyft'
  | 'eventbrite'
  | 'ticketmaster'
  | 'airbnb'
  | 'groupon';

export type BookingType = 'reservation' | 'ticket' | 'ride' | 'deal' | 'lodging';

export type BookingStatus = 'clicked' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'expired';

export type AttributionSource = 'feed' | 'explore' | 'calendar' | 'group_plan' | 'notification' | 'search';

export interface AffiliatePartner {
  id: AffiliatePartnerId;
  name: string;
  category: string;
  commissionType: 'percentage' | 'flat_rate' | 'tiered';
  commissionRate: number; // percentage or cents depending on type
  minCommissionCents: number;
  maxCommissionCents?: number;
  isActive: boolean;
  deepLinkTemplate?: string;
}

export interface AffiliateBooking {
  id: string;
  userId: string;
  partnerId: AffiliatePartnerId;

  // What was booked
  activityName: string;
  activityCategory?: string;
  placeId?: string;
  recommendationId?: string;

  // Booking details
  bookingType: BookingType;
  bookingUrl: string;

  // Financial
  transactionAmountCents?: number;
  commissionRateAtBooking: number;
  estimatedCommissionCents?: number;

  // Status
  status: BookingStatus;
  clickedAt: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;

  // Attribution
  attributionSource: AttributionSource;
}

export interface ReferralReward {
  id: string;
  referrerId: string;
  referredId: string;
  source: 'group_invite' | 'share_link' | 'referral_code' | 'sms_invite';
  groupPlanId?: string;

  referrerRewardType: string;
  referrerRewardValue: number; // days of Premium
  referredRewardType: string;
  referredRewardValue: number;

  status: 'pending' | 'completed' | 'rewarded' | 'expired';
  referredCompletedOnboarding: boolean;
  rewardedAt?: string;
}

/**
 * Commission rates by partner (mirrors DB config)
 * Used client-side for displaying estimated earnings and "Book through Loop" CTAs
 */
export const PARTNER_COMMISSION_RATES: Record<AffiliatePartnerId, {
  name: string;
  rate: number;
  type: 'percentage' | 'flat_rate';
  bookingType: BookingType;
  ctaText: string; // "Reserve on OpenTable", "Get Tickets", etc.
}> = {
  opentable: { name: 'OpenTable', rate: 10, type: 'percentage', bookingType: 'reservation', ctaText: 'Reserve a Table' },
  fandango: { name: 'Fandango', rate: 15, type: 'percentage', bookingType: 'ticket', ctaText: 'Get Tickets' },
  uber: { name: 'Uber', rate: 500, type: 'flat_rate', bookingType: 'ride', ctaText: 'Get a Ride' },
  lyft: { name: 'Lyft', rate: 500, type: 'flat_rate', bookingType: 'ride', ctaText: 'Get a Ride' },
  eventbrite: { name: 'Eventbrite', rate: 5, type: 'percentage', bookingType: 'ticket', ctaText: 'Get Tickets' },
  ticketmaster: { name: 'Ticketmaster', rate: 8, type: 'percentage', bookingType: 'ticket', ctaText: 'Get Tickets' },
  airbnb: { name: 'Airbnb', rate: 3, type: 'percentage', bookingType: 'lodging', ctaText: 'Book Stay' },
  groupon: { name: 'Groupon', rate: 5, type: 'percentage', bookingType: 'deal', ctaText: 'Get Deal' },
};

/**
 * Growth-mode referral incentive configuration
 * Adjust these values as the app scales
 */
export const REFERRAL_INCENTIVES = {
  // What the referrer gets per successful signup
  referrerReward: {
    type: 'premium_days' as const,
    value: 7, // 1 week of Premium per referral
    maxStack: 90, // Max 3 months earned through referrals
  },
  // What the new user gets
  referredReward: {
    type: 'premium_days' as const,
    value: 30, // 1 month of Premium free
  },
  // Ambassador threshold
  ambassadorThreshold: 5, // 5+ referrals = Loop Ambassador
  ambassadorDiscount: 50, // 50% off Premium permanently
};
