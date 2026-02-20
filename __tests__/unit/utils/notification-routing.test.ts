/**
 * Tests for notification routing utility
 *
 * Covers:
 * - computeTabBadges() with various notification combos
 * - Routing map completeness (every NotificationType has a route)
 * - Badge priority (count supersedes dot)
 * - Synthetic inputs (feedback, high-match, new recs)
 */

import {
  NOTIFICATION_ROUTES,
  computeTabBadges,
  getNotificationRoute,
  type BadgeInputs,
  type TabBadges,
  type NotificationRoute,
} from '@/utils/notification-routing';
import type { NotificationType, DashboardNotification } from '@/types/dashboard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal notification-like object for testing */
function makeNotification(
  type: NotificationType,
  overrides: Partial<Pick<DashboardNotification, 'is_read' | 'is_dismissed'>> = {},
): Pick<DashboardNotification, 'notification_type' | 'is_read' | 'is_dismissed'> {
  return {
    notification_type: type,
    is_read: false,
    is_dismissed: false,
    ...overrides,
  };
}

function emptyInputs(): BadgeInputs {
  return { notifications: [] };
}

// ---------------------------------------------------------------------------
// Routing Map Completeness
// ---------------------------------------------------------------------------

describe('NOTIFICATION_ROUTES', () => {
  const ALL_TYPES: NotificationType[] = [
    'loops_planned',
    'friend_activity',
    'new_recommendations',
    'featured_venue',
    'featured_movie',
    'pending_invite',
    'family_in_town',
    'lunch_suggestion',
    'event_reminder',
    'activity_share',
    'activity_invite',
    'feedback_reminder',
    'friend_request',
    'radar_alert',
    'high_match',
    'loop_score_milestone',
    'comment_reply',
    'other',
  ];

  it('has a route for every NotificationType', () => {
    for (const type of ALL_TYPES) {
      expect(NOTIFICATION_ROUTES[type]).toBeDefined();
      expect(NOTIFICATION_ROUTES[type]).toHaveProperty('tab');
      expect(NOTIFICATION_ROUTES[type]).toHaveProperty('badgeEffect');
    }
  });

  it('route badgeEffect is always count, dot, or none', () => {
    for (const [, route] of Object.entries(NOTIFICATION_ROUTES)) {
      expect(['count', 'dot', 'none']).toContain(route.badgeEffect);
    }
  });

  it('routes with tab=null always have badgeEffect=none', () => {
    for (const [, route] of Object.entries(NOTIFICATION_ROUTES)) {
      if (route.tab === null) {
        expect(route.badgeEffect).toBe('none');
      }
    }
  });
});

describe('getNotificationRoute', () => {
  it('returns the correct route for a known type', () => {
    expect(getNotificationRoute('feedback_reminder')).toEqual({ tab: 'calendar', badgeEffect: 'count' });
    expect(getNotificationRoute('friend_request')).toEqual({ tab: 'friends', badgeEffect: 'count' });
  });

  it('returns null-tab/none for unknown types', () => {
    // 'other' is the catch-all
    expect(getNotificationRoute('other')).toEqual({ tab: null, badgeEffect: 'none' });
  });
});

// ---------------------------------------------------------------------------
// Tab Routing (which type goes to which tab)
// ---------------------------------------------------------------------------

