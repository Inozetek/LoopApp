/**
 * Moments Service - Loop Moments Feature
 *
 * Handles all moment-related operations:
 * - Creating moments with photo upload
 * - Fetching friends' moments (stories feed)
 * - Fetching place moments (place details)
 * - Interactions (views, likes)
 * - Reporting and moderation
 */

import { supabase } from '@/lib/supabase';
import {
  Moment,
  MomentRow,
  MomentUser,
  FriendWithMoments,
  FriendMomentsResult,
  PlaceMomentsResult,
  CreateMomentParams,
  CreateMomentResult,
  PlaceSocialContext,
  FriendVisit,
  rowToMoment,
} from '@/types/moment';

// ============================================================================
// CREATE MOMENT
// ============================================================================

/**
 * Create a new moment with photo upload
 */
export async function createMoment(
  userId: string,
  params: CreateMomentParams
): Promise<CreateMomentResult> {
  try {
    // 1. Upload photo to Supabase Storage
    const fileExt = params.photoUri.split('.').pop() || 'jpg';
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `moments/${fileName}`;
    const thumbnailPath = `moments/thumbnails/${fileName}`;

    // Convert local URI to blob
    const response = await fetch(params.photoUri);
    const blob = await response.blob();

    // Upload main photo
    const { error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, blob, {
        contentType: `image/${fileExt}`,
        upsert: false,
      });

    if (uploadError) {
      console.error('Photo upload error:', uploadError);
      return { success: false, error: 'Failed to upload photo' };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath);

    const photoUrl = urlData.publicUrl;

    // 2. Create moment record
    const momentData: Partial<MomentRow> = {
      user_id: userId,
      place_id: params.placeId,
      place_name: params.placeName,
      place_address: params.placeAddress,
      photo_url: photoUrl,
      thumbnail_url: photoUrl, // For MVP, use same URL (can add resizing later)
      caption: params.caption,
      visibility: params.visibility,
      is_tagged_to_place: params.isTaggedToPlace,
      calendar_event_id: params.calendarEventId,
      capture_trigger: params.captureTrigger || 'manual',
    };

    // Add location if provided
    if (params.placeLocation) {
      (momentData as any).place_location = `POINT(${params.placeLocation.longitude} ${params.placeLocation.latitude})`;
    }

    const { data: momentRow, error: insertError } = await supabase
      .from('moments')
      .insert(momentData)
      .select()
      .single();

    if (insertError) {
      console.error('Moment insert error:', insertError);
      return { success: false, error: 'Failed to save moment' };
    }

    // 3. Tag friends if provided
    if (params.taggedFriendIds && params.taggedFriendIds.length > 0) {
      const tagInserts = params.taggedFriendIds.map((friendId) => ({
        moment_id: momentRow.id,
        tagged_user_id: friendId,
      }));

      const { error: tagError } = await supabase
        .from('moment_tags')
        .insert(tagInserts);

      if (tagError) {
        console.warn('Failed to tag friends:', tagError);
        // Don't fail the whole operation for tag errors
      }
    }

    // 4. Return success with created moment
    const moment = rowToMoment(momentRow);
    console.log('Created moment:', moment.id);

    return { success: true, moment };
  } catch (error) {
    console.error('Create moment error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// ============================================================================
// FETCH MOMENTS
// ============================================================================

/**
 * Get friend moments for stories row (Instagram-style)
 * Returns friends grouped by user with unseen indicator
 */
export async function getFriendMoments(userId: string): Promise<FriendMomentsResult> {
  try {
    // Get list of friends first
    const { data: friendships, error: friendError } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId)
      .eq('status', 'accepted');

    if (friendError) throw friendError;

    if (!friendships || friendships.length === 0) {
      return { friends: [], totalUnseenCount: 0 };
    }

    const friendIds = friendships.map((f: any) => f.friend_id);

    // Get active moments from friends (not expired, friends visibility)
    const now = new Date().toISOString();
    const { data: moments, error: momentsError } = await supabase
      .from('moments')
      .select(`
        *,
        user:users!user_id (
          id,
          name,
          profile_picture_url
        )
      `)
      .in('user_id', friendIds)
      .eq('is_active', true)
      .in('visibility', ['friends', 'everyone'])
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false });

    if (momentsError) throw momentsError;

    // Get user's view history to determine unseen status
    const momentIds = (moments || []).map((m: any) => m.id);
    const { data: viewedMoments } = await supabase
      .from('moment_interactions')
      .select('moment_id')
      .eq('user_id', userId)
      .eq('interaction_type', 'view')
      .in('moment_id', momentIds);

    const viewedSet = new Set((viewedMoments || []).map((v: any) => v.moment_id));

    // Group moments by user
    const friendMap = new Map<string, FriendWithMoments>();

    for (const row of moments || []) {
      const friendId = row.user_id;

      if (!friendMap.has(friendId)) {
        friendMap.set(friendId, {
          userId: friendId,
          name: row.user?.name || 'Unknown',
          profilePictureUrl: row.user?.profile_picture_url,
          moments: [],
          hasUnseenMoments: false,
          latestMomentAt: row.created_at,
        });
      }

      const friend = friendMap.get(friendId)!;
      const moment = rowToMoment(row, {
        id: row.user?.id || friendId,
        name: row.user?.name || 'Unknown',
        profilePictureUrl: row.user?.profile_picture_url,
      });

      moment.hasViewed = viewedSet.has(moment.id);
      if (!moment.hasViewed) {
        friend.hasUnseenMoments = true;
      }

      friend.moments.push(moment);
    }

    // Sort friends: unseen first, then by latest moment
    const friends = Array.from(friendMap.values()).sort((a, b) => {
      if (a.hasUnseenMoments !== b.hasUnseenMoments) {
        return a.hasUnseenMoments ? -1 : 1;
      }
      return new Date(b.latestMomentAt || 0).getTime() - new Date(a.latestMomentAt || 0).getTime();
    });

    const totalUnseenCount = friends.filter((f) => f.hasUnseenMoments).length;

    return { friends, totalUnseenCount };
  } catch (error) {
    console.error('Get friend moments error:', error);
    return { friends: [], totalUnseenCount: 0 };
  }
}

