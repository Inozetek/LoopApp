import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

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
          location: event.location,
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
        // For MVP, we'll store location as a simple point (0,0) and just save the address
        // In production, you'd geocode the event location to get lat/lng
        const { error: insertError } = await supabase
          .from('calendar_events')
          .insert({
            user_id: userId,
            title: event.title,
            description: event.notes || null,
            category: 'personal', // Default category for imported events
            location: {
              type: 'Point',
              coordinates: [0, 0], // Placeholder - would geocode in production
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
      const dayEvents = (events || []).filter((event) => {
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
