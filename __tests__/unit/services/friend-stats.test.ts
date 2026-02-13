/**
 * Tests for friend statistics calculation
 *
 * Tests calculateSharedInterests (pure), and the logic
 * for mutual friends and loop score breakdown.
 */

import { calculateSharedInterests } from '@/services/friends-service';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          eq: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
        in: jest.fn(() => ({
          eq: jest.fn(() => ({
            data: [],
            error: null,
          })),
        })),
      })),
    })),
  },
}));

describe('Friend Statistics', () => {
  describe('calculateSharedInterests', () => {
    it('returns empty array when no overlap', () => {
      const result = calculateSharedInterests(
        ['coffee', 'hiking'],
        ['bars', 'nightlife']
      );
      expect(result).toEqual([]);
    });

    it('returns shared items on partial overlap', () => {
      const result = calculateSharedInterests(
        ['coffee', 'hiking', 'dining'],
        ['hiking', 'bars', 'dining']
      );
      expect(result).toEqual(['hiking', 'dining']);
    });

    it('returns all items on full overlap', () => {
      const result = calculateSharedInterests(
        ['coffee', 'hiking'],
        ['coffee', 'hiking']
      );
      expect(result).toEqual(['coffee', 'hiking']);
    });

    it('handles empty arrays', () => {
      expect(calculateSharedInterests([], ['coffee'])).toEqual([]);
      expect(calculateSharedInterests(['coffee'], [])).toEqual([]);
      expect(calculateSharedInterests([], [])).toEqual([]);
    });

    it('handles null/undefined inputs', () => {
      expect(calculateSharedInterests(null as any, ['coffee'])).toEqual([]);
      expect(calculateSharedInterests(['coffee'], null as any)).toEqual([]);
    });

    it('is case-insensitive', () => {
      const result = calculateSharedInterests(
        ['Coffee', 'HIKING'],
        ['coffee', 'hiking']
      );
      expect(result).toEqual(['Coffee', 'HIKING']);
    });
  });

  describe('mutual friends calculation logic', () => {
    /**
     * Mirrors calculateMutualFriends logic from friends-service.ts
     * Given two users' friend sets, count the intersection.
     */

    function countMutualFriends(
      userFriendIds: string[],
      currentUserFriendIds: string[]
    ): number {
      const userSet = new Set(userFriendIds);
      return currentUserFriendIds.filter(id => userSet.has(id)).length;
    }

    it('returns 0 when no overlap', () => {
      expect(countMutualFriends(['a', 'b'], ['c', 'd'])).toBe(0);
    });

    it('returns correct count for partial overlap', () => {
      expect(countMutualFriends(['a', 'b', 'c'], ['b', 'c', 'd'])).toBe(2);
    });

    it('returns correct count for full overlap', () => {
      expect(countMutualFriends(['a', 'b'], ['a', 'b'])).toBe(2);
    });

    it('returns 0 for empty arrays', () => {
      expect(countMutualFriends([], ['a'])).toBe(0);
      expect(countMutualFriends(['a'], [])).toBe(0);
    });
  });

  describe('loop score breakdown logic', () => {
    /**
     * Mirrors the score breakdown assembly in getFriendProfile
     */

    function assembleScoreBreakdown(counts: {
      tasksCompleted: number;
      recommendationsAccepted: number;
      feedbackGiven: number;
      groupActivitiesAttended: number;
      streakDays: number;
    }) {
      return {
        total:
          counts.tasksCompleted * 10 +
          counts.recommendationsAccepted * 5 +
          counts.feedbackGiven * 3 +
          counts.groupActivitiesAttended * 15 +
          counts.streakDays * 20,
        ...counts,
        streakBonus: counts.streakDays * 20,
      };
    }

    it('calculates total score correctly', () => {
      const result = assembleScoreBreakdown({
        tasksCompleted: 5,
        recommendationsAccepted: 10,
        feedbackGiven: 3,
        groupActivitiesAttended: 2,
        streakDays: 7,
      });
      // 5*10 + 10*5 + 3*3 + 2*15 + 7*20 = 50 + 50 + 9 + 30 + 140 = 279
      expect(result.total).toBe(279);
      expect(result.streakBonus).toBe(140);
    });

    it('handles all zeros', () => {
      const result = assembleScoreBreakdown({
        tasksCompleted: 0,
        recommendationsAccepted: 0,
        feedbackGiven: 0,
        groupActivitiesAttended: 0,
        streakDays: 0,
      });
      expect(result.total).toBe(0);
      expect(result.streakBonus).toBe(0);
    });
  });

  describe('in-memory mutual friends for getFriends batch', () => {
    /**
     * Mirrors the batch mutual friend calculation in getFriends()
     * Build friendFriendsMap, then compute overlap with currentUserFriendIds
     */

    it('computes mutual friends in batch correctly', () => {
      // Current user's friends: Alice, Bob, Charlie
      const currentUserFriendIds = new Set(['alice', 'bob', 'charlie']);
      const currentUserId = 'me';

      // Alice's friends: Bob, Charlie, Dave
      // Bob's friends: Alice, Eve
      const friendsOfFriends = [
        { user_id: 'alice', friend_id: 'bob' },
        { user_id: 'alice', friend_id: 'charlie' },
        { user_id: 'alice', friend_id: 'dave' },
        { user_id: 'bob', friend_id: 'alice' },
        { user_id: 'bob', friend_id: 'eve' },
      ];

      // Build map
      const friendFriendsMap = new Map<string, Set<string>>();
      for (const fof of friendsOfFriends) {
        if (!friendFriendsMap.has(fof.user_id)) {
          friendFriendsMap.set(fof.user_id, new Set());
        }
        friendFriendsMap.get(fof.user_id)!.add(fof.friend_id);
      }

      // Alice's mutual friends with current user (excluding current user)
      const aliceFriends = friendFriendsMap.get('alice') || new Set();
      const aliceMutual = [...aliceFriends].filter(
        id => currentUserFriendIds.has(id) && id !== currentUserId
      ).length;
      // Alice knows Bob and Charlie who are also our friends = 2
      expect(aliceMutual).toBe(2);

      // Bob's mutual friends with current user
      const bobFriends = friendFriendsMap.get('bob') || new Set();
      const bobMutual = [...bobFriends].filter(
        id => currentUserFriendIds.has(id) && id !== currentUserId
      ).length;
      // Bob knows Alice who is also our friend = 1
      expect(bobMutual).toBe(1);

      // Charlie has no friends-of-friends data
      const charlieFriends = friendFriendsMap.get('charlie') || new Set();
      const charlieMutual = [...charlieFriends].filter(
        id => currentUserFriendIds.has(id) && id !== currentUserId
      ).length;
      expect(charlieMutual).toBe(0);
    });
  });
});
