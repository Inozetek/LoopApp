/**
 * Tests for radar-push-service.ts
 *
 * Covers:
 * - registerPushToken: permission check, token retrieval, supabase storage, error paths
 * - sendRadarPushNotification: tier gating, push token lookup, Expo Push API call,
 *   response handling (ok, error status, delivery error), push_sent_at marking
 * - handleRadarNotificationTap: non-radar data returns null, radar_alert extraction
 * - setupRadarNotificationChannel: Android-only channel creation, error handling
 *
 * Mock strategy:
 * - Supabase: chained mock builder for from().select().update().eq().single()
 * - expo-notifications: mocked for permissions, token, and channel APIs
 * - global.fetch: mocked for Expo Push API calls
 * - Platform.OS: overridden per test for Android channel logic
 */

import type { HookNotification } from '@/types/radar';
import type { SubscriptionTier } from '@/types/subscription';

// ============================================================================
// SUPABASE MOCK
// ============================================================================

let mockFromImpl: (table: string) => any;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn((...args: any[]) => mockFromImpl(args[0])),
  },
}));

function defaultChain(resolveValue: any = { data: null, error: null }) {
  const chain: any = {};
  chain.select = jest.fn(() => chain);
  chain.update = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.single = jest.fn().mockResolvedValue(resolveValue);
  return chain;
}

// ============================================================================
// EXPO NOTIFICATIONS MOCK
// ============================================================================

const mockGetPermissionsAsync = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn();
const mockSetNotificationChannelAsync = jest.fn();

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: any[]) => mockGetPermissionsAsync(...args),
  getExpoPushTokenAsync: (...args: any[]) => mockGetExpoPushTokenAsync(...args),
  setNotificationChannelAsync: (...args: any[]) => mockSetNotificationChannelAsync(...args),
  AndroidImportance: {
    HIGH: 4,
  },
}));

// ============================================================================
// PLATFORM MOCK
// ============================================================================

let mockPlatformOS = 'ios';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

// ============================================================================
// FETCH MOCK
// ============================================================================

const originalFetch = global.fetch;
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

afterAll(() => {
  (global as any).fetch = originalFetch;
});

// ============================================================================
// IMPORT MODULE AFTER MOCKS
// ============================================================================

import {
  registerPushToken,
  sendRadarPushNotification,
  handleRadarNotificationTap,
  setupRadarNotificationChannel,
} from '@/services/radar-push-service';

// ============================================================================
// HELPERS
// ============================================================================

function makeNotification(overrides: Partial<HookNotification> = {}): HookNotification {
  return {
    id: 'notif-1',
    userId: 'user-123',
    hookId: 'hook-456',
    title: 'Taylor Swift in Dallas',
    body: 'A new concert was just announced near you!',
    status: 'pending',
    createdAt: '2026-02-17T12:00:00Z',
    eventData: {
      name: 'Taylor Swift Eras Tour',
      venue: 'AT&T Stadium',
      date: '2026-06-15',
    },
    ...overrides,
  };
}

// ============================================================================
// RESET
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  mockFromImpl = () => defaultChain();
  mockPlatformOS = 'ios';
});

// ============================================================================
// registerPushToken
// ============================================================================

describe('registerPushToken', () => {
  it('returns null when notification permission is not granted', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const result = await registerPushToken('user-123');

    expect(result).toBeNull();
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('returns null when permission status is undetermined', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });

    const result = await registerPushToken('user-123');

    expect(result).toBeNull();
  });

  it('retrieves token and stores it in supabase when permission is granted', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({
      data: 'ExponentPushToken[abc123def456]',
    });

    const usersChain = defaultChain({ data: null, error: null });
    mockFromImpl = (table: string) => {
      if (table === 'users') return usersChain;
      return defaultChain();
    };

    const result = await registerPushToken('user-123');

    expect(result).toBe('ExponentPushToken[abc123def456]');
    expect(mockGetExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: '0268111f-c9d2-46ec-99c8-777b1393294b',
    });
    expect(usersChain.update).toHaveBeenCalledWith({
      expo_push_token: 'ExponentPushToken[abc123def456]',
    });
    expect(usersChain.eq).toHaveBeenCalledWith('id', 'user-123');
  });

  it('returns null when supabase update fails', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({
      data: 'ExponentPushToken[abc123]',
    });

    const usersChain = defaultChain({ data: null, error: { message: 'DB error' } });
    // For this case, .eq() must resolve to the error value since the chain ends at .eq()
    usersChain.eq = jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
    mockFromImpl = (table: string) => {
      if (table === 'users') return usersChain;
      return defaultChain();
    };

    const result = await registerPushToken('user-123');

    expect(result).toBeNull();
  });

  it('returns null when getExpoPushTokenAsync throws', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockRejectedValue(new Error('Token fetch failed'));

    const result = await registerPushToken('user-123');

    expect(result).toBeNull();
  });

  it('returns null when getPermissionsAsync throws', async () => {
    mockGetPermissionsAsync.mockRejectedValue(new Error('Permission check failed'));

    const result = await registerPushToken('user-123');

    expect(result).toBeNull();
  });
});

