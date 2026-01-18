/**
 * Static Map URL Generation Tests
 *
 * Tests the Google Maps Static API URL generation utility
 */

import { getStaticMapUrl, type StaticMapParams } from '@/utils/maps';

// Mock environment variable for API key
const MOCK_API_KEY = 'TEST_GOOGLE_MAPS_API_KEY';

describe('Static Map URL Generation', () => {
  // Save original env
  const originalEnv = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  beforeAll(() => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = MOCK_API_KEY;
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = originalEnv;
  });

  describe('Basic URL Generation', () => {
    it('should generate valid map URL with activity location', () => {
      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
      };

      const url = getStaticMapUrl(params);

      expect(url).toContain('maps.googleapis.com/maps/api/staticmap');
      expect(url).toContain('32.7767');
      expect(url).toContain('-96.797');
      expect(url).toContain(`key=${MOCK_API_KEY}`);
    });

    it('should include red marker for activity location', () => {
      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
      };

      const url = getStaticMapUrl(params);

      expect(url).toContain('markers=color:red');
      expect(url).toContain('32.7767,-96.797');
    });

    it('should set center to activity location', () => {
      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
      };

      const url = getStaticMapUrl(params);

      expect(url).toContain('center=32.7767,-96.797');
    });
  });

  describe('User Location Integration', () => {
    it('should include blue marker when user location provided', () => {
      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
        userLatitude: 32.78,
        userLongitude: -96.8,
      };

      const url = getStaticMapUrl(params);

      expect(url).toContain('markers=color:blue');
      expect(url).toContain('32.78,-96.8');
    });

    it('should have both red and blue markers when user location provided', () => {
      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
        userLatitude: 32.78,
        userLongitude: -96.8,
      };

      const url = getStaticMapUrl(params);

      // Should have both markers
      expect(url).toContain('markers=color:red');
      expect(url).toContain('markers=color:blue');
    });

    it('should not include blue marker when user location not provided', () => {
      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
      };

      const url = getStaticMapUrl(params);

      expect(url).not.toContain('markers=color:blue');
      expect(url).toContain('markers=color:red');
    });
  });

  describe('Custom Parameters', () => {
    it('should use custom width and height', () => {
      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
        width: 800,
        height: 400,
      };

      const url = getStaticMapUrl(params);

      expect(url).toContain('size=800x400');
    });

    it('should use default width and height when not provided', () => {
      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
      };

      const url = getStaticMapUrl(params);

      expect(url).toContain('size=600x300');
    });

    it('should use custom zoom level', () => {
      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
        zoom: 16,
      };

      const url = getStaticMapUrl(params);

      expect(url).toContain('zoom=16');
    });

    it('should use default zoom level when not provided', () => {
      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
      };

      const url = getStaticMapUrl(params);

      expect(url).toContain('zoom=14');
    });
  });

  describe('API Key Handling', () => {
    it('should use EXPO_PUBLIC_GOOGLE_MAPS_API_KEY when available', () => {
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'MAPS_KEY_123';
      delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
      };

      const url = getStaticMapUrl(params);

      expect(url).toContain('key=MAPS_KEY_123');

      // Restore
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = MOCK_API_KEY;
    });

    it('should fallback to EXPO_PUBLIC_GOOGLE_PLACES_API_KEY', () => {
      delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = 'PLACES_KEY_456';

      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
      };

      const url = getStaticMapUrl(params);

      expect(url).toContain('key=PLACES_KEY_456');

      // Restore
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = MOCK_API_KEY;
    });

    it('should return empty string when no API key available', () => {
      delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
      };

      const url = getStaticMapUrl(params);

      expect(url).toBe('');

      // Restore
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = MOCK_API_KEY;
    });
  });

  describe('Coordinate Formatting', () => {
    it('should handle positive coordinates', () => {
      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
      };

      const url = getStaticMapUrl(params);

      expect(url).toContain('32.7767');
      expect(url).toContain('-96.797');
    });

    it('should handle negative coordinates', () => {
      const params: StaticMapParams = {
        latitude: -33.8688,
        longitude: 151.2093,
      };

      const url = getStaticMapUrl(params);

      expect(url).toContain('-33.8688');
      expect(url).toContain('151.2093');
    });

    it('should handle decimal coordinates with high precision', () => {
      const params: StaticMapParams = {
        latitude: 32.776719,
        longitude: -96.797019,
      };

      const url = getStaticMapUrl(params);

      expect(url).toContain('32.776719');
      expect(url).toContain('-96.797019');
    });

    it('should handle zero coordinates', () => {
      const params: StaticMapParams = {
        latitude: 0,
        longitude: 0,
      };

      const url = getStaticMapUrl(params);

      expect(url).toContain('0,0');
    });
  });

  describe('Complete URL Structure', () => {
    it('should have all required components in correct order', () => {
      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
        width: 800,
        height: 400,
        zoom: 15,
      };

      const url = getStaticMapUrl(params);

      // Check base URL
      expect(url).toMatch(/^https:\/\/maps\.googleapis\.com\/maps\/api\/staticmap\?/);

      // Check all parameters present
      expect(url).toContain('center=');
      expect(url).toContain('zoom=');
      expect(url).toContain('size=');
      expect(url).toContain('markers=');
      expect(url).toContain('key=');
    });

    it('should properly encode marker parameters', () => {
      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
      };

      const url = getStaticMapUrl(params);

      // Marker format: markers=color:red%7C32.7767,-96.797
      // %7C is the URL-encoded pipe character |
      expect(url).toContain('markers=color:red%7C');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should generate URL for Dallas location', () => {
      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
      };

      const url = getStaticMapUrl(params);

      expect(url).toBeTruthy();
      expect(url.length).toBeGreaterThan(50);
    });

    it('should generate URL for NYC location', () => {
      const params: StaticMapParams = {
        latitude: 40.7128,
        longitude: -74.006,
      };

      const url = getStaticMapUrl(params);

      expect(url).toContain('40.7128');
      expect(url).toContain('-74.006');
    });

    it('should generate URL with user nearby', () => {
      const params: StaticMapParams = {
        latitude: 32.7767,
        longitude: -96.797,
        userLatitude: 32.7757,
        userLongitude: -96.796,
      };

      const url = getStaticMapUrl(params);

      // Should show both activity and user location
      expect(url).toContain('markers=color:red');
      expect(url).toContain('markers=color:blue');
    });
  });
});
