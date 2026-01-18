/**
 * Maps Utility - Generate static map URLs
 */

export interface StaticMapParams {
  latitude: number;
  longitude: number;
  userLatitude?: number;
  userLongitude?: number;
  width?: number;
  height?: number;
  zoom?: number;
}

/**
 * Generate Google Maps Static API URL
 * Shows activity location with red marker, optional user location with blue marker
 */
export function getStaticMapUrl(params: StaticMapParams): string {
  const {
    latitude,
    longitude,
    userLatitude,
    userLongitude,
    width = 600,
    height = 300,
    zoom = 14,
  } = params;

  const apiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.error('❌ No Google Maps API key found for static map');
    return '';
  }

  // Activity location (red marker)
  let markers = `markers=color:red%7C${latitude},${longitude}`;

  // Add user location as blue marker if provided
  if (userLatitude && userLongitude) {
    markers += `&markers=color:blue%7C${userLatitude},${userLongitude}`;
  }

  const url = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=${zoom}&size=${width}x${height}&${markers}&key=${apiKey}`;

  return url;
}
