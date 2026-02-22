/**
 * Time Slot Types for Date-Filtered Recommendations
 * Supports smart scheduling: calendar-aware free time detection,
 * activity-to-slot matching, and contextual time labels
 */

/** A contiguous block of free time between calendar events */
export interface FreeTimeSlot {
  /** Slot start (after previous event + travel buffer) */
  start: Date;
  /** Slot end (before next event - travel buffer) */
  end: Date;
  /** Duration in minutes */
  durationMinutes: number;
  /** Event before this slot (null if first slot of day) */
  previousEvent?: CalendarEvent;
  /** Event after this slot (null if last slot of day) */
  nextEvent?: CalendarEvent;
  /** Travel buffer subtracted from start (minutes) */
  travelBufferFromPrevious: number;
  /** Travel buffer subtracted from end (minutes) */
  travelBufferToNext: number;
}

/** Simplified calendar event for slot analysis */
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  category?: string;
}

/** Result of matching an activity to a time slot */
export interface SlotMatch {
  /** The free time slot this activity fits into */
  slot: FreeTimeSlot;
  /** Suggested start time within the slot */
  suggestedStart: Date;
  /** Suggested end time based on estimated duration */
  suggestedEnd: Date;
  /** How well this activity fits (0-100) */
  fitScore: number;
  /** Human-readable context label */
  contextLabel: string;
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
  /** Travel time from previous event in minutes (if applicable) */
  travelFromPreviousMinutes?: number;
  /** Travel time to next event in minutes (if applicable) */
  travelToNextMinutes?: number;
}

/** Full analysis of a day's time slots */
export interface DaySlotAnalysis {
  /** Target date */
  date: Date;
  /** All free time slots found */
  freeSlots: FreeTimeSlot[];
  /** Calendar events for the day */
  events: CalendarEvent[];
  /** Total free time in minutes */
  totalFreeMinutes: number;
  /** Number of schedulable gaps (>= 45 min) */
  schedulableGapCount: number;
  /** Human-readable day summary */
  daySummary: string;
}

/** Date context enrichment for a recommendation card */
export interface DateContext {
  /** Suggested start time for this activity on the target date */
  suggestedStartTime: Date;
  /** Suggested end time */
  suggestedEndTime: Date;
  /** e.g. "Sat 2:30 PM - 4:00 PM" */
  suggestedTimeLabel: string;
  /** e.g. "After Surf Lessons - 2.5 hrs before Dinner" */
  timeContextLabel: string;
  /** e.g. "8 min from Surf Lessons" */
  travelContextLabel?: string;
  /** How well this fits the slot (0-100) */
  slotConfidence: number;
  /** Confidence tier */
  confidenceTier: 'high' | 'medium' | 'low';
  /** Minutes of travel from previous event */
  travelFromPreviousMinutes?: number;
}

/** Props for the DateFilterBar component */
export interface DateFilterSelection {
  /** Selected date (null = today / no filter) */
  date: Date | null;
  /** Quick-select label that was tapped (null if custom date) */
  quickLabel: string | null;
}

/** Day pill option in the DateFilterBar */
export interface DatePill {
  label: string;
  date: Date;
  isToday: boolean;
  dayOfWeek: string;
  dayOfMonth: number;
}
