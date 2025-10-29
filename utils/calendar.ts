/**
 * Calendar utility functions
 */

import { CalendarEvent } from '@/types/database';
import { CATEGORY_COLORS, CATEGORY_ICONS, EventCategory, EventWithColor, MarkedDate } from '@/constants/calendar';

/**
 * Format time for display (e.g., "9:00 AM")
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format date range (e.g., "9:00 AM - 11:00 AM")
 */
export function formatTimeRange(start: Date, end: Date): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

/**
 * Format date for calendar key (YYYY-MM-DD)
 */
export function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Get color for event category
 */
export function getCategoryColor(category: EventCategory | null): string {
  if (!category) return CATEGORY_COLORS.other;
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
}

/**
 * Get icon for event category
 */
export function getCategoryIcon(category: EventCategory | null): string {
  if (!category) return CATEGORY_ICONS.other;
  return CATEGORY_ICONS[category] || CATEGORY_ICONS.other;
}

/**
 * Convert CalendarEvent to EventWithColor
 */
export function convertToEventWithColor(event: CalendarEvent): EventWithColor {
  const category = event.category as EventCategory | null;
  return {
    id: event.id,
    title: event.title,
    category,
    startTime: new Date(event.start_time),
    endTime: new Date(event.end_time),
    color: getCategoryColor(category),
    icon: getCategoryIcon(category),
    address: event.address,
    description: event.description || undefined,
  };
}

/**
 * Group events by date
 */
export function groupEventsByDate(events: CalendarEvent[]): Map<string, EventWithColor[]> {
  const grouped = new Map<string, EventWithColor[]>();

  events.forEach(event => {
    const dateKey = formatDateKey(new Date(event.start_time));
    const eventWithColor = convertToEventWithColor(event);

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(eventWithColor);
  });

  // Sort events within each day by start time
  grouped.forEach(dayEvents => {
    dayEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  });

  return grouped;
}

/**
 * Create marked dates object for react-native-calendars
 */
export function createMarkedDates(
  events: CalendarEvent[],
  selectedDate?: string
): Record<string, MarkedDate> {
  const markedDates: Record<string, MarkedDate> = {};
  const grouped = groupEventsByDate(events);

  grouped.forEach((dayEvents, dateKey) => {
    // Create dots for multiple events (max 3 visible)
    const dots = dayEvents.slice(0, 3).map(event => ({
      key: event.id,
      color: event.color,
    }));

    markedDates[dateKey] = {
      marked: true,
      dots,
    };
  });

  // Mark selected date
  if (selectedDate) {
    markedDates[selectedDate] = {
      ...markedDates[selectedDate],
      selected: true,
      selectedColor: '#0066FF',
      selectedTextColor: '#FFFFFF',
    };
  }

  return markedDates;
}

/**
 * Get events for a specific date
 */
export function getEventsForDate(events: CalendarEvent[], date: Date): EventWithColor[] {
  const dateKey = formatDateKey(date);
  const grouped = groupEventsByDate(events);
  return grouped.get(dateKey) || [];
}

/**
 * Calculate event position for timeline view
 * Returns top position (%) and height (%) for a day view
 */
export function calculateEventPosition(
  startTime: Date,
  endTime: Date,
  dayStartHour = 6, // 6 AM
  dayEndHour = 23    // 11 PM
): { top: number; height: number } {
  const totalHours = dayEndHour - dayStartHour;

  const startHour = startTime.getHours() + startTime.getMinutes() / 60;
  const endHour = endTime.getHours() + endTime.getMinutes() / 60;

  // Clamp to day bounds
  const clampedStart = Math.max(dayStartHour, Math.min(dayEndHour, startHour));
  const clampedEnd = Math.max(dayStartHour, Math.min(dayEndHour, endHour));

  const top = ((clampedStart - dayStartHour) / totalHours) * 100;
  const height = ((clampedEnd - clampedStart) / totalHours) * 100;

  return { top, height: Math.max(height, 5) }; // Minimum 5% height
}

/**
 * Get default location (Home or Work) based on time of day
 */
export function getDefaultLocation(
  homeAddress: string | null,
  workAddress: string | null,
  time?: Date
): string | null {
  const hour = time ? time.getHours() : new Date().getHours();

  // Between 8 AM and 5 PM, default to work
  if (hour >= 8 && hour < 17) {
    return workAddress || homeAddress;
  }

  // Otherwise, default to home
  return homeAddress || workAddress;
}

/**
 * Generate time slots for time picker
 */
export function generateTimeSlots(): { label: string; value: Date }[] {
  const slots: { label: string; value: Date }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const time = new Date(today);
      time.setHours(hour, minute);
      slots.push({
        label: formatTime(time),
        value: time,
      });
    }
  }

  return slots;
}

/**
 * Round time to nearest 15 minutes
 */
export function roundToNearest15(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const remainder = minutes % 15;

  if (remainder < 8) {
    rounded.setMinutes(minutes - remainder);
  } else {
    rounded.setMinutes(minutes + (15 - remainder));
  }

  rounded.setSeconds(0);
  rounded.setMilliseconds(0);

  return rounded;
}
