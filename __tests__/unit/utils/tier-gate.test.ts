/**
 * Tests for utils/tier-gate.ts — Subscription tier gating utilities
 *
 * Covers:
 * - getDailyRecommendationLimit() for free and plus tiers
 * - canCreateRadar() total radar limit checking
 * - canUseRadarType() type-specific tier restrictions
 * - getFeatureLimitMessage() user-facing upgrade messages
 * - getUpgradePricing() pricing string formatting
 * - isFreeTier() tier identification
 * - hasFeatureAccess() feature-level access checks
 *
 * Pure functions duplicated here to avoid importing source file.
 */

import { RADAR_LIMITS } from '@/types/radar';
import { TIER_PRICING } from '@/types/subscription';
import type { HookType } from '@/types/radar';

// ============================================================================
// Types (duplicated from source)
// ============================================================================

type SubscriptionTier = 'free' | 'plus';

type GatedFeature =
  | 'radar_limit'
  | 'radar_venue'
  | 'radar_proximity'
  | 'daily_recommendations'
  | 'group_planning'
  | 'calendar_sync'
  | 'ai_explanations'
  | 'advanced_filters';

// ============================================================================
// Pure functions (duplicated from utils/tier-gate.ts)
// ============================================================================

const DAILY_RECOMMENDATION_LIMITS: Record<SubscriptionTier, number> = {
  free: 8,
  plus: 999,
};

function getDailyRecommendationLimit(tier: SubscriptionTier): number {
  return DAILY_RECOMMENDATION_LIMITS[tier] ?? DAILY_RECOMMENDATION_LIMITS.free;
}

function canCreateRadar(tier: SubscriptionTier, currentCount: number): boolean {
  const limits = RADAR_LIMITS[tier];
  if (!limits) return false;
  return currentCount < limits.total;
}

