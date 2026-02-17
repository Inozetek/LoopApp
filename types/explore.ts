/**
 * Explore Tab Types
 *
 * Unified types for the redesigned explore grid that mixes
 * places and moments in an Instagram-style layout.
 */

import type { ScoredRecommendation } from '@/services/recommendations';
import type { Moment } from '@/types/moment';

export type ExploreItemType = 'place' | 'moment';

export interface ExploreItem {
  id: string;
  type: ExploreItemType;
  imageUrl: string | null;
  title: string;           // place name or moment caption
  subtitle?: string;       // category or user name
  rating?: number;         // places only
  priceLevel?: number;     // 0-4 from Google Places
  openNow?: boolean;       // from opening_hours.open_now
  reviewCount?: number;    // from user_ratings_total
  categoryId?: string;     // mapped category ID (e.g., 'dining', 'coffee')
  tileSize: 'small' | 'large'; // layout assignment

  // Original data references
  recommendation?: ScoredRecommendation; // if type === 'place'
  moment?: Moment;                       // if type === 'moment'
}

export type ExploreRowLayout = 'three-small' | 'large-left' | 'large-right';

export interface ExploreRow {
  id: string;
  layout: ExploreRowLayout;
  items: ExploreItem[];
}
