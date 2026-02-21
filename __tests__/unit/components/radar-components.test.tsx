/**
 * Tests for Radar UI component logic
 *
 * Covers the three radar components:
 * 1. RadarAlertCard — formatting helpers, price display, badge visibility
 * 2. RadarManagement — time-ago formatting, limit display, empty state logic
 * 3. AddRadarSheet — type gating, category options, placeholder text
 *
 * Follows the project pattern of extracting and testing pure logic
 * from components (no React rendering, node test environment).
 */

import {
  HookType,
  HOOK_TYPE_META,
  RADAR_LIMITS,
  RadarEventData,
  HookNotification,
  RadarMatch,
  UserHook,
} from '@/types/radar';
import { buildMatchReason, notificationToRadarMatch } from '@/services/radar-service';

// Mock Supabase to prevent database calls
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
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
// RADAR ALERT CARD — Formatting Helpers
// ============================================================================

describe('RadarAlertCard - Formatting Helpers', () => {
  // Pin clock to noon to avoid midnight-boundary flakiness in Today/Tomorrow tests
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 1, 20, 12, 0, 0)); // Feb 20, 2026 noon
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  /**
   * Mirrors formatEventDate from radar-alert-card.tsx line 221
   * Converts ISO date string to human-readable relative/absolute date.
   */
  function formatEventDate(dateStr: string): string {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      const now = new Date();
      const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Tomorrow';
      if (diffDays < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
      }

      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  /**
   * Format a Date as a local YYYY-MM-DD string (avoids toISOString() UTC
   * roll-over bug that caused flaky "Today"/"Tomorrow" assertions late at
   * night when the UTC date is already the next day).
   */
  function toLocalDateStr(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  describe('formatEventDate', () => {
    it('should return "Today" for today\'s date', () => {
      const today = new Date();
      const dateStr = toLocalDateStr(today);
      expect(formatEventDate(dateStr)).toBe('Today');
    });

    it('should return "Tomorrow" for tomorrow\'s date', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = toLocalDateStr(tomorrow);
      expect(formatEventDate(dateStr)).toBe('Tomorrow');
    });

    it('should return weekday name for dates within 7 days', () => {
      const inFive = new Date();
      inFive.setDate(inFive.getDate() + 5);
      const dateStr = toLocalDateStr(inFive);
      const result = formatEventDate(dateStr);
      const validDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      expect(validDays).toContain(result);
    });

    it('should return "Mon DD" format for dates beyond 7 days', () => {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 30);
      const dateStr = toLocalDateStr(farFuture);
      const result = formatEventDate(dateStr);
      // Should match pattern like "Mar 19" or "Apr 1"
      expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    });

    it('should return "Invalid Date" for unparseable date strings', () => {
      // JavaScript's Date constructor doesn't throw for invalid strings;
      // it creates an Invalid Date object whose toLocaleDateString returns "Invalid Date"
      expect(formatEventDate('not-a-date')).toBe('Invalid Date');
    });
  });

  /**
   * Mirrors formatEventTime from radar-alert-card.tsx line 239
   */
  function formatEventTime(timeStr: string): string {
    try {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours % 12 || 12;
      return minutes > 0 ? `${displayHour}:${String(minutes).padStart(2, '0')} ${period}` : `${displayHour} ${period}`;
    } catch {
      return timeStr;
    }
  }

  describe('formatEventTime', () => {
    it('should format midnight (00:00) as "12 AM"', () => {
      expect(formatEventTime('00:00')).toBe('12 AM');
    });

    it('should format noon (12:00) as "12 PM"', () => {
      expect(formatEventTime('12:00')).toBe('12 PM');
    });

    it('should format 8 PM correctly', () => {
      expect(formatEventTime('20:00')).toBe('8 PM');
    });

    it('should include minutes when non-zero', () => {
      expect(formatEventTime('19:30')).toBe('7:30 PM');
    });

    it('should format morning time with minutes', () => {
      expect(formatEventTime('09:15')).toBe('9:15 AM');
    });

    it('should pad single-digit minutes', () => {
      expect(formatEventTime('14:05')).toBe('2:05 PM');
    });

    it('should handle malformed input gracefully (NaN splits to 0)', () => {
      // 'invalid'.split(':').map(Number) => [NaN, undefined]
      // NaN >= 12 is false => 'AM', NaN % 12 => NaN, || 12 => 12
      // So malformed input produces '12 AM' (same as midnight)
      expect(formatEventTime('invalid')).toBe('12 AM');
    });
  });

  describe('Price text logic', () => {
    /**
     * Mirrors priceText logic from radar-alert-card.tsx lines 110-114
     */
    function getPriceText(event?: RadarEventData): string | null {
      const hasPrice = event?.priceMin != null;
      if (!hasPrice) return null;

      if (event!.priceMax && event!.priceMax !== event!.priceMin) {
        return `$${event!.priceMin} - $${event!.priceMax}`;
      }
      return `From $${event!.priceMin}`;
    }

    it('should return null when no price data', () => {
      expect(getPriceText(undefined)).toBeNull();
      expect(getPriceText({ name: 'Test' })).toBeNull();
    });

    it('should show range when priceMin and priceMax differ', () => {
      expect(getPriceText({ name: 'Test', priceMin: 89, priceMax: 450 })).toBe('$89 - $450');
    });

    it('should show "From" when priceMin equals priceMax', () => {
      expect(getPriceText({ name: 'Test', priceMin: 50, priceMax: 50 })).toBe('From $50');
    });

    it('should show "From" when priceMax is absent', () => {
      expect(getPriceText({ name: 'Test', priceMin: 25 })).toBe('From $25');
    });

    it('should handle free events (priceMin = 0)', () => {
      expect(getPriceText({ name: 'Test', priceMin: 0 })).toBe('From $0');
    });
  });

  describe('Badge and button visibility', () => {
    it('should show ticket button when ticketUrl is present', () => {
      const hasTicketUrl = (event?: RadarEventData) => !!event?.ticketUrl;
      expect(hasTicketUrl({ name: 'Test', ticketUrl: 'https://tickets.com' })).toBe(true);
      expect(hasTicketUrl({ name: 'Test' })).toBe(false);
      expect(hasTicketUrl(undefined)).toBe(false);
    });

    it('should show image when imageUrl is present', () => {
      const hasImage = (event?: RadarEventData) => !!event?.imageUrl;
      expect(hasImage({ name: 'Test', imageUrl: 'https://img.com/photo.jpg' })).toBe(true);
      expect(hasImage({ name: 'Test' })).toBe(false);
    });

    it('should show distance when distanceMiles is present', () => {
      const distanceText = (event?: RadarEventData) =>
        event?.distanceMiles != null ? `${event.distanceMiles.toFixed(1)} mi away` : null;
      expect(distanceText({ name: 'Test', distanceMiles: 3.2 })).toBe('3.2 mi away');
      expect(distanceText({ name: 'Test', distanceMiles: 0 })).toBe('0.0 mi away');
      expect(distanceText({ name: 'Test' })).toBeNull();
    });
  });

  describe('Event name fallback', () => {
    /**
     * Mirrors display name from radar-alert-card.tsx line 153:
     * {event?.name || notification.title}
     */
    function getDisplayName(notification: Pick<HookNotification, 'title'>, event?: RadarEventData): string {
      return event?.name || notification.title;
    }

    it('should prefer event name when available', () => {
      expect(getDisplayName(
        { title: 'Fallback Title' },
        { name: 'Taylor Swift - The Eras Tour' },
      )).toBe('Taylor Swift - The Eras Tour');
    });

    it('should fall back to notification title when no event name', () => {
      expect(getDisplayName({ title: 'Fallback Title' }, undefined)).toBe('Fallback Title');
    });

    it('should fall back when event has empty name', () => {
      expect(getDisplayName({ title: 'Fallback Title' }, { name: '' })).toBe('Fallback Title');
    });
  });
});

