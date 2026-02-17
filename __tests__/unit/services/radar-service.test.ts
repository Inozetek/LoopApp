/**
 * Tests for radar-service.ts
 *
 * Covers:
 * - checkRadarLimit: tier limit enforcement for free/plus, demo mode bypass
 * - buildMatchReason: human-readable match strings for each hook type
 * - notificationToRadarMatch: notification-to-RadarMatch conversion
 * - createRadar: success, demo mode, limit enforcement
 * - deleteRadar / hardDeleteRadar: soft and hard delete paths
 * - listRadars: active radars, empty state, demo mode
 * - getRadarSummary: aggregation with type counts and limits
 * - getPendingRadarAlerts: pending notifications, demo mode
 * - getRecentNotifications: history with limit
 * - markNotificationViewed / markNotificationDismissed: status updates
 *
 * Pattern: Supabase mocked at module level. Pure functions tested directly.
 */

import type { HookNotification, UserHook, HookType, CreateRadarParams } from '@/types/radar';
import { RADAR_LIMITS } from '@/types/radar';

// ============================================================================
// SUPABASE MOCK
// ============================================================================

const mockSingle = jest.fn();
const mockLimit = jest.fn();
const mockOrder = jest.fn();
const mockIn = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockFrom = jest.fn();

// Build chainable mock — each method returns the chain object
function buildChain() {
  const chain: any = {};
  chain.select = mockSelect.mockReturnValue(chain);
  chain.insert = mockInsert.mockReturnValue(chain);
  chain.update = mockUpdate.mockReturnValue(chain);
  chain.delete = mockDelete.mockReturnValue(chain);
  chain.eq = mockEq.mockReturnValue(chain);
  chain.in = mockIn.mockReturnValue(chain);
  chain.order = mockOrder.mockReturnValue(chain);
  chain.limit = mockLimit.mockReturnValue(chain);
  chain.single = mockSingle.mockReturnValue(chain);
  // Default: resolve to empty data
  chain.data = null;
  chain.error = null;
  return chain;
}

let chain = buildChain();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => {
      mockFrom(...args);
      return chain;
    },
  },
}));

// ============================================================================
// IMPORTS (after mock setup)
// ============================================================================

import {
  checkRadarLimit,
  createRadar,
  deleteRadar,
  hardDeleteRadar,
  listRadars,
  getRadarSummary,
  getPendingRadarAlerts,
  getRecentNotifications,
  markNotificationViewed,
  markNotificationDismissed,
  buildMatchReason,
  notificationToRadarMatch,
  MAX_RADAR_CARDS_PER_SESSION,
} from '@/services/radar-service';

// ============================================================================
// HELPERS
// ============================================================================

const DEMO_USER_ID = 'demo-user-123';
const REAL_USER_ID = 'user-abc-789';

function makeDbRow(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: overrides.id || 'radar-1',
    user_id: overrides.user_id || REAL_USER_ID,
    hook_type: overrides.hook_type || 'artist',
    entity_name: overrides.entity_name || 'Taylor Swift',
    entity_id: overrides.entity_id || 'K8vZ9171oZ7',
    talent_department: overrides.talent_department || null,
    category: overrides.category || null,
    custom_keywords: overrides.custom_keywords || null,
    friend_ids: overrides.friend_ids || null,
    proximity_radius_miles: overrides.proximity_radius_miles || 1.0,
    is_active: overrides.is_active !== undefined ? overrides.is_active : true,
    last_triggered_at: overrides.last_triggered_at || null,
    trigger_count: overrides.trigger_count || 0,
    created_at: overrides.created_at || '2026-02-01T00:00:00Z',
    updated_at: overrides.updated_at || '2026-02-01T00:00:00Z',
  };
}

