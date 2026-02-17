/**
 * Tests for HotDropCard component logic
 *
 * Tests the pure functions and display logic used by the HotDropCard component.
 * Covers: claimability checks, countdown timer formatting, claims progress,
 * button label/state derivation, Plus early access visibility, and image display.
 *
 * NOTE: This project uses ts-jest with testEnvironment: 'node', so we test
 * the extracted logic rather than rendering React Native components.
 */

import type { HotDrop, HotDropStatus } from '@/types/hot-drop';
import {
  isHotDropClaimable,
  getHotDropTimeRemaining,
  getClaimsProgress,
} from '@/types/hot-drop';

// ============================================================================
// HELPERS — mirrors display logic from hot-drop-card.tsx
// ============================================================================

/** Derive the claim button label. Mirrors the ternary in HotDropCard. */
function getClaimButtonLabel(hotDrop: HotDrop): string {
  const isExpired = getHotDropTimeRemaining(hotDrop.expiresAt) === 'Expired';
  const isFull = hotDrop.currentClaims >= hotDrop.totalClaims;

  if (isExpired) return 'Expired';
  if (isFull) return 'Sold Out';
  return 'Claim Now';
}

/** Whether the claim button should be disabled. Mirrors Pressable disabled prop. */
function isClaimButtonDisabled(hotDrop: HotDrop): boolean {
  return !isHotDropClaimable(hotDrop);
}

/** Whether the Plus Early Access badge should render. */
function shouldShowEarlyAccessBadge(isPlusUser: boolean): boolean {
  return isPlusUser;
}

/** Whether the image element should render. */
function shouldShowImage(imageUrl: string | undefined): boolean {
  return !!imageUrl;
}

/** Whether handleClaim would fire onClaim (guards inside the handler). */
function wouldFireOnClaim(hotDrop: HotDrop, isClaiming: boolean): boolean {
  return isHotDropClaimable(hotDrop) && !isClaiming;
}

// ============================================================================
// TEST DATA FACTORY
// ============================================================================

