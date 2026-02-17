/**
 * Hot Drop Service — CRUD for time-limited business promotions
 *
 * Responsibilities:
 * - Create, list, cancel hot drops (business-facing)
 * - Claim hot drops (user-facing)
 * - Feed injection (max 1 per session at position 2)
 * - Tier gating (Boosted/Premium businesses only; Plus early access)
 * - Expiry and claimed-out status management
 */

import { supabase } from '@/lib/supabase';
import type {
  HotDrop,
  HotDropClaim,
  HotDropStatus,
  CreateHotDropParams,
} from '@/types/hot-drop';
import { isHotDropVisibleToTier } from '@/types/hot-drop';
import type { SubscriptionTier } from '@/types/subscription';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEMO_USER_ID = 'demo-user-123';
const DEFAULT_EARLY_ACCESS_MINUTES = 15;
const DEFAULT_CLAIM_PRICE_CENTS = 150; // $1.50 per claim

/** Max hot drops injected into the feed per session */
export const MAX_HOT_DROPS_PER_SESSION = 1;

/** Position in feed where hot drop is injected (0-indexed) */
export const HOT_DROP_FEED_POSITION = 2;

// ============================================================================
// BUSINESS TIER GATING
// ============================================================================

export type BusinessTier = 'organic' | 'boosted' | 'premium';

/**
 * Check if a business can create hot drops based on their subscription tier.
 */
