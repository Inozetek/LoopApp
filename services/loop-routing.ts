/**
 * Loop Routing Service
 *
 * Handles smart routing logic for calendar events:
 * - Auto-chain events when user can't go home between them
 * - Calculate departure times with travel + parking buffers
 * - Update loop_routing data for all user events
 */

import { supabase } from '@/lib/supabase';
import {
  calculateDistance,
  estimateTravelTime,
  shouldChainEvents,
  calculateDepartureTime,
  type Coordinate,
} from '@/utils/route-calculations';
import type { CalendarEvent, LoopRouting } from '@/types/calendar-event';

/**
 * Update loop routing for all of a user's future events
 * Calls the PostgreSQL function to auto-chain events and calculate departure times
 */
export async function updateLoopRoutingForUser(userId: string): Promise<{
  success: boolean;
  eventsUpdated: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('update_loop_routing_for_user', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error updating loop routing:', error);
      return { success: false, eventsUpdated: 0, error: error.message };
    }

    return { success: true, eventsUpdated: data || 0 };
  } catch (error) {
    console.error('Error in updateLoopRoutingForUser:', error);
    return { success: false, eventsUpdated: 0, error: String(error) };
  }
}

/**
 * Client-side preview: Check if two events should be chained
 * Useful for showing user preview before saving to database
 */
export async function previewChaining(
  eventAId: string,
  eventBId: string
): Promise<{
  shouldChain: boolean;
  travelTimeToHome: number;
  travelTimeFromHome: number;
  roundTripTime: number;
  timeGap: number;
}> {
  try {
    // Get both events
    const { data: events, error } = await supabase
      .from('calendar_events')
      .select('id, location, end_time, start_time, user_id')
      .in('id', [eventAId, eventBId]);

    if (error || !events || events.length !== 2) {
      throw new Error('Failed to fetch events for chaining preview');
    }

    const eventA = events.find((e: { id: string }) => e.id === eventAId)!;
    const eventB = events.find((e: { id: string }) => e.id === eventBId)!;

    // Get user's home location
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('home_location')
      .eq('id', eventA.user_id)
      .single();

    if (userError || !user?.home_location) {
      throw new Error('User home location not found');
    }

    // Parse PostGIS POINT to Coordinate
    const homeLocation = parsePostGISPoint(user.home_location);
    const eventALocation = parsePostGISPoint(eventA.location);
    const eventBLocation = parsePostGISPoint(eventB.location);

    // Calculate travel times
    const distAToHome = calculateDistance(eventALocation, homeLocation);
    const distHomeToB = calculateDistance(homeLocation, eventBLocation);
    const travelAToHome = estimateTravelTime(distAToHome);
    const travelHomeToB = estimateTravelTime(distHomeToB);
    const roundTripTime = travelAToHome + travelHomeToB;

    // Calculate time gap
    const timeGapMs =
      new Date(eventB.start_time).getTime() - new Date(eventA.end_time).getTime();
    const timeGap = timeGapMs / (1000 * 60); // Convert to minutes

    return {
      shouldChain: roundTripTime > timeGap,
      travelTimeToHome: travelAToHome,
      travelTimeFromHome: travelHomeToB,
      roundTripTime,
      timeGap,
    };
  } catch (error) {
    console.error('Error in previewChaining:', error);
    throw error;
  }
}

/**
 * Get loop routing data for a specific event
 */
export async function getEventRouting(eventId: string): Promise<LoopRouting | null> {
  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('loop_routing')
      .eq('id', eventId)
      .single();

    if (error || !data) {
      console.error('Error fetching event routing:', error);
      return null;
    }

    return data.loop_routing as LoopRouting;
  } catch (error) {
    console.error('Error in getEventRouting:', error);
    return null;
  }
}

/**
 * Manually override chaining for two events
 * User can toggle "Chain with next task?" in UI
 */
export async function setEventChaining(
  eventId: string,
  chainWithEventId: string | null,
  isChained: boolean
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('calendar_events')
      .update({
        loop_routing: {
          is_chained: isChained,
          chain_with_event_id: chainWithEventId,
        },
      })
      .eq('id', eventId);

    if (error) {
      console.error('Error setting event chaining:', error);
      return false;
    }

    // Recalculate departure time for this event
    await recalculateDepartureTime(eventId);

    return true;
  } catch (error) {
    console.error('Error in setEventChaining:', error);
    return false;
  }
}

