/**
 * Tests for context-detection service
 *
 * Tests all pure logic functions from services/context-detection.ts:
 * - calculateDistance (Haversine formula)
 * - formatDate (Today/Tomorrow/formatted date)
 * - formatDateRange (date range display)
 * - formatTimeRange (time range display)
 * - detectScheduleGaps (gap detection between calendar events)
 * - generateContextBadges (badge generation and prioritization)
 * - Social context inference (keyword matching, occasion detection, group naming)
 * - Trip detection (distance thresholds, grouping)
 *
 * Follows project pattern: pure logic is duplicated as standalone functions
 * to avoid importing React Native dependencies.
 */

// Mock Supabase client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              order: jest.fn(() => ({
                data: null,
                error: null,
              })),
            })),
          })),
          eq: jest.fn(() => ({
            data: null,
            error: null,
          })),
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              single: jest.fn(),
            })),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(),
      })),
    })),
  },
}));

// ============================================================================
// REPLICATED PURE FUNCTIONS (from services/context-detection.ts)
// ============================================================================

const TRIP_DISTANCE_THRESHOLD = 50;
const MIN_GAP_DURATION = 60;

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function calculateDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(point2.lat - point1.lat);
  const dLng = toRad(point2.lng - point1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) *
      Math.cos(toRad(point2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDate(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === now.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }
}

function formatDateRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (startStr === endStr) {
    return startStr;
  }
  return `${startStr} - ${endStr}`;
}

function formatTimeRange(start: Date, end: Date): string {
  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const dateStr = formatDate(start);
  return `${dateStr}, ${formatTime(start)} - ${formatTime(end)}`;
}

// Replicated types for badges
type ContextBadgeType =
  | 'free'
  | 'available'
  | 'on_route'
  | 'friend_loves'
  | 'group_friendly'
  | 'before_event'
  | 'after_event'
  | 'walking_distance'
  | 'time_limited';

interface ContextBadge {
  type: ContextBadgeType;
  label: string;
  icon?: string;
  color: string;
  priority: number;
}

interface CalendarEventRef {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
}

interface ScheduleContext {
  type: 'schedule';
  beforeEvent?: CalendarEventRef;
  afterEvent?: CalendarEventRef;
  availableTime: {
    start: Date;
    end: Date;
    durationMinutes: number;
  };
  isOnRoute: boolean;
}

interface RecommendationContext {
  id: string;
  type: 'trip' | 'social' | 'schedule' | 'routine' | 'general';
  title: string;
  subtitle?: string;
  icon: string;
  priority: number;
  metadata: any;
  createdAt: Date;
  expiresAt?: Date;
}

// Badge colors replicated from brand.ts ContextBadgeColors
const BADGE_COLORS: Record<string, string> = {
  free: '#09DB98',
  available: '#00A6D9',
  on_route: '#8B5CF6',
  friend_loves: '#EC4899',
  group_friendly: '#F59E0B',
  before_event: '#6366F1',
  after_event: '#6366F1',
  walking_distance: '#14B8A6',
  time_limited: '#EF4444',
};

/**
 * Replicated generateContextBadges from context-detection.ts line 494
 */
function generateContextBadges(
  recommendation: {
    priceLevel?: number;
    rating?: number;
    distance?: number;
    openNow?: boolean;
  },
  context?: RecommendationContext,
  userCalendar?: CalendarEventRef[]
): ContextBadge[] {
  const badges: ContextBadge[] = [];

  // FREE badge
  if (recommendation.priceLevel === 0) {
    badges.push({
      type: 'free',
      label: 'FREE',
      color: BADGE_COLORS.free,
      priority: 1,
    });
  }

  // Walking distance badge
  if (recommendation.distance && recommendation.distance < 0.5) {
    badges.push({
      type: 'walking_distance',
      label: 'Walking distance',
      icon: 'walk',
      color: BADGE_COLORS.walking_distance,
      priority: 2,
    });
  }

  // Before/After event badges for schedule context
  if (context?.type === 'schedule') {
    const scheduleCtx = context.metadata as ScheduleContext;

    if (scheduleCtx.beforeEvent) {
      badges.push({
        type: 'after_event',
        label: `After ${scheduleCtx.beforeEvent.title}`,
        icon: 'time',
        color: BADGE_COLORS.after_event,
        priority: 3,
      });
    }

    if (scheduleCtx.afterEvent) {
      badges.push({
        type: 'before_event',
        label: `Before ${scheduleCtx.afterEvent.title}`,
        icon: 'time',
        color: BADGE_COLORS.before_event,
        priority: 4,
      });
    }

    if (scheduleCtx.isOnRoute) {
      badges.push({
        type: 'on_route',
        label: 'On your route',
        icon: 'navigate',
        color: BADGE_COLORS.on_route,
        priority: 5,
      });
    }
  }

  // Group-friendly badge for social context
  if (context?.type === 'social') {
    badges.push({
      type: 'group_friendly',
      label: 'Group-friendly',
      icon: 'people',
      color: BADGE_COLORS.group_friendly,
      priority: 6,
    });
  }

  // Sort by priority
  badges.sort((a, b) => a.priority - b.priority);

  // Limit to top 3 badges
  return badges.slice(0, 3);
}

/**
 * Replicated detectScheduleGaps from context-detection.ts line 405
 */
interface CalendarEventWithLocation {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: { latitude: number; longitude: number } | null;
  address?: string;
}

function detectScheduleGaps(
  events: CalendarEventWithLocation[],
  userLocation?: { lat: number; lng: number }
): ScheduleContext[] {
  const gaps: ScheduleContext[] = [];

  // Sort events by start time
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const current = sortedEvents[i];
    const next = sortedEvents[i + 1];

    const gapStart = new Date(current.end_time);
    const gapEnd = new Date(next.start_time);
    const durationMinutes = (gapEnd.getTime() - gapStart.getTime()) / (1000 * 60);

    // Only consider significant gaps
    if (durationMinutes < MIN_GAP_DURATION) continue;

    // Check if this is an "on route" gap
    let isOnRoute = false;
    if (current.location && next.location) {
      const currentLoc = {
        lat: current.location.latitude,
        lng: current.location.longitude,
      };
      const nextLoc = {
        lat: next.location.latitude,
        lng: next.location.longitude,
      };
      const distance = calculateDistance(currentLoc, nextLoc);
      isOnRoute = distance > 1 && distance < 30;
    }

    const beforeEvent: CalendarEventRef = {
      id: current.id,
      title: current.title,
      startTime: new Date(current.start_time),
      endTime: new Date(current.end_time),
      location: current.location
        ? {
            lat: current.location.latitude,
            lng: current.location.longitude,
            address: current.address || '',
          }
        : undefined,
    };

    const afterEvent: CalendarEventRef = {
      id: next.id,
      title: next.title,
      startTime: new Date(next.start_time),
      endTime: new Date(next.end_time),
      location: next.location
        ? {
            lat: next.location.latitude,
            lng: next.location.longitude,
            address: next.address || '',
          }
        : undefined,
    };

    gaps.push({
      type: 'schedule',
      beforeEvent,
      afterEvent,
      availableTime: {
        start: gapStart,
        end: gapEnd,
        durationMinutes,
      },
      isOnRoute,
    });
  }

  return gaps;
}

