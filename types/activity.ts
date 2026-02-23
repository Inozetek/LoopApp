// Types for activities and recommendations

export interface Location {
  latitude: number;
  longitude: number;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface Activity {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  description?: string;
  location: Location;
  distance?: number; // Distance from user in miles
  rating?: number; // 0-5
  reviewsCount?: number;
  priceRange: number; // 0-3 ($, $$, $$$, $$$$)
  photoUrl?: string;
  phone?: string;
  website?: string;
  hours?: Record<string, string>; // { "monday": "9:00 AM - 5:00 PM", ... }
  openingHoursPeriods?: Array<{
    open: { day: number; time: string };
    close?: { day: number; time: string };
  }>; // Raw Google periods data for accurate isOpenAt checks
  tags?: string[];
  isSponsored?: boolean;
  sponsorTier?: 'organic' | 'boosted' | 'premium';
  googlePlaceId?: string;
  aiDescription?: string; // Gemini-generated description, cached at seed time
}

export interface RecommendationScore {
  baseScore: number; // 0-40
  locationScore: number; // 0-20
  timeScore: number; // 0-15
  feedbackScore: number; // 0-15
  collaborativeScore: number; // 0-10
  sponsorBoost: number; // 0-30% boost
  finalScore: number; // Total with sponsor boost
}

export interface GroupMemberMatchInfo {
  userId: string;
  name: string;
  matchedInterests: string[];
  distanceMiles: number;
  profilePicUrl?: string;
}

export interface GroupContext {
  memberMatches: GroupMemberMatchInfo[];
  interestMatchScore: number;
  farthestMemberName: string;
  farthestMemberDistance: number;
  onChoose?: () => void;
}

export interface Recommendation {
  id: string;
  title: string;
  category: string;
  location: string;
  neighborhood?: string; // Parsed area name (e.g. "Deep Ellum", "Uptown")
  distance: string;
  priceRange: number;
  rating: number;
  imageUrl: string;
  photos?: string[]; // Array of photo URLs for Instagram-style carousel
  photoReferences?: string[]; // Original Google Places photo references for cache reconstruction
  aiExplanation: string;
  description?: string; // Editorial summary from Google Places
  reviewSummary?: string; // AI-generated summary of reviews
  openNow?: boolean;
  isSponsored: boolean;
  isCurated?: boolean; // True for hand-curated "Loop Pick" recommendations
  curatorName?: string; // Curator attribution (e.g., "Sarah, Dallas local")
  cardType?: 'ai_curated' | 'discovery' | 'upgrade_prompt' | 'section_header' | 'insights_nudge' | 'radar_alert' | 'hot_drop'; // Blended feed card type
  showInsights?: boolean; // Whether to show AI insight elements (match score, explanation, time chip, Loop Pick)
  commentsCount?: number; // Real comment count from DB (overrides mock)
  score?: number;
  scoreBreakdown?: RecommendationScore;
  // Business hours
  businessHours?: any; // Google opening_hours object
  hasEstimatedHours?: boolean; // True if hours are estimated vs from Google
  suggestedTime?: Date; // Recommended visit time when place is open
  // Date-filtered recommendation context (present when user selects a future date)
  dateContext?: import('./time-slots').DateContext;
  // Group planning context
  groupContext?: GroupContext;
  // Radar alert metadata (present when cardType === 'radar_alert')
  radarMatch?: import('./radar').RadarMatch;
  // Legacy fields for backward compatibility
  activity?: Activity;
  reason?: string;
  recommendedFor?: Date;
  confidence?: number;
  status?: 'pending' | 'viewed' | 'accepted' | 'declined' | 'expired';
  viewedAt?: Date;
  respondedAt?: Date;
  createdAt?: Date;
  expiresAt?: Date;
}

export interface GooglePlaceResult {
  place_id: string;
  name: string;
  vicinity?: string; // Short address (used by some APIs)
  formatted_address: string;
  editorial_summary?: string; // Description from API (Google Places or Ticketmaster)
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number; // 0-4
  types: string[];
  photos?: Array<{
    photo_reference: string;
    height?: number;
    width?: number;
  }>;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
    periods?: Array<{
      open: { day: number; time: string };
      close?: { day: number; time: string };
    }>;
  };
}