/**
 * Calculate departure time for a single event
 * Useful for showing user when to leave
 */
export async function calculateEventDepartureTime(
  eventId: string
): Promise<Date | null> {
  try {
    const { data, error } = await supabase.rpc('calculate_departure_time', {
      p_event_id: eventId,
    });

    if (error || !data) {
      console.error('Error calculating departure time:', error);
      return null;
    }

    return new Date(data);
  } catch (error) {
    console.error('Error in calculateEventDepartureTime:', error);
    return null;
  }
}

/**
 * Get all events in a chain (for visualizing the route)
 */
export async function getEventChain(
  eventId: string
): Promise<CalendarEvent[]> {
  try {
    const { data: event, error: eventError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      console.error('Error fetching event:', eventError);
      return [];
    }

    // If not chained, return just this event
    const routing = event.loop_routing as LoopRouting;
    if (!routing?.is_chained) {
      return [event];
    }

    // Build chain by following chain_with_event_id links
    const chain: CalendarEvent[] = [event];
    let currentEventId = routing.chain_with_event_id;

    while (currentEventId) {
      const { data: nextEvent, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('id', currentEventId)
        .single();

      if (error || !nextEvent) break;

      chain.push(nextEvent);
      const nextRouting = nextEvent.loop_routing as LoopRouting;
      currentEventId = nextRouting?.chain_with_event_id || null;
    }

    return chain;
  } catch (error) {
    console.error('Error in getEventChain:', error);
    return [];
  }
}

/**
 * Get routing summary for a day (for Loop Map visualization)
 */
export async function getDayRoutingSummary(
  userId: string,
  date: Date
): Promise<{
  totalEvents: number;
  totalChains: number;
  totalTravelMinutes: number;
  events: CalendarEvent[];
}> {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: events, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .order('start_time', { ascending: true });

    if (error || !events) {
      console.error('Error fetching day events:', error);
      return { totalEvents: 0, totalChains: 0, totalTravelMinutes: 0, events: [] };
    }

    let totalChains = 0;
    let totalTravelMinutes = 0;

    events.forEach((event: { loop_routing: unknown }) => {
      const routing = event.loop_routing as LoopRouting;
      if (routing?.is_chained) {
        totalChains++;
      }
      if (routing?.estimated_travel_minutes) {
        totalTravelMinutes += routing.estimated_travel_minutes;
      }
    });

    return {
      totalEvents: events.length,
      totalChains,
      totalTravelMinutes,
      events,
    };
  } catch (error) {
    console.error('Error in getDayRoutingSummary:', error);
    return { totalEvents: 0, totalChains: 0, totalTravelMinutes: 0, events: [] };
  }
}

/**
 * Helper: Parse PostGIS POINT string to Coordinate
 * PostGIS returns: "POINT(-122.4194 37.7749)"
 */
function parsePostGISPoint(point: any): Coordinate {
  if (typeof point === 'string') {
    const match = point.match(/POINT\(([^ ]+) ([^ ]+)\)/);
    if (match) {
      return {
        longitude: parseFloat(match[1]),
        latitude: parseFloat(match[2]),
      };
    }
  }

  // If already parsed by Supabase (some versions return object)
  if (point && typeof point === 'object' && 'coordinates' in point) {
    return {
      longitude: point.coordinates[0],
      latitude: point.coordinates[1],
    };
  }

  throw new Error('Invalid PostGIS POINT format');
}

/**
 * Helper: Recalculate departure time for an event after routing changes
 */
async function recalculateDepartureTime(eventId: string): Promise<void> {
  try {
    const departureTime = await calculateEventDepartureTime(eventId);
    if (!departureTime) return;

    const { error } = await supabase
      .from('calendar_events')
      .update({
        loop_routing: supabase.rpc('jsonb_set', {
          target: supabase.raw('loop_routing'),
          path: '{recommended_departure_time}',
          new_value: JSON.stringify(departureTime.toISOString()),
        }),
      })
      .eq('id', eventId);

    if (error) {
      console.error('Error updating departure time:', error);
    }
  } catch (error) {
    console.error('Error in recalculateDepartureTime:', error);
  }
}
