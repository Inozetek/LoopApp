/**
 * Blended Feed Logic Tests
 *
 * Tests for the unified feed that shows AI-curated cards first,
 * then an upgrade prompt, then discovery cards.
 */

interface MockRecommendation {
  id: string;
  title: string;
  score: number;
  cardType?: 'ai_curated' | 'discovery' | 'upgrade_prompt' | 'section_header';
}

interface DailyLimitInfo {
  dailyLimit: number;
  subscriptionTier: 'free' | 'plus';
  remainingToday: number;
  viewedToday: number;
  canView: boolean;
}

/**
 * Replicate the blended feed logic from index.tsx
 */
function buildBlendedFeed(
  filteredRecommendations: MockRecommendation[],
  dailyLimitInfo: DailyLimitInfo | null,
  upgradeDismissed: boolean,
): MockRecommendation[] {
  const dailyAiLimit = dailyLimitInfo?.dailyLimit ?? 5;
  const subscriptionTier = dailyLimitInfo?.subscriptionTier ?? 'free';
  const isPlus = subscriptionTier === 'plus';

  // Plus users: all cards are AI-curated
  if (isPlus) {
    return filteredRecommendations.map(r => ({
      ...r,
      cardType: r.cardType || 'ai_curated' as const,
    }));
  }

  // Free users: top N = AI curated, rest = discovery
  const aiCards = filteredRecommendations.slice(0, dailyAiLimit).map(r => ({
    ...r,
    cardType: 'ai_curated' as const,
  }));

  const discCards = filteredRecommendations.slice(dailyAiLimit).map(r => ({
    ...r,
    cardType: 'discovery' as const,
  }));

  const items: MockRecommendation[] = [...aiCards];

  // Insert upgrade prompt
  if (aiCards.length > 0 && discCards.length > 0 && !upgradeDismissed) {
    items.push({
      id: 'upgrade-prompt',
      title: '',
      score: 0,
      cardType: 'upgrade_prompt',
    });
  }

  // Insert section header
  if (discCards.length > 0) {
    items.push({
      id: 'section-header-explore',
      title: 'More to explore',
      score: 0,
      cardType: 'section_header',
    });
  }

  items.push(...discCards);
  return items;
}

// Generate mock recommendations
function generateMockRecs(count: number): MockRecommendation[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `rec-${i}`,
    title: `Place ${i + 1}`,
    score: 100 - i * 2, // Descending scores
  }));
}

