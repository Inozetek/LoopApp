/**
 * Location Service
 *
 * Handles GPS location permissions and retrieval
 * Provides utilities for distance calculations
 * Caches location for performance
 */

import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';

// Dallas coordinates (fallback if location permission denied)
const FALLBACK_LOCATION = {
  latitude: 32.7767,
  longitude: -96.797,
  city: 'Dallas',
  state: 'TX',
};

// Cache location for 5 minutes to avoid excessive GPS queries
let cachedLocation: Location.LocationObject | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Request location permissions with user-friendly messaging
 */
export async function requestLocationPermissions(): Promise<boolean> {
  try {
    // Check current permission status
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

    if (existingStatus === 'granted') {
      return true;
    }

    // Request permission
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status === 'granted') {
      console.log('✅ Location permission granted');
      return true;
    }

    // Permission denied
    console.log('❌ Location permission denied');

    // Show helpful message
    if (Platform.OS === 'ios') {
      Alert.alert(
        'Location Permission Required',
        'Loop needs access to your location to show nearby activities.\n\nGo to Settings > Loop > Location and select "While Using the App".',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Location Permission Required',
        'Loop needs access to your location to show nearby activities.\n\nPlease enable location permission in your device settings.',
        [{ text: 'OK' }]
      );
    }

    return false;
  } catch (error) {
    console.error('Error requesting location permissions:', error);
    return false;
  }
}

/**
 * Get user's current location
 * Returns cached location if still valid, otherwise fetches new location
 */
export async function getCurrentLocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy?: number;
  city?: string;
  state?: string;
}> {
  try {
    // Check cache first
    const now = Date.now();
    if (cachedLocation && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('📍 Using cached location');
      return {
        latitude: cachedLocation.coords.latitude,
        longitude: cachedLocation.coords.longitude,
        accuracy: cachedLocation.coords.accuracy ?? undefined,
      };
    }

    // Check permission
    const { status } = await Location.getForegroundPermissionsAsync();

    if (status !== 'granted') {
      console.log('📍 Location permission not granted, using fallback location (Dallas)');
      return FALLBACK_LOCATION;
    }

    // Get current location
    console.log('📍 Fetching current GPS location...');
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced, // Good balance of speed and accuracy
    });

    // Cache the location
    cachedLocation = location;
    cacheTimestamp = now;

    console.log(`✅ Location acquired: ${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`);

    // Optionally get city/state from reverse geocoding
    let city: string | undefined;
    let state: string | undefined;

    try {
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address) {
        city = address.city ?? undefined;
        state = address.region ?? undefined;
        console.log(`📍 Location: ${city}, ${state}`);
      }
    } catch (geocodeError) {
      console.log('Note: Could not reverse geocode location');
    }

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? undefined,
      city,
      state,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    console.log('📍 Using fallback location (Dallas)');
    return FALLBACK_LOCATION;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if user is within a certain distance of a location
 */
export function isWithinDistance(
  userLat: number,
  userLon: number,
  targetLat: number,
  targetLon: number,
  maxDistanceMiles: number
): boolean {
  const distance = calculateDistance(userLat, userLon, targetLat, targetLon);
  return distance <= maxDistanceMiles;
}

/**
 * Sort activities by distance from user
 */
export function sortByDistance<T extends { location: { latitude: number; longitude: number } }>(
  items: T[],
  userLat: number,
  userLon: number
): T[] {
  return [...items].sort((a, b) => {
    const distA = calculateDistance(
      userLat,
      userLon,
      a.location.latitude,
      a.location.longitude
    );
    const distB = calculateDistance(
      userLat,
      userLon,
      b.location.latitude,
      b.location.longitude
    );
    return distA - distB;
  });
}

/**
 * Clear cached location (force refresh on next call)
 */
export function clearLocationCache(): void {
  cachedLocation = null;
  cacheTimestamp = 0;
  console.log('📍 Location cache cleared');
}

/**
 * Get location permission status without requesting
 */
export async function getLocationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();

    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch (error) {
    console.error('Error checking location permission:', error);
    return 'denied';
  }
}

/**
 * Watch user's location in real-time (for advanced features like commute tracking)
 * Returns a subscription that must be removed when done
 */
export async function watchLocation(
  callback: (location: Location.LocationObject) => void
): Promise<{ remove: () => void } | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();

    if (status !== 'granted') {
      console.log('Cannot watch location: permission not granted');
      return null;
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000, // Update every 30 seconds
        distanceInterval: 100, // Update every 100 meters
      },
      (location) => {
        cachedLocation = location;
        cacheTimestamp = Date.now();
        callback(location);
      }
    );

    return subscription;
  } catch (error) {
    console.error('Error watching location:', error);
    return null;
  }
}

/**
 * Format distance for display
 */
export function formatDistance(miles: number): string {
  if (miles < 0.1) return 'Nearby';
  if (miles < 1) return `${(miles * 5280).toFixed(0)} ft`;
  return `${miles.toFixed(1)} mi`;
}

/**
 * Get travel time estimate (rough estimate based on avg speed)
 */
export function estimateTravelTime(distanceMiles: number): string {
  if (distanceMiles < 0.5) return '< 5 min';

  // Assume 15 mph average in city (walking + driving mix)
  const minutes = Math.round((distanceMiles / 15) * 60);

  if (minutes < 60) return `~${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `~${hours}h ${mins}m` : `~${hours}h`;
}