/**
 * Replicated social context keyword/occasion/group detection logic
 * from context-detection.ts lines 338-393
 */
function detectSocialSignals(
  eventTitle: string,
  friendNames: string[]
): {
  isSocial: boolean;
  mentionedFriends: string[];
  occasion?: string;
  groupName?: string;
} {
  const titleLower = eventTitle.toLowerCase();

  // Check if event title contains friend names
  const mentionedFriends = friendNames.filter((name: string) =>
    titleLower.includes(name.toLowerCase())
  );

  // Check for group keywords
  const groupKeywords = [
    'family',
    'friends',
    'dinner with',
    'lunch with',
    'meeting with',
    'birthday',
    'reunion',
    'visit',
    'party',
  ];
  const matchedKeyword = groupKeywords.find((keyword) =>
    titleLower.includes(keyword)
  );

  const isSocial = mentionedFriends.length > 0 || !!matchedKeyword;

  if (!isSocial) {
    return { isSocial: false, mentionedFriends: [] };
  }

  // Determine occasion from title
  let occasion: string | undefined;
  if (titleLower.includes('birthday')) occasion = 'Birthday';
  else if (titleLower.includes('reunion')) occasion = 'Reunion';
  else if (titleLower.includes('visit')) occasion = 'Visit';
  else if (titleLower.includes('dinner')) occasion = 'Dinner';
  else if (titleLower.includes('lunch')) occasion = 'Lunch';
  else if (titleLower.includes('party')) occasion = 'Party';

  // Determine group name
  let groupName: string | undefined;
  if (titleLower.includes('family')) groupName = 'Family';
  else if (titleLower.includes('college')) groupName = 'College Friends';
  else if (titleLower.includes('work')) groupName = 'Work Friends';
  else if (mentionedFriends.length > 0) {
    groupName =
      mentionedFriends.length > 2
        ? `${mentionedFriends[0]} and others`
        : mentionedFriends.join(' & ');
  }

  return { isSocial, mentionedFriends, occasion, groupName };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Context Detection Service - Pure Logic', () => {
  // ==========================================================================
  // CALCULATE DISTANCE (Haversine formula)
  // ==========================================================================
  describe('calculateDistance', () => {
    it('should return 0 for identical points', () => {
      const point = { lat: 32.7767, lng: -96.7970 }; // Dallas
      const dist = calculateDistance(point, point);
      expect(dist).toBeCloseTo(0, 5);
    });

    it('should calculate short distance correctly (~15 miles Dallas to Plano)', () => {
      const dallas = { lat: 32.7767, lng: -96.7970 };
      const plano = { lat: 33.0198, lng: -96.6989 };
      const dist = calculateDistance(dallas, plano);
      // Dallas to Plano is approximately 17-18 miles
      expect(dist).toBeGreaterThan(15);
      expect(dist).toBeLessThan(20);
    });

    it('should calculate medium distance correctly (~200 miles Dallas to Houston)', () => {
      const dallas = { lat: 32.7767, lng: -96.7970 };
      const houston = { lat: 29.7604, lng: -95.3698 };
      const dist = calculateDistance(dallas, houston);
      // Dallas to Houston is approximately 225-240 miles
      expect(dist).toBeGreaterThan(220);
      expect(dist).toBeLessThan(250);
    });

    it('should calculate long distance correctly (~1500 miles Dallas to NYC)', () => {
      const dallas = { lat: 32.7767, lng: -96.7970 };
      const nyc = { lat: 40.7128, lng: -74.0060 };
      const dist = calculateDistance(dallas, nyc);
      // Dallas to NYC is approximately 1,370-1,400 miles
      expect(dist).toBeGreaterThan(1350);
      expect(dist).toBeLessThan(1420);
    });

    it('should be symmetric (A->B === B->A)', () => {
      const dallas = { lat: 32.7767, lng: -96.7970 };
      const austin = { lat: 30.2672, lng: -97.7431 };
      const distAB = calculateDistance(dallas, austin);
      const distBA = calculateDistance(austin, dallas);
      expect(distAB).toBeCloseTo(distBA, 10);
    });

    it('should handle zero latitude difference', () => {
      const a = { lat: 32.7767, lng: -96.7970 };
      const b = { lat: 32.7767, lng: -97.7970 };
      const dist = calculateDistance(a, b);
      expect(dist).toBeGreaterThan(0);
      // ~1 degree longitude at ~33N latitude is roughly 52 miles
      expect(dist).toBeGreaterThan(45);
      expect(dist).toBeLessThan(60);
    });

    it('should handle zero longitude difference', () => {
      const a = { lat: 32.0, lng: -96.7970 };
      const b = { lat: 33.0, lng: -96.7970 };
      const dist = calculateDistance(a, b);
      // 1 degree latitude is approximately 69 miles
      expect(dist).toBeGreaterThan(65);
      expect(dist).toBeLessThan(72);
    });

    it('should handle negative latitudes (southern hemisphere)', () => {
      const sydney = { lat: -33.8688, lng: 151.2093 };
      const melbourne = { lat: -37.8136, lng: 144.9631 };
      const dist = calculateDistance(sydney, melbourne);
      // Sydney to Melbourne is approximately 440-460 miles
      expect(dist).toBeGreaterThan(430);
      expect(dist).toBeLessThan(475);
    });

    it('should handle crossing the equator', () => {
      const bogota = { lat: 4.7110, lng: -74.0721 };
      const lima = { lat: -12.0464, lng: -77.0428 };
      const dist = calculateDistance(bogota, lima);
      expect(dist).toBeGreaterThan(1100);
      expect(dist).toBeLessThan(1200);
    });

    it('should handle very small distances (<1 mile)', () => {
      // Two points ~0.3 miles apart
      const a = { lat: 32.7767, lng: -96.7970 };
      const b = { lat: 32.7800, lng: -96.7940 };
      const dist = calculateDistance(a, b);
      expect(dist).toBeGreaterThan(0);
      expect(dist).toBeLessThan(1);
    });
  });

  // ==========================================================================
  // TRIP DISTANCE THRESHOLD
  // ==========================================================================
  describe('Trip distance threshold', () => {
    it('should be 50 miles', () => {
      expect(TRIP_DISTANCE_THRESHOLD).toBe(50);
    });

    it('should classify Dallas to Plano as NOT a trip (< 50 miles)', () => {
      const dallas = { lat: 32.7767, lng: -96.7970 };
      const plano = { lat: 33.0198, lng: -96.6989 };
      const dist = calculateDistance(dallas, plano);
      expect(dist).toBeLessThan(TRIP_DISTANCE_THRESHOLD);
    });

    it('should classify Dallas to Austin as a trip (> 50 miles)', () => {
      const dallas = { lat: 32.7767, lng: -96.7970 };
      const austin = { lat: 30.2672, lng: -97.7431 };
      const dist = calculateDistance(dallas, austin);
      expect(dist).toBeGreaterThan(TRIP_DISTANCE_THRESHOLD);
    });

    it('should classify Dallas to Waco as borderline trip (~90 miles)', () => {
      const dallas = { lat: 32.7767, lng: -96.7970 };
      const waco = { lat: 31.5493, lng: -97.1467 };
      const dist = calculateDistance(dallas, waco);
      expect(dist).toBeGreaterThan(TRIP_DISTANCE_THRESHOLD);
    });
  });

  // ==========================================================================
  // FORMAT DATE
  // ==========================================================================
  describe('formatDate', () => {
    it('should return "Today" for current date', () => {
      const today = new Date();
      expect(formatDate(today)).toBe('Today');
    });

    it('should return "Tomorrow" for next day', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(formatDate(tomorrow)).toBe('Tomorrow');
    });

    it('should return formatted date for future dates', () => {
      // Use a date far enough in the future to not be today/tomorrow
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const result = formatDate(futureDate);
      // Should not be "Today" or "Tomorrow"
      expect(result).not.toBe('Today');
      expect(result).not.toBe('Tomorrow');
      // Should contain a month abbreviation
      expect(result).toMatch(/\w{3}/);
    });

    it('should return formatted date for past dates', () => {
      const past = new Date();
      past.setDate(past.getDate() - 5);
      const result = formatDate(past);
      expect(result).not.toBe('Today');
      expect(result).not.toBe('Tomorrow');
    });
  });

  // ==========================================================================
  // FORMAT DATE RANGE
  // ==========================================================================
  describe('formatDateRange', () => {
    it('should return single date string when start and end are the same day', () => {
      const date = new Date('2026-03-15T10:00:00');
      const result = formatDateRange(date, date);
      expect(result).toContain('Mar');
      expect(result).toContain('15');
      // Should NOT contain a dash separator
      expect(result).not.toContain(' - ');
    });

    it('should return range when start and end are different days', () => {
      const start = new Date('2026-03-15T10:00:00');
      const end = new Date('2026-03-18T10:00:00');
      const result = formatDateRange(start, end);
      expect(result).toContain('Mar 15');
      expect(result).toContain('Mar 18');
      expect(result).toContain(' - ');
    });

    it('should handle cross-month ranges', () => {
      const start = new Date('2026-03-28T10:00:00');
      const end = new Date('2026-04-02T10:00:00');
      const result = formatDateRange(start, end);
      expect(result).toContain('Mar');
      expect(result).toContain('Apr');
      expect(result).toContain(' - ');
    });

    it('should handle same-day start and end with different times', () => {
      const start = new Date('2026-03-15T09:00:00');
      const end = new Date('2026-03-15T17:00:00');
      const result = formatDateRange(start, end);
      // Same date, so no dash
      expect(result).not.toContain(' - ');
    });
  });

  // ==========================================================================
  // FORMAT TIME RANGE
  // ==========================================================================
  describe('formatTimeRange', () => {
    it('should include date label and time range', () => {
      const now = new Date();
      const start = new Date(now);
      start.setHours(14, 0, 0, 0);
      const end = new Date(now);
      end.setHours(16, 0, 0, 0);
      const result = formatTimeRange(start, end);
      // Should contain "Today" since we use current date
      expect(result).toContain('Today');
      // Should contain a dash separator for the time range
      expect(result).toContain(' - ');
    });

    it('should format tomorrow time range correctly', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const start = new Date(tomorrow);
      start.setHours(10, 0, 0, 0);
      const end = new Date(tomorrow);
      end.setHours(12, 0, 0, 0);
      const result = formatTimeRange(start, end);
      expect(result).toContain('Tomorrow');
      expect(result).toContain(' - ');
    });

    it('should format future date time range with formatted date', () => {
      const future = new Date();
      future.setDate(future.getDate() + 7);
      const start = new Date(future);
      start.setHours(9, 0, 0, 0);
      const end = new Date(future);
      end.setHours(11, 30, 0, 0);
      const result = formatTimeRange(start, end);
      // Should not be "Today" or "Tomorrow"
      expect(result).not.toContain('Today');
      expect(result).not.toContain('Tomorrow');
      expect(result).toContain(' - ');
    });
  });

  // ==========================================================================
  // DETECT SCHEDULE GAPS
  // ==========================================================================
  describe('detectScheduleGaps', () => {
    it('should return empty array for no events', () => {
      const gaps = detectScheduleGaps([]);
      expect(gaps).toEqual([]);
    });

    it('should return empty array for a single event', () => {
      const events: CalendarEventWithLocation[] = [
        {
          id: '1',
          title: 'Meeting',
          start_time: '2026-03-15T09:00:00Z',
          end_time: '2026-03-15T10:00:00Z',
        },
      ];
      const gaps = detectScheduleGaps(events);
      expect(gaps).toEqual([]);
    });

    it('should detect a gap >= 60 minutes between two events', () => {
      const events: CalendarEventWithLocation[] = [
        {
          id: '1',
          title: 'Morning Meeting',
          start_time: '2026-03-15T09:00:00Z',
          end_time: '2026-03-15T10:00:00Z',
        },
        {
          id: '2',
          title: 'Lunch',
          start_time: '2026-03-15T12:00:00Z',
          end_time: '2026-03-15T13:00:00Z',
        },
      ];
      const gaps = detectScheduleGaps(events);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].availableTime.durationMinutes).toBe(120);
      expect(gaps[0].beforeEvent?.title).toBe('Morning Meeting');
      expect(gaps[0].afterEvent?.title).toBe('Lunch');
    });

    it('should ignore gaps shorter than MIN_GAP_DURATION (60 min)', () => {
      const events: CalendarEventWithLocation[] = [
        {
          id: '1',
          title: 'Event A',
          start_time: '2026-03-15T09:00:00Z',
          end_time: '2026-03-15T10:00:00Z',
        },
        {
          id: '2',
          title: 'Event B',
          start_time: '2026-03-15T10:30:00Z', // Only 30 min gap
          end_time: '2026-03-15T11:30:00Z',
        },
      ];
      const gaps = detectScheduleGaps(events);
      expect(gaps).toHaveLength(0);
    });

    it('should detect exactly 60-minute gap (boundary)', () => {
      const events: CalendarEventWithLocation[] = [
        {
          id: '1',
          title: 'Event A',
          start_time: '2026-03-15T09:00:00Z',
          end_time: '2026-03-15T10:00:00Z',
        },
        {
          id: '2',
          title: 'Event B',
          start_time: '2026-03-15T11:00:00Z', // Exactly 60 min gap
          end_time: '2026-03-15T12:00:00Z',
        },
      ];
      const gaps = detectScheduleGaps(events);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].availableTime.durationMinutes).toBe(60);
    });

    it('should reject 59-minute gap (just under boundary)', () => {
      const events: CalendarEventWithLocation[] = [
        {
          id: '1',
          title: 'Event A',
          start_time: '2026-03-15T09:00:00Z',
          end_time: '2026-03-15T10:00:00Z',
        },
        {
          id: '2',
          title: 'Event B',
          start_time: '2026-03-15T10:59:00Z', // 59 min gap
          end_time: '2026-03-15T12:00:00Z',
        },
      ];
      const gaps = detectScheduleGaps(events);
      expect(gaps).toHaveLength(0);
    });

    it('should detect multiple gaps between 3+ events', () => {
      const events: CalendarEventWithLocation[] = [
        {
          id: '1',
          title: 'Morning',
          start_time: '2026-03-15T08:00:00Z',
          end_time: '2026-03-15T09:00:00Z',
        },
        {
          id: '2',
          title: 'Mid-morning',
          start_time: '2026-03-15T11:00:00Z', // 2-hour gap
          end_time: '2026-03-15T12:00:00Z',
        },
        {
          id: '3',
          title: 'Afternoon',
          start_time: '2026-03-15T14:00:00Z', // 2-hour gap
          end_time: '2026-03-15T15:00:00Z',
        },
      ];
      const gaps = detectScheduleGaps(events);
      expect(gaps).toHaveLength(2);
      expect(gaps[0].availableTime.durationMinutes).toBe(120);
      expect(gaps[1].availableTime.durationMinutes).toBe(120);
    });

    it('should sort unsorted events by start_time before processing', () => {
      const events: CalendarEventWithLocation[] = [
        {
          id: '2',
          title: 'Later Event',
          start_time: '2026-03-15T14:00:00Z',
          end_time: '2026-03-15T15:00:00Z',
        },
        {
          id: '1',
          title: 'Earlier Event',
          start_time: '2026-03-15T09:00:00Z',
          end_time: '2026-03-15T10:00:00Z',
        },
      ];
      const gaps = detectScheduleGaps(events);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].beforeEvent?.title).toBe('Earlier Event');
      expect(gaps[0].afterEvent?.title).toBe('Later Event');
    });

    it('should handle back-to-back events (zero gap)', () => {
      const events: CalendarEventWithLocation[] = [
        {
          id: '1',
          title: 'Event A',
          start_time: '2026-03-15T09:00:00Z',
          end_time: '2026-03-15T10:00:00Z',
        },
        {
          id: '2',
          title: 'Event B',
          start_time: '2026-03-15T10:00:00Z',
          end_time: '2026-03-15T11:00:00Z',
        },
      ];
      const gaps = detectScheduleGaps(events);
      expect(gaps).toHaveLength(0);
    });

    it('should handle overlapping events (negative gap)', () => {
      const events: CalendarEventWithLocation[] = [
        {
          id: '1',
          title: 'Event A',
          start_time: '2026-03-15T09:00:00Z',
          end_time: '2026-03-15T11:00:00Z',
        },
        {
          id: '2',
          title: 'Event B',
          start_time: '2026-03-15T10:00:00Z', // Overlaps event A
          end_time: '2026-03-15T12:00:00Z',
        },
      ];
      const gaps = detectScheduleGaps(events);
      // Negative duration should be below MIN_GAP_DURATION, so no gap
      expect(gaps).toHaveLength(0);
    });

    it('should set isOnRoute = true when events are 1-30 miles apart', () => {
      const events: CalendarEventWithLocation[] = [
        {
          id: '1',
          title: 'Office Meeting',
          start_time: '2026-03-15T09:00:00Z',
          end_time: '2026-03-15T10:00:00Z',
          location: { latitude: 32.7767, longitude: -96.7970 }, // Dallas
        },
        {
          id: '2',
          title: 'Client Visit',
          start_time: '2026-03-15T12:00:00Z',
          end_time: '2026-03-15T13:00:00Z',
          location: { latitude: 33.0198, longitude: -96.6989 }, // Plano (~17 mi)
        },
      ];
      const gaps = detectScheduleGaps(events);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].isOnRoute).toBe(true);
    });

    it('should set isOnRoute = false when events are < 1 mile apart', () => {
      const events: CalendarEventWithLocation[] = [
        {
          id: '1',
          title: 'Event A',
          start_time: '2026-03-15T09:00:00Z',
          end_time: '2026-03-15T10:00:00Z',
          location: { latitude: 32.7767, longitude: -96.7970 },
        },
        {
          id: '2',
          title: 'Event B',
          start_time: '2026-03-15T12:00:00Z',
          end_time: '2026-03-15T13:00:00Z',
          location: { latitude: 32.7770, longitude: -96.7975 }, // Very close
        },
      ];
      const gaps = detectScheduleGaps(events);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].isOnRoute).toBe(false);
    });

    it('should set isOnRoute = false when events are > 30 miles apart', () => {
      const events: CalendarEventWithLocation[] = [
        {
          id: '1',
          title: 'Event A',
          start_time: '2026-03-15T09:00:00Z',
          end_time: '2026-03-15T10:00:00Z',
          location: { latitude: 32.7767, longitude: -96.7970 }, // Dallas
        },
        {
          id: '2',
          title: 'Event B',
          start_time: '2026-03-15T14:00:00Z',
          end_time: '2026-03-15T15:00:00Z',
          location: { latitude: 30.2672, longitude: -97.7431 }, // Austin (~180 mi)
        },
      ];
      const gaps = detectScheduleGaps(events);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].isOnRoute).toBe(false);
    });

    it('should set isOnRoute = false when events have no location', () => {
      const events: CalendarEventWithLocation[] = [
        {
          id: '1',
          title: 'Event A',
          start_time: '2026-03-15T09:00:00Z',
          end_time: '2026-03-15T10:00:00Z',
        },
        {
          id: '2',
          title: 'Event B',
          start_time: '2026-03-15T12:00:00Z',
          end_time: '2026-03-15T13:00:00Z',
        },
      ];
      const gaps = detectScheduleGaps(events);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].isOnRoute).toBe(false);
    });

    it('should set isOnRoute = false when only one event has location', () => {
      const events: CalendarEventWithLocation[] = [
        {
          id: '1',
          title: 'Event A',
          start_time: '2026-03-15T09:00:00Z',
          end_time: '2026-03-15T10:00:00Z',
          location: { latitude: 32.7767, longitude: -96.7970 },
        },
        {
          id: '2',
          title: 'Event B',
          start_time: '2026-03-15T12:00:00Z',
          end_time: '2026-03-15T13:00:00Z',
          location: null,
        },
      ];
      const gaps = detectScheduleGaps(events);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].isOnRoute).toBe(false);
    });

    it('should populate beforeEvent and afterEvent CalendarEventRef fields', () => {
      const events: CalendarEventWithLocation[] = [
        {
          id: 'evt-1',
          title: 'Standup',
          start_time: '2026-03-15T09:00:00Z',
          end_time: '2026-03-15T09:30:00Z',
          location: { latitude: 32.77, longitude: -96.79 },
          address: '123 Main St',
        },
        {
          id: 'evt-2',
          title: 'Workshop',
          start_time: '2026-03-15T12:00:00Z',
          end_time: '2026-03-15T14:00:00Z',
          location: { latitude: 32.78, longitude: -96.80 },
          address: '456 Oak Ave',
        },
      ];
      const gaps = detectScheduleGaps(events);
      expect(gaps).toHaveLength(1);

      const gap = gaps[0];
      expect(gap.beforeEvent?.id).toBe('evt-1');
      expect(gap.beforeEvent?.title).toBe('Standup');
      expect(gap.beforeEvent?.location?.address).toBe('123 Main St');

      expect(gap.afterEvent?.id).toBe('evt-2');
      expect(gap.afterEvent?.title).toBe('Workshop');
      expect(gap.afterEvent?.location?.address).toBe('456 Oak Ave');
    });

    it('should set empty address string when event has location but no address', () => {
      const events: CalendarEventWithLocation[] = [
        {
          id: '1',
          title: 'A',
          start_time: '2026-03-15T09:00:00Z',
          end_time: '2026-03-15T10:00:00Z',
          location: { latitude: 32.77, longitude: -96.79 },
          // no address field
        },
        {
          id: '2',
          title: 'B',
          start_time: '2026-03-15T12:00:00Z',
          end_time: '2026-03-15T13:00:00Z',
        },
      ];
      const gaps = detectScheduleGaps(events);
      expect(gaps[0].beforeEvent?.location?.address).toBe('');
    });
  });

  // ==========================================================================
  // GENERATE CONTEXT BADGES
  // ==========================================================================
  describe('generateContextBadges', () => {
    describe('FREE badge', () => {
      it('should add FREE badge when priceLevel is 0', () => {
        const badges = generateContextBadges({ priceLevel: 0 });
        expect(badges).toHaveLength(1);
        expect(badges[0].type).toBe('free');
        expect(badges[0].label).toBe('FREE');
        expect(badges[0].color).toBe(BADGE_COLORS.free);
        expect(badges[0].priority).toBe(1);
      });

      it('should NOT add FREE badge when priceLevel is 1', () => {
        const badges = generateContextBadges({ priceLevel: 1 });
        const freeBadge = badges.find((b) => b.type === 'free');
        expect(freeBadge).toBeUndefined();
      });

      it('should NOT add FREE badge when priceLevel is undefined', () => {
        const badges = generateContextBadges({});
        const freeBadge = badges.find((b) => b.type === 'free');
        expect(freeBadge).toBeUndefined();
      });

      it('should NOT add FREE badge when priceLevel is 2', () => {
        const badges = generateContextBadges({ priceLevel: 2 });
        expect(badges).toHaveLength(0);
      });
    });

    describe('Walking distance badge', () => {
      it('should add walking distance badge when distance < 0.5', () => {
        const badges = generateContextBadges({ distance: 0.3 });
        expect(badges).toHaveLength(1);
        expect(badges[0].type).toBe('walking_distance');
        expect(badges[0].label).toBe('Walking distance');
        expect(badges[0].icon).toBe('walk');
        expect(badges[0].color).toBe(BADGE_COLORS.walking_distance);
      });

      it('should NOT add walking distance badge when distance is exactly 0.5', () => {
        const badges = generateContextBadges({ distance: 0.5 });
        const walkBadge = badges.find((b) => b.type === 'walking_distance');
        expect(walkBadge).toBeUndefined();
      });

      it('should NOT add walking distance badge when distance > 0.5', () => {
        const badges = generateContextBadges({ distance: 1.2 });
        const walkBadge = badges.find((b) => b.type === 'walking_distance');
        expect(walkBadge).toBeUndefined();
      });

      it('should NOT add walking distance badge when distance is 0', () => {
        // distance of 0 is falsy, so the condition `recommendation.distance && ...` fails
        const badges = generateContextBadges({ distance: 0 });
        const walkBadge = badges.find((b) => b.type === 'walking_distance');
        expect(walkBadge).toBeUndefined();
      });

      it('should NOT add walking distance badge when distance is undefined', () => {
        const badges = generateContextBadges({});
        const walkBadge = badges.find((b) => b.type === 'walking_distance');
        expect(walkBadge).toBeUndefined();
      });

      it('should add walking distance badge for very small distance (0.1)', () => {
        const badges = generateContextBadges({ distance: 0.1 });
        expect(badges).toHaveLength(1);
        expect(badges[0].type).toBe('walking_distance');
      });
    });

    describe('Schedule context badges', () => {
      const makeScheduleContext = (opts: {
        beforeEvent?: CalendarEventRef;
        afterEvent?: CalendarEventRef;
        isOnRoute?: boolean;
      }): RecommendationContext => ({
        id: 'schedule-1',
        type: 'schedule',
        title: 'Between events',
        icon: '⏰',
        priority: 30,
        metadata: {
          type: 'schedule',
          beforeEvent: opts.beforeEvent,
          afterEvent: opts.afterEvent,
          availableTime: {
            start: new Date(),
            end: new Date(),
            durationMinutes: 120,
          },
          isOnRoute: opts.isOnRoute || false,
        } as ScheduleContext,
        createdAt: new Date(),
      });

      it('should add after_event badge when schedule context has beforeEvent', () => {
        const context = makeScheduleContext({
          beforeEvent: {
            id: '1',
            title: 'Team Standup',
            startTime: new Date(),
            endTime: new Date(),
          },
        });
        const badges = generateContextBadges({}, context);
        const afterBadge = badges.find((b) => b.type === 'after_event');
        expect(afterBadge).toBeDefined();
        expect(afterBadge!.label).toBe('After Team Standup');
        expect(afterBadge!.color).toBe(BADGE_COLORS.after_event);
      });

      it('should add before_event badge when schedule context has afterEvent', () => {
        const context = makeScheduleContext({
          afterEvent: {
            id: '2',
            title: 'Dinner Reservation',
            startTime: new Date(),
            endTime: new Date(),
          },
        });
        const badges = generateContextBadges({}, context);
        const beforeBadge = badges.find((b) => b.type === 'before_event');
        expect(beforeBadge).toBeDefined();
        expect(beforeBadge!.label).toBe('Before Dinner Reservation');
        expect(beforeBadge!.color).toBe(BADGE_COLORS.before_event);
      });

      it('should add on_route badge when schedule context isOnRoute is true', () => {
        const context = makeScheduleContext({ isOnRoute: true });
        const badges = generateContextBadges({}, context);
        const routeBadge = badges.find((b) => b.type === 'on_route');
        expect(routeBadge).toBeDefined();
        expect(routeBadge!.label).toBe('On your route');
        expect(routeBadge!.icon).toBe('navigate');
        expect(routeBadge!.color).toBe(BADGE_COLORS.on_route);
      });

      it('should NOT add on_route badge when isOnRoute is false', () => {
        const context = makeScheduleContext({ isOnRoute: false });
        const badges = generateContextBadges({}, context);
        const routeBadge = badges.find((b) => b.type === 'on_route');
        expect(routeBadge).toBeUndefined();
      });

      it('should add both after_event and before_event badges when both events exist', () => {
        const context = makeScheduleContext({
          beforeEvent: {
            id: '1',
            title: 'Morning Meeting',
            startTime: new Date(),
            endTime: new Date(),
          },
          afterEvent: {
            id: '2',
            title: 'Yoga Class',
            startTime: new Date(),
            endTime: new Date(),
          },
        });
        const badges = generateContextBadges({}, context);
        expect(badges.find((b) => b.type === 'after_event')).toBeDefined();
        expect(badges.find((b) => b.type === 'before_event')).toBeDefined();
      });
    });

    describe('Social context badges', () => {
      const makeSocialContext = (): RecommendationContext => ({
        id: 'social-1',
        type: 'social',
        title: 'With Family',
        icon: '👥',
        priority: 15,
        metadata: {
          type: 'social',
          groupName: 'Family',
          participants: ['alice', 'bob'],
          date: new Date(),
        },
        createdAt: new Date(),
      });

      it('should add group_friendly badge for social context', () => {
        const context = makeSocialContext();
        const badges = generateContextBadges({}, context);
        expect(badges).toHaveLength(1);
        expect(badges[0].type).toBe('group_friendly');
        expect(badges[0].label).toBe('Group-friendly');
        expect(badges[0].icon).toBe('people');
        expect(badges[0].color).toBe(BADGE_COLORS.group_friendly);
      });

      it('should NOT add group_friendly badge for non-social context', () => {
        const context: RecommendationContext = {
          id: 'general',
          type: 'general',
          title: 'For You',
          icon: '✨',
          priority: 100,
          metadata: { type: 'general' },
          createdAt: new Date(),
        };
        const badges = generateContextBadges({}, context);
        const groupBadge = badges.find((b) => b.type === 'group_friendly');
        expect(groupBadge).toBeUndefined();
      });
    });

    describe('Badge priority ordering', () => {
      it('should sort badges by priority (lower number first)', () => {
        const context: RecommendationContext = {
          id: 'schedule-1',
          type: 'schedule',
          title: 'Between events',
          icon: '⏰',
          priority: 30,
          metadata: {
            type: 'schedule',
            beforeEvent: {
              id: '1',
              title: 'Meeting',
              startTime: new Date(),
              endTime: new Date(),
            },
            afterEvent: {
              id: '2',
              title: 'Dinner',
              startTime: new Date(),
              endTime: new Date(),
            },
            availableTime: { start: new Date(), end: new Date(), durationMinutes: 120 },
            isOnRoute: true,
          } as ScheduleContext,
          createdAt: new Date(),
        };

        // priceLevel=0 (priority 1) + distance<0.5 (priority 2) + schedule badges
        const badges = generateContextBadges(
          { priceLevel: 0, distance: 0.3 },
          context
        );

        // Should be sorted: free(1), walking_distance(2), after_event(3)
        // Limited to 3
        expect(badges).toHaveLength(3);
        expect(badges[0].type).toBe('free');
        expect(badges[1].type).toBe('walking_distance');
        expect(badges[2].type).toBe('after_event');
      });
    });

    describe('Badge limit (max 3)', () => {
      it('should return at most 3 badges even when more qualify', () => {
        const context: RecommendationContext = {
          id: 'schedule-1',
          type: 'schedule',
          title: 'Between events',
          icon: '⏰',
          priority: 30,
          metadata: {
            type: 'schedule',
            beforeEvent: {
              id: '1',
              title: 'Meeting',
              startTime: new Date(),
              endTime: new Date(),
            },
            afterEvent: {
              id: '2',
              title: 'Dinner',
              startTime: new Date(),
              endTime: new Date(),
            },
            availableTime: { start: new Date(), end: new Date(), durationMinutes: 120 },
            isOnRoute: true,
          } as ScheduleContext,
          createdAt: new Date(),
        };

        // 5 potential badges: free + walking + after_event + before_event + on_route
        const badges = generateContextBadges(
          { priceLevel: 0, distance: 0.3 },
          context
        );
        expect(badges.length).toBeLessThanOrEqual(3);
      });

      it('should return empty array when no badges qualify', () => {
        const badges = generateContextBadges({ priceLevel: 2, distance: 5 });
        expect(badges).toHaveLength(0);
      });
    });

    describe('No context provided', () => {
      it('should still return attribute badges without context', () => {
        const badges = generateContextBadges({ priceLevel: 0, distance: 0.2 });
        expect(badges).toHaveLength(2);
        expect(badges[0].type).toBe('free');
        expect(badges[1].type).toBe('walking_distance');
      });

      it('should return empty array for non-qualifying recommendation without context', () => {
        const badges = generateContextBadges({ priceLevel: 3, distance: 10 });
        expect(badges).toHaveLength(0);
      });
    });

    describe('Trip context (no special badge)', () => {
      it('should NOT add special badges for trip context (only attribute badges)', () => {
        const tripContext: RecommendationContext = {
          id: 'trip-nyc',
          type: 'trip',
          title: 'For your NYC trip',
          icon: '🗺️',
          priority: 5,
          metadata: {
            type: 'trip',
            destination: 'New York, NY',
            destinationLocation: { lat: 40.7128, lng: -74.006 },
            startDate: new Date(),
            endDate: new Date(),
            calendarEventIds: [],
            scheduledGaps: [],
          },
          createdAt: new Date(),
        };
        const badges = generateContextBadges({ priceLevel: 1, distance: 2 }, tripContext);
        // No free badge (priceLevel=1), no walking (distance=2), no schedule/social badges
        expect(badges).toHaveLength(0);
      });
    });
  });

  // ==========================================================================
  // SOCIAL CONTEXT DETECTION (keyword matching)
  // ==========================================================================
  describe('detectSocialSignals', () => {
    describe('Friend name matching', () => {
      it('should detect a friend mentioned in event title', () => {
        const result = detectSocialSignals('Dinner with alice', ['alice', 'bob']);
        expect(result.isSocial).toBe(true);
        expect(result.mentionedFriends).toContain('alice');
      });

      it('should detect multiple friends in event title', () => {
        const result = detectSocialSignals('Lunch with alice and bob', ['alice', 'bob']);
        expect(result.isSocial).toBe(true);
        expect(result.mentionedFriends).toHaveLength(2);
        expect(result.mentionedFriends).toContain('alice');
        expect(result.mentionedFriends).toContain('bob');
      });

      it('should be case-insensitive for friend name matching', () => {
        const result = detectSocialSignals('Coffee with Alice', ['alice']);
        expect(result.isSocial).toBe(true);
        expect(result.mentionedFriends).toContain('alice');
      });

      it('should not match if no friends mentioned and no keywords', () => {
        const result = detectSocialSignals('Dentist appointment', ['alice', 'bob']);
        expect(result.isSocial).toBe(false);
        expect(result.mentionedFriends).toHaveLength(0);
      });

      it('should handle empty friend names array', () => {
        const result = detectSocialSignals('Team meeting', []);
        // No friends, but "meeting with" is not in title (it's "Team meeting")
        expect(result.isSocial).toBe(false);
      });
    });

    describe('Group keyword matching', () => {
      const groupKeywordTests = [
        { keyword: 'family', title: 'Family dinner', expectedSocial: true },
        { keyword: 'friends', title: 'Drinks with friends', expectedSocial: true },
        { keyword: 'dinner with', title: 'Dinner with coworkers', expectedSocial: true },
        { keyword: 'lunch with', title: 'Lunch with manager', expectedSocial: true },
        { keyword: 'meeting with', title: 'Meeting with investors', expectedSocial: true },
        { keyword: 'birthday', title: "Sarah's birthday celebration", expectedSocial: true },
        { keyword: 'reunion', title: 'High school reunion', expectedSocial: true },
        { keyword: 'visit', title: 'Visit grandparents', expectedSocial: true },
        { keyword: 'party', title: 'House party', expectedSocial: true },
      ];

      groupKeywordTests.forEach(({ keyword, title, expectedSocial }) => {
        it(`should detect "${keyword}" keyword in "${title}"`, () => {
          const result = detectSocialSignals(title, []);
          expect(result.isSocial).toBe(expectedSocial);
        });
      });

      it('should NOT detect social for unrelated titles', () => {
        const result = detectSocialSignals('Grocery shopping', []);
        expect(result.isSocial).toBe(false);
      });

      it('should NOT detect social for "meeting" alone (needs "meeting with")', () => {
        const result = detectSocialSignals('Board meeting', []);
        expect(result.isSocial).toBe(false);
      });
    });

    describe('Occasion detection', () => {
      it('should detect Birthday occasion', () => {
        const result = detectSocialSignals("Mom's birthday party", []);
        expect(result.occasion).toBe('Birthday');
      });

      it('should detect Reunion occasion', () => {
        const result = detectSocialSignals('College reunion weekend', []);
        expect(result.occasion).toBe('Reunion');
      });

      it('should detect Visit occasion', () => {
        const result = detectSocialSignals('Visit uncle in Austin', []);
        expect(result.occasion).toBe('Visit');
      });

      it('should detect Dinner occasion', () => {
        const result = detectSocialSignals('Dinner with the team', []);
        expect(result.occasion).toBe('Dinner');
      });

      it('should detect Lunch occasion', () => {
        const result = detectSocialSignals('Lunch with mentor', []);
        expect(result.occasion).toBe('Lunch');
      });

      it('should detect Party occasion', () => {
        const result = detectSocialSignals('House party at Jake house', []);
        expect(result.occasion).toBe('Party');
      });

      it('should prioritize Birthday over Party (birthday party)', () => {
        // "birthday" check comes before "party" in the if-else chain
        const result = detectSocialSignals('Birthday party for Sam', []);
        expect(result.occasion).toBe('Birthday');
      });

      it('should have undefined occasion when no specific occasion keyword', () => {
        const result = detectSocialSignals('Hang with friends', []);
        expect(result.isSocial).toBe(true);
        expect(result.occasion).toBeUndefined();
      });
    });

    describe('Group name detection', () => {
      it('should set groupName to "Family" for family events', () => {
        const result = detectSocialSignals('Family brunch', []);
        expect(result.groupName).toBe('Family');
      });

      it('should set groupName to "College Friends" for college events', () => {
        // "college" doesn't trigger social by itself, but "friends" does
        const result = detectSocialSignals('College friends meetup', []);
        // "friends" keyword triggers social, then groupName check for "college"
        expect(result.groupName).toBe('College Friends');
      });

      it('should set groupName to "Work Friends" for work-related social', () => {
        // "work" doesn't trigger social alone, need a keyword like "party"
        const result = detectSocialSignals('Work party', []);
        expect(result.groupName).toBe('Work Friends');
      });

      it('should use friend names as group name when <= 2 friends', () => {
        const result = detectSocialSignals('Hang out with alice and bob tonight', ['alice', 'bob']);
        // Both names found, no family/college/work keyword
        expect(result.groupName).toBe('alice & bob');
      });

      it('should use "X and others" for > 2 friends', () => {
        const result = detectSocialSignals(
          'Road trip with alice bob and charlie',
          ['alice', 'bob', 'charlie']
        );
        expect(result.groupName).toBe('alice and others');
      });

      it('should use single friend name as group name for 1 friend', () => {
        const result = detectSocialSignals('Coffee with alice', ['alice']);
        expect(result.groupName).toBe('alice');
      });

      it('should have undefined groupName when no friends and no group keyword', () => {
        // "dinner with" triggers social but no family/college/work substring and no friends
        const result = detectSocialSignals('Dinner with teammates', []);
        expect(result.groupName).toBeUndefined();
      });

      it('should detect "Work Friends" when title contains "work" substring (e.g., coworkers)', () => {
        // "coworkers" contains "work" as a substring, so includes('work') matches
        const result = detectSocialSignals('Dinner with coworkers', []);
        expect(result.groupName).toBe('Work Friends');
      });

      it('should prioritize "Family" over friend names', () => {
        // "family" keyword check comes before friend name check
        const result = detectSocialSignals('Family dinner with alice', ['alice']);
        expect(result.groupName).toBe('Family');
      });
    });
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================
  describe('Constants', () => {
    it('TRIP_DISTANCE_THRESHOLD should be 50 miles', () => {
      expect(TRIP_DISTANCE_THRESHOLD).toBe(50);
    });

    it('MIN_GAP_DURATION should be 60 minutes', () => {
      expect(MIN_GAP_DURATION).toBe(60);
    });
  });

  // ==========================================================================
  // BADGE COLORS
  // ==========================================================================
  describe('Badge colors', () => {
    it('should have all expected badge types defined', () => {
      const expectedTypes: ContextBadgeType[] = [
        'free',
        'available',
        'on_route',
        'friend_loves',
        'group_friendly',
        'before_event',
        'after_event',
        'walking_distance',
        'time_limited',
      ];
      for (const type of expectedTypes) {
        expect(BADGE_COLORS[type]).toBeDefined();
        expect(typeof BADGE_COLORS[type]).toBe('string');
      }
    });

    it('should have valid hex color codes', () => {
      const hexPattern = /^#[0-9A-Fa-f]{6}$/;
      for (const [type, color] of Object.entries(BADGE_COLORS)) {
        expect(color).toMatch(hexPattern);
      }
    });

    it('before_event and after_event should share the same color (indigo)', () => {
      expect(BADGE_COLORS.before_event).toBe(BADGE_COLORS.after_event);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================
  describe('Edge cases', () => {
    describe('calculateDistance edge cases', () => {
      it('should handle both points at origin (0,0)', () => {
        const dist = calculateDistance({ lat: 0, lng: 0 }, { lat: 0, lng: 0 });
        expect(dist).toBe(0);
      });

      it('should handle antipodal-ish points (very far apart)', () => {
        const northPole = { lat: 89, lng: 0 };
        const southPole = { lat: -89, lng: 0 };
        const dist = calculateDistance(northPole, southPole);
        // Half circumference is ~12,450 miles; 178 degrees is close
        expect(dist).toBeGreaterThan(12000);
      });

      it('should handle points crossing the international date line', () => {
        const tokyo = { lat: 35.6762, lng: 139.6503 };
        const losAngeles = { lat: 34.0522, lng: -118.2437 };
        const dist = calculateDistance(tokyo, losAngeles);
        // Tokyo to LA is approximately 5,450-5,500 miles
        expect(dist).toBeGreaterThan(5400);
        expect(dist).toBeLessThan(5600);
      });
    });

    describe('detectScheduleGaps edge cases', () => {
      it('should handle events with null locations', () => {
        const events: CalendarEventWithLocation[] = [
          {
            id: '1',
            title: 'A',
            start_time: '2026-03-15T09:00:00Z',
            end_time: '2026-03-15T10:00:00Z',
            location: null,
          },
          {
            id: '2',
            title: 'B',
            start_time: '2026-03-15T12:00:00Z',
            end_time: '2026-03-15T13:00:00Z',
            location: null,
          },
        ];
        const gaps = detectScheduleGaps(events);
        expect(gaps).toHaveLength(1);
        expect(gaps[0].isOnRoute).toBe(false);
      });

      it('should handle very large gap (all day)', () => {
        const events: CalendarEventWithLocation[] = [
          {
            id: '1',
            title: 'Early',
            start_time: '2026-03-15T06:00:00Z',
            end_time: '2026-03-15T07:00:00Z',
          },
          {
            id: '2',
            title: 'Late',
            start_time: '2026-03-15T22:00:00Z',
            end_time: '2026-03-15T23:00:00Z',
          },
        ];
        const gaps = detectScheduleGaps(events);
        expect(gaps).toHaveLength(1);
        expect(gaps[0].availableTime.durationMinutes).toBe(900); // 15 hours = 900 min
      });

      it('should handle events spanning multiple days', () => {
        const events: CalendarEventWithLocation[] = [
          {
            id: '1',
            title: 'Monday',
            start_time: '2026-03-15T09:00:00Z',
            end_time: '2026-03-15T10:00:00Z',
          },
          {
            id: '2',
            title: 'Wednesday',
            start_time: '2026-03-17T09:00:00Z',
            end_time: '2026-03-17T10:00:00Z',
          },
        ];
        const gaps = detectScheduleGaps(events);
        expect(gaps).toHaveLength(1);
        // 2 days = 2880 minutes minus 1 hour = 2820 minutes gap
        expect(gaps[0].availableTime.durationMinutes).toBe(47 * 60); // 47 hours
      });
    });

    describe('generateContextBadges edge cases', () => {
      it('should handle empty recommendation object', () => {
        const badges = generateContextBadges({});
        expect(badges).toHaveLength(0);
      });

      it('should handle recommendation with all undefined fields', () => {
        const badges = generateContextBadges({
          priceLevel: undefined,
          rating: undefined,
          distance: undefined,
          openNow: undefined,
        });
        expect(badges).toHaveLength(0);
      });

      it('should handle priceLevel=0 and distance=0.01 together', () => {
        const badges = generateContextBadges({ priceLevel: 0, distance: 0.01 });
        expect(badges).toHaveLength(2);
        expect(badges[0].type).toBe('free');
        expect(badges[1].type).toBe('walking_distance');
      });

      it('should handle schedule context with no events and no on_route', () => {
        const context: RecommendationContext = {
          id: 'schedule-empty',
          type: 'schedule',
          title: 'Free time',
          icon: '⏰',
          priority: 30,
          metadata: {
            type: 'schedule',
            beforeEvent: undefined,
            afterEvent: undefined,
            availableTime: { start: new Date(), end: new Date(), durationMinutes: 60 },
            isOnRoute: false,
          } as ScheduleContext,
          createdAt: new Date(),
        };
        const badges = generateContextBadges({}, context);
        expect(badges).toHaveLength(0);
      });
    });

    describe('detectSocialSignals edge cases', () => {
      it('should handle empty title', () => {
        const result = detectSocialSignals('', ['alice']);
        expect(result.isSocial).toBe(false);
      });

      it('should handle title with only whitespace', () => {
        const result = detectSocialSignals('   ', []);
        expect(result.isSocial).toBe(false);
      });

      it('should handle very long title', () => {
        const longTitle = 'Birthday party with family and friends reunion visit ' +
          'dinner lunch meeting with everyone at the party';
        const result = detectSocialSignals(longTitle, []);
        expect(result.isSocial).toBe(true);
        // "birthday" comes first in occasion check
        expect(result.occasion).toBe('Birthday');
        // "family" comes first in group name check
        expect(result.groupName).toBe('Family');
      });

      it('should handle partial keyword match (e.g., "reunioned" contains "reunion")', () => {
        const result = detectSocialSignals('We reunioned last week', []);
        expect(result.isSocial).toBe(true);
        expect(result.occasion).toBe('Reunion');
      });

      it('should handle friend name as substring of another word', () => {
        // "art" is substring of "party"
        const result = detectSocialSignals('Art exhibition', ['art']);
        expect(result.isSocial).toBe(true);
        expect(result.mentionedFriends).toContain('art');
      });
    });
  });

  // ==========================================================================
  // HELPER: toRad
  // ==========================================================================
  describe('toRad', () => {
    it('should convert 0 degrees to 0 radians', () => {
      expect(toRad(0)).toBe(0);
    });

    it('should convert 180 degrees to PI radians', () => {
      expect(toRad(180)).toBeCloseTo(Math.PI, 10);
    });

    it('should convert 90 degrees to PI/2 radians', () => {
      expect(toRad(90)).toBeCloseTo(Math.PI / 2, 10);
    });

    it('should convert 360 degrees to 2*PI radians', () => {
      expect(toRad(360)).toBeCloseTo(2 * Math.PI, 10);
    });

    it('should handle negative degrees', () => {
      expect(toRad(-90)).toBeCloseTo(-Math.PI / 2, 10);
    });

    it('should convert 45 degrees to PI/4', () => {
      expect(toRad(45)).toBeCloseTo(Math.PI / 4, 10);
    });
  });
});
