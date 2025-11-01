import { handleError } from '@/utils/error-handler';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId?: string;
  addressComponents?: {
    streetNumber?: string;
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
}

export interface GeocodingError {
  message: string;
  status: string;
}

/**
 * Geocode an address string to lat/lng coordinates using Google Maps Geocoding API
 *
 * @param address - The address string to geocode (e.g. "123 Main St, Dallas, TX 75001")
 * @returns Promise resolving to GeocodingResult with coordinates and formatted address
 * @throws Error if geocoding fails or no results found
 *
 * @example
 * const result = await geocodeAddress("1600 Amphitheatre Parkway, Mountain View, CA");
 * // { latitude: 37.4224, longitude: -122.0842, formattedAddress: "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA" }
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key not configured');
  }

  if (!address || address.trim().length === 0) {
    throw new Error('Address is required');
  }

  try {
    console.log(`🗺️ Geocoding address: "${address}"`);

    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error(`❌ Geocoding failed with status: ${data.status}`);

      if (data.status === 'ZERO_RESULTS') {
        throw new Error('No results found for this address. Please check the address and try again.');
      } else if (data.status === 'INVALID_REQUEST') {
        throw new Error('Invalid address format. Please enter a valid address.');
      } else if (data.status === 'REQUEST_DENIED') {
        throw new Error('Geocoding request denied. Please check API key configuration.');
      } else if (data.status === 'OVER_QUERY_LIMIT') {
        throw new Error('Geocoding quota exceeded. Please try again later.');
      } else {
        throw new Error(`Geocoding failed: ${data.status}`);
      }
    }

    if (!data.results || data.results.length === 0) {
      throw new Error('No results found for this address');
    }

    const result = data.results[0];
    const location = result.geometry.location;

    // Parse address components for structured data
    const addressComponents: GeocodingResult['addressComponents'] = {};

    result.address_components?.forEach((component: any) => {
      if (component.types.includes('street_number')) {
        addressComponents.streetNumber = component.long_name;
      } else if (component.types.includes('route')) {
        addressComponents.street = component.long_name;
      } else if (component.types.includes('locality')) {
        addressComponents.city = component.long_name;
      } else if (component.types.includes('administrative_area_level_1')) {
        addressComponents.state = component.short_name;
      } else if (component.types.includes('postal_code')) {
        addressComponents.zipCode = component.long_name;
      } else if (component.types.includes('country')) {
        addressComponents.country = component.short_name;
      }
    });

    const geocodingResult: GeocodingResult = {
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      addressComponents,
    };

    console.log(`✅ Geocoded successfully: ${geocodingResult.formattedAddress}`);
    console.log(`📍 Coordinates: ${geocodingResult.latitude}, ${geocodingResult.longitude}`);

    return geocodingResult;

  } catch (error) {
    console.error('❌ Geocoding error:', error);

    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to geocode address');
    }
  }
}

/**
 * Reverse geocode lat/lng coordinates to an address using Google Maps Geocoding API
 *
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @returns Promise resolving to GeocodingResult with address information
 * @throws Error if reverse geocoding fails
 *
 * @example
 * const result = await reverseGeocode(37.4224, -122.0842);
 * // { latitude: 37.4224, longitude: -122.0842, formattedAddress: "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA" }
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodingResult> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key not configured');
  }

  if (!latitude || !longitude) {
    throw new Error('Latitude and longitude are required');
  }

  try {
    console.log(`🗺️ Reverse geocoding: ${latitude}, ${longitude}`);

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error(`❌ Reverse geocoding failed with status: ${data.status}`);
      throw new Error(`Reverse geocoding failed: ${data.status}`);
    }

    if (!data.results || data.results.length === 0) {
      throw new Error('No address found for these coordinates');
    }

    const result = data.results[0];

    // Parse address components
    const addressComponents: GeocodingResult['addressComponents'] = {};

    result.address_components?.forEach((component: any) => {
      if (component.types.includes('street_number')) {
        addressComponents.streetNumber = component.long_name;
      } else if (component.types.includes('route')) {
        addressComponents.street = component.long_name;
      } else if (component.types.includes('locality')) {
        addressComponents.city = component.long_name;
      } else if (component.types.includes('administrative_area_level_1')) {
        addressComponents.state = component.short_name;
      } else if (component.types.includes('postal_code')) {
        addressComponents.zipCode = component.long_name;
      } else if (component.types.includes('country')) {
        addressComponents.country = component.short_name;
      }
    });

    const geocodingResult: GeocodingResult = {
      latitude,
      longitude,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      addressComponents,
    };

    console.log(`✅ Reverse geocoded successfully: ${geocodingResult.formattedAddress}`);

    return geocodingResult;

  } catch (error) {
    console.error('❌ Reverse geocoding error:', error);

    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to reverse geocode coordinates');
    }
  }
}

/**
 * Validate that an address can be geocoded before attempting to store it
 * Useful for form validation in the onboarding flow
 *
 * @param address - The address string to validate
 * @returns Promise resolving to true if valid, false otherwise
 *
 * @example
 * const isValid = await validateAddress("123 Main St, Dallas, TX");
 * if (!isValid) {
 *   showError("Please enter a valid address");
 * }
 */
export async function validateAddress(address: string): Promise<boolean> {
  try {
    await geocodeAddress(address);
    return true;
  } catch (error) {
    console.log(`⚠️ Address validation failed: ${address}`);
    return false;
  }
}

/**
 * Batch geocode multiple addresses (useful for migrating existing data)
 * Includes rate limiting to avoid hitting API quotas
 *
 * @param addresses - Array of address strings to geocode
 * @param delayMs - Delay between requests in milliseconds (default 200ms)
 * @returns Promise resolving to array of results (null for failed geocoding)
 */
export async function batchGeocodeAddresses(
  addresses: string[],
  delayMs: number = 200
): Promise<(GeocodingResult | null)[]> {
  const results: (GeocodingResult | null)[] = [];

  for (const address of addresses) {
    try {
      const result = await geocodeAddress(address);
      results.push(result);
    } catch (error) {
      console.error(`Failed to geocode: ${address}`, error);
      results.push(null);
    }

    // Rate limiting: wait before next request
    if (addresses.indexOf(address) < addresses.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log(`✅ Batch geocoded ${results.filter(r => r !== null).length}/${addresses.length} addresses`);

  return results;
}
