/**
 * Hot Drop Service — Unit Tests
 *
 * Tests cover:
 * - canBusinessCreateHotDrop (tier gating)
 * - createHotDrop (insert + tier check)
 * - getActiveHotDrops (query + visibility filter)
 * - getBusinessHotDrops (business dashboard)
 * - claimHotDrop (double claim, capacity, expiry, demo user)
 * - cancelHotDrop (business cancellation)
 * - getHotDropsForFeed (session limit)
 * - Pure helpers from types/hot-drop.ts
 */

import type { HotDrop, CreateHotDropParams } from '@/types/hot-drop';
import {
  isHotDropClaimable,
  isHotDropVisibleToTier,
  getHotDropTimeRemaining,
  getClaimsProgress,
} from '@/types/hot-drop';

// ============================================================================
// SUPABASE MOCK
// ============================================================================

const mockChain = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(),
  maybeSingle: jest.fn(),
};

jest.mock('@/lib/supabase', () => ({
  supabase: mockChain,
}));

import {
  canBusinessCreateHotDrop,
  createHotDrop,
  getActiveHotDrops,
  getBusinessHotDrops,
  claimHotDrop,
  cancelHotDrop,
  getHotDropsForFeed,
  MAX_HOT_DROPS_PER_SESSION,
  HOT_DROP_FEED_POSITION,
} from '@/services/hot-drop-service';

// ============================================================================
// FIXTURES
// ============================================================================

function makeHotDrop(overrides: Partial<HotDrop> = {}): HotDrop {
  const now = new Date();
  return {
    id: 'hd-1',
    businessId: 'biz-1',
    businessName: 'Test Business',
    title: 'Half Off Tacos',
    description: 'Great deal on tacos',
    category: 'dining',
    startsAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 min ago
    expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2h from now
    plusEarlyAccessMinutes: 15,
    totalClaims: 50,
    currentClaims: 10,
    claimPriceCents: 150,
    status: 'active',
    createdAt: now.toISOString(),
    ...overrides,
  };
}

function makeDbRow(overrides: Record<string, any> = {}): Record<string, any> {
  const now = new Date();
  return {
    id: 'hd-1',
    business_id: 'biz-1',
    business_name: 'Test Business',
    title: 'Half Off Tacos',
    description: 'Great deal on tacos',
    image_url: null,
    category: 'dining',
    starts_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    expires_at: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    plus_early_access_minutes: 15,
    total_claims: 50,
    current_claims: 10,
    claim_price_cents: 150,
    address: '123 Main St',
    latitude: 32.78,
    longitude: -96.79,
    status: 'active',
    created_at: now.toISOString(),
    ...overrides,
  };
}

const defaultCreateParams: CreateHotDropParams = {
  businessId: 'biz-1',
  businessName: 'Test Business',
  title: 'Half Off Tacos',
  description: 'Great deal on tacos',
  category: 'dining',
  startsAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  totalClaims: 50,
  address: '123 Main St',
  latitude: 32.78,
  longitude: -96.79,
};

// ============================================================================
// RESET
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  // Reset chain so every test starts clean
  Object.values(mockChain).forEach(fn => {
    if (typeof fn === 'function' && 'mockReturnThis' in fn) {
      (fn as jest.Mock).mockReturnThis();
    }
  });
  // single and maybeSingle don't return this
  mockChain.single.mockReset();
  mockChain.maybeSingle.mockReset();
});

// ============================================================================
// canBusinessCreateHotDrop
// ============================================================================

