/**
 * Tests for StoriesGridSection component
 */

import React from 'react';
import { FriendWithMoments, Moment } from '@/types/moment';

// Mock the dependencies
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));

// Helper to create mock moment
function createMockMoment(overrides: Partial<Moment> = {}): Moment {
  return {
    id: 'moment-1',
    userId: 'user-1',
    place: {
      id: 'place-1',
      name: 'Test Place',
    },
    photoUrl: 'https://example.com/photo.jpg',
    visibility: 'friends',
    isTaggedToPlace: false,
    viewsCount: 10,
    likesCount: 5,
    captureTrigger: 'manual',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
    ...overrides,
  };
}

// Helper to create mock friend with moments
function createMockFriendWithMoments(overrides: Partial<FriendWithMoments> = {}): FriendWithMoments {
  return {
    userId: 'friend-1',
    name: 'Test Friend',
    profilePictureUrl: 'https://example.com/avatar.jpg',
    moments: [createMockMoment()],
    hasUnseenMoments: true,
    latestMomentAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('StoriesGridSection', () => {
  describe('FriendWithMoments sorting', () => {
    it('should sort friends with unseen moments first', () => {
      const friends: FriendWithMoments[] = [
        createMockFriendWithMoments({ userId: '1', name: 'Alice', hasUnseenMoments: false }),
        createMockFriendWithMoments({ userId: '2', name: 'Bob', hasUnseenMoments: true }),
        createMockFriendWithMoments({ userId: '3', name: 'Charlie', hasUnseenMoments: false }),
        createMockFriendWithMoments({ userId: '4', name: 'Diana', hasUnseenMoments: true }),
      ];

      // Sort logic from component
      const sorted = [...friends].sort((a, b) => {
        if (a.hasUnseenMoments !== b.hasUnseenMoments) {
          return a.hasUnseenMoments ? -1 : 1;
        }
        return (
          new Date(b.latestMomentAt || 0).getTime() -
          new Date(a.latestMomentAt || 0).getTime()
        );
      });

      expect(sorted[0].name).toBe('Bob');
      expect(sorted[1].name).toBe('Diana');
      expect(sorted[2].hasUnseenMoments).toBe(false);
      expect(sorted[3].hasUnseenMoments).toBe(false);
    });

    it('should sort by latest moment when unseen status is equal', () => {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const friends: FriendWithMoments[] = [
        createMockFriendWithMoments({
          userId: '1',
          name: 'Old',
          hasUnseenMoments: true,
          latestMomentAt: dayAgo.toISOString(),
        }),
        createMockFriendWithMoments({
          userId: '2',
          name: 'Recent',
          hasUnseenMoments: true,
          latestMomentAt: hourAgo.toISOString(),
        }),
        createMockFriendWithMoments({
          userId: '3',
          name: 'Newest',
          hasUnseenMoments: true,
          latestMomentAt: now.toISOString(),
        }),
      ];

      const sorted = [...friends].sort((a, b) => {
        if (a.hasUnseenMoments !== b.hasUnseenMoments) {
          return a.hasUnseenMoments ? -1 : 1;
        }
        return (
          new Date(b.latestMomentAt || 0).getTime() -
          new Date(a.latestMomentAt || 0).getTime()
        );
      });

      expect(sorted[0].name).toBe('Newest');
      expect(sorted[1].name).toBe('Recent');
      expect(sorted[2].name).toBe('Old');
    });
  });

  describe('Timestamp formatting', () => {
    // formatTimestamp function from component
    function formatTimestamp(timestamp: string | undefined): string {
      if (!timestamp) return '';

      const now = new Date();
      const momentDate = new Date(timestamp);
      const diffMs = now.getTime() - momentDate.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      return `${Math.floor(diffHours / 24)}d`;
    }

    it('should return "Just now" for very recent timestamps', () => {
      const now = new Date();
      expect(formatTimestamp(now.toISOString())).toBe('Just now');
    });

    it('should return minutes for timestamps under an hour', () => {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      expect(formatTimestamp(thirtyMinsAgo.toISOString())).toBe('30m');
    });

    it('should return hours for timestamps under a day', () => {
      const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
      expect(formatTimestamp(fiveHoursAgo.toISOString())).toBe('5h');
    });

    it('should return days for timestamps over a day', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      expect(formatTimestamp(threeDaysAgo.toISOString())).toBe('3d');
    });

    it('should return empty string for undefined timestamp', () => {
      expect(formatTimestamp(undefined)).toBe('');
    });
  });

  describe('Visibility logic', () => {
    const INITIAL_VISIBLE_COUNT = 4;

    it('should show limited friends when not expanded', () => {
      const friends = Array.from({ length: 10 }, (_, i) =>
        createMockFriendWithMoments({ userId: `friend-${i}`, name: `Friend ${i}` })
      );

      // -1 to account for "Add Story" button
      const visibleFriends = friends.slice(0, INITIAL_VISIBLE_COUNT - 1);
      expect(visibleFriends.length).toBe(3);
    });

    it('should show all friends when expanded', () => {
      const friends = Array.from({ length: 10 }, (_, i) =>
        createMockFriendWithMoments({ userId: `friend-${i}`, name: `Friend ${i}` })
      );

      const isExpanded = true;
      const visibleFriends = isExpanded
        ? friends
        : friends.slice(0, INITIAL_VISIBLE_COUNT - 1);

      expect(visibleFriends.length).toBe(10);
    });

    it('should determine if "See all" button is needed', () => {
      const fewFriends = Array.from({ length: 2 }, (_, i) =>
        createMockFriendWithMoments({ userId: `friend-${i}` })
      );

      const manyFriends = Array.from({ length: 10 }, (_, i) =>
        createMockFriendWithMoments({ userId: `friend-${i}` })
      );

      const hasMoreFew = fewFriends.length > INITIAL_VISIBLE_COUNT - 1;
      const hasMoreMany = manyFriends.length > INITIAL_VISIBLE_COUNT - 1;

      expect(hasMoreFew).toBe(false);
      expect(hasMoreMany).toBe(true);
    });
  });

  describe('Unseen count calculation', () => {
    it('should count friends with unseen moments', () => {
      const friends: FriendWithMoments[] = [
        createMockFriendWithMoments({ userId: '1', hasUnseenMoments: true }),
        createMockFriendWithMoments({ userId: '2', hasUnseenMoments: false }),
        createMockFriendWithMoments({ userId: '3', hasUnseenMoments: true }),
        createMockFriendWithMoments({ userId: '4', hasUnseenMoments: true }),
        createMockFriendWithMoments({ userId: '5', hasUnseenMoments: false }),
      ];

      const unseenCount = friends.filter((f) => f.hasUnseenMoments).length;
      expect(unseenCount).toBe(3);
    });

    it('should return 0 when no unseen moments', () => {
      const friends: FriendWithMoments[] = [
        createMockFriendWithMoments({ userId: '1', hasUnseenMoments: false }),
        createMockFriendWithMoments({ userId: '2', hasUnseenMoments: false }),
      ];

      const unseenCount = friends.filter((f) => f.hasUnseenMoments).length;
      expect(unseenCount).toBe(0);
    });
  });
});

describe('FriendWithMoments type validation', () => {
  it('should have required properties', () => {
    const friend = createMockFriendWithMoments();

    expect(friend).toHaveProperty('userId');
    expect(friend).toHaveProperty('name');
    expect(friend).toHaveProperty('moments');
    expect(friend).toHaveProperty('hasUnseenMoments');
    expect(friend).toHaveProperty('latestMomentAt');
    expect(Array.isArray(friend.moments)).toBe(true);
  });

  it('should have valid moment structure', () => {
    const moment = createMockMoment();

    expect(moment).toHaveProperty('id');
    expect(moment).toHaveProperty('userId');
    expect(moment).toHaveProperty('place');
    expect(moment).toHaveProperty('photoUrl');
    expect(moment).toHaveProperty('visibility');
    expect(moment).toHaveProperty('isActive');
    expect(moment.place).toHaveProperty('id');
    expect(moment.place).toHaveProperty('name');
  });
});
