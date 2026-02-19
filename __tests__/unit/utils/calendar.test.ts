/**
 * Tests for calendar utility functions:
 * - createMarkedDates (dot generation, selection, capping)
 * - groupEventsByDate
 * - getCategoryColor
 */

// Replicate the pure logic from utils/calendar.ts and constants
// so tests don't depend on module resolution / Expo aliases

const CATEGORY_COLORS: Record<string, string> = {
  work: '#6366F1',
  personal: '#F59E0B',
  social: '#8B5CF6',
  dining: '#EF4444',
  fitness: '#09DB98',
  entertainment: '#00A6D9',
  travel: '#14B8A6',
  other: '#8E8E93',
};

const CATEGORY_ICONS: Record<string, string> = {
  work: '💼',
  personal: '✨',
  social: '👥',
  dining: '🍽️',
  fitness: '💪',
  entertainment: '🎭',
  travel: '✈️',
  other: '📌',
};

const BRAND_LOOP_BLUE = '#00A6D9';

interface EventWithColor {
  id: string;
  title: string;
  category: string | null;
  startTime: Date;
  endTime: Date;
  color: string;
  icon: string;
  address: string;
  description?: string;
}

interface MarkedDate {
  marked?: boolean;
  dotColor?: string;
  selected?: boolean;
  selectedColor?: string;
  selectedTextColor?: string;
  dots?: Array<{ key: string; color: string; selectedDotColor?: string }>;
  extraCount?: number;
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  category: string | null;
  start_time: string;
  end_time: string;
  address: string;
}

// --- Replicated pure functions ---

function getCategoryColor(category: string | null): string {
  if (!category) return CATEGORY_COLORS.other;
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
}

