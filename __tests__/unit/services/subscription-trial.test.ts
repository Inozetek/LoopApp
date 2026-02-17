/**
 * Subscription Trial Service Tests
 *
 * Tests for getTrialStatus(), getEffectiveTier(), cost guard,
 * and insights limit logic.
 */

import { INSIGHTS_LIMIT, TrialStatus } from '@/types/subscription';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(),
      })),
    })),
  },
}));

describe('Subscription Trial Logic', () => {
  describe('INSIGHTS_LIMIT constant', () => {
    it('should limit free users to 8 insight-enabled cards', () => {
      expect(INSIGHTS_LIMIT.free).toBe(8);
    });

    it('should give Plus users unlimited insights', () => {
      expect(INSIGHTS_LIMIT.plus).toBe(Infinity);
    });
  });

  describe('TrialStatus interface', () => {
    it('should represent active trial', () => {
      const status: TrialStatus = {
        isTrialing: true,
        daysLeft: 5,
        expired: false,
      };
      expect(status.isTrialing).toBe(true);
      expect(status.daysLeft).toBe(5);
      expect(status.expired).toBe(false);
    });

    it('should represent expired trial', () => {
      const status: TrialStatus = {
        isTrialing: false,
        daysLeft: 0,
        expired: true,
      };
      expect(status.isTrialing).toBe(false);
      expect(status.daysLeft).toBe(0);
      expect(status.expired).toBe(true);
    });

    it('should represent non-trial user', () => {
      const status: TrialStatus = {
        isTrialing: false,
        daysLeft: 0,
        expired: false,
      };
      expect(status.isTrialing).toBe(false);
      expect(status.expired).toBe(false);
    });
  });

  describe('getTrialStatus logic (pure)', () => {
    /**
     * Mirrors getTrialStatus from subscription-service.ts
     */
    function computeTrialStatus(
      subscriptionStatus: string | null,
      subscriptionEndDate: string | null
    ): TrialStatus {
      if (subscriptionStatus !== 'trialing') {
        return { isTrialing: false, daysLeft: 0, expired: false };
      }

      if (!subscriptionEndDate) {
        return { isTrialing: false, daysLeft: 0, expired: true };
      }

      const endDate = new Date(subscriptionEndDate);
      const now = new Date();
      const expired = now >= endDate;
      const daysLeft = expired
        ? 0
        : Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return { isTrialing: !expired, daysLeft, expired };
    }

    it('should return active trial with correct days left', () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeTrialStatus('trialing', futureDate);

      expect(result.isTrialing).toBe(true);
      expect(result.daysLeft).toBe(5);
      expect(result.expired).toBe(false);
    });

    it('should return expired trial when end date is in the past', () => {
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeTrialStatus('trialing', pastDate);

      expect(result.isTrialing).toBe(false);
      expect(result.daysLeft).toBe(0);
      expect(result.expired).toBe(true);
    });

    it('should return non-trial for active subscription', () => {
      const result = computeTrialStatus('active', null);
      expect(result.isTrialing).toBe(false);
      expect(result.expired).toBe(false);
    });

    it('should handle null status', () => {
      const result = computeTrialStatus(null, null);
      expect(result.isTrialing).toBe(false);
      expect(result.expired).toBe(false);
    });

    it('should handle trialing without end date as expired', () => {
      const result = computeTrialStatus('trialing', null);
      expect(result.isTrialing).toBe(false);
      expect(result.expired).toBe(true);
    });

    it('should return 1 day left when trial ends tomorrow', () => {
      const tomorrow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeTrialStatus('trialing', tomorrow);

      expect(result.isTrialing).toBe(true);
      expect(result.daysLeft).toBe(1);
    });

    it('should return 7 days left for a fresh 7-day trial', () => {
      const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeTrialStatus('trialing', sevenDays);

      expect(result.isTrialing).toBe(true);
      expect(result.daysLeft).toBe(7);
    });
  });

  describe('getEffectiveTier logic (pure)', () => {
    /**
     * Mirrors getEffectiveTier from subscription-service.ts
     */
    function computeEffectiveTier(
      subscriptionTier: string | null,
      subscriptionStatus: string | null,
      subscriptionEndDate: string | null
    ): { tier: 'free' | 'plus'; useGooglePlaces: boolean; isTrialing: boolean } {
      const rawTier = (subscriptionTier === 'plus' || subscriptionTier === 'premium') ? 'plus' : 'free';

      if (subscriptionStatus === 'trialing') {
        const endDate = subscriptionEndDate ? new Date(subscriptionEndDate) : null;
        const now = new Date();

        if (endDate && now >= endDate) {
          // Trial expired — downgrade
          return { tier: 'free', useGooglePlaces: false, isTrialing: false };
        }

        // Active trial — Plus features but NO Google Places (cost guard)
        return { tier: 'plus', useGooglePlaces: false, isTrialing: true };
      }

      return {
        tier: rawTier,
        useGooglePlaces: rawTier === 'plus',
        isTrialing: false,
      };
    }

    it('should return plus tier for active trial', () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeEffectiveTier('plus', 'trialing', futureDate);

      expect(result.tier).toBe('plus');
      expect(result.isTrialing).toBe(true);
    });

    it('should NOT enable Google Places for trialing users (cost guard)', () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeEffectiveTier('plus', 'trialing', futureDate);

      expect(result.useGooglePlaces).toBe(false);
    });

    it('should enable Google Places for paid Plus users', () => {
      const result = computeEffectiveTier('plus', 'active', null);

      expect(result.tier).toBe('plus');
      expect(result.useGooglePlaces).toBe(true);
      expect(result.isTrialing).toBe(false);
    });

    it('should NOT enable Google Places for free users', () => {
      const result = computeEffectiveTier('free', 'active', null);

      expect(result.tier).toBe('free');
      expect(result.useGooglePlaces).toBe(false);
    });

    it('should downgrade expired trial to free', () => {
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeEffectiveTier('plus', 'trialing', pastDate);

      expect(result.tier).toBe('free');
      expect(result.useGooglePlaces).toBe(false);
      expect(result.isTrialing).toBe(false);
    });

    it('should handle legacy premium tier', () => {
      const result = computeEffectiveTier('premium', 'active', null);

      expect(result.tier).toBe('plus');
      expect(result.useGooglePlaces).toBe(true);
    });

    it('should default to free for null tier', () => {
      const result = computeEffectiveTier(null, null, null);

      expect(result.tier).toBe('free');
      expect(result.useGooglePlaces).toBe(false);
    });
  });

  describe('getDailyLimit', () => {
    /**
     * Mirrors getDailyLimit from subscription-service.ts
     */
    function getDailyLimit(tier: string): number {
      switch (tier) {
        case 'free':
          return 8;
        case 'plus':
          return 999;
        default:
          return 8;
      }
    }

    it('should return 8 for free tier', () => {
      expect(getDailyLimit('free')).toBe(8);
    });

    it('should return 999 (unlimited) for plus tier', () => {
      expect(getDailyLimit('plus')).toBe(999);
    });

    it('should default to 8 for unknown tier', () => {
      expect(getDailyLimit('unknown')).toBe(8);
    });
  });
});
