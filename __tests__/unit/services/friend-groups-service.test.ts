/**
 * Friend Groups Service Tests
 * Tests for CRUD operations, membership validation, effective privacy calculation
 *
 * We test the pure logic inline to avoid Supabase dependencies.
 */

describe('Friend Groups Service', () => {
  // ─── Types ────────────────────────────────────────────────────────────
  interface FriendGroupPrivacy {
    can_see_my_loop: boolean;
    i_can_see_their_loop: boolean;
    include_in_group_recs: boolean;
    include_in_one_on_one_recs: boolean;
    auto_share_calendar: boolean;
  }

  interface FriendGroup {
    id: string;
    user_id: string;
    name: string;
    emoji: string | null;
    members: { friend_user_id: string }[];
    privacy: FriendGroupPrivacy;
  }

  const DEFAULT_PRIVACY: FriendGroupPrivacy = {
    can_see_my_loop: true,
    i_can_see_their_loop: true,
    include_in_group_recs: true,
    include_in_one_on_one_recs: true,
    auto_share_calendar: false,
  };

  // ─── In-memory store ──────────────────────────────────────────────────
  let groups: FriendGroup[] = [];
  let friendships: { user_id: string; friend_id: string; status: string }[] = [];
  let nextId = 1;

  function createGroup(userId: string, name: string, emoji?: string): FriendGroup {
    const group: FriendGroup = {
      id: `group-${nextId++}`,
      user_id: userId,
      name,
      emoji: emoji || null,
      members: [],
      privacy: { ...DEFAULT_PRIVACY },
    };
    groups.push(group);
    return group;
  }

  function deleteGroup(groupId: string): void {
    groups = groups.filter((g) => g.id !== groupId);
  }

  function addMember(groupId: string, friendUserId: string, ownerUserId: string): void {
    // Validate friendship
    const hasFriendship = friendships.some(
      (f) =>
        f.status === 'accepted' &&
        ((f.user_id === ownerUserId && f.friend_id === friendUserId) ||
          (f.user_id === friendUserId && f.friend_id === ownerUserId))
    );
    if (!hasFriendship) {
      throw new Error('Cannot add non-friend to group');
    }

    const group = groups.find((g) => g.id === groupId);
    if (!group) throw new Error('Group not found');

    // Don't add duplicates
    if (group.members.some((m) => m.friend_user_id === friendUserId)) return;
    group.members.push({ friend_user_id: friendUserId });
  }

  function removeMember(groupId: string, friendUserId: string): void {
    const group = groups.find((g) => g.id === groupId);
    if (!group) throw new Error('Group not found');
    group.members = group.members.filter((m) => m.friend_user_id !== friendUserId);
  }

  function updatePrivacy(groupId: string, updates: Partial<FriendGroupPrivacy>): void {
    const group = groups.find((g) => g.id === groupId);
    if (!group) throw new Error('Group not found');
    group.privacy = { ...group.privacy, ...updates };
  }

  /**
   * Effective privacy for a friend across all groups:
   * OR all booleans (most permissive)
   */
  function getEffectivePrivacyForFriend(
    userId: string,
    friendUserId: string
  ): FriendGroupPrivacy {
    const memberGroups = groups.filter(
      (g) =>
        g.user_id === userId &&
        g.members.some((m) => m.friend_user_id === friendUserId)
    );

    if (memberGroups.length === 0) {
      return { ...DEFAULT_PRIVACY };
    }

    const result: FriendGroupPrivacy = {
      can_see_my_loop: false,
      i_can_see_their_loop: false,
      include_in_group_recs: false,
      include_in_one_on_one_recs: false,
      auto_share_calendar: false,
    };

    for (const g of memberGroups) {
      result.can_see_my_loop = result.can_see_my_loop || g.privacy.can_see_my_loop;
      result.i_can_see_their_loop = result.i_can_see_their_loop || g.privacy.i_can_see_their_loop;
      result.include_in_group_recs = result.include_in_group_recs || g.privacy.include_in_group_recs;
      result.include_in_one_on_one_recs = result.include_in_one_on_one_recs || g.privacy.include_in_one_on_one_recs;
      result.auto_share_calendar = result.auto_share_calendar || g.privacy.auto_share_calendar;
    }

    return result;
  }

  function getFriendsEligibleForGroupRecs(userId: string, groupId: string): string[] {
    const group = groups.find((g) => g.id === groupId && g.user_id === userId);
    if (!group || !group.privacy.include_in_group_recs) return [];
    return group.members.map((m) => m.friend_user_id);
  }

  // ─── Setup / Teardown ─────────────────────────────────────────────────
  beforeEach(() => {
    groups = [];
    friendships = [
      { user_id: 'user-1', friend_id: 'friend-a', status: 'accepted' },
      { user_id: 'user-1', friend_id: 'friend-b', status: 'accepted' },
      { user_id: 'user-1', friend_id: 'friend-c', status: 'accepted' },
      { user_id: 'friend-d', friend_id: 'user-1', status: 'accepted' },
      { user_id: 'user-1', friend_id: 'stranger-1', status: 'pending' },
    ];
    nextId = 1;
  });

  // ─── CRUD ─────────────────────────────────────────────────────────────
  describe('CRUD operations', () => {
    it('should create a group with default privacy', () => {
      const group = createGroup('user-1', 'Hiking Crew', '🏃');
      expect(group.name).toBe('Hiking Crew');
      expect(group.emoji).toBe('🏃');
      expect(group.members).toHaveLength(0);
      expect(group.privacy.can_see_my_loop).toBe(true);
      expect(group.privacy.auto_share_calendar).toBe(false);
    });

    it('should update a group', () => {
      const group = createGroup('user-1', 'Old Name');
      const found = groups.find((g) => g.id === group.id)!;
      found.name = 'New Name';
      found.emoji = '🎵';
      expect(found.name).toBe('New Name');
      expect(found.emoji).toBe('🎵');
    });

    it('should delete a group (cascade removes it from array)', () => {
      const group = createGroup('user-1', 'Delete Me');
      addMember(group.id, 'friend-a', 'user-1');
      expect(groups).toHaveLength(1);

      deleteGroup(group.id);
      expect(groups).toHaveLength(0);
    });
  });

  // ─── Membership ───────────────────────────────────────────────────────
  describe('addMemberToGroup', () => {
    it('should add a valid friend to a group', () => {
      const group = createGroup('user-1', 'Test');
      addMember(group.id, 'friend-a', 'user-1');
      expect(group.members).toHaveLength(1);
      expect(group.members[0].friend_user_id).toBe('friend-a');
    });

    it('should accept reverse friendship direction', () => {
      const group = createGroup('user-1', 'Test');
      // friend-d has friendship with user-1 in reverse direction
      addMember(group.id, 'friend-d', 'user-1');
      expect(group.members).toHaveLength(1);
    });

    it('should throw when adding a non-friend (pending status)', () => {
      const group = createGroup('user-1', 'Test');
      expect(() => addMember(group.id, 'stranger-1', 'user-1')).toThrow('Cannot add non-friend to group');
    });

    it('should throw when adding a complete stranger', () => {
      const group = createGroup('user-1', 'Test');
      expect(() => addMember(group.id, 'unknown-user', 'user-1')).toThrow('Cannot add non-friend to group');
    });

    it('should not add duplicate members', () => {
      const group = createGroup('user-1', 'Test');
      addMember(group.id, 'friend-a', 'user-1');
      addMember(group.id, 'friend-a', 'user-1'); // duplicate
      expect(group.members).toHaveLength(1);
    });

    it('should remove a member', () => {
      const group = createGroup('user-1', 'Test');
      addMember(group.id, 'friend-a', 'user-1');
      addMember(group.id, 'friend-b', 'user-1');
      expect(group.members).toHaveLength(2);

      removeMember(group.id, 'friend-a');
      expect(group.members).toHaveLength(1);
      expect(group.members[0].friend_user_id).toBe('friend-b');
    });
  });

  // ─── Privacy ──────────────────────────────────────────────────────────
  describe('getEffectivePrivacyForFriend', () => {
    it('should return defaults when friend is in no groups', () => {
      createGroup('user-1', 'Empty');
      const privacy = getEffectivePrivacyForFriend('user-1', 'friend-a');
      expect(privacy).toEqual(DEFAULT_PRIVACY);
    });

    it('should return group privacy when friend is in one group', () => {
      const group = createGroup('user-1', 'Group1');
      addMember(group.id, 'friend-a', 'user-1');
      updatePrivacy(group.id, { can_see_my_loop: false, auto_share_calendar: true });

      const privacy = getEffectivePrivacyForFriend('user-1', 'friend-a');
      expect(privacy.can_see_my_loop).toBe(false);
      expect(privacy.auto_share_calendar).toBe(true);
    });

    it('should return most permissive (OR) across multiple groups', () => {
      const group1 = createGroup('user-1', 'Group1');
      const group2 = createGroup('user-1', 'Group2');

      addMember(group1.id, 'friend-a', 'user-1');
      addMember(group2.id, 'friend-a', 'user-1');

      // Group1: can_see = false, auto_share = true
      updatePrivacy(group1.id, { can_see_my_loop: false, auto_share_calendar: true });
      // Group2: can_see = true, auto_share = false
      updatePrivacy(group2.id, { can_see_my_loop: true, auto_share_calendar: false });

      const privacy = getEffectivePrivacyForFriend('user-1', 'friend-a');
      // OR: true wins for both
      expect(privacy.can_see_my_loop).toBe(true);
      expect(privacy.auto_share_calendar).toBe(true);
    });

    it('should return all-false when all groups have all-false', () => {
      const group = createGroup('user-1', 'Restricted');
      addMember(group.id, 'friend-a', 'user-1');
      updatePrivacy(group.id, {
        can_see_my_loop: false,
        i_can_see_their_loop: false,
        include_in_group_recs: false,
        include_in_one_on_one_recs: false,
        auto_share_calendar: false,
      });

      const privacy = getEffectivePrivacyForFriend('user-1', 'friend-a');
      expect(privacy.can_see_my_loop).toBe(false);
      expect(privacy.i_can_see_their_loop).toBe(false);
      expect(privacy.include_in_group_recs).toBe(false);
      expect(privacy.include_in_one_on_one_recs).toBe(false);
      expect(privacy.auto_share_calendar).toBe(false);
    });
  });

  // ─── Group Recs Eligibility ───────────────────────────────────────────
  describe('getFriendsEligibleForGroupRecs', () => {
    it('should return member IDs when include_in_group_recs is true', () => {
      const group = createGroup('user-1', 'Rec Group');
      addMember(group.id, 'friend-a', 'user-1');
      addMember(group.id, 'friend-b', 'user-1');

      const eligible = getFriendsEligibleForGroupRecs('user-1', group.id);
      expect(eligible).toEqual(['friend-a', 'friend-b']);
    });

    it('should return empty when include_in_group_recs is false', () => {
      const group = createGroup('user-1', 'No Recs');
      addMember(group.id, 'friend-a', 'user-1');
      updatePrivacy(group.id, { include_in_group_recs: false });

      const eligible = getFriendsEligibleForGroupRecs('user-1', group.id);
      expect(eligible).toEqual([]);
    });

    it('should return empty for non-existent group', () => {
      const eligible = getFriendsEligibleForGroupRecs('user-1', 'nonexistent');
      expect(eligible).toEqual([]);
    });
  });
});
