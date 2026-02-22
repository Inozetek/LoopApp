/**
 * Smart Time Slot Engine
 * Analyzes calendar events for a target date, finds free time gaps,
 * and matches activities to optimal slots with contextual labels.
 */

import {
  FreeTimeSlot,
  CalendarEvent,
  SlotMatch,
  DaySlotAnalysis,
  DateContext,
} from '@/types/time-slots';
import {
  getEstimatedDuration,
  MIN_SCHEDULABLE_GAP,
  DEFAULT_TRAVEL_BUFFER,
} from '@/constants/activity-durations';

// ── Helpers ──────────────────────────────────────────────────────────

/** Haversine distance between two lat/lng points (miles) */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Estimate travel time in minutes based on distance (assumes avg 25 mph city driving) */
export function estimateTravelMinutes(distanceMiles: number): number {
  if (distanceMiles <= 0) return 0;
  // 25 mph average → 1 mile per 2.4 minutes, plus 5 min buffer for parking
  return Math.ceil(distanceMiles * 2.4 + 5);
}

/** Calculate travel buffer between two locations */
export function calculateTravelBuffer(
  from?: { latitude: number; longitude: number },
  to?: { latitude: number; longitude: number }
): number {
  if (!from || !to) return DEFAULT_TRAVEL_BUFFER;
  const distance = haversineDistance(from.latitude, from.longitude, to.latitude, to.longitude);
  return Math.max(DEFAULT_TRAVEL_BUFFER, estimateTravelMinutes(distance));
}

/** Format time as "2:30 PM" */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Format duration as "1.5 hrs" or "45 min" */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours === Math.floor(hours)) return `${hours} hr${hours > 1 ? 's' : ''}`;
  return `${hours.toFixed(1)} hrs`;
}

