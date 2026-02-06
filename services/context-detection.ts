/**
 * Context Detection Service
 *
 * Detects user contexts from calendar events and patterns:
 * - Trips: Out-of-city calendar events
 * - Social: Events with friends/groups
 * - Schedule: Gaps between events
 * - Routines: (Phase 2) Recurring patterns
 */

import { supabase } from '@/lib/supabase';
import { ContextBadgeColors } from '@/constants/brand';
import type {
  RecommendationContext,
  TripContext,
  SocialContext,
  ScheduleContext,
  TimeSlot,
  CalendarEventRef,
  ContextDetectionParams,
  ContextDetectionResult,
  ContextBadge,
  ContextBadgeType,
} from '@/types/context';

// ============================================================================
// CONSTANTS
// ============================================================================

// Distance threshold to consider a location as "different city" (in miles)
const TRIP_DISTANCE_THRESHOLD = 50;

// Minimum gap duration to consider for schedule context (in minutes)
const MIN_GAP_DURATION = 60;

// Maximum lookahead for trip detection (in days)
const DEFAULT_LOOKAHEAD_DAYS = 14;

// Badge colors (from brand constants)
const BADGE_COLORS: Record<ContextBadgeType, string> = ContextBadgeColors as Record<ContextBadgeType, string>;

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * Detect all active contexts for a user
 */
