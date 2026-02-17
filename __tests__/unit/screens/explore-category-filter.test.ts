/**
 * Tests for explore screen category filter logic
 *
 * Tests the pure logic of category selection resetting grid state
 * and applying category filters, extracted as standalone functions.
 */

describe('Explore Category Filter - Pure Logic', () => {
  /**
   * Mirrors the handleCategoryChange logic from explore.tsx
   * When a category is selected:
   * 1. Reset grid state (excludeIds, tier, hasMore)
   * 2. Call loadInitialContent with the category filter
   */
  function handleCategoryChange(
    categoryId: string,
    state: {
      excludePlaceIds: string[];
      distanceTierIndex: number;
      hasMore: boolean;
      allItems: any[];
      exploreRows: any[];
    }
  ) {
    // Reset state
    const newState = {
      selectedCategory: categoryId,
      excludePlaceIds: [],
      distanceTierIndex: 0,
      hasMore: true,
      allItems: [],
      exploreRows: [],
    };

    // Derive category filter param
    const categoryFilter = categoryId !== 'all' ? categoryId : undefined;

    return { newState, categoryFilter };
  }

  it('resets grid state when category changes', () => {
    const oldState = {
      excludePlaceIds: ['id1', 'id2', 'id3'],
      distanceTierIndex: 3,
      hasMore: false,
      allItems: [{ id: '1' }, { id: '2' }],
      exploreRows: [{ id: 'row-1' }],
    };

    const { newState } = handleCategoryChange('dining', oldState);

    expect(newState.excludePlaceIds).toEqual([]);
    expect(newState.distanceTierIndex).toBe(0);
    expect(newState.hasMore).toBe(true);
    expect(newState.allItems).toEqual([]);
    expect(newState.exploreRows).toEqual([]);
  });

  it('sets selectedCategory to the chosen category', () => {
    const { newState } = handleCategoryChange('coffee', {
      excludePlaceIds: [],
      distanceTierIndex: 0,
      hasMore: true,
      allItems: [],
      exploreRows: [],
    });

    expect(newState.selectedCategory).toBe('coffee');
  });

  it('returns categoryFilter for non-all categories', () => {
    const { categoryFilter } = handleCategoryChange('nightlife', {
      excludePlaceIds: [],
      distanceTierIndex: 0,
      hasMore: true,
      allItems: [],
      exploreRows: [],
    });

    expect(categoryFilter).toBe('nightlife');
  });

  it('returns undefined categoryFilter for "all"', () => {
    const { categoryFilter } = handleCategoryChange('all', {
      excludePlaceIds: [],
      distanceTierIndex: 0,
      hasMore: true,
      allItems: [],
      exploreRows: [],
    });

    expect(categoryFilter).toBeUndefined();
  });

  it('resets even when state was already empty', () => {
    const emptyState = {
      excludePlaceIds: [],
      distanceTierIndex: 0,
      hasMore: true,
      allItems: [],
      exploreRows: [],
    };

    const { newState } = handleCategoryChange('fitness', emptyState);

    expect(newState.selectedCategory).toBe('fitness');
    expect(newState.excludePlaceIds).toEqual([]);
    expect(newState.distanceTierIndex).toBe(0);
    expect(newState.hasMore).toBe(true);
  });

  /**
   * Recent searches logic: deduped, max 5
   */
  function addRecentSearch(recentSearches: string[], query: string): string[] {
    const filtered = recentSearches.filter((s) => s !== query);
    return [query, ...filtered].slice(0, 5);
  }

  describe('Recent Searches', () => {
    it('adds a new search to the front', () => {
      expect(addRecentSearch(['pizza', 'coffee'], 'tacos')).toEqual(['tacos', 'pizza', 'coffee']);
    });

    it('deduplicates existing search', () => {
      expect(addRecentSearch(['pizza', 'coffee', 'tacos'], 'coffee')).toEqual(['coffee', 'pizza', 'tacos']);
    });

    it('caps at 5 recent searches', () => {
      const existing = ['a', 'b', 'c', 'd', 'e'];
      expect(addRecentSearch(existing, 'f')).toEqual(['f', 'a', 'b', 'c', 'd']);
    });

    it('handles empty list', () => {
      expect(addRecentSearch([], 'tacos')).toEqual(['tacos']);
    });
  });
});
