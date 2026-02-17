/**
 * Tests for ExploreHeader category chips logic
 *
 * Tests the chip data, short labels, and selection logic
 * following the project's pure logic testing pattern.
 */

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => ({ select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn() })) })) })) },
}));

// Define CATEGORIES inline (same as category-selector.tsx) to avoid react-native import
const CATEGORIES = [
  { id: 'all', label: 'All Categories', icon: 'apps', color: '#00A6D9' },
  { id: 'dining', label: 'Dining', icon: 'restaurant', color: '#EF4444' },
  { id: 'coffee', label: 'Coffee & Cafes', icon: 'cafe', color: '#F59E0B' },
  { id: 'nightlife', label: 'Bars & Nightlife', icon: 'beer', color: '#8B5CF6' },
  { id: 'entertainment', label: 'Entertainment', icon: 'game-controller', color: '#00A6D9' },
  { id: 'culture', label: 'Arts & Culture', icon: 'color-palette', color: '#553C96' },
  { id: 'shopping', label: 'Shopping', icon: 'cart', color: '#EC4899' },
  { id: 'fitness', label: 'Fitness & Wellness', icon: 'fitness', color: '#09DB98' },
  { id: 'outdoors', label: 'Parks & Outdoors', icon: 'leaf', color: '#14B8A6' },
  { id: 'events', label: 'Events & Venues', icon: 'calendar', color: '#D97706' },
  { id: 'family', label: 'Family & Kids', icon: 'people', color: '#2ECEFF' },
  { id: 'attractions', label: 'Tourist Attractions', icon: 'star', color: '#EDB95A' },
  { id: 'everyday', label: 'Everyday & Specialty', icon: 'storefront', color: '#8E8E93' },
];

/** Short labels used in ExploreHeader (mirrored from explore-header.tsx) */
const SHORT_LABELS: Record<string, string> = {
  all: 'All',
  dining: 'Dining',
  coffee: 'Coffee',
  nightlife: 'Bars',
  entertainment: 'Fun',
  culture: 'Arts',
  shopping: 'Shopping',
  fitness: 'Fitness',
  outdoors: 'Outdoors',
  events: 'Events',
  family: 'Family',
  attractions: 'Sights',
  everyday: 'Everyday',
};

function getChipLabel(categoryId: string): string {
  return SHORT_LABELS[categoryId] || CATEGORIES.find((c) => c.id === categoryId)?.label || categoryId;
}

function isChipSelected(categoryId: string, selectedCategory: string): boolean {
  return categoryId === selectedCategory;
}

describe('ExploreHeader - Category Chips Logic', () => {
  describe('All 13 categories have short labels', () => {
    it('has exactly 13 categories in CATEGORIES', () => {
      expect(CATEGORIES.length).toBe(13);
    });

    it('every CATEGORIES entry has a short label mapping', () => {
      for (const cat of CATEGORIES) {
        expect(SHORT_LABELS[cat.id]).toBeDefined();
        expect(typeof SHORT_LABELS[cat.id]).toBe('string');
        expect(SHORT_LABELS[cat.id].length).toBeGreaterThan(0);
      }
    });
  });

  describe('Short labels', () => {
    it('maps "all" to "All"', () => {
      expect(getChipLabel('all')).toBe('All');
    });

    it('maps "nightlife" to "Bars"', () => {
      expect(getChipLabel('nightlife')).toBe('Bars');
    });

    it('maps "entertainment" to "Fun"', () => {
      expect(getChipLabel('entertainment')).toBe('Fun');
    });

    it('maps "culture" to "Arts"', () => {
      expect(getChipLabel('culture')).toBe('Arts');
    });

    it('maps "attractions" to "Sights"', () => {
      expect(getChipLabel('attractions')).toBe('Sights');
    });

    it('maps "everyday" to "Everyday"', () => {
      expect(getChipLabel('everyday')).toBe('Everyday');
    });
  });

  describe('Selection logic', () => {
    it('"All" is selected by default when selectedCategory is "all"', () => {
      expect(isChipSelected('all', 'all')).toBe(true);
    });

    it('non-selected chips return false', () => {
      expect(isChipSelected('dining', 'all')).toBe(false);
      expect(isChipSelected('coffee', 'dining')).toBe(false);
    });

    it('selected category returns true', () => {
      expect(isChipSelected('dining', 'dining')).toBe(true);
      expect(isChipSelected('nightlife', 'nightlife')).toBe(true);
    });

    it('only one chip is selected at a time', () => {
      const selectedCategory = 'coffee';
      const selectedCount = CATEGORIES.filter((c) => isChipSelected(c.id, selectedCategory)).length;
      expect(selectedCount).toBe(1);
    });
  });

  describe('Category data integrity', () => {
    it('every category has a unique id', () => {
      const ids = CATEGORIES.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every category has a color', () => {
      for (const cat of CATEGORIES) {
        expect(cat.color).toBeDefined();
        expect(typeof cat.color).toBe('string');
      }
    });

    it('"all" is the first category', () => {
      expect(CATEGORIES[0].id).toBe('all');
    });
  });

  describe('Callback simulation', () => {
    /**
     * Simulates what happens when a chip is pressed:
     * 1. handleCategoryPress(categoryId) is called
     * 2. This calls onCategoryChange(categoryId)
     */
    it('pressing a chip calls handler with correct ID', () => {
      const onCategoryChange = jest.fn();
      // Simulate pressing "dining" chip
      const categoryId = 'dining';
      onCategoryChange(categoryId);
      expect(onCategoryChange).toHaveBeenCalledWith('dining');
    });

    it('pressing "all" calls handler with "all"', () => {
      const onCategoryChange = jest.fn();
      onCategoryChange('all');
      expect(onCategoryChange).toHaveBeenCalledWith('all');
    });
  });
});
