/**
 * Contextual Smart Recommendations Types
 *
 * These types support AI-powered recommendation groupings based on user's
 * life context: trips, social events, schedule gaps, and routines.
 */

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/**
 * Trip Context - Detected from calendar events in different cities
 */
export interface TripContext {
  type: 'trip';
  destination: string;        // "New York, NY"
  destinationLocation: {
    lat: number;
    lng: number;
  };
  startDate: Date;
  endDate: Date;
  calendarEventIds: string[]; // IDs of events during trip
  scheduledGaps: TimeSlot[];  // Free time between events
}

/**
 * Social Context - Detected from events with friends/groups
 */
export interface SocialContext {
  type: 'social';
  groupName?: string;         // "College Friends", "Family"
  participants: string[];     // Friend IDs or names
  occasion?: string;          // "Birthday", "Reunion", "Visit"
  date: Date;
  calendarEventId?: string;   // Related calendar event
}

/**
 * Schedule Context - Detected from gaps between calendar events
 */
export interface ScheduleContext {
  type: 'schedule';
  beforeEvent?: CalendarEventRef;
  afterEvent?: CalendarEventRef;
  availableTime: TimeSlot;
  isOnRoute: boolean;         // Between two locations
}

/**
 * Routine Context - Detected from recurring patterns
 */
export interface RoutineContext {
  type: 'routine';
  pattern: 'commute' | 'lunch' | 'evening' | 'weekend';
  typicalTime: TimeSlot;
  frequency: 'daily' | 'weekdays' | 'weekly';
}

/**
 * General Context - Default for non-contextual recommendations
 */
export interface GeneralContext {
  type: 'general';
}

// Union type for all contexts
export type ContextMetadata =
  | TripContext
  | SocialContext
  | ScheduleContext
  | RoutineContext
  | GeneralContext;

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

/**
 * Time slot with start and end
 */
export interface TimeSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

/**
 * Reference to a calendar event
 */
export interface CalendarEventRef {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
}

// ============================================================================
// RECOMMENDATION CONTEXT
// ============================================================================

/**
 * Context that groups recommendations
 */
export interface RecommendationContext {
  id: string;
  type: 'trip' | 'social' | 'schedule' | 'routine' | 'general';
  title: string;              // "For your NYC trip"
  subtitle?: string;          // "Feb 14-17 • 3 days away"
  icon: string;               // Emoji or icon name
  priority: number;           // Display order (lower = higher priority)
  metadata: ContextMetadata;
  createdAt: Date;
  expiresAt?: Date;           // When context becomes irrelevant
}

// ============================================================================
// CONTEXT BADGES
// ============================================================================

export type ContextBadgeType =
  | 'free'
  | 'available'
  | 'on_route'
  | 'friend_loves'
  | 'group_friendly'
  | 'before_event'
  | 'after_event'
  | 'walking_distance'
  | 'time_limited';

/**
 * Badge displayed on recommendation cards
 */
export interface ContextBadge {
  type: ContextBadgeType;
  label: string;              // "FREE", "After Meeting"
  icon?: string;              // Icon name
  color: string;              // Badge color
  priority: number;           // Display order
}

// ============================================================================
// CONTEXTUAL RECOMMENDATION
// ============================================================================

/**
 * Recommendation with context awareness
 */
export interface ContextualRecommendation {
  // Original recommendation data
  id: string;
  placeId: string;
  name: string;
  score: number;

  // Context awareness
  contexts: RecommendationContext[];  // Can belong to multiple contexts
  contextBadges: ContextBadge[];      // Computed badges
  contextReason?: string;             // "After your Business Meeting"
  primaryContextId?: string;          // Main context this belongs to
}

// ============================================================================
// CONTEXTUAL FEED TYPES
// ============================================================================

/**
 * Grouped recommendations by context
 */
export interface ContextualFeedSection {
  context: RecommendationContext;
  recommendations: ContextualRecommendation[];
  isExpanded: boolean;
}

/**
 * Full contextual feed data
 */
export interface ContextualFeedData {
  sections: ContextualFeedSection[];
  lastUpdated: Date;
  userId: string;
}

// ============================================================================
// DETECTION PARAMETERS
// ============================================================================

/**
 * Parameters for context detection
 */
export interface ContextDetectionParams {
  userId: string;
  userHomeLocation?: {
    lat: number;
    lng: number;
  };
  lookaheadDays?: number;     // Default: 14 days
  includeSocial?: boolean;    // Default: true
  includeSchedule?: boolean;  // Default: true
  includeTrips?: boolean;     // Default: true
  includeRoutines?: boolean;  // Default: false (Phase 2)
}

/**
 * Result of context detection
 */
export interface ContextDetectionResult {
  contexts: RecommendationContext[];
  detectedTrips: TripContext[];
  detectedSocialEvents: SocialContext[];
  detectedGaps: ScheduleContext[];
  detectionTimestamp: Date;
}
