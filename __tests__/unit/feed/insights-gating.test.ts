/**
 * Insights Gating Tests
 *
 * Tests the blended feed logic for showInsights per card,
 * insights_nudge insertion, and tier-based behavior.
 */

import { INSIGHTS_LIMIT } from '@/types/subscription';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  },
}));

interface MockRecommendation {
  id: string;
  title: string;
  isSponsored: boolean;
  cardType?: string;
  showInsights?: boolean;
}

/**
 * Mirrors blendedFeed logic from app/(tabs)/index.tsx
 */
function buildBlendedFeed(
  recommendations: MockRecommendation[],
  options: {
    subscriptionTier: 'free' | 'plus';
    insightsLimit: number;
    upgradeDismissed: boolean;
    trialExpired?: boolean;
  }
): MockRecommendation[] {
  const { subscriptionTier, insightsLimit, upgradeDismissed, trialExpired } = options;
  const isPlus = subscriptionTier === 'plus';

  const items: MockRecommendation[] = [];
  let sponsoredInFirstTen = 0;

  recommendations.forEach((r, i) => {
    // Enforce max 2 sponsored in first 10 cards
    if (r.isSponsored && i < 10) {
      if (sponsoredInFirstTen >= 2) return;
      sponsoredInFirstTen++;
    }

    items.push({
      ...r,
      cardType: r.cardType || 'ai_curated',
      showInsights: isPlus || i < insightsLimit,
    });
  });

  // Insert insights nudge for free users
  if (!isPlus && items.length > insightsLimit && !upgradeDismissed) {
    items.splice(insightsLimit, 0, {
      id: 'insights-nudge',
      cardType: 'insights_nudge',
      title: '',
      isSponsored: false,
      showInsights: false,
    });
  }

  return items;
}

function createMockRecs(count: number, sponsoredIndices: number[] = []): MockRecommendation[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `rec-${i}`,
    title: `Place ${i}`,
    isSponsored: sponsoredIndices.includes(i),
  }));
}

