/**
 * Cache Management Service
 *
 * Manages city-based caching of places and events to minimize API costs.
 *
 * Core Principles:
 * - City-based caching: Only fetch data for cities where users exist
 * - Category-based lazy loading: Only cache categories matching user interests
 * - Tiered refresh: Free (60 days), Plus (30 days), Premium (15 days)
 * - Zero ongoing API costs (stay within Google Places free tier)
 *
 * Architecture:
 * - places_cache table: Stores Google Places API results per city
 * - events_cache table: Stores Ticketmaster events per city
 * - Check cache → seed if missing → query cache → return results
 */

import { supabase } from '@/lib/supabase';
import { searchNearbyActivities, getPlaceDetails } from './google-places';
import { generatePlaceDescriptions } from './gemini-service';
import type { Activity } from '@/types/activity';

export interface CacheStatus {
  exists: boolean;
  count: number;
  lastCached: Date | null;
  isStale: boolean;
}

export interface CachedPlace {
  id: string;
  city: string;
  state: string;
  place_id: string;
  place_data: any; // Full Google Places API response
  category: string | null;
  lat: number;
  lng: number;
  cached_at: string;
  last_used: string;
  use_count: number;
  is_stale: boolean;
  refresh_cadence_days: number;
}

/**
 * Check if a city has cached data and whether it's fresh
 *
 * Uses the PostgreSQL function check_city_cache() created in migration.
 *
 * @param city - City name (e.g., "Dallas")
 * @param state - State abbreviation (e.g., "TX")
 * @param refreshDays - Number of days before cache is considered stale (default: 60)
 * @returns CacheStatus with exists, count, lastCached, isStale
 *
 * @example
 * const status = await checkCityCache("Dallas", "TX", 60);
 * if (!status.exists) {
 *   await seedCityData("Dallas", "TX", 32.7767, -96.7970, ["restaurant", "cafe"]);
 * }
 */
export async function checkCityCache(
  city: string,
  state: string,
  refreshDays: number = 60
): Promise<CacheStatus> {
  console.log(`🔍 Checking cache for ${city}, ${state} (${refreshDays}-day refresh)...`);

  try {
    const { data, error } = await supabase.rpc('check_city_cache', {
      p_city: city,
      p_state: state,
      p_refresh_days: refreshDays,
    });

    if (error) {
      console.error(`❌ Error checking city cache:`, error);
      throw new Error(`Failed to check city cache: ${error.message}`);
    }

    // The RPC function returns an array with one result
    const result = data && data.length > 0 ? data[0] : null;

    if (!result) {
      console.log(`📭 No cache data found for ${city}, ${state}`);
      return {
        exists: false,
        count: 0,
        lastCached: null,
        isStale: false,
      };
    }

    const cacheStatus: CacheStatus = {
      exists: result.cache_exists || false,
      count: parseInt(result.place_count) || 0,
      lastCached: result.last_cached ? new Date(result.last_cached) : null,
      isStale: result.is_stale || false,
    };

    if (cacheStatus.exists) {
      console.log(`✅ Cache exists for ${city}, ${state}:`);
      console.log(`   - ${cacheStatus.count} places cached`);
      console.log(`   - Last cached: ${cacheStatus.lastCached?.toLocaleDateString()}`);
      console.log(`   - Is stale: ${cacheStatus.isStale ? 'Yes (needs refresh)' : 'No (fresh)'}`);
    } else {
      console.log(`📭 No cache found for ${city}, ${state}`);
    }

    return cacheStatus;
  } catch (error) {
    console.error(`❌ Error in checkCityCache:`, error);
    throw error;
  }
}

/**
 * Seed city data by fetching from Google Places API and caching results
 *
 * Strategy:
 * - Only cache categories matching user interests (category-based lazy loading)
 * - Filter by rating (>4.0) and review count (>50) for quality
 * - Store full API response in place_data JSONB for flexibility
 * - Cache refresh cadence based on user's subscription tier
 *
 * @param city - City name
 * @param state - State abbreviation
 * @param lat - City latitude
 * @param lng - City longitude
 * @param categories - Array of category types to fetch (e.g., ["restaurant", "cafe", "museum"])
 * @param refreshCadenceDays - Cache refresh cadence (Free: 60, Plus: 30, Premium: 15)
 * @returns Number of places cached
 *
 * @example
 * const count = await seedCityData("Dallas", "TX", 32.7767, -96.7970, ["restaurant", "cafe"], 60);
 * console.log(`Cached ${count} places for Dallas`);
 */
