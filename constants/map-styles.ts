/**
 * Google Maps Custom Styling
 *
 * Branded map styles for Loop app - works on both iOS and Android
 * when using PROVIDER_GOOGLE with react-native-maps.
 *
 * References:
 * - https://mapstyle.withgoogle.com/
 * - https://developers.google.com/maps/documentation/javascript/styling
 */

// Light mode map style - clean, modern, subtle
export const MAP_STYLE_LIGHT = [
  // Simplify landscape features
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#f5f5f5' }],
  },
  // Soften water colors
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#c9e4f5' }],
  },
  // Subtle road colors
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#e0e0e0' }],
  },
  // Mute transit elements
  {
    featureType: 'transit',
    stylers: [{ visibility: 'simplified' }],
  },
  // Subtle POI labels
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'simplified' }],
  },
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }],
  },
  // Keep parks visible but subtle
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#e5f5e0' }],
  },
];

// Dark mode map style - modern, OLED-friendly
export const MAP_STYLE_DARK = [
  // Dark landscape
  {
    elementType: 'geometry',
    stylers: [{ color: '#1a1a1a' }],
  },
  // Dark labels
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8e8e93' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#1a1a1a' }],
  },
  // Dark water
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0a1929' }],
  },
  // Subtle roads
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#2c2c2e' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1c1c1e' }],
  },
  // Highway accent (subtle brand color)
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#3a3f47' }],
  },
  // Mute transit
  {
    featureType: 'transit',
    stylers: [{ visibility: 'simplified' }],
  },
  // Hide most POIs for cleaner look
  {
    featureType: 'poi',
    stylers: [{ visibility: 'simplified' }],
  },
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }],
  },
  // Dark parks
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#1f2d1f' }],
  },
];

// Get map style based on color scheme
export const getMapStyle = (colorScheme: 'light' | 'dark' | null) => {
  return colorScheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
};
