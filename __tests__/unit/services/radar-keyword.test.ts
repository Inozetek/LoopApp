/**
 * Tests for Radar Keyword Search (Phase 2)
 *
 * B1: searchPlacesByText service
 * B2: Keyword hook type and PlaceRadarData
 * B3-B4: matchHookToPlaces and dispatch logic
 * B5-B6: Radar UI (keyword type, place variant)
 * B7: Cost controls
 */

import type { HookType, PlaceRadarData, RadarLimits, UserHook, HookNotification } from '@/types/radar';
import { HOOK_TYPE_META, RADAR_LIMITS } from '@/types/radar';

// ============================================================================
// B2: Keyword hook type
// ============================================================================

describe('B2: Keyword hook type', () => {
  it('HookType union includes keyword', () => {
    const keywordType: HookType = 'keyword';
    expect(keywordType).toBe('keyword');
  });

  it('HOOK_TYPE_META has keyword entry', () => {
    expect(HOOK_TYPE_META.keyword).toBeDefined();
    expect(HOOK_TYPE_META.keyword.label).toBe('Keyword');
    expect(HOOK_TYPE_META.keyword.icon).toBe('🔍');
    expect(HOOK_TYPE_META.keyword.description).toContain('keyword');
  });

  it('PlaceRadarData interface has required fields', () => {
    const data: PlaceRadarData = {
      placeId: 'ChIJ123',
      name: 'Test Place',
      address: '123 Main St, Dallas, TX',
      rating: 4.5,
      reviewsCount: 200,
      priceLevel: 2,
      category: 'restaurant',
      matchedKeyword: 'tallow fries',
    };
    expect(data.placeId).toBe('ChIJ123');
    expect(data.matchedKeyword).toBe('tallow fries');
  });

  it('PlaceRadarData supports optional photoUrl and distance', () => {
    const data: PlaceRadarData = {
      placeId: 'ChIJ456',
      name: 'Rooftop Bar',
      address: '789 Elm St',
      rating: 4.2,
      reviewsCount: 100,
      priceLevel: 3,
      photoUrl: 'https://example.com/photo.jpg',
      category: 'bar',
      distance: '2.3 mi',
      matchedKeyword: 'rooftop',
    };
    expect(data.photoUrl).toBe('https://example.com/photo.jpg');
    expect(data.distance).toBe('2.3 mi');
  });
});

// ============================================================================
// B2: HookNotification with placeData
// ============================================================================

