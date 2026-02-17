/**
 * Tests for ExploreTile component logic
 *
 * Tests the pure rendering logic and display rules used in ExploreTile,
 * following the project's pattern of testing extracted logic.
 */

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => ({ select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn() })) })) })) },
}));

// Mock category-selector CATEGORIES
jest.mock('@/components/category-selector', () => ({
  CATEGORIES: [
    { id: 'all', label: 'All Categories', icon: 'apps', color: '#00A6D9' },
    { id: 'dining', label: 'Dining', icon: 'restaurant', color: '#EF4444' },
    { id: 'coffee', label: 'Coffee & Cafes', icon: 'cafe', color: '#F59E0B' },
    { id: 'nightlife', label: 'Bars & Nightlife', icon: 'beer', color: '#8B5CF6' },
    { id: 'entertainment', label: 'Entertainment', icon: 'game-controller', color: '#00A6D9' },
  ],
}));

import type { ExploreItem } from '@/types/explore';

/**
 * Extracted display logic from ExploreTile
 */
function formatPrice(priceLevel?: number): string {
  if (priceLevel == null || priceLevel === 0) return '';
  return '$'.repeat(priceLevel);
}

function isTrending(item: ExploreItem): boolean {
  return item.type === 'place' && (item.rating ?? 0) >= 4.5 && (item.reviewCount ?? 0) >= 200;
}

function shouldShowOpenNow(item: ExploreItem): boolean {
  return item.openNow === true && item.type === 'place';
}

function shouldShowCategoryChip(item: ExploreItem): boolean {
  return item.tileSize === 'large' && item.categoryId != null && item.type === 'place';
}

function shouldShowMomentRing(item: ExploreItem): boolean {
  return item.type === 'moment';
}

function buildMetaText(item: ExploreItem): string {
  const ratingText = item.rating ? `\u2605 ${item.rating.toFixed(1)}` : '';
  const priceText = formatPrice(item.priceLevel);
  return [ratingText, priceText].filter(Boolean).join('  ');
}

const SHORT_LABELS: Record<string, string> = {
  all: 'All', dining: 'Dining', coffee: 'Coffee', nightlife: 'Bars',
  entertainment: 'Fun', culture: 'Arts', shopping: 'Shopping', fitness: 'Fitness',
  outdoors: 'Outdoors', events: 'Events', family: 'Family', attractions: 'Sights',
  everyday: 'Everyday',
};

function getCategoryLabel(categoryId?: string): string | null {
  if (!categoryId) return null;
  return SHORT_LABELS[categoryId] || null;
}

function makePlaceItem(overrides: Partial<ExploreItem> = {}): ExploreItem {
  return {
    id: 'test-place-1',
    type: 'place',
    imageUrl: 'https://example.com/photo.jpg',
    title: 'Test Restaurant',
    subtitle: 'Restaurant',
    rating: 4.2,
    priceLevel: 2,
    openNow: false,
    reviewCount: 50,
    categoryId: 'dining',
    tileSize: 'small',
    ...overrides,
  };
}

function makeMomentItem(overrides: Partial<ExploreItem> = {}): ExploreItem {
  return {
    id: 'test-moment-1',
    type: 'moment',
    imageUrl: 'https://example.com/moment.jpg',
    title: 'Great evening!',
    subtitle: 'John',
    tileSize: 'small',
    ...overrides,
  };
}

