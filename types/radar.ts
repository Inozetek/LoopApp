/**
 * Loop Radar — Type Definitions
 *
 * Radar lets users define personal "triggers" for things they never want to miss:
 * artists, film talent, categories, venues, and friend proximity.
 *
 * Naming: "Radar" in the UI, "hooks" in the database/code.
 */

// ============================================================================
// HOOK TYPES
// ============================================================================

/** The six types of Radar that users can create */
export type HookType = 'artist' | 'film_talent' | 'category' | 'venue' | 'proximity' | 'keyword';

/** Display metadata for each hook type */
export const HOOK_TYPE_META: Record<HookType, { label: string; icon: string; description: string }> = {
  artist: {
    label: 'Artist',
    icon: '🎵',
    description: 'Get alerted when an artist has a show nearby',
  },
  film_talent: {
    label: 'Film',
    icon: '🎬',
    description: 'Get alerted when an actor or director has a new movie',
  },
  category: {
    label: 'Category',
    icon: '🏷️',
    description: 'Get alerted about events matching a category',
  },
  venue: {
    label: 'Venue',
    icon: '📍',
    description: 'Follow a venue for new events and specials',
  },
  proximity: {
    label: 'Friends',
    icon: '👥',
    description: 'Get alerted when friends are nearby and free',
  },
  keyword: {
    label: 'Keyword',
    icon: '🔍',
    description: 'Find places matching a keyword (e.g., "tallow fries", "rooftop")',
  },
};

// ============================================================================
// USER HOOK (a single Radar)
// ============================================================================

export interface UserHook {
  id: string;
  userId: string;
  hookType: HookType;

  /** Display name: artist name, venue name, person name, or category */
  entityName?: string;
  /** External ID: Google place_id, Ticketmaster artist ID, TMDb person_id */
  entityId?: string;
  /** For film_talent: 'Acting', 'Directing', 'Producing', 'Writing' */
  talentDepartment?: string;
  /** Interest category for category hooks */
  category?: string;
  /** Custom search keywords (Plus only) */
  customKeywords?: string[];
  /** Primary search keyword for keyword-type radars */
  searchKeyword?: string;
  /** Friend user IDs for proximity hooks */
  friendIds?: string[];
  /** Proximity radius in miles (default 1.0) */
  proximityRadiusMiles?: number;

  /** Whether this radar is currently active */
  isActive: boolean;
  /** When this radar last triggered a notification */
  lastTriggeredAt?: string;
  /** Total number of times this radar has triggered */
  triggerCount: number;

  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// HOOK NOTIFICATION (a triggered alert)
// ============================================================================

export type HookNotificationStatus = 'pending' | 'sent' | 'viewed' | 'dismissed' | 'expired';

export interface HookNotification {
  id: string;
  userId: string;
  hookId: string;
  eventCacheId?: string;

  title: string;
  body: string;
  /** Full event details for rendering in the feed card */
  eventData?: RadarEventData;
  /** Place details for keyword radar notifications */
  placeData?: PlaceRadarData;

  status: HookNotificationStatus;
  sentAt?: string;
  viewedAt?: string;
  expiresAt?: string;
  /** When push notification was sent (Plus only) */
  pushSentAt?: string;

  createdAt: string;
}

/** Place data for keyword radar notifications (non-event) */
export interface PlaceRadarData {
  placeId: string;
  name: string;
  address: string;
  rating: number;
  reviewsCount: number;
  priceLevel: number;
  photoUrl?: string;
  category: string;
  distance?: string;
  matchedKeyword: string;
}

/** Event data embedded in a notification for card rendering */
export interface RadarEventData {
  name: string;
  venue?: string;
  address?: string;
  date?: string;
  time?: string;
  imageUrl?: string;
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  ticketUrl?: string;
  category?: string;
  source?: string;
  /** Distance from user in miles */
  distanceMiles?: number;
  /** Google place_id for venue lookup */
  googlePlaceId?: string;
}

// ============================================================================
// RADAR MATCH (attached to Recommendation for feed display)
// ============================================================================

export interface RadarMatch {
  hookId: string;
  hookType: HookType;
  /** Human-readable reason: "Matched your Artist Radar" */
  matchReason: string;
  /** The notification ID that triggered this card */
  notificationId?: string;
}

// ============================================================================
// EVENT CACHE
// ============================================================================

export interface EventCacheEntry {
  id: string;
  /** Dedup key: "artist:taylor_swift:dallas" */
  cacheKey: string;
  source: 'ticketmaster' | 'bandsintown' | 'tmdb' | 'meetup_rss';
  entityType: 'artist' | 'venue' | 'category';
  entityName: string;
  /** Array of cached event objects */
  events: CachedEvent[];
  locationCity?: string;
  lastFetchedAt: string;
  /** When to check for NEW events (weekly sweep) */
  nextFetchAt: string;
  /** Cache valid until latest event date */
  expiresAt?: string;
  fetchCount: number;
  createdAt: string;
}

export interface CachedEvent {
  id: string;
  name: string;
  venue?: string;
  address?: string;
  city?: string;
  date: string;
  time?: string;
  imageUrl?: string;
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  ticketUrl?: string;
  source: string;
  category?: string;
}

// ============================================================================
// RADAR LIMITS (tier gating)
// ============================================================================

export interface RadarLimits {
  /** Max total radars across all types */
  total: number;
  /** Max artist + film_talent radars */
  artistOrFilm: number;
  /** Max category radars */
  category: number;
  /** Max venue radars (0 = Plus only) */
  venue: number;
  /** Max proximity radars (0 = Plus only) */
  proximity: number;
  /** Max keyword radars (counted within total limit for free) */
  keyword: number;
  /** Whether push notifications are enabled for radar alerts */
  pushNotifications: boolean;
  /** Whether real-time alerts are enabled (vs weekly digest) */
  realTimeAlerts: boolean;
  /** Whether custom keywords are allowed */
  customKeywords: boolean;
  /** Whether price threshold alerts are allowed */
  priceThreshold: boolean;
  /** Days of history visible */
  historyDays: number;
}

export const RADAR_LIMITS: Record<'free' | 'plus', RadarLimits> = {
  free: {
    total: 3,
    artistOrFilm: 1,
    category: 2,
    venue: 0,
    proximity: 0,
    keyword: 3, // Counted within total limit of 3
    pushNotifications: false,
    realTimeAlerts: false,
    customKeywords: false,
    priceThreshold: false,
    historyDays: 7,
  },
  plus: {
    total: Infinity,
    artistOrFilm: Infinity,
    category: Infinity,
    venue: Infinity,
    proximity: 5,
    keyword: Infinity,
    pushNotifications: true,
    realTimeAlerts: true,
    customKeywords: true,
    priceThreshold: true,
    historyDays: Infinity,
  },
};

// ============================================================================
// CREATE/UPDATE PARAMS
// ============================================================================

export interface CreateRadarParams {
  userId: string;
  hookType: HookType;
  entityName?: string;
  entityId?: string;
  talentDepartment?: string;
  category?: string;
  customKeywords?: string[];
  searchKeyword?: string;
  friendIds?: string[];
  proximityRadiusMiles?: number;
}

// ============================================================================
// RADAR SUMMARY (for management screen)
// ============================================================================

export interface RadarSummary {
  activeCount: number;
  byType: Record<HookType, number>;
  limits: RadarLimits;
  recentAlerts: HookNotification[];
}
