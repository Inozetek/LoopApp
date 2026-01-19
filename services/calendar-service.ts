import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { calculateTravelTimeWithBuffer } from '@/utils/route-calculations';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export interface CalendarPermissionResult {
  granted: boolean;
  canAskAgain: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  allDay: boolean;
  calendarId: string;
}

export interface SyncResult {
  success: boolean;
  eventsSynced: number;
  errors: string[];
}

/**
 * Geocode an address to lat/lng using Google Geocoding API
 * Returns null if geocoding fails
 *
 * @param address - Address string to geocode
 * @returns Promise with {lat, lng} or null if failed
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    if (!address || !GOOGLE_MAPS_API_KEY) {
      return null;
    }

    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng,
      };
    }

    console.log(`⚠️ Geocoding failed for "${address}": ${data.status}`);
    return null;
  } catch (error) {
    console.error(`❌ Geocoding error for "${address}":`, error);
    return null;
  }
}

/**
 * Request calendar permissions from the user
 *
 * @returns Promise with permission status
 */
export async function requestCalendarPermissions(): Promise<CalendarPermissionResult> {
  try {
    console.log('📅 Requesting calendar permissions...');

    const { status, canAskAgain } = await Calendar.requestCalendarPermissionsAsync();

    const granted = status === 'granted';

    if (granted) {
      console.log('✅ Calendar permissions granted');
    } else {
      console.log('❌ Calendar permissions denied');
    }

    return {
      granted,
      canAskAgain: canAskAgain ?? false,
    };
  } catch (error) {
    console.error('❌ Error requesting calendar permissions:', error);
    return {
      granted: false,
      canAskAgain: false,
    };
  }
}

/**
 * Check if calendar permissions are already granted
 *
 * @returns Promise with permission status
 */
export async function checkCalendarPermissions(): Promise<boolean> {
  try {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('❌ Error checking calendar permissions:', error);
    return false;
  }
}

/**
 * Get all available calendars on the device
 *
 * @returns Promise with array of calendars
 */
export async function getCalendars(): Promise<Calendar.Calendar[]> {
  try {
    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission) {
      console.log('⚠️ No calendar permission, requesting...');
      const result = await requestCalendarPermissions();
      if (!result.granted) {
        throw new Error('Calendar permission denied');
      }
    }

    console.log('📅 Fetching calendars...');
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

    console.log(`✅ Found ${calendars.length} calendars`);

    // Filter to primary calendars only (Google Calendar, iCloud Calendar)
    const primaryCalendars = calendars.filter((cal) => {
      const source = cal.source;
      const sourceType = source.type;

      // Include Google, iCloud, and Exchange calendars
      return (
        sourceType === Calendar.SourceType.CALDAV ||
        sourceType === Calendar.SourceType.EXCHANGE ||
        source.name?.toLowerCase().includes('google') ||
        source.name?.toLowerCase().includes('icloud')
      );
    });

    console.log(`✅ Found ${primaryCalendars.length} primary calendars`);

    return primaryCalendars;
  } catch (error) {
    console.error('❌ Error fetching calendars:', error);
    throw error;
  }
}

/**
 * Fetch events from all calendars within a date range
 *
 * @param startDate - Start date for event range
 * @param endDate - End date for event range
 * @returns Promise with array of calendar events
 */
export async function fetchCalendarEvents(
  startDate: Date,
  endDate: Date
): Promise<CalendarEvent[]> {
  try {
    const calendars = await getCalendars();

    if (calendars.length === 0) {
      console.log('⚠️ No calendars found');
      return [];
    }

    console.log(`📅 Fetching events from ${startDate.toDateString()} to ${endDate.toDateString()}`);

    const allEvents: CalendarEvent[] = [];

    for (const calendar of calendars) {
      try {
        const events = await Calendar.getEventsAsync(
          [calendar.id],
          startDate,
          endDate
        );

        console.log(`  📅 ${calendar.title}: ${events.length} events`);

        const mappedEvents: CalendarEvent[] = events.map((event) => ({
          id: event.id,
          title: event.title,
          startDate: new Date(event.startDate),
          endDate: new Date(event.endDate),
          location: event.location ?? undefined,
          notes: event.notes,
          allDay: event.allDay ?? false,
          calendarId: event.calendarId,
        }));

        allEvents.push(...mappedEvents);
      } catch (error) {
        console.error(`❌ Error fetching events from calendar ${calendar.title}:`, error);
      }
    }

    console.log(`✅ Fetched ${allEvents.length} total events`);

    return allEvents;
  } catch (error) {
    console.error('❌ Error fetching calendar events:', error);
    throw error;
  }
}

/**
 * Sync calendar events to Supabase database
 *
 * @param userId - User ID to sync events for
 * @param daysAhead - Number of days ahead to sync (default: 30)
 * @returns Promise with sync result
 */
