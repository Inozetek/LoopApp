/**
 * Tests for the shared PostGIS location parser utility.
 */
import { parseLocation } from '@/utils/location-parser';

describe('parseLocation', () => {
  describe('WKT POINT strings', () => {
    it('parses standard WKT POINT', () => {
      const result = parseLocation('POINT(-96.7970 32.7767)');
      expect(result).toEqual({ latitude: 32.7767, longitude: -96.797 });
    });

    it('parses WKT POINT with positive coordinates', () => {
      const result = parseLocation('POINT(2.3522 48.8566)');
      expect(result).toEqual({ latitude: 48.8566, longitude: 2.3522 });
    });

    it('returns null for malformed WKT', () => {
      expect(parseLocation('POINT(abc def)')).toBeNull();
      expect(parseLocation('LINESTRING(0 0, 1 1)')).toBeNull();
      expect(parseLocation('POINT()')).toBeNull();
    });
  });

  describe('GeoJSON objects', () => {
    it('parses GeoJSON Point with coordinates array', () => {
      const result = parseLocation({ type: 'Point', coordinates: [-96.797, 32.7767] });
      expect(result).toEqual({ latitude: 32.7767, longitude: -96.797 });
    });

    it('parses object with just coordinates array (Supabase format)', () => {
      const result = parseLocation({ coordinates: [-96.797, 32.7767] });
      expect(result).toEqual({ latitude: 32.7767, longitude: -96.797 });
    });
  });

  describe('lat/lng objects', () => {
    it('parses { latitude, longitude } object', () => {
      const result = parseLocation({ latitude: 32.7767, longitude: -96.797 });
      expect(result).toEqual({ latitude: 32.7767, longitude: -96.797 });
    });

    it('parses string number values', () => {
      const result = parseLocation({ latitude: '32.7767', longitude: '-96.797' });
      expect(result).toEqual({ latitude: 32.7767, longitude: -96.797 });
    });
  });

  describe('hex WKB/EWKB', () => {
    it('parses little-endian EWKB hex with SRID 4326', () => {
      // EWKB for SRID 4326 — real PostGIS output for a Dallas-area point
      const hex = '0101000020E610000085EB51B81E6558C0E17A14AE47634040';
      const result = parseLocation(hex);
      // Should parse to a valid lat/lng (exact values depend on the hex encoding)
      expect(result).not.toBeNull();
      expect(result!.latitude).toBeGreaterThan(30);
      expect(result!.latitude).toBeLessThan(35);
      expect(result!.longitude).toBeGreaterThan(-100);
      expect(result!.longitude).toBeLessThan(-90);
    });

    it('returns null for non-hex strings', () => {
      expect(parseLocation('hello world')).toBeNull();
    });

    it('returns null for hex that is too short', () => {
      expect(parseLocation('0101000020')).toBeNull();
    });
  });

  describe('null/falsy inputs', () => {
    it('returns null for null', () => {
      expect(parseLocation(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(parseLocation(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseLocation('')).toBeNull();
    });

    it('returns null for zero', () => {
      expect(parseLocation(0)).toBeNull();
    });

    it('returns null for empty object', () => {
      expect(parseLocation({})).toBeNull();
    });
  });
});