function makeNotifRow(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: overrides.id || 'notif-1',
    user_id: overrides.user_id || REAL_USER_ID,
    hook_id: overrides.hook_id || 'radar-1',
    event_cache_id: overrides.event_cache_id || null,
    title: overrides.title || 'Taylor Swift - Eras Tour',
    body: overrides.body || 'AT&T Stadium, Mar 15 8pm',
    event_data: overrides.event_data || null,
    status: overrides.status || 'pending',
    sent_at: overrides.sent_at || null,
    viewed_at: overrides.viewed_at || null,
    expires_at: overrides.expires_at || null,
    created_at: overrides.created_at || '2026-02-15T00:00:00Z',
  };
}

/**
 * Configure the mock chain so that the final call in a Supabase query resolves
 * to the given { data, error } pair. We do this by making the terminal methods
 * (limit, order, eq, single, select, update, delete) resolve as a thenable.
 */
function mockResolve(result: { data: any; error: any }) {
  // Rebuild chain fresh so every method returns the same terminal value
  chain = buildChain();

  // Make the chain itself act as a resolved promise
  // Supabase client returns a thenable from terminal methods
  const thenable = {
    ...chain,
    then: (resolve: any) => resolve(result),
    data: result.data,
    error: result.error,
  };

  // Override terminal methods to return thenable
  mockSelect.mockReturnValue(thenable);
  mockInsert.mockReturnValue(thenable);
  mockUpdate.mockReturnValue(thenable);
  mockDelete.mockReturnValue(thenable);
  mockEq.mockReturnValue(thenable);
  mockIn.mockReturnValue(thenable);
  mockOrder.mockReturnValue(thenable);
  mockLimit.mockReturnValue(thenable);
  mockSingle.mockReturnValue(thenable);

  // Re-wire from() to use the new chain
  return thenable;
}

// ============================================================================
// TESTS
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  chain = buildChain();
});

// --------------------------------------------------------------------------
// buildMatchReason (pure function)
// --------------------------------------------------------------------------

describe('buildMatchReason', () => {
  it('returns artist-specific string with entity name', () => {
    expect(buildMatchReason('artist', 'Taylor Swift')).toBe('Matched your Taylor Swift radar');
  });

  it('returns generic Artist Radar when no entity name', () => {
    expect(buildMatchReason('artist')).toBe('Matched your Artist Radar');
  });

  it('returns film_talent-specific string with entity name', () => {
    expect(buildMatchReason('film_talent', 'Christopher Nolan')).toBe('Matched your Christopher Nolan radar');
  });

  it('returns generic Film Radar when no entity name', () => {
    expect(buildMatchReason('film_talent')).toBe('Matched your Film Radar');
  });

  it('returns category-specific string with entity name', () => {
    expect(buildMatchReason('category', 'Pop-up Shops')).toBe('Matched your Pop-up Shops category');
  });

  it('returns generic Category Radar when no entity name', () => {
    expect(buildMatchReason('category')).toBe('Matched your Category Radar');
  });

  it('returns venue-specific string with entity name', () => {
    expect(buildMatchReason('venue', 'Deep Ellum Brewing')).toBe('New event at Deep Ellum Brewing');
  });

  it('returns generic Venue Radar when no entity name', () => {
    expect(buildMatchReason('venue')).toBe('Matched your Venue Radar');
  });

  it('returns fixed proximity string regardless of entity name', () => {
    expect(buildMatchReason('proximity', 'Alice')).toBe('A friend is nearby and free');
    expect(buildMatchReason('proximity')).toBe('A friend is nearby and free');
  });
});

// --------------------------------------------------------------------------
// notificationToRadarMatch (pure function)
// --------------------------------------------------------------------------