export async function syncCalendarToDatabase(
  userId: string,
  daysAhead: number = 30
): Promise<SyncResult> {
  const errors: string[] = [];
  let eventsSynced = 0;

  try {
    console.log('🔄 Starting calendar sync...');

    // Fetch events for the next N days
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);

    const events = await fetchCalendarEvents(startDate, endDate);

    console.log(`📅 Syncing ${events.length} events to database...`);

    // Filter out events without location (can't add to map)
    const eventsWithLocation = events.filter((event) => event.location && event.location.trim().length > 0);

    console.log(`📍 ${eventsWithLocation.length} events have location data`);

    // Delete existing external calendar events for this user
    // (We'll re-import fresh data)
    const { error: deleteError } = await supabase
      .from('calendar_events')
      .delete()
      .eq('user_id', userId)
      .in('source', ['google_calendar', 'apple_calendar']);

    if (deleteError) {
      console.error('❌ Error deleting old calendar events:', deleteError);
      errors.push('Failed to delete old events');
    }

    // Import events with location to database
    for (const event of eventsWithLocation) {
      try {
        // Try to geocode the location address
        const geocoded = await geocodeAddress(event.location || '');

        // Skip events we couldn't geocode (invalid geometry would cause PostGIS error)
        if (!geocoded) {
          console.log(`⚠️ Skipping "${event.title}" - couldn't geocode location: ${event.location}`);
          errors.push(`Couldn't geocode: ${event.title}`);
          continue;
        }

        const { error: insertError } = await supabase
          .from('calendar_events')
          .insert({
            user_id: userId,
            title: event.title,
            description: event.notes || null,
            category: 'personal', // Default category for imported events
            location: {
              type: 'Point',
              coordinates: [geocoded.lng, geocoded.lat], // PostGIS uses [lng, lat] order
            },
            address: event.location || '',
            start_time: event.startDate.toISOString(),
            end_time: event.endDate.toISOString(),
            all_day: event.allDay,
            source: Platform.OS === 'ios' ? 'apple_calendar' : 'google_calendar',
            external_calendar_id: event.calendarId,
            external_event_id: event.id,
            status: 'scheduled',
          });

        if (insertError) {
          console.error(`❌ Error inserting event "${event.title}":`, insertError);
          errors.push(`Failed to sync: ${event.title}`);
        } else {
          eventsSynced++;
        }
      } catch (error) {
        console.error(`❌ Error processing event "${event.title}":`, error);
        errors.push(`Failed to process: ${event.title}`);
      }
    }

    console.log(`✅ Calendar sync complete: ${eventsSynced}/${eventsWithLocation.length} events synced`);

    if (errors.length > 0) {
      console.log(`⚠️ ${errors.length} errors during sync`);
    }

    return {
      success: errors.length === 0,
      eventsSynced,
      errors,
    };
  } catch (error) {
    console.error('❌ Calendar sync failed:', error);
    return {
      success: false,
      eventsSynced,
      errors: [...errors, error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Get upcoming free time slots based on calendar events
 *
 * @param userId - User ID
 * @param days - Number of days to look ahead (default: 7)
 * @returns Promise with array of free time slots
 */
export async function getUpcomingFreeTime(
  userId: string,
  days: number = 7
): Promise<{ start: Date; end: Date; durationMinutes: number }[]> {
  try {
    console.log(`🔍 Finding free time for next ${days} days...`);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    // Fetch events from database (user's Loop events + imported calendar events)
    const { data: events, error } = await supabase
      .from('calendar_events')
      .select('start_time, end_time')
      .eq('user_id', userId)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .eq('status', 'scheduled')
      .order('start_time', { ascending: true });

    if (error) {
      console.error('❌ Error fetching events:', error);
      throw error;
    }

    // Find gaps between events (free time)
    const freeSlots: { start: Date; end: Date; durationMinutes: number }[] = [];

    // Define working hours (9am - 9pm)
    const workingHoursStart = 9;
    const workingHoursEnd = 21;

    for (let day = 0; day < days; day++) {
      const dayStart = new Date(startDate);
      dayStart.setDate(dayStart.getDate() + day);
      dayStart.setHours(workingHoursStart, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(workingHoursEnd, 0, 0, 0);

      let currentTime = dayStart;

      // Filter events for this day
      const dayEvents = (events || []).filter((event: any) => {
        const eventStart = new Date(event.start_time);
        return (
          eventStart.getDate() === dayStart.getDate() &&
          eventStart.getMonth() === dayStart.getMonth() &&
          eventStart.getFullYear() === dayStart.getFullYear()
        );
      });

      // Find free slots between events
      for (const event of dayEvents) {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);

        // If there's a gap before this event
        if (eventStart > currentTime) {
          const gapMinutes = (eventStart.getTime() - currentTime.getTime()) / (1000 * 60);

          // Only include gaps >= 1 hour
          if (gapMinutes >= 60) {
            freeSlots.push({
              start: new Date(currentTime),
              end: new Date(eventStart),
              durationMinutes: gapMinutes,
            });
          }
        }

        // Move current time to after this event
        currentTime = eventEnd > currentTime ? eventEnd : currentTime;
      }

      // Check for free time at the end of the day
      if (currentTime < dayEnd) {
        const gapMinutes = (dayEnd.getTime() - currentTime.getTime()) / (1000 * 60);

        if (gapMinutes >= 60) {
          freeSlots.push({
            start: new Date(currentTime),
            end: new Date(dayEnd),
            durationMinutes: gapMinutes,
          });
        }
      }
    }

    console.log(`✅ Found ${freeSlots.length} free time slots`);

    return freeSlots;
  } catch (error) {
    console.error('❌ Error finding free time:', error);
    throw error;
  }
}

/**
 * Create a calendar event in the device's calendar
 *
 * @param calendarId - Calendar ID to create event in
 * @param title - Event title
 * @param startDate - Event start date
 * @param endDate - Event end date
 * @param location - Event location (optional)
 * @param notes - Event notes (optional)
 * @returns Promise with created event ID
 */
export async function createCalendarEvent(
  calendarId: string,
  title: string,
  startDate: Date,
  endDate: Date,
  location?: string,
  notes?: string
): Promise<string> {
  try {
    console.log(`📅 Creating calendar event: ${title}`);

    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission) {
      const result = await requestCalendarPermissions();
      if (!result.granted) {
        throw new Error('Calendar permission denied');
      }
    }

    const eventId = await Calendar.createEventAsync(calendarId, {
      title,
      startDate,
      endDate,
      location,
      notes,
      timeZone: 'America/Chicago', // User's timezone - would get from user profile
      endTimeZone: 'America/Chicago',
    });

    console.log(`✅ Event created: ${eventId}`);

    return eventId;
  } catch (error) {
    console.error('❌ Error creating calendar event:', error);
    throw error;
  }
}

// ===================================
// Phase 1.6b: Travel Time Smart Scheduling
// ===================================

export interface TaskWithLocation {
  id: string;
  title: string;
  end_time: Date;
  location: {
    coordinates: [number, number]; // [lng, lat] - PostGIS format
  };
}

/**
 * Get the last scheduled task for a given day
 * Used to calculate travel time for next task suggestion
 *
 * @param userId - User ID to fetch tasks for
 * @param date - Date to check (defaults to today)
 * @returns Promise with last task or null if no tasks
 */
export async function getLastTaskForDay(
  userId: string,
  date: Date = new Date()
): Promise<TaskWithLocation | null> {
  try {
    // Set time range for the day (midnight to midnight)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const now = new Date();

    // Query calendar events for today that:
    // 1. Are scheduled (not completed/cancelled)
    // 2. End time is before "now" or in the future
    // 3. Have a location (required for travel time calculation)
    const { data, error } = await supabase
      .from('calendar_events')
      .select('id, title, end_time, location')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .gte('start_time', startOfDay.toISOString())
      .lte('end_time', endOfDay.toISOString())
      .not('location', 'is', null)
      .order('end_time', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Error fetching last task:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.log('📭 No tasks found for today');
      return null;
    }

    const task = data[0] as any;

    return {
      id: task.id,
      title: task.title,
      end_time: new Date(task.end_time),
      location: task.location,
    };
  } catch (error) {
    console.error('❌ Error in getLastTaskForDay:', error);
    return null;
  }
}

/**
 * Check if a new task would conflict with existing tasks
 *
 * @param userId - User ID
 * @param startTime - Proposed start time for new task
 * @param endTime - Proposed end time for new task
 * @returns Promise with conflicting task if found, null otherwise
 */
export async function checkTimeConflict(
  userId: string,
  startTime: Date,
  endTime: Date
): Promise<{ id: string; title: string; start_time: Date; end_time: Date } | null> {
  try {
    console.log(`🔍 Checking for conflicts: ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`);

    const { data, error } = await supabase
      .from('calendar_events')
      .select('id, title, start_time, end_time')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .gte('end_time', startTime.toISOString())
      .lte('start_time', endTime.toISOString())
      .limit(1);

    if (error) {
      console.error('❌ Error checking conflicts:', error);
      return null;
    }

    if (data && data.length > 0) {
      const conflict = data[0];
      console.log(`⚠️ Conflict found: "${conflict.title}" at ${new Date(conflict.start_time).toLocaleTimeString()}`);
      return {
        id: conflict.id,
        title: conflict.title,
        start_time: new Date(conflict.start_time),
        end_time: new Date(conflict.end_time),
      };
    }

    console.log('✅ No conflicts found');
    return null;
  } catch (error) {
    console.error('❌ Error in checkTimeConflict:', error);
    return null;
  }
}

/**
 * Check if user can make it from previous task to new task on time
 *
 * @param userId - User ID
 * @param newTaskStartTime - When new task starts
 * @param newTaskLocation - Location of new task
 * @returns Promise with feasibility check result
 */
export async function canMakeItOnTime(
  userId: string,
  newTaskStartTime: Date,
  newTaskLocation: { latitude: number; longitude: number }
): Promise<{
  feasible: boolean;
  previousTask?: { title: string; end_time: Date };
  travelMinutes?: number;
  arrivalTime?: Date;
  minutesLate?: number;
}> {
  try {
    // Get task that ends closest to (but before) the new task start time
    const { data, error } = await supabase
      .from('calendar_events')
      .select('id, title, end_time, location')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .lte('end_time', newTaskStartTime.toISOString())
      .order('end_time', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      // No previous task, so user can make it
      return { feasible: true };
    }

    const previousTask = data[0];

    // Skip travel check if previous task has no location
    if (!previousTask.location || !previousTask.location.coordinates) {
      console.log('⚠️ Previous task has no location, skipping travel check');
      return { feasible: true };
    }

    const previousLocation = {
      latitude: previousTask.location.coordinates[1],
      longitude: previousTask.location.coordinates[0],
    };

    // Calculate travel time
    const travelMinutes = calculateTravelTimeWithBuffer(previousLocation, newTaskLocation);
    const arrivalTime = new Date(new Date(previousTask.end_time).getTime() + travelMinutes * 60000);

    // Check if arrival time is before new task start time
    const feasible = arrivalTime <= newTaskStartTime;
    const minutesLate = feasible ? 0 : Math.ceil((arrivalTime.getTime() - newTaskStartTime.getTime()) / 60000);

    console.log(`🚗 Travel check: ${previousTask.title} ends at ${new Date(previousTask.end_time).toLocaleTimeString()}, ${travelMinutes} min travel → arrive at ${arrivalTime.toLocaleTimeString()}`);
    console.log(feasible ? '✅ Can make it on time' : `❌ Will be ${minutesLate} min late`);

    return {
      feasible,
      previousTask: {
        title: previousTask.title,
        end_time: new Date(previousTask.end_time),
      },
      travelMinutes,
      arrivalTime,
      minutesLate: feasible ? undefined : minutesLate,
    };
  } catch (error) {
    console.error('❌ Error in canMakeItOnTime:', error);
    return { feasible: true }; // Default to feasible on error
  }
}

/**
 * Schedule an Ticketmaster event to the calendar
 *
 * Key differences from regular tasks:
 * - Arrival time pre-filled at event start - 10 minutes
 * - Blocks full event duration (arrival → event end)
 * - Stores event metadata for future reference
 *
 * @param params - Event scheduling parameters
 * @returns Promise with created calendar event ID
 */
export async function scheduleEvent(params: {
  userId: string;
  eventName: string;
  arrivalTime: Date;
  eventStartTime: Date;
  eventEndTime: Date;
  location: { latitude: number; longitude: number; address: string };
  eventMetadata: {
    event_url?: string;
    organizer?: string;
    is_free?: boolean;
    ticket_price?: {
      min: number;
      max: number;
      currency: string;
    };
  };
  activityId?: string; // Reference to activities table
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const { userId, eventName, arrivalTime, eventEndTime, location, eventMetadata, activityId } = params;

    console.log(`📅 Scheduling event: ${eventName}`);
    console.log(`🕐 Arrival: ${arrivalTime.toLocaleString()}`);
    console.log(`🎭 Event ends: ${eventEndTime.toLocaleString()}`);

    // Create calendar event with full duration block
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        user_id: userId,
        title: eventName,
        start_time: arrivalTime.toISOString(), // User's arrival time (event start - 10 min by default)
        end_time: eventEndTime.toISOString(),   // Event end time (blocks full duration)
        location: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude],
        },
        address: location.address,
        category: 'event', // Mark as event category
        source: 'recommendation',
        activity_id: activityId,
        status: 'scheduled',
        // Store event metadata in description for now
        // TODO: Add event_metadata column to calendar_events table in future migration
        description: JSON.stringify({
          is_event: true,
          event_url: eventMetadata.event_url,
          organizer: eventMetadata.organizer,
          is_free: eventMetadata.is_free,
          ticket_price: eventMetadata.ticket_price,
        }),
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Error scheduling event:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Event scheduled successfully: ${data.id}`);

    return { success: true, eventId: data.id };
  } catch (error) {
    console.error('❌ Exception in scheduleEvent:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
