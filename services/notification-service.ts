/**
 * Notification Service
 *
 * Handles departure time notifications:
 * - Schedule "leave now" alerts based on loop_routing data
 * - Support single and chained routes
 * - 30-min warning + departure time notifications
 * - Deep linking to navigation
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { getEventChain } from './loop-routing';
import type { CalendarEvent, LoopRouting } from '@/types/calendar-event';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Notification permission not granted');
      return false;
    }

    // For Android, create notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('departure-alerts', {
        name: 'Departure Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Schedule departure notifications for an event
 */
export async function scheduleDepartureNotifications(
  event: CalendarEvent
): Promise<{
  success: boolean;
  warningId?: string;
  departureId?: string;
}> {
  try {
    const routing = event.loop_routing as LoopRouting;
    if (!routing?.recommended_departure_time) {
      console.warn('No departure time calculated for event:', event.id);
      return { success: false };
    }

    const departureTime = new Date(routing.recommended_departure_time);
    const now = new Date();

    // Don't schedule if departure time has already passed
    if (departureTime <= now) {
      console.warn('Departure time has already passed:', event.id);
      return { success: false };
    }

    // Get event chain for notification message
    const chain = await getEventChain(event.id);
    const isChained = chain.length > 1;

    // Cancel any existing notifications for this event
    await cancelEventNotifications(event.id);

    // Schedule 30-minute warning notification
    const warningTime = new Date(departureTime.getTime() - 30 * 60 * 1000);
    let warningId: string | undefined;

    if (warningTime > now) {
      warningId = await Notifications.scheduleNotificationAsync({
        content: {
          title: isChained
            ? `🚗 Multi-stop trip in 30 minutes`
            : `🚗 Leaving for ${event.title} in 30 min`,
          body: isChained
            ? `Get ready for ${chain.length} stops: ${chain
                .map((e) => e.title)
                .join(' → ')}`
            : `Departure in 30 minutes to arrive on time`,
          data: {
            eventId: event.id,
            type: 'departure_warning',
            isChained,
            chainLength: chain.length,
          },
          sound: 'default',
        },
        trigger: {
          date: warningTime,
        },
      });
    }

    // Schedule "leave now" notification
    const departureId = await Notifications.scheduleNotificationAsync({
      content: {
        title: isChained
          ? `🕐 Leave now for ${chain.length} stops!`
          : `🕐 Leave now for ${event.title}!`,
        body: isChained
          ? `Route: ${chain.map((e) => e.title).join(' → ')}\nTap to navigate`
          : `Tap to start navigation`,
        data: {
          eventId: event.id,
          type: 'departure_now',
          isChained,
          chainLength: chain.length,
          eventTitle: event.title,
          eventLocation: event.address,
        },
        sound: 'default',
      },
      trigger: {
        date: departureTime,
      },
    });

    // Save notification IDs to database
    await supabase
      .from('calendar_events')
      .update({
        notifications_scheduled: true,
        warning_notification_id: warningId,
        departure_notification_id: departureId,
      })
      .eq('id', event.id);

    return {
      success: true,
      warningId,
      departureId,
    };
  } catch (error) {
    console.error('Error scheduling departure notifications:', error);
    return { success: false };
  }
}

/**
 * Cancel all notifications for an event
 */
export async function cancelEventNotifications(eventId: string): Promise<boolean> {
  try {
    // Get notification IDs from database
    const { data: event, error } = await supabase
      .from('calendar_events')
      .select('warning_notification_id, departure_notification_id')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      console.error('Error fetching event notifications:', error);
      return false;
    }

    const notificationIds = [
      event.warning_notification_id,
      event.departure_notification_id,
    ].filter(Boolean) as string[];

    if (notificationIds.length > 0) {
      await Notifications.cancelScheduledNotificationAsync(notificationIds[0]);
      if (notificationIds.length > 1) {
        await Notifications.cancelScheduledNotificationAsync(notificationIds[1]);
      }
    }

    // Clear notification IDs from database
    await supabase
      .from('calendar_events')
      .update({
        notifications_scheduled: false,
        warning_notification_id: null,
        departure_notification_id: null,
      })
      .eq('id', eventId);

    return true;
  } catch (error) {
    console.error('Error canceling event notifications:', error);
    return false;
  }
}

/**
 * Reschedule notifications for an event (when time or routing changes)
 */