export interface GooglePlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  editorial_summary?: string; // Editorial description from Google
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  photos?: Array<{
    photo_reference: string;
    height?: number;
    width?: number;
  }>;
  opening_hours?: {
    open_now: boolean;
    weekday_text: string[];
    periods?: Array<{
      open: { day: number; time: string };
      close: { day: number; time: string };
    }>;
  };
  types: string[];
  reviews?: Array<{
    author_name: string;
    rating: number;
    text: string;
    time: number;
  }>;
}

export type InterestCategory =
  | 'dining'
  | 'coffee'
  | 'bars'
  | 'live_music'
  | 'fitness'
  | 'outdoor'
  | 'arts'
  | 'entertainment'
  | 'shopping'
  | 'wellness'
  | 'sports'
  | 'nightlife'
  | 'culture'
  | 'events'
  | 'family'
  | 'education'
  | 'travel'
  | 'other';

// ============================================
// Multi-Source Integration Types (Phase 1-2)
// ============================================

/**
 * Activity source identifier
 * - google_places: Google Places API (existing)
 * - ticketmaster: Ticketmaster Discovery API (Phase 1)
 * - yelp: Yelp Fusion API (Phase 2)
 * - groupon: Groupon Deals API (Phase 2)
 * - songkick: Songkick Concerts API (Phase 2)
 * - fandango: Fandango Movie Showtimes API (Phase 3)
 * - opentable: OpenTable Reservations API (Phase 3)
 * - meetup: Meetup.com Events API (Phase 3)
 */
export type ActivitySource = 'google_places' | 'ticketmaster' | 'yelp' | 'groupon' | 'songkick' | 'eventbrite' | 'fandango' | 'opentable' | 'meetup';

/**
 * Event-specific metadata (only for Ticketmaster events)
 */
export interface EventMetadata {
  /** ISO 8601 timestamp: "2026-01-15T19:00:00Z" */
  start_time: string;
  /** ISO 8601 timestamp: "2026-01-15T22:00:00Z" */
  end_time: string;
  /** Event duration in minutes */
  duration_minutes: number;
  /** Direct link to ticket purchase page */
  event_url?: string;
  /** Event organizer name */
  organizer?: string;
  /** Whether this is a virtual/online event */
  is_online?: boolean;
  /** Whether the event is free */
  is_free?: boolean;
  /** Ticket pricing information */
  ticket_price?: {
    /** Minimum price in cents (e.g., 2500 = $25.00) */
    min: number;
    /** Maximum price in cents */
    max: number;
    /** Currency code (e.g., "USD") */
    currency: string;
  };
}

/**
 * Yelp deal information (happy hours, specials, etc.)
 */
export interface YelpDeal {
  /** Unique deal identifier */
  id: string;
  /** Deal title (e.g., "Happy Hour: 50% off drinks") */
  title: string;
  /** Optional description */
  description?: string;
  /** Start time in HH:MM format (e.g., "16:00") */
  time_start?: string;
  /** End time in HH:MM format (e.g., "18:00") */
  time_end?: string;
  /** Days of week this deal is active */
  days?: string[]; // ['monday', 'tuesday', 'wednesday']
}

/**
 * Yelp-specific metadata (only for Yelp places)
 */
export interface YelpMetadata {
  /** Yelp business ID */
  yelp_id: string;
  /** Direct link to Yelp business page */
  yelp_url: string;
  /** Number of Yelp reviews (often higher than Google) */
  review_count: number;
  /** Business categories (e.g., ['Italian', 'Pizza', 'Wine Bars']) */
  categories: string[];
  /** Available transactions (e.g., ['delivery', 'pickup', 'restaurant_reservation']) */
  transactions?: string[];
  /** Happy hours and special deals */
  deals?: YelpDeal[];
}

/**
 * Groupon-specific metadata (only for Groupon deals)
 */
export interface GrouponMetadata {
  /** Groupon deal ID */
  deal_id: string;
  /** Direct link to purchase deal */
  deal_url: string;
  /** Original price before discount (in cents) */
  original_price: number;
  /** Discounted price (in cents) */
  deal_price: number;
  /** Discount percentage (e.g., 50 = 50% off) */
  discount_percent: number;
  /** When the voucher expires (ISO 8601 date) */
  voucher_expiration: string;
  /** Fine print / terms and conditions */
  fine_print: string;
  /** Merchant/business name */
  merchant_name: string;
}

