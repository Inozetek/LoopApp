/**
 * Feature Flags
 *
 * Centralized feature flag configuration for easy enable/disable of features.
 * Set environment variables in .env.local to control feature availability.
 *
 * REVERT STRATEGY: Change flag to 'false' in .env.local → restart app → feature disabled
 */

// Debug: Log environment variables when module loads
console.log('[FeatureFlags] Module loading...');
console.log('[FeatureFlags] EXPO_PUBLIC_ENABLE_TICKETMASTER:', process.env.EXPO_PUBLIC_ENABLE_TICKETMASTER);
console.log('[FeatureFlags] EXPO_PUBLIC_ENABLE_YELP:', process.env.EXPO_PUBLIC_ENABLE_YELP);
console.log('[FeatureFlags] EXPO_PUBLIC_ENABLE_GROUPON:', process.env.EXPO_PUBLIC_ENABLE_GROUPON);
console.log('[FeatureFlags] EXPO_PUBLIC_ENABLE_SONGKICK:', process.env.EXPO_PUBLIC_ENABLE_SONGKICK);
console.log('[FeatureFlags] EXPO_PUBLIC_ENABLE_EVENTBRITE:', process.env.EXPO_PUBLIC_ENABLE_EVENTBRITE);
console.log('[FeatureFlags] EXPO_PUBLIC_ENABLE_MIXED_FEED:', process.env.EXPO_PUBLIC_ENABLE_MIXED_FEED);

export const FEATURE_FLAGS = {
  /**
   * Enable Ticketmaster integration for event-based recommendations
   * Free tier: 5000 requests/day, 5 requests/second
   */
  ENABLE_TICKETMASTER: process.env.EXPO_PUBLIC_ENABLE_TICKETMASTER === 'true',

  /**
   * Enable Yelp integration for enhanced place reviews/ratings
   * NOTE: No free tier available - POSTPONED until paying customers
   * Cost: Paid plans start at ~$50/month
   * Status: Service built and ready, awaiting revenue to justify cost
   */
  ENABLE_YELP: process.env.EXPO_PUBLIC_ENABLE_YELP === 'true',

  /**
   * Enable Groupon integration for daily deals and discounts
   * Free tier: 10000 requests/day
   */
  ENABLE_GROUPON: process.env.EXPO_PUBLIC_ENABLE_GROUPON === 'true',

  /**
   * Enable Songkick integration for live music and concert events
   * NOTE: No free tier - starts at $500/month - POSTPONED until revenue
   * Alternative: Using Ticketmaster (free tier) for events instead
   * Status: Service built and ready, awaiting revenue to justify cost
   */
  ENABLE_SONGKICK: process.env.EXPO_PUBLIC_ENABLE_SONGKICK === 'true',

  /**
   * Enable Fandango integration for movie showtimes and tickets
   * Requires partnership approval (2-4 weeks)
   */
  ENABLE_FANDANGO: process.env.EXPO_PUBLIC_ENABLE_FANDANGO === 'true',

  /**
   * Enable OpenTable integration for restaurant reservations
   * Requires partnership approval (2-4 weeks)
   */
  ENABLE_OPENTABLE: process.env.EXPO_PUBLIC_ENABLE_OPENTABLE === 'true',

  /**
   * Enable Meetup.com integration for group events and activities
   * Free tier: 200 requests/hour
   */
  ENABLE_MEETUP: process.env.EXPO_PUBLIC_ENABLE_MEETUP === 'true',

  /**
   * Enable Eventbrite integration for community events, workshops, classes
   * STATUS: DISABLED - Search API deprecated since Feb 2020
   * The /events/search endpoint returns 404. Only org/venue-based queries work.
   * Alternatives evaluated:
   *   - PredictHQ: No free API access after 14-day trial
   *   - OpenWeb Ninja: Only 100 req/month on free tier
   *   - Facebook Events: API heavily restricted by Meta
   * Decision: Rely on Ticketmaster for events until revenue justifies paid APIs
   * Re-evaluate when Groupon is approved (fills deals/experiences gap)
   */
  ENABLE_EVENTBRITE: process.env.EXPO_PUBLIC_ENABLE_EVENTBRITE === 'true',

  /**
   * Enable mixed feed blending multiple sources (Google + Ticketmaster + Yelp + Groupon + Songkick)
   * When disabled, falls back to Google Places only
   */
  ENABLE_MIXED_FEED: process.env.EXPO_PUBLIC_ENABLE_MIXED_FEED === 'true',

  /**
   * Enable YouTube-style bottom sheet menus
   * When disabled, falls back to existing modals
   */
  ENABLE_BOTTOM_SHEETS: process.env.EXPO_PUBLIC_ENABLE_BOTTOM_SHEETS === 'true',
} as const;

console.log('[FeatureFlags] Computed flags:', FEATURE_FLAGS);

/**
 * Helper function to check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[feature];
}

/**
 * Get all enabled features (for logging/debugging)
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(FEATURE_FLAGS)
    .filter(([_, enabled]) => enabled)
    .map(([feature]) => feature);
}
