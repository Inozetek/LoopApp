/**
 * Radar Push Service — Push Notifications for Radar Alerts
 *
 * Plus-only feature: sends push notifications when radar hooks trigger.
 * Free users see alerts in-feed only; Plus users get instant pushes.
 *
 * Architecture:
 * - Register push token on login → store in users.expo_push_token
 * - When radar polling creates a notification, call sendRadarPushNotification()
 * - Tier gate: skip push for free users
 * - Deep link: tapping notification opens feed with radar highlight
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { RADAR_LIMITS } from '@/types/radar';
import type { HookNotification } from '@/types/radar';
import type { SubscriptionTier } from '@/types/subscription';

// ============================================================================
// CONSTANTS
// ============================================================================

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

// ============================================================================
// PUSH TOKEN REGISTRATION
// ============================================================================

/**
 * Register the device's Expo push token and store it in the user's profile.
 * Call this after successful login/auth.
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  try {
    // Check permissions first
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('[RadarPush] Notification permission not granted, skipping token registration');
      return null;
    }

    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '0268111f-c9d2-46ec-99c8-777b1393294b',
    });
    const token = tokenData.data;

    // Store in user profile
    const { error } = await supabase
      .from('users')
      .update({ expo_push_token: token })
      .eq('id', userId);

    if (error) {
      console.error('[RadarPush] Error saving push token:', error);
      return null;
    }

    console.log('[RadarPush] Push token registered:', token.substring(0, 20) + '...');
    return token;
  } catch (err) {
    console.error('[RadarPush] Error registering push token:', err);
    return null;
  }
}

// ============================================================================
// SEND PUSH NOTIFICATION
// ============================================================================

/**
 * Send a push notification for a radar alert.
 * Only sends for Plus users (tier gate).
 *
 * Returns true if push was sent, false if skipped or failed.
 */
export async function sendRadarPushNotification(
  notification: HookNotification,
  tier: SubscriptionTier
): Promise<boolean> {
  // Tier gate: free users don't get push notifications
  const limits = RADAR_LIMITS[tier];
  if (!limits.pushNotifications) {
    console.log('[RadarPush] Push skipped — free tier');
    return false;
  }

  try {
    // Get user's push token
    const { data: userData, error } = await supabase
      .from('users')
      .select('expo_push_token')
      .eq('id', notification.userId)
      .single();

    if (error || !userData?.expo_push_token) {
      console.log('[RadarPush] No push token for user:', notification.userId);
      return false;
    }

    const pushToken = userData.expo_push_token;

    // Build push message
    const message = {
      to: pushToken,
      sound: 'default' as const,
      title: `📡 ${notification.title}`,
      body: notification.body,
      data: {
        type: 'radar_alert',
        notificationId: notification.id,
        hookId: notification.hookId,
        eventData: notification.eventData,
      },
      channelId: 'radar-alerts',
    };

    // Send via Expo Push API
    const response = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error('[RadarPush] Push API error:', response.status);
      return false;
    }

    const result = await response.json();
    if (result.data?.[0]?.status === 'error') {
      console.error('[RadarPush] Push delivery error:', result.data[0].message);
      return false;
    }

    // Mark notification as push-sent
    await supabase
      .from('hook_notifications')
      .update({ push_sent_at: new Date().toISOString() })
      .eq('id', notification.id);

    console.log('[RadarPush] Push sent for:', notification.title);
    return true;
  } catch (err) {
    console.error('[RadarPush] Error sending push:', err);
    return false;
  }
}

// ============================================================================
// NOTIFICATION TAP HANDLER
// ============================================================================

/**
 * Handle a tap on a radar push notification.
 * Returns deep-link data for navigation.
 */
export function handleRadarNotificationTap(
  data: Record<string, unknown>
): { type: string; notificationId?: string; hookId?: string } | null {
  if (data?.type !== 'radar_alert') return null;

  return {
    type: 'radar_alert',
    notificationId: data.notificationId as string,
    hookId: data.hookId as string,
  };
}

// ============================================================================
// ANDROID CHANNEL SETUP
// ============================================================================

/**
 * Create the radar-alerts Android notification channel.
 * Call this during app initialization alongside other channels.
 */
export async function setupRadarNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync('radar-alerts', {
      name: 'Radar Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
      description: 'Alerts from your Loop Radar triggers',
    });
  } catch (err) {
    console.error('[RadarPush] Error creating notification channel:', err);
  }
}
