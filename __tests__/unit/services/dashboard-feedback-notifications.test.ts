/**
 * Tests for Dashboard Aggregator - Feedback Reminder Notifications
 *
 * Tests the pure logic for creating feedback reminder notifications
 * and computing pending feedback counts, matching the logic in
 * services/dashboard-aggregator.ts (fetchPendingFeedbackNotifications,
 * getPendingFeedbackNotificationCount).
 */

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  },
}));

interface CompletedActivity {
  eventId: string;
  activityId: string | null;
  activityName: string;
  activityCategory: string;
  completedAt: string;
  recommendationId: string | null;
  place?: {
    id: string;
    name: string;
    address?: string;
  };
}

interface FeedbackNotification {
  id: string;
  user_id: string;
  notification_type: 'feedback_reminder';
  priority: 'attention';
  title: string;
  message: string;
  data: Record<string, any>;
  action_button_text: string;
  action_deep_link: undefined;
  related_event_id: string;
  is_read: boolean;
  is_dismissed: boolean;
  is_actioned: boolean;
  created_at: string;
}

/**
 * Mirrors the logic from dashboard-aggregator.ts fetchPendingFeedbackNotifications
 */
function buildFeedbackNotifications(
  completed: CompletedActivity[],
  past: CompletedActivity[],
  userId: string
): FeedbackNotification[] {
  // Deduplicate by eventId (completed events may overlap with past events)
  const seenIds = new Set(completed.map(a => a.eventId));
  const uniquePast = past.filter(a => !seenIds.has(a.eventId));
  const allPending = [...completed, ...uniquePast];

  return allPending.map((activity) => ({
    id: `feedback-${activity.eventId}`,
    user_id: userId,
    notification_type: 'feedback_reminder' as const,
    priority: 'attention' as const,
    title: `How was ${activity.activityName}?`,
    message: 'Tap to rate your experience and help Loop learn your preferences.',
    data: {
      eventId: activity.eventId,
      activityId: activity.activityId,
      activityName: activity.activityName,
      activityCategory: activity.activityCategory,
      completedAt: activity.completedAt,
      place: activity.place,
    },
    action_button_text: 'Rate',
    action_deep_link: undefined,
    related_event_id: activity.eventId,
    is_read: false,
    is_dismissed: false,
    is_actioned: false,
    created_at: activity.completedAt,
  }));
}

/**
 * Mirrors the deduplication count logic from getPendingFeedbackNotificationCount
 */
function computePendingFeedbackCount(
  completed: CompletedActivity[],
  past: CompletedActivity[]
): number {
  const seenIds = new Set(completed.map(a => a.eventId));
  const uniquePast = past.filter(a => !seenIds.has(a.eventId));
  return completed.length + uniquePast.length;
}

function createMockActivity(overrides: Partial<CompletedActivity> = {}): CompletedActivity {
  return {
    eventId: `event-${Math.random().toString(36).substr(2, 6)}`,
    activityId: null,
    activityName: 'Test Activity',
    activityCategory: 'other',
    completedAt: new Date().toISOString(),
    recommendationId: null,
    ...overrides,
  };
}

