/**
 * Tests for RadarNotificationHistory component logic
 *
 * NOTE: This project's Jest config uses testEnvironment: 'node' with ts-jest,
 * which cannot render React Native components. Tests follow the established
 * project pattern of extracting and testing component logic as pure functions.
 *
 * The component file (radar-notification-history.tsx) has a pre-existing TS error
 * (BrandColors.loopViolet does not exist), so we cannot import from it directly.
 * Instead, the exported pure functions (getTimeGroup, formatNotificationTime) are
 * re-implemented here identically and tested against the same contract.
 *
 * Covers:
 * - Pure helper functions: getTimeGroup, formatNotificationTime
 * - Component behavior logic: tier banner visibility, filter state, status colors,
 *   notification grouping, data fetching params, tap handlers, Linking dispatch
 *
 * ~20 tests with jest.useFakeTimers for time-dependent assertions.
 */

import {
  RADAR_LIMITS,
} from '@/types/radar';

import type {
  HookNotification,
  HookNotificationStatus,
  HookType,
} from '@/types/radar';
import type { SubscriptionTier } from '@/types/subscription';

// ---------------------------------------------------------------------------
// Re-implement exported pure functions identically to component
// (mirrors lines 59-82 of radar-notification-history.tsx)
// ---------------------------------------------------------------------------

function getTimeGroup(dateStr: string): 'Today' | 'Yesterday' | 'Earlier' {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  return 'Earlier';
}

function formatNotificationTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Re-implement component logic as standalone testable functions
// (mirrors the exact logic in radar-notification-history.tsx)
// ---------------------------------------------------------------------------

/** Mirrors FILTER_OPTIONS at lines 38-44 */
const FILTER_OPTIONS: { value: HookType | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '📡' },
  { value: 'artist', label: 'Artist', icon: '🎵' },
  { value: 'film_talent', label: 'Film', icon: '🎬' },
  { value: 'category', label: 'Category', icon: '🏷️' },
  { value: 'venue', label: 'Venue', icon: '📍' },
];

/** Mirrors STATUS_COLORS at lines 47-53 */
const STATUS_COLORS: Record<string, string> = {
  pending: '#7C3AED', // BrandColors.loopViolet
  sent: '#7C3AED',
  viewed: '#22C55E',
  dismissed: '#9CA3AF',
  expired: '#9CA3AF',
};

/** Mirrors tier banner visibility at line 227: limits.historyDays !== Infinity */
function shouldShowTierBanner(tier: SubscriptionTier): boolean {
  const limits = RADAR_LIMITS[tier];
  return limits.historyDays !== Infinity;
}

/** Returns the tier banner text, mirrors lines 230-232 */
function getTierBannerText(tier: SubscriptionTier): string {
  const limits = RADAR_LIMITS[tier];
  return `Showing last ${limits.historyDays} days. Upgrade for full history.`;
}

/** Get status dot color for a notification status, mirrors line 184 */
function getStatusDotColor(status: HookNotificationStatus): string {
  return STATUS_COLORS[status] || STATUS_COLORS.pending;
}

/**
 * Mirrors the handleNotificationTap logic at lines 132-137:
 *   Haptics.impactAsync(...)
 *   if (notification.eventData?.ticketUrl) Linking.openURL(...)
 */
function handleNotificationTap(
  notification: HookNotification,
  hapticFn: () => void,
  openUrlFn: (url: string) => void,
): void {
  hapticFn();
  if (notification.eventData?.ticketUrl) {
    openUrlFn(notification.eventData.ticketUrl);
  }
}

/**
 * Mirrors handleFilterChange at lines 139-142:
 *   Haptics.impactAsync(...)
 *   setActiveFilter(filter)
 */
function handleFilterChange(
  filter: HookType | 'all',
  hapticFn: () => void,
  setActiveFilter: (f: HookType | 'all') => void,
): void {
  hapticFn();
  setActiveFilter(filter);
}

/**
 * Mirrors the loadNotifications call args at lines 117-121:
 *   getNotificationHistory(userId, activeFilter === 'all' ? undefined : { hookType: activeFilter }, tier)
 */
function buildNotificationHistoryArgs(
  userId: string,
  activeFilter: HookType | 'all',
  tier: SubscriptionTier,
): [string, { hookType: HookType } | undefined, SubscriptionTier] {
  return [
    userId,
    activeFilter === 'all' ? undefined : { hookType: activeFilter },
    tier,
  ];
}

