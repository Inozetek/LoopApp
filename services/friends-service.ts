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
          last_active_date
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .order('accepted_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      return [];
    }

    // Transform to Friend interface
    const friends: Friend[] = data.map((f: any) => ({
      id: f.friend.id,
      name: f.friend.name,
      email: f.friend.email,
      profilePictureUrl: f.friend.profile_picture_url,
      loopScore: f.friend.loop_score || 0,
      streakDays: f.friend.streak_days || 0,
      isOnline: isUserOnline(f.friend.last_active_date),
      lastActiveAt: f.friend.last_active_date ? new Date(f.friend.last_active_date) : new Date(),
      friendsSince: f.accepted_at ? new Date(f.accepted_at) : new Date(f.created_at),
      mutualFriends: 0, // TODO: Calculate mutual friends
      sharedInterests: [], // TODO: Calculate shared interests
      canViewLoop: f.can_view_loop,
      canInviteToActivities: f.can_invite_to_activities,
    }));

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

    // Transform to FriendRequest interface
    const requests: FriendRequest[] = data.map((r: any) => ({
      id: r.id,
      fromUserId: r.user_id,
      toUserId: userId,
      fromUser: {
        id: r.requester.id,
        name: r.requester.name,
        email: r.requester.email,
        profilePictureUrl: r.requester.profile_picture_url,
        loopScore: r.requester.loop_score || 0,
        mutualFriends: 0, // TODO: Calculate mutual friends
      },
      status: 'pending',
      createdAt: new Date(r.created_at),
    }));

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
    const userIds = data.map(u => u.id);
    const { data: friendships } = await supabase
      .from('friendships')
      .select('friend_id, status')
      .eq('user_id', currentUserId)
      .in('friend_id', userIds);

    const friendshipMap = new Map(
      (friendships || []).map(f => [f.friend_id, f.status])
    );

    // Transform to FriendSearchResult interface
    const results: FriendSearchResult[] = data.map((u: any) => {
      const friendshipStatus = friendshipMap.get(u.id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        profilePictureUrl: u.profile_picture_url,
        loopScore: u.loop_score || 0,
        mutualFriends: 0, // TODO: Calculate mutual friends
        isFriend: friendshipStatus === 'accepted',
        hasPendingRequest: friendshipStatus === 'pending',
      };
    });

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
        todayActivities = activities.map(a => ({
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

    // Get shared interests
    const currentUserInterests = user.interests || [];
    // TODO: Get current user's interests to calculate shared interests

    const profile: FriendProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      profilePictureUrl: user.profile_picture_url,
      bio: user.bio || 'Living life one Loop at a time!',
      loopScore: user.loop_score || 0,
      loopScoreBreakdown: {
        total: user.loop_score || 0,
        tasksCompleted: 0, // TODO: Calculate from calendar_events
        recommendationsAccepted: 0, // TODO: Calculate from recommendations
        feedbackGiven: 0, // TODO: Calculate from feedback
        groupActivitiesAttended: 0, // TODO: Calculate from plan_participants
        streakBonus: (user.streak_days || 0) * 20,
        badges: [], // TODO: Implement badge system
      },
      streakDays: user.streak_days || 0,
      interests: currentUserInterests,
      sharedInterests: [], // TODO: Calculate
      friendsSince: friendship?.accepted_at
        ? new Date(friendship.accepted_at)
        : new Date(friendship?.created_at || Date.now()),
      mutualFriends: 0, // TODO: Calculate
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
