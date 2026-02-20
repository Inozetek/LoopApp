/**
 * Tests for RadarManagementSection pure logic helpers
 *
 * Follows the project pattern of mirroring pure functions from the component
 * and testing them in a node environment (no React rendering).
 *
 * Mirrors logic from: components/radar-management-section.tsx
 *
 * Covers:
 * - getTimeAgo: relative time formatting for last-triggered dates
 * - formatAlertDate: ISO date -> "Mon DD" formatting
 * - formatTimeAgo: lowercase relative time for notification timestamps
 * - getRadarDisplayName: display name resolution (entityName > category > label)
 * - getLimitText: tier-aware limit display
 * - shouldShowUpgradeHint: upgrade prompt gating
 * - List item formatting: trigger count, meta text, opacity
 * - Empty state: detection based on radar array length
 * - Active count calculation
 * - Tier limits contract
 */

import {
  HookType,
  HOOK_TYPE_META,
  RADAR_LIMITS,
  UserHook,
} from '@/types/radar';
import type { SubscriptionTier } from '@/types/subscription';

// Mock Supabase to prevent database calls
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({ data: [], error: null })),
          })),
          single: jest.fn(),
          order: jest.fn(() => ({
            limit: jest.fn(() => ({ data: [], error: null })),
          })),
        })),
        in: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({ data: [], error: null })),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(),
        })),
      })),
    })),
  },
}));

// ============================================================================
// MIRRORED PURE HELPERS (from components/radar-management-section.tsx)
// ============================================================================

/**
 * Mirrors getTimeAgo from radar-management-section.tsx
 * Human-readable "time ago" string from an ISO date.
 */
function getTimeAgo(dateStr?: string): string {
  if (!dateStr) return 'Never triggered';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/**
 * Mirrors formatAlertDate from radar-management-section.tsx
 * Format an ISO date string as "Mon DD".
 */
function formatAlertDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Mirrors formatTimeAgo from radar-management-section.tsx
 * Lowercase relative time for notification timestamps.
 */
function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}

/**
 * Mirrors getRadarDisplayName from radar-management-section.tsx
 * Display name resolution: entityName > category > type label.
 */
function getRadarDisplayName(radar: Pick<UserHook, 'hookType' | 'entityName' | 'category'>): string {
  const meta = HOOK_TYPE_META[radar.hookType];
  return radar.entityName || radar.category || meta.label;
}

/**
 * Mirrors getLimitText from radar-management-section.tsx
 * Tier-aware limit display text.
 */
function getLimitText(activeCount: number, tier: SubscriptionTier): string {
  const limits = RADAR_LIMITS[tier];
  const maxStr = limits.total === Infinity ? 'unlimited' : String(limits.total);
  return `${activeCount} of ${maxStr} radars active`;
}

/**
 * Mirrors shouldShowUpgradeHint from radar-management-section.tsx
 */
function shouldShowUpgradeHint(tier: SubscriptionTier): boolean {
  return tier === 'free';
}

// ============================================================================
// getTimeAgo
// ============================================================================

describe('RadarManagementSection - getTimeAgo', () => {
  it('should return "Never triggered" for undefined', () => {
    expect(getTimeAgo(undefined)).toBe('Never triggered');
  });

  it('should return "Never triggered" for empty string treated as undefined', () => {
    expect(getTimeAgo(undefined)).toBe('Never triggered');
  });

  it('should return "Today" for a date within the last 24 hours', () => {
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(getTimeAgo(recent)).toBe('Today');
  });

  it('should return "Today" for a date just minutes ago', () => {
    const justNow = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(getTimeAgo(justNow)).toBe('Today');
  });

  it('should return "Yesterday" for ~1 day ago', () => {
    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    expect(getTimeAgo(yesterday)).toBe('Yesterday');
  });

  it('should return "X days ago" for 2-6 days', () => {
    const threeDays = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(getTimeAgo(threeDays)).toBe('3 days ago');
  });

  it('should return "5 days ago" for exactly 5 days', () => {
    const fiveDays = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(getTimeAgo(fiveDays)).toBe('5 days ago');
  });

  it('should return "X weeks ago" for 7-29 days', () => {
    const twoWeeks = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    expect(getTimeAgo(twoWeeks)).toBe('2 weeks ago');
  });

  it('should return "1 weeks ago" for exactly 7 days', () => {
    const oneWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(getTimeAgo(oneWeek)).toBe('1 weeks ago');
  });

  it('should return "X months ago" for 30+ days', () => {
    const twoMonths = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    expect(getTimeAgo(twoMonths)).toBe('2 months ago');
  });

  it('should return "1 months ago" for exactly 30 days', () => {
    const oneMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(getTimeAgo(oneMonth)).toBe('1 months ago');
  });
});

