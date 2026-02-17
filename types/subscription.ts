/**
 * Subscription Tiers & Limits
 *
 * 2-tier model: Free ($0) + Loop Plus ($3.99/mo, $29.99/yr)
 * Premium tier eliminated — features like itinerary planning and AI concierge
 * will ship when ready, and Plus limits will expand to include them.
 *
 * Strategy: Generous free tier with feature-gating (not quantity limits)
 * Free users get unlimited recommendations from database, but limited refresh frequency
 */

export type SubscriptionTier = 'free' | 'plus';

/**
 * Number of cards per session that show AI insights (match score, explanation, time chip, Loop Pick)
 * Free users see insights on first 8 cards; Plus users see insights on all cards.
 */
export const INSIGHTS_LIMIT = {
  free: 8,
  plus: Infinity,
} as const;

/**
 * Reverse trial status for new users (7-day Plus trial)
 */
export interface TrialStatus {
  isTrialing: boolean;
  daysLeft: number;
  expired: boolean;
}

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

    // UI
    show_ads: true,
  },

  plus: {
    // Refresh limits — unlimited
    refresh_interval_hours: 0,
    recommendations_per_refresh: 10,

    // Data sources
    use_database: true,
    use_google_places: true, // Fresh discoveries enabled
    google_api_calls_per_day: 50,

    // Features
    group_planning: true,
    max_group_size: 10, // Merged from former Premium tier
    calendar_sync: true,
    ai_explanations: true,
    advanced_filters: true,

    // UI
    show_ads: false,
  },
};

/**
 * Tier pricing
 */
export const TIER_PRICING = {
  free: 0,
  plus: 3.99,
  plus_annual: 29.99, // 37% annual discount
} as const;

/**
 * Tier display names
 */
export const TIER_NAMES: Record<SubscriptionTier, string> = {
  free: 'Loop Free',
  plus: 'Loop Plus',
};

/**
 * User-facing tier badges
 */
export const TIER_BADGES: Record<SubscriptionTier, { label: string; color: string; emoji: string }> = {
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
};

/**
 * Radar (hooks) limits per tier — re-exported from types/radar.ts for convenience
 */
export { RADAR_LIMITS } from './radar';
export type { RadarLimits } from './radar';

/**
 * Data freshness indicators (user-facing)
 */
export const DATA_FRESHNESS_LABELS: Record<SubscriptionTier, { status: string; description: string; color: string }> = {
  free: {
    status: 'Curated',
    description: 'Updated every few hours',
    color: '#8E8E93',
  },
  plus: {
    status: 'LIVE',
    description: 'Fresh discoveries in real-time',
    color: '#00D9A3',
  },
};