export async function seedCityData(
  city: string,
  state: string,
  lat: number,
  lng: number,
  categories: string[],
  refreshCadenceDays: number = 60
): Promise<number> {
  console.log(`🌱 Seeding cache for ${city}, ${state}...`);
  console.log(`   Categories: ${categories.join(', ')}`);
  console.log(`   Refresh cadence: ${refreshCadenceDays} days`);

  let totalCached = 0;

  try {
    // Fetch places for each category
    for (const category of categories) {
      console.log(`\n📍 Fetching ${category} places near ${city}, ${state}...`);

      try {
        // Call Google Places API
        const places = await searchNearbyActivities(
          { latitude: lat, longitude: lng },
          8000, // 8km radius (~5 miles)
          category
        );

        console.log(`   Found ${places.length} ${category} places`);

        // Filter for quality (rating >= 3.5, review count >= 10)
        // Relaxed from 4.0/50 to avoid empty caches in smaller cities
        const qualityPlaces = places.filter(place =>
          (place.rating || 0) >= 3.5 && (place.reviewsCount || 0) >= 10
        );

        console.log(`   Filtered to ${qualityPlaces.length} quality places`);

        if (qualityPlaces.length === 0) {
          console.log(`   ⚠️ No quality ${category} places found, skipping...`);
          continue;
        }

        // Generate AI descriptions for this batch (Gemini Flash, free tier)
        // If Gemini fails or quota exhausted, returns empty map — templates take over
        const aiDescriptions = await generatePlaceDescriptions(qualityPlaces, city);
        if (aiDescriptions.size > 0) {
          for (const place of qualityPlaces) {
            const placeId = place.googlePlaceId || place.id;
            const desc = aiDescriptions.get(placeId);
            if (desc) {
              place.aiDescription = desc;
            }
          }
          console.log(`   ✨ Attached ${aiDescriptions.size} AI descriptions`);
        }

        // Insert into places_cache table
        const cacheRecords = qualityPlaces.map(place => ({
          city,
          state,
          lat: place.location.latitude,
          lng: place.location.longitude,
          place_id: place.googlePlaceId || `place-${Date.now()}`,
          place_data: place, // Store full Activity object
          category,
          cached_at: new Date().toISOString(),
          last_used: new Date().toISOString(),
          use_count: 0,
          is_stale: false,
          refresh_cadence_days: refreshCadenceDays,
        }));

        // Use regular client (RLS policies must allow authenticated users to insert)
        // NOTE: For production, move cache seeding to a Supabase Edge Function with service role key
        const { data, error } = await supabase
          .from('places_cache')
          .upsert(cacheRecords, {
            onConflict: 'city,place_id',
            ignoreDuplicates: false, // Update existing records
          });

        if (error) {
          console.error(`❌ Error caching ${category} places:`, error);
          continue; // Skip this category, continue with others
        }

        totalCached += qualityPlaces.length;
        console.log(`   ✅ Cached ${qualityPlaces.length} ${category} places`);

        // Rate limiting: wait 1 second between categories to avoid API throttling
        if (categories.indexOf(category) < categories.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (categoryError) {
        console.error(`❌ Error fetching ${category} places:`, categoryError);
        // Continue with other categories even if one fails
        continue;
      }
    }

    console.log(`\n✅ Seeding complete for ${city}, ${state}`);
    console.log(`   Total places cached: ${totalCached}`);
    console.log(`   Cache will expire in ${refreshCadenceDays} days`);

    return totalCached;

  } catch (error) {
    console.error(`❌ Error in seedCityData:`, error);
    throw error;
  }
}

/**
 * Get cached places for a city from the database
 *
 * Returns fresh (non-stale) places sorted by last_used (most recent first).
 * Optionally filter by category.
 *
 * @param city - City name
 * @param state - State abbreviation
 * @param category - Optional category filter (e.g., "restaurant")
 * @param limit - Maximum number of results (default: 100)
 * @returns Array of Activity objects from cache
 *
 * @example
 * const places = await getCachedPlaces("Dallas", "TX", "restaurant", 20);
 * console.log(`Found ${places.length} restaurants in Dallas cache`);
 */
export async function getCachedPlaces(
  city: string,
  state: string,
  category?: string,
  limit: number = 500  // Support explore mode (maxResults 30 × multiplier 10 = 300)
): Promise<Activity[]> {
  console.log(`📥 Loading cached places for ${city}, ${state}...`);
  if (category) {
    console.log(`   Category filter: ${category}`);
  }

  const apiDisabled = process.env.EXPO_PUBLIC_DISABLE_GOOGLE_PLACES_API === 'true';

  try {
    // Build query — when API is disabled, include stale data (can't refresh anyway)
    let query = supabase
      .from('places_cache')
      .select('*')
      .eq('city', city)
      .eq('state', state)
      .order('last_used', { descending: true })
      .limit(limit);

    if (!apiDisabled) {
      query = query.eq('is_stale', false);
    }

    // Add category filter if specified
    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`❌ Error loading cached places:`, error);
      throw new Error(`Failed to load cached places: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.log(`📭 No cached places found for ${city}, ${state}${category ? ` (${category})` : ''}`);
      return [];
    }

    // Extract Activity objects from place_data JSONB
    const places = data.map((record: any) => record.place_data as Activity);

    console.log(`✅ Loaded ${places.length} cached places`);

    // Update last_used timestamp for these places (fire and forget, don't await)
    // NOTE: For production, move to Supabase Edge Function with service role key
    supabase
      .from('places_cache')
      .update({
        last_used: new Date().toISOString(),
      })
      .eq('city', city)
      .eq('state', state)
      .then(() => {
        console.log(`   Updated last_used timestamp for ${city}, ${state} places`);
      })
      .catch((updateError: any) => {
        console.warn(`⚠️ Failed to update last_used:`, updateError);
      });

    return places;

  } catch (error) {
    console.error(`❌ Error in getCachedPlaces:`, error);
    throw error;
  }
}

/**
 * Mark stale places for refresh
 *
 * Runs as a scheduled job to identify places that need refreshing.
 * Places are marked stale based on their refresh_cadence_days.
 *
 * @returns Number of places marked as stale
 */
export async function markStalePlaces(): Promise<number> {
  console.log('🔄 Marking stale places for refresh...');

  try {
    // NOTE: For production, move to Supabase Edge Function with service role key
    const { data, error } = await supabase.rpc('mark_stale_places', {
      p_refresh_days: 60, // Default: mark places older than 60 days as stale
    });

    if (error) {
      console.error(`❌ Error marking stale places:`, error);
      throw new Error(`Failed to mark stale places: ${error.message}`);
    }

    const count = data || 0;
    console.log(`✅ Marked ${count} places as stale`);

    return count;

  } catch (error) {
    console.error(`❌ Error in markStalePlaces:`, error);
    throw error;
  }
}

/**
 * Delete old stale places from cache (cleanup)
 *
 * Removes places that have been stale for >90 days and haven't been used.
 * This prevents cache bloat.
 *
 * @returns Number of places deleted
 */
export async function cleanupOldStalePlaces(): Promise<number> {
  console.log('🧹 Cleaning up old stale places...');

  try {
    // NOTE: For production, move to Supabase Edge Function with service role key
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data, error } = await supabase
      .from('places_cache')
      .delete()
      .eq('is_stale', true)
      .lt('last_used', ninetyDaysAgo.toISOString());

    if (error) {
      console.error(`❌ Error cleaning up old places:`, error);
      throw new Error(`Failed to cleanup old places: ${error.message}`);
    }

    const count = data?.length || 0;
    console.log(`✅ Deleted ${count} old stale places`);

    return count;

  } catch (error) {
    console.error(`❌ Error in cleanupOldStalePlaces:`, error);
    throw error;
  }
}

/**
 * Get cache statistics for admin/analytics
 *
 * @returns Cache statistics
 */
export async function getCacheStatistics(): Promise<{
  totalPlaces: number;
  totalCities: number;
  stalePlaces: number;
  avgPlacesPerCity: number;
  topCities: { city: string; state: string; count: number }[];
}> {
  console.log('📊 Fetching cache statistics...');

  try {
    // Get total places
    const { count: totalPlaces, error: totalError } = await supabase
      .from('places_cache')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      throw totalError;
    }

    // Get stale places count
    const { count: stalePlaces, error: staleError } = await supabase
      .from('places_cache')
      .select('*', { count: 'exact', head: true })
      .eq('is_stale', true);

    if (staleError) {
      throw staleError;
    }

    // Get unique cities count
    const { data: cities, error: citiesError } = await supabase
      .from('places_cache')
      .select('city, state')
      .limit(1000);

    if (citiesError) {
      throw citiesError;
    }

    const uniqueCities = new Set(cities?.map((c: { city: string; state: string }) => `${c.city},${c.state}`) || []);
    const totalCities = uniqueCities.size;

    // Get top 5 cities by place count
    const { data: cityStats, error: statsError } = await supabase
      .from('places_cache')
      .select('city, state')
      .limit(10000);

    if (statsError) {
      throw statsError;
    }

    const cityCounts = new Map<string, number>();
    cityStats?.forEach((place: any) => {
      const key = `${place.city},${place.state}`;
      cityCounts.set(key, (cityCounts.get(key) || 0) + 1);
    });

    const topCities = Array.from(cityCounts.entries())
      .map(([key, count]) => {
        const [city, state] = key.split(',');
        return { city, state, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const stats = {
      totalPlaces: totalPlaces || 0,
      totalCities,
      stalePlaces: stalePlaces || 0,
      avgPlacesPerCity: totalCities > 0 ? Math.round((totalPlaces || 0) / totalCities) : 0,
      topCities,
    };

    console.log('✅ Cache statistics:', stats);

    return stats;

  } catch (error) {
    console.error(`❌ Error in getCacheStatistics:`, error);
    throw error;
  }
}