describe('notificationToRadarMatch', () => {
  const baseNotification: HookNotification = {
    id: 'notif-1',
    userId: REAL_USER_ID,
    hookId: 'radar-1',
    title: 'Taylor Swift - Eras Tour',
    body: 'AT&T Stadium',
    status: 'pending',
    createdAt: '2026-02-15T00:00:00Z',
  };

  const baseHook: UserHook = {
    id: 'radar-1',
    userId: REAL_USER_ID,
    hookType: 'artist',
    entityName: 'Taylor Swift',
    isActive: true,
    triggerCount: 2,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  };

  it('uses hook data to build matchReason when hook is provided', () => {
    const match = notificationToRadarMatch(baseNotification, baseHook);
    expect(match.hookId).toBe('radar-1');
    expect(match.hookType).toBe('artist');
    expect(match.matchReason).toBe('Matched your Taylor Swift radar');
    expect(match.notificationId).toBe('notif-1');
  });

  it('falls back to notification title when no hook provided', () => {
    const match = notificationToRadarMatch(baseNotification);
    expect(match.hookType).toBe('category'); // default when no hook
    expect(match.matchReason).toBe('Taylor Swift - Eras Tour');
    expect(match.notificationId).toBe('notif-1');
  });

  it('uses venue hook type correctly', () => {
    const venueHook: UserHook = {
      ...baseHook,
      hookType: 'venue',
      entityName: 'Deep Ellum Brewing',
    };
    const match = notificationToRadarMatch(baseNotification, venueHook);
    expect(match.hookType).toBe('venue');
    expect(match.matchReason).toBe('New event at Deep Ellum Brewing');
  });
});

// --------------------------------------------------------------------------
// checkRadarLimit
// --------------------------------------------------------------------------