describe('notification routing table', () => {
  it('routes feedback_reminder to calendar (My Loop)', () => {
    expect(NOTIFICATION_ROUTES.feedback_reminder.tab).toBe('calendar');
  });

  it('routes pending_invite and activity_invite to recommendations (For You)', () => {
    expect(NOTIFICATION_ROUTES.pending_invite.tab).toBe('recommendations');
    expect(NOTIFICATION_ROUTES.activity_invite.tab).toBe('recommendations');
  });

  it('routes high_match, new_recommendations, radar_alert to recommendations (For You)', () => {
    expect(NOTIFICATION_ROUTES.high_match.tab).toBe('recommendations');
    expect(NOTIFICATION_ROUTES.new_recommendations.tab).toBe('recommendations');
    expect(NOTIFICATION_ROUTES.radar_alert.tab).toBe('recommendations');
  });

  it('routes friend_request to friends (Social)', () => {
    expect(NOTIFICATION_ROUTES.friend_request.tab).toBe('friends');
  });

  it('routes friend_activity and activity_share to friends (Social)', () => {
    expect(NOTIFICATION_ROUTES.friend_activity.tab).toBe('friends');
    expect(NOTIFICATION_ROUTES.activity_share.tab).toBe('friends');
  });

  it('routes loop_score_milestone to profile', () => {
    expect(NOTIFICATION_ROUTES.loop_score_milestone.tab).toBe('profile');
  });

  it('routes editorial/push-only types to null (no tab badge)', () => {
    const noTabTypes: NotificationType[] = [
      'loops_planned', 'event_reminder', 'featured_venue',
      'featured_movie', 'lunch_suggestion', 'family_in_town',
      'comment_reply', 'other',
    ];
    for (const type of noTabTypes) {
      expect(NOTIFICATION_ROUTES[type].tab).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// computeTabBadges
// ---------------------------------------------------------------------------

describe('computeTabBadges', () => {
  it('returns empty badges for no inputs', () => {
    const badges = computeTabBadges(emptyInputs());
    expect(badges.calendar).toEqual({ count: 0, dot: false });
    expect(badges.recommendations).toEqual({ count: 0, dot: false });
    expect(badges.friends).toEqual({ count: 0, dot: false });
    expect(badges.profile).toEqual({ count: 0, dot: false });
  });

  it('counts feedback_reminder as My Loop (calendar) count', () => {
    const badges = computeTabBadges({
      notifications: [makeNotification('feedback_reminder')],
    });
    expect(badges.calendar.count).toBe(1);
  });

  it('uses pendingFeedbackCount synthetic input for My Loop', () => {
    const badges = computeTabBadges({
      notifications: [],
      pendingFeedbackCount: 5,
    });
    expect(badges.calendar.count).toBe(5);
    expect(badges.calendar.dot).toBe(false);
  });

  it('combines DB feedback_reminder and synthetic pendingFeedbackCount', () => {
    const badges = computeTabBadges({
      notifications: [makeNotification('feedback_reminder')],
      pendingFeedbackCount: 3,
    });
    // 1 from DB notification + 3 synthetic
    expect(badges.calendar.count).toBe(4);
  });

  it('counts pending_invite as For You (recommendations) count', () => {
    const badges = computeTabBadges({
      notifications: [
        makeNotification('pending_invite'),
        makeNotification('pending_invite'),
      ],
    });
    expect(badges.recommendations.count).toBe(2);
  });

  it('sets dot for new_recommendations notification', () => {
    const badges = computeTabBadges({
      notifications: [makeNotification('new_recommendations')],
    });
    expect(badges.recommendations.dot).toBe(true);
    expect(badges.recommendations.count).toBe(0);
  });

  it('sets dot for high-match synthetic input', () => {
    const badges = computeTabBadges({
      notifications: [],
      hasHighMatchRec: true,
    });
    expect(badges.recommendations.dot).toBe(true);
  });

  it('sets dot for new recommendations synthetic input', () => {
    const badges = computeTabBadges({
      notifications: [],
      hasNewRecommendations: true,
    });
    expect(badges.recommendations.dot).toBe(true);
  });

  it('counts friend_request as Social (friends) count', () => {
    const badges = computeTabBadges({
      notifications: [
        makeNotification('friend_request'),
        makeNotification('friend_request'),
        makeNotification('friend_request'),
      ],
    });
    expect(badges.friends.count).toBe(3);
  });

  it('sets dot for friend_activity on Social tab', () => {
    const badges = computeTabBadges({
      notifications: [makeNotification('friend_activity')],
    });
    expect(badges.friends.dot).toBe(true);
    expect(badges.friends.count).toBe(0);
  });

  it('sets dot for loop_score_milestone on Profile tab', () => {
    const badges = computeTabBadges({
      notifications: [makeNotification('loop_score_milestone')],
    });
    expect(badges.profile.dot).toBe(true);
    expect(badges.profile.count).toBe(0);
  });

  it('skips dismissed notifications', () => {
    const badges = computeTabBadges({
      notifications: [
        makeNotification('friend_request', { is_dismissed: true }),
        makeNotification('pending_invite', { is_dismissed: true }),
      ],
    });
    expect(badges.friends.count).toBe(0);
    expect(badges.recommendations.count).toBe(0);
  });

  it('does not skip read (but non-dismissed) notifications', () => {
    const badges = computeTabBadges({
      notifications: [
        makeNotification('friend_request', { is_read: true }),
      ],
    });
    // Read but not dismissed — still counts
    expect(badges.friends.count).toBe(1);
  });

  it('ignores no-tab notification types', () => {
    const badges = computeTabBadges({
      notifications: [
        makeNotification('loops_planned'),
        makeNotification('event_reminder'),
        makeNotification('featured_venue'),
        makeNotification('comment_reply'),
      ],
    });
    // None should affect any tab
    expect(badges.calendar).toEqual({ count: 0, dot: false });
    expect(badges.recommendations).toEqual({ count: 0, dot: false });
    expect(badges.friends).toEqual({ count: 0, dot: false });
    expect(badges.profile).toEqual({ count: 0, dot: false });
  });
});

// ---------------------------------------------------------------------------
// Badge Priority (count supersedes dot)
// ---------------------------------------------------------------------------

describe('badge priority', () => {
  it('For You tab with invites AND new recs: count=2 and dot=true', () => {
    const badges = computeTabBadges({
      notifications: [
        makeNotification('pending_invite'),
        makeNotification('activity_invite'),
        makeNotification('new_recommendations'),
      ],
    });
    // Both are set — consumer decides rendering priority
    expect(badges.recommendations.count).toBe(2);
    expect(badges.recommendations.dot).toBe(true);
  });

  it('Social tab with friend_request AND friend_activity: count + dot', () => {
    const badges = computeTabBadges({
      notifications: [
        makeNotification('friend_request'),
        makeNotification('friend_activity'),
      ],
    });
    expect(badges.friends.count).toBe(1);
    expect(badges.friends.dot).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Complex Scenarios
// ---------------------------------------------------------------------------

describe('complex scenarios', () => {
  it('full realistic scenario with mixed notifications', () => {
    const badges = computeTabBadges({
      notifications: [
        // My Loop
        makeNotification('feedback_reminder'),
        // For You
        makeNotification('pending_invite'),
        makeNotification('radar_alert'),
        // Social
        makeNotification('friend_request'),
        makeNotification('friend_request'),
        makeNotification('activity_share'),
        // Profile
        makeNotification('loop_score_milestone'),
        // No-tab
        makeNotification('event_reminder'),
        makeNotification('comment_reply'),
      ],
      pendingFeedbackCount: 2,
      hasHighMatchRec: true,
    });

    // My Loop: 1 (DB feedback_reminder) + 2 (synthetic) = 3
    expect(badges.calendar.count).toBe(3);

    // For You: 1 invite (count) + radar_alert (dot) + high_match (synthetic dot)
    expect(badges.recommendations.count).toBe(1);
    expect(badges.recommendations.dot).toBe(true);

    // Social: 2 friend_requests (count) + activity_share (dot)
    expect(badges.friends.count).toBe(2);
    expect(badges.friends.dot).toBe(true);

    // Profile: loop_score_milestone (dot)
    expect(badges.profile.count).toBe(0);
    expect(badges.profile.dot).toBe(true);
  });

  it('all notifications dismissed results in empty badges', () => {
    const badges = computeTabBadges({
      notifications: [
        makeNotification('feedback_reminder', { is_dismissed: true }),
        makeNotification('friend_request', { is_dismissed: true }),
        makeNotification('pending_invite', { is_dismissed: true }),
      ],
    });
    expect(badges.calendar.count).toBe(0);
    expect(badges.recommendations.count).toBe(0);
    expect(badges.friends.count).toBe(0);
  });

  it('zero synthetic counts do not affect badges', () => {
    const badges = computeTabBadges({
      notifications: [],
      pendingFeedbackCount: 0,
      hasHighMatchRec: false,
      hasNewRecommendations: false,
    });
    expect(badges.calendar).toEqual({ count: 0, dot: false });
    expect(badges.recommendations).toEqual({ count: 0, dot: false });
  });
});