describe('canBusinessCreateHotDrop', () => {
  it('should deny organic tier businesses', () => {
    const result = canBusinessCreateHotDrop('organic');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain('Boosted');
    expect(result.reason).toContain('Premium');
  });

  it('should allow boosted tier businesses', () => {
    const result = canBusinessCreateHotDrop('boosted');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should allow premium tier businesses', () => {
    const result = canBusinessCreateHotDrop('premium');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});

// ============================================================================
// createHotDrop
// ============================================================================

describe('createHotDrop', () => {
  it('should reject organic tier', async () => {
    const result = await createHotDrop(defaultCreateParams, 'organic');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Boosted');
    // Should NOT call supabase at all
    expect(mockChain.from).not.toHaveBeenCalled();
  });

  it('should insert and return hot drop on success for boosted tier', async () => {
    const row = makeDbRow();
    mockChain.single.mockResolvedValueOnce({ data: row, error: null });

    const result = await createHotDrop(defaultCreateParams, 'boosted');
    expect(result.success).toBe(true);
    expect(result.hotDrop).toBeDefined();
    expect(result.hotDrop!.id).toBe('hd-1');
    expect(result.hotDrop!.businessName).toBe('Test Business');
    expect(mockChain.from).toHaveBeenCalledWith('hot_drops');
    expect(mockChain.insert).toHaveBeenCalled();
  });

  it('should insert and return hot drop on success for premium tier', async () => {
    const row = makeDbRow({ id: 'hd-premium' });
    mockChain.single.mockResolvedValueOnce({ data: row, error: null });

    const result = await createHotDrop(defaultCreateParams, 'premium');
    expect(result.success).toBe(true);
    expect(result.hotDrop!.id).toBe('hd-premium');
  });

  it('should default to boosted tier if none provided', async () => {
    const row = makeDbRow();
    mockChain.single.mockResolvedValueOnce({ data: row, error: null });

    const result = await createHotDrop(defaultCreateParams);
    expect(result.success).toBe(true);
  });

  it('should handle supabase insert error', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'insert failed', code: '23505' },
    });

    const result = await createHotDrop(defaultCreateParams, 'boosted');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to create');
  });

  it('should handle unexpected exception', async () => {
    mockChain.single.mockRejectedValueOnce(new Error('Network error'));

    const result = await createHotDrop(defaultCreateParams, 'boosted');
    expect(result.success).toBe(false);
    expect(result.error).toContain('unexpected');
  });

  it('should set status to scheduled and current_claims to 0', async () => {
    const row = makeDbRow();
    mockChain.single.mockResolvedValueOnce({ data: row, error: null });

    await createHotDrop(defaultCreateParams, 'boosted');

    const insertArg = mockChain.insert.mock.calls[0][0];
    expect(insertArg.status).toBe('scheduled');
    expect(insertArg.current_claims).toBe(0);
  });
});

// ============================================================================
// getActiveHotDrops
// ============================================================================

describe('getActiveHotDrops', () => {
  it('should return mapped hot drops for plus tier', async () => {
    const rows = [makeDbRow({ id: 'hd-a' }), makeDbRow({ id: 'hd-b' })];
    mockChain.limit.mockResolvedValueOnce({ data: rows, error: null });

    const result = await getActiveHotDrops('plus');
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('hd-a');
    expect(result[1].id).toBe('hd-b');
  });

  it('should filter drops not visible to free tier', async () => {
    const now = new Date();
    // Drop that started 5 min ago with 15 min early access => free can't see yet
    const rows = [
      makeDbRow({
        id: 'hd-early',
        starts_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        plus_early_access_minutes: 15,
      }),
    ];
    mockChain.limit.mockResolvedValueOnce({ data: rows, error: null });

    const result = await getActiveHotDrops('free');
    expect(result.length).toBe(0);
  });

  it('should return mock hot drops on table-not-found error (42P01)', async () => {
    mockChain.limit.mockResolvedValueOnce({
      data: null,
      error: { message: 'relation not found', code: '42P01' },
    });

    const result = await getActiveHotDrops('plus');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].businessName).toBeDefined();
  });

  it('should return empty array on other supabase errors', async () => {
    mockChain.limit.mockResolvedValueOnce({
      data: null,
      error: { message: 'some error', code: '50000' },
    });

    const result = await getActiveHotDrops('free');
    expect(result).toEqual([]);
  });

  it('should return mock hot drops on exception', async () => {
    mockChain.limit.mockRejectedValueOnce(new Error('Network down'));

    const result = await getActiveHotDrops('free');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should default to free tier', async () => {
    const now = new Date();
    // Drop started 30 min ago, 15 min early access => free can see (30 > 15)
    const rows = [
      makeDbRow({
        starts_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      }),
    ];
    mockChain.limit.mockResolvedValueOnce({ data: rows, error: null });

    const result = await getActiveHotDrops();
    expect(result.length).toBe(1);
  });

  it('should return empty array when data is null but no error', async () => {
    mockChain.limit.mockResolvedValueOnce({ data: null, error: null });

    const result = await getActiveHotDrops('plus');
    expect(result).toEqual([]);
  });
});