// ============================================================================
// sendRadarPushNotification
// ============================================================================

describe('sendRadarPushNotification', () => {
  const notification = makeNotification();

  it('returns false for free tier (push gated)', async () => {
    const result = await sendRadarPushNotification(notification, 'free');

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns false when user has no push token in DB', async () => {
    const usersChain = defaultChain({ data: null, error: null });
    usersChain.single = jest.fn().mockResolvedValue({ data: null, error: null });
    mockFromImpl = (table: string) => {
      if (table === 'users') return usersChain;
      return defaultChain();
    };

    const result = await sendRadarPushNotification(notification, 'plus');

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns false when user DB lookup errors', async () => {
    const usersChain = defaultChain();
    usersChain.single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });
    mockFromImpl = (table: string) => {
      if (table === 'users') return usersChain;
      return defaultChain();
    };

    const result = await sendRadarPushNotification(notification, 'plus');

    expect(result).toBe(false);
  });

  it('returns false when push token field is empty string', async () => {
    const usersChain = defaultChain();
    usersChain.single = jest.fn().mockResolvedValue({
      data: { expo_push_token: '' },
      error: null,
    });
    mockFromImpl = (table: string) => {
      if (table === 'users') return usersChain;
      return defaultChain();
    };

    const result = await sendRadarPushNotification(notification, 'plus');

    expect(result).toBe(false);
  });

  it('sends push via Expo Push API for plus tier with valid token', async () => {
    const usersChain = defaultChain();
    usersChain.single = jest.fn().mockResolvedValue({
      data: { expo_push_token: 'ExponentPushToken[xyz789]' },
      error: null,
    });
    const notifChain = defaultChain();
    mockFromImpl = (table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'hook_notifications') return notifChain;
      return defaultChain();
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ status: 'ok' }] }),
    });

    const result = await sendRadarPushNotification(notification, 'plus');

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );

    // Verify the push message body
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.to).toBe('ExponentPushToken[xyz789]');
    expect(callBody.title).toContain(notification.title);
    expect(callBody.body).toBe(notification.body);
    expect(callBody.data.type).toBe('radar_alert');
    expect(callBody.data.notificationId).toBe(notification.id);
    expect(callBody.data.hookId).toBe(notification.hookId);
    expect(callBody.channelId).toBe('radar-alerts');
  });

  it('marks push_sent_at on hook_notifications after successful send', async () => {
    const usersChain = defaultChain();
    usersChain.single = jest.fn().mockResolvedValue({
      data: { expo_push_token: 'ExponentPushToken[xyz789]' },
      error: null,
    });
    const notifChain = defaultChain();
    mockFromImpl = (table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'hook_notifications') return notifChain;
      return defaultChain();
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ status: 'ok' }] }),
    });

    await sendRadarPushNotification(notification, 'plus');

    expect(notifChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ push_sent_at: expect.any(String) })
    );
    expect(notifChain.eq).toHaveBeenCalledWith('id', notification.id);
  });

  it('returns false when Expo Push API returns non-ok status', async () => {
    const usersChain = defaultChain();
    usersChain.single = jest.fn().mockResolvedValue({
      data: { expo_push_token: 'ExponentPushToken[xyz789]' },
      error: null,
    });
    mockFromImpl = (table: string) => {
      if (table === 'users') return usersChain;
      return defaultChain();
    };

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await sendRadarPushNotification(notification, 'plus');

    expect(result).toBe(false);
  });

  it('returns false when Expo Push API returns delivery error in response', async () => {
    const usersChain = defaultChain();
    usersChain.single = jest.fn().mockResolvedValue({
      data: { expo_push_token: 'ExponentPushToken[xyz789]' },
      error: null,
    });
    mockFromImpl = (table: string) => {
      if (table === 'users') return usersChain;
      return defaultChain();
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [{ status: 'error', message: 'DeviceNotRegistered' }],
        }),
    });

    const result = await sendRadarPushNotification(notification, 'plus');

    expect(result).toBe(false);
  });

  it('returns false when fetch throws a network error', async () => {
    const usersChain = defaultChain();
    usersChain.single = jest.fn().mockResolvedValue({
      data: { expo_push_token: 'ExponentPushToken[xyz789]' },
      error: null,
    });
    mockFromImpl = (table: string) => {
      if (table === 'users') return usersChain;
      return defaultChain();
    };

    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await sendRadarPushNotification(notification, 'plus');

    expect(result).toBe(false);
  });

  it('includes eventData in the push message data payload', async () => {
    const notifWithEvent = makeNotification({
      eventData: {
        name: 'Jazz Night',
        venue: 'Blue Note',
        date: '2026-03-01',
        priceMin: 25,
      },
    });

    const usersChain = defaultChain();
    usersChain.single = jest.fn().mockResolvedValue({
      data: { expo_push_token: 'ExponentPushToken[test]' },
      error: null,
    });
    mockFromImpl = (table: string) => {
      if (table === 'users') return usersChain;
      return defaultChain();
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ status: 'ok' }] }),
    });

    await sendRadarPushNotification(notifWithEvent, 'plus');

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.data.eventData).toEqual(notifWithEvent.eventData);
  });

  it('does not mark push_sent_at when push API fails', async () => {
    const usersChain = defaultChain();
    usersChain.single = jest.fn().mockResolvedValue({
      data: { expo_push_token: 'ExponentPushToken[xyz789]' },
      error: null,
    });
    const notifChain = defaultChain();
    mockFromImpl = (table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'hook_notifications') return notifChain;
      return defaultChain();
    };

    mockFetch.mockResolvedValue({ ok: false, status: 503 });

    await sendRadarPushNotification(notification, 'plus');

    expect(notifChain.update).not.toHaveBeenCalled();
  });

  it('does not mark push_sent_at when delivery error occurs', async () => {
    const usersChain = defaultChain();
    usersChain.single = jest.fn().mockResolvedValue({
      data: { expo_push_token: 'ExponentPushToken[xyz789]' },
      error: null,
    });
    const notifChain = defaultChain();
    mockFromImpl = (table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'hook_notifications') return notifChain;
      return defaultChain();
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [{ status: 'error', message: 'InvalidToken' }],
        }),
    });

    await sendRadarPushNotification(notification, 'plus');

    expect(notifChain.update).not.toHaveBeenCalled();
  });

  it('sends push with sound set to default', async () => {
    const usersChain = defaultChain();
    usersChain.single = jest.fn().mockResolvedValue({
      data: { expo_push_token: 'ExponentPushToken[snd]' },
      error: null,
    });
    mockFromImpl = (table: string) => {
      if (table === 'users') return usersChain;
      return defaultChain();
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ status: 'ok' }] }),
    });

    await sendRadarPushNotification(notification, 'plus');

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.sound).toBe('default');
  });
});

