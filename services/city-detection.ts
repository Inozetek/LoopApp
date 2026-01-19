/**
 * City Detection Service
 *
 * Detects user's city from their home location coordinates using reverse geocoding.
 * This is used to determine which city cache to query for recommendations.
 *
 * Design Philosophy:
 * - Cache city data only for cities where users exist (on-demand)
 * - Use home_location as primary source (most stable)
 * - Fall back to work_location or current_location if needed
 * - Return city + state + coordinates for cache queries
 */

import { reverseGeocode } from './geocoding';
import type { User } from '@/types/database';

export interface CityInfo {
  city: string;
  state: string;
  lat: number;
  lng: number;
  formattedAddress?: string;
}

export interface PostGISLocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude] (GeoJSON format)
}

/**
 * Detect user's city from their home location using reverse geocoding
 *
 * @param user - User object with home_location (PostGIS GEOGRAPHY type)
 * @returns Promise<CityInfo> with city, state, lat, lng
 * @throws Error if user has no home location or geocoding fails
 *
 * @example
 * const cityInfo = await detectUserCity(user);
 * // { city: "Dallas", state: "TX", lat: 32.7767, lng: -96.7970 }
 */
export async function detectUserCity(user: User): Promise<CityInfo> {
  console.log(`🏙️ Detecting city for user: ${user.email}`);

  // Extract coordinates from PostGIS GEOGRAPHY type
  const homeLocation = user.home_location as PostGISLocation | null;

  if (!homeLocation || !homeLocation.coordinates) {
    console.error(`❌ User ${user.email} has no home_location set`);
    throw new Error('User must set home address before recommendations can be generated');
  }

  // PostGIS stores as [longitude, latitude] (GeoJSON format)
  const lng = homeLocation.coordinates[0];
  const lat = homeLocation.coordinates[1];

  console.log(`📍 Home location coordinates: ${lat}, ${lng}`);

  // Reverse geocode to get city and state
  const geocodingResult = await reverseGeocode(lat, lng);

  if (!geocodingResult.addressComponents?.city || !geocodingResult.addressComponents?.state) {
    console.error(`❌ Failed to extract city/state from coordinates: ${lat}, ${lng}`);
    throw new Error('Could not determine city from home address. Please verify your home address.');
  }

  const cityInfo: CityInfo = {
    city: geocodingResult.addressComponents.city,
    state: geocodingResult.addressComponents.state,
    lat,
    lng,
    formattedAddress: geocodingResult.formattedAddress,
  };

  console.log(`✅ Detected city: ${cityInfo.city}, ${cityInfo.state}`);

  return cityInfo;
}

/**
 * Detect user's city with fallback logic
 * Priority: current location (runtime GPS) → home → work → stored current
 *
 * @param user - User object
 * @param currentCoords - Optional current GPS coordinates { lat, lng } (highest priority)
 * @returns Promise<CityInfo> or null if no location available
 *
 * @example
 * // Use current GPS location (best - where user is NOW)
 * const cityInfo = await detectUserCityWithFallback(user, { lat: 32.7767, lng: -96.7970 });
 *
 * // Fall back to stored locations if GPS unavailable
 * const cityInfo = await detectUserCityWithFallback(user);
 */