// ============================================================================
// getBusinessHotDrops
// ============================================================================

describe('getBusinessHotDrops', () => {
  it('should query by business_id and return mapped drops', async () => {
    const rows = [makeDbRow({ id: 'hd-biz-1', business_id: 'biz-99' })];
    mockChain.limit.mockResolvedValueOnce({ data: rows, error: null });

    const result = await getBusinessHotDrops('biz-99');
    expect(mockChain.eq).toHaveBeenCalledWith('business_id', 'biz-99');
    expect(result.length).toBe(1);
    expect(result[0].businessId).toBe('biz-99');
  });

  it('should return empty array on error', async () => {
    mockChain.limit.mockResolvedValueOnce({
      data: null,
      error: { message: 'err' },
    });

    const result = await getBusinessHotDrops('biz-1');
    expect(result).toEqual([]);
  });

  it('should return empty array on exception', async () => {
    mockChain.limit.mockRejectedValueOnce(new Error('boom'));

    const result = await getBusinessHotDrops('biz-1');
    expect(result).toEqual([]);
  });
});

// ============================================================================
// claimHotDrop
// ============================================================================

describe('claimHotDrop', () => {
  it('should return mock claim for demo user without hitting supabase', async () => {
    const result = await claimHotDrop('hd-1', 'demo-user-123');
    expect(result.success).toBe(true);
    expect(result.claim).toBeDefined();
    expect(result.claim!.userId).toBe('demo-user-123');
    expect(result.claim!.hotDropId).toBe('hd-1');
    expect(result.claim!.status).toBe('claimed');
    // No supabase calls for demo user
    expect(mockChain.from).not.toHaveBeenCalled();
  });

  it('should prevent double claim', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'existing-claim' },
      error: null,
    });

    const result = await claimHotDrop('hd-1', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('already claimed');
  });

  it('should fail when hot drop not found', async () => {
    // maybeSingle for existing claim check => no existing claim
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // single for fetching hot drop => not found
    mockChain.single.mockResolvedValueOnce({ data: null, error: null });

    const result = await claimHotDrop('hd-missing', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should fail when hot drop status is cancelled', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockChain.single.mockResolvedValueOnce({
      data: {
        current_claims: 5,
        total_claims: 50,
        status: 'cancelled',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      error: null,
    });

    const result = await claimHotDrop('hd-1', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('no longer available');
  });

  it('should fail when hot drop status is claimed_out', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockChain.single.mockResolvedValueOnce({
      data: {
        current_claims: 50,
        total_claims: 50,
        status: 'claimed_out',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      error: null,
    });

    const result = await claimHotDrop('hd-1', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('no longer available');
  });

  it('should fail when all claims taken (currentClaims >= totalClaims)', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockChain.single.mockResolvedValueOnce({
      data: {
        current_claims: 50,
        total_claims: 50,
        status: 'active',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      error: null,
    });

    const result = await claimHotDrop('hd-1', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('claims have been taken');
  });

  it('should fail when hot drop has expired', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockChain.single.mockResolvedValueOnce({
      data: {
        current_claims: 5,
        total_claims: 50,
        status: 'active',
        expires_at: new Date(Date.now() - 60 * 1000).toISOString(), // 1 min ago
      },
      error: null,
    });

    const result = await claimHotDrop('hd-1', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('should succeed and return claim on valid claim', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockChain.single
      // First .single() => hot drop fetch
      .mockResolvedValueOnce({
        data: {
          current_claims: 10,
          total_claims: 50,
          status: 'active',
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        },
        error: null,
      })
      // Second .single() => claim insert
      .mockResolvedValueOnce({
        data: {
          id: 'claim-1',
          hot_drop_id: 'hd-1',
          user_id: 'user-1',
          claimed_at: new Date().toISOString(),
          status: 'claimed',
        },
        error: null,
      });
    // update for incrementing count returns via mockReturnThis (eq chain)

    const result = await claimHotDrop('hd-1', 'user-1');
    expect(result.success).toBe(true);
    expect(result.claim).toBeDefined();
    expect(result.claim!.id).toBe('claim-1');
    expect(result.claim!.status).toBe('claimed');
  });

  it('should set status to claimed_out when last claim is taken', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockChain.single
      .mockResolvedValueOnce({
        data: {
          current_claims: 49, // one spot left
          total_claims: 50,
          status: 'active',
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'claim-last',
          hot_drop_id: 'hd-1',
          user_id: 'user-1',
          claimed_at: new Date().toISOString(),
          status: 'claimed',
        },
        error: null,
      });

    await claimHotDrop('hd-1', 'user-1');

    // The update call should set status to claimed_out
    const updateArg = mockChain.update.mock.calls[0][0];
    expect(updateArg.current_claims).toBe(50);
    expect(updateArg.status).toBe('claimed_out');
  });

  it('should keep status as active when claims remain after claiming', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockChain.single
      .mockResolvedValueOnce({
        data: {
          current_claims: 10,
          total_claims: 50,
          status: 'active',
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'claim-mid',
          hot_drop_id: 'hd-1',
          user_id: 'user-1',
          claimed_at: new Date().toISOString(),
          status: 'claimed',
        },
        error: null,
      });

    await claimHotDrop('hd-1', 'user-1');

    const updateArg = mockChain.update.mock.calls[0][0];
    expect(updateArg.current_claims).toBe(11);
    expect(updateArg.status).toBe('active');
  });

  it('should handle claim insert error', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockChain.single
      .mockResolvedValueOnce({
        data: {
          current_claims: 5,
          total_claims: 50,
          status: 'active',
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'insert failed' },
      });

    const result = await claimHotDrop('hd-1', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to claim');
  });

  it('should handle unexpected exception during claim', async () => {
    mockChain.maybeSingle.mockRejectedValueOnce(new Error('crash'));

    const result = await claimHotDrop('hd-1', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('unexpected');
  });

  it('should use created_at as fallback for claimedAt when claimed_at is missing', async () => {
    const createdAt = '2026-02-17T10:00:00.000Z';
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockChain.single
      .mockResolvedValueOnce({
        data: {
          current_claims: 0,
          total_claims: 50,
          status: 'active',
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'claim-x',
          hot_drop_id: 'hd-1',
          user_id: 'user-1',
          claimed_at: null,
          created_at: createdAt,
          status: 'claimed',
        },
        error: null,
      });

    const result = await claimHotDrop('hd-1', 'user-1');
    expect(result.success).toBe(true);
    expect(result.claim!.claimedAt).toBe(createdAt);
  });
});

// ============================================================================
// cancelHotDrop
// ============================================================================

describe('cancelHotDrop', () => {
  it('should return true on successful cancellation', async () => {
    // Chain: supabase.from().update().eq('id',...).eq('business_id',...)
    // The second .eq() is the terminal call that is awaited.
    mockChain.eq
      .mockReset()
      .mockReturnValueOnce(mockChain) // first .eq('id', hotDropId) returns chain
      .mockResolvedValueOnce({ error: null }); // second .eq('business_id', businessId) resolves

    const result = await cancelHotDrop('hd-1', 'biz-1');
    expect(result).toBe(true);
    expect(mockChain.update).toHaveBeenCalledWith({ status: 'cancelled' });
  });

  it('should return false on supabase error', async () => {
    mockChain.eq
      .mockReset()
      .mockReturnValueOnce(mockChain)
      .mockResolvedValueOnce({ error: { message: 'err' } });

    const result = await cancelHotDrop('hd-1', 'biz-1');
    expect(result).toBe(false);
  });

  it('should return false on exception', async () => {
    mockChain.eq
      .mockReset()
      .mockReturnValueOnce(mockChain)
      .mockRejectedValueOnce(new Error('boom'));

    const result = await cancelHotDrop('hd-1', 'biz-1');
    expect(result).toBe(false);
  });
});

// ============================================================================
// getHotDropsForFeed
// ============================================================================

describe('getHotDropsForFeed', () => {
  it('should return at most MAX_HOT_DROPS_PER_SESSION drops', async () => {
    const now = new Date();
    const rows = [
      makeDbRow({ id: 'hd-f1', starts_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString() }),
      makeDbRow({ id: 'hd-f2', starts_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString() }),
      makeDbRow({ id: 'hd-f3', starts_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString() }),
    ];
    mockChain.limit.mockResolvedValueOnce({ data: rows, error: null });

    const result = await getHotDropsForFeed('plus');
    expect(result.length).toBe(MAX_HOT_DROPS_PER_SESSION);
    expect(result.length).toBe(1);
  });

  it('should return empty array when no active drops', async () => {
    mockChain.limit.mockResolvedValueOnce({ data: [], error: null });

    const result = await getHotDropsForFeed('free');
    expect(result).toEqual([]);
  });

  it('should default to free tier', async () => {
    const now = new Date();
    // Drop started well in the past, free can see
    const rows = [
      makeDbRow({ starts_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString() }),
    ];
    mockChain.limit.mockResolvedValueOnce({ data: rows, error: null });

    const result = await getHotDropsForFeed();
    expect(result.length).toBe(1);
  });
});

// ============================================================================
// CONSTANTS
// ============================================================================

describe('constants', () => {
  it('MAX_HOT_DROPS_PER_SESSION should be 1', () => {
    expect(MAX_HOT_DROPS_PER_SESSION).toBe(1);
  });

  it('HOT_DROP_FEED_POSITION should be 2', () => {
    expect(HOT_DROP_FEED_POSITION).toBe(2);
  });
});

// ============================================================================
// PURE HELPERS (types/hot-drop.ts)
// ============================================================================

describe('isHotDropClaimable', () => {
  it('should return true for active drop with capacity and not expired', () => {
    const drop = makeHotDrop({ status: 'active', currentClaims: 10, totalClaims: 50 });
    expect(isHotDropClaimable(drop)).toBe(true);
  });

  it('should return false for non-active status', () => {
    expect(isHotDropClaimable(makeHotDrop({ status: 'scheduled' }))).toBe(false);
    expect(isHotDropClaimable(makeHotDrop({ status: 'claimed_out' }))).toBe(false);
    expect(isHotDropClaimable(makeHotDrop({ status: 'expired' }))).toBe(false);
    expect(isHotDropClaimable(makeHotDrop({ status: 'cancelled' }))).toBe(false);
  });

  it('should return false when currentClaims >= totalClaims', () => {
    const drop = makeHotDrop({ status: 'active', currentClaims: 50, totalClaims: 50 });
    expect(isHotDropClaimable(drop)).toBe(false);
  });

  it('should return false when currentClaims exceeds totalClaims', () => {
    const drop = makeHotDrop({ status: 'active', currentClaims: 51, totalClaims: 50 });
    expect(isHotDropClaimable(drop)).toBe(false);
  });

  it('should return false when expired', () => {
    const drop = makeHotDrop({
      status: 'active',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(isHotDropClaimable(drop)).toBe(false);
  });
});

describe('isHotDropVisibleToTier', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should show drop to plus user at startsAt', () => {
    const startsAt = new Date('2026-02-17T12:00:00.000Z');
    jest.setSystemTime(startsAt);

    const drop = makeHotDrop({
      startsAt: startsAt.toISOString(),
      plusEarlyAccessMinutes: 15,
    });

    expect(isHotDropVisibleToTier(drop, 'plus')).toBe(true);
  });

  it('should hide drop from plus user before startsAt', () => {
    const startsAt = new Date('2026-02-17T12:00:00.000Z');
    jest.setSystemTime(new Date('2026-02-17T11:59:59.000Z'));

    const drop = makeHotDrop({
      startsAt: startsAt.toISOString(),
      plusEarlyAccessMinutes: 15,
    });

    expect(isHotDropVisibleToTier(drop, 'plus')).toBe(false);
  });

  it('should hide drop from free user during early access window', () => {
    const startsAt = new Date('2026-02-17T12:00:00.000Z');
    // 5 min after startsAt — still within 15-min early access window
    jest.setSystemTime(new Date('2026-02-17T12:05:00.000Z'));

    const drop = makeHotDrop({
      startsAt: startsAt.toISOString(),
      plusEarlyAccessMinutes: 15,
    });

    expect(isHotDropVisibleToTier(drop, 'free')).toBe(false);
  });

  it('should show drop to free user after early access window', () => {
    const startsAt = new Date('2026-02-17T12:00:00.000Z');
    // 16 min after startsAt — past 15-min early access window
    jest.setSystemTime(new Date('2026-02-17T12:16:00.000Z'));

    const drop = makeHotDrop({
      startsAt: startsAt.toISOString(),
      plusEarlyAccessMinutes: 15,
    });

    expect(isHotDropVisibleToTier(drop, 'free')).toBe(true);
  });

  it('should show drop to free user exactly at early access boundary', () => {
    const startsAt = new Date('2026-02-17T12:00:00.000Z');
    // Exactly 15 min after startsAt
    jest.setSystemTime(new Date('2026-02-17T12:15:00.000Z'));

    const drop = makeHotDrop({
      startsAt: startsAt.toISOString(),
      plusEarlyAccessMinutes: 15,
    });

    expect(isHotDropVisibleToTier(drop, 'free')).toBe(true);
  });

  it('should handle zero early access minutes (free sees immediately)', () => {
    const startsAt = new Date('2026-02-17T12:00:00.000Z');
    jest.setSystemTime(startsAt);

    const drop = makeHotDrop({
      startsAt: startsAt.toISOString(),
      plusEarlyAccessMinutes: 0,
    });

    expect(isHotDropVisibleToTier(drop, 'free')).toBe(true);
    expect(isHotDropVisibleToTier(drop, 'plus')).toBe(true);
  });
});

