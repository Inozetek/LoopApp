/**
 * Friends Service - Real Supabase Integration
 *
 * Handles all friend-related operations:
 * - Loading friends list
 * - Sending/accepting/declining friend requests
 * - Searching for users
 * - Managing friend permissions
 */

import { supabase } from '@/lib/supabase';
import { Friend, FriendRequest, SuggestedFriend, FriendProfile, FriendSearchResult } from '@/types/friend';

// ============================================================================
// REAL SUPABASE FUNCTIONS
// ============================================================================

/**
 * Get all accepted friends for the current user
 */
export async function getFriends(userId: string): Promise<Friend[]> {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        friend_id,
        can_view_loop,
        can_invite_to_activities,
        created_at,
        accepted_at,
        friend:users!friend_id (
          id,
          name,
          email,
          profile_picture_url,
          loop_score,
          streak_days,
          last_active_date,
          interests
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .order('accepted_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      return [];
    }

    // Get current user's friends set for mutual friend calculation
    const currentUserFriendIds = new Set(data.map((f: any) => f.friend.id));

    // Get current user's interests for shared interests
    const { data: currentUser } = await supabase
      .from('users')
      .select('interests')
      .eq('id', userId)
      .single();
    const currentUserInterests: string[] = (currentUser as any)?.interests || [];

    // For each friend, compute mutual friends in-memory
    // Batch-fetch all friends-of-friends to avoid N+1
    const friendIds = data.map((f: any) => f.friend.id);
    const { data: friendsOfFriends } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .in('user_id', friendIds)
      .eq('status', 'accepted');

    // Build a map: friendId -> Set of their friend IDs
    const friendFriendsMap = new Map<string, Set<string>>();
    for (const fof of (friendsOfFriends || []) as any[]) {
      if (!friendFriendsMap.has(fof.user_id)) {
        friendFriendsMap.set(fof.user_id, new Set());
      }
      friendFriendsMap.get(fof.user_id)!.add(fof.friend_id);
    }

    // Transform to Friend interface
    const friends: Friend[] = data.map((f: any) => {
      // Mutual friends = friends of this person that are also friends of the current user
      const theirFriends = friendFriendsMap.get(f.friend.id) || new Set();
      const mutualCount = [...theirFriends].filter(id => currentUserFriendIds.has(id) && id !== userId).length;

      // Shared interests
      const friendInterests: string[] = f.friend.interests || [];
      const shared = calculateSharedInterests(currentUserInterests, friendInterests);

      return {
        id: f.friend.id,
        name: f.friend.name,
        email: f.friend.email,
        profilePictureUrl: f.friend.profile_picture_url,
        loopScore: f.friend.loop_score || 0,
        streakDays: f.friend.streak_days || 0,
        isOnline: isUserOnline(f.friend.last_active_date),
        lastActiveAt: f.friend.last_active_date ? new Date(f.friend.last_active_date) : new Date(),
        friendsSince: f.accepted_at ? new Date(f.accepted_at) : new Date(f.created_at),
        mutualFriends: mutualCount,
        sharedInterests: shared,
        canViewLoop: f.can_view_loop,
        canInviteToActivities: f.can_invite_to_activities,
      };
    });

    return friends;
  } catch (error) {
    console.error('Error fetching friends:', error);
    throw error;
  }
}

/**
 * Get all pending friend requests (sent to current user)
 */