describe('Insights Gating - Feed Blending', () => {
  describe('Free user behavior', () => {
    it('should show insights on first 8 cards only', () => {
      const recs = createMockRecs(15);
      const feed = buildBlendedFeed(recs, {
        subscriptionTier: 'free',
        insightsLimit: INSIGHTS_LIMIT.free,
        upgradeDismissed: false,
      });

      // First 8 cards should have showInsights = true
      for (let i = 0; i < 8; i++) {
        expect(feed[i].showInsights).toBe(true);
      }
    });

    it('should hide insights after card 8', () => {
      const recs = createMockRecs(15);
      const feed = buildBlendedFeed(recs, {
        subscriptionTier: 'free',
        insightsLimit: INSIGHTS_LIMIT.free,
        upgradeDismissed: false,
      });

      // Card at index 8 is the insights_nudge
      // Cards after the nudge should have showInsights = false
      const regularCards = feed.filter(c => c.cardType !== 'insights_nudge');
      for (let i = 8; i < regularCards.length; i++) {
        expect(regularCards[i].showInsights).toBe(false);
      }
    });

    it('should insert insights_nudge at position 8 for free users', () => {
      const recs = createMockRecs(15);
      const feed = buildBlendedFeed(recs, {
        subscriptionTier: 'free',
        insightsLimit: INSIGHTS_LIMIT.free,
        upgradeDismissed: false,
      });

      expect(feed[8].cardType).toBe('insights_nudge');
      expect(feed[8].id).toBe('insights-nudge');
    });

    it('should NOT insert nudge when dismissed', () => {
      const recs = createMockRecs(15);
      const feed = buildBlendedFeed(recs, {
        subscriptionTier: 'free',
        insightsLimit: INSIGHTS_LIMIT.free,
        upgradeDismissed: true,
      });

      const nudges = feed.filter(c => c.cardType === 'insights_nudge');
      expect(nudges.length).toBe(0);
    });

    it('should NOT insert nudge when fewer cards than limit', () => {
      const recs = createMockRecs(5);
      const feed = buildBlendedFeed(recs, {
        subscriptionTier: 'free',
        insightsLimit: INSIGHTS_LIMIT.free,
        upgradeDismissed: false,
      });

      const nudges = feed.filter(c => c.cardType === 'insights_nudge');
      expect(nudges.length).toBe(0);
      // All 5 cards should still have insights
      feed.forEach(c => {
        expect(c.showInsights).toBe(true);
      });
    });
  });

  describe('Plus user behavior', () => {
    it('should show insights on ALL cards', () => {
      const recs = createMockRecs(20);
      const feed = buildBlendedFeed(recs, {
        subscriptionTier: 'plus',
        insightsLimit: INSIGHTS_LIMIT.plus,
        upgradeDismissed: false,
      });

      feed.forEach(c => {
        expect(c.showInsights).toBe(true);
      });
    });

    it('should NOT insert insights nudge', () => {
      const recs = createMockRecs(20);
      const feed = buildBlendedFeed(recs, {
        subscriptionTier: 'plus',
        insightsLimit: INSIGHTS_LIMIT.plus,
        upgradeDismissed: false,
      });

      const nudges = feed.filter(c => c.cardType === 'insights_nudge');
      expect(nudges.length).toBe(0);
    });
  });

  describe('Trialing user behavior', () => {
    it('should show insights on all cards (treated as Plus)', () => {
      const recs = createMockRecs(15);
      // Trialing users have effective tier = 'plus'
      const feed = buildBlendedFeed(recs, {
        subscriptionTier: 'plus', // getEffectiveTier returns 'plus' for trialing
        insightsLimit: INSIGHTS_LIMIT.plus,
        upgradeDismissed: false,
      });

      feed.forEach(c => {
        expect(c.showInsights).toBe(true);
      });
    });
  });

  describe('Sponsored card limits', () => {
    it('should allow max 2 sponsored cards in first 10', () => {
      // Create 15 recs with 4 sponsored in first 10
      const recs = createMockRecs(15, [0, 2, 4, 6]);
      const feed = buildBlendedFeed(recs, {
        subscriptionTier: 'plus',
        insightsLimit: INSIGHTS_LIMIT.plus,
        upgradeDismissed: false,
      });

      // Count sponsored in final feed
      const sponsoredCards = feed.filter(c => c.isSponsored);
      expect(sponsoredCards.length).toBe(2);
    });

    it('should keep non-sponsored cards even when sponsored are skipped', () => {
      const recs = createMockRecs(15, [0, 1, 2, 3, 4]);
      const feed = buildBlendedFeed(recs, {
        subscriptionTier: 'plus',
        insightsLimit: INSIGHTS_LIMIT.plus,
        upgradeDismissed: false,
      });

      // 5 sponsored attempted, only 2 kept
      // Total should be 15 - 3 skipped = 12
      expect(feed.length).toBe(12);
    });

    it('should not limit sponsored cards after position 10', () => {
      // Sponsored at indices 10, 11, 12 (after the first 10)
      const recs = createMockRecs(15, [10, 11, 12]);
      const feed = buildBlendedFeed(recs, {
        subscriptionTier: 'plus',
        insightsLimit: INSIGHTS_LIMIT.plus,
        upgradeDismissed: false,
      });

      // All 3 sponsored should be kept (they're after position 10)
      const sponsoredCards = feed.filter(c => c.isSponsored);
      expect(sponsoredCards.length).toBe(3);
    });
  });

  describe('Feed integrity', () => {
    it('should preserve card order', () => {
      const recs = createMockRecs(10);
      const feed = buildBlendedFeed(recs, {
        subscriptionTier: 'plus',
        insightsLimit: INSIGHTS_LIMIT.plus,
        upgradeDismissed: false,
      });

      for (let i = 0; i < 10; i++) {
        expect(feed[i].id).toBe(`rec-${i}`);
      }
    });

    it('should have no upgrade_prompt or section_header card types', () => {
      const recs = createMockRecs(15);
      const feed = buildBlendedFeed(recs, {
        subscriptionTier: 'free',
        insightsLimit: INSIGHTS_LIMIT.free,
        upgradeDismissed: false,
      });

      const legacyCards = feed.filter(
        c => c.cardType === 'upgrade_prompt' || c.cardType === 'section_header'
      );
      expect(legacyCards.length).toBe(0);
    });

    it('insights_nudge card should have showInsights = false', () => {
      const recs = createMockRecs(15);
      const feed = buildBlendedFeed(recs, {
        subscriptionTier: 'free',
        insightsLimit: INSIGHTS_LIMIT.free,
        upgradeDismissed: false,
      });

      const nudge = feed.find(c => c.cardType === 'insights_nudge');
      expect(nudge).toBeDefined();
      expect(nudge!.showInsights).toBe(false);
    });
  });
});
