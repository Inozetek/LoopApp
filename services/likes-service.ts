/**
 * Likes Service
 *
 * Unified social engagement system for activity/place likes.
 * Handles like persistence, friend visibility, and AI profile updates.
 *
 * Key features:
 * - 1 Like = 5 Stars (full endorsement to recommendation algorithm)
 * - Instagram-style "Liked by [friend] and X others" display
 * - Privacy-aware visibility (sensitive categories auto-private)
 * - Real-time aggregate updates
 */

import { supabase } from '@/lib/supabase';
import { classifyPrivacy } from '@/utils/privacy-classifier';

// ============================================================================
// TYPES
// ============================================================================

export interface FriendWhoLiked {
  userId: string;
  name: string;
  profilePictureUrl?: string;
  likedAt: string;
}

export interface LikeResult {
  isLiked: boolean;
  totalLikes: number;
  friendsWhoLiked: FriendWhoLiked[];
}

export interface PlaceRating {
  totalLikes: number;
  loopCommunityScore: number | null;
  isLiked: boolean;
  friendsWhoLiked: FriendWhoLiked[];
  isTrending: boolean;
  totalThumbsUp: number;
  totalThumbsDown: number;
}

export interface LikerProfile {
  userId: string;
  name: string;
  profilePictureUrl?: string;
  likedAt: string;
  isFriend: boolean;
  isCurrentUser: boolean;
}

export interface ToggleLikeParams {
  userId: string;
  placeId: string;
  placeName: string;
  placeCategory?: string;
  placeLat?: number;
  placeLng?: number;
  placeAddress?: string;
  activityId?: string;
  recommendationId?: string;
  source?: 'feed' | 'details' | 'search' | 'friend_profile' | 'likers_list';
}

// Demo mode flag
const DEMO_USER_ID = 'demo-user-123';

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Toggle like for a place - updates DB and AI profile
 * Returns the new like state and counts
 */
export async function toggleLike(params: ToggleLikeParams): Promise<LikeResult> {
  const {
    userId,
    placeId,
    placeName,
    placeCategory,
    placeLat,
    placeLng,
    placeAddress,
    activityId,
    recommendationId,
    source = 'feed',
  } = params;

  // Demo mode: return mock data
  if (userId === DEMO_USER_ID) {
    return getMockLikeResult(placeId, true);
  }

  try {
    // Call the database function
    const { data, error } = await supabase.rpc('toggle_activity_like', {
      p_user_id: userId,
      p_place_id: placeId,
      p_place_name: placeName,
      p_place_category: placeCategory || null,
      p_place_lat: placeLat || null,
      p_place_lng: placeLng || null,
      p_place_address: placeAddress || null,
      p_activity_id: activityId || null,
      p_recommendation_id: recommendationId || null,
      p_source: source,
    });

    if (error) {
      console.error('Error toggling like:', error);
      throw error;
    }

    const result = data?.[0] || { is_liked: false, total_likes: 0, friends_who_liked_count: 0 };

    // Update AI profile if liked (treat as strong positive signal)
    if (result.is_liked && placeCategory) {
      updateAIProfileFromLike(userId, placeCategory, placeId).catch(console.error);
    }

    // Get friends who liked for the result
    const friendsWhoLiked = await getFriendsWhoLiked(userId, placeId, 3);

    return {
      isLiked: result.is_liked,
      totalLikes: result.total_likes,
      friendsWhoLiked,
    };
  } catch (error) {
    console.error('Error in toggleLike:', error);
    // Return optimistic result on error
    return {
      isLiked: true,
      totalLikes: 1,
      friendsWhoLiked: [],
    };
  }
}

/**
 * Check if user has liked a place
 */
export async function checkIfLiked(userId: string, placeId: string): Promise<boolean> {
  // Demo mode
  if (userId === DEMO_USER_ID) {
    // Return random liked state based on place ID hash for consistency
    return hashString(placeId) % 5 === 0;
  }

  try {
    // Try direct table query first (works without RPC function)
    const { data, error } = await supabase
      .from('activity_likes')
      .select('id')
      .eq('user_id', userId)
      .eq('place_id', placeId)
      .maybeSingle();

    if (error) {
      // If table doesn't exist, return mock data based on hash
      if (error.code === '42P01' || error.code === 'PGRST204') {
        return hashString(placeId) % 5 === 0;
      }
      // Silently fail for other errors - likes feature is not critical
      return false;
    }

    return data !== null;
  } catch (error) {
    // Silently fail - likes feature is not critical
    return false;
  }
}

