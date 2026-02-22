/**
 * Comprehensive tests for the date-filtered recommendations feature.
 *
 * Covers:
 *  - services/time-slot-engine.ts  (analyzeCalendarSlots, matchActivityToSlots,
 *    generateDateContext, estimateTravelMinutes, calculateTravelBuffer, _testExports)
 *  - constants/activity-durations.ts (getEstimatedDuration, ACTIVITY_DURATIONS,
 *    MIN_SCHEDULABLE_GAP, DEFAULT_TRAVEL_BUFFER)
 *  - components/date-filter-bar.tsx (_testExports: getDatePills, isToday)
 */

import {
  analyzeCalendarSlots,
  matchActivityToSlots,
  generateDateContext,
  estimateTravelMinutes,
  calculateTravelBuffer,
  _testExports,
} from '@/services/time-slot-engine';

import {
  getEstimatedDuration,
  ACTIVITY_DURATIONS,
  MIN_SCHEDULABLE_GAP,
  DEFAULT_TRAVEL_BUFFER,
} from '@/constants/activity-durations';

import type { CalendarEvent, FreeTimeSlot, SlotMatch } from '@/types/time-slots';

const {
  haversineDistance,
  formatTime,
  formatDuration,
  getDayAbbrev,
  isSameDay,
  calculateFitScore,
  isOpenDuring,
  generateSlotContextLabel,
  generateDaySummary,
} = _testExports;

// ── DateFilterBar helpers (replicated from components/date-filter-bar.tsx) ──
// The .tsx component file cannot be compiled in Node test env, so we replicate
// the pure helper functions here (same approach as calendar.test.ts).

/** Generate the quick-pick date options */
function getDatePills(): Array<{ label: string; getDate: () => Date }> {
  return [
    {
      label: 'Today',
      getDate: () => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      },
    },
    {
      label: 'Tomorrow',
      getDate: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(0, 0, 0, 0);
        return d;
      },
    },
    {
      label: 'This Wknd',
      getDate: () => {
        const d = new Date();
        const dayOfWeek = d.getDay();
        const daysUntilSat = dayOfWeek === 6 ? 0 : (6 - dayOfWeek + 7) % 7;
        d.setDate(d.getDate() + daysUntilSat);
        d.setHours(0, 0, 0, 0);
        return d;
      },
    },
    {
      label: 'Next Week',
      getDate: () => {
        const d = new Date();
        const dayOfWeek = d.getDay();
        const daysUntilMon = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
        d.setDate(d.getDate() + daysUntilMon);
        d.setHours(0, 0, 0, 0);
        return d;
      },
    },
  ];
}