describe('getHotDropTimeRemaining', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return Expired when past expiry', () => {
    jest.setSystemTime(new Date('2026-02-17T14:00:00.000Z'));
    expect(getHotDropTimeRemaining('2026-02-17T13:00:00.000Z')).toBe('Expired');
  });

  it('should return hours and minutes format when > 1 hour', () => {
    jest.setSystemTime(new Date('2026-02-17T12:00:00.000Z'));
    // Expires at 14:30 => 2h 30m remaining
    expect(getHotDropTimeRemaining('2026-02-17T14:30:00.000Z')).toBe('2h 30m');
  });

  it('should return minutes and seconds when < 1 hour', () => {
    jest.setSystemTime(new Date('2026-02-17T12:00:00.000Z'));
    // Expires at 12:45:30 => 45m 30s remaining
    expect(getHotDropTimeRemaining('2026-02-17T12:45:30.000Z')).toBe('45m 30s');
  });

  it('should return seconds only when < 1 minute', () => {
    jest.setSystemTime(new Date('2026-02-17T12:00:00.000Z'));
    // Expires at 12:00:42 => 42s remaining
    expect(getHotDropTimeRemaining('2026-02-17T12:00:42.000Z')).toBe('42s');
  });

  it('should return Expired when exactly at expiry time', () => {
    jest.setSystemTime(new Date('2026-02-17T14:00:00.000Z'));
    expect(getHotDropTimeRemaining('2026-02-17T14:00:00.000Z')).toBe('Expired');
  });

  it('should return 1h 0m for exactly 1 hour remaining', () => {
    jest.setSystemTime(new Date('2026-02-17T12:00:00.000Z'));
    expect(getHotDropTimeRemaining('2026-02-17T13:00:00.000Z')).toBe('1h 0m');
  });
});