export async function detectUserContexts(
  params: ContextDetectionParams
): Promise<ContextDetectionResult> {
  const {
    userId,
    userHomeLocation,
    lookaheadDays = DEFAULT_LOOKAHEAD_DAYS,
    includeSocial = true,
    includeSchedule = true,
    includeTrips = true,
  } = params;

  const now = new Date();
  const lookaheadEnd = new Date(now);
  lookaheadEnd.setDate(lookaheadEnd.getDate() + lookaheadDays);

  const contexts: RecommendationContext[] = [];
  const detectedTrips: TripContext[] = [];
  const detectedSocialEvents: SocialContext[] = [];
  const detectedGaps: ScheduleContext[] = [];

  // Fetch calendar events
  const { data: calendarEvents, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId)
    .gte('start_time', now.toISOString())
    .lte('start_time', lookaheadEnd.toISOString())
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching calendar events for context detection:', error);
    return {
      contexts: [],
      detectedTrips: [],
      detectedSocialEvents: [],
      detectedGaps: [],
      detectionTimestamp: now,
    };
  }

  const events = calendarEvents || [];

  // 1. Detect trips (out-of-city events)
  if (includeTrips && userHomeLocation) {
    const trips = await detectTripContexts(events, userHomeLocation);
    detectedTrips.push(...trips);

    // Create recommendation contexts for trips
    for (const trip of trips) {
      const daysAway = Math.ceil(
        (trip.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const tripDuration = Math.ceil(
        (trip.endDate.getTime() - trip.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      contexts.push({
        id: `trip-${trip.destination.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
        type: 'trip',
        title: `For your ${trip.destination} trip`,
        subtitle: `${formatDateRange(trip.startDate, trip.endDate)} • ${daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `${daysAway} days away`}`,
        icon: '🗺️',
        priority: 10 - Math.min(daysAway, 10), // Closer trips = higher priority
        metadata: trip,
        createdAt: now,
        expiresAt: trip.endDate,
      });
    }
  }

  // 2. Detect social contexts (events with friends)
  if (includeSocial) {
    const socialEvents = await detectSocialContexts(userId, events);
    detectedSocialEvents.push(...socialEvents);

    // Create recommendation contexts for social events
    for (const social of socialEvents) {
      const daysAway = Math.ceil(
        (social.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      contexts.push({
        id: `social-${social.calendarEventId || social.groupName?.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() || Date.now()}`,
        type: 'social',
        title: social.groupName ? `With ${social.groupName}` : 'Social Event',
        subtitle: social.occasion
          ? `${social.occasion} • ${formatDate(social.date)}`
          : formatDate(social.date),
        icon: '👥',
        priority: 20 - Math.min(daysAway, 10),
        metadata: social,
        createdAt: now,
        expiresAt: social.date,
      });
    }
  }

  // 3. Detect schedule gaps
  if (includeSchedule) {
    const gaps = detectScheduleGaps(events, userHomeLocation);
    detectedGaps.push(...gaps);

    // Create recommendation contexts for significant gaps
    const significantGaps = gaps.filter(
      (gap) => gap.availableTime.durationMinutes >= 120 // 2+ hour gaps
    );

    for (const gap of significantGaps.slice(0, 3)) {
      // Limit to top 3 gaps
      const beforeTitle = gap.beforeEvent?.title || 'free time';
      const afterTitle = gap.afterEvent?.title || 'your next activity';

      contexts.push({
        id: `schedule-${gap.availableTime.start.getTime()}`,
        type: 'schedule',
        title: gap.isOnRoute
          ? 'On your way'
          : `Between ${beforeTitle} and ${afterTitle}`,
        subtitle: `${formatTimeRange(gap.availableTime.start, gap.availableTime.end)} • ${gap.availableTime.durationMinutes} min`,
        icon: '⏰',
        priority: 30,
        metadata: gap,
        createdAt: now,
        expiresAt: gap.availableTime.end,
      });
    }
  }

  // 4. Add general context (always present)
  contexts.push({
    id: 'general',
    type: 'general',
    title: 'For You',
    subtitle: 'Personalized recommendations',
    icon: '✨',
    priority: 100, // Lowest priority
    metadata: { type: 'general' },
    createdAt: now,
  });

  // Sort contexts by priority
  contexts.sort((a, b) => a.priority - b.priority);

  return {
    contexts,
    detectedTrips,
    detectedSocialEvents,
    detectedGaps,
    detectionTimestamp: now,
  };
}

// ============================================================================
// TRIP DETECTION
// ============================================================================

interface CalendarEventWithLocation {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: { latitude: number; longitude: number } | null;
  address?: string;
}

/**
 * Detect trips from calendar events with locations far from home
 */
async function detectTripContexts(
  events: CalendarEventWithLocation[],
  homeLocation: { lat: number; lng: number }
): Promise<TripContext[]> {
  const trips: TripContext[] = [];
  const tripGroups = new Map<string, CalendarEventWithLocation[]>();

  // Group events by destination city (events within threshold distance of each other)
  for (const event of events) {
    if (!event.location?.latitude || !event.location?.longitude) continue;

    const eventLoc = {
      lat: event.location.latitude,
      lng: event.location.longitude,
    };

    // Check if event is far from home
    const distanceFromHome = calculateDistance(homeLocation, eventLoc);
    if (distanceFromHome < TRIP_DISTANCE_THRESHOLD) continue;

    // Try to find existing trip group this event belongs to
    let foundGroup = false;
    for (const [key, groupEvents] of tripGroups) {
      const firstEvent = groupEvents[0];
      if (!firstEvent.location) continue;

      const groupLoc = {
        lat: firstEvent.location.latitude,
        lng: firstEvent.location.longitude,
      };

      const distanceFromGroup = calculateDistance(eventLoc, groupLoc);
      if (distanceFromGroup < 30) {
        // Within 30 miles of group center
        groupEvents.push(event);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      // Create new trip group
      const city = await getCityFromCoordinates(eventLoc.lat, eventLoc.lng);
      tripGroups.set(city || `trip-${trips.length}`, [event]);
    }
  }

  // Convert groups to TripContext
  for (const [destination, groupEvents] of tripGroups) {
    if (groupEvents.length === 0) continue;

    const sortedEvents = groupEvents.sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    const firstEvent = sortedEvents[0];
    const lastEvent = sortedEvents[sortedEvents.length - 1];

    // Calculate gaps between events
    const gaps: TimeSlot[] = [];
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const current = sortedEvents[i];
      const next = sortedEvents[i + 1];
      const gapStart = new Date(current.end_time);
      const gapEnd = new Date(next.start_time);
      const durationMinutes = (gapEnd.getTime() - gapStart.getTime()) / (1000 * 60);

      if (durationMinutes >= MIN_GAP_DURATION) {
        gaps.push({
          start: gapStart,
          end: gapEnd,
          durationMinutes,
        });
      }
    }

    trips.push({
      type: 'trip',
      destination,
      destinationLocation: {
        lat: firstEvent.location!.latitude,
        lng: firstEvent.location!.longitude,
      },
      startDate: new Date(firstEvent.start_time),
      endDate: new Date(lastEvent.end_time),
      calendarEventIds: sortedEvents.map((e) => e.id),
      scheduledGaps: gaps,
    });
  }

  return trips;
}

// ============================================================================
// SOCIAL CONTEXT DETECTION
// ============================================================================

/**
 * Detect social contexts from calendar events with friends/groups
 */
async function detectSocialContexts(
  userId: string,
  events: CalendarEventWithLocation[]
): Promise<SocialContext[]> {
  const socialContexts: SocialContext[] = [];

  // Fetch user's friends
  const { data: friendships } = await supabase
    .from('friendships')
    .select('friend_id, friend_group, users:friend_id(name)')
    .eq('user_id', userId)
    .eq('status', 'accepted');

  const friendNames =
    friendships?.map((f: any) => f.users?.name?.toLowerCase()).filter(Boolean) || [];
  const friendGroups = new Set(
    friendships?.map((f: any) => f.friend_group).filter(Boolean) || []
  );

  // Check each event for social context
  for (const event of events) {
    const titleLower = event.title.toLowerCase();

    // Check if event title contains friend names
    const mentionedFriends = friendNames.filter((name: string) =>
      titleLower.includes(name)
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

    if (mentionedFriends.length > 0 || matchedKeyword) {
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

      socialContexts.push({
        type: 'social',
        groupName,
        participants: mentionedFriends,
        occasion,
        date: new Date(event.start_time),
        calendarEventId: event.id,
      });
    }
  }

  return socialContexts;
}

// ============================================================================
// SCHEDULE GAP DETECTION
// ============================================================================

/**
 * Detect gaps between calendar events
 */
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
      // Events have different locations = potential route
      const currentLoc = {
        lat: current.location.latitude,
        lng: current.location.longitude,
      };
      const nextLoc = {
        lat: next.location.latitude,
        lng: next.location.longitude,
      };
      const distance = calculateDistance(currentLoc, nextLoc);
      isOnRoute = distance > 1 && distance < 30; // Between 1 and 30 miles apart
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

// ============================================================================
// BADGE GENERATION
// ============================================================================

/**
 * Generate context badges for a recommendation
 */
export function generateContextBadges(
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate distance between two points in miles
 */
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

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Get city name from coordinates using reverse geocoding
 */
async function getCityFromCoordinates(lat: number, lng: number): Promise<string | null> {
  try {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey) return null;

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&result_type=locality`
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const locality = data.results[0].address_components?.find((c: any) =>
        c.types.includes('locality')
      );
      const state = data.results[0].address_components?.find((c: any) =>
        c.types.includes('administrative_area_level_1')
      );

      if (locality) {
        return state ? `${locality.long_name}, ${state.short_name}` : locality.long_name;
      }
    }

    return null;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return null;
  }
}

/**
 * Format a date for display
 */
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

/**
 * Format a date range for display
 */
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

/**
 * Format a time range for display
 */
function formatTimeRange(start: Date, end: Date): string {
  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const dateStr = formatDate(start);
  return `${dateStr}, ${formatTime(start)} - ${formatTime(end)}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  TRIP_DISTANCE_THRESHOLD,
  MIN_GAP_DURATION,
  calculateDistance,
  formatDate,
  formatDateRange,
  formatTimeRange,
};