/** Check if a date is today */
function isToday(date: Date | null): boolean {
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

// ── Fake timers ────────────────────────────────────────────────────────
// Pin to noon on Wednesday 2026-02-25 for deterministic results.
// Use local-time constructor to avoid UTC vs local timezone confusion.
const PINNED_NOW = new Date(2026, 1, 25, 12, 0, 0, 0);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(PINNED_NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Helpers ────────────────────────────────────────────────────────────
// All date construction uses new Date(year, month, day, h, m, s) to ensure
// local-time semantics (avoids UTC midnight parsing pitfalls).

/** Create a local-time Date on Feb 25 2026 */
function localDate(hour: number, min = 0, sec = 0): Date {
  return new Date(2026, 1, 25, hour, min, sec, 0);
}

/** Create a CalendarEvent for the pinned date (local time) */
function makeEvent(
  overrides: Partial<CalendarEvent> & { startHour: number; startMin?: number; endHour: number; endMin?: number }
): CalendarEvent {
  const { startHour, startMin = 0, endHour, endMin = 0, ...rest } = overrides;
  const start = localDate(startHour, startMin);
  const end = localDate(endHour, endMin);
  return {
    id: rest.id ?? `evt-${startHour}-${endHour}`,
    title: rest.title ?? `Event ${startHour}-${endHour}`,
    startTime: start,
    endTime: end,
    ...(rest.location ? { location: rest.location } : {}),
    ...(rest.category ? { category: rest.category } : {}),
  };
}

// TARGET_DATE in local time (month 0-indexed: 1 = February)
const TARGET_DATE = new Date(2026, 1, 25, 0, 0, 0, 0);

// ========================================================================
//  SECTION 1: analyzeCalendarSlots
// ========================================================================

describe('analyzeCalendarSlots', () => {
  it('returns a full-day free slot when there are no events', () => {
    const result = analyzeCalendarSlots([], TARGET_DATE);

    // Day boundaries: 7 AM - 11 PM = 960 minutes
    expect(result.events).toHaveLength(0);
    expect(result.freeSlots).toHaveLength(1);
    expect(result.totalFreeMinutes).toBe(960);
    expect(result.schedulableGapCount).toBe(1);

    const slot = result.freeSlots[0];
    expect(slot.start.getHours()).toBe(7);
    expect(slot.end.getHours()).toBe(23);
  });

  it('creates two free slots around a single mid-day event', () => {
    const events = [makeEvent({ startHour: 9, endHour: 12 })];
    const result = analyzeCalendarSlots(events, TARGET_DATE);

    expect(result.events).toHaveLength(1);
    // Gap before event: 7:00 - 9:00 = 120 min (minus 15 min travel buffer to next)
    // Gap after event: 12:00 - 23:00 = 660 min
    expect(result.freeSlots.length).toBeGreaterThanOrEqual(2);

    // First slot ends before the event (with travel buffer)
    const firstSlot = result.freeSlots[0];
    expect(firstSlot.start.getHours()).toBe(7);
    expect(firstSlot.end.getTime()).toBeLessThanOrEqual(events[0].startTime.getTime());

    // Second slot starts at or after the event end
    const secondSlot = result.freeSlots[1];
    expect(secondSlot.start.getTime()).toBeGreaterThanOrEqual(events[0].endTime.getTime());
  });

  it('handles multiple non-overlapping events with gaps', () => {
    const events = [
      makeEvent({ startHour: 8, endHour: 9 }),
      makeEvent({ startHour: 12, endHour: 13 }),
      makeEvent({ startHour: 18, endHour: 19 }),
    ];
    const result = analyzeCalendarSlots(events, TARGET_DATE);

    expect(result.events).toHaveLength(3);
    // Gaps: 7-8 (60 min w/ buffer), 9-12 (180 min), 13-18 (300 min), 19-23 (240 min)
    // At minimum, the larger gaps should produce slots
    expect(result.freeSlots.length).toBeGreaterThanOrEqual(3);
  });

  it('merges overlapping events into a single busy block', () => {
    const events = [
      makeEvent({ startHour: 9, endHour: 11 }),
      makeEvent({ startHour: 10, endHour: 12 }), // overlaps first
    ];
    const result = analyzeCalendarSlots(events, TARGET_DATE);

    expect(result.events).toHaveLength(2);
    // The merged block is 9-12, so we should get slots before and after
    expect(result.freeSlots.length).toBeGreaterThanOrEqual(1);

    // The total free minutes should not double-count the overlap
    expect(result.totalFreeMinutes).toBeLessThan(960);
  });

  it('produces no free slot between back-to-back events', () => {
    const events = [
      makeEvent({ startHour: 9, endHour: 11 }),
      makeEvent({ startHour: 11, endHour: 13 }),
    ];
    const result = analyzeCalendarSlots(events, TARGET_DATE);

    // There should be NO slot at 11:00 -- the events merge (adjacent)
    const slotsAt11 = result.freeSlots.filter(
      (s) => s.start.getHours() === 11 || s.end.getHours() === 11
    );
    expect(slotsAt11).toHaveLength(0);
  });

  it('returns no free slots when an event spans the entire day', () => {
    const events = [makeEvent({ startHour: 7, endHour: 23 })];
    const result = analyzeCalendarSlots(events, TARGET_DATE);

    expect(result.freeSlots).toHaveLength(0);
    expect(result.totalFreeMinutes).toBe(0);
    expect(result.schedulableGapCount).toBe(0);
  });

  it('excludes gaps shorter than MIN_SCHEDULABLE_GAP', () => {
    // Event at 9:00-9:30, then event at 9:50-12:00. Gap = 20 min.
    const events = [
      makeEvent({ startHour: 9, endHour: 9, endMin: 30 }),
      makeEvent({ startHour: 9, startMin: 50, endHour: 12 }),
    ];
    const result = analyzeCalendarSlots(events, TARGET_DATE);

    const tinySlots = result.freeSlots.filter((s) => s.durationMinutes < MIN_SCHEDULABLE_GAP);
    expect(tinySlots).toHaveLength(0);
  });

  it('includes a daySummary with event count and free time', () => {
    const events = [makeEvent({ startHour: 10, endHour: 11 })];
    const result = analyzeCalendarSlots(events, TARGET_DATE);

    expect(result.daySummary).toContain('1 event');
    expect(result.daySummary).toContain('free');
  });

  it('daySummary says "Open day" for no events', () => {
    const result = analyzeCalendarSlots([], TARGET_DATE);
    expect(result.daySummary).toContain('Open day');
  });
});

// ========================================================================
//  SECTION 2: matchActivityToSlots
// ========================================================================

describe('matchActivityToSlots', () => {
  /** Build a simple free slot for testing (local time) */
  function makeSlot(overrides: Partial<FreeTimeSlot> & { startHour: number; endHour: number }): FreeTimeSlot {
    const { startHour, endHour, ...rest } = overrides;
    const start = localDate(startHour);
    const end = localDate(endHour);
    return {
      start,
      end,
      durationMinutes: (endHour - startHour) * 60,
      travelBufferFromPrevious: rest.travelBufferFromPrevious ?? 0,
      travelBufferToNext: rest.travelBufferToNext ?? 0,
      ...rest,
    };
  }

  it('returns a match when the activity fits in a slot', () => {
    // Coffee takes ~45 min typical, 20 min minimum. A 2-hour slot is plenty.
    const slots = [makeSlot({ startHour: 10, endHour: 12 })];
    const result = matchActivityToSlots('coffee', slots);

    expect(result).not.toBeNull();
    expect(result!.fitScore).toBeGreaterThan(0);
    expect(result!.confidence).toBeDefined();
    expect(result!.suggestedStart.getTime()).toBeGreaterThanOrEqual(slots[0].start.getTime());
    expect(result!.suggestedEnd.getTime()).toBeLessThanOrEqual(slots[0].end.getTime());
  });

  it('returns null when activity duration exceeds the slot', () => {
    // Concert needs 120 min minimum, slot is only 60 min
    const slots = [makeSlot({ startHour: 10, endHour: 11 })];
    const result = matchActivityToSlots('concert', slots);
    expect(result).toBeNull();
  });

  it('returns the best-fit slot when multiple are available', () => {
    const slots = [
      makeSlot({ startHour: 8, endHour: 9 }),   // 60 min
      makeSlot({ startHour: 14, endHour: 17 }),  // 180 min
    ];
    const result = matchActivityToSlots('coffee', slots);

    expect(result).not.toBeNull();
    expect(result!.fitScore).toBeGreaterThan(0);
  });

  it('returns null when slots array is empty', () => {
    const result = matchActivityToSlots('dining', []);
    expect(result).toBeNull();
  });

  it('returns a match when opening hours overlap the slot', () => {
    // Feb 25 2026 = Wednesday = day 3. Place open 0800-2200.
    const slots = [makeSlot({ startHour: 10, endHour: 13 })];
    const openingHours = [
      { open: { day: 3, time: '0800' }, close: { day: 3, time: '2200' } },
    ];
    const result = matchActivityToSlots('dining', slots, undefined, openingHours);
    expect(result).not.toBeNull();
  });

  it('returns null when opening hours do not overlap the slot', () => {
    // Wednesday = day 3. Place only open 6 PM - 10 PM.
    const slots = [makeSlot({ startHour: 10, endHour: 12 })];
    const openingHours = [
      { open: { day: 3, time: '1800' }, close: { day: 3, time: '2200' } },
    ];
    const result = matchActivityToSlots('dining', slots, undefined, openingHours);
    expect(result).toBeNull();
  });

  it('returns a SlotMatch with a valid confidence tier', () => {
    const slots = [makeSlot({ startHour: 10, endHour: 14 })];
    const result = matchActivityToSlots('coffee', slots);
    expect(result).not.toBeNull();
    expect(['high', 'medium', 'low']).toContain(result!.confidence);
  });
});

// ========================================================================
//  SECTION 3: generateDateContext
// ========================================================================

describe('generateDateContext', () => {
  function makeSlotMatch(overrides?: Partial<SlotMatch>): SlotMatch {
    return {
      slot: {
        start: localDate(13),
        end: localDate(18),
        durationMinutes: 300,
        travelBufferFromPrevious: 0,
        travelBufferToNext: 0,
      },
      suggestedStart: localDate(14, 30),
      suggestedEnd: localDate(16),
      fitScore: 80,
      contextLabel: 'Free afternoon slot',
      confidence: 'high',
      ...overrides,
    };
  }

  it('generates a suggestedTimeLabel with day abbreviation and times', () => {
    const match = makeSlotMatch();
    const ctx = generateDateContext(match, TARGET_DATE);

    // Should contain "Wed" (Feb 25 2026 is a Wednesday)
    expect(ctx.suggestedTimeLabel).toContain('Wed');
    // Should contain AM/PM formatted times
    expect(ctx.suggestedTimeLabel).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
  });

  it('includes travelContextLabel when previous event exists', () => {
    const prevEvent: CalendarEvent = {
      id: 'prev',
      title: 'Surf Lessons',
      startTime: localDate(10),
      endTime: localDate(12),
    };
    const match = makeSlotMatch({
      slot: {
        start: localDate(12, 15),
        end: localDate(17),
        durationMinutes: 285,
        previousEvent: prevEvent,
        travelBufferFromPrevious: 15,
        travelBufferToNext: 0,
      },
      travelFromPreviousMinutes: 12,
    });

    const ctx = generateDateContext(match, TARGET_DATE);
    expect(ctx.travelContextLabel).toBeDefined();
    expect(ctx.travelContextLabel).toContain('Surf Lessons');
    expect(ctx.travelContextLabel).toContain('12 min');
  });

  it('has no travelContextLabel when there is no previous event', () => {
    const match = makeSlotMatch();
    const ctx = generateDateContext(match, TARGET_DATE);
    expect(ctx.travelContextLabel).toBeUndefined();
  });

  it('maps confidence tier correctly from fitScore', () => {
    const highMatch = makeSlotMatch({ fitScore: 85, confidence: 'high' });
    const medMatch = makeSlotMatch({ fitScore: 60, confidence: 'medium' });
    const lowMatch = makeSlotMatch({ fitScore: 30, confidence: 'low' });

    expect(generateDateContext(highMatch, TARGET_DATE).confidenceTier).toBe('high');
    expect(generateDateContext(medMatch, TARGET_DATE).confidenceTier).toBe('medium');
    expect(generateDateContext(lowMatch, TARGET_DATE).confidenceTier).toBe('low');
  });

  it('populates suggestedStartTime and suggestedEndTime from the SlotMatch', () => {
    const match = makeSlotMatch();
    const ctx = generateDateContext(match, TARGET_DATE);
    expect(ctx.suggestedStartTime).toEqual(match.suggestedStart);
    expect(ctx.suggestedEndTime).toEqual(match.suggestedEnd);
  });
});

// ========================================================================
//  SECTION 4: getEstimatedDuration & constants
// ========================================================================

describe('getEstimatedDuration', () => {
  it('returns correct values for a known category (dining)', () => {
    const d = getEstimatedDuration('dining');
    expect(d.typical).toBe(75);
    expect(d.minimum).toBe(45);
    expect(d.maximum).toBe(120);
  });

  it('is case-insensitive', () => {
    const d = getEstimatedDuration('COFFEE');
    expect(d.typical).toBe(45);
  });

  it('falls back to "other" for an unknown category', () => {
    const d = getEstimatedDuration('underwater-basket-weaving');
    expect(d).toEqual(ACTIVITY_DURATIONS.other);
  });

  it('exports MIN_SCHEDULABLE_GAP as 45', () => {
    expect(MIN_SCHEDULABLE_GAP).toBe(45);
  });

  it('exports DEFAULT_TRAVEL_BUFFER as 15', () => {
    expect(DEFAULT_TRAVEL_BUFFER).toBe(15);
  });

  it('covers a range of known categories', () => {
    const knownCategories = [
      'dining', 'restaurant', 'coffee', 'bars', 'live music',
      'fitness', 'hiking', 'museum', 'shopping', 'movies',
    ];
    for (const cat of knownCategories) {
      const d = getEstimatedDuration(cat);
      expect(d.typical).toBeGreaterThan(0);
      expect(d.minimum).toBeLessThanOrEqual(d.typical);
      expect(d.maximum).toBeGreaterThanOrEqual(d.typical);
    }
  });
});

// ========================================================================
//  SECTION 5: estimateTravelMinutes & calculateTravelBuffer
// ========================================================================

describe('estimateTravelMinutes', () => {
  it('returns 0 for zero distance', () => {
    expect(estimateTravelMinutes(0)).toBe(0);
  });

  it('returns 0 for negative distance', () => {
    expect(estimateTravelMinutes(-5)).toBe(0);
  });

  it('returns ceil(distance * 2.4 + 5) for positive distance', () => {
    // 5 miles: 5 * 2.4 + 5 = 17
    expect(estimateTravelMinutes(5)).toBe(17);
    // 1 mile: 1 * 2.4 + 5 = 7.4 -> ceil = 8
    expect(estimateTravelMinutes(1)).toBe(8);
  });
});

describe('calculateTravelBuffer', () => {
  it('returns DEFAULT_TRAVEL_BUFFER when from is undefined', () => {
    expect(calculateTravelBuffer(undefined, { latitude: 32.8, longitude: -96.8 })).toBe(DEFAULT_TRAVEL_BUFFER);
  });

  it('returns DEFAULT_TRAVEL_BUFFER when to is undefined', () => {
    expect(calculateTravelBuffer({ latitude: 32.8, longitude: -96.8 }, undefined)).toBe(DEFAULT_TRAVEL_BUFFER);
  });

  it('returns at least DEFAULT_TRAVEL_BUFFER for nearby points', () => {
    const loc = { latitude: 32.78, longitude: -96.80 };
    const result = calculateTravelBuffer(loc, loc);
    expect(result).toBeGreaterThanOrEqual(DEFAULT_TRAVEL_BUFFER);
  });

  it('returns travel estimate for distant points', () => {
    // Dallas to Fort Worth ~30 miles
    const dallas = { latitude: 32.78, longitude: -96.80 };
    const fortWorth = { latitude: 32.75, longitude: -97.33 };
    const result = calculateTravelBuffer(dallas, fortWorth);
    expect(result).toBeGreaterThan(DEFAULT_TRAVEL_BUFFER);
  });
});

// ========================================================================
//  SECTION 6: _testExports helpers
// ========================================================================

describe('haversineDistance', () => {
  it('returns ~0 for the same point', () => {
    expect(haversineDistance(32.78, -96.80, 32.78, -96.80)).toBeCloseTo(0, 1);
  });

  it('computes a known distance (Dallas to Austin ~195 miles)', () => {
    const dist = haversineDistance(32.7767, -96.7970, 30.2672, -97.7431);
    expect(dist).toBeGreaterThan(180);
    expect(dist).toBeLessThan(210);
  });

  it('computes a known distance (NYC to LA ~2451 miles)', () => {
    const dist = haversineDistance(40.7128, -74.0060, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(2400);
    expect(dist).toBeLessThan(2500);
  });
});

describe('formatDuration', () => {
  it('formats minutes < 60 as "X min"', () => {
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(45)).toBe('45 min');
  });

  it('formats exactly 60 as "1 hr"', () => {
    expect(formatDuration(60)).toBe('1 hr');
  });

  it('formats exact multiples of 60 as "X hrs"', () => {
    expect(formatDuration(120)).toBe('2 hrs');
    expect(formatDuration(180)).toBe('3 hrs');
  });

  it('formats non-exact hours as "X.X hrs"', () => {
    expect(formatDuration(90)).toBe('1.5 hrs');
    expect(formatDuration(150)).toBe('2.5 hrs');
  });
});

describe('isSameDay', () => {
  it('returns true for the same date', () => {
    const a = localDate(8);
    const b = localDate(22, 30);
    expect(isSameDay(a, b)).toBe(true);
  });

  it('returns false for different dates', () => {
    const a = localDate(8);
    const b = new Date(2026, 1, 26, 8, 0, 0, 0);
    expect(isSameDay(a, b)).toBe(false);
  });

  it('returns false for same day different month', () => {
    const a = localDate(12);
    const b = new Date(2026, 2, 25, 12, 0, 0, 0); // March 25
    expect(isSameDay(a, b)).toBe(false);
  });
});

describe('isOpenDuring', () => {
  // Feb 25 2026 = Wednesday = day 3

  it('returns true when activity fits within opening hours', () => {
    const periods = [
      { open: { day: 3, time: '0800' }, close: { day: 3, time: '2200' } },
    ];
    expect(isOpenDuring(periods, localDate(10), localDate(12))).toBe(true);
  });

  it('returns false when start is before opening', () => {
    const periods = [
      { open: { day: 3, time: '1000' }, close: { day: 3, time: '2200' } },
    ];
    expect(isOpenDuring(periods, localDate(9), localDate(11))).toBe(false);
  });

  it('returns false when end is after closing', () => {
    const periods = [
      { open: { day: 3, time: '0800' }, close: { day: 3, time: '1700' } },
    ];
    expect(isOpenDuring(periods, localDate(16), localDate(18))).toBe(false);
  });

  it('returns true for 24-hour place (no close)', () => {
    const periods = [
      { open: { day: 3, time: '0000' } },
    ];
    expect(isOpenDuring(periods, localDate(2), localDate(4))).toBe(true);
  });

  it('returns false when no period matches the day', () => {
    // Only open on Monday (day 1)
    const periods = [
      { open: { day: 1, time: '0900' }, close: { day: 1, time: '1700' } },
    ];
    expect(isOpenDuring(periods, localDate(10), localDate(12))).toBe(false);
  });
});

describe('generateSlotContextLabel', () => {
  it('returns "Free morning slot" for a morning slot with no surrounding events', () => {
    const slot: FreeTimeSlot = {
      start: localDate(7),
      end: localDate(9),
      durationMinutes: 120,
      travelBufferFromPrevious: 0,
      travelBufferToNext: 0,
    };
    const label = generateSlotContextLabel(slot, localDate(7), localDate(8));
    expect(label).toBe('Free morning slot');
  });

  it('returns "Free afternoon slot" for afternoon', () => {
    const slot: FreeTimeSlot = {
      start: localDate(13),
      end: localDate(16),
      durationMinutes: 180,
      travelBufferFromPrevious: 0,
      travelBufferToNext: 0,
    };
    const label = generateSlotContextLabel(slot, localDate(14), localDate(15, 30));
    expect(label).toBe('Free afternoon slot');
  });

  it('returns "Free evening slot" for evening', () => {
    const slot: FreeTimeSlot = {
      start: localDate(18),
      end: localDate(22),
      durationMinutes: 240,
      travelBufferFromPrevious: 0,
      travelBufferToNext: 0,
    };
    const label = generateSlotContextLabel(slot, localDate(19), localDate(21));
    expect(label).toBe('Free evening slot');
  });

  it('includes "After {event}" when previousEvent exists', () => {
    const prev: CalendarEvent = {
      id: 'p1',
      title: 'Yoga Class',
      startTime: localDate(8),
      endTime: localDate(9),
    };
    const slot: FreeTimeSlot = {
      start: localDate(9),
      end: localDate(12),
      durationMinutes: 180,
      previousEvent: prev,
      travelBufferFromPrevious: 0,
      travelBufferToNext: 0,
    };
    const label = generateSlotContextLabel(slot, localDate(9, 15), localDate(10, 30));
    expect(label).toContain('After Yoga Class');
  });

  it('includes "before {event}" when nextEvent exists', () => {
    const next: CalendarEvent = {
      id: 'n1',
      title: 'Dinner',
      startTime: localDate(19),
      endTime: localDate(21),
    };
    const slot: FreeTimeSlot = {
      start: localDate(15),
      end: localDate(19),
      durationMinutes: 240,
      nextEvent: next,
      travelBufferFromPrevious: 0,
      travelBufferToNext: 0,
    };
    const label = generateSlotContextLabel(slot, localDate(15), localDate(17));
    expect(label).toContain('before Dinner');
  });
});

describe('generateDaySummary', () => {
  it('says "Open day" when there are no events', () => {
    const summary = generateDaySummary(TARGET_DATE, [], [], 960);
    expect(summary).toContain('Open day');
    expect(summary).toContain('16 hrs');
  });

  it('uses singular "1 event" for single event', () => {
    const events = [makeEvent({ startHour: 10, endHour: 11 })];
    const summary = generateDaySummary(TARGET_DATE, events, [], 900);
    expect(summary).toContain('1 event');
  });

  it('uses plural "N events" for multiple events', () => {
    const events = [
      makeEvent({ startHour: 9, endHour: 10, id: 'e1' }),
      makeEvent({ startHour: 14, endHour: 15, id: 'e2' }),
      makeEvent({ startHour: 18, endHour: 19, id: 'e3' }),
    ];
    const summary = generateDaySummary(TARGET_DATE, events, [], 600);
    expect(summary).toContain('3 events');
  });

  it('says "fully booked" when total free minutes is 0', () => {
    const events = [makeEvent({ startHour: 7, endHour: 23 })];
    const summary = generateDaySummary(TARGET_DATE, events, [], 0);
    expect(summary).toContain('fully booked');
  });
});

describe('calculateFitScore', () => {
  it('gives high score for perfect duration and time fit', () => {
    // Duration ratio 1.0, utilization 0.5, travel 0, hour 14 (2 PM)
    const score = calculateFitScore(60, 60, 120, 0, 0, localDate(14));
    // 40 (perfect duration) + 20 (good utilization) + 20 (no travel) + 20 (good hour) = 100
    expect(score).toBe(100);
  });

  it('gives lower score for tight duration fit', () => {
    // Duration ratio 0.5 (below 0.6 threshold)
    const score = calculateFitScore(30, 60, 120, 0, 0, localDate(14));
    // 15 (tight) + 10 (utilization < 0.4) + 20 (no travel) + 20 (good hour) = 65
    expect(score).toBe(65);
  });

  it('penalizes high travel time', () => {
    const scoreNoTravel = calculateFitScore(60, 60, 120, 0, 0, localDate(14));
    const scoreHighTravel = calculateFitScore(60, 60, 120, 20, 20, localDate(14));
    expect(scoreHighTravel).toBeLessThan(scoreNoTravel);
  });

  it('caps at 100', () => {
    const score = calculateFitScore(60, 60, 120, 0, 0, localDate(14));
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ========================================================================
//  SECTION 7: DateFilterBar helpers (replicated)
// ========================================================================

describe('DateFilterBar: getDatePills', () => {
  it('returns exactly 4 pills', () => {
    const pills = getDatePills();
    expect(pills).toHaveLength(4);
  });

  it('has labels: Today, Tomorrow, This Wknd, Next Week', () => {
    const pills = getDatePills();
    const labels = pills.map((p) => p.label);
    expect(labels).toEqual(['Today', 'Tomorrow', 'This Wknd', 'Next Week']);
  });

  it('Today pill returns today at midnight', () => {
    const pills = getDatePills();
    const todayDate = pills[0].getDate();
    expect(todayDate.getFullYear()).toBe(2026);
    expect(todayDate.getMonth()).toBe(1); // February
    expect(todayDate.getDate()).toBe(25);
    expect(todayDate.getHours()).toBe(0);
    expect(todayDate.getMinutes()).toBe(0);
  });

  it('Tomorrow pill returns one day ahead at midnight', () => {
    const pills = getDatePills();
    const tomorrowDate = pills[1].getDate();
    expect(tomorrowDate.getDate()).toBe(26);
    expect(tomorrowDate.getHours()).toBe(0);
  });

  it('This Wknd pill returns next Saturday (Feb 28 for a Wednesday)', () => {
    const pills = getDatePills();
    const wkndDate = pills[2].getDate();
    // Feb 25 is Wednesday, next Saturday is Feb 28
    expect(wkndDate.getDate()).toBe(28);
    expect(wkndDate.getDay()).toBe(6); // Saturday
    expect(wkndDate.getHours()).toBe(0);
  });

  it('Next Week pill returns next Monday (Mar 2 for a Wednesday)', () => {
    const pills = getDatePills();
    const nextWeekDate = pills[3].getDate();
    // Feb 25 (Wed) + 5 days = Mar 2 (Mon)
    expect(nextWeekDate.getMonth()).toBe(2); // March
    expect(nextWeekDate.getDate()).toBe(2);
    expect(nextWeekDate.getDay()).toBe(1); // Monday
  });
});

describe('DateFilterBar: isToday', () => {
  it('returns true for today', () => {
    const today = new Date(2026, 1, 25, 15, 30, 0, 0);
    expect(isToday(today)).toBe(true);
  });

  it('returns false for tomorrow', () => {
    const tomorrow = new Date(2026, 1, 26, 12, 0, 0, 0);
    expect(isToday(tomorrow)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isToday(null)).toBe(false);
  });

  it('returns true for today at midnight', () => {
    const midnight = new Date(2026, 1, 25, 0, 0, 0, 0);
    expect(isToday(midnight)).toBe(true);
  });

  it('returns true for today at 11:59 PM', () => {
    const lateNight = new Date(2026, 1, 25, 23, 59, 59, 0);
    expect(isToday(lateNight)).toBe(true);
  });
});

// ========================================================================
//  SECTION 8: Integration-level scenario
// ========================================================================

describe('Full pipeline: analyzeCalendarSlots -> matchActivityToSlots -> generateDateContext', () => {
  it('produces a valid DateContext for a real calendar scenario', () => {
    const events: CalendarEvent[] = [
      {
        id: 'work-meeting',
        title: 'Work Meeting',
        startTime: localDate(9),
        endTime: localDate(12),
      },
      {
        id: 'dinner',
        title: 'Dinner Reservation',
        startTime: localDate(18),
        endTime: localDate(20),
      },
    ];

    // Step 1: Analyze the day
    const analysis = analyzeCalendarSlots(events, TARGET_DATE);
    expect(analysis.freeSlots.length).toBeGreaterThanOrEqual(1);

    // Step 2: Match a coffee activity to available slots
    const match = matchActivityToSlots('coffee', analysis.freeSlots);
    expect(match).not.toBeNull();

    // Step 3: Generate date context
    const ctx = generateDateContext(match!, TARGET_DATE);
    expect(ctx.suggestedTimeLabel).toContain('Wed');
    expect(ctx.confidenceTier).toBeDefined();
    expect(ctx.slotConfidence).toBeGreaterThan(0);
    expect(ctx.suggestedStartTime.getTime()).toBeLessThan(ctx.suggestedEndTime.getTime());
  });
});