export async function getPendingRequests(userId: string): Promise<FriendRequest[]> {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        user_id,
        friend_id,
        status,
        created_at,
        requester:users!user_id (
          id,
          name,
          email,
          profile_picture_url,
          loop_score
        )
      `)
      .eq('friend_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      return [];
    }

    // Calculate mutual friends for each requester
    const requests: FriendRequest[] = await Promise.all(
      data.map(async (r: any) => {
        const mutual = await calculateMutualFriends(r.user_id, userId);
        return {
          id: r.id,
          fromUserId: r.user_id,
          toUserId: userId,
          fromUser: {
            id: r.requester.id,
            name: r.requester.name,
            email: r.requester.email,
            profilePictureUrl: r.requester.profile_picture_url,
            loopScore: r.requester.loop_score || 0,
            mutualFriends: mutual,
          },
          status: 'pending' as const,
          createdAt: new Date(r.created_at),
        };
      })
    );

    return requests;
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    throw error;
  }
}

/**
 * Search for users by email or name
 */
export async function searchFriends(
  query: string,
  currentUserId: string
): Promise<FriendSearchResult[]> {
  try {
    if (query.length < 2) {
      return [];
    }

    const lowerQuery = query.toLowerCase();

    // Search users by name or email
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, profile_picture_url, loop_score')
      .or(`name.ilike.%${lowerQuery}%,email.ilike.%${lowerQuery}%`)
      .neq('id', currentUserId) // Exclude current user
      .limit(10);

    if (error) throw error;

    if (!data || data.length === 0) {
      return [];
    }

    // Check friendship status for each user
    const userIds = data.map((u: any) => u.id);
    const { data: friendships } = await supabase
      .from('friendships')
      .select('friend_id, status')
      .eq('user_id', currentUserId)
      .in('friend_id', userIds);

    const friendshipMap = new Map(
      (friendships || []).map((f: any) => [f.friend_id, f.status])
    );

    // Transform to FriendSearchResult interface with mutual friend counts
    const results: FriendSearchResult[] = await Promise.all(
      data.map(async (u: any) => {
        const friendshipStatus = friendshipMap.get(u.id);
        const mutual = await calculateMutualFriends(u.id, currentUserId);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          profilePictureUrl: u.profile_picture_url,
          loopScore: u.loop_score || 0,
          mutualFriends: mutual,
          isFriend: friendshipStatus === 'accepted',
          hasPendingRequest: friendshipStatus === 'pending',
        };
      })
    );

    return results;
  } catch (error) {
    console.error('Error searching friends:', error);
    throw error;
  }
}

/**
 * Send a friend request
 */
export async function sendFriendRequest(currentUserId: string, targetUserId: string): Promise<void> {
  try {
    const { error } = await supabase.from('friendships').insert({
      user_id: currentUserId,
      friend_id: targetUserId,
      status: 'pending',
      can_view_loop: true,
      can_invite_to_activities: true,
    });

    if (error) throw error;

    console.log('✅ Friend request sent');
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(requestId: string): Promise<void> {
  try {
    // Update the request to accepted
    const { error: updateError } = await supabase
      .from('friendships')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) throw updateError;

    // Get the request details to create reverse friendship
    const { data: request } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .eq('id', requestId)
      .single();

    if (request) {
      // Create reverse friendship (so both users see each other as friends)
      const { error: reverseError } = await supabase.from('friendships').insert({
        user_id: request.friend_id,
        friend_id: request.user_id,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        can_view_loop: true,
        can_invite_to_activities: true,
      });

      if (reverseError) throw reverseError;
    }

    console.log('✅ Friend request accepted');
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw error;
  }
}

/**
 * Decline a friend request
 */
export async function declineFriendRequest(requestId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'declined' })
      .eq('id', requestId);

    if (error) throw error;

    console.log('✅ Friend request declined');
  } catch (error) {
    console.error('Error declining friend request:', error);
    throw error;
  }
}

/**
 * Remove a friend (delete both directions of friendship)
 */
export async function removeFriend(currentUserId: string, friendId: string): Promise<void> {
  try {
    // Delete both directions of the friendship
    const { error: error1 } = await supabase
      .from('friendships')
      .delete()
      .eq('user_id', currentUserId)
      .eq('friend_id', friendId);

    if (error1) throw error1;

    const { error: error2 } = await supabase
      .from('friendships')
      .delete()
      .eq('user_id', friendId)
      .eq('friend_id', currentUserId);

    if (error2) throw error2;

    console.log('✅ Friend removed');
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
}

/**
 * Get detailed profile for a friend
 */
export async function getFriendProfile(friendId: string, currentUserId: string): Promise<FriendProfile> {
  try {
    // Get friend's profile data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', friendId)
      .single();

    if (userError) throw userError;
    if (!user) throw new Error('Friend not found');

    // Get friendship details
    const { data: friendship } = await supabase
      .from('friendships')
      .select('created_at, accepted_at, can_view_loop')
      .eq('user_id', currentUserId)
      .eq('friend_id', friendId)
      .single();

    // Get today's activities if they allow viewing
    let todayActivities = undefined;
    if (friendship?.can_view_loop) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: activities } = await supabase
        .from('calendar_events')
        .select('id, title, start_time, address, category')
        .eq('user_id', friendId)
        .gte('start_time', today.toISOString())
        .lt('start_time', tomorrow.toISOString())
        .order('start_time', { ascending: true });

      if (activities && activities.length > 0) {
        todayActivities = activities.map((a: any) => ({
          id: a.id,
          title: a.title,
          time: new Date(a.start_time).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
          location: a.address || 'Location TBD',
          category: a.category || 'other',
        }));
      }
    }

    // Get current user's interests for shared interests
    const { data: currentUserData } = await supabase
      .from('users')
      .select('interests')
      .eq('id', currentUserId)
      .single();
    const currentUserInterests: string[] = (currentUserData as any)?.interests || [];
    const friendInterests: string[] = user.interests || [];

    // Calculate real stats in parallel
    const [scoreBreakdown, mutualCount] = await Promise.all([
      calculateLoopScoreBreakdown(friendId),
      calculateMutualFriends(friendId, currentUserId),
    ]);

    const sharedInterests = calculateSharedInterests(currentUserInterests, friendInterests);

    const profile: FriendProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      profilePictureUrl: user.profile_picture_url,
      bio: user.bio || 'Living life one Loop at a time!',
      loopScore: user.loop_score || 0,
      loopScoreBreakdown: {
        total: user.loop_score || 0,
        tasksCompleted: scoreBreakdown.tasksCompleted,
        recommendationsAccepted: scoreBreakdown.recommendationsAccepted,
        feedbackGiven: scoreBreakdown.feedbackGiven,
        groupActivitiesAttended: scoreBreakdown.groupActivitiesAttended,
        streakBonus: (user.streak_days || 0) * 20,
        badges: [],
      },
      streakDays: user.streak_days || 0,
      interests: friendInterests,
      sharedInterests,
      friendsSince: friendship?.accepted_at
        ? new Date(friendship.accepted_at)
        : new Date(friendship?.created_at || Date.now()),
      mutualFriends: mutualCount,
      canViewLoop: friendship?.can_view_loop || false,
      todayActivities,
    };

    return profile;
  } catch (error) {
    console.error('Error fetching friend profile:', error);
    throw error;
  }
}

/**
 * Get suggested friends based on mutual friends and interests
 */
export async function getSuggestedFriends(userId: string): Promise<SuggestedFriend[]> {
  // TODO: Implement smart friend suggestions algorithm
  // For now, return empty array
  return [];
}

// ============================================================================
// STAT CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate Loop Score breakdown for a user
 */
export async function calculateLoopScoreBreakdown(userId: string): Promise<{
  tasksCompleted: number;
  recommendationsAccepted: number;
  feedbackGiven: number;
  groupActivitiesAttended: number;
}> {
  try {
    const [tasksResult, recsResult, feedbackResult, groupResult] = await Promise.all([
      supabase
        .from('calendar_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed'),
      supabase
        .from('recommendations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'accepted'),
      supabase
        .from('feedback')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('plan_participants')
        .select('id, group_plans!inner(status)', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('rsvp_status', 'accepted')
        .eq('group_plans.status' as any, 'completed'),
    ]);

    return {
      tasksCompleted: tasksResult.count || 0,
      recommendationsAccepted: recsResult.count || 0,
      feedbackGiven: feedbackResult.count || 0,
      groupActivitiesAttended: groupResult.count || 0,
    };
  } catch (error) {
    console.error('Error calculating loop score breakdown:', error);
    return { tasksCompleted: 0, recommendationsAccepted: 0, feedbackGiven: 0, groupActivitiesAttended: 0 };
  }
}

/**
 * Calculate mutual friends count between two users
 */
export async function calculateMutualFriends(userId: string, currentUserId: string): Promise<number> {
  try {
    // Get both users' friend sets
    const [userFriends, currentUserFriends] = await Promise.all([
      supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('status', 'accepted'),
      supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', currentUserId)
        .eq('status', 'accepted'),
    ]);

    if (!userFriends.data || !currentUserFriends.data) return 0;

    const userFriendIds = new Set(userFriends.data.map((f: any) => f.friend_id));
    const currentFriendIds = currentUserFriends.data.map((f: any) => f.friend_id);

    return currentFriendIds.filter((id: string) => userFriendIds.has(id)).length;
  } catch (error) {
    console.error('Error calculating mutual friends:', error);
    return 0;
  }
}

/**
 * Calculate shared interests between two users
 * Pure function: array intersection
 */
export function calculateSharedInterests(
  userInterests: string[],
  friendInterests: string[]
): string[] {
  if (!userInterests || !friendInterests) return [];
  const friendSet = new Set(friendInterests.map(i => i.toLowerCase()));
  return userInterests.filter(i => friendSet.has(i.toLowerCase()));
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a user is currently online (active in last 5 minutes)
 */
function isUserOnline(lastActiveDate: string | null): boolean {
  if (!lastActiveDate) return false;
  const lastActive = new Date(lastActiveDate).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  return now - lastActive < fiveMinutes;
}

/**
 * Get activity status text based on last active time
 */
export function getActivityStatusText(lastActiveAt: Date): string {
  const now = Date.now();
  const diff = now - lastActiveAt.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Online now';
  if (minutes < 5) return 'Active now';
  if (minutes < 60) return `Active ${minutes}m ago`;
  if (hours < 24) return `Active ${hours}h ago`;
  if (days === 1) return 'Active yesterday';
  if (days < 7) return `Active ${days}d ago`;
  return 'Active recently';
}

// ============================================================================
// MOCK DATA FALLBACK (for demo/development)
// ============================================================================

const MOCK_FRIENDS: Friend[] = [
  {
    id: '1',
    name: 'Alex Rivera',
    email: 'alex@example.com',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=1',
    loopScore: 2847,
    streakDays: 14,
    isOnline: true,
    lastActiveAt: new Date(),
    friendsSince: new Date('2024-01-15'),
    mutualFriends: 8,
    sharedInterests: ['coffee', 'live_music', 'hiking'],
    canViewLoop: true,
    canInviteToActivities: true,
  },
  {
    id: '2',
    name: 'Jordan Chen',
    email: 'jordan@example.com',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=2',
    loopScore: 3421,
    streakDays: 28,
    isOnline: true,
    lastActiveAt: new Date(Date.now() - 5 * 60 * 1000),
    friendsSince: new Date('2023-11-20'),
    mutualFriends: 12,
    sharedInterests: ['fitness', 'dining', 'bars'],
    canViewLoop: true,
    canInviteToActivities: true,
  },
  {
    id: '3',
    name: 'Taylor Morgan',
    email: 'taylor@example.com',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=3',
    loopScore: 1892,
    streakDays: 7,
    isOnline: false,
    lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    friendsSince: new Date('2024-02-01'),
    mutualFriends: 5,
    sharedInterests: ['arts', 'culture', 'coffee'],
    canViewLoop: true,
    canInviteToActivities: true,
  },
];

export function getMockFriends(): Friend[] {
  return MOCK_FRIENDS;
}

export function getMockPendingRequests(): FriendRequest[] {
  return [];
}

export function getMockSuggestedFriends(): SuggestedFriend[] {
  return [];
}