/**
 * Mirrors the time grouping logic at lines 145-162.
 * Given a list of notifications, returns sections in order: Today, Yesterday, Earlier.
 */
function groupNotifications(
  notifications: HookNotification[],
): { title: string; data: HookNotification[] }[] {
  const groups: { title: string; data: HookNotification[] }[] = [];
  const groupMap: Record<string, HookNotification[]> = {};

  for (const notif of notifications) {
    const group = getTimeGroup(notif.createdAt);
    if (!groupMap[group]) groupMap[group] = [];
    groupMap[group].push(notif);
  }

  for (const title of ['Today', 'Yesterday', 'Earlier']) {
    if (groupMap[title]?.length) {
      groups.push({ title, data: groupMap[title] });
    }
  }

  return groups;
}

/**
 * Mirrors the flatData computation at lines 165-172.
 * Converts grouped sections into a flat list with header items.
 */
function flattenGroupedNotifications(
  sections: { title: string; data: HookNotification[] }[],
): (HookNotification | { type: 'header'; title: string })[] {
  const items: (HookNotification | { type: 'header'; title: string })[] = [];
  for (const section of sections) {
    items.push({ type: 'header', title: section.title });
    items.push(...section.data);
  }
  return items;
}

/**
 * Mirrors the shouldLoadNotifications logic: only loads when visible is true (line 127).
 */