describe('checkRadarLimit', () => {
  it('always allows creation for demo user', async () => {
    const result = await checkRadarLimit(DEMO_USER_ID, 'artist', 'free');
    expect(result.canCreate).toBe(true);
    expect(result.upgradeRequired).toBe(false);
    expect(result.maxAllowed).toBe(99);
  });

  describe('free tier limits', () => {
    it('blocks when total active radars reaches 3', async () => {
      mockResolve({
        data: [
          makeDbRow({ id: 'r1', hook_type: 'artist' }),
          makeDbRow({ id: 'r2', hook_type: 'category' }),
          makeDbRow({ id: 'r3', hook_type: 'category', entity_name: 'Hiking' }),
        ],
        error: null,
      });

      const result = await checkRadarLimit(REAL_USER_ID, 'category', 'free');
      expect(result.canCreate).toBe(false);
      expect(result.reason).toContain('maximum of 3');
      expect(result.upgradeRequired).toBe(true);
    });

    it('blocks artist when 1 artist/film already exists', async () => {
      mockResolve({
        data: [makeDbRow({ id: 'r1', hook_type: 'artist' })],
        error: null,
      });

      const result = await checkRadarLimit(REAL_USER_ID, 'artist', 'free');
      expect(result.canCreate).toBe(false);
      expect(result.reason).toContain('1 artist/film');
      expect(result.upgradeRequired).toBe(true);
    });

    it('blocks film_talent when 1 artist already exists (shared limit)', async () => {
      mockResolve({
        data: [makeDbRow({ id: 'r1', hook_type: 'artist' })],
        error: null,
      });

      const result = await checkRadarLimit(REAL_USER_ID, 'film_talent', 'free');
      expect(result.canCreate).toBe(false);
      expect(result.reason).toContain('1 artist/film');
    });

    it('blocks category when 2 category radars already exist', async () => {
      mockResolve({
        data: [
          makeDbRow({ id: 'r1', hook_type: 'category', category: 'shopping' }),
          makeDbRow({ id: 'r2', hook_type: 'category', category: 'hiking' }),
        ],
        error: null,
      });

      const result = await checkRadarLimit(REAL_USER_ID, 'category', 'free');
      expect(result.canCreate).toBe(false);
      expect(result.reason).toContain('2 category');
      expect(result.upgradeRequired).toBe(true);
    });

    it('blocks venue on free tier (limit is 0)', async () => {
      mockResolve({ data: [], error: null });

      const result = await checkRadarLimit(REAL_USER_ID, 'venue', 'free');
      expect(result.canCreate).toBe(false);
      expect(result.reason).toContain('Loop Plus');
      expect(result.upgradeRequired).toBe(true);
      expect(result.maxAllowed).toBe(0);
    });

    it('blocks proximity on free tier (limit is 0)', async () => {
      mockResolve({ data: [], error: null });

      const result = await checkRadarLimit(REAL_USER_ID, 'proximity', 'free');
      expect(result.canCreate).toBe(false);
      expect(result.reason).toContain('Loop Plus');
      expect(result.upgradeRequired).toBe(true);
    });

    it('allows creation when under all limits', async () => {
      mockResolve({
        data: [makeDbRow({ id: 'r1', hook_type: 'category' })],
        error: null,
      });

      const result = await checkRadarLimit(REAL_USER_ID, 'artist', 'free');
      expect(result.canCreate).toBe(true);
      expect(result.upgradeRequired).toBe(false);
    });
  });

  describe('plus tier limits', () => {
    it('allows artist creation with plus tier (unlimited)', async () => {
      mockResolve({ data: [], error: null });

      const result = await checkRadarLimit(REAL_USER_ID, 'artist', 'plus');
      expect(result.canCreate).toBe(true);
      expect(result.upgradeRequired).toBe(false);
    });

    it('allows venue creation with plus tier', async () => {
      mockResolve({ data: [], error: null });

      const result = await checkRadarLimit(REAL_USER_ID, 'venue', 'plus');
      expect(result.canCreate).toBe(true);
    });

    it('allows proximity creation with plus tier', async () => {
      mockResolve({ data: [], error: null });

      const result = await checkRadarLimit(REAL_USER_ID, 'proximity', 'plus');
      expect(result.canCreate).toBe(true);
    });

    it('blocks proximity when plus user hits 5 limit', async () => {
      mockResolve({
        data: [
          makeDbRow({ id: 'r1', hook_type: 'proximity' }),
          makeDbRow({ id: 'r2', hook_type: 'proximity' }),
          makeDbRow({ id: 'r3', hook_type: 'proximity' }),
          makeDbRow({ id: 'r4', hook_type: 'proximity' }),
          makeDbRow({ id: 'r5', hook_type: 'proximity' }),
        ],
        error: null,
      });

      const result = await checkRadarLimit(REAL_USER_ID, 'proximity', 'plus');
      expect(result.canCreate).toBe(false);
      expect(result.reason).toContain('5 friends');
      expect(result.upgradeRequired).toBe(false); // already on plus
    });
  });
});

// --------------------------------------------------------------------------
// createRadar
// --------------------------------------------------------------------------

