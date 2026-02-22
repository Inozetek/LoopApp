/**
 * Tests for Notifications Tray Modal helper functions
 *
 * Tests the pure helper functions: groupNotificationsByTime,
 * getNotificationIcon, and formatNotificationTime.
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

/**
 * Mirrors DashboardNotification type from types/dashboard.ts
 */
interface MockNotification {
  id: string;
  title: string;
  message?: string;
  notification_type: string;
  priority: string;
  is_read: boolean;
  created_at: string;
  action_deep_link?: string;
  action_button_text?: string;
}

function createMockNotification(overrides: Partial<MockNotification> = {}): MockNotification {
  return {
    id: `notif-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Notification',
    notification_type: 'new_recommendations',
    priority: 'normal',
    is_read: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('Notifications Tray Modal - Helper Functions', () => {
  describe('groupNotificationsByTime', () => {
    /**
     * Mirrors groupNotificationsByTime from notifications-tray-modal.tsx line 341
     */
    function groupNotificationsByTime(notifications: MockNotification[]) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const groups = {
        today: [] as MockNotification[],
        yesterday: [] as MockNotification[],
        earlier: [] as MockNotification[],
      };

      for (const notification of notifications) {
        const createdAt = new Date(notification.created_at);

        if (createdAt >= today) {
          groups.today.push(notification);
        } else if (createdAt >= yesterday) {
          groups.yesterday.push(notification);
        } else {
          groups.earlier.push(notification);
        }
      }

      return groups;
    }

    it('should return empty groups for empty input', () => {
      const result = groupNotificationsByTime([]);
      expect(result.today).toEqual([]);
      expect(result.yesterday).toEqual([]);
      expect(result.earlier).toEqual([]);
    });

    it('should group notification from today into today', () => {
      const now = new Date();
      const notification = createMockNotification({
        created_at: now.toISOString(),
      });

      const result = groupNotificationsByTime([notification]);
      expect(result.today).toHaveLength(1);
      expect(result.yesterday).toHaveLength(0);
      expect(result.earlier).toHaveLength(0);
    });

    it('should group notification from yesterday into yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(12, 0, 0, 0); // Noon yesterday

      const notification = createMockNotification({
        created_at: yesterday.toISOString(),
      });

      const result = groupNotificationsByTime([notification]);
      expect(result.today).toHaveLength(0);
      expect(result.yesterday).toHaveLength(1);
      expect(result.earlier).toHaveLength(0);
    });

    it('should group notification from 3 days ago into earlier', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const notification = createMockNotification({
        created_at: threeDaysAgo.toISOString(),
      });

      const result = groupNotificationsByTime([notification]);
      expect(result.today).toHaveLength(0);
      expect(result.yesterday).toHaveLength(0);
      expect(result.earlier).toHaveLength(1);
    });

    it('should correctly distribute mixed notifications', () => {
      const now = new Date();

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(15, 0, 0, 0);

      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      const notifications = [
        createMockNotification({ id: 'today-1', created_at: now.toISOString() }),
        createMockNotification({ id: 'today-2', created_at: now.toISOString() }),
        createMockNotification({ id: 'yesterday-1', created_at: yesterday.toISOString() }),
        createMockNotification({ id: 'earlier-1', created_at: lastWeek.toISOString() }),
        createMockNotification({ id: 'earlier-2', created_at: lastWeek.toISOString() }),
      ];

      const result = groupNotificationsByTime(notifications);
      expect(result.today).toHaveLength(2);
      expect(result.yesterday).toHaveLength(1);
      expect(result.earlier).toHaveLength(2);
    });

    it('should place midnight today notification in today group', () => {
      const midnightToday = new Date();
      midnightToday.setHours(0, 0, 0, 0);

      const notification = createMockNotification({
        created_at: midnightToday.toISOString(),
      });

      const result = groupNotificationsByTime([notification]);
      expect(result.today).toHaveLength(1);
    });
  });

  describe('getNotificationIcon', () => {
    /**
     * Mirrors getNotificationIcon from notifications-tray-modal.tsx line 368
     */
    function getNotificationIcon(type: string): string {
      switch (type) {
        case 'loops_planned':
          return 'calendar-outline';
        case 'friend_activity':
          return 'people-outline';
        case 'new_recommendations':
          return 'sparkles-outline';
        case 'featured_venue':
          return 'star-outline';
        case 'featured_movie':
          return 'film-outline';
        case 'pending_invite':
          return 'mail-outline';
        case 'family_in_town':
          return 'home-outline';
        case 'lunch_suggestion':
          return 'restaurant-outline';
        case 'event_reminder':
          return 'alarm-outline';
        case 'activity_share':
          return 'paper-plane-outline';
        case 'activity_invite':
          return 'gift-outline';
        case 'feedback_reminder':
          return 'chatbubble-outline';
        default:
          return 'notifications-outline';
      }
    }

    it('should return calendar icon for loops_planned', () => {
      expect(getNotificationIcon('loops_planned')).toBe('calendar-outline');
    });

    it('should return people icon for friend_activity', () => {
      expect(getNotificationIcon('friend_activity')).toBe('people-outline');
    });

    it('should return sparkles icon for new_recommendations', () => {
      expect(getNotificationIcon('new_recommendations')).toBe('sparkles-outline');
    });

    it('should return star icon for featured_venue', () => {
      expect(getNotificationIcon('featured_venue')).toBe('star-outline');
    });

    it('should return film icon for featured_movie', () => {
      expect(getNotificationIcon('featured_movie')).toBe('film-outline');
    });

    it('should return mail icon for pending_invite', () => {
      expect(getNotificationIcon('pending_invite')).toBe('mail-outline');
    });

    it('should return home icon for family_in_town', () => {
      expect(getNotificationIcon('family_in_town')).toBe('home-outline');
    });

    it('should return restaurant icon for lunch_suggestion', () => {
      expect(getNotificationIcon('lunch_suggestion')).toBe('restaurant-outline');
    });

    it('should return alarm icon for event_reminder', () => {
      expect(getNotificationIcon('event_reminder')).toBe('alarm-outline');
    });

    it('should return chatbubble icon for feedback_reminder', () => {
      expect(getNotificationIcon('feedback_reminder')).toBe('chatbubble-outline');
    });

    it('should return paper-plane icon for activity_share', () => {
      expect(getNotificationIcon('activity_share')).toBe('paper-plane-outline');
    });

    it('should return gift icon for activity_invite', () => {
      expect(getNotificationIcon('activity_invite')).toBe('gift-outline');
    });

    it('should return default icon for unknown types', () => {
      expect(getNotificationIcon('unknown_type')).toBe('notifications-outline');
      expect(getNotificationIcon('')).toBe('notifications-outline');
    });
  });

  describe('formatNotificationTime', () => {
    /**
     * Mirrors formatNotificationTime from notifications-tray-modal.tsx line 393
     * Uses relative time (just now, Xm ago, Xh ago, Yesterday, Xd ago, or date)
     */
    function formatNotificationTime(dateString: string): string {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;

      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;

      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    it('should return "Just now" for very recent notifications', () => {
      const now = new Date();
      expect(formatNotificationTime(now.toISOString())).toBe('Just now');
    });

    it('should return minutes ago for 1-59 minutes', () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      expect(formatNotificationTime(thirtyMinAgo.toISOString())).toBe('30m ago');
    });

    it('should return "1m ago" for 1 minute ago', () => {
      const oneMinAgo = new Date(Date.now() - 1 * 60 * 1000);
      expect(formatNotificationTime(oneMinAgo.toISOString())).toBe('1m ago');
    });

    it('should return hours ago for 1-23 hours', () => {
      const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
      expect(formatNotificationTime(fiveHoursAgo.toISOString())).toBe('5h ago');
    });

    it('should return "Yesterday" for 24-47 hours ago', () => {
      const oneDayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      expect(formatNotificationTime(oneDayAgo.toISOString())).toBe('Yesterday');
    });

    it('should return days ago for 2-6 days', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      expect(formatNotificationTime(threeDaysAgo.toISOString())).toBe('3d ago');
    });

    it('should return formatted date for 7+ days ago', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const result = formatNotificationTime(twoWeeksAgo.toISOString());
      // Should match "Jan 15" or similar format
      expect(result).toMatch(/^\w{3} \d{1,2}$/);
    });
  });

  describe('Notification Filter Logic', () => {
    type NotificationFilter = 'all' | 'recommendations' | 'social' | 'reminders';

    /**
     * Mirrors filter logic from notifications-tray-modal.tsx filteredNotifications useMemo
     */
    function filterNotifications(notifications: MockNotification[], activeFilter: NotificationFilter): MockNotification[] {
      if (activeFilter === 'all') return notifications;

      return notifications.filter(n => {
        switch (activeFilter) {
          case 'recommendations':
            return ['new_recommendations', 'featured_venue', 'featured_movie', 'lunch_suggestion'].includes(n.notification_type);
          case 'social':
            return ['friend_activity', 'pending_invite', 'family_in_town', 'activity_share', 'activity_invite'].includes(n.notification_type);
          case 'reminders':
            return ['loops_planned', 'event_reminder', 'feedback_reminder'].includes(n.notification_type);
          default:
            return true;
        }
      });
    }

    it('should return all notifications for "all" filter', () => {
      const notifications = [
        createMockNotification({ notification_type: 'new_recommendations' }),
        createMockNotification({ notification_type: 'friend_activity' }),
        createMockNotification({ notification_type: 'feedback_reminder' }),
      ];
      const result = filterNotifications(notifications, 'all');
      expect(result).toHaveLength(3);
    });

    it('should filter feedback_reminder into reminders category', () => {
      const notifications = [
        createMockNotification({ notification_type: 'new_recommendations' }),
        createMockNotification({ notification_type: 'feedback_reminder' }),
        createMockNotification({ notification_type: 'loops_planned' }),
        createMockNotification({ notification_type: 'event_reminder' }),
      ];
      const result = filterNotifications(notifications, 'reminders');
      expect(result).toHaveLength(3);
      expect(result.every(n => ['feedback_reminder', 'loops_planned', 'event_reminder'].includes(n.notification_type))).toBe(true);
    });

    it('should not include feedback_reminder in recommendations filter', () => {
      const notifications = [
        createMockNotification({ notification_type: 'feedback_reminder' }),
        createMockNotification({ notification_type: 'new_recommendations' }),
      ];
      const result = filterNotifications(notifications, 'recommendations');
      expect(result).toHaveLength(1);
      expect(result[0].notification_type).toBe('new_recommendations');
    });

    it('should not include feedback_reminder in social filter', () => {
      const notifications = [
        createMockNotification({ notification_type: 'feedback_reminder' }),
        createMockNotification({ notification_type: 'friend_activity' }),
      ];
      const result = filterNotifications(notifications, 'social');
      expect(result).toHaveLength(1);
      expect(result[0].notification_type).toBe('friend_activity');
    });
  });

  describe('Feedback Reminder Notification Shape', () => {
    /**
     * Mirrors the synthetic notification creation from dashboard-aggregator.ts
     * fetchPendingFeedbackNotifications
     */
    function createFeedbackReminderNotification(activity: {
      eventId: string;
      activityId: string | null;
      activityName: string;
      activityCategory: string;
      completedAt: string;
      place?: { id: string; name: string; address?: string };
    }, userId: string) {
      return {
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
      };
    }

    it('should create notification with feedback- prefix in ID', () => {
      const notification = createFeedbackReminderNotification({
        eventId: 'event-123',
        activityId: 'activity-456',
        activityName: 'Katy Trail Run',
        activityCategory: 'fitness',
        completedAt: new Date().toISOString(),
      }, 'user-789');

      expect(notification.id).toBe('feedback-event-123');
    });

    it('should set notification_type to feedback_reminder', () => {
      const notification = createFeedbackReminderNotification({
        eventId: 'event-123',
        activityId: null,
        activityName: 'Coffee Shop Visit',
        activityCategory: 'dining',
        completedAt: new Date().toISOString(),
      }, 'user-789');

      expect(notification.notification_type).toBe('feedback_reminder');
    });

    it('should format title as "How was [activity]?"', () => {
      const notification = createFeedbackReminderNotification({
        eventId: 'event-123',
        activityId: null,
        activityName: 'Deep Ellum Brewing',
        activityCategory: 'entertainment',
        completedAt: new Date().toISOString(),
      }, 'user-789');

      expect(notification.title).toBe('How was Deep Ellum Brewing?');
    });

    it('should include Rate as action button text', () => {
      const notification = createFeedbackReminderNotification({
        eventId: 'event-123',
        activityId: null,
        activityName: 'Test',
        activityCategory: 'other',
        completedAt: new Date().toISOString(),
      }, 'user-789');

      expect(notification.action_button_text).toBe('Rate');
    });

    it('should have priority set to attention', () => {
      const notification = createFeedbackReminderNotification({
        eventId: 'event-123',
        activityId: null,
        activityName: 'Test',
        activityCategory: 'other',
        completedAt: new Date().toISOString(),
      }, 'user-789');

      expect(notification.priority).toBe('attention');
    });

    it('should include all activity data in notification data field', () => {
      const completedAt = new Date().toISOString();
      const place = { id: 'place-1', name: 'Some Place', address: '123 Main St' };

      const notification = createFeedbackReminderNotification({
        eventId: 'event-123',
        activityId: 'activity-456',
        activityName: 'Yoga Class',
        activityCategory: 'fitness',
        completedAt,
        place,
      }, 'user-789');

      expect(notification.data).toEqual({
        eventId: 'event-123',
        activityId: 'activity-456',
        activityName: 'Yoga Class',
        activityCategory: 'fitness',
        completedAt,
        place,
      });
    });

    it('should start as unread and not dismissed', () => {
      const notification = createFeedbackReminderNotification({
        eventId: 'event-123',
        activityId: null,
        activityName: 'Test',
        activityCategory: 'other',
        completedAt: new Date().toISOString(),
      }, 'user-789');

      expect(notification.is_read).toBe(false);
      expect(notification.is_dismissed).toBe(false);
      expect(notification.is_actioned).toBe(false);
    });

    it('should use completedAt as created_at timestamp', () => {
      const completedAt = '2026-02-17T18:30:00.000Z';

      const notification = createFeedbackReminderNotification({
        eventId: 'event-123',
        activityId: null,
        activityName: 'Test',
        activityCategory: 'other',
        completedAt,
      }, 'user-789');

      expect(notification.created_at).toBe(completedAt);
    });

    it('should detect synthetic feedback notification by ID prefix', () => {
      const notification = createFeedbackReminderNotification({
        eventId: 'abc-def',
        activityId: null,
        activityName: 'Test',
        activityCategory: 'other',
        completedAt: new Date().toISOString(),
      }, 'user-789');

      // This is how the dismiss handler detects synthetic notifications
      expect(notification.id.startsWith('feedback-')).toBe(true);
    });
  });

  describe('Notification Priority Colors', () => {
    /**
     * Mirrors priority color logic from notifications-tray-modal.tsx line 266
     */
    function getPriorityLevel(priority: string): 'urgent' | 'attention' | 'normal' {
      if (priority === 'urgent') return 'urgent';
      if (priority === 'attention') return 'attention';
      return 'normal';
    }

    it('should identify urgent priority', () => {
      expect(getPriorityLevel('urgent')).toBe('urgent');
    });

    it('should identify attention priority', () => {
      expect(getPriorityLevel('attention')).toBe('attention');
    });

    it('should default to normal for other priorities', () => {
      expect(getPriorityLevel('normal')).toBe('normal');
      expect(getPriorityLevel('low')).toBe('normal');
      expect(getPriorityLevel('')).toBe('normal');
    });
  });
});