/**
 * Get moments for a specific place (tagged permanent content)
 */
export async function getPlaceMoments(
  placeId: string,
  limit = 20,
  offset = 0
): Promise<PlaceMomentsResult> {
  try {
    // Count total
    const { count } = await supabase
      .from('moments')
      .select('id', { count: 'exact', head: true })
      .eq('place_id', placeId)
      .eq('is_tagged_to_place', true)
      .eq('is_active', true);

    // Fetch moments with user info
    const { data, error } = await supabase
      .from('moments')
      .select(`
        *,
        user:users!user_id (
          id,
          name,
          profile_picture_url
        )
      `)
      .eq('place_id', placeId)
      .eq('is_tagged_to_place', true)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const moments = (data || []).map((row: any) =>
      rowToMoment(row, {
        id: row.user?.id,
        name: row.user?.name || 'Unknown',
        profilePictureUrl: row.user?.profile_picture_url,
      })
    );

    return {
      moments,
      totalCount: count || 0,
      hasMore: (count || 0) > offset + limit,
    };
  } catch (error) {
    console.error('Get place moments error:', error);
    return { moments: [], totalCount: 0, hasMore: false };
  }
}

/**
 * Get user's own moments
 */
export async function getUserMoments(
  userId: string,
  includeExpired = false
): Promise<Moment[]> {
  try {
    let query = supabase
      .from('moments')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!includeExpired) {
      const now = new Date().toISOString();
      query = query.or(`expires_at.is.null,expires_at.gt.${now}`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((row: any) => rowToMoment(row));
  } catch (error) {
    console.error('Get user moments error:', error);
    return [];
  }
}

// ============================================================================
// INTERACTIONS
// ============================================================================

/**
 * Mark a moment as viewed
 */
export async function markMomentViewed(
  momentId: string,
  viewerId: string
): Promise<void> {
  try {
    // Use the database function for atomic operation
    const { error } = await supabase.rpc('increment_moment_views', {
      p_moment_id: momentId,
      p_viewer_id: viewerId,
    });

    if (error) {
      console.warn('Mark viewed error:', error);
    }
  } catch (error) {
    console.error('Mark moment viewed error:', error);
  }
}

/**
 * Toggle like on a moment (double-tap action)
 * Returns new like state
 */
export async function toggleMomentLike(
  momentId: string,
  userId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('toggle_moment_like', {
      p_moment_id: momentId,
      p_user_id: userId,
    });

    if (error) throw error;

    return data as boolean;
  } catch (error) {
    console.error('Toggle like error:', error);
    return false;
  }
}

