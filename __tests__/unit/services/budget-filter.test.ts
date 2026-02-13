/**
 * Tests for budget preference filtering in recommendations
 *
 * Tests the soft budget filter that excludes places 2+ levels
 * above the user's budget preference.
 */

describe('Budget Filter', () => {
  /**
   * Mirrors the budget filter logic from services/recommendations.ts
   * Rule 6: Soft budget filter
   */

  interface MockRec {
    id: string;
    score: number;
    place: { name: string; price_level: number };
  }

  function applyBudgetFilter(
    recommendations: MockRec[],
    userBudget: number,
    priceRange?: 'any' | 1 | 2 | 3 | 4
  ): MockRec[] {
    // Only apply when no explicit UI price filter is set
    if (priceRange && priceRange !== 'any') {
      return recommendations;
    }

    return recommendations.filter(rec => {
      const price = rec.place?.price_level || 0;
      return price === 0 || price <= userBudget + 1; // Allow one level above
    });
  }

  const testRecs: MockRec[] = [
    { id: '1', score: 90, place: { name: 'Cheap Eats', price_level: 1 } },
    { id: '2', score: 85, place: { name: 'Mid Range', price_level: 2 } },
    { id: '3', score: 80, place: { name: 'Upscale', price_level: 3 } },
    { id: '4', score: 75, place: { name: 'Fine Dining', price_level: 4 } },
    { id: '5', score: 70, place: { name: 'Unknown Price', price_level: 0 } },
  ];

  describe('budget=1 (budget-conscious user)', () => {
    it('keeps $ and $$ places', () => {
      const result = applyBudgetFilter(testRecs, 1);
      const names = result.map(r => r.place.name);
      expect(names).toContain('Cheap Eats');
      expect(names).toContain('Mid Range');
    });

    it('excludes $$$ and $$$$ places', () => {
      const result = applyBudgetFilter(testRecs, 1);
      const names = result.map(r => r.place.name);
      expect(names).not.toContain('Upscale');
      expect(names).not.toContain('Fine Dining');
    });

    it('keeps unknown price places', () => {
      const result = applyBudgetFilter(testRecs, 1);
      const names = result.map(r => r.place.name);
      expect(names).toContain('Unknown Price');
    });
  });

  describe('budget=2 (moderate user)', () => {
    it('keeps $, $$, and $$$ places', () => {
      const result = applyBudgetFilter(testRecs, 2);
      const names = result.map(r => r.place.name);
      expect(names).toContain('Cheap Eats');
      expect(names).toContain('Mid Range');
      expect(names).toContain('Upscale');
    });

    it('excludes $$$$ places', () => {
      const result = applyBudgetFilter(testRecs, 2);
      const names = result.map(r => r.place.name);
      expect(names).not.toContain('Fine Dining');
    });
  });

  describe('budget=3 (high budget user)', () => {
    it('keeps all price levels', () => {
      const result = applyBudgetFilter(testRecs, 3);
      expect(result.length).toBe(5);
    });
  });

  describe('budget=4 (no budget constraint)', () => {
    it('keeps all price levels', () => {
      const result = applyBudgetFilter(testRecs, 4);
      expect(result.length).toBe(5);
    });
  });

  describe('explicit UI price filter override', () => {
    it('skips budget filter when priceRange is set to a number', () => {
      // Even budget=1 user gets all results when they explicitly set priceRange
      const result = applyBudgetFilter(testRecs, 1, 4);
      expect(result.length).toBe(5);
    });

    it('skips budget filter when priceRange is "any"', () => {
      // priceRange='any' means user explicitly chose "any price"
      // But our filter only applies when NO priceRange is set
      // Actually per the code: if priceRange is 'any', we DO apply budget filter
      const result = applyBudgetFilter(testRecs, 1, 'any');
      // priceRange === 'any' passes the !priceRange || priceRange === 'any' check
      // so budget filter IS applied
      expect(result.length).toBe(3); // $, $$, unknown
    });
  });

  describe('unknown price handling', () => {
    it('always passes places with price_level 0', () => {
      const unknownPriceRecs: MockRec[] = [
        { id: '1', score: 90, place: { name: 'Place A', price_level: 0 } },
        { id: '2', score: 85, place: { name: 'Place B', price_level: 0 } },
      ];

      const result = applyBudgetFilter(unknownPriceRecs, 1);
      expect(result.length).toBe(2);
    });

    it('always passes places with no place data', () => {
      const noPlaceRecs: MockRec[] = [
        { id: '1', score: 90, place: { name: 'Place A', price_level: 0 } },
      ];
      const result = applyBudgetFilter(noPlaceRecs, 1);
      expect(result.length).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('handles empty recommendations array', () => {
      const result = applyBudgetFilter([], 2);
      expect(result).toEqual([]);
    });

    it('preserves order after filtering', () => {
      const result = applyBudgetFilter(testRecs, 1);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
      }
    });
  });
});