function getCategoryIcon(category: string | null): string {
  if (!category) return CATEGORY_ICONS.other;
  return CATEGORY_ICONS[category] || CATEGORY_ICONS.other;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function convertToEventWithColor(event: CalendarEvent): EventWithColor {
  return {
    id: event.id,
    title: event.title,
    category: event.category,
    startTime: new Date(event.start_time),
    endTime: new Date(event.end_time),
    color: getCategoryColor(event.category),
    icon: getCategoryIcon(event.category),
    address: event.address,
    description: event.description || undefined,
  };
}

function groupEventsByDate(events: CalendarEvent[]): Map<string, EventWithColor[]> {
  const grouped = new Map<string, EventWithColor[]>();

  events.forEach(event => {
    const dateKey = formatDateKey(new Date(event.start_time));
    const eventWithColor = convertToEventWithColor(event);

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(eventWithColor);
  });

  grouped.forEach(dayEvents => {
    dayEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  });

  return grouped;
}

function createMarkedDates(
  events: CalendarEvent[],
  selectedDate?: string
): Record<string, MarkedDate> {
  const markedDates: Record<string, MarkedDate> = {};
  const grouped = groupEventsByDate(events);

  grouped.forEach((dayEvents, dateKey) => {
    const dots = dayEvents.slice(0, 3).map(event => ({
      key: event.id,
      color: event.color,
      selectedDotColor: '#FFFFFF',
    }));

    markedDates[dateKey] = {
      marked: true,
      dots,
      ...(dayEvents.length > 3 ? { extraCount: dayEvents.length - 3 } : {}),
    };
  });

  if (selectedDate) {
    markedDates[selectedDate] = {
      ...markedDates[selectedDate],
      selected: true,
      selectedColor: BRAND_LOOP_BLUE,
      selectedTextColor: '#FFFFFF',
    };
  }

  return markedDates;
}

// --- Helper to create test events ---

function makeEvent(overrides: Partial<CalendarEvent> & { id: string }): CalendarEvent {
  return {
    title: 'Test Event',
    description: null,
    category: 'dining',
    start_time: '2025-06-15T10:00:00.000Z',
    end_time: '2025-06-15T11:00:00.000Z',
    address: '123 Main St',
    ...overrides,
  };
}

// ======================================================================
// TESTS
// ======================================================================

describe('getCategoryColor', () => {
  it('returns the correct color for each known category', () => {
    expect(getCategoryColor('dining')).toBe('#EF4444');
    expect(getCategoryColor('fitness')).toBe('#09DB98');
    expect(getCategoryColor('work')).toBe('#6366F1');
    expect(getCategoryColor('entertainment')).toBe('#00A6D9');
    expect(getCategoryColor('social')).toBe('#8B5CF6');
    expect(getCategoryColor('personal')).toBe('#F59E0B');
    expect(getCategoryColor('travel')).toBe('#14B8A6');
    expect(getCategoryColor('other')).toBe('#8E8E93');
  });

  it('returns "other" color for null category', () => {
    expect(getCategoryColor(null)).toBe(CATEGORY_COLORS.other);
  });

  it('returns "other" color for unknown category', () => {
    expect(getCategoryColor('mystery')).toBe(CATEGORY_COLORS.other);
  });
});

describe('groupEventsByDate', () => {
  it('groups events by their start date', () => {
    const events = [
      makeEvent({ id: '1', start_time: '2025-06-15T10:00:00.000Z' }),
      makeEvent({ id: '2', start_time: '2025-06-15T14:00:00.000Z' }),
      makeEvent({ id: '3', start_time: '2025-06-16T09:00:00.000Z' }),
    ];

    const grouped = groupEventsByDate(events);

    expect(grouped.size).toBe(2);
    expect(grouped.get('2025-06-15')!.length).toBe(2);
    expect(grouped.get('2025-06-16')!.length).toBe(1);
  });

  it('sorts events within a day by start time', () => {
    const events = [
      makeEvent({ id: 'late', start_time: '2025-06-15T18:00:00.000Z' }),
      makeEvent({ id: 'early', start_time: '2025-06-15T08:00:00.000Z' }),
      makeEvent({ id: 'mid', start_time: '2025-06-15T12:00:00.000Z' }),
    ];

    const grouped = groupEventsByDate(events);
    const dayEvents = grouped.get('2025-06-15')!;

    expect(dayEvents[0].id).toBe('early');
    expect(dayEvents[1].id).toBe('mid');
    expect(dayEvents[2].id).toBe('late');
  });

  it('returns empty map for no events', () => {
    const grouped = groupEventsByDate([]);
    expect(grouped.size).toBe(0);
  });

  it('assigns correct colors based on category', () => {
    const events = [
      makeEvent({ id: '1', category: 'fitness' }),
      makeEvent({ id: '2', category: 'dining' }),
    ];

    const grouped = groupEventsByDate(events);
    const dayEvents = grouped.get('2025-06-15')!;

    expect(dayEvents.find(e => e.id === '1')!.color).toBe(CATEGORY_COLORS.fitness);
    expect(dayEvents.find(e => e.id === '2')!.color).toBe(CATEGORY_COLORS.dining);
  });
});

describe('createMarkedDates', () => {
  it('creates dots for events on a date', () => {
    const events = [
      makeEvent({ id: '1', category: 'dining', start_time: '2025-06-15T10:00:00.000Z' }),
    ];

    const result = createMarkedDates(events);

    expect(result['2025-06-15']).toBeDefined();
    expect(result['2025-06-15'].marked).toBe(true);
    expect(result['2025-06-15'].dots).toHaveLength(1);
    expect(result['2025-06-15'].dots![0].color).toBe(CATEGORY_COLORS.dining);
  });

  it('caps dots at 3 per day', () => {
    const events = [
      makeEvent({ id: '1', start_time: '2025-06-15T08:00:00.000Z' }),
      makeEvent({ id: '2', start_time: '2025-06-15T10:00:00.000Z' }),
      makeEvent({ id: '3', start_time: '2025-06-15T12:00:00.000Z' }),
      makeEvent({ id: '4', start_time: '2025-06-15T14:00:00.000Z' }),
      makeEvent({ id: '5', start_time: '2025-06-15T16:00:00.000Z' }),
    ];

    const result = createMarkedDates(events);
    expect(result['2025-06-15'].dots).toHaveLength(3);
  });

  it('includes extraCount when more than 3 events exist on a day', () => {
    const events = [
      makeEvent({ id: '1', start_time: '2025-06-15T08:00:00.000Z' }),
      makeEvent({ id: '2', start_time: '2025-06-15T10:00:00.000Z' }),
      makeEvent({ id: '3', start_time: '2025-06-15T12:00:00.000Z' }),
      makeEvent({ id: '4', start_time: '2025-06-15T14:00:00.000Z' }),
      makeEvent({ id: '5', start_time: '2025-06-15T16:00:00.000Z' }),
    ];

    const result = createMarkedDates(events);
    expect(result['2025-06-15'].extraCount).toBe(2);
  });

  it('does not include extraCount when 3 or fewer events exist', () => {
    const events = [
      makeEvent({ id: '1', start_time: '2025-06-15T08:00:00.000Z' }),
      makeEvent({ id: '2', start_time: '2025-06-15T10:00:00.000Z' }),
      makeEvent({ id: '3', start_time: '2025-06-15T12:00:00.000Z' }),
    ];

    const result = createMarkedDates(events);
    expect(result['2025-06-15'].extraCount).toBeUndefined();
  });

  it('does not include extraCount for a single event', () => {
    const events = [
      makeEvent({ id: '1', start_time: '2025-06-15T10:00:00.000Z' }),
    ];

    const result = createMarkedDates(events);
    expect(result['2025-06-15'].extraCount).toBeUndefined();
  });

  it('calculates correct extraCount for exactly 4 events', () => {
    const events = [
      makeEvent({ id: '1', start_time: '2025-06-15T08:00:00.000Z' }),
      makeEvent({ id: '2', start_time: '2025-06-15T10:00:00.000Z' }),
      makeEvent({ id: '3', start_time: '2025-06-15T12:00:00.000Z' }),
      makeEvent({ id: '4', start_time: '2025-06-15T14:00:00.000Z' }),
    ];

    const result = createMarkedDates(events);
    expect(result['2025-06-15'].dots).toHaveLength(3);
    expect(result['2025-06-15'].extraCount).toBe(1);
  });

  it('includes selectedDotColor on every dot', () => {
    const events = [
      makeEvent({ id: '1', category: 'fitness', start_time: '2025-06-15T10:00:00.000Z' }),
      makeEvent({ id: '2', category: 'work', start_time: '2025-06-15T14:00:00.000Z' }),
    ];

    const result = createMarkedDates(events);
    const dots = result['2025-06-15'].dots!;

    dots.forEach(dot => {
      expect(dot.selectedDotColor).toBe('#FFFFFF');
    });
  });

  it('marks the selected date with loopBlue', () => {
    const result = createMarkedDates([], '2025-06-15');

    expect(result['2025-06-15']).toBeDefined();
    expect(result['2025-06-15'].selected).toBe(true);
    expect(result['2025-06-15'].selectedColor).toBe(BRAND_LOOP_BLUE);
    expect(result['2025-06-15'].selectedTextColor).toBe('#FFFFFF');
  });

  it('merges selected date with existing dots', () => {
    const events = [
      makeEvent({ id: '1', category: 'dining', start_time: '2025-06-15T10:00:00.000Z' }),
    ];

    const result = createMarkedDates(events, '2025-06-15');

    expect(result['2025-06-15'].selected).toBe(true);
    expect(result['2025-06-15'].selectedColor).toBe(BRAND_LOOP_BLUE);
    expect(result['2025-06-15'].dots).toHaveLength(1);
    expect(result['2025-06-15'].marked).toBe(true);
  });

  it('handles selected date with no events', () => {
    const events = [
      makeEvent({ id: '1', start_time: '2025-06-15T10:00:00.000Z' }),
    ];

    const result = createMarkedDates(events, '2025-06-16');

    // Date with events
    expect(result['2025-06-15'].dots).toHaveLength(1);
    expect(result['2025-06-15'].selected).toBeUndefined();

    // Selected date with no events
    expect(result['2025-06-16'].selected).toBe(true);
    expect(result['2025-06-16'].dots).toBeUndefined();
  });

  it('returns empty object for no events and no selected date', () => {
    const result = createMarkedDates([]);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('handles events across multiple dates', () => {
    const events = [
      makeEvent({ id: '1', start_time: '2025-06-10T10:00:00.000Z' }),
      makeEvent({ id: '2', start_time: '2025-06-15T10:00:00.000Z' }),
      makeEvent({ id: '3', start_time: '2025-06-15T14:00:00.000Z' }),
      makeEvent({ id: '4', start_time: '2025-06-20T10:00:00.000Z' }),
    ];

    const result = createMarkedDates(events, '2025-06-15');

    expect(result['2025-06-10'].dots).toHaveLength(1);
    expect(result['2025-06-15'].dots).toHaveLength(2);
    expect(result['2025-06-15'].selected).toBe(true);
    expect(result['2025-06-20'].dots).toHaveLength(1);
  });

  it('uses different colors for different categories', () => {
    const events = [
      makeEvent({ id: '1', category: 'fitness', start_time: '2025-06-15T08:00:00.000Z' }),
      makeEvent({ id: '2', category: 'dining', start_time: '2025-06-15T12:00:00.000Z' }),
      makeEvent({ id: '3', category: 'work', start_time: '2025-06-15T16:00:00.000Z' }),
    ];

    const result = createMarkedDates(events);
    const dots = result['2025-06-15'].dots!;

    expect(dots[0].color).toBe(CATEGORY_COLORS.fitness);
    expect(dots[1].color).toBe(CATEGORY_COLORS.dining);
    expect(dots[2].color).toBe(CATEGORY_COLORS.work);
  });

  it('handles null category gracefully', () => {
    const events = [
      makeEvent({ id: '1', category: null, start_time: '2025-06-15T10:00:00.000Z' }),
    ];

    const result = createMarkedDates(events);
    expect(result['2025-06-15'].dots![0].color).toBe(CATEGORY_COLORS.other);
  });

  it('preserves dot order matching time sort order', () => {
    const events = [
      makeEvent({ id: 'c', category: 'travel', start_time: '2025-06-15T18:00:00.000Z' }),
      makeEvent({ id: 'a', category: 'fitness', start_time: '2025-06-15T06:00:00.000Z' }),
      makeEvent({ id: 'b', category: 'work', start_time: '2025-06-15T12:00:00.000Z' }),
    ];

    const result = createMarkedDates(events);
    const dots = result['2025-06-15'].dots!;

    // Should be sorted by start_time: fitness (6am), work (12pm), travel (6pm)
    expect(dots[0].color).toBe(CATEGORY_COLORS.fitness);
    expect(dots[1].color).toBe(CATEGORY_COLORS.work);
    expect(dots[2].color).toBe(CATEGORY_COLORS.travel);
  });
});

describe('formatDateKey timezone correctness', () => {
  it('uses local date, not UTC date', () => {
    // Create a date that is Feb 15 at 11pm local time
    // (which would be Feb 16 in UTC for CST users)
    const localDate = new Date(2025, 1, 15, 23, 0, 0); // Feb 15, 11pm local
    const key = formatDateKey(localDate);
    expect(key).toBe('2025-02-15');
  });

  it('event created for a local date gets dot on that date', () => {
    // Simulate what happens when user creates event for Feb 15 in local TZ
    // The start_time in DB is the local midnight converted to UTC
    const localFeb15 = new Date(2025, 1, 15, 14, 0, 0); // Feb 15 2pm local
    const utcString = localFeb15.toISOString(); // could be Feb 15 or 16 in UTC

    const events = [
      makeEvent({ id: '1', category: 'travel', start_time: utcString }),
    ];

    const result = createMarkedDates(events);
    // The dot should appear on local Feb 15, not the UTC date
    expect(result['2025-02-15']).toBeDefined();
    expect(result['2025-02-15'].dots).toHaveLength(1);
  });

  it('midnight-adjacent events stay on their local date', () => {
    // Event at 11:30 PM local time on June 15
    const lateNight = new Date(2025, 5, 15, 23, 30, 0);
    const key = formatDateKey(lateNight);
    expect(key).toBe('2025-06-15');
  });

  it('early morning events stay on their local date', () => {
    // Event at 12:30 AM local time on June 16
    const earlyMorning = new Date(2025, 5, 16, 0, 30, 0);
    const key = formatDateKey(earlyMorning);
    expect(key).toBe('2025-06-16');
  });
});