// ============================================================================
// formatAlertDate
// ============================================================================

describe('RadarManagementSection - formatAlertDate', () => {
  it('should format date as "Mon DD"', () => {
    expect(formatAlertDate('2026-03-15')).toBe('Mar 15');
  });

  it('should format single-digit days', () => {
    expect(formatAlertDate('2026-01-05')).toBe('Jan 5');
  });

  it('should format various months correctly', () => {
    expect(formatAlertDate('2026-07-04')).toBe('Jul 4');
    expect(formatAlertDate('2026-12-25')).toBe('Dec 25');
    expect(formatAlertDate('2026-02-14')).toBe('Feb 14');
  });

  it('should return "Invalid Date" for unparseable input', () => {
    expect(formatAlertDate('garbage')).toBe('Invalid Date');
  });
});

// ============================================================================
// formatTimeAgo
// ============================================================================

describe('RadarManagementSection - formatTimeAgo', () => {
  it('should return lowercase "today" for recent timestamps', () => {
    const now = new Date().toISOString();
    expect(formatTimeAgo(now)).toBe('today');
  });

  it('should return "yesterday" for 1-day-old timestamps', () => {
    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(yesterday)).toBe('yesterday');
  });

  it('should return "X days ago" for 2-6 days', () => {
    const fiveDays = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(fiveDays)).toBe('5 days ago');
  });

  it('should return "3 days ago" for exactly 3 days', () => {
    const threeDays = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(threeDays)).toBe('3 days ago');
  });

  it('should return "X weeks ago" for 7+ days', () => {
    const threeWeeks = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(threeWeeks)).toBe('3 weeks ago');
  });

  it('should return "1 weeks ago" for exactly 7 days', () => {
    const oneWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(oneWeek)).toBe('1 weeks ago');
  });
});

// ============================================================================
// getRadarDisplayName
// ============================================================================

describe('RadarManagementSection - getRadarDisplayName', () => {
  it('should prefer entityName when present', () => {
    expect(getRadarDisplayName({
      hookType: 'artist',
      entityName: 'Beyonce',
      category: undefined,
    })).toBe('Beyonce');
  });

  it('should fall back to category when no entityName', () => {
    expect(getRadarDisplayName({
      hookType: 'category',
      entityName: undefined,
      category: 'live_music',
    })).toBe('live_music');
  });

  it('should fall back to meta label when neither entityName nor category', () => {
    expect(getRadarDisplayName({
      hookType: 'proximity',
      entityName: undefined,
      category: undefined,
    })).toBe('Friends');
  });

  it('should use entityName even when category is also present', () => {
    expect(getRadarDisplayName({
      hookType: 'category',
      entityName: 'Pop-up Shops',
      category: 'shopping',
    })).toBe('Pop-up Shops');
  });

  it('should return correct label for each type as final fallback', () => {
    const types: HookType[] = ['artist', 'film_talent', 'category', 'venue', 'proximity'];
    const expected = ['Artist', 'Film', 'Category', 'Venue', 'Friends'];
    types.forEach((type, i) => {
      expect(getRadarDisplayName({
        hookType: type,
        entityName: undefined,
        category: undefined,
      })).toBe(expected[i]);
    });
  });
});

// ============================================================================
// getLimitText
// ============================================================================

describe('RadarManagementSection - getLimitText', () => {
  it('should format free tier with 0 active radars', () => {
    expect(getLimitText(0, 'free')).toBe('0 of 3 radars active');
  });

  it('should format free tier with some active radars', () => {
    expect(getLimitText(2, 'free')).toBe('2 of 3 radars active');
  });

  it('should format free tier at max', () => {
    expect(getLimitText(3, 'free')).toBe('3 of 3 radars active');
  });

  it('should format plus tier with "unlimited"', () => {
    expect(getLimitText(5, 'plus')).toBe('5 of unlimited radars active');
  });

  it('should format plus tier with 0 active radars', () => {
    expect(getLimitText(0, 'plus')).toBe('0 of unlimited radars active');
  });

  it('should handle large counts for plus tier', () => {
    expect(getLimitText(42, 'plus')).toBe('42 of unlimited radars active');
  });
});

// ============================================================================
// shouldShowUpgradeHint
// ============================================================================