describe('Blended Feed Logic', () => {
  describe('Free user — standard case', () => {
    const dailyLimit: DailyLimitInfo = {
      dailyLimit: 5,
      subscriptionTier: 'free',
      remainingToday: 5,
      viewedToday: 0,
      canView: true,
    };

    it('should split into AI curated + discovery sections', () => {
      const recs = generateMockRecs(20);
      const feed = buildBlendedFeed(recs, dailyLimit, false);

      const aiCards = feed.filter(r => r.cardType === 'ai_curated');
      const discCards = feed.filter(r => r.cardType === 'discovery');

      expect(aiCards.length).toBe(5);
      expect(discCards.length).toBe(15);
    });

    it('should have AI cards first, then upgrade prompt, then section header, then discovery', () => {
      const recs = generateMockRecs(20);
      const feed = buildBlendedFeed(recs, dailyLimit, false);

      // First 5 should be AI
      for (let i = 0; i < 5; i++) {
        expect(feed[i].cardType).toBe('ai_curated');
      }

      // Next should be upgrade prompt
      expect(feed[5].cardType).toBe('upgrade_prompt');
      expect(feed[5].id).toBe('upgrade-prompt');

      // Then section header
      expect(feed[6].cardType).toBe('section_header');

      // Rest should be discovery
      for (let i = 7; i < feed.length; i++) {
        expect(feed[i].cardType).toBe('discovery');
      }
    });

    it('should include upgrade prompt for free users', () => {
      const recs = generateMockRecs(20);
      const feed = buildBlendedFeed(recs, dailyLimit, false);

      const upgradePrompt = feed.find(r => r.cardType === 'upgrade_prompt');
      expect(upgradePrompt).toBeDefined();
    });

    it('should NOT include upgrade prompt when dismissed', () => {
      const recs = generateMockRecs(20);
      const feed = buildBlendedFeed(recs, dailyLimit, true);

      const upgradePrompt = feed.find(r => r.cardType === 'upgrade_prompt');
      expect(upgradePrompt).toBeUndefined();
    });

    it('should include section header before discovery cards', () => {
      const recs = generateMockRecs(20);
      const feed = buildBlendedFeed(recs, dailyLimit, false);

      const sectionHeader = feed.find(r => r.cardType === 'section_header');
      expect(sectionHeader).toBeDefined();
      expect(sectionHeader!.title).toBe('More to explore');
    });

    it('total feed length should be recs + upgrade prompt + section header', () => {
      const recs = generateMockRecs(20);
      const feed = buildBlendedFeed(recs, dailyLimit, false);

      // 20 recs + 1 upgrade prompt + 1 section header = 22
      expect(feed.length).toBe(22);
    });
  });

  describe('Plus user — all AI curated', () => {
    const plusLimit: DailyLimitInfo = {
      dailyLimit: 999,
      subscriptionTier: 'plus',
      remainingToday: 999,
      viewedToday: 0,
      canView: true,
    };

    it('should mark all cards as ai_curated', () => {
      const recs = generateMockRecs(20);
      const feed = buildBlendedFeed(recs, plusLimit, false);

      const aiCards = feed.filter(r => r.cardType === 'ai_curated');
      expect(aiCards.length).toBe(20);
    });

    it('should NOT include upgrade prompt', () => {
      const recs = generateMockRecs(20);
      const feed = buildBlendedFeed(recs, plusLimit, false);

      const upgradePrompt = feed.find(r => r.cardType === 'upgrade_prompt');
      expect(upgradePrompt).toBeUndefined();
    });

    it('should NOT include section header', () => {
      const recs = generateMockRecs(20);
      const feed = buildBlendedFeed(recs, plusLimit, false);

      const sectionHeader = feed.find(r => r.cardType === 'section_header');
      expect(sectionHeader).toBeUndefined();
    });

    it('feed length should equal input length', () => {
      const recs = generateMockRecs(20);
      const feed = buildBlendedFeed(recs, plusLimit, false);

      expect(feed.length).toBe(20);
    });
  });

  describe('Edge cases', () => {
    const freeLimit: DailyLimitInfo = {
      dailyLimit: 5,
      subscriptionTier: 'free',
      remainingToday: 5,
      viewedToday: 0,
      canView: true,
    };

    it('should handle empty recommendations', () => {
      const feed = buildBlendedFeed([], freeLimit, false);
      expect(feed.length).toBe(0);
    });

    it('should handle fewer recs than daily limit (all AI, no discovery)', () => {
      const recs = generateMockRecs(3);
      const feed = buildBlendedFeed(recs, freeLimit, false);

      // All 3 should be AI curated
      expect(feed.length).toBe(3);
      expect(feed.every(r => r.cardType === 'ai_curated')).toBe(true);

      // No upgrade prompt or section header (no discovery cards)
      expect(feed.find(r => r.cardType === 'upgrade_prompt')).toBeUndefined();
      expect(feed.find(r => r.cardType === 'section_header')).toBeUndefined();
    });

    it('should handle exactly daily limit recs (no discovery)', () => {
      const recs = generateMockRecs(5);
      const feed = buildBlendedFeed(recs, freeLimit, false);

      expect(feed.length).toBe(5);
      expect(feed.every(r => r.cardType === 'ai_curated')).toBe(true);
    });

    it('should handle daily limit + 1 (1 discovery card)', () => {
      const recs = generateMockRecs(6);
      const feed = buildBlendedFeed(recs, freeLimit, false);

      // 5 AI + 1 upgrade + 1 section header + 1 discovery = 8
      expect(feed.length).toBe(8);
      expect(feed.filter(r => r.cardType === 'ai_curated').length).toBe(5);
      expect(feed.filter(r => r.cardType === 'discovery').length).toBe(1);
    });

    it('should handle null dailyLimitInfo (defaults to free/5)', () => {
      const recs = generateMockRecs(10);
      const feed = buildBlendedFeed(recs, null, false);

      const aiCards = feed.filter(r => r.cardType === 'ai_curated');
      const discCards = feed.filter(r => r.cardType === 'discovery');

      expect(aiCards.length).toBe(5);
      expect(discCards.length).toBe(5);
    });
  });

  describe('Card ordering preserves quality ranking', () => {
    const freeLimit: DailyLimitInfo = {
      dailyLimit: 5,
      subscriptionTier: 'free',
      remainingToday: 5,
      viewedToday: 0,
      canView: true,
    };

    it('AI cards should be the highest-scored recommendations', () => {
      const recs = generateMockRecs(20);
      const feed = buildBlendedFeed(recs, freeLimit, false);

      const aiCards = feed.filter(r => r.cardType === 'ai_curated');
      const discCards = feed.filter(r => r.cardType === 'discovery');

      // AI cards should have higher scores than discovery cards
      const lowestAiScore = Math.min(...aiCards.map(r => r.score));
      const highestDiscScore = Math.max(...discCards.map(r => r.score));

      expect(lowestAiScore).toBeGreaterThanOrEqual(highestDiscScore);
    });

    it('card order within each section should be preserved', () => {
      const recs = generateMockRecs(10);
      const feed = buildBlendedFeed(recs, freeLimit, false);

      const aiCards = feed.filter(r => r.cardType === 'ai_curated');
      const discCards = feed.filter(r => r.cardType === 'discovery');

      // AI cards should be in original order
      for (let i = 1; i < aiCards.length; i++) {
        expect(aiCards[i].score).toBeLessThanOrEqual(aiCards[i - 1].score);
      }

      // Discovery cards should be in original order
      for (let i = 1; i < discCards.length; i++) {
        expect(discCards[i].score).toBeLessThanOrEqual(discCards[i - 1].score);
      }
    });
  });
});