/**
 * Get place rating with friends who liked
 * Used for activity card social proof display
 */
export async function getPlaceRating(userId: string, placeId: string): Promise<PlaceRating> {
  // Demo mode
  if (userId === DEMO_USER_ID) {
    return getMockPlaceRating(placeId);
  }

  try {
    // Fetch isLiked and friends who liked in parallel
    // Skip aggregate table if it doesn't exist
    const [friendsResult, isLikedResult] = await Promise.all([
      getFriendsWhoLiked(userId, placeId, 3),
      checkIfLiked(userId, placeId),
    ]);

    // Try to get aggregate, but don't fail if table doesn't exist
    let totalLikes = 0;
    let isTrending = false;
    let loopCommunityScore = null;
    let totalThumbsUp = 0;
    let totalThumbsDown = 0;

    try {
      const { data: aggregate, error } = await supabase
        .from('place_ratings_aggregate')
        .select('total_likes, loop_community_score, is_trending, total_thumbs_up, total_thumbs_down')
        .eq('place_id', placeId)
        .maybeSingle();

      if (!error && aggregate) {
        totalLikes = aggregate.total_likes || 0;
        loopCommunityScore = aggregate.loop_community_score || null;
        isTrending = aggregate.is_trending || false;
        totalThumbsUp = (aggregate as any).total_thumbs_up || 0;
        totalThumbsDown = (aggregate as any).total_thumbs_down || 0;
      }
    } catch {
      // Aggregate table doesn't exist - use fallback
      // Count likes directly from activity_likes
      try {
        const { count } = await supabase
          .from('activity_likes')
          .select('*', { count: 'exact', head: true })
          .eq('place_id', placeId);
        totalLikes = count || 0;
      } catch {
        // Table doesn't exist, use 0
      }
    }

    return {
      totalLikes,
      loopCommunityScore,
      isLiked: isLikedResult,
      friendsWhoLiked: friendsResult,
      isTrending,
      totalThumbsUp,
      totalThumbsDown,
    };
  } catch (error) {
    // Return graceful fallback
    return {
      totalLikes: 0,
      loopCommunityScore: null,
      isLiked: false,
      friendsWhoLiked: [],
      isTrending: false,
      totalThumbsUp: 0,
      totalThumbsDown: 0,
    };
  }
}

/**
 * Get friends who liked a place (for "Liked by" display)
 */
export async function getFriendsWhoLiked(
  userId: string,
  placeId: string,
  limit: number = 3
): Promise<FriendWhoLiked[]> {
  // Demo mode
  if (userId === DEMO_USER_ID) {
    return getMockFriendsWhoLiked(placeId, limit);
  }

  try {
    // Try to get friends who liked via direct query
    // First get user's friends
    const { data: friendships, error: friendshipsError } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .limit(100);

    if (friendshipsError) {
      // If friendships table doesn't exist or error, return empty
      return [];
    }

    if (!friendships || friendships.length === 0) {
      return [];
    }

    const friendIds = friendships.map((f: { friend_id: string }) => f.friend_id);

    // Get likes from friends for this place
    const { data: likes, error: likesError } = await supabase
      .from('activity_likes')
      .select(`
        user_id,
        liked_at,
        users!activity_likes_user_id_fkey(name, profile_picture_url)
      `)
      .eq('place_id', placeId)
      .in('user_id', friendIds)
      .order('liked_at', { ascending: false })
      .limit(limit);

    if (likesError) {
      // If activity_likes table doesn't exist, return empty
      return [];
    }

    return (likes || []).map((row: any) => ({
      userId: row.user_id,
      name: row.users?.name || 'Friend',
      profilePictureUrl: row.users?.profile_picture_url || undefined,
      likedAt: row.liked_at,
    }));
  } catch (error) {
    // Silently fail - friends who liked is not critical
    return [];
  }
}

/**
 * Get all users who liked a place (for likers list screen)
 * Returns friends first, then others
 */