/** Get day-of-week abbreviation for display */
function getDayAbbrev(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

/** Check if two dates are the same calendar day */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ── Core Engine ──────────────────────────────────────────────────────

/** Default day boundaries: 7 AM to 11 PM */
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 23;

/**
 * Analyze a day's calendar to find free time slots.
 * Merges overlapping events, computes travel buffers, and identifies gaps.
 */
export function analyzeCalendarSlots(
  events: CalendarEvent[],
  targetDate: Date,
  userLocation?: { latitude: number; longitude: number }
): DaySlotAnalysis {
  // Set day boundaries
  const dayStart = new Date(targetDate);
  dayStart.setHours(DAY_START_HOUR, 0, 0, 0);

  const dayEnd = new Date(targetDate);
  dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);

  // Filter events to target date and sort by start time
  const dayEvents = events
    .filter((e) => isSameDay(e.startTime, targetDate))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Merge overlapping/adjacent events into busy blocks
  const mergedBlocks: { start: Date; end: Date; events: CalendarEvent[] }[] = [];
  for (const event of dayEvents) {
    const last = mergedBlocks[mergedBlocks.length - 1];
    if (last && event.startTime.getTime() <= last.end.getTime()) {
      // Overlapping — extend the block
      if (event.endTime.getTime() > last.end.getTime()) {
        last.end = event.endTime;
      }
      last.events.push(event);
    } else {
      mergedBlocks.push({
        start: event.startTime,
        end: event.endTime,
        events: [event],
      });
    }
  }

  // Find free gaps between busy blocks
  const freeSlots: FreeTimeSlot[] = [];
  let cursor = dayStart;

  for (const block of mergedBlocks) {
    const gapStart = cursor;
    const gapEnd = block.start;
    const gapMinutes = (gapEnd.getTime() - gapStart.getTime()) / 60000;

    if (gapMinutes >= MIN_SCHEDULABLE_GAP) {
      // Calculate travel buffers
      const prevEvent = mergedBlocks.indexOf(block) > 0
        ? mergedBlocks[mergedBlocks.indexOf(block) - 1].events[mergedBlocks[mergedBlocks.indexOf(block) - 1].events.length - 1]
        : undefined;
      const nextEvent = block.events[0];

      const bufferFromPrev = prevEvent?.location && userLocation
        ? calculateTravelBuffer(prevEvent.location, userLocation)
        : 0;
      const bufferToNext = nextEvent?.location && userLocation
        ? calculateTravelBuffer(userLocation, nextEvent.location)
        : DEFAULT_TRAVEL_BUFFER;

      // Adjusted slot start/end with travel buffers
      const adjustedStart = new Date(gapStart.getTime() + bufferFromPrev * 60000);
      const adjustedEnd = new Date(gapEnd.getTime() - bufferToNext * 60000);
      const adjustedMinutes = (adjustedEnd.getTime() - adjustedStart.getTime()) / 60000;

      if (adjustedMinutes >= MIN_SCHEDULABLE_GAP) {
        freeSlots.push({
          start: adjustedStart,
          end: adjustedEnd,
          durationMinutes: adjustedMinutes,
          previousEvent: prevEvent,
          nextEvent,
          travelBufferFromPrevious: bufferFromPrev,
          travelBufferToNext: bufferToNext,
        });
      }
    }

    cursor = new Date(Math.max(cursor.getTime(), block.end.getTime()));
  }

  // Trailing free time after last event until day end
  const trailingMinutes = (dayEnd.getTime() - cursor.getTime()) / 60000;
  if (trailingMinutes >= MIN_SCHEDULABLE_GAP) {
    const lastBlock = mergedBlocks[mergedBlocks.length - 1];
    const prevEvent = lastBlock?.events[lastBlock.events.length - 1];
    const bufferFromPrev = prevEvent?.location && userLocation
      ? calculateTravelBuffer(prevEvent.location, userLocation)
      : 0;

    const adjustedStart = new Date(cursor.getTime() + bufferFromPrev * 60000);
    const adjustedMinutes = (dayEnd.getTime() - adjustedStart.getTime()) / 60000;

    if (adjustedMinutes >= MIN_SCHEDULABLE_GAP) {
      freeSlots.push({
        start: adjustedStart,
        end: dayEnd,
        durationMinutes: adjustedMinutes,
        previousEvent: prevEvent,
        travelBufferFromPrevious: bufferFromPrev,
        travelBufferToNext: 0,
      });
    }
  }

  const totalFreeMinutes = freeSlots.reduce((sum, s) => sum + s.durationMinutes, 0);

  // Generate human-readable summary
  const daySummary = generateDaySummary(targetDate, dayEvents, freeSlots, totalFreeMinutes);

  return {
    date: targetDate,
    freeSlots,
    events: dayEvents,
    totalFreeMinutes,
    schedulableGapCount: freeSlots.length,
    daySummary,
  };
}

/**
 * Match an activity to the best available time slot.
 * Returns the best SlotMatch or null if no suitable slot found.
 */