describe('getClaimsProgress', () => {
  it('should return 0 when totalClaims is 0', () => {
    const drop = makeHotDrop({ totalClaims: 0, currentClaims: 0 });
    expect(getClaimsProgress(drop)).toBe(0);
  });

  it('should return fraction for partial claims', () => {
    const drop = makeHotDrop({ totalClaims: 100, currentClaims: 25 });
    expect(getClaimsProgress(drop)).toBeCloseTo(0.25);
  });

  it('should return 1 when all claims taken', () => {
    const drop = makeHotDrop({ totalClaims: 50, currentClaims: 50 });
    expect(getClaimsProgress(drop)).toBe(1);
  });

  it('should cap at 1 even if currentClaims exceeds totalClaims', () => {
    const drop = makeHotDrop({ totalClaims: 50, currentClaims: 55 });
    expect(getClaimsProgress(drop)).toBe(1);
  });

  it('should return 0 when no claims yet', () => {
    const drop = makeHotDrop({ totalClaims: 50, currentClaims: 0 });
    expect(getClaimsProgress(drop)).toBe(0);
  });

  it('should handle single claim out of one total', () => {
    const drop = makeHotDrop({ totalClaims: 1, currentClaims: 1 });
    expect(getClaimsProgress(drop)).toBe(1);
  });
});