export async function rescheduleEventNotifications(
  eventId: string
): Promise<boolean> {
  try {
    const { data: event, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      console.error('Error fetching event:', error);
      return false;
    }

    // Cancel existing notifications
    await cancelEventNotifications(eventId);

    // Schedule new notifications
    const result = await scheduleDepartureNotifications(event);

    return result.success;
  } catch (error) {
    console.error('Error rescheduling notifications:', error);
    return false;
  }
}

/**
 * Schedule notifications for all user's future events
 */
export async function scheduleAllUserNotifications(userId: string): Promise<{
  success: boolean;
  scheduled: number;
  failed: number;
}> {
  try {
    // Get all future events with locations
    const { data: events, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', new Date().toISOString())
      .not('location', 'is', null)
      .order('start_time', { ascending: true });

    if (error || !events) {
      console.error('Error fetching user events:', error);
      return { success: false, scheduled: 0, failed: 0 };
    }

    let scheduled = 0;
    let failed = 0;

    for (const event of events) {
      const result = await scheduleDepartureNotifications(event);
      if (result.success) {
        scheduled++;
      } else {
        failed++;
      }
    }

    return { success: true, scheduled, failed };
  } catch (error) {
    console.error('Error scheduling all notifications:', error);
    return { success: false, scheduled: 0, failed: 0 };
  }
}

/**
 * Cancel all notifications for a user
 */
export async function cancelAllUserNotifications(userId: string): Promise<boolean> {
  try {
    const { data: events, error } = await supabase
      .from('calendar_events')
      .select('id')
      .eq('user_id', userId)
      .eq('notifications_scheduled', true);

    if (error || !events) {
      console.error('Error fetching user events:', error);
      return false;
    }

    for (const event of events) {
      await cancelEventNotifications(event.id);
    }

    return true;
  } catch (error) {
    console.error('Error canceling all notifications:', error);
    return false;
  }
}

/**
 * Handle notification tap (deep linking to navigation)
 */
export async function handleNotificationResponse(
  response: Notifications.NotificationResponse
): Promise<void> {
  try {
    const data = response.notification.request.content.data;
    const eventId = data.eventId as string;
    const type = data.type as string;

    if (type === 'departure_now') {
      // Open navigation for the event
      await openEventNavigation(eventId);
    } else if (type === 'departure_warning') {
      // Open event details modal
      await openEventDetails(eventId);
    }
  } catch (error) {
    console.error('Error handling notification response:', error);
  }
}

/**
 * Open navigation for an event (Google Maps or Apple Maps)
 */
async function openEventNavigation(eventId: string): Promise<void> {
  try {
    const { data: event, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      console.error('Error fetching event:', error);
      return;
    }

    // Get event chain for multi-stop navigation
    const chain = await getEventChain(eventId);
    const isChained = chain.length > 1;

    if (isChained) {
      // Multi-stop route: Open Google Maps with waypoints
      // Format: https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=...
      const waypoints = chain
        .slice(0, -1)
        .map((e) => `${e.location.coordinates[1]},${e.location.coordinates[0]}`)
        .join('|');

      const destination = chain[chain.length - 1];
      const destCoords = `${destination.location.coordinates[1]},${destination.location.coordinates[0]}`;

      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destCoords}&waypoints=${waypoints}&travelmode=driving`;

      // Open in browser or Google Maps app
      await Notifications.dismissNotificationAsync(
        response.notification.request.identifier
      );
      // Note: In actual app, use Linking.openURL(mapsUrl)
    } else {
      // Single destination: Open navigation directly
      const coords = `${event.location.coordinates[1]},${event.location.coordinates[0]}`;
      const label = encodeURIComponent(event.title);

      const mapsUrl = Platform.select({
        ios: `maps://app?daddr=${coords}&q=${label}`,
        android: `google.navigation:q=${coords}`,
      });

      if (mapsUrl) {
        // Note: In actual app, use Linking.openURL(mapsUrl)
      }
    }
  } catch (error) {
    console.error('Error opening navigation:', error);
  }
}

/**
 * Open event details modal
 */
async function openEventDetails(eventId: string): Promise<void> {
  // This would navigate to event details screen in the app
  // Implementation depends on navigation setup (Expo Router)
  console.log('Opening event details for:', eventId);
}

/**
 * Get all scheduled notifications for debugging
 */
export async function getAllScheduledNotifications(): Promise<
  Notifications.NotificationRequest[]
> {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
}

/**
 * Send test notification
 */
export async function sendTestNotification(): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚗 Test Departure Alert',
        body: 'This is a test notification from Loop',
        data: { type: 'test' },
      },
      trigger: {
        seconds: 2,
      },
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
  }
}