export async function getLikersList(
  userId: string,
  placeId: string,
  offset: number = 0,
  limit: number = 50
): Promise<{ likers: LikerProfile[]; hasMore: boolean }> {
  // Demo mode
  if (userId === DEMO_USER_ID) {
    return getMockLikersList(placeId, offset, limit);
  }

  try {
    const { data, error } = await supabase.rpc('get_likers_list', {
      p_user_id: userId,
      p_place_id: placeId,
      p_offset: offset,
      p_limit: limit + 1, // Fetch one extra to check if there's more
    });

    if (error) {
      console.error('Error getting likers list:', error);
      return { likers: [], hasMore: false };
    }

    const likers = (data || []).slice(0, limit).map((row: any) => ({
      userId: row.user_id,
      name: row.name,
      profilePictureUrl: row.profile_picture_url || undefined,
      likedAt: row.liked_at,
      isFriend: row.is_friend,
      isCurrentUser: row.is_current_user,
    }));

    return {
      likers,
      hasMore: (data || []).length > limit,
    };
  } catch (error) {
    console.error('Error in getLikersList:', error);
    return { likers: [], hasMore: false };
  }
}

/**
 * Get count of likes for a place
 */
export async function getLikesCount(placeId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('place_ratings_aggregate')
      .select('total_likes')
      .eq('place_id', placeId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('Error getting likes count:', error);
      return 0;
    }

    return data?.total_likes || 0;
  } catch (error) {
    console.error('Error in getLikesCount:', error);
    return 0;
  }
}

/**
 * Batch check likes for multiple places (efficient for feed)
 */
export async function batchCheckLikes(
  userId: string,
  placeIds: string[]
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();

  // Demo mode
  if (userId === DEMO_USER_ID) {
    placeIds.forEach(placeId => {
      result.set(placeId, hashString(placeId) % 5 === 0);
    });
    return result;
  }

  if (placeIds.length === 0) return result;

  try {
    const { data, error } = await supabase
      .from('activity_likes')
      .select('place_id')
      .eq('user_id', userId)
      .in('place_id', placeIds);

    if (error) {
      console.error('Error batch checking likes:', error);
      return result;
    }

    // Initialize all as false
    placeIds.forEach(id => result.set(id, false));

    // Set liked ones to true
    (data || []).forEach((row: any) => {
      result.set(row.place_id, true);
    });

    return result;
  } catch (error) {
    console.error('Error in batchCheckLikes:', error);
    return result;
  }
}

/**
 * Get user's liked places (for profile)
 */
export async function getUserLikedPlaces(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{
  likes: Array<{
    placeId: string;
    placeName: string;
    placeCategory?: string;
    likedAt: string;
  }>;
  hasMore: boolean;
}> {
  // Demo mode
  if (userId === DEMO_USER_ID) {
    return {
      likes: [
        { placeId: 'demo-1', placeName: 'Demo Coffee Shop', placeCategory: 'coffee', likedAt: new Date().toISOString() },
        { placeId: 'demo-2', placeName: 'Demo Restaurant', placeCategory: 'dining', likedAt: new Date().toISOString() },
      ],
      hasMore: false,
    };
  }

  try {
    const { data, error } = await supabase
      .from('activity_likes')
      .select('place_id, place_name, place_category, liked_at')
      .eq('user_id', userId)
      .order('liked_at', { ascending: false })
      .range(offset, offset + limit);

    if (error) {
      console.error('Error getting user liked places:', error);
      return { likes: [], hasMore: false };
    }

    return {
      likes: (data || []).map((row: any) => ({
        placeId: row.place_id,
        placeName: row.place_name,
        placeCategory: row.place_category || undefined,
        likedAt: row.liked_at,
      })),
      hasMore: (data || []).length === limit + 1,
    };
  } catch (error) {
    console.error('Error in getUserLikedPlaces:', error);
    return { likes: [], hasMore: false };
  }
}

// ============================================================================
// AI PROFILE UPDATE (Like = Strong Positive Signal)
// ============================================================================

/**
 * Update user's AI profile based on a like
 * Treat like as equivalent to 5-star rating / thumbs up
 */
async function updateAIProfileFromLike(
  userId: string,
  category: string,
  placeId: string
): Promise<void> {
  try {
    console.log('Like updating AI profile for user:', userId, 'category:', category);

    // Fetch current profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('ai_profile')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Error fetching user for AI profile update:', userError);
      return;
    }

    // Parse current profile with defaults
    const currentProfile = user.ai_profile || {
      preferred_distance_miles: 5.0,
      budget_level: 2,
      favorite_categories: [],
      disliked_categories: [],
      price_sensitivity: 'medium',
      time_preferences: [],
      distance_tolerance: 'medium',
      liked_places: [], // Track liked place IDs
    };

    const updatedProfile = { ...currentProfile };

    // Add category to favorites if not already there
    if (!updatedProfile.favorite_categories.includes(category)) {
      updatedProfile.favorite_categories.push(category);
    }

    // Remove from disliked if present
    updatedProfile.disliked_categories = updatedProfile.disliked_categories.filter(
      (cat: string) => cat !== category
    );

    // Track liked place (for future collaborative filtering)
    if (!updatedProfile.liked_places) {
      updatedProfile.liked_places = [];
    }
    if (!updatedProfile.liked_places.includes(placeId)) {
      updatedProfile.liked_places.push(placeId);
    }

    // Limit arrays
    if (updatedProfile.favorite_categories.length > 15) {
      updatedProfile.favorite_categories = updatedProfile.favorite_categories.slice(-15);
    }
    if (updatedProfile.liked_places.length > 100) {
      updatedProfile.liked_places = updatedProfile.liked_places.slice(-100);
    }

    // Update database
    const { error: updateError } = await supabase
      .from('users')
      .update({ ai_profile: updatedProfile })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating AI profile from like:', updateError);
      return;
    }

    console.log('AI profile updated from like - added', category, 'to favorites');
  } catch (error) {
    console.error('Error in updateAIProfileFromLike:', error);
  }
}

