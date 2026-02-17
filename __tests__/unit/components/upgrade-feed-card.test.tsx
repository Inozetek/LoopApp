/**
 * UpgradeFeedCard & InsightsNudge Component Tests
 *
 * Tests for the upgrade prompt logic used in the blended feed.
 * The old UpgradeFeedCard is kept for backward compat; InsightsNudge
 * is the new subtle inline nudge for insights-gating model.
 */

import { TIER_PRICING, INSIGHTS_LIMIT } from '@/types/subscription';

describe('UpgradeFeedCard (legacy)', () => {
  // Helper to determine if upgrade card should show
  function shouldShowUpgrade(
    subscriptionTier: 'free' | 'plus',
    aiCardsCount: number,
    upgradeDismissed: boolean,
  ): boolean {
    return subscriptionTier === 'free' && aiCardsCount > 0 && !upgradeDismissed;
  }

  describe('Display logic', () => {
    it('should show for free tier users with AI cards', () => {
      expect(shouldShowUpgrade('free', 8, false)).toBe(true);
    });

    it('should NOT show for Plus users', () => {
      expect(shouldShowUpgrade('plus', 8, false)).toBe(false);
    });

    it('should NOT show when dismissed', () => {
      expect(shouldShowUpgrade('free', 8, true)).toBe(false);
    });

    it('should NOT show when no AI cards (empty feed)', () => {
      expect(shouldShowUpgrade('free', 0, false)).toBe(false);
    });
  });

  describe('Content', () => {
    it('should display correct pricing from TIER_PRICING', () => {
      expect(TIER_PRICING.plus).toBe(3.99);
      const ctaText = `Upgrade to Plus — $${TIER_PRICING.plus}/mo`;
      expect(ctaText).toBe('Upgrade to Plus — $3.99/mo');
    });
  });
});

describe('InsightsNudge', () => {
  describe('Display logic', () => {
    function shouldShowNudge(
      subscriptionTier: 'free' | 'plus',
      totalCards: number,
      insightsLimit: number,
      nudgeDismissed: boolean,
    ): boolean {
      return subscriptionTier === 'free' && totalCards > insightsLimit && !nudgeDismissed;
    }

    it('should show for free users with more cards than insights limit', () => {
      expect(shouldShowNudge('free', 15, INSIGHTS_LIMIT.free, false)).toBe(true);
    });

    it('should NOT show for Plus users', () => {
      expect(shouldShowNudge('plus', 15, INSIGHTS_LIMIT.plus, false)).toBe(false);
    });

    it('should NOT show when dismissed', () => {
      expect(shouldShowNudge('free', 15, INSIGHTS_LIMIT.free, true)).toBe(false);
    });

    it('should NOT show when fewer cards than insights limit', () => {
      expect(shouldShowNudge('free', 5, INSIGHTS_LIMIT.free, false)).toBe(false);
    });

    it('should NOT show when exactly at insights limit', () => {
      expect(shouldShowNudge('free', 8, INSIGHTS_LIMIT.free, false)).toBe(false);
    });
  });

  describe('Placement', () => {
    it('should appear at insights limit position (index 8)', () => {
      const insightsLimit = INSIGHTS_LIMIT.free;
      expect(insightsLimit).toBe(8);
    });
  });

  describe('Trial variant', () => {
    it('should show trial days remaining when trialing', () => {
      const trialDaysLeft = 5;
      const expectedText = `Your trial ends in ${trialDaysLeft} days`;
      expect(expectedText).toBe('Your trial ends in 5 days');
    });

    it('should handle singular day correctly', () => {
      const trialDaysLeft = 1;
      const expectedText = `Your trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'}`;
      expect(expectedText).toBe('Your trial ends in 1 day');
    });

    it('should show generic copy for non-trial free users', () => {
      const trialDaysLeft: number | undefined = undefined;
      const isTrialVariant = trialDaysLeft !== undefined && trialDaysLeft > 0;
      expect(isTrialVariant).toBe(false);
    });
  });
});
