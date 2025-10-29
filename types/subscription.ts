/**
 * Subscription Tiers & Limits
 *
 * Strategy: Generous free tier with feature-gating (not quantity limits)
 * Free users get unlimited recommendations from database, but limited refresh frequency
 */

export type SubscriptionTier = 'free' | 'plus' | 'premium';

export interface TierLimits {
  // Refresh frequency
  refresh_interval_hours: number; // 0 = unlimited

  // Recommendations per refresh
  recommendations_per_refresh: number;

  // Data sources
  use_database: boolean;
  use_google_places: boolean;
  google_api_calls_per_day: number;

  // Features
  group_planning: boolean;
  max_group_size: number;
  calendar_sync: boolean;
  ai_explanations: boolean;
  advanced_filters: boolean;
  multi_day_itinerary: boolean;
  ai_concierge: boolean;

  // UI
  show_ads: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    // Refresh limits
    refresh_interval_hours: 4, // Can refresh 6x per day
    recommendations_per_refresh: 8, // ~48 recs/day total

    // Data sources
    use_database: true,
    use_google_places: false, // Database only
    google_api_calls_per_day: 0,

    // Features
    group_planning: false,
    max_group_size: 0,
    calendar_sync: false,
    ai_explanations: false,
    advanced_filters: false,
    multi_day_itinerary: false,
    ai_concierge: false,

    // UI
    show_ads: true,
  },

  plus: {
    // Refresh limits
    refresh_interval_hours: 1, // Can refresh 24x per day
    recommendations_per_refresh: 10, // ~240 recs/day total

    // Data sources
    use_database: true,
    use_google_places: true, // Fresh discoveries enabled
    google_api_calls_per_day: 10,

    // Features
    group_planning: true,
    max_group_size: 5,
    calendar_sync: true,
    ai_explanations: true,
    advanced_filters: true,
    multi_day_itinerary: false,
    ai_concierge: false,

    // UI
    show_ads: false,
  },

  premium: {
    // Refresh limits
    refresh_interval_hours: 0, // Unlimited refreshes
    recommendations_per_refresh: 10,

    // Data sources
    use_database: true,
    use_google_places: true, // All sources, real-time
    google_api_calls_per_day: 50,

    // Features
    group_planning: true,
    max_group_size: 20,
    calendar_sync: true,
    ai_explanations: true,
    advanced_filters: true,
    multi_day_itinerary: true,
    ai_concierge: true,

    // UI
    show_ads: false,
  },
};

/**
 * Tier pricing (monthly)
 */
export const TIER_PRICING = {
  free: 0,
  plus: 4.99,
  premium: 9.99,
} as const;

/**
 * Tier display names
 */
export const TIER_NAMES = {
  free: 'Loop Free',
  plus: 'Loop Plus',
  premium: 'Loop Premium',
} as const;

/**
 * User-facing tier badges
 */
export const TIER_BADGES = {
  free: {
    label: 'Free',
    color: '#8E8E93', // iOS gray
    emoji: '🔵',
  },
  plus: {
    label: 'Plus',
    color: '#00D9A3', // Loop Green
    emoji: '🟢',
  },
  premium: {
    label: 'Premium',
    color: '#FF9500', // iOS orange
    emoji: '🔴',
  },
} as const;

/**
 * Data freshness indicators (user-facing)
 */
export const DATA_FRESHNESS_LABELS = {
  free: {
    status: 'Curated',
    description: 'Updated every few hours',
    color: '#8E8E93',
  },
  plus: {
    status: 'LIVE',
    description: 'Fresh discoveries',
    color: '#00D9A3',
  },
  premium: {
    status: 'REAL-TIME',
    description: 'Instant updates',
    color: '#FF9500',
  },
} as const;
