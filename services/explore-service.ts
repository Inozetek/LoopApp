/**
 * Explore Service
 *
 * Consolidates data fetching for the explore grid.
 * Handles progressive distance expansion, moment interleaving,
 * and tile size assignment for visual variety.
 */

import type { User } from '@/types/database';
import type { Moment } from '@/types/moment';
import type { ExploreItem, ExploreRowLayout, ExploreRow } from '@/types/explore';
import { generateRecommendations, type RecommendationParams, type ScoredRecommendation } from '@/services/recommendations';
import { getFriendMoments, getPlaceMoments } from '@/services/moments-service';

// Progressive distance tiers in miles
export const DISTANCE_TIERS = [5, 10, 15, 25, 50, 100];

export interface ExploreBatch {
  items: ExploreItem[];
  hasMore: boolean;
  nextDistanceTier: number;
}

/**
 * Convert a ScoredRecommendation to an ExploreItem
 */
function recommendationToExploreItem(rec: ScoredRecommendation): ExploreItem {
  const place = rec.place;
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';
  const photoRef = place?.photos?.[0]?.photo_reference;

  // Handle all photo reference formats:
  // - Full URL (Ticketmaster, already resolved): starts with http/https
  // - New Google Places API v1: starts with "places/" - needs /media?... suffix
  // - Old Google Places API: raw reference string - needs full URL construction
  let imageUrl: string | null = null;
  if (photoRef) {
    if (photoRef.startsWith('http://') || photoRef.startsWith('https://')) {
      // Already a full URL (Ticketmaster, etc.)
      imageUrl = photoRef;
    } else if (photoRef.startsWith('places/')) {
      // New Google Places API v1 format - construct media URL
      imageUrl = `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=400&key=${apiKey}`;
    } else {
      // Old API format - construct legacy URL
      imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${apiKey}`;
    }
  }

  // Also check for photoUrl directly on the recommendation (from scoring)
  if (!imageUrl && (rec as any).photoUrl) {
    imageUrl = (rec as any).photoUrl;
  }

  // Debug logging for image issues
  if (!imageUrl) {
    console.log(`[Explore] ⚠️ No image for ${place?.name}:`, {
      hasPhotos: !!place?.photos,
      photosLength: place?.photos?.length || 0,
      hasPhotoRef: !!photoRef,
      hasRecPhotoUrl: !!(rec as any).photoUrl,
    });
  }

  // Format category from types
  const types = place?.types || [];
  const type = types.find((t: string) => !['point_of_interest', 'establishment'].includes(t)) || types[0];
  const category = type ? type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Activity';

  return {
    id: place?.place_id || `place-${Date.now()}-${Math.random()}`,
    type: 'place',
    imageUrl,
    title: place?.name || 'Unknown',
    subtitle: category,
    rating: place?.rating,
    tileSize: 'small', // Will be assigned later by assignTileSizes
    recommendation: rec,
  };
}

/**
 * Convert a Moment to an ExploreItem
 */
function momentToExploreItem(moment: Moment): ExploreItem {
  return {
    id: moment.id,
    type: 'moment',
    imageUrl: moment.photoUrl || null,
    title: moment.caption || 'Moment',
    subtitle: moment.user?.name || 'Looper',
    tileSize: 'small', // Will be assigned later
    moment,
  };
}

/**
 * Fetch a batch of explore places at a given distance tier
 */
export async function fetchExploreBatch(params: {
  user: User;
  userLocation: { lat: number; lng: number };
  distanceTier: number;
  excludePlaceIds: string[];
  batchSize?: number;
}): Promise<ExploreBatch> {
  const { user, userLocation, distanceTier, excludePlaceIds, batchSize = 30 } = params;
  const maxDistance = DISTANCE_TIERS[distanceTier] || DISTANCE_TIERS[DISTANCE_TIERS.length - 1];

  const recParams: RecommendationParams = {
    user,
    userLocation,
    maxDistance,
    maxResults: batchSize,
    discoveryMode: 'explore',
    excludePlaceIds,
  };

  const results = await generateRecommendations(recParams);

  // Sort by rating for trending
  const sorted = [...results].sort((a, b) => {
    const ratingA = a.place?.rating || 0;
    const ratingB = b.place?.rating || 0;
    return ratingB - ratingA;
  });

  // Convert to ExploreItems
  const items = sorted.map(recommendationToExploreItem);

  // Determine if we have more content
  const gotEnough = items.length >= batchSize * 0.8;
  const hasMoreTiers = distanceTier < DISTANCE_TIERS.length - 1;
  const hasMore = gotEnough || hasMoreTiers;

  // Calculate next distance tier
  let nextDistanceTier = distanceTier;
  if (!gotEnough && hasMoreTiers) {
    nextDistanceTier = distanceTier + 1;
  }

  return { items, hasMore, nextDistanceTier };
}

/**
 * Fetch moments for the explore grid (friend moments + nearby public moments)
 */
export async function fetchExploreMoments(params: {
  userId: string;
  limit?: number;
}): Promise<ExploreItem[]> {
  const { userId, limit = 20 } = params;

  try {
    const result = await getFriendMoments(userId);

    // Flatten all friend moments, filter to only those with photos
    const allMoments = result.friends
      .flatMap((f) => f.moments)
      .filter((m) => m.photoUrl)
      .slice(0, limit);

    return allMoments.map(momentToExploreItem);
  } catch (error) {
    console.error('Error fetching explore moments:', error);
    return [];
  }
}

/**
 * Interleave moments into place results (approximately every 6th item is a moment)
 */
export function interleaveContent(
  places: ExploreItem[],
  moments: ExploreItem[]
): ExploreItem[] {
  if (moments.length === 0) return places;

  const result: ExploreItem[] = [];
  let momentIdx = 0;
  const MOMENT_INTERVAL = 6;

  for (let i = 0; i < places.length; i++) {
    result.push(places[i]);

    // Insert a moment every MOMENT_INTERVAL places
    if ((i + 1) % MOMENT_INTERVAL === 0 && momentIdx < moments.length) {
      result.push(moments[momentIdx]);
      momentIdx++;
    }
  }

  return result;
}

/**
 * Assign tile sizes for visual variety.
 * Pattern repeating every 5 rows:
 *   rows 0-2: three-small
 *   row 3: large-left  (large tile spans 2 cols on left + 1 small on right)
 *   row 4: large-right (1 small on left + large tile spans 2 cols on right)
 */
export function getRowLayout(rowIndex: number): ExploreRowLayout {
  const pattern = rowIndex % 5;
  if (pattern === 3) return 'large-left';
  if (pattern === 4) return 'large-right';
  return 'three-small';
}

/**
 * Group flat ExploreItem[] list into row groups for rendering
 */
export function groupIntoRows(items: ExploreItem[]): ExploreRow[] {
  const rows: ExploreRow[] = [];
  let itemIdx = 0;
  let rowIdx = 0;

  while (itemIdx < items.length) {
    const layout = getRowLayout(rowIdx);

    if (layout === 'three-small') {
      // Take up to 3 items
      const rowItems = items.slice(itemIdx, itemIdx + 3);
      if (rowItems.length > 0) {
        rowItems.forEach((item) => { item.tileSize = 'small'; });
        rows.push({
          id: `row-${rowIdx}`,
          layout,
          items: rowItems,
        });
        itemIdx += rowItems.length;
      } else {
        break;
      }
    } else {
      // large-left or large-right: need at least 2 items (1 large + 1 small)
      const rowItems = items.slice(itemIdx, itemIdx + 2);
      if (rowItems.length >= 2) {
        if (layout === 'large-left') {
          rowItems[0].tileSize = 'large';
          rowItems[1].tileSize = 'small';
        } else {
          rowItems[0].tileSize = 'small';
          rowItems[1].tileSize = 'large';
        }
        rows.push({
          id: `row-${rowIdx}`,
          layout,
          items: rowItems,
        });
        itemIdx += 2;
      } else if (rowItems.length === 1) {
        // Not enough for mixed row, make it a single small row
        rowItems[0].tileSize = 'small';
        rows.push({
          id: `row-${rowIdx}`,
          layout: 'three-small',
          items: rowItems,
        });
        itemIdx += 1;
      } else {
        break;
      }
    }

    rowIdx++;
  }

  return rows;
}
