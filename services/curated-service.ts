/**
 * Curated Recommendations Service
 * Fetches hand-curated "Loop Picks" from the curated_recommendations table.
 * Used for first-session magic and ongoing feed enhancement.
 */

import { supabase } from '@/lib/supabase';
import type { PlaceResult } from './recommendations';

export interface CuratedRecommendation {
  id: string;
  city: string;
  state: string;
  place_name: string;
  place_data: any; // Activity-shaped JSONB
  categories: string[];
  age_brackets: string[];
  time_of_day: string[];
  curated_explanation: string;
  curator: string;
  priority: number;
  is_active: boolean;
}

/**
 * Compute age bracket from birth year
 */
export function getAgeBracket(birthYear?: number | null): string | undefined {
  if (!birthYear) return undefined;
  const age = new Date().getFullYear() - birthYear;
  if (age < 18) return undefined; // Too young
  if (age <= 24) return '18-24';
  if (age <= 34) return '25-34';
  if (age <= 44) return '35-44';
  return '45+';
}

/**
 * Compute age bracket from a User object
 */
export function getAgeBracketFromUser(user: { birth_year?: number | null; age_bracket?: string | null }): string | undefined {
  if (user.age_bracket) return user.age_bracket;
  return getAgeBracket(user.birth_year);
}

/**
 * Fetch curated recommendations matching user context.
 * Filters by city, overlapping interests, time of day, and optionally age bracket.
 */
export async function getCuratedRecommendations(
  city: string,
  state: string,
  interests: string[],
  timeOfDay: string,
  ageBracket?: string,
  limit: number = 15
): Promise<PlaceResult[]> {
  try {
    console.log(`[Curated] Fetching picks for ${city}, ${state}`);
    console.log(`[Curated] Interests: ${interests.join(', ')}`);
    console.log(`[Curated] Time: ${timeOfDay}, Age: ${ageBracket || 'unknown'}`);

    // Query curated_recommendations with overlap filters
    let query = supabase
      .from('curated_recommendations')
      .select('*')
      .eq('city', city)
      .eq('state', state)
      .eq('is_active', true)
      .contains('time_of_day', [timeOfDay])
      .order('priority', { ascending: false })
      .limit(limit * 2); // Over-fetch for interest filtering

    // If age bracket known, filter by it
    if (ageBracket) {
      query = query.contains('age_brackets', [ageBracket]);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Curated] Query error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('[Curated] No curated picks found for this city');
      return [];
    }

    console.log(`[Curated] Found ${data.length} raw curated picks`);

    // Score by interest overlap — picks matching more user interests rank higher
    const scored = (data as CuratedRecommendation[]).map(pick => {
      const interestOverlap = pick.categories.filter(cat =>
        interests.includes(cat)
      ).length;
      return { pick, interestOverlap };
    });

    // Sort: interest overlap DESC, then priority DESC
    scored.sort((a, b) => {
      if (b.interestOverlap !== a.interestOverlap) return b.interestOverlap - a.interestOverlap;
      return b.pick.priority - a.pick.priority;
    });

    // Take top N
    const topPicks = scored.slice(0, limit);

    console.log(`[Curated] Returning ${topPicks.length} curated picks (${topPicks.filter(s => s.interestOverlap > 0).length} with interest match)`);

    // Convert to PlaceResult format
    return topPicks.map(({ pick }) => curatedToPlaceResult(pick));
  } catch (error) {
    console.error('[Curated] Unexpected error:', error);
    return [];
  }
}

/**
 * Convert a curated recommendation's place_data JSONB to PlaceResult format.
 * Attaches the curated explanation as a special property.
 */
function curatedToPlaceResult(curated: CuratedRecommendation): PlaceResult {
  const pd = curated.place_data;

  const result: PlaceResult & { _curatedExplanation?: string; _isCurated?: boolean; _curatorName?: string } = {
    place_id: pd.googlePlaceId || pd.id || curated.id,
    name: pd.name || curated.place_name,
    vicinity: pd.location?.address || '',
    formatted_address: pd.location?.address || '',
    description: pd.description,
    formatted_phone_number: pd.phone,
    website: pd.website,
    geometry: {
      location: {
        lat: pd.location?.latitude || 0,
        lng: pd.location?.longitude || 0,
      },
    },
    types: pd.category ? [pd.category] : [],
    rating: pd.rating || 0,
    user_ratings_total: pd.reviewsCount || 0,
    price_level: pd.priceRange || 0,
    photos: pd.photoUrl ? [{ photo_reference: pd.photoUrl }] : [],
    opening_hours: {
      open_now: undefined,
      periods: pd.openingHoursPeriods,
    },
    source: 'google_places',
    // Curated metadata (used by scoring and explanation generator)
    _curatedExplanation: curated.curated_explanation,
    _isCurated: true,
    _curatorName: curated.curator !== 'loop_team' ? curated.curator : undefined,
  };

  return result as PlaceResult;
}