describe('createRadar', () => {
  it('returns mock radar for demo user without hitting DB', async () => {
    const params: CreateRadarParams = {
      userId: DEMO_USER_ID,
      hookType: 'artist',
      entityName: 'Beyonce',
    };
    const result = await createRadar(params, 'free');

    expect(result.success).toBe(true);
    expect(result.radar).toBeDefined();
    expect(result.radar!.hookType).toBe('artist');
    expect(result.radar!.entityName).toBe('Beyonce');
    expect(result.radar!.isActive).toBe(true);
    expect(result.radar!.triggerCount).toBe(0);
    // Should NOT have called supabase.from for demo user's create (may call for listRadars in checkLimit, but not for insert)
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('creates radar successfully when under limit', async () => {
    // First call: listRadars (in checkRadarLimit) returns empty
    // Second call: insert returns the new row
    const insertedRow = makeDbRow({ hook_type: 'artist', entity_name: 'Beyonce' });

    mockResolve({ data: insertedRow, error: null });

    const params: CreateRadarParams = {
      userId: REAL_USER_ID,
      hookType: 'artist',
      entityName: 'Beyonce',
    };
    const result = await createRadar(params, 'plus');

    expect(result.success).toBe(true);
    expect(result.radar).toBeDefined();
    expect(result.radar!.hookType).toBe('artist');
  });

  it('returns error when limit check fails', async () => {
    // Return 3 active radars so free tier total limit is hit
    mockResolve({
      data: [
        makeDbRow({ id: 'r1', hook_type: 'artist' }),
        makeDbRow({ id: 'r2', hook_type: 'category' }),
        makeDbRow({ id: 'r3', hook_type: 'category', entity_name: 'Yoga' }),
      ],
      error: null,
    });

    const params: CreateRadarParams = {
      userId: REAL_USER_ID,
      hookType: 'category',
      entityName: 'Hiking',
    };
    const result = await createRadar(params, 'free');

    expect(result.success).toBe(false);
    expect(result.error).toContain('maximum of 3');
  });

  it('returns error when Supabase insert fails', async () => {
    // listRadars returns empty (under limit), then insert fails
    // We need the chain to first resolve for listRadars, then fail for insert.
    // Since our mock is simple, we simulate the insert error path.
    const thenable = mockResolve({ data: null, error: { message: 'DB error', code: '500' } });

    const params: CreateRadarParams = {
      userId: REAL_USER_ID,
      hookType: 'artist',
      entityName: 'Beyonce',
    };
    const result = await createRadar(params, 'plus');

    // Since listRadars also uses the same mock chain and gets the error,
    // it returns [] (graceful fallback), then limit check passes,
    // then insert also gets the error. The create path catches the insert error.
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// --------------------------------------------------------------------------
// deleteRadar
// --------------------------------------------------------------------------

describe('deleteRadar', () => {
  it('returns true for demo user without DB call', async () => {
    const result = await deleteRadar(DEMO_USER_ID, 'radar-1');
    expect(result).toBe(true);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns true on successful soft delete', async () => {
    mockResolve({ data: null, error: null });

    const result = await deleteRadar(REAL_USER_ID, 'radar-1');
    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('user_hooks');
  });

  it('returns false when Supabase returns error', async () => {
    mockResolve({ data: null, error: { message: 'Not found', code: '404' } });

    const result = await deleteRadar(REAL_USER_ID, 'radar-999');
    expect(result).toBe(false);
  });
});

// --------------------------------------------------------------------------
// hardDeleteRadar
// --------------------------------------------------------------------------

describe('hardDeleteRadar', () => {
  it('returns true for demo user without DB call', async () => {
    const result = await hardDeleteRadar(DEMO_USER_ID, 'radar-1');
    expect(result).toBe(true);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns true on successful hard delete', async () => {
    mockResolve({ data: null, error: null });

    const result = await hardDeleteRadar(REAL_USER_ID, 'radar-1');
    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('user_hooks');
  });

  it('returns false when Supabase returns error', async () => {
    mockResolve({ data: null, error: { message: 'Not found', code: '404' } });

    const result = await hardDeleteRadar(REAL_USER_ID, 'radar-999');
    expect(result).toBe(false);
  });
});

// --------------------------------------------------------------------------
// listRadars
// --------------------------------------------------------------------------

describe('listRadars', () => {
  it('returns mock radars for demo user', async () => {
    const radars = await listRadars(DEMO_USER_ID);
    expect(radars.length).toBe(3);
    expect(radars[0].entityName).toBe('Taylor Swift');
    expect(radars[0].hookType).toBe('artist');
    expect(radars[1].hookType).toBe('category');
    expect(radars[2].hookType).toBe('venue');
    // Should not have called supabase
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns mapped radars from Supabase', async () => {
    mockResolve({
      data: [
        makeDbRow({ id: 'r1', hook_type: 'artist', entity_name: 'Beyonce' }),
        makeDbRow({ id: 'r2', hook_type: 'category', category: 'hiking' }),
      ],
      error: null,
    });

    const radars = await listRadars(REAL_USER_ID);
    expect(radars).toHaveLength(2);
    expect(radars[0].id).toBe('r1');
    expect(radars[0].hookType).toBe('artist');
    expect(radars[0].entityName).toBe('Beyonce');
    expect(radars[1].id).toBe('r2');
    expect(radars[1].hookType).toBe('category');
  });

  it('returns empty array when no radars exist', async () => {
    mockResolve({ data: [], error: null });

    const radars = await listRadars(REAL_USER_ID);
    expect(radars).toEqual([]);
  });

  it('returns empty array when data is null', async () => {
    mockResolve({ data: null, error: null });

    const radars = await listRadars(REAL_USER_ID);
    expect(radars).toEqual([]);
  });

  it('returns empty array gracefully when table does not exist (42P01)', async () => {
    mockResolve({ data: null, error: { message: 'relation does not exist', code: '42P01' } });

    const radars = await listRadars(REAL_USER_ID);
    expect(radars).toEqual([]);
  });
});

// --------------------------------------------------------------------------
// getRadarSummary
// --------------------------------------------------------------------------

describe('getRadarSummary', () => {
  it('returns correct counts by type for free tier', async () => {
    mockResolve({
      data: [
        makeDbRow({ hook_type: 'artist' }),
        makeDbRow({ hook_type: 'category', id: 'r2' }),
        makeDbRow({ hook_type: 'category', id: 'r3' }),
      ],
      error: null,
    });

    const summary = await getRadarSummary(REAL_USER_ID, 'free');
    expect(summary.activeCount).toBe(3);
    expect(summary.byType.artist).toBe(1);
    expect(summary.byType.category).toBe(2);
    expect(summary.byType.venue).toBe(0);
    expect(summary.byType.proximity).toBe(0);
    expect(summary.byType.film_talent).toBe(0);
    expect(summary.limits).toEqual(RADAR_LIMITS.free);
  });

  it('returns plus tier limits when tier is plus', async () => {
    mockResolve({ data: [], error: null });

    const summary = await getRadarSummary(REAL_USER_ID, 'plus');
    expect(summary.limits).toEqual(RADAR_LIMITS.plus);
    expect(summary.activeCount).toBe(0);
  });
});

// --------------------------------------------------------------------------
// getPendingRadarAlerts
// --------------------------------------------------------------------------

describe('getPendingRadarAlerts', () => {
  it('returns mock notifications for demo user', async () => {
    const alerts = await getPendingRadarAlerts(DEMO_USER_ID);
    expect(alerts.length).toBe(2);
    expect(alerts[0].title).toBe('Taylor Swift - Eras Tour');
    expect(alerts[0].status).toBe('pending');
    expect(alerts[1].title).toBe('Tacos & Tequila Pop-up');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns mapped notifications from Supabase', async () => {
    mockResolve({
      data: [
        makeNotifRow({ id: 'n1', title: 'Concert Alert' }),
        makeNotifRow({ id: 'n2', title: 'Pop-up Alert' }),
      ],
      error: null,
    });

    const alerts = await getPendingRadarAlerts(REAL_USER_ID);
    expect(alerts).toHaveLength(2);
    expect(alerts[0].id).toBe('n1');
    expect(alerts[0].title).toBe('Concert Alert');
    expect(mockFrom).toHaveBeenCalledWith('hook_notifications');
  });

  it('returns empty array when no pending alerts', async () => {
    mockResolve({ data: [], error: null });

    const alerts = await getPendingRadarAlerts(REAL_USER_ID);
    expect(alerts).toEqual([]);
  });

  it('returns empty array gracefully when table does not exist', async () => {
    mockResolve({ data: null, error: { message: 'relation does not exist', code: '42P01' } });

    const alerts = await getPendingRadarAlerts(REAL_USER_ID);
    expect(alerts).toEqual([]);
  });
});

// --------------------------------------------------------------------------
// getRecentNotifications
// --------------------------------------------------------------------------

describe('getRecentNotifications', () => {
  it('returns mock notifications for demo user', async () => {
    const notifs = await getRecentNotifications(DEMO_USER_ID);
    expect(notifs.length).toBe(2);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns notifications from Supabase', async () => {
    mockResolve({
      data: [
        makeNotifRow({ id: 'n1', status: 'viewed' }),
        makeNotifRow({ id: 'n2', status: 'dismissed' }),
      ],
      error: null,
    });

    const notifs = await getRecentNotifications(REAL_USER_ID, 5);
    expect(notifs).toHaveLength(2);
    expect(notifs[0].status).toBe('viewed');
    expect(notifs[1].status).toBe('dismissed');
    expect(mockFrom).toHaveBeenCalledWith('hook_notifications');
  });

  it('returns empty array when Supabase returns null data', async () => {
    mockResolve({ data: null, error: null });

    const notifs = await getRecentNotifications(REAL_USER_ID);
    expect(notifs).toEqual([]);
  });
});

// --------------------------------------------------------------------------
// markNotificationViewed
// --------------------------------------------------------------------------

describe('markNotificationViewed', () => {
  it('does nothing for demo user', async () => {
    await markNotificationViewed(DEMO_USER_ID, 'notif-1');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('calls Supabase update with viewed status', async () => {
    mockResolve({ data: null, error: null });

    await markNotificationViewed(REAL_USER_ID, 'notif-1');
    expect(mockFrom).toHaveBeenCalledWith('hook_notifications');
    expect(mockUpdate).toHaveBeenCalled();
  });
});

// --------------------------------------------------------------------------
// markNotificationDismissed
// --------------------------------------------------------------------------

describe('markNotificationDismissed', () => {
  it('does nothing for demo user', async () => {
    await markNotificationDismissed(DEMO_USER_ID, 'notif-1');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('calls Supabase update with dismissed status', async () => {
    mockResolve({ data: null, error: null });

    await markNotificationDismissed(REAL_USER_ID, 'notif-1');
    expect(mockFrom).toHaveBeenCalledWith('hook_notifications');
    expect(mockUpdate).toHaveBeenCalled();
  });
});

// --------------------------------------------------------------------------
// MAX_RADAR_CARDS_PER_SESSION constant
// --------------------------------------------------------------------------

describe('MAX_RADAR_CARDS_PER_SESSION', () => {
  it('is set to 3', () => {
    expect(MAX_RADAR_CARDS_PER_SESSION).toBe(3);
  });
});

// --------------------------------------------------------------------------
// RADAR_LIMITS type contract
// --------------------------------------------------------------------------

describe('RADAR_LIMITS contract', () => {
  it('free tier has total of 3', () => {
    expect(RADAR_LIMITS.free.total).toBe(3);
  });

  it('free tier allows 1 artist/film', () => {
    expect(RADAR_LIMITS.free.artistOrFilm).toBe(1);
  });

  it('free tier allows 2 category', () => {
    expect(RADAR_LIMITS.free.category).toBe(2);
  });

  it('free tier blocks venue (0)', () => {
    expect(RADAR_LIMITS.free.venue).toBe(0);
  });

  it('free tier blocks proximity (0)', () => {
    expect(RADAR_LIMITS.free.proximity).toBe(0);
  });

  it('plus tier has unlimited total', () => {
    expect(RADAR_LIMITS.plus.total).toBe(Infinity);
  });

  it('plus tier caps proximity at 5', () => {
    expect(RADAR_LIMITS.plus.proximity).toBe(5);
  });

  it('free tier has no push notifications', () => {
    expect(RADAR_LIMITS.free.pushNotifications).toBe(false);
  });

  it('plus tier has push notifications', () => {
    expect(RADAR_LIMITS.plus.pushNotifications).toBe(true);
  });
});