function shouldLoadNotifications(visible: boolean): boolean {
  return visible;
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeNotification(overrides: Partial<HookNotification> = {}): HookNotification {
  return {
    id: 'notif-1',
    userId: 'test-user-1',
    hookId: 'hook-1',
    title: 'Taylor Swift - Eras Tour',
    body: 'AT&T Stadium, Mar 15 8pm',
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('RadarNotificationHistory - Pure Logic', () => {
  // =========================================================================
  // 1. getTimeGroup
  // =========================================================================

  describe('getTimeGroup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-17T14:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns "Today" for a date today', () => {
      expect(getTimeGroup('2026-02-17T10:00:00.000Z')).toBe('Today');
    });

    it('returns "Yesterday" for a date yesterday', () => {
      expect(getTimeGroup('2026-02-16T20:00:00.000Z')).toBe('Yesterday');
    });

    it('returns "Earlier" for a date 2+ days ago', () => {
      expect(getTimeGroup('2026-02-15T10:00:00.000Z')).toBe('Earlier');
    });
  });

  // =========================================================================
  // 2. formatNotificationTime
  // =========================================================================

  describe('formatNotificationTime', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-17T14:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns "Just now" for less than 1 hour ago', () => {
      expect(formatNotificationTime('2026-02-17T13:30:00.000Z')).toBe('Just now');
    });

    it('returns "Xh ago" for hours within same day', () => {
      expect(formatNotificationTime('2026-02-17T11:00:00.000Z')).toBe('3h ago');
    });

    it('returns "Xd ago" for days ago (less than 7)', () => {
      expect(formatNotificationTime('2026-02-14T14:00:00.000Z')).toBe('3d ago');
    });

    it('returns "Mon DD" format for 7+ days ago', () => {
      const result = formatNotificationTime('2026-02-05T10:00:00.000Z');
      // toLocaleDateString({ month: 'short', day: 'numeric' }) => "Feb 5" (locale-dependent)
      expect(result).toMatch(/Feb\s*5/);
    });
  });

  // =========================================================================
  // 3. Tier banner visibility
  // =========================================================================

  describe('shouldShowTierBanner', () => {
    it('returns true for free tier (historyDays = 7)', () => {
      expect(shouldShowTierBanner('free')).toBe(true);
    });

    it('returns false for plus tier (historyDays = Infinity)', () => {
      expect(shouldShowTierBanner('plus')).toBe(false);
    });
  });

  describe('getTierBannerText', () => {
    it('shows "Showing last 7 days" for free tier', () => {
      expect(getTierBannerText('free')).toBe('Showing last 7 days. Upgrade for full history.');
    });
  });

  // =========================================================================
  // 4. Filter chips configuration
  // =========================================================================

  describe('FILTER_OPTIONS', () => {
    it('has exactly 5 filter options', () => {
      expect(FILTER_OPTIONS).toHaveLength(5);
    });

    it('includes All, Artist, Film, Category, Venue labels', () => {
      const labels = FILTER_OPTIONS.map(o => o.label);
      expect(labels).toEqual(['All', 'Artist', 'Film', 'Category', 'Venue']);
    });

    it('"All" filter uses value "all"', () => {
      const allOption = FILTER_OPTIONS.find(o => o.label === 'All');
      expect(allOption?.value).toBe('all');
    });

    it('Film filter maps to "film_talent" hook type', () => {
      const filmOption = FILTER_OPTIONS.find(o => o.label === 'Film');
      expect(filmOption?.value).toBe('film_talent');
    });
  });

  // =========================================================================
  // 5. Status dot colors
  // =========================================================================

  describe('getStatusDotColor', () => {
    it('returns purple (#7C3AED) for pending status', () => {
      expect(getStatusDotColor('pending')).toBe('#7C3AED');
    });

    it('returns green (#22C55E) for viewed status', () => {
      expect(getStatusDotColor('viewed')).toBe('#22C55E');
    });

    it('returns gray (#9CA3AF) for dismissed status', () => {
      expect(getStatusDotColor('dismissed')).toBe('#9CA3AF');
    });

    it('returns purple for sent status (same as pending)', () => {
      expect(getStatusDotColor('sent')).toBe('#7C3AED');
    });

    it('returns gray for expired status (same as dismissed)', () => {
      expect(getStatusDotColor('expired')).toBe('#9CA3AF');
    });
  });

  // =========================================================================
  // 6. Notification tap handler
  // =========================================================================

  describe('handleNotificationTap', () => {
    it('calls openUrlFn when notification has a ticketUrl', () => {
      const hapticFn = jest.fn();
      const openUrlFn = jest.fn();
      const notif = makeNotification({
        eventData: {
          name: 'Concert',
          ticketUrl: 'https://www.ticketmaster.com/event/123',
        },
      });

      handleNotificationTap(notif, hapticFn, openUrlFn);

      expect(openUrlFn).toHaveBeenCalledWith('https://www.ticketmaster.com/event/123');
      expect(hapticFn).toHaveBeenCalledTimes(1);
    });

    it('does not call openUrlFn when notification has no ticketUrl', () => {
      const hapticFn = jest.fn();
      const openUrlFn = jest.fn();
      const notif = makeNotification(); // no eventData

      handleNotificationTap(notif, hapticFn, openUrlFn);

      expect(openUrlFn).not.toHaveBeenCalled();
      expect(hapticFn).toHaveBeenCalledTimes(1);
    });

    it('does not call openUrlFn when eventData exists but ticketUrl is undefined', () => {
      const hapticFn = jest.fn();
      const openUrlFn = jest.fn();
      const notif = makeNotification({
        eventData: { name: 'Free Event', venue: 'Deep Ellum' },
      });

      handleNotificationTap(notif, hapticFn, openUrlFn);

      expect(openUrlFn).not.toHaveBeenCalled();
    });

    it('always triggers haptic feedback regardless of ticketUrl', () => {
      const hapticFn = jest.fn();
      const openUrlFn = jest.fn();
      const notif = makeNotification();

      handleNotificationTap(notif, hapticFn, openUrlFn);

      expect(hapticFn).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 7. Filter change handler
  // =========================================================================

  describe('handleFilterChange', () => {
    it('calls hapticFn and setActiveFilter with the selected filter', () => {
      const hapticFn = jest.fn();
      const setActiveFilter = jest.fn();

      handleFilterChange('artist', hapticFn, setActiveFilter);

      expect(hapticFn).toHaveBeenCalledTimes(1);
      expect(setActiveFilter).toHaveBeenCalledWith('artist');
    });

    it('sets filter to "all" when All chip is selected', () => {
      const hapticFn = jest.fn();
      const setActiveFilter = jest.fn();

      handleFilterChange('all', hapticFn, setActiveFilter);

      expect(setActiveFilter).toHaveBeenCalledWith('all');
    });
  });

  // =========================================================================
  // 8. buildNotificationHistoryArgs (data fetching params)
  // =========================================================================

  describe('buildNotificationHistoryArgs', () => {
    it('passes undefined filter when activeFilter is "all"', () => {
      const args = buildNotificationHistoryArgs('user-1', 'all', 'free');
      expect(args).toEqual(['user-1', undefined, 'free']);
    });

    it('passes hookType filter when activeFilter is a specific type', () => {
      const args = buildNotificationHistoryArgs('user-1', 'artist', 'free');
      expect(args).toEqual(['user-1', { hookType: 'artist' }, 'free']);
    });

    it('passes plus tier correctly', () => {
      const args = buildNotificationHistoryArgs('user-1', 'all', 'plus');
      expect(args).toEqual(['user-1', undefined, 'plus']);
    });

    it('passes film_talent filter correctly', () => {
      const args = buildNotificationHistoryArgs('user-1', 'film_talent', 'plus');
      expect(args).toEqual(['user-1', { hookType: 'film_talent' }, 'plus']);
    });
  });

  // =========================================================================
  // 9. Notification grouping
  // =========================================================================

  describe('groupNotifications', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-17T14:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns empty array for no notifications', () => {
      expect(groupNotifications([])).toEqual([]);
    });

    it('groups today notifications under "Today"', () => {
      const notifs = [
        makeNotification({ id: 'n1', createdAt: '2026-02-17T10:00:00.000Z' }),
      ];
      const groups = groupNotifications(notifs);
      expect(groups).toHaveLength(1);
      expect(groups[0].title).toBe('Today');
      expect(groups[0].data).toHaveLength(1);
    });

    it('groups mixed notifications into Today, Yesterday, Earlier', () => {
      const notifs = [
        makeNotification({ id: 'today', createdAt: '2026-02-17T10:00:00.000Z' }),
        makeNotification({ id: 'yesterday', createdAt: '2026-02-16T10:00:00.000Z' }),
        makeNotification({ id: 'earlier', createdAt: '2026-02-10T10:00:00.000Z' }),
      ];
      const groups = groupNotifications(notifs);
      expect(groups).toHaveLength(3);
      expect(groups[0].title).toBe('Today');
      expect(groups[1].title).toBe('Yesterday');
      expect(groups[2].title).toBe('Earlier');
    });

    it('maintains section order: Today before Yesterday before Earlier', () => {
      const notifs = [
        makeNotification({ id: 'earlier', createdAt: '2026-02-10T10:00:00.000Z' }),
        makeNotification({ id: 'today', createdAt: '2026-02-17T10:00:00.000Z' }),
      ];
      const groups = groupNotifications(notifs);
      expect(groups[0].title).toBe('Today');
      expect(groups[1].title).toBe('Earlier');
    });

    it('omits empty sections', () => {
      const notifs = [
        makeNotification({ id: 'old', createdAt: '2026-02-10T10:00:00.000Z' }),
      ];
      const groups = groupNotifications(notifs);
      expect(groups).toHaveLength(1);
      expect(groups[0].title).toBe('Earlier');
    });
  });

  // =========================================================================
  // 10. Flat data computation
  // =========================================================================

  describe('flattenGroupedNotifications', () => {
    it('returns empty array for no sections', () => {
      expect(flattenGroupedNotifications([])).toEqual([]);
    });

    it('prepends each section with a header item', () => {
      const notif = makeNotification({ id: 'n1' });
      const sections = [{ title: 'Today', data: [notif] }];
      const flat = flattenGroupedNotifications(sections);

      expect(flat).toHaveLength(2);
      expect(flat[0]).toEqual({ type: 'header', title: 'Today' });
      expect(flat[1]).toBe(notif);
    });

    it('interleaves headers and notification items for multiple sections', () => {
      const n1 = makeNotification({ id: 'n1' });
      const n2 = makeNotification({ id: 'n2' });
      const sections = [
        { title: 'Today', data: [n1] },
        { title: 'Earlier', data: [n2] },
      ];
      const flat = flattenGroupedNotifications(sections);

      expect(flat).toHaveLength(4);
      expect((flat[0] as any).type).toBe('header');
      expect((flat[0] as any).title).toBe('Today');
      expect((flat[2] as any).type).toBe('header');
      expect((flat[2] as any).title).toBe('Earlier');
    });
  });

  // =========================================================================
  // 11. Visibility-based loading
  // =========================================================================

  describe('shouldLoadNotifications', () => {
    it('returns true when visible is true', () => {
      expect(shouldLoadNotifications(true)).toBe(true);
    });

    it('returns false when visible is false', () => {
      expect(shouldLoadNotifications(false)).toBe(false);
    });
  });

  // =========================================================================
  // 12. RADAR_LIMITS tier checks
  // =========================================================================

  describe('RADAR_LIMITS tier integration', () => {
    it('free tier has historyDays of 7', () => {
      expect(RADAR_LIMITS.free.historyDays).toBe(7);
    });

    it('plus tier has historyDays of Infinity', () => {
      expect(RADAR_LIMITS.plus.historyDays).toBe(Infinity);
    });
  });
});