/**
 * Songkick-specific metadata (only for Songkick concerts)
 */
export interface SongkickMetadata {
  /** Songkick event ID */
  event_id: string;
  /** Direct link to event page */
  event_url: string;
  /** List of performing artist names */
  artist_names: string[];
  /** Venue name */
  venue_name: string;
  /** Performance start time (HH:MM format) */
  performance_time?: string;
  /** Link to purchase tickets */
  ticket_url?: string;
  /** Event status */
  status: 'confirmed' | 'tentative' | 'cancelled';
}

/**
 * Eventbrite-specific metadata (only for Eventbrite events)
 * Covers: workshops, classes, meetups, community events, local festivals
 */
export interface EventbriteMetadata {
  /** Eventbrite event ID */
  event_id: string;
  /** Direct link to event page */
  event_url: string;
  /** Event organizer name */
  organizer_name: string;
  /** Organizer profile URL */
  organizer_url?: string;
  /** Whether organizer is verified by Eventbrite */
  is_verified_organizer?: boolean;
  /** Event category from Eventbrite */
  category: string;
  /** Event subcategory from Eventbrite */
  subcategory?: string;
  /** Event format (class, conference, festival, etc.) */
  format?: string;
  /** Number of people registered/attending */
  attendee_count?: number;
  /** Maximum capacity */
  capacity?: number;
  /** Whether event is online-only */
  is_online: boolean;
  /** Whether event is free */
  is_free: boolean;
  /** Ticket price range if not free */
  price_range?: {
    min: number;
    max: number;
    currency: string;
  };
  /** Event tags from Eventbrite */
  tags?: string[];
}

/**
 * Unified activity type that extends GooglePlaceResult
 * Works with activities from all sources: Google Places, Ticketmaster, Yelp, Groupon, Songkick
 */
export interface UnifiedActivity extends GooglePlaceResult {
  /** Source of this activity */
  source: ActivitySource;
  /** Recommendation algorithm score (0-100+) */
  score?: number;
  /** Time-sensitive boost applied to score */
  timeSensitiveBoost?: number;
  /** Whether this activity/deal is currently active */
  isActiveNow?: boolean;
  /** When this deal/event expires */
  dealExpiresAt?: Date;
  /** Event metadata (only present if source === 'ticketmaster') */
  event_metadata?: EventMetadata;
  /** Yelp metadata (only present if source === 'yelp') */
  yelp_metadata?: YelpMetadata;
  /** Groupon metadata (only present if source === 'groupon') */
  groupon_metadata?: GrouponMetadata;
  /** Songkick metadata (only present if source === 'songkick') */
  songkick_metadata?: SongkickMetadata;
  /** Eventbrite metadata (only present if source === 'eventbrite') */
  eventbrite_metadata?: EventbriteMetadata;
  /** Enhanced Google Places attributes */
  hasHappyHour?: boolean;
  hasLiveMusic?: boolean;
  hasOutdoorSeating?: boolean;
  /** Google Places events (concerts, shows, etc.) */
  events?: Array<{
    name: string;
    startTime: string;
    endTime: string;
  }>;
  /** Deals extracted from editorial summaries or other sources */
  extractedDeals?: YelpDeal[];
}

/**
 * Search parameters for activity sources
 */
export interface SearchParams {
  /** User's current latitude */
  latitude: number;
  /** User's current longitude */
  longitude: number;
  /** Search radius in meters (default: 8000 = ~5 miles) */
  radius?: number;
  /** User's interest categories to filter by */
  interests?: string[];
  /** Maximum number of results to return */
  limit?: number;
  /** Minimum rating (0-5) */
  minRating?: number;
  /** Price range filter (0-4) */
  maxPriceLevel?: number;
  /** Feed mode for dual feed architecture (default: 'daily') */
  feedMode?: 'daily' | 'explore';
  /** Whether to include time-sensitive boost in scoring (default: true for daily) */
  includeTimeSensitive?: boolean;
  /** User's subscription tier for daily recommendation limits */
  subscriptionTier?: 'free' | 'plus' | 'premium';
}
