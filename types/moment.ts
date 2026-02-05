/**
 * Moment Types
 *
 * Types for Loop Moments - Instagram/Snapchat-style social content
 * where users capture and share activity moments.
 */

// ============================================
// Core Moment Types
// ============================================

export type MomentVisibility = 'friends' | 'everyone' | 'private';
export type MomentCaptureTrigger = 'arrival' | 'manual' | 'post_activity';
export type MomentInteractionType = 'view' | 'like' | 'save' | 'add_to_calendar';
export type MomentReportReason = 'inappropriate' | 'spam' | 'harassment' | 'fake' | 'other';
export type MomentReportStatus = 'pending' | 'reviewed' | 'actioned' | 'dismissed';

/**
 * Place information attached to a moment
 */
export interface MomentPlace {
  id: string;           // Google Place ID
  name: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  address?: string;
}

/**
 * Main moment interface
 */
export interface Moment {
  id: string;
  userId: string;

  // Place info
  place: MomentPlace;

  // Photo data
  photoUrl: string;
  thumbnailUrl?: string;
  caption?: string;

  // Visibility & lifecycle
  visibility: MomentVisibility;
  isTaggedToPlace: boolean;  // If true, becomes permanent place content
  expiresAt?: string;        // ISO timestamp, null if tagged to place

  // Engagement metrics
  viewsCount: number;
  likesCount: number;

  // Source tracking
  calendarEventId?: string;
  captureTrigger: MomentCaptureTrigger;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  isActive: boolean;

  // Derived fields (populated from joins)
  user?: MomentUser;           // User who created the moment
  taggedFriends?: MomentUser[]; // Friends tagged in the moment
  hasLiked?: boolean;          // Whether current viewer has liked
  hasViewed?: boolean;         // Whether current viewer has viewed
}

/**
 * Simplified user info for moment displays
 */
export interface MomentUser {
  id: string;
  name: string;
  profilePictureUrl?: string;
}

/**
 * Friend with their moments (for stories row)
 */
export interface FriendWithMoments {
  userId: string;
  name: string;
  profilePictureUrl?: string;
  moments: Moment[];
  hasUnseenMoments: boolean;  // True if any moments not viewed by current user
  latestMomentAt?: string;    // ISO timestamp of most recent moment
}

/**
 * Result from getFriendMoments
 */
export interface FriendMomentsResult {
  friends: FriendWithMoments[];
  totalUnseenCount: number;
}

// ============================================
// Interaction Types
// ============================================

export interface MomentInteraction {
  id: string;
  momentId: string;
  userId: string;
  interactionType: MomentInteractionType;
  createdAt: string;
}

// ============================================
// Tag Types
// ============================================

export interface MomentTag {
  id: string;
  momentId: string;
  taggedUserId: string;
  createdAt: string;
  taggedUser?: MomentUser; // Populated from join
}

// ============================================
// Report Types
// ============================================

export interface MomentReport {
  id: string;
  momentId: string;
  reporterUserId: string;
  reason: MomentReportReason;
  notes?: string;
  status: MomentReportStatus;
  reviewedAt?: string;
  createdAt: string;
}

// ============================================
// API Request/Response Types
// ============================================

/**
 * Parameters for creating a new moment
 */
export interface CreateMomentParams {
  placeId: string;
  placeName: string;
  placeLocation?: {
    latitude: number;
    longitude: number;
  };
  placeAddress?: string;
  photoUri: string;           // Local URI from ImagePicker
  caption?: string;
  visibility: MomentVisibility;
  isTaggedToPlace: boolean;
  calendarEventId?: string;
  taggedFriendIds?: string[];
  captureTrigger?: MomentCaptureTrigger;
}

/**
 * Response from creating a moment
 */
export interface CreateMomentResult {
  success: boolean;
  moment?: Moment;
  error?: string;
}

/**
 * Parameters for fetching place moments
 */
export interface GetPlaceMomentsParams {
  placeId: string;
  limit?: number;
  offset?: number;
}

/**
 * Place moments with pagination info
 */
export interface PlaceMomentsResult {
  moments: Moment[];
  totalCount: number;
  hasMore: boolean;
}

// ============================================
// Database Row Types (snake_case for DB mapping)
// ============================================

export interface MomentRow {
  id: string;
  user_id: string;
  place_id: string;
  place_name: string;
  place_location?: {
    coordinates: [number, number]; // [lng, lat] - PostGIS format
  };
  place_address?: string;
  photo_url: string;
  thumbnail_url?: string;
  caption?: string;
  visibility: MomentVisibility;
  is_tagged_to_place: boolean;
  expires_at?: string;
  views_count: number;
  likes_count: number;
  calendar_event_id?: string;
  capture_trigger: MomentCaptureTrigger;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface MomentInteractionRow {
  id: string;
  moment_id: string;
  user_id: string;
  interaction_type: MomentInteractionType;
  created_at: string;
}

export interface MomentTagRow {
  id: string;
  moment_id: string;
  tagged_user_id: string;
  created_at: string;
}

// ============================================
// Recommendation Boost Types
// ============================================

/**
 * Friend visit information for recommendation boosting
 */
export interface FriendVisit {
  userId: string;
  userName: string;
  visitedAt: string;
  hasMoment: boolean;
}

/**
 * Place social context from friends' visits/moments
 */
export interface PlaceSocialContext {
  placeId: string;
  friendVisits: FriendVisit[];
  totalFriendVisits: number;
  recentFriendVisits: number;  // Within last 7 days
  hasFriendMoments: boolean;
  friendMomentsCount: number;
}

// ============================================
// Utility Types
// ============================================

/**
 * Convert database row to Moment interface
 */
export function rowToMoment(row: MomentRow, userInfo?: MomentUser): Moment {
  return {
    id: row.id,
    userId: row.user_id,
    place: {
      id: row.place_id,
      name: row.place_name,
      location: row.place_location ? {
        latitude: row.place_location.coordinates[1],
        longitude: row.place_location.coordinates[0],
      } : undefined,
      address: row.place_address,
    },
    photoUrl: row.photo_url,
    thumbnailUrl: row.thumbnail_url,
    caption: row.caption,
    visibility: row.visibility,
    isTaggedToPlace: row.is_tagged_to_place,
    expiresAt: row.expires_at,
    viewsCount: row.views_count,
    likesCount: row.likes_count,
    calendarEventId: row.calendar_event_id,
    captureTrigger: row.capture_trigger,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isActive: row.is_active,
    user: userInfo,
  };
}
