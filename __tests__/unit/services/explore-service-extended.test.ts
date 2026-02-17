/**
 * Tests for explore-service extended functionality
 *
 * Covers mapToCategoryId, new fields on recommendationToExploreItem,
 * and categoryFilter on fetchExploreBatch.
 */

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ single: jest.fn() })),
      })),
    })),
  },
}));

// Mock category-selector
jest.mock('@/components/category-selector', () => ({
  CATEGORIES: [
    { id: 'dining', label: 'Dining', icon: 'restaurant', color: '#EF4444' },
    { id: 'coffee', label: 'Coffee & Cafes', icon: 'cafe', color: '#F59E0B' },
  ],
}));

// Mock recommendations service
const mockGenerateRecommendations = jest.fn().mockResolvedValue([]);
jest.mock('@/services/recommendations', () => ({
  generateRecommendations: (...args: any[]) => mockGenerateRecommendations(...args),
}));

// Mock moments service
jest.mock('@/services/moments-service', () => ({
  getFriendMoments: jest.fn().mockResolvedValue({ friends: [] }),
  getPlaceMoments: jest.fn().mockResolvedValue([]),
}));

import { mapToCategoryId, recommendationToExploreItem, fetchExploreBatch } from '@/services/explore-service';
import type { ScoredRecommendation } from '@/services/recommendations';

describe('mapToCategoryId', () => {
  it('maps cafe type to coffee', () => {
    expect(mapToCategoryId(['cafe', 'point_of_interest'])).toBe('coffee');
  });

  it('maps coffee_shop to coffee', () => {
    expect(mapToCategoryId(['coffee_shop', 'store'])).toBe('coffee');
  });

  it('maps restaurant type to dining', () => {
    expect(mapToCategoryId(['restaurant', 'food'])).toBe('dining');
  });

  it('maps bakery to dining', () => {
    expect(mapToCategoryId(['bakery', 'store'])).toBe('dining');
  });

  it('maps bar type to nightlife', () => {
    expect(mapToCategoryId(['bar', 'point_of_interest'])).toBe('nightlife');
  });

  it('maps night_club to nightlife', () => {
    expect(mapToCategoryId(['night_club'])).toBe('nightlife');
  });

  it('maps museum to culture', () => {
    expect(mapToCategoryId(['museum', 'tourist_attraction'])).toBe('culture');
  });

  it('maps gym to fitness', () => {
    expect(mapToCategoryId(['gym', 'health'])).toBe('fitness');
  });

  it('maps park to outdoors', () => {
    expect(mapToCategoryId(['park', 'point_of_interest'])).toBe('outdoors');
  });

  it('maps shopping_mall to shopping', () => {
    expect(mapToCategoryId(['shopping_mall'])).toBe('shopping');
  });

  it('maps movie_theater to entertainment', () => {
    expect(mapToCategoryId(['movie_theater', 'point_of_interest'])).toBe('entertainment');
  });

  it('maps stadium to events', () => {
    expect(mapToCategoryId(['stadium'])).toBe('events');
  });

  it('maps zoo to family', () => {
    expect(mapToCategoryId(['zoo', 'tourist_attraction'])).toBe('family');
  });

  it('maps tourist_attraction to attractions', () => {
    expect(mapToCategoryId(['tourist_attraction'])).toBe('attractions');
  });

  it('returns undefined for unknown types', () => {
    expect(mapToCategoryId(['lodging', 'establishment'])).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    expect(mapToCategoryId([])).toBeUndefined();
  });

  it('prioritizes coffee over dining for cafe+restaurant combo', () => {
    // cafe appears first in the check order
    expect(mapToCategoryId(['cafe', 'restaurant'])).toBe('coffee');
  });
});

describe('recommendationToExploreItem - new fields', () => {
  function makeRec(overrides: Record<string, any> = {}): ScoredRecommendation {
    return {
      place: {
        place_id: 'test-id',
        name: 'Test Place',
        types: ['restaurant', 'food'],
        rating: 4.3,
        price_level: 2,
        opening_hours: { open_now: true },
        user_ratings_total: 150,
        photos: [{ photo_reference: 'https://example.com/photo.jpg' }],
        geometry: { location: { lat: 32.7, lng: -96.8 } },
        ...overrides,
      },
      score: 75,
      scoreBreakdown: {
        baseScore: 30,
        locationScore: 15,
        timeScore: 10,
        feedbackScore: 10,
        collaborativeScore: 5,
        sponsoredBoost: 0,
      },
    } as any;
  }

  it('populates priceLevel from place.price_level', () => {
    const item = recommendationToExploreItem(makeRec({ price_level: 3 }));
    expect(item.priceLevel).toBe(3);
  });

  it('populates openNow from place.opening_hours.open_now', () => {
    const item = recommendationToExploreItem(makeRec({ opening_hours: { open_now: true } }));
    expect(item.openNow).toBe(true);
  });

  it('populates reviewCount from place.user_ratings_total', () => {
    const item = recommendationToExploreItem(makeRec({ user_ratings_total: 250 }));
    expect(item.reviewCount).toBe(250);
  });

  it('populates categoryId via mapToCategoryId', () => {
    const item = recommendationToExploreItem(makeRec({ types: ['cafe', 'food'] }));
    expect(item.categoryId).toBe('coffee');
  });

  it('sets categoryId undefined for unknown types', () => {
    const item = recommendationToExploreItem(makeRec({ types: ['lodging'] }));
    expect(item.categoryId).toBeUndefined();
  });

  it('sets priceLevel undefined when not present', () => {
    const item = recommendationToExploreItem(makeRec({ price_level: undefined }));
    expect(item.priceLevel).toBeUndefined();
  });

  it('sets openNow undefined when opening_hours missing', () => {
    const item = recommendationToExploreItem(makeRec({ opening_hours: undefined }));
    expect(item.openNow).toBeUndefined();
  });
});

describe('fetchExploreBatch - categoryFilter', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    name: 'Test',
    interests: ['dining'],
    preferences: { max_distance_miles: 10 },
  } as any;
  const mockLocation = { lat: 32.7, lng: -96.8 };

  beforeEach(() => {
    mockGenerateRecommendations.mockClear();
    mockGenerateRecommendations.mockResolvedValue([]);
  });

  it('passes categories array when categoryFilter is provided', async () => {
    await fetchExploreBatch({
      user: mockUser,
      userLocation: mockLocation,
      distanceTier: 0,
      excludePlaceIds: [],
      categoryFilter: 'dining',
    });

    expect(mockGenerateRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: ['dining'],
      })
    );
  });

  it('does not pass categories when categoryFilter is undefined', async () => {
    await fetchExploreBatch({
      user: mockUser,
      userLocation: mockLocation,
      distanceTier: 0,
      excludePlaceIds: [],
    });

    const callArgs = mockGenerateRecommendations.mock.calls[0][0];
    expect(callArgs.categories).toBeUndefined();
  });
});
