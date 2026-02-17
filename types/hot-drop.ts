/**
 * Hot Drop Types — Time-Limited Business Promotions
 *
 * Hot Drops are flash deals/promotions that create urgency:
 * - Businesses create time-limited offers
 * - Users claim them before they expire or sell out
 * - Per-claim pricing for businesses ($1.50-2.00)
 * - Plus users get 15-min early access
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export type HotDropStatus = 'scheduled' | 'active' | 'claimed_out' | 'expired' | 'cancelled';

export interface HotDrop {
  id: string;
  businessId: string;
  businessName: string;
  title: string;
  description: string;
  imageUrl?: string;
  category: string;

  /** When the drop becomes visible to Plus users (earlyAccess) */
  startsAt: string;
  /** When the drop expires */
  expiresAt: string;
  /** Minutes of early access for Plus users (default 15) */
  plusEarlyAccessMinutes: number;

  /** Total claims available */
  totalClaims: number;
  /** Current number of claims */
  currentClaims: number;

  /** Cost per claim to the business (in cents) */
  claimPriceCents: number;

  address?: string;
  latitude?: number;
  longitude?: number;

  status: HotDropStatus;
  createdAt: string;
}

export interface HotDropClaim {
  id: string;
  hotDropId: string;
  userId: string;
  claimedAt: string;
  /** When the user actually redeemed (visited) */
  redeemedAt?: string;
  status: 'claimed' | 'redeemed' | 'expired' | 'cancelled';
}

// ============================================================================
// PARAMS
// ============================================================================

export interface CreateHotDropParams {
  businessId: string;
  businessName: string;
  title: string;
  description: string;
  imageUrl?: string;
  category: string;
  startsAt: string;
  expiresAt: string;
  totalClaims: number;
  address?: string;
  latitude?: number;
  longitude?: number;
}

// ============================================================================
// FEED HELPERS
// ============================================================================

/** Check if a hot drop is currently claimable */
export function isHotDropClaimable(drop: HotDrop): boolean {
  if (drop.status !== 'active') return false;
  if (drop.currentClaims >= drop.totalClaims) return false;
  if (new Date(drop.expiresAt) < new Date()) return false;
  return true;
}

/** Check if a hot drop is visible to the given tier */
export function isHotDropVisibleToTier(drop: HotDrop, tier: 'free' | 'plus'): boolean {
  const now = new Date();
  const startsAt = new Date(drop.startsAt);

  if (tier === 'plus') {
    // Plus users see it at startsAt (which already includes early access window)
    return now >= startsAt;
  }

  // Free users see it after early access window
  const freeVisibleAt = new Date(startsAt.getTime() + drop.plusEarlyAccessMinutes * 60 * 1000);
  return now >= freeVisibleAt;
}

/** Get remaining time until expiry as a display string */
export function getHotDropTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Get claims progress as a fraction (0-1) */
export function getClaimsProgress(drop: HotDrop): number {
  if (drop.totalClaims === 0) return 0;
  return Math.min(drop.currentClaims / drop.totalClaims, 1);
}