export function matchActivityToSlots(
  category: string,
  freeSlots: FreeTimeSlot[],
  activityLocation?: { latitude: number; longitude: number },
  openingHoursPeriods?: Array<{
    open: { day: number; time: string };
    close?: { day: number; time: string };
  }>
): SlotMatch | null {
  const duration = getEstimatedDuration(category);
  const matches: SlotMatch[] = [];

  for (const slot of freeSlots) {
    // Check if the activity fits in this slot
    if (slot.durationMinutes < duration.minimum) continue;

    // Calculate travel from previous event to activity location
    let travelFromPrev = 0;
    if (slot.previousEvent?.location && activityLocation) {
      travelFromPrev = estimateTravelMinutes(
        haversineDistance(
          slot.previousEvent.location.latitude,
          slot.previousEvent.location.longitude,
          activityLocation.latitude,
          activityLocation.longitude
        )
      );
    }

    // Calculate travel from activity to next event
    let travelToNext = 0;
    if (slot.nextEvent?.location && activityLocation) {
      travelToNext = estimateTravelMinutes(
        haversineDistance(
          activityLocation.latitude,
          activityLocation.longitude,
          slot.nextEvent.location.latitude,
          slot.nextEvent.location.longitude
        )
      );
    }

    // Suggested start: after travel from previous
    const suggestedStart = new Date(
      slot.start.getTime() + Math.max(0, travelFromPrev - slot.travelBufferFromPrevious) * 60000
    );

    // Suggested end: typical duration, but don't overflow the slot
    const typicalEnd = new Date(suggestedStart.getTime() + duration.typical * 60000);
    const maxEnd = new Date(
      slot.end.getTime() - Math.max(0, travelToNext - slot.travelBufferToNext) * 60000
    );
    const suggestedEnd = new Date(Math.min(typicalEnd.getTime(), maxEnd.getTime()));

    const actualDuration = (suggestedEnd.getTime() - suggestedStart.getTime()) / 60000;
    if (actualDuration < duration.minimum) continue;

    // Check opening hours if available
    if (openingHoursPeriods) {
      const isOpen = isOpenDuring(openingHoursPeriods, suggestedStart, suggestedEnd);
      if (!isOpen) continue;
    }

    // Score the fit (0-100)
    const fitScore = calculateFitScore(
      actualDuration,
      duration.typical,
      slot.durationMinutes,
      travelFromPrev,
      travelToNext,
      suggestedStart
    );

    // Determine confidence
    const confidence: 'high' | 'medium' | 'low' =
      fitScore >= 75 ? 'high' : fitScore >= 50 ? 'medium' : 'low';

    // Generate context label
    const contextLabel = generateSlotContextLabel(slot, suggestedStart, suggestedEnd);

    matches.push({
      slot,
      suggestedStart,
      suggestedEnd,
      fitScore,
      contextLabel,
      confidence,
      travelFromPreviousMinutes: travelFromPrev > 0 ? travelFromPrev : undefined,
      travelToNextMinutes: travelToNext > 0 ? travelToNext : undefined,
    });
  }

  if (matches.length === 0) return null;

  // Return the best match
  matches.sort((a, b) => b.fitScore - a.fitScore);
  return matches[0];
}

/**
 * Generate a DateContext object for enriching a recommendation card.
 */
export function generateDateContext(
  slotMatch: SlotMatch,
  targetDate: Date
): DateContext {
  const dayAbbrev = getDayAbbrev(targetDate);
  const startTime = formatTime(slotMatch.suggestedStart);
  const endTime = formatTime(slotMatch.suggestedEnd);

  const suggestedTimeLabel = `${dayAbbrev} ${startTime} - ${endTime}`;

  // Travel context
  let travelContextLabel: string | undefined;
  if (slotMatch.travelFromPreviousMinutes && slotMatch.slot.previousEvent) {
    travelContextLabel = `${slotMatch.travelFromPreviousMinutes} min from ${slotMatch.slot.previousEvent.title}`;
  }

  return {
    suggestedStartTime: slotMatch.suggestedStart,
    suggestedEndTime: slotMatch.suggestedEnd,
    suggestedTimeLabel,
    timeContextLabel: slotMatch.contextLabel,
    travelContextLabel,
    slotConfidence: slotMatch.fitScore,
    confidenceTier: slotMatch.confidence,
    travelFromPreviousMinutes: slotMatch.travelFromPreviousMinutes,
  };
}

// ── Scoring ──────────────────────────────────────────────────────────

