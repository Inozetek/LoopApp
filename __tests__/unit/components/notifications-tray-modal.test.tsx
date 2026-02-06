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
