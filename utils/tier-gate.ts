/**
 * Tier Gate — Subscription tier checking utilities
 *
 * Pure functions for checking feature access by subscription tier.
 * Used by components to decide whether to show upgrade prompts.
 *
 * 2-tier model: Free ($0) + Loop Plus ($5.99/mo, $49.99/yr)
 */

import type { SubscriptionTier } from '@/types/subscription';
import type { HookType } from '@/types/radar';
import { RADAR_LIMITS } from '@/types/radar';
import { TIER_PRICING } from '@/types/subscription';

// ============================================================================
// DAILY RECOMMENDATION LIMITS
// ============================================================================

/** Daily recommendation limits per tier */
const DAILY_RECOMMENDATION_LIMITS: Record<SubscriptionTier, number> = {
  free: 8,
  plus: 999, // Effectively unlimited
};

/**
 * Get the daily recommendation limit for a given tier.
 */
export function getDailyRecommendationLimit(tier: SubscriptionTier): number {
  return DAILY_RECOMMENDATION_LIMITS[tier] ?? DAILY_RECOMMENDATION_LIMITS.free;
}

// ============================================================================
// RADAR GATING
// ============================================================================

/**
 * Check if a user can create a new radar given their tier and current count.
 *
 * @param tier - The user's subscription tier
 * @param currentCount - Number of active radars the user currently has
 * @returns true if the user can create another radar
 */
export function canCreateRadar(tier: SubscriptionTier, currentCount: number): boolean {
  const limits = RADAR_LIMITS[tier];
  if (!limits) return false;
  return currentCount < limits.total;
}

/**
 * Check if a user can use a specific radar type given their tier.
 *
 * Free users cannot use 'venue' or 'proximity' radar types.
 *
 * @param tier - The user's subscription tier
 * @param type - The radar type to check
 * @returns true if the user can use this radar type
 */
export function canUseRadarType(tier: SubscriptionTier, type: HookType): boolean {
  const limits = RADAR_LIMITS[tier];
  if (!limits) return false;

  switch (type) {
    case 'venue':
      return limits.venue > 0;
    case 'proximity':
      return limits.proximity > 0;
    case 'artist':
    case 'film_talent':
      return limits.artistOrFilm > 0;
    case 'category':
      return limits.category > 0;
    default:
      return false;
  }
}

// ============================================================================
// FEATURE LIMIT MESSAGES
// ============================================================================

/** Feature keys that can trigger upgrade prompts */
export type GatedFeature =
  | 'radar_limit'
  | 'radar_venue'
  | 'radar_proximity'
  | 'daily_recommendations'
  | 'group_planning'
  | 'calendar_sync'
  | 'ai_explanations'
  | 'advanced_filters';

/**
 * Get a user-facing message describing what the user unlocks by upgrading.
 * These messages are feature-specific and designed to feel enticing, not blocking.
 *
 * @param feature - The feature that triggered the upgrade prompt
 * @returns A user-facing message string
 */
export function getFeatureLimitMessage(feature: GatedFeature): string {
  switch (feature) {
    case 'radar_limit':
      return 'Create unlimited radars to never miss what matters to you.';
    case 'radar_venue':
      return 'Follow your favorite venues and get alerted about new events and specials.';
    case 'radar_proximity':
      return 'Get notified when friends are nearby and free to hang out.';
    case 'daily_recommendations':
      return 'Get unlimited personalized recommendations every day.';
    case 'group_planning':
      return 'Plan activities with up to 10 friends and find the perfect spot for everyone.';
    case 'calendar_sync':
      return 'Sync your Loop activities with Google Calendar and Apple Calendar automatically.';
    case 'ai_explanations':
      return 'See AI-powered match scores and personalized explanations on every recommendation.';
    case 'advanced_filters':
      return 'Fine-tune your recommendations with advanced filters like price range, ratings, and distance.';
    default:
      return 'Unlock the full Loop experience with Loop Plus.';
  }
}

/**
 * Get the formatted pricing string for upgrade prompts.
 */
export function getUpgradePricing(): { monthly: string; annual: string; annualMonthly: string } {
  return {
    monthly: `$${TIER_PRICING.plus}/mo`,
    annual: `$${TIER_PRICING.plus_annual}/yr`,
    annualMonthly: `$${(TIER_PRICING.plus_annual / 12).toFixed(2)}/mo`,
  };
}

/**
 * Check if a given tier is the free tier.
 */
export function isFreeTier(tier: SubscriptionTier): boolean {
  return tier === 'free';
}

/**
 * Check if a given tier has access to a specific feature.
 */
export function hasFeatureAccess(tier: SubscriptionTier, feature: GatedFeature): boolean {
  if (tier === 'plus') return true;

  // Free tier has limited access
  switch (feature) {
    case 'radar_limit':
      return true; // Free users can create up to 3 radars
    case 'radar_venue':
    case 'radar_proximity':
    case 'group_planning':
    case 'calendar_sync':
    case 'ai_explanations':
    case 'advanced_filters':
      return false;
    case 'daily_recommendations':
      return true; // Free users have daily recommendations, just limited count
    default:
      return false;
  }
}