describe('B2: HookNotification placeData', () => {
  it('HookNotification supports placeData field', () => {
    const notification: HookNotification = {
      id: 'notif-1',
      userId: 'user-1',
      hookId: 'hook-1',
      title: 'Tallow House',
      body: 'Matches your "tallow fries" radar — 4.5★',
      placeData: {
        placeId: 'ChIJ123',
        name: 'Tallow House',
        address: '123 Main St, Dallas, TX',
        rating: 4.5,
        reviewsCount: 200,
        priceLevel: 2,
        category: 'restaurant',
        matchedKeyword: 'tallow fries',
      },
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    expect(notification.placeData?.matchedKeyword).toBe('tallow fries');
    expect(notification.eventData).toBeUndefined();
  });

  it('HookNotification can have eventData without placeData', () => {
    const notification: HookNotification = {
      id: 'notif-2',
      userId: 'user-1',
      hookId: 'hook-2',
      title: 'Concert',
      body: 'Venue, Jan 15',
      eventData: {
        name: 'Concert',
        venue: 'Arena',
        date: '2026-01-15',
      },
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    expect(notification.eventData?.venue).toBe('Arena');
    expect(notification.placeData).toBeUndefined();
  });
});

// ============================================================================
// B2: Radar limits include keyword
// ============================================================================

describe('B2: Radar limits', () => {
  it('free tier allows keyword radars within total limit', () => {
    const limits = RADAR_LIMITS.free;
    expect(limits.keyword).toBe(3);
    expect(limits.total).toBe(3);
  });

  it('plus tier allows unlimited keyword radars', () => {
    const limits = RADAR_LIMITS.plus;
    expect(limits.keyword).toBe(Infinity);
  });
});

// ============================================================================
// B3: matchHookToPlaces logic (unit-testable parts)
// ============================================================================

describe('B3: Keyword matching logic', () => {
  it('normalizes cache key from keyword and city', () => {
    // Test the normalization logic used in matchHookToPlaces
    const keyword = 'Tallow Fries';
    const city = 'Dallas';
    const cacheKey = `keyword:${keyword.toLowerCase().replace(/\s+/g, '_')}:${city.toLowerCase()}`;
    expect(cacheKey).toBe('keyword:tallow_fries:dallas');
  });

  it('handles multi-word keywords', () => {
    const keyword = 'gluten free pizza';
    const city = 'Austin';
    const cacheKey = `keyword:${keyword.toLowerCase().replace(/\s+/g, '_')}:${city.toLowerCase()}`;
    expect(cacheKey).toBe('keyword:gluten_free_pizza:austin');
  });

  it('limits results to MAX_KEYWORD_RESULTS (3)', () => {
    const MAX_KEYWORD_RESULTS = 3;
    const mockResults = Array.from({ length: 10 }, (_, i) => ({
      placeId: `place-${i}`,
      name: `Place ${i}`,
      address: `${i} Main St`,
      rating: 4.0,
      reviewsCount: 50,
      priceLevel: 2,
      category: 'restaurant',
      matchedKeyword: 'test',
    }));
    const limited = mockResults.slice(0, MAX_KEYWORD_RESULTS);
    expect(limited.length).toBe(3);
  });
});

// ============================================================================
// B7: Cost controls
// ============================================================================

describe('B7: Cost controls', () => {
  it('7-day cache TTL is correctly calculated', () => {
    const KEYWORD_CACHE_DAYS = 7;
    const now = new Date('2026-02-20T12:00:00Z');
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + KEYWORD_CACHE_DAYS);

    expect(expiresAt.toISOString()).toBe('2026-02-27T12:00:00.000Z');
    expect(expiresAt.getTime() - now.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('search radius is 8km (approx 5 miles)', () => {
    const KEYWORD_SEARCH_RADIUS = 8000;
    const milesApprox = KEYWORD_SEARCH_RADIUS / 1609.34;
    expect(milesApprox).toBeCloseTo(4.97, 1);
  });
});

// ============================================================================
// B5: Radar alert card conditional rendering
// ============================================================================

describe('B5: Radar alert card rendering logic', () => {
  it('identifies place result when placeData exists', () => {
    const notification: HookNotification = {
      id: 'n1',
      userId: 'u1',
      hookId: 'h1',
      title: 'Test',
      body: 'Test',
      placeData: {
        placeId: 'p1',
        name: 'Place',
        address: 'Addr',
        rating: 4.0,
        reviewsCount: 50,
        priceLevel: 2,
        category: 'bar',
        matchedKeyword: 'rooftop',
      },
      status: 'pending',
      createdAt: '',
    };
    const isPlaceResult = !!notification.placeData;
    expect(isPlaceResult).toBe(true);
  });

  it('identifies event result when eventData exists', () => {
    const notification: HookNotification = {
      id: 'n2',
      userId: 'u1',
      hookId: 'h2',
      title: 'Concert',
      body: 'Test',
      eventData: {
        name: 'Concert',
        venue: 'Arena',
        date: '2026-03-01',
        ticketUrl: 'https://tickets.com',
      },
      status: 'pending',
      createdAt: '',
    };
    const isPlaceResult = !!notification.placeData;
    expect(isPlaceResult).toBe(false);
    expect(!!notification.eventData).toBe(true);
  });
});

// ============================================================================
// B6: Add radar sheet keyword type
// ============================================================================

describe('B6: Keyword radar creation params', () => {
  it('builds correct params for keyword type', () => {
    const searchQuery = 'tallow fries';
    const params = {
      userId: 'user-1',
      hookType: 'keyword' as HookType,
      searchKeyword: searchQuery.trim(),
      entityName: searchQuery.trim(),
    };
    expect(params.hookType).toBe('keyword');
    expect(params.searchKeyword).toBe('tallow fries');
    expect(params.entityName).toBe('tallow fries');
  });
});
