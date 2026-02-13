/**
 * Friend Groups Service
 * CRUD operations for friend groups, members, and privacy settings
 */

import { supabase } from '@/lib/supabase';

export interface FriendGroup {
  id: string;
  user_id: string;
  name: string;
  emoji: string | null;
  created_at: string;
  updated_at: string;
  members: FriendGroupMember[];
  privacy: FriendGroupPrivacy;
}

export interface FriendGroupMember {
  id: string;
  group_id: string;
  friend_user_id: string;
  added_at: string;
  // joined from users table
  name?: string;
  email?: string;
  profile_picture_url?: string | null;
}

export interface FriendGroupPrivacy {
  id?: string;
  group_id: string;
  can_see_my_loop: boolean;
  i_can_see_their_loop: boolean;
  include_in_group_recs: boolean;
  include_in_one_on_one_recs: boolean;
  auto_share_calendar: boolean;
}

const DEFAULT_PRIVACY: Omit<FriendGroupPrivacy, 'group_id'> = {
  can_see_my_loop: true,
  i_can_see_their_loop: true,
  include_in_group_recs: true,
  include_in_one_on_one_recs: true,
  auto_share_calendar: false,
};

/**
 * Fetch all friend groups for a user with members and privacy settings
 */
export async function getFriendGroups(userId: string): Promise<FriendGroup[]> {
  const { data: groups, error } = await supabase
    .from('friend_groups')
    .select(`
      *,
      friend_group_members (
        id,
        group_id,
        friend_user_id,
        added_at,
        users:friend_user_id (
          name,
          email,
          profile_picture_url
        )
      ),
      friend_group_privacy (
        id,
        group_id,
        can_see_my_loop,
        i_can_see_their_loop,
        include_in_group_recs,
        include_in_one_on_one_recs,
        auto_share_calendar
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (groups || []).map((g: any) => ({
    id: g.id,
    user_id: g.user_id,
    name: g.name,
    emoji: g.emoji,
    created_at: g.created_at,
    updated_at: g.updated_at,
    members: (g.friend_group_members || []).map((m: any) => ({
      id: m.id,
      group_id: m.group_id,
      friend_user_id: m.friend_user_id,
      added_at: m.added_at,
      name: m.users?.name,
      email: m.users?.email,
      profile_picture_url: m.users?.profile_picture_url,
    })),
    privacy: g.friend_group_privacy?.[0] || {
      group_id: g.id,
      ...DEFAULT_PRIVACY,
    },
  }));
}

/**
 * Create a new friend group with default privacy settings
 */
export async function createFriendGroup(
  userId: string,
  name: string,
  emoji?: string
): Promise<FriendGroup> {
  // Insert group
  const { data: group, error: groupError } = await supabase
    .from('friend_groups')
    .insert({ user_id: userId, name, emoji: emoji || null })
    .select()
    .single();

  if (groupError) throw groupError;

  // Insert default privacy
  const { error: privacyError } = await supabase
    .from('friend_group_privacy')
    .insert({ group_id: group.id, ...DEFAULT_PRIVACY });

  if (privacyError) throw privacyError;

  return {
    ...group,
    members: [],
    privacy: { group_id: group.id, ...DEFAULT_PRIVACY },
  };
}

/**
 * Update a friend group (name, emoji)
 */
export async function updateFriendGroup(
  groupId: string,
  updates: { name?: string; emoji?: string }
): Promise<void> {
  const { error } = await supabase
    .from('friend_groups')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', groupId);

  if (error) throw error;
}

/**
 * Delete a friend group (cascades to members + privacy)
 */
export async function deleteFriendGroup(groupId: string): Promise<void> {
  const { error } = await supabase
    .from('friend_groups')
    .delete()
    .eq('id', groupId);

  if (error) throw error;
}

/**
 * Add a member to a group
 * Validates that the friendship exists first
 */
export async function addMemberToGroup(
  groupId: string,
  friendUserId: string,
  ownerUserId: string
): Promise<void> {
  // Validate friendship exists
  const { data: friendship, error: fErr } = await supabase
    .from('friendships')
    .select('id')
    .or(`and(user_id.eq.${ownerUserId},friend_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},friend_id.eq.${ownerUserId})`)
    .eq('status', 'accepted')
    .maybeSingle();

  if (fErr) throw fErr;
  if (!friendship) throw new Error('Cannot add non-friend to group');

  const { error } = await supabase
    .from('friend_group_members')
    .insert({ group_id: groupId, friend_user_id: friendUserId });

  if (error) throw error;
}

/**
 * Remove a member from a group
 */
export async function removeMemberFromGroup(
  groupId: string,
  friendUserId: string
): Promise<void> {
  const { error } = await supabase
    .from('friend_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('friend_user_id', friendUserId);

  if (error) throw error;
}

/**
 * Update privacy settings for a group
 */
export async function updateGroupPrivacy(
  groupId: string,
  updates: Partial<Omit<FriendGroupPrivacy, 'id' | 'group_id'>>
): Promise<void> {
  const { error } = await supabase
    .from('friend_group_privacy')
    .update(updates)
    .eq('group_id', groupId);

  if (error) throw error;
}

/**
 * Get effective privacy for a specific friend across all groups they belong to.
 * Returns the MOST PERMISSIVE settings (OR all booleans).
 * If the friend is in no groups, returns all-true defaults.
 */
export async function getEffectivePrivacyForFriend(
  userId: string,
  friendUserId: string
): Promise<Omit<FriendGroupPrivacy, 'id' | 'group_id'>> {
  // Get all groups this friend is in (owned by userId)
  const { data, error } = await supabase
    .from('friend_group_members')
    .select(`
      group_id,
      friend_groups!inner (user_id),
      friend_group_privacy:group_id (
        can_see_my_loop,
        i_can_see_their_loop,
        include_in_group_recs,
        include_in_one_on_one_recs,
        auto_share_calendar
      )
    `)
    .eq('friend_user_id', friendUserId)
    .eq('friend_groups.user_id', userId);

  if (error) throw error;

  if (!data || data.length === 0) {
    return { ...DEFAULT_PRIVACY };
  }

  // OR all boolean privacy fields across groups (most permissive)
  const result = {
    can_see_my_loop: false,
    i_can_see_their_loop: false,
    include_in_group_recs: false,
    include_in_one_on_one_recs: false,
    auto_share_calendar: false,
  };

  for (const row of data) {
    const p = (row as any).friend_group_privacy;
    if (!p || p.length === 0) continue;
    const privacy = Array.isArray(p) ? p[0] : p;
    result.can_see_my_loop = result.can_see_my_loop || privacy.can_see_my_loop;
    result.i_can_see_their_loop = result.i_can_see_their_loop || privacy.i_can_see_their_loop;
    result.include_in_group_recs = result.include_in_group_recs || privacy.include_in_group_recs;
    result.include_in_one_on_one_recs = result.include_in_one_on_one_recs || privacy.include_in_one_on_one_recs;
    result.auto_share_calendar = result.auto_share_calendar || privacy.auto_share_calendar;
  }

  return result;
}

/**
 * Get friend IDs eligible for group recommendations in a specific group
 */
export async function getFriendsEligibleForGroupRecs(
  userId: string,
  groupId: string
): Promise<string[]> {
  // Get privacy for this group
  const { data: privacyData, error: pErr } = await supabase
    .from('friend_group_privacy')
    .select('include_in_group_recs')
    .eq('group_id', groupId)
    .single();

  if (pErr || !privacyData?.include_in_group_recs) {
    return [];
  }

  // Get member IDs
  const { data: members, error: mErr } = await supabase
    .from('friend_group_members')
    .select('friend_user_id')
    .eq('group_id', groupId);

  if (mErr) throw mErr;

  return (members || []).map((m: any) => m.friend_user_id);
}