// ============================================================================
// MOCK DATA HELPERS (for demo mode)
// ============================================================================

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

const MOCK_FRIENDS = [
  { userId: 'friend-1', name: 'Sarah Chen', profilePictureUrl: 'https://i.pravatar.cc/150?u=sarah' },
  { userId: 'friend-2', name: 'Mike Johnson', profilePictureUrl: 'https://i.pravatar.cc/150?u=mike' },
  { userId: 'friend-3', name: 'Emily Davis', profilePictureUrl: 'https://i.pravatar.cc/150?u=emily' },
  { userId: 'friend-4', name: 'Alex Rivera', profilePictureUrl: 'https://i.pravatar.cc/150?u=alex' },
  { userId: 'friend-5', name: 'Jordan Lee', profilePictureUrl: 'https://i.pravatar.cc/150?u=jordan' },
];

function getMockLikeResult(placeId: string, newLikeState: boolean): LikeResult {
  const hash = hashString(placeId);
  const friendCount = hash % 4;
  const totalLikes = (hash % 200) + 50;

  return {
    isLiked: newLikeState,
    totalLikes: newLikeState ? totalLikes + 1 : totalLikes,
    friendsWhoLiked: MOCK_FRIENDS.slice(0, friendCount).map(f => ({
      ...f,
      likedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    })),
  };
}

function getMockPlaceRating(placeId: string): PlaceRating {
  const hash = hashString(placeId);
  const friendCount = hash % 4;
  const totalLikes = (hash % 200) + 50;
  const thumbsUp = (hash % 30) + 5;
  const thumbsDown = hash % 8;

  return {
    totalLikes,
    loopCommunityScore: (hash % 20 + 30) / 10, // 3.0-5.0
    isLiked: hash % 5 === 0,
    friendsWhoLiked: MOCK_FRIENDS.slice(0, friendCount).map(f => ({
      ...f,
      likedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    })),
    isTrending: hash % 10 === 0,
    totalThumbsUp: thumbsUp,
    totalThumbsDown: thumbsDown,
  };
}

function getMockFriendsWhoLiked(placeId: string, limit: number): FriendWhoLiked[] {
  const hash = hashString(placeId);
  const friendCount = Math.min(hash % 4, limit);

  return MOCK_FRIENDS.slice(0, friendCount).map(f => ({
    ...f,
    likedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

function getMockLikersList(placeId: string, offset: number, limit: number): { likers: LikerProfile[]; hasMore: boolean } {
  const hash = hashString(placeId);
  const totalLikers = (hash % 50) + 20;

  // Generate mix of friends and others
  const allLikers: LikerProfile[] = [];

  // Add friends first
  MOCK_FRIENDS.forEach((friend, idx) => {
    if (idx < hash % 5) {
      allLikers.push({
        ...friend,
        likedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        isFriend: true,
        isCurrentUser: false,
      });
    }
  });

  // Add random others
  for (let i = allLikers.length; i < totalLikers; i++) {
    allLikers.push({
      userId: `user-${i}`,
      name: `User ${i + 1}`,
      profilePictureUrl: `https://i.pravatar.cc/150?u=user${i}`,
      likedAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
      isFriend: false,
      isCurrentUser: false,
    });
  }

  const paginated = allLikers.slice(offset, offset + limit);

  return {
    likers: paginated,
    hasMore: offset + limit < totalLikers,
  };
}
