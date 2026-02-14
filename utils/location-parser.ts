/**
 * Shared PostGIS location parsing utility.
 * Handles WKT POINT strings, GeoJSON objects, lat/lng objects,
 * and hex-encoded WKB/EWKB from Supabase/PostGIS.
 */

// Parse IEEE 754 double from hex string
function hexToFloat64(hex: string, littleEndian: boolean): number {
  const bytes = hex.match(/../g)!.map((b) => parseInt(b, 16));
  const buffer = new ArrayBuffer(8);
  const uint8 = new Uint8Array(buffer);
  bytes.forEach((b, i) => (uint8[i] = b));
  const view = new DataView(buffer);
  return view.getFloat64(0, littleEndian);
}

/**
 * Parse a PostGIS location value into { latitude, longitude }.
 *
 * Supported formats:
 * - WKT string: "POINT(-96.7970 32.7767)"
 * - GeoJSON object: { type: "Point", coordinates: [-96.7970, 32.7767] }
 * - Coordinate object: { latitude: 32.7767, longitude: -96.7970 }
 * - Hex-encoded WKB/EWKB from PostGIS (e.g. "0101000020E6100000...")
 *
 * Returns null if parsing fails or input is falsy.
 */
export function parseLocation(
  location: unknown
): { latitude: number; longitude: number } | null {
  if (!location) return null;

  // Handle string formats
  if (typeof location === 'string') {
    // WKT: "POINT(-96.7970 32.7767)"
    const wktMatch = location.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
    if (wktMatch) {
      const lng = parseFloat(wktMatch[1]);
      const lat = parseFloat(wktMatch[2]);
      if (!isNaN(lng) && !isNaN(lat)) {
        return { latitude: lat, longitude: lng };
      }
    }

    // Hex-encoded WKB/EWKB
    if (/^[0-9a-fA-F]+$/.test(location) && location.length >= 42) {
      return parseWKBHex(location);
    }
  }

  // Handle object formats
  if (typeof location === 'object' && location !== null) {
    const loc = location as Record<string, any>;

    // { latitude, longitude } object
    if (loc.latitude != null && loc.longitude != null) {
      const lat = parseFloat(loc.latitude);
      const lng = parseFloat(loc.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }

    // GeoJSON: { coordinates: [lng, lat] }
    if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
      const lng = loc.coordinates[0];
      const lat = loc.coordinates[1];
      if (typeof lng === 'number' && typeof lat === 'number') {
        return { latitude: lat, longitude: lng };
      }
    }
  }

  return null;
}

/**
 * Parse hex-encoded WKB/EWKB POINT to lat/lng.
 */
function parseWKBHex(
  hex: string
): { latitude: number; longitude: number } | null {
  const isLittleEndian = hex.substring(0, 2) === '01';

  // Read geometry type (4 bytes at offset 1 byte)
  const typeHex = hex.substring(2, 10);
  const typeBytes = typeHex.match(/../g)!.map((b) => parseInt(b, 16));
  const typeNum = isLittleEndian
    ? typeBytes[0] | (typeBytes[1] << 8) | (typeBytes[2] << 16) | (typeBytes[3] << 24)
    : (typeBytes[0] << 24) | (typeBytes[1] << 16) | (typeBytes[2] << 8) | typeBytes[3];

  const hasSRID = (typeNum & 0x20000000) !== 0;
  const geomType = typeNum & 0xff;

  if (geomType !== 1) return null; // Not a POINT

  let offset = 10; // After byte order (2) + type (8)
  if (hasSRID) offset += 8; // Skip SRID (4 bytes = 8 hex chars)

  if (hex.length < offset + 32) return null; // Need 32 more hex chars for two doubles

  const lng = hexToFloat64(hex.substring(offset, offset + 16), isLittleEndian);
  const lat = hexToFloat64(hex.substring(offset + 16, offset + 32), isLittleEndian);

  if (isNaN(lng) || isNaN(lat)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { latitude: lat, longitude: lng };
}
