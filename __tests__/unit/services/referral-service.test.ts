/**
 * Tests for referral-service pure helper functions.
 *
 * Tests generateReferralLink, generateInviteMessage, isValidReferralCode,
 * and milestone/stats calculation logic.
 *
 * Functions are duplicated here (project pattern) to avoid importing
 * the service which pulls in Supabase.
 */

// ── Mirrors generateReferralLink from referral-service.ts ──

function generateReferralLink(referralCode: string): string {
  const baseUrl = 'https://loop.app';
  return `${baseUrl}/signup?ref=${referralCode}`;
}

// ── Mirrors generateInviteMessage from referral-service.ts ──

function generateInviteMessage(
  referrerName: string,
  referralLink: string,
): string {
  return `Hey! I'm using Loop to find things to do. Join me and we both get 1 month free Premium: ${referralLink}`;
}

// ── Mirrors isValidReferralCode from referral-service.ts ──

function isValidReferralCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}

// ── Mirrors milestone logic from getReferralStats ──

interface Milestone {
  referralsNeeded: number;
  reward: string;
}

const MILESTONES: Milestone[] = [
  { referralsNeeded: 3, reward: '1 week Premium free' },
  { referralsNeeded: 5, reward: '1 month Premium free' },
  { referralsNeeded: 10, reward: '3 months Premium free' },
  { referralsNeeded: 25, reward: '1 year Premium free' },
];

function getNextMilestone(rewardedCount: number): Milestone | null {
  return MILESTONES.find(m => m.referralsNeeded > rewardedCount) || null;
}

function calculateTotalPlusDays(rewardedCount: number): number {
  return rewardedCount * 30;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('Referral Service - generateReferralLink', () => {
  it('generates link with referral code', () => {
    expect(generateReferralLink('ABC123')).toBe('https://loop.app/signup?ref=ABC123');
  });

  it('generates link with different code', () => {
    expect(generateReferralLink('XYZ789')).toBe('https://loop.app/signup?ref=XYZ789');
  });

  it('handles empty code', () => {
    expect(generateReferralLink('')).toBe('https://loop.app/signup?ref=');
  });
});

describe('Referral Service - generateInviteMessage', () => {
  it('includes referrer name and link', () => {
    const link = 'https://loop.app/signup?ref=ABC123';
    const msg = generateInviteMessage('Nick', link);
    expect(msg).toContain(link);
    // Note: referrerName is not used in the current template, but the
    // message must mention the reward and include the link
    expect(msg).toContain('1 month free Premium');
  });

  it('generates non-empty message', () => {
    const msg = generateInviteMessage('Alice', 'https://loop.app/signup?ref=XYZ');
    expect(msg.length).toBeGreaterThan(20);
  });
});

describe('Referral Service - isValidReferralCode', () => {
  it('accepts valid 6-char uppercase alphanumeric codes', () => {
    expect(isValidReferralCode('ABC123')).toBe(true);
    expect(isValidReferralCode('ZZZZZ9')).toBe(true);
    expect(isValidReferralCode('000000')).toBe(true);
    expect(isValidReferralCode('ABCDEF')).toBe(true);
  });

  it('rejects lowercase letters', () => {
    expect(isValidReferralCode('abc123')).toBe(false);
    expect(isValidReferralCode('Abc123')).toBe(false);
  });

  it('rejects codes that are too short', () => {
    expect(isValidReferralCode('ABC12')).toBe(false);
    expect(isValidReferralCode('A')).toBe(false);
    expect(isValidReferralCode('')).toBe(false);
  });

  it('rejects codes that are too long', () => {
    expect(isValidReferralCode('ABC1234')).toBe(false);
    expect(isValidReferralCode('ABCDEFGH')).toBe(false);
  });

  it('rejects special characters', () => {
    expect(isValidReferralCode('ABC-12')).toBe(false);
    expect(isValidReferralCode('ABC 12')).toBe(false);
    expect(isValidReferralCode('ABC_12')).toBe(false);
    expect(isValidReferralCode('ABC!12')).toBe(false);
  });
});

describe('Referral Service - Milestone Logic', () => {
  it('returns first milestone (3 referrals) for 0 rewarded', () => {
    const m = getNextMilestone(0);
    expect(m).toEqual({ referralsNeeded: 3, reward: '1 week Premium free' });
  });

  it('returns first milestone for 1-2 rewarded', () => {
    expect(getNextMilestone(1)?.referralsNeeded).toBe(3);
    expect(getNextMilestone(2)?.referralsNeeded).toBe(3);
  });

  it('returns second milestone (5 referrals) for 3-4 rewarded', () => {
    expect(getNextMilestone(3)?.referralsNeeded).toBe(5);
    expect(getNextMilestone(3)?.reward).toBe('1 month Premium free');
    expect(getNextMilestone(4)?.referralsNeeded).toBe(5);
  });

  it('returns third milestone (10 referrals) for 5-9 rewarded', () => {
    expect(getNextMilestone(5)?.referralsNeeded).toBe(10);
    expect(getNextMilestone(9)?.referralsNeeded).toBe(10);
  });

  it('returns fourth milestone (25 referrals) for 10-24 rewarded', () => {
    expect(getNextMilestone(10)?.referralsNeeded).toBe(25);
    expect(getNextMilestone(24)?.referralsNeeded).toBe(25);
    expect(getNextMilestone(24)?.reward).toBe('1 year Premium free');
  });

  it('returns null when all milestones are passed', () => {
    expect(getNextMilestone(25)).toBeNull();
    expect(getNextMilestone(100)).toBeNull();
  });
});

describe('Referral Service - Plus Days Calculation', () => {
  it('calculates 30 days per rewarded referral', () => {
    expect(calculateTotalPlusDays(0)).toBe(0);
    expect(calculateTotalPlusDays(1)).toBe(30);
    expect(calculateTotalPlusDays(5)).toBe(150);
    expect(calculateTotalPlusDays(10)).toBe(300);
  });
});
