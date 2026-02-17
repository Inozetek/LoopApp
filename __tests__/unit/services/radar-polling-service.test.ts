/**
 * Tests for radar-polling-service
 *
 * Covers: event cache logic, Ticketmaster API integration, hook matching,
 * batch polling, and the cachedEventToRadarEventData transformer.
 *
 * Mock strategy:
 * - Supabase: chained mock builder for from().select().eq() etc.
 * - global.fetch: mocked for all Ticketmaster HTTP calls
 * - EXPO_PUBLIC_TICKETMASTER_API_KEY is set before module import so the
 *   module-level const captures the value.
 */

// Set the API key BEFORE imports so the module-level const captures it
process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY = 'test-tm-key';

import type { CachedEvent, UserHook, RadarEventData } from '@/types/radar';

// ---------------------------------------------------------------------------
// Supabase mock — flexible chain that can be configured per test
// ---------------------------------------------------------------------------

let mockFromImpl: (table: string) => any;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn((...args: any[]) => mockFromImpl(args[0])),
  },
}));

jest.mock('@/services/radar-push-service', () => ({
  sendRadarPushNotification: jest.fn().mockResolvedValue(false),
}));

// Default chain builder — creates a chainable mock for any Supabase table call
function defaultChain(resolveValue: any = { data: null, error: null }) {
  const chain: any = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.neq = jest.fn(() => chain);
  chain.single = jest.fn().mockResolvedValue(resolveValue);
  // insert returns a chain supporting .select().single() for returning inserted row
  const insertChain: any = {};
  insertChain.select = jest.fn(() => insertChain);
  insertChain.single = jest.fn().mockResolvedValue({ data: { id: 'notif-new', created_at: new Date().toISOString() }, error: null });
  chain.insert = jest.fn(() => insertChain);
  chain.upsert = jest.fn().mockResolvedValue({ error: null });
  chain.update = jest.fn(() => chain);
  // Allow .then() so the chain itself can be awaited (for queries ending with .neq())
  chain.then = undefined; // explicitly not thenable by default
  return chain;
}

// ---------------------------------------------------------------------------
// Fetch mock
// ---------------------------------------------------------------------------

const originalFetch = global.fetch;
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

afterAll(() => {
  (global as any).fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Import the module AFTER env and mocks are set
// ---------------------------------------------------------------------------

import {
  getCachedEvents,
  updateEventCache,
  searchTicketmasterByKeyword,
  searchTicketmasterByVenue,
  searchTicketmasterByCategory,
  matchHookToEvents,
  cachedEventToRadarEventData,
  pollRadarsForUser,
} from '@/services/radar-polling-service';

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockFromImpl = () => defaultChain();
});

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function makeCachedEvent(overrides: Partial<CachedEvent> = {}): CachedEvent {
  return {
    id: 'evt-1',
    name: 'Test Concert',
    venue: 'House of Blues',
    address: '2200 N Lamar St, Dallas, TX',
    city: 'Dallas',
    date: '2026-04-15',
    time: '20:00:00',
    imageUrl: 'https://example.com/image.jpg',
    priceMin: 45,
    priceMax: 120,
    currency: 'USD',
    ticketUrl: 'https://ticketmaster.com/event/123',
    source: 'ticketmaster',
    category: 'music',
    ...overrides,
  };
}

