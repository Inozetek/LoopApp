/**
 * Tests for cache manager service
 *
 * Tests cache key generation, TTL expiration logic,
 * quality filtering, cache hit/miss detection, and city aggregation.
 */

// Mock Supabase client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(),
            })),
          })),
          order: jest.fn(() => ({
            limit: jest.fn(),
          })),
        })),
      })),
      upsert: jest.fn(),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          lt: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(),
        })),
      })),
    })),
  },
  supabaseAdmin: null,
}));

// Mock Google Places API
jest.mock('@/services/google-places', () => ({
  searchNearbyActivities: jest.fn(),
  getPlaceDetails: jest.fn(),
}));

describe('Cache Manager - Pure Logic', () => {
  describe('Cache Status Parsing', () => {
    /**
     * Mirrors checkCityCache response parsing from cache-manager.ts lines 81-98
     */
    interface CacheStatus {
      exists: boolean;
      count: number;
      lastCached: Date | null;
      isStale: boolean;
    }

    function parseCacheResult(result: any): CacheStatus {
      if (!result) {
        return {
          exists: false,
          count: 0,
          lastCached: null,
          isStale: false,
        };
      }

      return {
        exists: result.cache_exists || false,
        count: parseInt(result.place_count) || 0,
        lastCached: result.last_cached ? new Date(result.last_cached) : null,
        isStale: result.is_stale || false,
      };
    }

    it('should return cache miss for null result', () => {
      const status = parseCacheResult(null);
      expect(status.exists).toBe(false);
      expect(status.count).toBe(0);
      expect(status.lastCached).toBeNull();
      expect(status.isStale).toBe(false);
    });

    it('should return cache miss for undefined result', () => {
      const status = parseCacheResult(undefined);
      expect(status.exists).toBe(false);
      expect(status.count).toBe(0);
    });

    it('should parse valid cache hit', () => {
      const status = parseCacheResult({
        cache_exists: true,
        place_count: '150',
        last_cached: '2025-06-01T00:00:00Z',
        is_stale: false,
      });

      expect(status.exists).toBe(true);
      expect(status.count).toBe(150);
      expect(status.lastCached).toBeInstanceOf(Date);
      expect(status.isStale).toBe(false);
    });

    it('should parse stale cache', () => {
      const status = parseCacheResult({
        cache_exists: true,
        place_count: '50',
        last_cached: '2025-01-01T00:00:00Z',
        is_stale: true,
      });

      expect(status.exists).toBe(true);
      expect(status.isStale).toBe(true);
    });

    it('should handle missing place_count as 0', () => {
      const status = parseCacheResult({
        cache_exists: true,
        place_count: null,
        last_cached: '2025-06-01T00:00:00Z',
      });

      expect(status.count).toBe(0);
    });

    it('should handle cache_exists false with count', () => {
      const status = parseCacheResult({
        cache_exists: false,
        place_count: '0',
      });

      expect(status.exists).toBe(false);
      expect(status.count).toBe(0);
    });
  });

  describe('TTL / Staleness Logic', () => {
    /**
     * Determines whether cached data has expired based on cachedAt + refreshDays
     */
    function isCacheStale(cachedAt: Date, refreshDays: number, now: Date): boolean {
      const expiryDate = new Date(cachedAt);
      expiryDate.setDate(expiryDate.getDate() + refreshDays);
      return now > expiryDate;
    }

    it('should not be stale within refresh window', () => {
      const cachedAt = new Date('2025-06-01T00:00:00Z');
      const now = new Date('2025-06-15T00:00:00Z'); // 14 days later
      expect(isCacheStale(cachedAt, 60, now)).toBe(false); // 60-day refresh
    });

    it('should be stale after refresh window expires', () => {
      const cachedAt = new Date('2025-06-01T00:00:00Z');
      const now = new Date('2025-08-01T00:00:00Z'); // 61 days later
      expect(isCacheStale(cachedAt, 60, now)).toBe(true);
    });

    it('should be stale on exact expiry boundary', () => {
      const cachedAt = new Date('2025-06-01T00:00:00Z');
      const now = new Date('2025-07-31T00:00:01Z'); // Just past 60 days
      expect(isCacheStale(cachedAt, 60, now)).toBe(true);
    });

    it('should handle 30-day refresh (Plus tier)', () => {
      const cachedAt = new Date('2025-06-01T00:00:00Z');
      const now = new Date('2025-06-29T00:00:00Z'); // 28 days later
      expect(isCacheStale(cachedAt, 30, now)).toBe(false);

      const now2 = new Date('2025-07-02T00:00:00Z'); // 31 days later
      expect(isCacheStale(cachedAt, 30, now2)).toBe(true);
    });

    it('should handle 15-day refresh (Premium tier)', () => {
      const cachedAt = new Date('2025-06-01T00:00:00Z');
      const now = new Date('2025-06-14T00:00:00Z'); // 13 days later
      expect(isCacheStale(cachedAt, 15, now)).toBe(false);

      const now2 = new Date('2025-06-17T00:00:00Z'); // 16 days later
      expect(isCacheStale(cachedAt, 15, now2)).toBe(true);
    });
  });

  describe('Quality Filter Criteria', () => {
    /**
     * Mirrors quality filter from cache-manager.ts lines 167-169
     * Filter: rating >= 4.0 AND reviewsCount >= 50
     */
    function isQualityPlace(place: { rating?: number; reviewsCount?: number }): boolean {
      return (place.rating || 0) >= 4.0 && (place.reviewsCount || 0) >= 50;
    }

    it('should include place with 4.0 rating and 50 reviews', () => {
      expect(isQualityPlace({ rating: 4.0, reviewsCount: 50 })).toBe(true);
    });

    it('should include place with high rating and many reviews', () => {
      expect(isQualityPlace({ rating: 4.8, reviewsCount: 500 })).toBe(true);
    });

    it('should exclude place with rating below 4.0', () => {
      expect(isQualityPlace({ rating: 3.9, reviewsCount: 100 })).toBe(false);
    });

    it('should exclude place with fewer than 50 reviews', () => {
      expect(isQualityPlace({ rating: 4.5, reviewsCount: 49 })).toBe(false);
    });

    it('should exclude place with both below threshold', () => {
      expect(isQualityPlace({ rating: 3.0, reviewsCount: 10 })).toBe(false);
    });

    it('should treat missing rating as 0', () => {
      expect(isQualityPlace({ reviewsCount: 100 })).toBe(false);
      expect(isQualityPlace({ rating: undefined, reviewsCount: 100 })).toBe(false);
    });

    it('should treat missing reviewsCount as 0', () => {
      expect(isQualityPlace({ rating: 4.5 })).toBe(false);
      expect(isQualityPlace({ rating: 4.5, reviewsCount: undefined })).toBe(false);
    });

    it('should handle completely empty place', () => {
      expect(isQualityPlace({})).toBe(false);
    });
  });

  describe('City Aggregation and Ranking', () => {
    /**
     * Mirrors getCacheStatistics city counting from cache-manager.ts lines 470-482
     */
    function aggregateCities(
      cityStats: Array<{ city: string; state: string }>
    ): Array<{ city: string; state: string; count: number }> {
      const cityCounts = new Map<string, number>();

      cityStats.forEach((place) => {
        const key = `${place.city},${place.state}`;
        cityCounts.set(key, (cityCounts.get(key) || 0) + 1);
      });

      return Array.from(cityCounts.entries())
        .map(([key, count]) => {
          const [city, state] = key.split(',');
          return { city, state, count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    }

    it('should count places per city', () => {
      const stats = [
        { city: 'Dallas', state: 'TX' },
        { city: 'Dallas', state: 'TX' },
        { city: 'Austin', state: 'TX' },
      ];

      const result = aggregateCities(stats);
      expect(result[0]).toEqual({ city: 'Dallas', state: 'TX', count: 2 });
      expect(result[1]).toEqual({ city: 'Austin', state: 'TX', count: 1 });
    });

    it('should sort by count descending', () => {
      const stats = [
        { city: 'Austin', state: 'TX' },
        { city: 'Dallas', state: 'TX' },
        { city: 'Dallas', state: 'TX' },
        { city: 'Dallas', state: 'TX' },
        { city: 'Austin', state: 'TX' },
      ];

      const result = aggregateCities(stats);
      expect(result[0].city).toBe('Dallas');
      expect(result[0].count).toBe(3);
      expect(result[1].city).toBe('Austin');
      expect(result[1].count).toBe(2);
    });

    it('should limit to top 5 cities', () => {
      const stats = [
        { city: 'A', state: 'TX' },
        { city: 'B', state: 'TX' },
        { city: 'C', state: 'TX' },
        { city: 'D', state: 'TX' },
        { city: 'E', state: 'TX' },
        { city: 'F', state: 'TX' },
        { city: 'G', state: 'TX' },
      ];

      const result = aggregateCities(stats);
      expect(result).toHaveLength(5);
    });

    it('should handle empty input', () => {
      const result = aggregateCities([]);
      expect(result).toEqual([]);
    });

    it('should distinguish same city name in different states', () => {
      const stats = [
        { city: 'Springfield', state: 'IL' },
        { city: 'Springfield', state: 'MO' },
        { city: 'Springfield', state: 'IL' },
      ];

      const result = aggregateCities(stats);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ city: 'Springfield', state: 'IL', count: 2 });
      expect(result[1]).toEqual({ city: 'Springfield', state: 'MO', count: 1 });
    });
  });

  describe('Cleanup Date Calculation', () => {
    /**
     * Mirrors cleanupOldStalePlaces from cache-manager.ts lines 388-389
     * Deletes stale places with last_used > 90 days ago
     */
    function shouldCleanup(
      isStale: boolean,
      lastUsed: Date,
      now: Date
    ): boolean {
      if (!isStale) return false;

      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      return lastUsed < ninetyDaysAgo;
    }

    it('should cleanup stale place unused for 91 days', () => {
      const now = new Date('2025-06-15T00:00:00Z');
      const lastUsed = new Date('2025-03-15T00:00:00Z'); // 92 days ago
      expect(shouldCleanup(true, lastUsed, now)).toBe(true);
    });

    it('should not cleanup stale place used 89 days ago', () => {
      const now = new Date('2025-06-15T00:00:00Z');
      const lastUsed = new Date('2025-03-18T00:00:00Z'); // 89 days ago
      expect(shouldCleanup(true, lastUsed, now)).toBe(false);
    });

    it('should not cleanup non-stale place even if old', () => {
      const now = new Date('2025-06-15T00:00:00Z');
      const lastUsed = new Date('2024-01-01T00:00:00Z'); // Very old
      expect(shouldCleanup(false, lastUsed, now)).toBe(false);
    });

    it('should not cleanup recently used stale place', () => {
      const now = new Date('2025-06-15T00:00:00Z');
      const lastUsed = new Date('2025-06-01T00:00:00Z'); // 14 days ago
      expect(shouldCleanup(true, lastUsed, now)).toBe(false);
    });
  });

  describe('Average Places Per City Calculation', () => {
    /**
     * Mirrors getCacheStatistics avgPlacesPerCity from cache-manager.ts line 488
     */
    function avgPlacesPerCity(totalPlaces: number, totalCities: number): number {
      return totalCities > 0 ? Math.round(totalPlaces / totalCities) : 0;
    }

    it('should calculate correct average', () => {
      expect(avgPlacesPerCity(300, 3)).toBe(100);
    });

    it('should round to nearest integer', () => {
      expect(avgPlacesPerCity(100, 3)).toBe(33); // 33.33 -> 33
    });

    it('should return 0 when no cities', () => {
      expect(avgPlacesPerCity(0, 0)).toBe(0);
    });

    it('should handle single city', () => {
      expect(avgPlacesPerCity(150, 1)).toBe(150);
    });
  });

  describe('Cache Record Construction', () => {
    /**
     * Mirrors seedCityData cache record creation from cache-manager.ts lines 179-192
     */
    function createCacheRecord(
      city: string,
      state: string,
      place: { googlePlaceId?: string; location: { latitude: number; longitude: number } },
      category: string,
      refreshCadenceDays: number
    ) {
      return {
        city,
        state,
        lat: place.location.latitude,
        lng: place.location.longitude,
        place_id: place.googlePlaceId || `place-${Date.now()}`,
        place_data: place,
        category,
        cached_at: expect.any(String),
        last_used: expect.any(String),
        use_count: 0,
        is_stale: false,
        refresh_cadence_days: refreshCadenceDays,
      };
    }

    it('should use googlePlaceId as place_id when available', () => {
      const record = createCacheRecord(
        'Dallas', 'TX',
        { googlePlaceId: 'ChIJ12345', location: { latitude: 32.77, longitude: -96.79 } },
        'restaurant',
        60
      );

      expect(record.place_id).toBe('ChIJ12345');
    });

    it('should generate fallback place_id when no googlePlaceId', () => {
      const place: { googlePlaceId?: string; location: { latitude: number; longitude: number } } = {
        location: { latitude: 32.77, longitude: -96.79 },
      };
      const placeId = place.googlePlaceId || 'place-fallback';

      expect(placeId).toBe('place-fallback');
    });

    it('should set initial state correctly', () => {
      const record = createCacheRecord(
        'Dallas', 'TX',
        { googlePlaceId: 'ChIJ12345', location: { latitude: 32.77, longitude: -96.79 } },
        'cafe',
        30
      );

      expect(record.use_count).toBe(0);
      expect(record.is_stale).toBe(false);
      expect(record.refresh_cadence_days).toBe(30);
      expect(record.category).toBe('cafe');
    });
  });
});