// ============================================================================
// RADAR MANAGEMENT — Time Ago & Limit Logic
// ============================================================================

describe('RadarManagement - Pure Logic', () => {
  describe('getTimeAgo', () => {
    /**
     * Mirrors getTimeAgo from radar-management.tsx line 104
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

    it('should return "Never triggered" for undefined', () => {
      expect(getTimeAgo(undefined)).toBe('Never triggered');
    });

    it('should return "Today" for a date within the last 24 hours', () => {
      const recent = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      expect(getTimeAgo(recent)).toBe('Today');
    });

    it('should return "Yesterday" for ~1 day ago', () => {
      const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
      expect(getTimeAgo(yesterday)).toBe('Yesterday');
    });

    it('should return "X days ago" for 2-6 days', () => {
      const threeDays = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      expect(getTimeAgo(threeDays)).toBe('3 days ago');
    });

    it('should return "X weeks ago" for 7-29 days', () => {
      const twoWeeks = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      expect(getTimeAgo(twoWeeks)).toBe('2 weeks ago');
    });

    it('should return "X months ago" for 30+ days', () => {
      const twoMonths = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      expect(getTimeAgo(twoMonths)).toBe('2 months ago');
    });
  });

  describe('formatAlertDate', () => {
    /**
     * Mirrors formatAlertDate from radar-management.tsx line 282
     */
    function formatAlertDate(dateStr: string): string {
      try {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch {
        return dateStr;
      }
    }

    it('should format date as "Mon DD"', () => {
      const result = formatAlertDate('2026-03-15');
      expect(result).toBe('Mar 15');
    });

    it('should format single-digit days', () => {
      const result = formatAlertDate('2026-01-05');
      expect(result).toBe('Jan 5');
    });

    it('should return "Invalid Date" for unparseable date strings', () => {
      // Same behavior as formatEventDate: Date constructor doesn't throw
      expect(formatAlertDate('garbage')).toBe('Invalid Date');
    });
  });

  describe('formatTimeAgo', () => {
    /**
     * Mirrors formatTimeAgo from radar-management.tsx line 291
     */
    function formatTimeAgo(dateStr: string): string {
      const diff = Date.now() - new Date(dateStr).getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days === 0) return 'today';
      if (days === 1) return 'yesterday';
      if (days < 7) return `${days} days ago`;
      return `${Math.floor(days / 7)} weeks ago`;
    }

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

    it('should return "X weeks ago" for 7+ days', () => {
      const threeWeeks = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatTimeAgo(threeWeeks)).toBe('3 weeks ago');
    });
  });

  describe('Limit display logic', () => {
    it('should format free tier limits correctly', () => {
      const limits = RADAR_LIMITS['free'];
      expect(limits.total).toBe(3);
      const text = `0 of ${limits.total === Infinity ? 'unlimited' : limits.total} radars active`;
      expect(text).toBe('0 of 3 radars active');
    });

    it('should format plus tier limits as "unlimited"', () => {
      const limits = RADAR_LIMITS['plus'];
      const text = `5 of ${limits.total === Infinity ? 'unlimited' : limits.total} radars active`;
      expect(text).toBe('5 of unlimited radars active');
    });

    it('should show upgrade hint only for free tier', () => {
      const showUpgradeHint = (tier: string) => tier === 'free';
      expect(showUpgradeHint('free')).toBe(true);
      expect(showUpgradeHint('plus')).toBe(false);
    });
  });

  describe('Empty state logic', () => {
    it('should show empty state when radar list is empty', () => {
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
  });

  describe('RadarListItem display name', () => {
    /**
     * Mirrors RadarListItem name rendering from radar-management.tsx line 235:
     * {radar.entityName || radar.category || meta.label}
     */
    function getRadarDisplayName(radar: Pick<UserHook, 'hookType' | 'entityName' | 'category'>): string {
      const meta = HOOK_TYPE_META[radar.hookType];
      return radar.entityName || radar.category || meta.label;
    }

    it('should prefer entityName when present', () => {
      expect(getRadarDisplayName({ hookType: 'artist', entityName: 'Beyonce', category: undefined })).toBe('Beyonce');
    });

    it('should fall back to category when no entityName', () => {
      expect(getRadarDisplayName({ hookType: 'category', entityName: undefined, category: 'live_music' })).toBe('live_music');
    });

    it('should fall back to meta label when neither entityName nor category', () => {
      expect(getRadarDisplayName({ hookType: 'proximity', entityName: undefined, category: undefined })).toBe('Friends');
    });
  });
});

// ============================================================================
// ADD RADAR SHEET — Type Gating & Configuration Logic
// ============================================================================

describe('AddRadarSheet - Pure Logic', () => {
  describe('Radar type gating', () => {
    /** Mirrors RADAR_TYPES from add-radar-sheet.tsx line 63 */
    const RADAR_TYPES: { type: HookType; plusOnly: boolean }[] = [
      { type: 'artist', plusOnly: false },
      { type: 'film_talent', plusOnly: false },
      { type: 'category', plusOnly: false },
      { type: 'venue', plusOnly: true },
      { type: 'proximity', plusOnly: true },
    ];

    it('should have 5 radar types', () => {
      expect(RADAR_TYPES.length).toBe(5);
    });

    it('should gate venue and proximity behind Plus', () => {
      const plusOnly = RADAR_TYPES.filter(t => t.plusOnly).map(t => t.type);
      expect(plusOnly).toEqual(['venue', 'proximity']);
    });

    it('should allow artist, film_talent, and category for free users', () => {
      const freeTypes = RADAR_TYPES.filter(t => !t.plusOnly).map(t => t.type);
      expect(freeTypes).toEqual(['artist', 'film_talent', 'category']);
    });

    it('should show locked state for Plus-only types on free tier', () => {
      const isLocked = (type: HookType, tier: string): boolean => {
        const config = RADAR_TYPES.find(t => t.type === type);
        return (config?.plusOnly ?? false) && tier === 'free';
      };

      expect(isLocked('venue', 'free')).toBe(true);
      expect(isLocked('proximity', 'free')).toBe(true);
      expect(isLocked('artist', 'free')).toBe(false);
      expect(isLocked('venue', 'plus')).toBe(false);
    });
  });

  describe('Search placeholder text', () => {
    function getPlaceholder(hookType: HookType): string {
      const map: Record<HookType, string> = {
        artist: 'Search for an artist...',
        film_talent: 'Search actors, directors...',
        venue: 'Search for a venue...',
        category: '',
        proximity: '',
        keyword: 'e.g., tallow fries, gluten free, rooftop...',
      };
      return map[hookType];
    }

    it('should return artist search placeholder', () => {
      expect(getPlaceholder('artist')).toBe('Search for an artist...');
    });

    it('should return film_talent search placeholder', () => {
      expect(getPlaceholder('film_talent')).toBe('Search actors, directors...');
    });

    it('should return venue search placeholder', () => {
      expect(getPlaceholder('venue')).toBe('Search for a venue...');
    });

    it('should return empty for category and proximity (no search input)', () => {
      expect(getPlaceholder('category')).toBe('');
      expect(getPlaceholder('proximity')).toBe('');
    });
  });

  describe('isSearchType logic', () => {
    function isSearchType(hookType: HookType): boolean {
      return hookType === 'artist' || hookType === 'film_talent' || hookType === 'venue';
    }

    it('should be true for artist, film_talent, and venue', () => {
      expect(isSearchType('artist')).toBe(true);
      expect(isSearchType('film_talent')).toBe(true);
      expect(isSearchType('venue')).toBe(true);
    });

    it('should be false for category and proximity', () => {
      expect(isSearchType('category')).toBe(false);
      expect(isSearchType('proximity')).toBe(false);
    });
  });

  describe('Category options', () => {
    /** Mirrors CATEGORY_OPTIONS from add-radar-sheet.tsx line 47 */
    const CATEGORY_OPTIONS = [
      { value: 'live_music', label: 'Live Music', icon: '🎵' },
      { value: 'comedy', label: 'Comedy Shows', icon: '😂' },
      { value: 'arts', label: 'Art Exhibitions', icon: '🎨' },
      { value: 'sports', label: 'Sports Events', icon: '🏟️' },
      { value: 'dining', label: 'Food Festivals', icon: '🍽️' },
      { value: 'shopping', label: 'Pop-up Shops', icon: '🛍️' },
      { value: 'outdoor', label: 'Outdoor Events', icon: '🏕️' },
      { value: 'nightlife', label: 'Nightlife', icon: '🌙' },
      { value: 'wellness', label: 'Wellness', icon: '🧘' },
      { value: 'culture', label: 'Cultural Events', icon: '🏛️' },
      { value: 'family', label: 'Family Activities', icon: '👨‍👩‍👧' },
      { value: 'events', label: 'Community Events', icon: '🤝' },
    ];

    it('should have 12 categories', () => {
      expect(CATEGORY_OPTIONS.length).toBe(12);
    });

    it('should have unique values', () => {
      const values = CATEGORY_OPTIONS.map(c => c.value);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });

    it('should include live_music as the first option', () => {
      expect(CATEGORY_OPTIONS[0].value).toBe('live_music');
      expect(CATEGORY_OPTIONS[0].label).toBe('Live Music');
    });

    it('should resolve label from value', () => {
      const findLabel = (value: string) => CATEGORY_OPTIONS.find(c => c.value === value)?.label;
      expect(findLabel('comedy')).toBe('Comedy Shows');
      expect(findLabel('nonexistent')).toBeUndefined();
    });
  });

  describe('Sheet title logic', () => {
    function getSheetTitle(step: 'type' | 'configure', selectedType: HookType | null): string {
      if (step === 'type') return 'Add a Radar';
      return `New ${HOOK_TYPE_META[selectedType!]?.label} Radar`;
    }

    it('should show "Add a Radar" on type selection step', () => {
      expect(getSheetTitle('type', null)).toBe('Add a Radar');
    });

    it('should show type-specific title on configure step', () => {
      expect(getSheetTitle('configure', 'artist')).toBe('New Artist Radar');
      expect(getSheetTitle('configure', 'film_talent')).toBe('New Film Radar');
      expect(getSheetTitle('configure', 'venue')).toBe('New Venue Radar');
      expect(getSheetTitle('configure', 'category')).toBe('New Category Radar');
      expect(getSheetTitle('configure', 'proximity')).toBe('New Friends Radar');
    });
  });
});

// ============================================================================
// SHARED — HOOK_TYPE_META & RADAR_LIMITS type contracts
// ============================================================================

describe('Radar Type Metadata (HOOK_TYPE_META)', () => {
  const allTypes: HookType[] = ['artist', 'film_talent', 'category', 'venue', 'proximity'];

  it('should have metadata for all 5 hook types', () => {
    for (const type of allTypes) {
      expect(HOOK_TYPE_META[type]).toBeDefined();
      expect(HOOK_TYPE_META[type].label).toBeTruthy();
      expect(HOOK_TYPE_META[type].icon).toBeTruthy();
      expect(HOOK_TYPE_META[type].description).toBeTruthy();
    }
  });

  it('should have correct labels for each type', () => {
    expect(HOOK_TYPE_META.artist.label).toBe('Artist');
    expect(HOOK_TYPE_META.film_talent.label).toBe('Film');
    expect(HOOK_TYPE_META.category.label).toBe('Category');
    expect(HOOK_TYPE_META.venue.label).toBe('Venue');
    expect(HOOK_TYPE_META.proximity.label).toBe('Friends');
  });

  it('should have correct icons for each type', () => {
    expect(HOOK_TYPE_META.artist.icon).toBe('🎵');
    expect(HOOK_TYPE_META.film_talent.icon).toBe('🎬');
    expect(HOOK_TYPE_META.category.icon).toBe('🏷️');
    expect(HOOK_TYPE_META.venue.icon).toBe('📍');
    expect(HOOK_TYPE_META.proximity.icon).toBe('👥');
  });
});

describe('Radar Tier Limits (RADAR_LIMITS)', () => {
  describe('Free tier limits', () => {
    const free = RADAR_LIMITS.free;

    it('should allow 3 total radars', () => {
      expect(free.total).toBe(3);
    });

    it('should allow 1 artist/film radar', () => {
      expect(free.artistOrFilm).toBe(1);
    });

    it('should allow 2 category radars', () => {
      expect(free.category).toBe(2);
    });

    it('should block venue and proximity (0)', () => {
      expect(free.venue).toBe(0);
      expect(free.proximity).toBe(0);
    });

    it('should disable push, real-time, keywords, and price threshold', () => {
      expect(free.pushNotifications).toBe(false);
      expect(free.realTimeAlerts).toBe(false);
      expect(free.customKeywords).toBe(false);
      expect(free.priceThreshold).toBe(false);
    });

    it('should limit history to 7 days', () => {
      expect(free.historyDays).toBe(7);
    });
  });

  describe('Plus tier limits', () => {
    const plus = RADAR_LIMITS.plus;

    it('should allow unlimited total radars', () => {
      expect(plus.total).toBe(Infinity);
    });

    it('should allow unlimited artist/film radars', () => {
      expect(plus.artistOrFilm).toBe(Infinity);
    });

    it('should allow unlimited venue radars', () => {
      expect(plus.venue).toBe(Infinity);
    });

    it('should cap proximity radars at 5', () => {
      expect(plus.proximity).toBe(5);
    });

    it('should enable all premium features', () => {
      expect(plus.pushNotifications).toBe(true);
      expect(plus.realTimeAlerts).toBe(true);
      expect(plus.customKeywords).toBe(true);
      expect(plus.priceThreshold).toBe(true);
    });

    it('should have unlimited history', () => {
      expect(plus.historyDays).toBe(Infinity);
    });
  });
});

// ============================================================================
// RADAR SERVICE — buildMatchReason & notificationToRadarMatch
// ============================================================================

describe('Radar Service - Feed Helpers', () => {
  describe('buildMatchReason', () => {
    it('should include entity name for artist type', () => {
      expect(buildMatchReason('artist', 'Taylor Swift')).toBe('Matched your Taylor Swift radar');
    });

    it('should use generic fallback for artist type without name', () => {
      expect(buildMatchReason('artist')).toBe('Matched your Artist Radar');
    });

    it('should include entity name for film_talent', () => {
      expect(buildMatchReason('film_talent', 'Christopher Nolan')).toBe('Matched your Christopher Nolan radar');
    });

    it('should use "Matched your Film Radar" as fallback for film_talent', () => {
      expect(buildMatchReason('film_talent')).toBe('Matched your Film Radar');
    });

    it('should format category match with entity name', () => {
      expect(buildMatchReason('category', 'Live Music')).toBe('Matched your Live Music category');
    });

    it('should format venue match with entity name', () => {
      expect(buildMatchReason('venue', 'Deep Ellum Brewing')).toBe('New event at Deep Ellum Brewing');
    });

    it('should show proximity reason for proximity type', () => {
      expect(buildMatchReason('proximity')).toBe('A friend is nearby and free');
      expect(buildMatchReason('proximity', 'Alice')).toBe('A friend is nearby and free');
    });
  });

  describe('notificationToRadarMatch', () => {
    const mockNotification: HookNotification = {
      id: 'notif-1',
      userId: 'user-1',
      hookId: 'hook-1',
      title: 'Taylor Swift - Eras Tour',
      body: 'AT&T Stadium, Mar 15',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const mockHook: UserHook = {
      id: 'hook-1',
      userId: 'user-1',
      hookType: 'artist',
      entityName: 'Taylor Swift',
      isActive: true,
      triggerCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should produce a RadarMatch with correct hookId', () => {
      const match = notificationToRadarMatch(mockNotification, mockHook);
      expect(match.hookId).toBe('hook-1');
    });

    it('should use hook type when hook is provided', () => {
      const match = notificationToRadarMatch(mockNotification, mockHook);
      expect(match.hookType).toBe('artist');
    });

    it('should default to "category" when no hook provided', () => {
      const match = notificationToRadarMatch(mockNotification);
      expect(match.hookType).toBe('category');
    });

    it('should build match reason from hook when available', () => {
      const match = notificationToRadarMatch(mockNotification, mockHook);
      expect(match.matchReason).toBe('Matched your Taylor Swift radar');
    });

    it('should fall back to notification title when no hook', () => {
      const match = notificationToRadarMatch(mockNotification);
      expect(match.matchReason).toBe('Taylor Swift - Eras Tour');
    });

    it('should include notificationId', () => {
      const match = notificationToRadarMatch(mockNotification, mockHook);
      expect(match.notificationId).toBe('notif-1');
    });
  });
});