function calculateFitScore(
  actualDuration: number,
  typicalDuration: number,
  slotDuration: number,
  travelFromPrev: number,
  travelToNext: number,
  startTime: Date
): number {
  let score = 0;

  // Duration fit (40 points max): closer to typical duration = better
  const durationRatio = actualDuration / typicalDuration;
  if (durationRatio >= 0.8 && durationRatio <= 1.3) {
    score += 40; // Perfect fit
  } else if (durationRatio >= 0.6) {
    score += 30; // Acceptable
  } else {
    score += 15; // Tight
  }

  // Slot utilization (20 points): not too tight, not too loose
  const utilization = actualDuration / slotDuration;
  if (utilization >= 0.4 && utilization <= 0.85) {
    score += 20; // Comfortable fit with breathing room
  } else if (utilization < 0.4) {
    score += 10; // Lots of extra time (slot much bigger than needed)
  } else {
    score += 5; // Very tight
  }

  // Travel efficiency (20 points): less travel = better
  const totalTravel = travelFromPrev + travelToNext;
  if (totalTravel <= 10) {
    score += 20;
  } else if (totalTravel <= 20) {
    score += 15;
  } else if (totalTravel <= 30) {
    score += 10;
  } else {
    score += 5;
  }

  // Time-of-day preference (20 points)
  const hour = startTime.getHours();
  // Prefer popular activity hours (10 AM - 8 PM)
  if (hour >= 10 && hour <= 20) {
    score += 20;
  } else if (hour >= 8 && hour <= 22) {
    score += 12;
  } else {
    score += 5;
  }

  return Math.min(100, score);
}

// ── Opening Hours Check ──────────────────────────────────────────────

function isOpenDuring(
  periods: Array<{ open: { day: number; time: string }; close?: { day: number; time: string } }>,
  start: Date,
  end: Date
): boolean {
  const dayOfWeek = start.getDay(); // 0=Sun, 6=Sat
  for (const period of periods) {
    if (period.open.day !== dayOfWeek) continue;
    if (!period.close) return true; // Open 24 hours

    const openTime = parseInt(period.open.time.slice(0, 2)) * 60 + parseInt(period.open.time.slice(2));
    const closeTime = parseInt(period.close.time.slice(0, 2)) * 60 + parseInt(period.close.time.slice(2));
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();

    if (startMinutes >= openTime && endMinutes <= closeTime) {
      return true;
    }
  }
  return false;
}

// ── Context Label Generation ─────────────────────────────────────────

function generateSlotContextLabel(
  slot: FreeTimeSlot,
  suggestedStart: Date,
  suggestedEnd: Date
): string {
  const parts: string[] = [];

  if (slot.previousEvent) {
    parts.push(`After ${slot.previousEvent.title}`);
  }

  if (slot.nextEvent) {
    const minutesBefore = (slot.nextEvent.startTime.getTime() - suggestedEnd.getTime()) / 60000;
    if (minutesBefore > 0) {
      parts.push(`${formatDuration(Math.round(minutesBefore))} before ${slot.nextEvent.title}`);
    }
  }

  if (parts.length === 0) {
    // No surrounding events — just describe the time
    const hour = suggestedStart.getHours();
    if (hour < 12) return 'Free morning slot';
    if (hour < 17) return 'Free afternoon slot';
    return 'Free evening slot';
  }

  return parts.join(' \u2014 '); // em dash separator
}

function generateDaySummary(
  targetDate: Date,
  events: CalendarEvent[],
  freeSlots: FreeTimeSlot[],
  totalFreeMinutes: number
): string {
  const dayName = targetDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  if (events.length === 0) {
    return `${dayName} \u2014 Open day, ${formatDuration(totalFreeMinutes)} free`;
  }

  const eventText = events.length === 1
    ? '1 event'
    : `${events.length} events`;

  const freeText = totalFreeMinutes > 0
    ? `${formatDuration(totalFreeMinutes)} free`
    : 'fully booked';

  return `${dayName} \u2014 ${eventText}, ${freeText}`;
}

// ── Exported for testing ─────────────────────────────────────────────

export const _testExports = {
  haversineDistance,
  formatTime,
  formatDuration,
  getDayAbbrev,
  isSameDay,
  calculateFitScore,
  isOpenDuring,
  generateSlotContextLabel,
  generateDaySummary,
};