/**
 * Save moment to user's collection
 */
export async function saveMoment(
  momentId: string,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from('moment_interactions').upsert(
      {
        moment_id: momentId,
        user_id: userId,
        interaction_type: 'save',
      },
      { onConflict: 'moment_id,user_id,interaction_type' }
    );

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Save moment error:', error);
    return false;
  }
}

/**
 * Check if user has liked a moment
 */
export async function hasUserLikedMoment(
  momentId: string,
  userId: string
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('moment_interactions')
      .select('id')
      .eq('moment_id', momentId)
      .eq('user_id', userId)
      .eq('interaction_type', 'like')
      .single();

    return !!data;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// DELETE & MODERATION
// ============================================================================

/**
 * Delete a moment (soft delete by setting is_active = false)
 */
export async function deleteMoment(
  momentId: string,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('moments')
      .update({ is_active: false })
      .eq('id', momentId)
      .eq('user_id', userId); // Ensure user owns the moment

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Delete moment error:', error);
    return false;
  }
}

/**
 * Report a moment for moderation
 */
export async function reportMoment(
  momentId: string,
  reporterId: string,
  reason: 'inappropriate' | 'spam' | 'harassment' | 'fake' | 'other',
  notes?: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from('moment_reports').insert({
      moment_id: momentId,
      reporter_user_id: reporterId,
      reason,
      notes,
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Report moment error:', error);
    return false;
  }
}

// ============================================================================
// CLEANUP (CRON JOB)
// ============================================================================

/**
 * Cleanup expired moments (call via cron/scheduled task)
 */
export async function cleanupExpiredMoments(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('cleanup_expired_moments');

    if (error) throw error;
    return data as number;
  } catch (error) {
    console.error('Cleanup expired moments error:', error);
    return 0;
  }
}

// ============================================================================
// SOCIAL CONTEXT FOR RECOMMENDATIONS
// ============================================================================

/**
 * Get friend visit/moment data for a place (for recommendation boosting)
 */
export async function getPlaceSocialContext(
  userId: string,
  placeId: string
): Promise<PlaceSocialContext | null> {
  try {
    // Get friend IDs
    const { data: friendships } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId)
      .eq('status', 'accepted');

    if (!friendships || friendships.length === 0) {
      return null;
    }

    const friendIds = friendships.map((f: any) => f.friend_id);

    // Get friend moments at this place
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: moments, error: momentsError } = await supabase
      .from('moments')
      .select(`
        user_id,
        created_at,
        user:users!user_id (
          name
        )
      `)
      .eq('place_id', placeId)
      .in('user_id', friendIds)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (momentsError) {
      console.error('Get place social context error:', momentsError);
      return null;
    }

    // Also check calendar events at this place
    const { data: calendarVisits } = await supabase
      .from('calendar_events')
      .select(`
        user_id,
        start_time,
        user:users!user_id (
          name
        )
      `)
      .eq('place_id', placeId)
      .in('user_id', friendIds)
      .in('status', ['completed', 'scheduled'])
      .order('start_time', { ascending: false });

    // Combine and deduplicate visits
    const visitMap = new Map<string, FriendVisit>();

    for (const moment of moments || []) {
      const key = moment.user_id;
      if (!visitMap.has(key) || new Date(moment.created_at) > new Date(visitMap.get(key)!.visitedAt)) {
        visitMap.set(key, {
          userId: moment.user_id,
          userName: (moment as any).user?.name || 'Friend',
          visitedAt: moment.created_at,
          hasMoment: true,
        });
      }
    }

    for (const visit of calendarVisits || []) {
      const key = visit.user_id;
      if (!visitMap.has(key)) {
        visitMap.set(key, {
          userId: visit.user_id,
          userName: (visit as any).user?.name || 'Friend',
          visitedAt: visit.start_time,
          hasMoment: false,
        });
      }
    }

    const friendVisits = Array.from(visitMap.values());
    const recentVisits = friendVisits.filter(
      (v) => new Date(v.visitedAt) >= sevenDaysAgo
    );
    const momentsCount = friendVisits.filter((v) => v.hasMoment).length;

    return {
      placeId,
      friendVisits,
      totalFriendVisits: friendVisits.length,
      recentFriendVisits: recentVisits.length,
      hasFriendMoments: momentsCount > 0,
      friendMomentsCount: momentsCount,
    };
  } catch (error) {
    console.error('Get place social context error:', error);
    return null;
  }
}