describe('Dashboard Feedback Notifications', () => {
  describe('buildFeedbackNotifications', () => {
    it('should return empty array when no pending activities', () => {
      const result = buildFeedbackNotifications([], [], 'user-1');
      expect(result).toEqual([]);
    });

    it('should create one notification per completed activity', () => {
      const completed = [
        createMockActivity({ eventId: 'e1', activityName: 'Coffee at Houndstooth' }),
        createMockActivity({ eventId: 'e2', activityName: 'Katy Trail Run' }),
      ];

      const result = buildFeedbackNotifications(completed, [], 'user-1');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('feedback-e1');
      expect(result[1].id).toBe('feedback-e2');
    });

    it('should create notifications from past events', () => {
      const past = [
        createMockActivity({ eventId: 'p1', activityName: 'Deep Ellum Arts' }),
      ];

      const result = buildFeedbackNotifications([], past, 'user-1');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('How was Deep Ellum Arts?');
    });

    it('should deduplicate events that appear in both completed and past', () => {
      const sharedEventId = 'shared-event';
      const completed = [
        createMockActivity({ eventId: sharedEventId, activityName: 'Overlapping Event' }),
      ];
      const past = [
        createMockActivity({ eventId: sharedEventId, activityName: 'Overlapping Event' }),
        createMockActivity({ eventId: 'unique-past', activityName: 'Unique Past Event' }),
      ];

      const result = buildFeedbackNotifications(completed, past, 'user-1');
      expect(result).toHaveLength(2);
      expect(result.map(n => n.id)).toContain('feedback-shared-event');
      expect(result.map(n => n.id)).toContain('feedback-unique-past');
    });

    it('should set notification_type to feedback_reminder for all', () => {
      const completed = [createMockActivity()];
      const result = buildFeedbackNotifications(completed, [], 'user-1');
      expect(result.every(n => n.notification_type === 'feedback_reminder')).toBe(true);
    });

    it('should set priority to attention for all', () => {
      const completed = [createMockActivity()];
      const result = buildFeedbackNotifications(completed, [], 'user-1');
      expect(result.every(n => n.priority === 'attention')).toBe(true);
    });

    it('should format title as "How was [name]?"', () => {
      const completed = [createMockActivity({ activityName: 'Pecan Lodge BBQ' })];
      const result = buildFeedbackNotifications(completed, [], 'user-1');
      expect(result[0].title).toBe('How was Pecan Lodge BBQ?');
    });

    it('should include Rate as action button text', () => {
      const completed = [createMockActivity()];
      const result = buildFeedbackNotifications(completed, [], 'user-1');
      expect(result[0].action_button_text).toBe('Rate');
    });

    it('should embed all activity data for the feedback callback', () => {
      const completedAt = '2026-02-17T20:00:00.000Z';
      const place = { id: 'place-1', name: 'Test Place', address: '123 Elm St' };

      const completed = [createMockActivity({
        eventId: 'evt-1',
        activityId: 'act-1',
        activityName: 'Yoga Studio',
        activityCategory: 'fitness',
        completedAt,
        place,
      })];

      const result = buildFeedbackNotifications(completed, [], 'user-1');
      expect(result[0].data).toEqual({
        eventId: 'evt-1',
        activityId: 'act-1',
        activityName: 'Yoga Studio',
        activityCategory: 'fitness',
        completedAt,
        place,
      });
    });

    it('should handle activity without place data', () => {
      const completed = [createMockActivity({
        activityName: 'Walk in the Park',
        place: undefined,
      })];

      const result = buildFeedbackNotifications(completed, [], 'user-1');
      expect(result[0].data.place).toBeUndefined();
    });

    it('should set user_id on all notifications', () => {
      const completed = [createMockActivity(), createMockActivity()];
      const result = buildFeedbackNotifications(completed, [], 'user-42');
      expect(result.every(n => n.user_id === 'user-42')).toBe(true);
    });

    it('should set is_read, is_dismissed, is_actioned to false', () => {
      const completed = [createMockActivity()];
      const result = buildFeedbackNotifications(completed, [], 'user-1');
      expect(result[0].is_read).toBe(false);
      expect(result[0].is_dismissed).toBe(false);
      expect(result[0].is_actioned).toBe(false);
    });

    it('should use completedAt as created_at for time grouping', () => {
      const completedAt = '2026-02-16T10:00:00.000Z';
      const completed = [createMockActivity({ completedAt })];
      const result = buildFeedbackNotifications(completed, [], 'user-1');
      expect(result[0].created_at).toBe(completedAt);
    });

    it('should have IDs that start with feedback- prefix', () => {
      const completed = [
        createMockActivity({ eventId: 'abc' }),
        createMockActivity({ eventId: 'def' }),
      ];
      const past = [createMockActivity({ eventId: 'ghi' })];

      const result = buildFeedbackNotifications(completed, past, 'user-1');
      expect(result.every(n => n.id.startsWith('feedback-'))).toBe(true);
    });

    it('should place completed events before unique past events', () => {
      const completed = [createMockActivity({ eventId: 'completed-1' })];
      const past = [createMockActivity({ eventId: 'past-1' })];

      const result = buildFeedbackNotifications(completed, past, 'user-1');
      expect(result[0].id).toBe('feedback-completed-1');
      expect(result[1].id).toBe('feedback-past-1');
    });
  });

  describe('computePendingFeedbackCount', () => {
    it('should return 0 for no activities', () => {
      expect(computePendingFeedbackCount([], [])).toBe(0);
    });

    it('should count completed activities', () => {
      const completed = [createMockActivity(), createMockActivity()];
      expect(computePendingFeedbackCount(completed, [])).toBe(2);
    });

    it('should count past activities', () => {
      const past = [createMockActivity(), createMockActivity(), createMockActivity()];
      expect(computePendingFeedbackCount([], past)).toBe(3);
    });

    it('should deduplicate overlapping events', () => {
      const completed = [
        createMockActivity({ eventId: 'shared-1' }),
        createMockActivity({ eventId: 'unique-completed' }),
      ];
      const past = [
        createMockActivity({ eventId: 'shared-1' }),
        createMockActivity({ eventId: 'unique-past' }),
      ];

      expect(computePendingFeedbackCount(completed, past)).toBe(3);
    });

    it('should handle all events overlapping', () => {
      const completed = [
        createMockActivity({ eventId: 'e1' }),
        createMockActivity({ eventId: 'e2' }),
      ];
      const past = [
        createMockActivity({ eventId: 'e1' }),
        createMockActivity({ eventId: 'e2' }),
      ];

      expect(computePendingFeedbackCount(completed, past)).toBe(2);
    });
  });

  describe('Badge count integration', () => {
    it('should combine DB notification count with feedback count for badge', () => {
      // Mirrors the logic in index.tsx checkDashboardStatus:
      // setNotificationCount(dbCount + feedbackCount)
      const dbNotificationCount = 3;
      const feedbackCount = computePendingFeedbackCount(
        [createMockActivity()],
        [createMockActivity(), createMockActivity()],
      );

      const totalBadgeCount = dbNotificationCount + feedbackCount;
      expect(totalBadgeCount).toBe(6); // 3 DB + 3 feedback
    });

    it('should show 0 badge when no notifications and no feedback', () => {
      const dbNotificationCount = 0;
      const feedbackCount = computePendingFeedbackCount([], []);

      const totalBadgeCount = dbNotificationCount + feedbackCount;
      expect(totalBadgeCount).toBe(0);
    });

    it('should show feedback-only badge when no DB notifications', () => {
      const dbNotificationCount = 0;
      const feedbackCount = computePendingFeedbackCount(
        [createMockActivity()],
        [],
      );

      const totalBadgeCount = dbNotificationCount + feedbackCount;
      expect(totalBadgeCount).toBe(1);
    });
  });
});