// ============================================================================
// handleRadarNotificationTap
// ============================================================================

describe('handleRadarNotificationTap', () => {
  it('returns null for empty data', () => {
    const result = handleRadarNotificationTap({});

    expect(result).toBeNull();
  });

  it('returns null when type is not radar_alert', () => {
    const result = handleRadarNotificationTap({
      type: 'friend_request',
      notificationId: 'n-1',
    });

    expect(result).toBeNull();
  });

  it('returns null for undefined type field', () => {
    const result = handleRadarNotificationTap({ hookId: 'h-1' });

    expect(result).toBeNull();
  });

  it('extracts notificationId and hookId for radar_alert type', () => {
    const result = handleRadarNotificationTap({
      type: 'radar_alert',
      notificationId: 'notif-abc',
      hookId: 'hook-def',
    });

    expect(result).toEqual({
      type: 'radar_alert',
      notificationId: 'notif-abc',
      hookId: 'hook-def',
    });
  });

  it('handles radar_alert with missing optional fields', () => {
    const result = handleRadarNotificationTap({
      type: 'radar_alert',
    });

    expect(result).toEqual({
      type: 'radar_alert',
      notificationId: undefined,
      hookId: undefined,
    });
  });

  it('ignores extra fields in the data payload', () => {
    const result = handleRadarNotificationTap({
      type: 'radar_alert',
      notificationId: 'n-1',
      hookId: 'h-1',
      extraField: 'should be ignored',
      anotherField: 42,
    });

    expect(result).toEqual({
      type: 'radar_alert',
      notificationId: 'n-1',
      hookId: 'h-1',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

// ============================================================================
// setupRadarNotificationChannel
// ============================================================================

describe('setupRadarNotificationChannel', () => {
  it('does nothing on iOS', async () => {
    mockPlatformOS = 'ios';

    await setupRadarNotificationChannel();

    expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('does nothing on web', async () => {
    mockPlatformOS = 'web';

    await setupRadarNotificationChannel();

    expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('creates radar-alerts channel on Android', async () => {
    mockPlatformOS = 'android';
    mockSetNotificationChannelAsync.mockResolvedValue(undefined);

    await setupRadarNotificationChannel();

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      'radar-alerts',
      expect.objectContaining({
        name: 'Radar Alerts',
        importance: 4, // AndroidImportance.HIGH
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C3AED',
        description: 'Alerts from your Loop Radar triggers',
      })
    );
  });

  it('does not throw when setNotificationChannelAsync fails on Android', async () => {
    mockPlatformOS = 'android';
    mockSetNotificationChannelAsync.mockRejectedValue(new Error('Channel creation failed'));

    // Should not throw
    await expect(setupRadarNotificationChannel()).resolves.toBeUndefined();
  });
});