/**
 * Get social context for multiple places (batch for recommendation scoring)
 */
export async function getPlacesSocialContext(
  userId: string,
  placeIds: string[]
): Promise<Map<string, PlaceSocialContext>> {
  const contextMap = new Map<string, PlaceSocialContext>();

  if (placeIds.length === 0) return contextMap;

  try {
    // Get friend IDs
    const { data: friendships } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId)
      .eq('status', 'accepted');

    if (!friendships || friendships.length === 0) {
      return contextMap;
    }

    const friendIds = friendships.map((f: any) => f.friend_id);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get all friend moments at these places
    const { data: moments } = await supabase
      .from('moments')
      .select(`
        place_id,
        user_id,
        created_at,
        user:users!user_id (
          name
        )
      `)
      .in('place_id', placeIds)
      .in('user_id', friendIds)
      .eq('is_active', true);

    // Group by place
    for (const moment of moments || []) {
      const placeId = moment.place_id;

      if (!contextMap.has(placeId)) {
        contextMap.set(placeId, {
          placeId,
          friendVisits: [],
          totalFriendVisits: 0,
          recentFriendVisits: 0,
          hasFriendMoments: false,
          friendMomentsCount: 0,
        });
      }

      const context = contextMap.get(placeId)!;
      const isRecent = new Date(moment.created_at) >= sevenDaysAgo;

      context.friendVisits.push({
        userId: moment.user_id,
        userName: (moment as any).user?.name || 'Friend',
        visitedAt: moment.created_at,
        hasMoment: true,
      });

      context.totalFriendVisits++;
      context.friendMomentsCount++;
      context.hasFriendMoments = true;
      if (isRecent) context.recentFriendVisits++;
    }

    return contextMap;
  } catch (error) {
    console.error('Get places social context error:', error);
    return contextMap;
  }
}

// ============================================================================
// MOCK DATA FOR DEVELOPMENT
// ============================================================================

/**
 * Get mock friend moments for development/demo
 */
export function getMockFriendMoments(): FriendMomentsResult {
  const mockMoments: Moment[] = [
    {
      id: 'mock-moment-1',
      userId: 'mock-user-1',
      place: {
        id: 'ChIJrSHU7-hYToYRkDNzCvvp5J4',
        name: 'Blue Bottle Coffee',
        address: '336 Bowery, New York, NY',
      },
      photoUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
      visibility: 'friends',
      isTaggedToPlace: true,
      viewsCount: 12,
      likesCount: 5,
      captureTrigger: 'manual',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      caption: 'Best latte in town!',
    },
  ];

  const mockFriends: FriendWithMoments[] = [
    {
      userId: 'mock-user-1',
      name: 'Sarah Chen',
      profilePictureUrl: 'https://i.pravatar.cc/150?img=5',
      moments: mockMoments,
      hasUnseenMoments: true,
      latestMomentAt: mockMoments[0].createdAt,
    },
    {
      userId: 'mock-user-2',
      name: 'Mike Johnson',
      profilePictureUrl: 'https://i.pravatar.cc/150?img=8',
      moments: [
        {
          ...mockMoments[0],
          id: 'mock-moment-2',
          userId: 'mock-user-2',
          place: {
            id: 'ChIJsampleplace2',
            name: 'Central Park',
            address: 'New York, NY',
          },
          photoUrl: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800',
          caption: 'Perfect weather for a run!',
          createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        },
      ],
      hasUnseenMoments: true,
      latestMomentAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      userId: 'mock-user-3',
      name: 'Emma Wilson',
      profilePictureUrl: 'https://i.pravatar.cc/150?img=9',
      moments: [
        {
          ...mockMoments[0],
          id: 'mock-moment-3',
          userId: 'mock-user-3',
          place: {
            id: 'ChIJsampleplace3',
            name: 'Joe\'s Pizza',
            address: '7 Carmine St, New York, NY',
          },
          photoUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
          caption: 'NYC pizza hits different',
          createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
          hasViewed: true,
        },
      ],
      hasUnseenMoments: false, // Already viewed
      latestMomentAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    },
  ];

  return {
    friends: mockFriends,
    totalUnseenCount: 2,
  };
}