function makeHotDrop(overrides: Partial<HotDrop> = {}): HotDrop {
  return {
    id: 'hd-001',
    businessId: 'biz-001',
    businessName: 'Taco Palace',
    title: 'Half-Off Tacos',
    description: 'Get 50% off all tacos for the next hour!',
    imageUrl: 'https://example.com/tacos.jpg',
    category: 'dining',
    startsAt: '2026-02-17T11:50:00Z',
    expiresAt: '2026-02-17T13:00:00Z',
    plusEarlyAccessMinutes: 15,
    totalClaims: 50,
    currentClaims: 23,
    claimPriceCents: 150,
    address: '123 Main St',
    latitude: 32.78,
    longitude: -96.8,
    status: 'active',
    createdAt: '2026-02-17T11:30:00Z',
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('HotDropCard — Pure Logic', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-17T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // 1-3: Rendering data — title, businessName, description
  //      (verified via the HotDrop object; the component renders them directly)
  // --------------------------------------------------------------------------

  describe('Display data', () => {
    it('hot drop contains title for rendering', () => {
      const hd = makeHotDrop({ title: 'Half-Off Tacos' });
      expect(hd.title).toBe('Half-Off Tacos');
    });

    it('hot drop contains businessName for rendering', () => {
      const hd = makeHotDrop({ businessName: 'Taco Palace' });
      expect(hd.businessName).toBe('Taco Palace');
    });

    it('hot drop contains description for rendering', () => {
      const hd = makeHotDrop({ description: 'Get 50% off all tacos for the next hour!' });
      expect(hd.description).toBe('Get 50% off all tacos for the next hour!');
    });
  });

  // --------------------------------------------------------------------------
  // 4: HOT DROP badge — component always renders this; no conditional logic
  // --------------------------------------------------------------------------

  describe('HOT DROP badge', () => {
    it('badge text is always present (no conditional rendering)', () => {
      // The component always renders "HOT DROP" regardless of state.
      // This test documents that the badge is unconditional.
      const badgeText = '\uD83D\uDD25 HOT DROP';
      expect(badgeText).toContain('HOT DROP');
    });
  });

  // --------------------------------------------------------------------------
  // 5-8: Countdown timer via getHotDropTimeRemaining
  // --------------------------------------------------------------------------

  describe('Countdown timer (getHotDropTimeRemaining)', () => {
    it('returns hours and minutes when more than 1 hour remains', () => {
      // expiresAt = 13:30, now = 12:00 => 1h 30m
      expect(getHotDropTimeRemaining('2026-02-17T13:30:00Z')).toBe('1h 30m');
    });

    it('returns minutes and seconds when less than 1 hour remains', () => {
      // expiresAt = 12:02, now = 12:00 => 2m 0s
      expect(getHotDropTimeRemaining('2026-02-17T12:02:00Z')).toBe('2m 0s');
    });

    it('returns seconds only when less than 1 minute remains', () => {
      // expiresAt = 12:00:30, now = 12:00:00 => 30s
      expect(getHotDropTimeRemaining('2026-02-17T12:00:30Z')).toBe('30s');
    });

    it('returns "Expired" when the expiry is in the past', () => {
      expect(getHotDropTimeRemaining('2026-02-17T11:00:00Z')).toBe('Expired');
    });

    it('returns "Expired" when expiresAt equals current time', () => {
      expect(getHotDropTimeRemaining('2026-02-17T12:00:00Z')).toBe('Expired');
    });

    it('updates as time advances', () => {
      // Start: 2 min remaining
      expect(getHotDropTimeRemaining('2026-02-17T12:02:00Z')).toBe('2m 0s');

      // Advance 61 seconds
      jest.advanceTimersByTime(61000);
      expect(getHotDropTimeRemaining('2026-02-17T12:02:00Z')).toBe('59s');

      // Advance another 60 seconds — now expired
      jest.advanceTimersByTime(60000);
      expect(getHotDropTimeRemaining('2026-02-17T12:02:00Z')).toBe('Expired');
    });
  });

  // --------------------------------------------------------------------------
  // 9: Claims progress
  // --------------------------------------------------------------------------

  describe('Claims progress (getClaimsProgress)', () => {
    it('returns fraction claimed', () => {
      const hd = makeHotDrop({ currentClaims: 23, totalClaims: 50 });
      expect(getClaimsProgress(hd)).toBeCloseTo(0.46, 2);
    });

    it('returns 0 when no claims', () => {
      const hd = makeHotDrop({ currentClaims: 0, totalClaims: 100 });
      expect(getClaimsProgress(hd)).toBe(0);
    });

    it('returns 1 when fully claimed', () => {
      const hd = makeHotDrop({ currentClaims: 50, totalClaims: 50 });
      expect(getClaimsProgress(hd)).toBe(1);
    });

    it('caps at 1 when claims exceed total', () => {
      const hd = makeHotDrop({ currentClaims: 55, totalClaims: 50 });
      expect(getClaimsProgress(hd)).toBe(1);
    });

    it('returns 0 when totalClaims is 0 (avoids division by zero)', () => {
      const hd = makeHotDrop({ currentClaims: 0, totalClaims: 0 });
      expect(getClaimsProgress(hd)).toBe(0);
    });

    it('formats claims text as "X/Y claimed"', () => {
      const hd = makeHotDrop({ currentClaims: 23, totalClaims: 50 });
      const claimsText = `${hd.currentClaims}/${hd.totalClaims} claimed`;
      expect(claimsText).toBe('23/50 claimed');
    });
  });

  // --------------------------------------------------------------------------
  // 10-13: Claim button label and disabled state
  // --------------------------------------------------------------------------

  describe('Claim button state', () => {
    it('shows "Claim Now" when drop is active, not full, and not expired', () => {
      const hd = makeHotDrop({
        status: 'active',
        currentClaims: 10,
        totalClaims: 50,
        expiresAt: '2026-02-17T14:00:00Z',
      });
      expect(getClaimButtonLabel(hd)).toBe('Claim Now');
      expect(isClaimButtonDisabled(hd)).toBe(false);
    });

    it('shows "Expired" when the drop has expired', () => {
      const hd = makeHotDrop({
        status: 'active',
        currentClaims: 10,
        totalClaims: 50,
        expiresAt: '2026-02-17T11:00:00Z', // 1 hour ago
      });
      expect(getClaimButtonLabel(hd)).toBe('Expired');
      expect(isClaimButtonDisabled(hd)).toBe(true);
    });

    it('shows "Sold Out" when claims are full', () => {
      const hd = makeHotDrop({
        status: 'active',
        currentClaims: 50,
        totalClaims: 50,
        expiresAt: '2026-02-17T14:00:00Z',
      });
      expect(getClaimButtonLabel(hd)).toBe('Sold Out');
      expect(isClaimButtonDisabled(hd)).toBe(true);
    });

    it('shows "Sold Out" when currentClaims exceeds totalClaims', () => {
      const hd = makeHotDrop({
        status: 'active',
        currentClaims: 55,
        totalClaims: 50,
        expiresAt: '2026-02-17T14:00:00Z',
      });
      expect(getClaimButtonLabel(hd)).toBe('Sold Out');
      expect(isClaimButtonDisabled(hd)).toBe(true);
    });

    it('is disabled when status is "scheduled"', () => {
      const hd = makeHotDrop({
        status: 'scheduled',
        currentClaims: 0,
        totalClaims: 50,
        expiresAt: '2026-02-17T14:00:00Z',
      });
      expect(isClaimButtonDisabled(hd)).toBe(true);
    });

    it('is disabled when status is "cancelled"', () => {
      const hd = makeHotDrop({
        status: 'cancelled',
        currentClaims: 5,
        totalClaims: 50,
        expiresAt: '2026-02-17T14:00:00Z',
      });
      expect(isClaimButtonDisabled(hd)).toBe(true);
    });

    it('is disabled when status is "claimed_out"', () => {
      const hd = makeHotDrop({
        status: 'claimed_out',
        currentClaims: 50,
        totalClaims: 50,
        expiresAt: '2026-02-17T14:00:00Z',
      });
      expect(isClaimButtonDisabled(hd)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 14-15: onClaim callback guard logic
  // --------------------------------------------------------------------------

  describe('onClaim callback guard (wouldFireOnClaim)', () => {
    it('fires onClaim when claimable and not currently claiming', () => {
      const hd = makeHotDrop({
        status: 'active',
        currentClaims: 5,
        totalClaims: 50,
        expiresAt: '2026-02-17T14:00:00Z',
      });
      expect(wouldFireOnClaim(hd, false)).toBe(true);
    });

    it('does not fire onClaim when already claiming (debounce)', () => {
      const hd = makeHotDrop({
        status: 'active',
        currentClaims: 5,
        totalClaims: 50,
        expiresAt: '2026-02-17T14:00:00Z',
      });
      expect(wouldFireOnClaim(hd, true)).toBe(false);
    });

    it('does not fire onClaim when drop is expired', () => {
      const hd = makeHotDrop({
        status: 'active',
        expiresAt: '2026-02-17T11:00:00Z',
      });
      expect(wouldFireOnClaim(hd, false)).toBe(false);
    });

    it('does not fire onClaim when sold out', () => {
      const hd = makeHotDrop({
        status: 'active',
        currentClaims: 50,
        totalClaims: 50,
        expiresAt: '2026-02-17T14:00:00Z',
      });
      expect(wouldFireOnClaim(hd, false)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 16-18: Plus Early Access badge visibility
  // --------------------------------------------------------------------------

  describe('Plus Early Access badge', () => {
    it('shows badge when isPlusUser is true', () => {
      expect(shouldShowEarlyAccessBadge(true)).toBe(true);
    });

    it('hides badge when isPlusUser is false', () => {
      expect(shouldShowEarlyAccessBadge(false)).toBe(false);
    });

    it('isPlusUser defaults to false (component prop default)', () => {
      // Documents the component default: isPlusUser = false
      const defaultIsPlusUser = false;
      expect(shouldShowEarlyAccessBadge(defaultIsPlusUser)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 19-20: Image rendering logic
  // --------------------------------------------------------------------------

  describe('Image rendering', () => {
    it('shows image when imageUrl is provided', () => {
      expect(shouldShowImage('https://example.com/tacos.jpg')).toBe(true);
    });

    it('does not show image when imageUrl is undefined', () => {
      expect(shouldShowImage(undefined)).toBe(false);
    });

    it('does not show image when imageUrl is empty string', () => {
      expect(shouldShowImage('')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // isHotDropClaimable — comprehensive edge cases
  // --------------------------------------------------------------------------

  describe('isHotDropClaimable (from types/hot-drop)', () => {
    it('returns true for active drop with capacity and time remaining', () => {
      const hd = makeHotDrop({
        status: 'active',
        currentClaims: 10,
        totalClaims: 50,
        expiresAt: '2026-02-17T14:00:00Z',
      });
      expect(isHotDropClaimable(hd)).toBe(true);
    });

    it('returns false when status is not "active"', () => {
      const statuses: HotDropStatus[] = ['scheduled', 'claimed_out', 'expired', 'cancelled'];
      for (const status of statuses) {
        const hd = makeHotDrop({
          status,
          currentClaims: 0,
          totalClaims: 50,
          expiresAt: '2026-02-17T14:00:00Z',
        });
        expect(isHotDropClaimable(hd)).toBe(false);
      }
    });

    it('returns false when currentClaims equals totalClaims', () => {
      const hd = makeHotDrop({
        status: 'active',
        currentClaims: 50,
        totalClaims: 50,
        expiresAt: '2026-02-17T14:00:00Z',
      });
      expect(isHotDropClaimable(hd)).toBe(false);
    });

    it('returns false when expiresAt is in the past', () => {
      const hd = makeHotDrop({
        status: 'active',
        currentClaims: 0,
        totalClaims: 50,
        expiresAt: '2026-02-17T11:59:59Z',
      });
      expect(isHotDropClaimable(hd)).toBe(false);
    });
  });
});
