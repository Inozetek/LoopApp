/**
 * Tests for calendar free time features —
 * slot filtering, duration formatting, and timeline merge logic.
 */

interface FreeTimeSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  category: string;
  status: string;
  address: string;
  location: any;
}

// Replicate the filtering logic from the calendar component
function filterSlotsForDate(slots: FreeTimeSlot[], selectedDate: string): FreeTimeSlot[] {
  const dayStart = new Date(`${selectedDate}T00:00:00`);
  const dayEnd = new Date(`${selectedDate}T23:59:59`);
  return slots.filter((slot) => {
    const slotStart = new Date(slot.start);
    return slotStart >= dayStart && slotStart <= dayEnd;
  });
}

// Replicate the duration formatting
function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h `;
  }
  return `${minutes}m`;
}

// Replicate the merged timeline logic
type TimelineItem =
  | { type: 'event'; data: CalendarEvent }
  | { type: 'free'; data: FreeTimeSlot };

function buildMergedTimeline(events: CalendarEvent[], freeSlots: FreeTimeSlot[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  events.forEach((e) => items.push({ type: 'event', data: e }));
  freeSlots.forEach((slot) => items.push({ type: 'free', data: slot }));

  items.sort((a, b) => {
    const aTime = a.type === 'event'
      ? new Date(a.data.start_time).getTime()
      : (a.data as FreeTimeSlot).start.getTime();
    const bTime = b.type === 'event'
      ? new Date(b.data.start_time).getTime()
      : (b.data as FreeTimeSlot).start.getTime();
    return aTime - bTime;
  });

  return items;
}

describe('Calendar Free Time - Slot Filtering', () => {
  const today = '2025-03-15';

  const slots: FreeTimeSlot[] = [
    {
      start: new Date('2025-03-15T10:00:00'),
      end: new Date('2025-03-15T12:00:00'),
      durationMinutes: 120,
    },
    {
      start: new Date('2025-03-15T14:00:00'),
      end: new Date('2025-03-15T16:00:00'),
      durationMinutes: 120,
    },
    {
      start: new Date('2025-03-16T09:00:00'),
      end: new Date('2025-03-16T11:00:00'),
      durationMinutes: 120,
    },
  ];

  it('filters slots for the selected date', () => {
    const filtered = filterSlotsForDate(slots, today);
    expect(filtered).toHaveLength(2);
    expect(new Date(filtered[0].start).getDate()).toBe(15);
    expect(new Date(filtered[1].start).getDate()).toBe(15);
  });

  it('returns empty array for dates with no free time', () => {
    const filtered = filterSlotsForDate(slots, '2025-03-17');
    expect(filtered).toHaveLength(0);
  });

  it('filters correctly for a different day', () => {
    const filtered = filterSlotsForDate(slots, '2025-03-16');
    expect(filtered).toHaveLength(1);
    expect(new Date(filtered[0].start).getDate()).toBe(16);
  });
});

describe('Calendar Free Time - Duration Formatting', () => {
  it('formats minutes-only durations', () => {
    expect(formatDuration(30)).toBe('30m');
    expect(formatDuration(45)).toBe('45m');
  });

  it('formats exact hours', () => {
    expect(formatDuration(60)).toBe('1h ');
    expect(formatDuration(120)).toBe('2h ');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(150)).toBe('2h 30m');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0m');
  });
});

describe('Calendar Free Time - Timeline Merge', () => {
  it('merges events and free slots in chronological order', () => {
    const events: CalendarEvent[] = [
      {
        id: 'e1',
        title: 'Meeting',
        start_time: '2025-03-15T09:00:00',
        end_time: '2025-03-15T10:00:00',
        category: 'work',
        status: 'scheduled',
        address: 'Office',
        location: { latitude: 32.7, longitude: -96.8 },
      },
      {
        id: 'e2',
        title: 'Lunch',
        start_time: '2025-03-15T12:00:00',
        end_time: '2025-03-15T13:00:00',
        category: 'dining',
        status: 'scheduled',
        address: 'Restaurant',
        location: { latitude: 32.7, longitude: -96.8 },
      },
    ];

    const freeSlots: FreeTimeSlot[] = [
      {
        start: new Date('2025-03-15T10:00:00'),
        end: new Date('2025-03-15T12:00:00'),
        durationMinutes: 120,
      },
    ];

    const timeline = buildMergedTimeline(events, freeSlots);

    expect(timeline).toHaveLength(3);
    expect(timeline[0].type).toBe('event');
    expect((timeline[0].data as CalendarEvent).title).toBe('Meeting');
    expect(timeline[1].type).toBe('free');
    expect((timeline[1].data as FreeTimeSlot).durationMinutes).toBe(120);
    expect(timeline[2].type).toBe('event');
    expect((timeline[2].data as CalendarEvent).title).toBe('Lunch');
  });

  it('returns only events when no free slots', () => {
    const events: CalendarEvent[] = [
      {
        id: 'e1',
        title: 'Work',
        start_time: '2025-03-15T09:00:00',
        end_time: '2025-03-15T17:00:00',
        category: 'work',
        status: 'scheduled',
        address: 'Office',
        location: null,
      },
    ];

    const timeline = buildMergedTimeline(events, []);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].type).toBe('event');
  });

  it('returns only free slots when no events', () => {
    const freeSlots: FreeTimeSlot[] = [
      {
        start: new Date('2025-03-15T10:00:00'),
        end: new Date('2025-03-15T18:00:00'),
        durationMinutes: 480,
      },
    ];

    const timeline = buildMergedTimeline([], freeSlots);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].type).toBe('free');
  });

  it('returns empty array when both are empty', () => {
    const timeline = buildMergedTimeline([], []);
    expect(timeline).toHaveLength(0);
  });
});

describe('Calendar Free Time - Daily Summary', () => {
  it('sums total free minutes correctly', () => {
    const slots: FreeTimeSlot[] = [
      { start: new Date(), end: new Date(), durationMinutes: 60 },
      { start: new Date(), end: new Date(), durationMinutes: 90 },
      { start: new Date(), end: new Date(), durationMinutes: 30 },
    ];

    const totalMinutes = slots.reduce((sum, slot) => sum + slot.durationMinutes, 0);
    expect(totalMinutes).toBe(180);
  });
});