export function canBusinessCreateHotDrop(businessTier: BusinessTier): {
  allowed: boolean;
  reason?: string;
} {
  if (businessTier === 'organic') {
    return {
      allowed: false,
      reason: 'Hot Drops are available for Boosted ($49/mo) and Premium ($149/mo) businesses.',
    };
  }
  return { allowed: true };
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a new hot drop.
 */
export async function createHotDrop(
  params: CreateHotDropParams,
  businessTier: BusinessTier = 'boosted'
): Promise<{ success: boolean; hotDrop?: HotDrop; error?: string }> {
  // Check business tier
  const tierCheck = canBusinessCreateHotDrop(businessTier);
  if (!tierCheck.allowed) {
    return { success: false, error: tierCheck.reason };
  }

  try {
    const { data, error } = await supabase
      .from('hot_drops')
      .insert({
        business_id: params.businessId,
        business_name: params.businessName,
        title: params.title,
        description: params.description,
        image_url: params.imageUrl || null,
        category: params.category,
        starts_at: params.startsAt,
        expires_at: params.expiresAt,
        plus_early_access_minutes: DEFAULT_EARLY_ACCESS_MINUTES,
        total_claims: params.totalClaims,
        current_claims: 0,
        claim_price_cents: DEFAULT_CLAIM_PRICE_CENTS,
        address: params.address || null,
        latitude: params.latitude || null,
        longitude: params.longitude || null,
        status: 'scheduled',
      })
      .select()
      .single();

    if (error) {
      console.error('[HotDropService] Error creating hot drop:', error);
      return { success: false, error: 'Failed to create Hot Drop. Please try again.' };
    }

    return { success: true, hotDrop: mapDbRowToHotDrop(data) };
  } catch (err) {
    console.error('[HotDropService] Exception creating hot drop:', err);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

/**
 * Get active hot drops for feed injection.
 * Respects tier-based visibility (Plus early access).
 */
export async function getActiveHotDrops(
  userTier: SubscriptionTier = 'free'
): Promise<HotDrop[]> {
  try {
    const { data, error } = await supabase
      .from('hot_drops')
      .select('*')
      .in('status', ['scheduled', 'active'])
      .gte('expires_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(5);

    if (error) {
      if (error.code === '42P01') return getMockHotDrops();
      console.error('[HotDropService] Error fetching hot drops:', error);
      return [];
    }

    const drops = (data || []).map(mapDbRowToHotDrop);

    // Filter by tier visibility
    return drops.filter((drop: HotDrop) => isHotDropVisibleToTier(drop, userTier));
  } catch (err) {
    console.error('[HotDropService] Exception fetching hot drops:', err);
    return getMockHotDrops();
  }
}

/**
 * Get hot drops created by a specific business.
 */
export async function getBusinessHotDrops(businessId: string): Promise<HotDrop[]> {
  try {
    const { data, error } = await supabase
      .from('hot_drops')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[HotDropService] Error fetching business hot drops:', error);
      return [];
    }

    return (data || []).map(mapDbRowToHotDrop);
  } catch (err) {
    console.error('[HotDropService] Exception:', err);
    return [];
  }
}

/**
 * Claim a hot drop for a user.
 */
export async function claimHotDrop(
  hotDropId: string,
  userId: string
): Promise<{ success: boolean; claim?: HotDropClaim; error?: string }> {
  if (userId === DEMO_USER_ID) {
    return {
      success: true,
      claim: {
        id: `mock-claim-${Date.now()}`,
        hotDropId,
        userId,
        claimedAt: new Date().toISOString(),
        status: 'claimed',
      },
    };
  }

  try {
    // Check if already claimed
    const { data: existing } = await supabase
      .from('hot_drop_claims')
      .select('id')
      .eq('hot_drop_id', hotDropId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return { success: false, error: 'You already claimed this drop!' };
    }

    // Check if still available
    const { data: drop } = await supabase
      .from('hot_drops')
      .select('current_claims, total_claims, status, expires_at')
      .eq('id', hotDropId)
      .single();

    if (!drop) {
      return { success: false, error: 'Hot Drop not found.' };
    }

    if (drop.status !== 'active' && drop.status !== 'scheduled') {
      return { success: false, error: 'This Hot Drop is no longer available.' };
    }

    if (drop.current_claims >= drop.total_claims) {
      return { success: false, error: 'All claims have been taken!' };
    }

    if (new Date(drop.expires_at) < new Date()) {
      return { success: false, error: 'This Hot Drop has expired.' };
    }

    // Create claim
    const { data: claim, error } = await supabase
      .from('hot_drop_claims')
      .insert({
        hot_drop_id: hotDropId,
        user_id: userId,
        status: 'claimed',
      })
      .select()
      .single();

    if (error) {
      console.error('[HotDropService] Error claiming hot drop:', error);
      return { success: false, error: 'Failed to claim. Please try again.' };
    }

    // Increment claim count
    await supabase
      .from('hot_drops')
      .update({
        current_claims: drop.current_claims + 1,
        status: drop.current_claims + 1 >= drop.total_claims ? 'claimed_out' : 'active',
      })
      .eq('id', hotDropId);

    return {
      success: true,
      claim: {
        id: claim.id,
        hotDropId: claim.hot_drop_id,
        userId: claim.user_id,
        claimedAt: claim.claimed_at || claim.created_at,
        status: 'claimed',
      },
    };
  } catch (err) {
    console.error('[HotDropService] Exception claiming:', err);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

/**
 * Cancel a hot drop (business action).
 */
export async function cancelHotDrop(hotDropId: string, businessId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('hot_drops')
      .update({ status: 'cancelled' })
      .eq('id', hotDropId)
      .eq('business_id', businessId);

    return !error;
  } catch {
    return false;
  }
}

// ============================================================================
// FEED INJECTION
// ============================================================================

/**
 * Get hot drops ready for feed injection.
 * Returns at most MAX_HOT_DROPS_PER_SESSION drops.
 */
export async function getHotDropsForFeed(
  userTier: SubscriptionTier = 'free'
): Promise<HotDrop[]> {
  const drops = await getActiveHotDrops(userTier);
  return drops.slice(0, MAX_HOT_DROPS_PER_SESSION);
}

// ============================================================================
// DB ROW MAPPER
// ============================================================================

function mapDbRowToHotDrop(row: any): HotDrop {
  return {
    id: row.id,
    businessId: row.business_id,
    businessName: row.business_name,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url || undefined,
    category: row.category,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    plusEarlyAccessMinutes: row.plus_early_access_minutes || DEFAULT_EARLY_ACCESS_MINUTES,
    totalClaims: row.total_claims,
    currentClaims: row.current_claims || 0,
    claimPriceCents: row.claim_price_cents || DEFAULT_CLAIM_PRICE_CENTS,
    address: row.address || undefined,
    latitude: row.latitude || undefined,
    longitude: row.longitude || undefined,
    status: row.status as HotDropStatus,
    createdAt: row.created_at,
  };
}

// ============================================================================
// MOCK DATA
// ============================================================================

function getMockHotDrops(): HotDrop[] {
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  return [
    {
      id: 'mock-hotdrop-1',
      businessId: 'mock-biz-1',
      businessName: 'Pecan Lodge BBQ',
      title: '50% Off Brisket Plate',
      description: 'Flash deal: Half off our famous brisket plate. Today only!',
      imageUrl: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800',
      category: 'dining',
      startsAt: now.toISOString(),
      expiresAt: twoHoursFromNow.toISOString(),
      plusEarlyAccessMinutes: 15,
      totalClaims: 50,
      currentClaims: 23,
      claimPriceCents: 150,
      address: '2702 Main St, Dallas, TX',
      latitude: 32.7833,
      longitude: -96.7862,
      status: 'active',
      createdAt: now.toISOString(),
    },
    {
      id: 'mock-hotdrop-2',
      businessId: 'mock-biz-2',
      businessName: 'Deep Ellum Brewing',
      title: 'Buy 1 Get 1 Free Pints',
      description: 'Happy hour flash: BOGO pints on all house brews.',
      imageUrl: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=800',
      category: 'nightlife',
      startsAt: now.toISOString(),
      expiresAt: fourHoursFromNow.toISOString(),
      plusEarlyAccessMinutes: 15,
      totalClaims: 30,
      currentClaims: 8,
      claimPriceCents: 150,
      address: '2823 St Louis St, Dallas, TX',
      latitude: 32.7849,
      longitude: -96.7816,
      status: 'active',
      createdAt: now.toISOString(),
    },
  ];
}