function makeUserHook(overrides: Partial<UserHook> = {}): UserHook {
  return {
    id: 'hook-1',
    userId: 'user-1',
    hookType: 'artist',
    entityName: 'Taylor Swift',
    isActive: true,
    triggerCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Build a minimal Ticketmaster API response */
function makeTMResponse(events: any[] = []) {
  if (events.length === 0) {
    return { page: { totalElements: 0 } };
  }
  return {
    _embedded: { events },
    page: { totalElements: events.length },
  };
}

function makeTMEvent(overrides: any = {}) {
  return {
    id: 'tm-1',
    name: 'Test Event',
    url: 'https://ticketmaster.com/event/tm-1',
    dates: {
      start: { localDate: '2026-05-10', localTime: '19:30:00' },
    },
    priceRanges: [{ min: 30, max: 90, currency: 'USD' }],
    images: [
      { url: 'https://img.tm.com/large.jpg', width: 1024, height: 576 },
      { url: 'https://img.tm.com/small.jpg', width: 200, height: 113 },
    ],
    _embedded: {
      venues: [
        {
          name: 'Amphitheater',
          address: { line1: '100 Main St' },
          city: { name: 'Dallas' },
          state: { stateCode: 'TX' },
        },
      ],
    },
    classifications: [{ segment: { name: 'Music' } }],
    ...overrides,
  };
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('radar-polling-service', () => {
  // --------------------------------------------------------------------------
  // 1. cachedEventToRadarEventData — pure transformation
  // --------------------------------------------------------------------------
  describe('cachedEventToRadarEventData', () => {
    it('maps all fields from CachedEvent to RadarEventData', () => {
      const event = makeCachedEvent();
      const result = cachedEventToRadarEventData(event);

      expect(result).toEqual<RadarEventData>({
        name: 'Test Concert',
        venue: 'House of Blues',
        address: '2200 N Lamar St, Dallas, TX',
        date: '2026-04-15',
        time: '20:00:00',
        imageUrl: 'https://example.com/image.jpg',
        priceMin: 45,
        priceMax: 120,
        currency: 'USD',
        ticketUrl: 'https://ticketmaster.com/event/123',
        category: 'music',
        source: 'ticketmaster',
      });
    });

    it('handles missing optional fields gracefully', () => {
      const event = makeCachedEvent({
        venue: undefined,
        address: undefined,
        time: undefined,
        imageUrl: undefined,
        priceMin: undefined,
        priceMax: undefined,
        currency: undefined,
        ticketUrl: undefined,
        category: undefined,
      });

      const result = cachedEventToRadarEventData(event);

      expect(result.name).toBe('Test Concert');
      expect(result.venue).toBeUndefined();
      expect(result.address).toBeUndefined();
      expect(result.time).toBeUndefined();
      expect(result.priceMin).toBeUndefined();
      expect(result.ticketUrl).toBeUndefined();
    });

    it('does not include distanceMiles (only set downstream)', () => {
      const event = makeCachedEvent();
      const result = cachedEventToRadarEventData(event);
      expect(result.distanceMiles).toBeUndefined();
    });

    it('preserves the source field', () => {
      const event = makeCachedEvent({ source: 'bandsintown' });
      const result = cachedEventToRadarEventData(event);
      expect(result.source).toBe('bandsintown');
    });
  });

  // --------------------------------------------------------------------------
  // 2. getCachedEvents
  // --------------------------------------------------------------------------
  describe('getCachedEvents', () => {
    it('returns cached events on cache hit (not expired)', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const cachedEvents = [makeCachedEvent()];

      const chain = defaultChain({
        data: { events: cachedEvents, expires_at: futureDate },
        error: null,
      });
      mockFromImpl = () => chain;

      const result = await getCachedEvents('artist:taylor_swift:dallas');
      expect(result).toEqual(cachedEvents);
    });

    it('returns null on cache miss (no row found)', async () => {
      const chain = defaultChain({ data: null, error: { code: 'PGRST116' } });
      mockFromImpl = () => chain;

      const result = await getCachedEvents('artist:unknown:dallas');
      expect(result).toBeNull();
    });

    it('returns null when cache entry is expired', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const chain = defaultChain({
        data: { events: [makeCachedEvent()], expires_at: pastDate },
        error: null,
      });
      mockFromImpl = () => chain;

      const result = await getCachedEvents('artist:expired:dallas');
      expect(result).toBeNull();
    });

    it('returns null when supabase throws an error', async () => {
      const chain = defaultChain();
      chain.single.mockRejectedValue(new Error('Network error'));
      mockFromImpl = () => chain;

      const result = await getCachedEvents('artist:error:dallas');
      expect(result).toBeNull();
    });

    it('returns events when expires_at is null (no expiry set)', async () => {
      const cachedEvents = [makeCachedEvent()];
      const chain = defaultChain({
        data: { events: cachedEvents, expires_at: null },
        error: null,
      });
      mockFromImpl = () => chain;

      const result = await getCachedEvents('artist:no_expiry:dallas');
      expect(result).toEqual(cachedEvents);
    });
  });

  // --------------------------------------------------------------------------
  // 3. updateEventCache
  // --------------------------------------------------------------------------
  describe('updateEventCache', () => {
    it('upserts with expires_at = latest event date + 1 day when events exist', async () => {
      const chain = defaultChain();
      mockFromImpl = () => chain;

      const events = [
        makeCachedEvent({ date: '2026-05-01' }),
        makeCachedEvent({ date: '2026-06-15' }), // latest
        makeCachedEvent({ date: '2026-04-10' }),
      ];

      await updateEventCache(
        'artist:test:dallas',
        'ticketmaster',
        'artist',
        'Test Artist',
        events,
        'Dallas'
      );

      expect(chain.upsert).toHaveBeenCalledTimes(1);

      const upsertArg = chain.upsert.mock.calls[0][0];

      // expires_at should be June 16 (latest date June 15 + 1 day)
      const expiresDate = new Date(upsertArg.expires_at);
      expect(expiresDate.getUTCDate()).toBe(16);
      expect(expiresDate.getUTCMonth()).toBe(5); // June = month 5 (0-indexed)

      expect(upsertArg.cache_key).toBe('artist:test:dallas');
      expect(upsertArg.source).toBe('ticketmaster');
      expect(upsertArg.entity_type).toBe('artist');
      expect(upsertArg.entity_name).toBe('Test Artist');
      expect(upsertArg.events).toEqual(events);
      expect(upsertArg.location_city).toBe('Dallas');
    });

    it('upserts with expires_at = now + 7 days when no events found', async () => {
      const chain = defaultChain();
      mockFromImpl = () => chain;

      const beforeCall = Date.now();
      await updateEventCache(
        'artist:empty:dallas',
        'ticketmaster',
        'artist',
        'Unknown Artist',
        [],
        'Dallas'
      );

      const upsertArg = chain.upsert.mock.calls[0][0];
      const expiresDate = new Date(upsertArg.expires_at);
      const sevenDaysFromNow = new Date(beforeCall + 7 * 24 * 60 * 60 * 1000);

      // Should be approximately 7 days from now (within 10 seconds tolerance)
      expect(Math.abs(expiresDate.getTime() - sevenDaysFromNow.getTime())).toBeLessThan(10000);
    });

    it('uses DEFAULT_CITY when city is not provided', async () => {
      const chain = defaultChain();
      mockFromImpl = () => chain;

      await updateEventCache('key', 'ticketmaster', 'artist', 'Artist', [], undefined);

      const upsertArg = chain.upsert.mock.calls[0][0];
      expect(upsertArg.location_city).toBe('Dallas');
    });

    it('sets next_fetch_at to 7 days from now', async () => {
      const chain = defaultChain();
      mockFromImpl = () => chain;

      const beforeCall = Date.now();
      await updateEventCache('key', 'ticketmaster', 'artist', 'A', [], 'Dallas');

      const upsertArg = chain.upsert.mock.calls[0][0];
      const nextFetch = new Date(upsertArg.next_fetch_at);
      const sevenDays = new Date(beforeCall + 7 * 24 * 60 * 60 * 1000);

      expect(Math.abs(nextFetch.getTime() - sevenDays.getTime())).toBeLessThan(10000);
    });

    it('uses onConflict: cache_key for upsert', async () => {
      const chain = defaultChain();
      mockFromImpl = () => chain;

      await updateEventCache('key', 'ticketmaster', 'artist', 'A', [], 'Dallas');

      const upsertOptions = chain.upsert.mock.calls[0][1];
      expect(upsertOptions).toEqual({ onConflict: 'cache_key' });
    });

    it('does not throw when upsert fails (logs error)', async () => {
      const chain = defaultChain();
      chain.upsert.mockRejectedValue(new Error('DB write error'));
      mockFromImpl = () => chain;

      // Should not throw
      await expect(
        updateEventCache('key', 'ticketmaster', 'artist', 'A', [], 'Dallas')
      ).resolves.toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 4. searchTicketmasterByKeyword
  // --------------------------------------------------------------------------
  describe('searchTicketmasterByKeyword', () => {
    it('returns parsed events on successful API response', async () => {
      const tmEvent = makeTMEvent();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeTMResponse([tmEvent]),
      });

      const result = await searchTicketmasterByKeyword('Taylor Swift', 'Dallas', 'TX');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Event');
      expect(result[0].venue).toBe('Amphitheater');
      expect(result[0].priceMin).toBe(30);
      expect(result[0].source).toBe('ticketmaster');
    });

    it('returns empty array when API returns non-ok status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({}),
      });

      const result = await searchTicketmasterByKeyword('Rate Limited', 'Dallas', 'TX');

      expect(result).toEqual([]);
    });

    it('returns empty array when API returns no _embedded.events', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ page: { totalElements: 0 } }),
      });

      const result = await searchTicketmasterByKeyword('No Results', 'Dallas', 'TX');

      expect(result).toEqual([]);
    });

    it('returns empty array when fetch throws a network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const result = await searchTicketmasterByKeyword('Offline', 'Dallas', 'TX');

      expect(result).toEqual([]);
    });

    it('passes correct query parameters to Ticketmaster API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeTMResponse([]),
      });

      await searchTicketmasterByKeyword('Beyonce', 'Houston', 'TX');

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('keyword=Beyonce');
      expect(calledUrl).toContain('city=Houston');
      expect(calledUrl).toContain('stateCode=TX');
      expect(calledUrl).toContain('apikey=test-tm-key');
      expect(calledUrl).toContain('sort=date');
    });

    it('uses default city and stateCode when not provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeTMResponse([]),
      });

      await searchTicketmasterByKeyword('Test');

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('city=Dallas');
      expect(calledUrl).toContain('stateCode=TX');
    });

    it('transforms TM event with missing optional fields', async () => {
      const sparseEvent = {
        id: 'tm-sparse',
        name: 'Sparse Event',
        url: 'https://ticketmaster.com/event/sparse',
        dates: { start: { localDate: '2026-07-01' } },
        images: [],
        _embedded: {},
        classifications: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeTMResponse([sparseEvent]),
      });

      const result = await searchTicketmasterByKeyword('Sparse');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Sparse Event');
      expect(result[0].venue).toBeUndefined();
      expect(result[0].priceMin).toBeUndefined();
      expect(result[0].imageUrl).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 4b. searchTicketmasterByVenue
  // --------------------------------------------------------------------------
  describe('searchTicketmasterByVenue', () => {
    it('returns parsed events for venue search', async () => {
      const tmEvent = makeTMEvent({ name: 'House of Blues Show' });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeTMResponse([tmEvent]),
      });

      const result = await searchTicketmasterByVenue('House of Blues', 'Dallas', 'TX');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('House of Blues Show');
    });

    it('returns empty array on API error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await searchTicketmasterByVenue('Bad Venue');

      expect(result).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // 4c. searchTicketmasterByCategory
  // --------------------------------------------------------------------------
  describe('searchTicketmasterByCategory', () => {
    it('passes classificationName param correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeTMResponse([]),
      });

      await searchTicketmasterByCategory('Music', 'Dallas', 'TX');

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('classificationName=Music');
    });

    it('returns parsed events for category search', async () => {
      const tmEvent = makeTMEvent({ name: 'Jazz Festival' });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeTMResponse([tmEvent]),
      });

      const result = await searchTicketmasterByCategory('Music');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Jazz Festival');
    });
  });

  // --------------------------------------------------------------------------
  // 5. matchHookToEvents
  // --------------------------------------------------------------------------
  describe('matchHookToEvents', () => {
    it('builds correct cache key for artist hook and returns cached events', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const events = [makeCachedEvent()];

      const cacheChain = defaultChain({
        data: { events, expires_at: futureDate },
        error: null,
      });
      mockFromImpl = (table: string) => {
        if (table === 'event_cache') return cacheChain;
        return defaultChain();
      };

      const hook = makeUserHook({ hookType: 'artist', entityName: 'Taylor Swift' });
      const result = await matchHookToEvents(hook);

      // Verify cache key used
      const eqCalls = cacheChain.eq.mock.calls;
      expect(eqCalls[0]).toEqual(['cache_key', 'artist:taylor_swift:dallas']);
      expect(result).toEqual(events);
    });

    it('builds correct cache key for category hook (maps to TM classification)', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const events = [makeCachedEvent()];

      const cacheChain = defaultChain({
        data: { events, expires_at: futureDate },
        error: null,
      });
      mockFromImpl = (table: string) => {
        if (table === 'event_cache') return cacheChain;
        return defaultChain();
      };

      const hook = makeUserHook({ hookType: 'category', category: 'live_music' });
      await matchHookToEvents(hook);

      // live_music maps to "Music" -> key = "category:music:dallas"
      const eqCalls = cacheChain.eq.mock.calls;
      expect(eqCalls[0]).toEqual(['cache_key', 'category:music:dallas']);
    });

    it('builds correct cache key for venue hook', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const events = [makeCachedEvent()];

      const cacheChain = defaultChain({
        data: { events, expires_at: futureDate },
        error: null,
      });
      mockFromImpl = (table: string) => {
        if (table === 'event_cache') return cacheChain;
        return defaultChain();
      };

      const hook = makeUserHook({ hookType: 'venue', entityName: 'House of Blues' });
      await matchHookToEvents(hook);

      const eqCalls = cacheChain.eq.mock.calls;
      expect(eqCalls[0]).toEqual(['cache_key', 'venue:house_of_blues:dallas']);
    });

    it('returns cached events without calling fetch on cache hit', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const events = [makeCachedEvent()];

      const cacheChain = defaultChain({
        data: { events, expires_at: futureDate },
        error: null,
      });
      mockFromImpl = (table: string) => {
        if (table === 'event_cache') return cacheChain;
        return defaultChain();
      };

      const hook = makeUserHook({ hookType: 'artist', entityName: 'Drake' });
      const result = await matchHookToEvents(hook);

      // fetch should NOT be called since cache hit
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual(events);
    });

    it('fetches from Ticketmaster on cache miss and updates cache', async () => {
      const cacheChain = defaultChain({ data: null, error: null });
      mockFromImpl = (table: string) => {
        if (table === 'event_cache') return cacheChain;
        return defaultChain();
      };

      // fetch returns TM events
      const tmEvent = makeTMEvent({ name: 'Drake Live' });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeTMResponse([tmEvent]),
      });

      const hook = makeUserHook({ hookType: 'artist', entityName: 'Drake' });
      const result = await matchHookToEvents(hook);

      // Should have called fetch (cache miss)
      expect(mockFetch).toHaveBeenCalled();
      // Should have upserted the cache
      expect(cacheChain.upsert).toHaveBeenCalled();
      // Should return the fetched events
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Drake Live');
    });

    it('returns empty array for proximity hooks (unsupported)', async () => {
      const hook = makeUserHook({ hookType: 'proximity' });
      const result = await matchHookToEvents(hook);
      expect(result).toEqual([]);
    });

    it('handles film_talent hook same as artist', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const events = [makeCachedEvent()];

      const cacheChain = defaultChain({
        data: { events, expires_at: futureDate },
        error: null,
      });
      mockFromImpl = (table: string) => {
        if (table === 'event_cache') return cacheChain;
        return defaultChain();
      };

      const hook = makeUserHook({ hookType: 'film_talent', entityName: 'Christopher Nolan' });
      const result = await matchHookToEvents(hook);

      const eqCalls = cacheChain.eq.mock.calls;
      expect(eqCalls[0]).toEqual(['cache_key', 'artist:christopher_nolan:dallas']);
      expect(result).toEqual(events);
    });

    it('uses entityName as fallback for category when category is undefined', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const events = [makeCachedEvent()];

      const cacheChain = defaultChain({
        data: { events, expires_at: futureDate },
        error: null,
      });
      mockFromImpl = (table: string) => {
        if (table === 'event_cache') return cacheChain;
        return defaultChain();
      };

      const hook = makeUserHook({
        hookType: 'category',
        category: undefined,
        entityName: 'sports',
      });
      await matchHookToEvents(hook);

      // sports maps to "Sports" -> "category:sports:dallas"
      const eqCalls = cacheChain.eq.mock.calls;
      expect(eqCalls[0]).toEqual(['cache_key', 'category:sports:dallas']);
    });
  });

  // --------------------------------------------------------------------------
  // 6. pollRadarsForUser
  // --------------------------------------------------------------------------
  describe('pollRadarsForUser', () => {
    it('returns 0 when user has no active hooks', async () => {
      // user_hooks query returns empty array
      mockFromImpl = (table: string) => {
        const chain = defaultChain();
        if (table === 'user_hooks') {
          // .neq() is the last chain call, and the whole thing is awaited
          chain.neq = jest.fn(() => Promise.resolve({ data: [], error: null }));
        }
        return chain;
      };

      const result = await pollRadarsForUser('user-1');
      expect(result).toBe(0);
    });

    it('returns 0 when supabase errors fetching hooks', async () => {
      mockFromImpl = (table: string) => {
        const chain = defaultChain();
        if (table === 'user_hooks') {
          chain.neq = jest.fn(() =>
            Promise.resolve({ data: null, error: { message: 'DB error' } })
          );
        }
        return chain;
      };

      const result = await pollRadarsForUser('user-1');
      expect(result).toBe(0);
    });

    it('creates notifications for new events found via cache', async () => {
      const hookRow = {
        id: 'hook-1',
        user_id: 'user-1',
        hook_type: 'artist',
        entity_name: 'Taylor Swift',
        entity_id: null,
        category: null,
        is_active: true,
        trigger_count: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const cachedEvents = [
        makeCachedEvent({ name: 'Taylor Swift - Eras Tour Dallas' }),
      ];

      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const insertSelectChain: any = { select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id: 'notif-new', created_at: new Date().toISOString() }, error: null }) };
      const insertMock = jest.fn(() => insertSelectChain);

      mockFromImpl = (table: string) => {
        const chain = defaultChain();

        if (table === 'user_hooks') {
          chain.neq = jest.fn(() =>
            Promise.resolve({ data: [hookRow], error: null })
          );
          return chain;
        }

        if (table === 'event_cache') {
          chain.single = jest.fn().mockResolvedValue({
            data: { events: cachedEvents, expires_at: futureDate },
            error: null,
          });
          return chain;
        }

        if (table === 'hook_notifications') {
          // For the existing-notifications SELECT query: .select().eq().eq() -> awaited
          // The second .eq() returns a promise (end of chain)
          const selectChain: any = {};
          selectChain.eq = jest.fn(() => selectChain);
          // The final .eq in the chain returns the result promise
          let eqCallCount = 0;
          selectChain.eq = jest.fn(() => {
            eqCallCount++;
            if (eqCallCount >= 2) {
              return Promise.resolve({ data: [], error: null });
            }
            return selectChain;
          });
          chain.select = jest.fn(() => selectChain);
          chain.insert = insertMock;
          return chain;
        }

        return chain;
      };

      const result = await pollRadarsForUser('user-1');

      expect(result).toBe(1);
      expect(insertMock).toHaveBeenCalledTimes(1);
      const insertArg = (insertMock.mock.calls as any)[0][0];
      expect(insertArg.title).toBe('Taylor Swift - Eras Tour Dallas');
      expect(insertArg.user_id).toBe('user-1');
      expect(insertArg.hook_id).toBe('hook-1');
      expect(insertArg.status).toBe('pending');
    });

    it('deduplicates: skips events already notified about', async () => {
      const hookRow = {
        id: 'hook-1',
        user_id: 'user-1',
        hook_type: 'artist',
        entity_name: 'Drake',
        entity_id: null,
        category: null,
        is_active: true,
        trigger_count: 2,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const cachedEvents = [
        makeCachedEvent({ name: 'Drake - Houston Show' }),
        makeCachedEvent({ name: 'Drake - Dallas Show' }),
      ];

      const existingNotifs = [
        { event_data: { name: 'Drake - Houston Show' } },
      ];

      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const insertSelectChain: any = { select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id: 'notif-new', created_at: new Date().toISOString() }, error: null }) };
      const insertMock = jest.fn(() => insertSelectChain);

      mockFromImpl = (table: string) => {
        const chain = defaultChain();

        if (table === 'user_hooks') {
          chain.neq = jest.fn(() =>
            Promise.resolve({ data: [hookRow], error: null })
          );
          return chain;
        }

        if (table === 'event_cache') {
          chain.single = jest.fn().mockResolvedValue({
            data: { events: cachedEvents, expires_at: futureDate },
            error: null,
          });
          return chain;
        }

        if (table === 'hook_notifications') {
          const selectChain: any = {};
          let eqCallCount = 0;
          selectChain.eq = jest.fn(() => {
            eqCallCount++;
            if (eqCallCount >= 2) {
              return Promise.resolve({ data: existingNotifs, error: null });
            }
            return selectChain;
          });
          chain.select = jest.fn(() => selectChain);
          chain.insert = insertMock;
          return chain;
        }

        return chain;
      };

      const result = await pollRadarsForUser('user-1');

      // Should only create 1 notification (Dallas), Houston is already notified
      expect(result).toBe(1);
      expect(insertMock).toHaveBeenCalledTimes(1);
      const insertArg = (insertMock.mock.calls as any)[0][0];
      expect(insertArg.title).toBe('Drake - Dallas Show');
    });

    it('limits to 3 events per hook (slice(0, 3))', async () => {
      const hookRow = {
        id: 'hook-1',
        user_id: 'user-1',
        hook_type: 'category',
        entity_name: null,
        entity_id: null,
        category: 'music',
        is_active: true,
        trigger_count: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const cachedEvents = [
        makeCachedEvent({ name: 'Event 1' }),
        makeCachedEvent({ name: 'Event 2' }),
        makeCachedEvent({ name: 'Event 3' }),
        makeCachedEvent({ name: 'Event 4' }),
        makeCachedEvent({ name: 'Event 5' }),
      ];

      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const insertSelectChain: any = { select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id: 'notif-new', created_at: new Date().toISOString() }, error: null }) };
      const insertMock = jest.fn(() => insertSelectChain);

      mockFromImpl = (table: string) => {
        const chain = defaultChain();

        if (table === 'user_hooks') {
          chain.neq = jest.fn(() =>
            Promise.resolve({ data: [hookRow], error: null })
          );
          return chain;
        }

        if (table === 'event_cache') {
          chain.single = jest.fn().mockResolvedValue({
            data: { events: cachedEvents, expires_at: futureDate },
            error: null,
          });
          return chain;
        }

        if (table === 'hook_notifications') {
          const selectChain: any = {};
          let eqCallCount = 0;
          selectChain.eq = jest.fn(() => {
            eqCallCount++;
            if (eqCallCount >= 2) {
              return Promise.resolve({ data: [], error: null });
            }
            return selectChain;
          });
          chain.select = jest.fn(() => selectChain);
          chain.insert = insertMock;
          return chain;
        }

        return chain;
      };

      const result = await pollRadarsForUser('user-1');

      // Max 3 per hook (events.slice(0, 3))
      expect(result).toBe(3);
      expect(insertMock).toHaveBeenCalledTimes(3);
    });

    it('excludes proximity hooks from polling', async () => {
      mockFromImpl = (table: string) => {
        const chain = defaultChain();
        if (table === 'user_hooks') {
          chain.neq = jest.fn((col, val) => {
            // Verify that proximity is excluded
            expect(col).toBe('hook_type');
            expect(val).toBe('proximity');
            return Promise.resolve({ data: [], error: null });
          });
        }
        return chain;
      };

      await pollRadarsForUser('user-1');
    });

    it('returns 0 and does not throw when polling encounters an error', async () => {
      mockFromImpl = () => {
        throw new Error('Unexpected error');
      };

      const result = await pollRadarsForUser('user-1');
      expect(result).toBe(0);
    });

    it('notification body includes venue and price info', async () => {
      const hookRow = {
        id: 'hook-1',
        user_id: 'user-1',
        hook_type: 'artist',
        entity_name: 'Adele',
        entity_id: null,
        category: null,
        is_active: true,
        trigger_count: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const cachedEvents = [
        makeCachedEvent({
          name: 'Adele Live',
          venue: 'AT&T Stadium',
          date: '2026-06-20',
          priceMin: 75,
        }),
      ];

      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const insertSelectChain: any = { select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id: 'notif-new', created_at: new Date().toISOString() }, error: null }) };
      const insertMock = jest.fn(() => insertSelectChain);

      mockFromImpl = (table: string) => {
        const chain = defaultChain();

        if (table === 'user_hooks') {
          chain.neq = jest.fn(() =>
            Promise.resolve({ data: [hookRow], error: null })
          );
          return chain;
        }

        if (table === 'event_cache') {
          chain.single = jest.fn().mockResolvedValue({
            data: { events: cachedEvents, expires_at: futureDate },
            error: null,
          });
          return chain;
        }

        if (table === 'hook_notifications') {
          const selectChain: any = {};
          let eqCallCount = 0;
          selectChain.eq = jest.fn(() => {
            eqCallCount++;
            if (eqCallCount >= 2) {
              return Promise.resolve({ data: [], error: null });
            }
            return selectChain;
          });
          chain.select = jest.fn(() => selectChain);
          chain.insert = insertMock;
          return chain;
        }

        return chain;
      };

      await pollRadarsForUser('user-1');

      const insertArg = (insertMock.mock.calls as any)[0][0];
      expect(insertArg.body).toContain('AT&T Stadium');
      expect(insertArg.body).toContain('2026-06-20');
      expect(insertArg.body).toContain('From $75');
    });

    it('notification body shows "Free" when priceMin is undefined', async () => {
      const hookRow = {
        id: 'hook-1',
        user_id: 'user-1',
        hook_type: 'artist',
        entity_name: 'Free Artist',
        entity_id: null,
        category: null,
        is_active: true,
        trigger_count: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const cachedEvents = [
        makeCachedEvent({
          name: 'Free Show',
          venue: 'City Park',
          date: '2026-07-04',
          priceMin: undefined,
        }),
      ];

      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const insertSelectChain: any = { select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id: 'notif-new', created_at: new Date().toISOString() }, error: null }) };
      const insertMock = jest.fn(() => insertSelectChain);

      mockFromImpl = (table: string) => {
        const chain = defaultChain();

        if (table === 'user_hooks') {
          chain.neq = jest.fn(() =>
            Promise.resolve({ data: [hookRow], error: null })
          );
          return chain;
        }

        if (table === 'event_cache') {
          chain.single = jest.fn().mockResolvedValue({
            data: { events: cachedEvents, expires_at: futureDate },
            error: null,
          });
          return chain;
        }

        if (table === 'hook_notifications') {
          const selectChain: any = {};
          let eqCallCount = 0;
          selectChain.eq = jest.fn(() => {
            eqCallCount++;
            if (eqCallCount >= 2) {
              return Promise.resolve({ data: [], error: null });
            }
            return selectChain;
          });
          chain.select = jest.fn(() => selectChain);
          chain.insert = insertMock;
          return chain;
        }

        return chain;
      };

      await pollRadarsForUser('user-1');

      const insertArg = (insertMock.mock.calls as any)[0][0];
      expect(insertArg.body).toContain('Free');
    });
  });

  // --------------------------------------------------------------------------
  // 7. CATEGORY_TO_TM_CLASSIFICATION mapping (tested via matchHookToEvents)
  // --------------------------------------------------------------------------
  describe('CATEGORY_TO_TM_CLASSIFICATION mapping', () => {
    const categoryTests: Array<{ loopCategory: string; expectedTM: string }> = [
      { loopCategory: 'live_music', expectedTM: 'music' },
      { loopCategory: 'music', expectedTM: 'music' },
      { loopCategory: 'concerts', expectedTM: 'music' },
      { loopCategory: 'sports', expectedTM: 'sports' },
      { loopCategory: 'arts', expectedTM: 'arts & theatre' },
      { loopCategory: 'theater', expectedTM: 'arts & theatre' },
      { loopCategory: 'comedy', expectedTM: 'arts & theatre' },
      { loopCategory: 'entertainment', expectedTM: 'miscellaneous' },
      { loopCategory: 'family', expectedTM: 'family' },
      { loopCategory: 'nightlife', expectedTM: 'music' },
      { loopCategory: 'events', expectedTM: 'miscellaneous' },
    ];

    categoryTests.forEach(({ loopCategory, expectedTM }) => {
      it(`maps "${loopCategory}" to TM classification "${expectedTM}"`, async () => {
        const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const cacheChain = defaultChain({
          data: { events: [makeCachedEvent()], expires_at: futureDate },
          error: null,
        });
        mockFromImpl = (table: string) => {
          if (table === 'event_cache') return cacheChain;
          return defaultChain();
        };

        const hook = makeUserHook({ hookType: 'category', category: loopCategory });
        await matchHookToEvents(hook);

        const eqCalls = cacheChain.eq.mock.calls;
        expect(eqCalls[0]).toEqual(['cache_key', `category:${expectedTM}:dallas`]);
      });
    });
  });
});