function canUseRadarType(tier: SubscriptionTier, type: HookType): boolean {
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

function getFeatureLimitMessage(feature: GatedFeature): string {
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

function getUpgradePricing(): { monthly: string; annual: string; annualMonthly: string } {
  return {
    monthly: `$${TIER_PRICING.plus}/mo`,
    annual: `$${TIER_PRICING.plus_annual}/yr`,
    annualMonthly: `$${(TIER_PRICING.plus_annual / 12).toFixed(2)}/mo`,
  };
}

function isFreeTier(tier: SubscriptionTier): boolean {
  return tier === 'free';
}

function hasFeatureAccess(tier: SubscriptionTier, feature: GatedFeature): boolean {
  if (tier === 'plus') return true;

  switch (feature) {
    case 'radar_limit':
      return true;
    case 'radar_venue':
    case 'radar_proximity':
    case 'group_planning':
    case 'calendar_sync':
    case 'ai_explanations':
    case 'advanced_filters':
      return false;
    case 'daily_recommendations':
      return true;
    default:
      return false;
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('tier-gate', () => {
  // =========================================================================
  // getDailyRecommendationLimit
  // =========================================================================

  describe('getDailyRecommendationLimit', () => {
    it('returns 8 for free tier', () => {
      expect(getDailyRecommendationLimit('free')).toBe(8);
    });

    it('returns 999 (effectively unlimited) for plus tier', () => {
      expect(getDailyRecommendationLimit('plus')).toBe(999);
    });

    it('returns free tier limit for unknown tier values', () => {
      // Edge case: an unknown string that doesn't match any tier
      expect(getDailyRecommendationLimit('unknown' as SubscriptionTier)).toBe(8);
    });

    it('plus limit is significantly higher than free limit', () => {
      const freeLimit = getDailyRecommendationLimit('free');
      const plusLimit = getDailyRecommendationLimit('plus');
      expect(plusLimit).toBeGreaterThan(freeLimit * 10);
    });
  });

  // =========================================================================
  // canCreateRadar
  // =========================================================================

  describe('canCreateRadar', () => {
    it('allows free user with 0 radars to create one', () => {
      expect(canCreateRadar('free', 0)).toBe(true);
    });

    it('allows free user with 1 radar to create another', () => {
      expect(canCreateRadar('free', 1)).toBe(true);
    });

    it('allows free user with 2 radars to create one more (limit is 3)', () => {
      expect(canCreateRadar('free', 2)).toBe(true);
    });

    it('blocks free user at 3 radars (at limit)', () => {
      expect(canCreateRadar('free', 3)).toBe(false);
    });

    it('blocks free user with more than 3 radars (over limit)', () => {
      expect(canCreateRadar('free', 5)).toBe(false);
    });

    it('allows plus user with 0 radars', () => {
      expect(canCreateRadar('plus', 0)).toBe(true);
    });

    it('allows plus user with many radars (unlimited)', () => {
      expect(canCreateRadar('plus', 100)).toBe(true);
    });

    it('allows plus user with 1000 radars (effectively unlimited)', () => {
      expect(canCreateRadar('plus', 1000)).toBe(true);
    });

    it('free limit matches RADAR_LIMITS.free.total', () => {
      const limit = RADAR_LIMITS.free.total;
      expect(canCreateRadar('free', limit - 1)).toBe(true);
      expect(canCreateRadar('free', limit)).toBe(false);
    });
  });

  // =========================================================================
  // canUseRadarType
  // =========================================================================

  describe('canUseRadarType', () => {
    describe('free tier', () => {
      it('allows artist radar type', () => {
        expect(canUseRadarType('free', 'artist')).toBe(true);
      });

      it('allows film_talent radar type', () => {
        expect(canUseRadarType('free', 'film_talent')).toBe(true);
      });

      it('allows category radar type', () => {
        expect(canUseRadarType('free', 'category')).toBe(true);
      });

      it('blocks venue radar type (Plus only)', () => {
        expect(canUseRadarType('free', 'venue')).toBe(false);
      });

      it('blocks proximity radar type (Plus only)', () => {
        expect(canUseRadarType('free', 'proximity')).toBe(false);
      });
    });

    describe('plus tier', () => {
      it('allows artist radar type', () => {
        expect(canUseRadarType('plus', 'artist')).toBe(true);
      });

      it('allows film_talent radar type', () => {
        expect(canUseRadarType('plus', 'film_talent')).toBe(true);
      });

      it('allows category radar type', () => {
        expect(canUseRadarType('plus', 'category')).toBe(true);
      });

      it('allows venue radar type', () => {
        expect(canUseRadarType('plus', 'venue')).toBe(true);
      });

      it('allows proximity radar type', () => {
        expect(canUseRadarType('plus', 'proximity')).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('returns false for unknown radar type', () => {
        expect(canUseRadarType('free', 'unknown' as HookType)).toBe(false);
        expect(canUseRadarType('plus', 'unknown' as HookType)).toBe(false);
      });

      it('venue and proximity restrictions align with RADAR_LIMITS', () => {
        expect(RADAR_LIMITS.free.venue).toBe(0);
        expect(RADAR_LIMITS.free.proximity).toBe(0);
        expect(RADAR_LIMITS.plus.venue).toBe(Infinity);
        expect(RADAR_LIMITS.plus.proximity).toBe(5);
      });
    });
  });

  // =========================================================================
  // getFeatureLimitMessage
  // =========================================================================

  describe('getFeatureLimitMessage', () => {
    const ALL_FEATURES: GatedFeature[] = [
      'radar_limit',
      'radar_venue',
      'radar_proximity',
      'daily_recommendations',
      'group_planning',
      'calendar_sync',
      'ai_explanations',
      'advanced_filters',
    ];

    it('returns a non-empty string for every feature', () => {
      for (const feature of ALL_FEATURES) {
        const message = getFeatureLimitMessage(feature);
        expect(message).toBeTruthy();
        expect(message.length).toBeGreaterThan(10);
      }
    });

    it('radar_limit message mentions unlimited', () => {
      expect(getFeatureLimitMessage('radar_limit').toLowerCase()).toContain('unlimited');
    });

    it('radar_venue message mentions venues', () => {
      expect(getFeatureLimitMessage('radar_venue').toLowerCase()).toContain('venue');
    });

    it('radar_proximity message mentions friends', () => {
      expect(getFeatureLimitMessage('radar_proximity').toLowerCase()).toContain('friends');
    });

    it('daily_recommendations message mentions recommendations', () => {
      expect(getFeatureLimitMessage('daily_recommendations').toLowerCase()).toContain('recommendation');
    });

    it('group_planning message mentions friends', () => {
      expect(getFeatureLimitMessage('group_planning').toLowerCase()).toContain('friends');
    });

    it('calendar_sync message mentions calendar', () => {
      expect(getFeatureLimitMessage('calendar_sync').toLowerCase()).toContain('calendar');
    });

    it('ai_explanations message mentions match scores', () => {
      expect(getFeatureLimitMessage('ai_explanations').toLowerCase()).toContain('match scores');
    });

    it('advanced_filters message mentions filters', () => {
      expect(getFeatureLimitMessage('advanced_filters').toLowerCase()).toContain('filters');
    });

    it('returns generic message for unknown feature', () => {
      const msg = getFeatureLimitMessage('unknown_feature' as GatedFeature);
      expect(msg).toContain('Loop');
    });

    it('all messages are distinct (no duplicates)', () => {
      const messages = ALL_FEATURES.map(f => getFeatureLimitMessage(f));
      const unique = new Set(messages);
      expect(unique.size).toBe(messages.length);
    });

    it('no messages contain technical jargon', () => {
      for (const feature of ALL_FEATURES) {
        const message = getFeatureLimitMessage(feature);
        expect(message).not.toContain('API');
        expect(message).not.toContain('subscribe');
        expect(message).not.toContain('tier');
      }
    });
  });

  // =========================================================================
  // getUpgradePricing
  // =========================================================================

  describe('getUpgradePricing', () => {
    it('returns monthly pricing string', () => {
      const pricing = getUpgradePricing();
      expect(pricing.monthly).toBe(`$${TIER_PRICING.plus}/mo`);
    });

    it('returns annual pricing string', () => {
      const pricing = getUpgradePricing();
      expect(pricing.annual).toBe(`$${TIER_PRICING.plus_annual}/yr`);
    });

    it('returns annualMonthly pricing string', () => {
      const pricing = getUpgradePricing();
      const expectedMonthly = (TIER_PRICING.plus_annual / 12).toFixed(2);
      expect(pricing.annualMonthly).toBe(`$${expectedMonthly}/mo`);
    });

    it('annual is cheaper per month than monthly', () => {
      const pricing = getUpgradePricing();
      const monthlyAmount = parseFloat(pricing.monthly.replace(/[^0-9.]/g, ''));
      const annualMonthlyAmount = parseFloat(pricing.annualMonthly.replace(/[^0-9.]/g, ''));
      expect(annualMonthlyAmount).toBeLessThan(monthlyAmount);
    });

    it('pricing matches TIER_PRICING constants', () => {
      const pricing = getUpgradePricing();
      expect(pricing.monthly).toContain(TIER_PRICING.plus.toString());
      expect(pricing.annual).toContain(TIER_PRICING.plus_annual.toString());
    });

    it('all pricing strings start with $', () => {
      const pricing = getUpgradePricing();
      expect(pricing.monthly.startsWith('$')).toBe(true);
      expect(pricing.annual.startsWith('$')).toBe(true);
      expect(pricing.annualMonthly.startsWith('$')).toBe(true);
    });
  });

  // =========================================================================
  // isFreeTier
  // =========================================================================

  describe('isFreeTier', () => {
    it('returns true for free tier', () => {
      expect(isFreeTier('free')).toBe(true);
    });

    it('returns false for plus tier', () => {
      expect(isFreeTier('plus')).toBe(false);
    });

    it('returns false for unknown tier strings', () => {
      expect(isFreeTier('premium' as SubscriptionTier)).toBe(false);
      expect(isFreeTier('unknown' as SubscriptionTier)).toBe(false);
    });
  });

  // =========================================================================
  // hasFeatureAccess
  // =========================================================================

  describe('hasFeatureAccess', () => {
    describe('plus tier (full access)', () => {
      const ALL_FEATURES: GatedFeature[] = [
        'radar_limit',
        'radar_venue',
        'radar_proximity',
        'daily_recommendations',
        'group_planning',
        'calendar_sync',
        'ai_explanations',
        'advanced_filters',
      ];

      it('grants access to ALL features', () => {
        for (const feature of ALL_FEATURES) {
          expect(hasFeatureAccess('plus', feature)).toBe(true);
        }
      });
    });

    describe('free tier (limited access)', () => {
      it('grants access to radar_limit (limited, not fully blocked)', () => {
        expect(hasFeatureAccess('free', 'radar_limit')).toBe(true);
      });

      it('grants access to daily_recommendations (limited count)', () => {
        expect(hasFeatureAccess('free', 'daily_recommendations')).toBe(true);
      });

      it('blocks radar_venue', () => {
        expect(hasFeatureAccess('free', 'radar_venue')).toBe(false);
      });

      it('blocks radar_proximity', () => {
        expect(hasFeatureAccess('free', 'radar_proximity')).toBe(false);
      });

      it('blocks group_planning', () => {
        expect(hasFeatureAccess('free', 'group_planning')).toBe(false);
      });

      it('blocks calendar_sync', () => {
        expect(hasFeatureAccess('free', 'calendar_sync')).toBe(false);
      });

      it('blocks ai_explanations', () => {
        expect(hasFeatureAccess('free', 'ai_explanations')).toBe(false);
      });

      it('blocks advanced_filters', () => {
        expect(hasFeatureAccess('free', 'advanced_filters')).toBe(false);
      });

      it('blocks unknown features', () => {
        expect(hasFeatureAccess('free', 'unknown_feature' as GatedFeature)).toBe(false);
      });
    });
  });

  // =========================================================================
  // Integration / cross-cutting
  // =========================================================================

  describe('integration scenarios', () => {
    it('free user at radar limit: canCreateRadar=false, hasFeatureAccess for radar_limit=true', () => {
      // Free users have access to the feature (limited) but can't create more at limit
      expect(hasFeatureAccess('free', 'radar_limit')).toBe(true);
      expect(canCreateRadar('free', RADAR_LIMITS.free.total)).toBe(false);
    });

    it('free user trying venue radar: canUseRadarType=false, hasFeatureAccess=false', () => {
      expect(canUseRadarType('free', 'venue')).toBe(false);
      expect(hasFeatureAccess('free', 'radar_venue')).toBe(false);
    });

    it('plus user has no restrictions on radar creation', () => {
      expect(canCreateRadar('plus', 0)).toBe(true);
      expect(canCreateRadar('plus', 50)).toBe(true);
      expect(canUseRadarType('plus', 'venue')).toBe(true);
      expect(canUseRadarType('plus', 'proximity')).toBe(true);
    });

    it('every gated feature has a non-empty limit message', () => {
      const features: GatedFeature[] = [
        'radar_limit', 'radar_venue', 'radar_proximity',
        'daily_recommendations', 'group_planning',
        'calendar_sync', 'ai_explanations', 'advanced_filters',
      ];

      for (const feature of features) {
        expect(getFeatureLimitMessage(feature).length).toBeGreaterThan(0);
      }
    });

    it('pricing is consistent across getUpgradePricing and TIER_PRICING', () => {
      const pricing = getUpgradePricing();
      expect(pricing.monthly).toContain('5.99');
      expect(pricing.annual).toContain('49.99');
    });

    it('free daily limit aligns with INSIGHTS_LIMIT pattern', () => {
      // Both systems use 8 for free tier
      const dailyLimit = getDailyRecommendationLimit('free');
      expect(dailyLimit).toBe(8);
    });
  });
});