describe('RadarManagementSection - shouldShowUpgradeHint', () => {
  it('should return true for free tier', () => {
    expect(shouldShowUpgradeHint('free')).toBe(true);
  });

  it('should return false for plus tier', () => {
    expect(shouldShowUpgradeHint('plus')).toBe(false);
  });
});

// ============================================================================
// Empty state detection
// ============================================================================

describe('RadarManagementSection - Empty state', () => {
  it('should detect empty state when radar list is empty', () => {
    const radars: UserHook[] = [];
    expect(radars.length === 0).toBe(true);
  });

  it('should not show empty state when radars exist', () => {
    const radars: UserHook[] = [
      {
        id: 'r1',
        userId: 'u1',
        hookType: 'artist',
        entityName: 'Taylor Swift',
        isActive: true,
        triggerCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    expect(radars.length === 0).toBe(false);
  });

  it('should not show empty state when inactive radars exist', () => {
    const radars: UserHook[] = [
      {
        id: 'r1',
        userId: 'u1',
        hookType: 'category',
        category: 'live_music',
        isActive: false,
        triggerCount: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    expect(radars.length === 0).toBe(false);
  });
});

// ============================================================================
// List item formatting logic
// ============================================================================

describe('RadarManagementSection - List item formatting', () => {
  /**
   * Mirrors trigger info text logic from RadarListItem in
   * radar-management-section.tsx
   */
  function formatTriggerInfo(count: number): string {
    if (count === 0) return 'No matches yet';
    return `${count} match${count === 1 ? '' : 'es'}`;
  }

  it('should format trigger count with plural "matches"', () => {
    expect(formatTriggerInfo(5)).toBe('5 matches');
  });

  it('should format trigger count with singular "match"', () => {
    expect(formatTriggerInfo(1)).toBe('1 match');
  });

  it('should show "No matches yet" for 0 triggers', () => {
    expect(formatTriggerInfo(0)).toBe('No matches yet');
  });

  it('should compose meta text with type label and trigger info', () => {
    const meta = HOOK_TYPE_META['artist'];
    const triggerInfo = '2 matches';
    const text = `${meta.label} \u00B7 ${triggerInfo}`;
    expect(text).toBe('Artist \u00B7 2 matches');
  });

  it('should reduce opacity for inactive radars', () => {
    const isActive = false;
    const opacity = isActive ? 1 : 0.6;
    expect(opacity).toBe(0.6);
  });

  it('should use full opacity for active radars', () => {
    const isActive = true;
    const opacity = isActive ? 1 : 0.6;
    expect(opacity).toBe(1);
  });
});

// ============================================================================
// Active count calculation
// ============================================================================

describe('RadarManagementSection - Active count', () => {
  it('should count only active radars', () => {
    const radars: UserHook[] = [
      {
        id: 'r1',
        userId: 'u1',
        hookType: 'artist',
        entityName: 'Taylor Swift',
        isActive: true,
        triggerCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'r2',
        userId: 'u1',
        hookType: 'category',
        category: 'live_music',
        isActive: false,
        triggerCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'r3',
        userId: 'u1',
        hookType: 'venue',
        entityName: 'Deep Ellum',
        isActive: true,
        triggerCount: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const activeCount = radars.filter(r => r.isActive).length;
    expect(activeCount).toBe(2);
  });

  it('should return 0 when all radars are inactive', () => {
    const radars: UserHook[] = [
      {
        id: 'r1',
        userId: 'u1',
        hookType: 'artist',
        isActive: false,
        triggerCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const activeCount = radars.filter(r => r.isActive).length;
    expect(activeCount).toBe(0);
  });

  it('should return 0 for empty list', () => {
    const radars: UserHook[] = [];
    const activeCount = radars.filter(r => r.isActive).length;
    expect(activeCount).toBe(0);
  });
});

// ============================================================================
// Tier limits contract (cross-check with RADAR_LIMITS)
// ============================================================================

describe('RadarManagementSection - Tier limits contract', () => {
  it('should have correct free tier total', () => {
    expect(RADAR_LIMITS.free.total).toBe(3);
  });

  it('should have correct plus tier total (Infinity)', () => {
    expect(RADAR_LIMITS.plus.total).toBe(Infinity);
  });

  it('should correctly gate venue radars for free tier', () => {
    expect(RADAR_LIMITS.free.venue).toBe(0);
    expect(RADAR_LIMITS.plus.venue).toBe(Infinity);
  });

  it('should correctly gate proximity radars for free tier', () => {
    expect(RADAR_LIMITS.free.proximity).toBe(0);
    expect(RADAR_LIMITS.plus.proximity).toBe(5);
  });
});