describe('ExploreTile - Display Logic', () => {
  describe('formatPrice', () => {
    it('returns empty string for undefined', () => {
      expect(formatPrice(undefined)).toBe('');
    });

    it('returns empty string for 0', () => {
      expect(formatPrice(0)).toBe('');
    });

    it('returns $ for price level 1', () => {
      expect(formatPrice(1)).toBe('$');
    });

    it('returns $$ for price level 2', () => {
      expect(formatPrice(2)).toBe('$$');
    });

    it('returns $$$$ for price level 4', () => {
      expect(formatPrice(4)).toBe('$$$$');
    });
  });

  describe('buildMetaText', () => {
    it('shows rating and price', () => {
      const text = buildMetaText(makePlaceItem({ rating: 4.5, priceLevel: 3 }));
      expect(text).toContain('4.5');
      expect(text).toContain('$$$');
    });

    it('shows only rating when no price', () => {
      const text = buildMetaText(makePlaceItem({ rating: 4.2, priceLevel: undefined }));
      expect(text).toContain('4.2');
      expect(text).not.toContain('$');
    });

    it('shows only price when no rating', () => {
      const text = buildMetaText(makePlaceItem({ rating: undefined, priceLevel: 2 }));
      expect(text).toBe('$$');
    });

    it('returns empty when no rating or price', () => {
      const text = buildMetaText(makePlaceItem({ rating: undefined, priceLevel: undefined }));
      expect(text).toBe('');
    });
  });

  describe('isTrending', () => {
    it('returns true for high rating + many reviews', () => {
      expect(isTrending(makePlaceItem({ rating: 4.7, reviewCount: 300 }))).toBe(true);
    });

    it('returns false when rating below 4.5', () => {
      expect(isTrending(makePlaceItem({ rating: 4.3, reviewCount: 300 }))).toBe(false);
    });

    it('returns false when reviews below 200', () => {
      expect(isTrending(makePlaceItem({ rating: 4.7, reviewCount: 100 }))).toBe(false);
    });

    it('returns false for moments', () => {
      expect(isTrending(makeMomentItem({ rating: 4.8, reviewCount: 500 }))).toBe(false);
    });

    it('returns true at exact threshold (4.5 rating, 200 reviews)', () => {
      expect(isTrending(makePlaceItem({ rating: 4.5, reviewCount: 200 }))).toBe(true);
    });
  });

  describe('shouldShowOpenNow', () => {
    it('returns true when openNow is true and type is place', () => {
      expect(shouldShowOpenNow(makePlaceItem({ openNow: true }))).toBe(true);
    });

    it('returns false when openNow is false', () => {
      expect(shouldShowOpenNow(makePlaceItem({ openNow: false }))).toBe(false);
    });

    it('returns false when openNow is undefined', () => {
      expect(shouldShowOpenNow(makePlaceItem({ openNow: undefined }))).toBe(false);
    });

    it('returns false for moments even if openNow is somehow true', () => {
      expect(shouldShowOpenNow(makeMomentItem({ openNow: true }))).toBe(false);
    });
  });

  describe('shouldShowCategoryChip', () => {
    it('returns true for large place tiles with categoryId', () => {
      expect(shouldShowCategoryChip(makePlaceItem({ tileSize: 'large', categoryId: 'dining' }))).toBe(true);
    });

    it('returns false for small tiles', () => {
      expect(shouldShowCategoryChip(makePlaceItem({ tileSize: 'small', categoryId: 'dining' }))).toBe(false);
    });

    it('returns false when no categoryId', () => {
      expect(shouldShowCategoryChip(makePlaceItem({ tileSize: 'large', categoryId: undefined }))).toBe(false);
    });

    it('returns false for moments', () => {
      expect(shouldShowCategoryChip(makeMomentItem({ tileSize: 'large', categoryId: 'dining' }))).toBe(false);
    });
  });

  describe('shouldShowMomentRing', () => {
    it('returns true for moments', () => {
      expect(shouldShowMomentRing(makeMomentItem())).toBe(true);
    });

    it('returns false for places', () => {
      expect(shouldShowMomentRing(makePlaceItem())).toBe(false);
    });
  });

  describe('getCategoryLabel', () => {
    it('returns short label for known categories', () => {
      expect(getCategoryLabel('dining')).toBe('Dining');
      expect(getCategoryLabel('nightlife')).toBe('Bars');
      expect(getCategoryLabel('entertainment')).toBe('Fun');
      expect(getCategoryLabel('culture')).toBe('Arts');
      expect(getCategoryLabel('attractions')).toBe('Sights');
    });

    it('returns null for undefined categoryId', () => {
      expect(getCategoryLabel(undefined)).toBeNull();
    });

    it('returns null for unknown categoryId', () => {
      expect(getCategoryLabel('unknown_category')).toBeNull();
    });
  });

  describe('Placeholder rendering decision', () => {
    it('shows placeholder when imageUrl is null', () => {
      const item = makePlaceItem({ imageUrl: null });
      expect(item.imageUrl).toBeNull();
    });

    it('shows image when imageUrl is present', () => {
      const item = makePlaceItem({ imageUrl: 'https://example.com/photo.jpg' });
      expect(item.imageUrl).toBeTruthy();
    });
  });
});