export async function detectUserCityWithFallback(
  user: User,
  currentCoords?: { lat: number; lng: number }
): Promise<CityInfo | null> {
  console.log(`🏙️ Detecting city with fallback for user: ${user.email}`);

  // Priority 1: Use current GPS coordinates (where user is NOW)
  if (currentCoords) {
    try {
      console.log(`📍 Using current GPS coordinates: ${currentCoords.lat}, ${currentCoords.lng}`);

      const geocodingResult = await reverseGeocode(currentCoords.lat, currentCoords.lng);

      if (geocodingResult.addressComponents?.city && geocodingResult.addressComponents?.state) {
        const cityInfo: CityInfo = {
          city: geocodingResult.addressComponents.city,
          state: geocodingResult.addressComponents.state,
          lat: currentCoords.lat,
          lng: currentCoords.lng,
          formattedAddress: geocodingResult.formattedAddress,
        };

        console.log(`✅ Used current GPS location: ${cityInfo.city}, ${cityInfo.state}`);
        return cityInfo;
      }
    } catch (error) {
      console.warn(`⚠️ Current GPS location failed, trying stored home_location:`, error);
    }
  }

  // Priority 2: Try home location (most stable stored location)
  const homeLocation = user.home_location as PostGISLocation | null;

  if (homeLocation?.coordinates) {
    try {
      const cityInfo = await detectUserCity(user);
      console.log(`✅ Used stored home_location: ${cityInfo.city}, ${cityInfo.state}`);
      return cityInfo;
    } catch (error) {
      console.warn(`⚠️ home_location failed, trying work_location:`, error);
    }
  }

  // Priority 3: Fallback to work location
  const workLocation = user.work_location as PostGISLocation | null;

  if (workLocation?.coordinates) {
    try {
      const lng = workLocation.coordinates[0];
      const lat = workLocation.coordinates[1];

      console.log(`📍 Work location coordinates: ${lat}, ${lng}`);

      const geocodingResult = await reverseGeocode(lat, lng);

      if (geocodingResult.addressComponents?.city && geocodingResult.addressComponents?.state) {
        const cityInfo: CityInfo = {
          city: geocodingResult.addressComponents.city,
          state: geocodingResult.addressComponents.state,
          lat,
          lng,
          formattedAddress: geocodingResult.formattedAddress,
        };

        console.log(`✅ Used stored work_location: ${cityInfo.city}, ${cityInfo.state}`);
        return cityInfo;
      }
    } catch (error) {
      console.warn(`⚠️ work_location failed, trying current_location:`, error);
    }
  }

  // Priority 4: Fallback to stored current location (least reliable)
  const currentLocation = user.current_location as PostGISLocation | null;

  if (currentLocation?.coordinates) {
    try {
      const lng = currentLocation.coordinates[0];
      const lat = currentLocation.coordinates[1];

      console.log(`📍 Stored current location coordinates: ${lat}, ${lng}`);

      const geocodingResult = await reverseGeocode(lat, lng);

      if (geocodingResult.addressComponents?.city && geocodingResult.addressComponents?.state) {
        const cityInfo: CityInfo = {
          city: geocodingResult.addressComponents.city,
          state: geocodingResult.addressComponents.state,
          lat,
          lng,
          formattedAddress: geocodingResult.formattedAddress,
        };

        console.log(`✅ Used stored current_location: ${cityInfo.city}, ${cityInfo.state}`);
        return cityInfo;
      }
    } catch (error) {
      console.error(`❌ All location sources failed:`, error);
    }
  }

  // No location available - this is expected for users who haven't set their home address yet
  console.warn(`⚠️ User ${user.email} has no location data - will use API fallback`);
  return null;
}

/**
 * Batch detect cities for multiple users (useful for analytics)
 * Includes rate limiting to avoid hitting API quotas
 *
 * @param users - Array of User objects
 * @param delayMs - Delay between requests in milliseconds (default 200ms)
 * @returns Promise<Map<userId, CityInfo | null>>
 */
export async function batchDetectUserCities(
  users: User[],
  delayMs: number = 200
): Promise<Map<string, CityInfo | null>> {
  console.log(`🏙️ Batch detecting cities for ${users.length} users...`);

  const results = new Map<string, CityInfo | null>();

  for (const user of users) {
    try {
      const cityInfo = await detectUserCityWithFallback(user);
      results.set(user.id, cityInfo);
    } catch (error) {
      console.error(`Failed to detect city for user ${user.email}:`, error);
      results.set(user.id, null);
    }

    // Rate limiting: wait before next request
    if (users.indexOf(user) < users.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  const successCount = Array.from(results.values()).filter(c => c !== null).length;
  console.log(`✅ Successfully detected cities for ${successCount}/${users.length} users`);

  return results;
}

/**
 * Get unique cities from a list of users (for analytics/admin)
 *
 * @param users - Array of User objects
 * @returns Promise<CityInfo[]> - Unique cities where users are located
 */
export async function getUniqueCitiesFromUsers(users: User[]): Promise<CityInfo[]> {
  console.log(`🏙️ Getting unique cities from ${users.length} users...`);

  const cityMap = await batchDetectUserCities(users);
  const uniqueCities = new Map<string, CityInfo>();

  for (const [userId, cityInfo] of cityMap.entries()) {
    if (cityInfo) {
      const key = `${cityInfo.city},${cityInfo.state}`;
      if (!uniqueCities.has(key)) {
        uniqueCities.set(key, cityInfo);
      }
    }
  }

  const citiesArray = Array.from(uniqueCities.values());
  console.log(`✅ Found ${citiesArray.length} unique cities:`, citiesArray.map(c => `${c.city}, ${c.state}`).join(', '));

  return citiesArray;
}
