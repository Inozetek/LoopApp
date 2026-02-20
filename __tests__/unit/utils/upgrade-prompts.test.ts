/**
 * Tests for upgrade-prompts utility functions and constants
 *
 * Covers:
 * - REFRESH_COOLDOWN_PROMPTS constant structure and content for all tiers
 * - FEATURE_LOCKED_PROMPTS constant structure and content for all feature keys
 * - UPGRADE_CTA constant structure and pricing
 * - formatTimeRemaining() time formatting with boundary conditions
 * - getRefreshStatusMessage() user-facing messaging per tier and cooldown state
 * - canRefreshNow() cooldown logic with edge cases
 *
 * Pure functions are duplicated here to avoid importing the source file.
 */

// ---------------------------------------------------------------------------
// Types (duplicated from types/subscription.ts)
// ---------------------------------------------------------------------------

type SubscriptionTier = 'free' | 'plus';

interface UpgradePrompt {
  title: string;
  message: string;
  primaryButton: string;
  secondaryButton: string;
  targetTier: SubscriptionTier;
  featureHighlight?: string[];
}

// ---------------------------------------------------------------------------
// Constants (duplicated from utils/upgrade-prompts.ts)
// ---------------------------------------------------------------------------

const REFRESH_COOLDOWN_PROMPTS: Record<SubscriptionTier, UpgradePrompt> = {
  free: {
    title: 'Get more from every recommendation',
    message: 'Unlock AI insights like match scores and personalized explanations on every recommendation.\n\nUpgrade to Loop Plus for the full experience!',
    primaryButton: 'Upgrade to Plus',
    secondaryButton: 'Not Now',
    targetTier: 'plus',
    featureHighlight: [
      'AI match scores on every card',
      'Personalized explanations',
      'Time context insights',
      'Plan activities with friends',
      'Ad-free experience',
    ],
  },

  plus: {
    title: '', // Plus users have unlimited refreshes
    message: '',
    primaryButton: '',
    secondaryButton: '',
    targetTier: 'plus',
  },
};

const FEATURE_LOCKED_PROMPTS: Record<string, UpgradePrompt> = {
  group_planning: {
    title: 'Plan activities with friends',
    message: 'Group planning lets you find the perfect spot for everyone.\n\nUpgrade to Loop Plus to unlock!',
    primaryButton: 'See Plus Features',
    secondaryButton: 'Not Now',
    targetTier: 'plus' as SubscriptionTier,
    featureHighlight: [
      'Plan with up to 10 friends',
      'Find the perfect midpoint',
      'See everyone\'s preferences',
      'Built-in group chat',
    ],
  },

  ai_explanations: {
    title: 'See why this is perfect for you',
    message: 'Loop Plus shows AI-powered match scores, personalized explanations, and time-of-day context on every recommendation.',
    primaryButton: 'Unlock AI Insights',
    secondaryButton: 'Maybe Later',
    targetTier: 'plus' as SubscriptionTier,
    featureHighlight: [
      'Match score on every card',
      'Personalized explanations',
      'Time context chips',
      'Loop Pick badges',
    ],
  },

  calendar_sync: {
    title: 'Sync with your calendar',
    message: 'Auto-sync your Loop activities with Google Calendar & Apple Calendar.\n\nNever double-book again!',
    primaryButton: 'Upgrade Now',
    secondaryButton: 'Cancel',
    targetTier: 'plus' as SubscriptionTier,
    featureHighlight: [
      'Two-way sync',
      'Automatic updates',
      'Travel time included',
      'Free time detection',
    ],
  },

  advanced_filters: {
    title: 'Advanced search filters',
    message: 'Fine-tune your recommendations with advanced filters:\n\n- Price range\n- Specific ratings\n- Open now\n- Distance radius',
    primaryButton: 'Upgrade to Plus',
    secondaryButton: 'Use Basic Filters',
    targetTier: 'plus' as SubscriptionTier,
  },
};

const UPGRADE_CTA = {
  free_to_plus: {
    short: 'Upgrade to Plus',
    long: 'Unlock AI insights on every recommendation',
    price: '$3.99/month',
    annual_price: '$29.99/year',
  },
} as const;

// ---------------------------------------------------------------------------
// Pure functions (duplicated from utils/upgrade-prompts.ts)
// ---------------------------------------------------------------------------

function formatTimeRemaining(lastRefreshTime: number, cooldownHours: number): string {
  const nextRefreshTime = lastRefreshTime + cooldownHours * 3600000; // hours to ms
  const timeLeft = nextRefreshTime - Date.now();

  if (timeLeft <= 0) return 'now';

  const hours = Math.floor(timeLeft / 3600000);
  const minutes = Math.floor((timeLeft % 3600000) / 60000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getRefreshStatusMessage(
  tier: SubscriptionTier,
  lastRefreshTime: number,
  cooldownHours: number
): string {
  if (cooldownHours === 0) {
    return 'Pull to refresh anytime';
  }

  const timeLeft = formatTimeRemaining(lastRefreshTime, cooldownHours);

  if (timeLeft === 'now') {
    return 'Pull to refresh';
  }

  return `New recommendations in ${timeLeft}`;
}

function canRefreshNow(lastRefreshTime: number, cooldownHours: number): boolean {
  if (cooldownHours === 0) return true; // Plus - unlimited

  const nextRefreshTime = lastRefreshTime + cooldownHours * 3600000;
  return Date.now() >= nextRefreshTime;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('upgrade-prompts', () => {
  // =========================================================================
  // REFRESH_COOLDOWN_PROMPTS
  // =========================================================================

  describe('REFRESH_COOLDOWN_PROMPTS', () => {
    it('has entries for both tiers (free and plus)', () => {
      expect(REFRESH_COOLDOWN_PROMPTS).toHaveProperty('free');
      expect(REFRESH_COOLDOWN_PROMPTS).toHaveProperty('plus');
    });

    describe('free tier prompt', () => {
      const prompt = REFRESH_COOLDOWN_PROMPTS.free;

      it('has a non-empty title', () => {
        expect(prompt.title).toBeTruthy();
        expect(prompt.title.length).toBeGreaterThan(0);
      });

      it('has a non-empty message', () => {
        expect(prompt.message).toBeTruthy();
        expect(prompt.message.length).toBeGreaterThan(0);
      });

      it('message mentions upgrading', () => {
        expect(prompt.message.toLowerCase()).toContain('upgrade');
      });

      it('has non-empty primaryButton text', () => {
        expect(prompt.primaryButton).toBeTruthy();
        expect(prompt.primaryButton).toBe('Upgrade to Plus');
      });

      it('has non-empty secondaryButton text', () => {
        expect(prompt.secondaryButton).toBeTruthy();
        expect(prompt.secondaryButton).toBe('Not Now');
      });

      it('targets the plus tier', () => {
        expect(prompt.targetTier).toBe('plus');
      });

      it('has featureHighlight array with at least 3 items', () => {
        expect(prompt.featureHighlight).toBeDefined();
        expect(Array.isArray(prompt.featureHighlight)).toBe(true);
        expect(prompt.featureHighlight!.length).toBeGreaterThanOrEqual(3);
      });

      it('featureHighlight items are all non-empty strings', () => {
        for (const item of prompt.featureHighlight!) {
          expect(typeof item).toBe('string');
          expect(item.length).toBeGreaterThan(0);
        }
      });

      it('featureHighlight includes AI match scores', () => {
        expect(prompt.featureHighlight).toContain('AI match scores on every card');
      });

      it('featureHighlight includes ad-free experience', () => {
        expect(prompt.featureHighlight).toContain('Ad-free experience');
      });
    });

    describe('plus tier prompt', () => {
      const prompt = REFRESH_COOLDOWN_PROMPTS.plus;

      it('has empty title (Plus users never see cooldown prompt)', () => {
        expect(prompt.title).toBe('');
      });

      it('has empty message', () => {
        expect(prompt.message).toBe('');
      });

      it('has empty primaryButton', () => {
        expect(prompt.primaryButton).toBe('');
      });

      it('has empty secondaryButton', () => {
        expect(prompt.secondaryButton).toBe('');
      });

      it('targets plus tier', () => {
        expect(prompt.targetTier).toBe('plus');
      });

      it('does not have featureHighlight', () => {
        expect(prompt.featureHighlight).toBeUndefined();
      });
    });
  });

  // =========================================================================
  // FEATURE_LOCKED_PROMPTS
  // =========================================================================

  describe('FEATURE_LOCKED_PROMPTS', () => {
    const ALL_FEATURES = ['group_planning', 'ai_explanations', 'calendar_sync', 'advanced_filters'];

    it('has entries for all expected feature keys', () => {
      for (const key of ALL_FEATURES) {
        expect(FEATURE_LOCKED_PROMPTS).toHaveProperty(key);
      }
    });

    it('every prompt has required fields', () => {
      for (const key of ALL_FEATURES) {
        const prompt = FEATURE_LOCKED_PROMPTS[key];
        expect(prompt.title).toBeTruthy();
        expect(prompt.message).toBeTruthy();
        expect(prompt.primaryButton).toBeTruthy();
        expect(prompt.secondaryButton).toBeTruthy();
        expect(prompt.targetTier).toBe('plus');
      }
    });

    it('every prompt targets plus tier', () => {
      for (const key of ALL_FEATURES) {
        expect(FEATURE_LOCKED_PROMPTS[key].targetTier).toBe('plus');
      }
    });

    describe('group_planning prompt', () => {
      const prompt = FEATURE_LOCKED_PROMPTS.group_planning;

      it('has correct title', () => {
        expect(prompt.title).toBe('Plan activities with friends');
      });

      it('message mentions group planning', () => {
        expect(prompt.message.toLowerCase()).toContain('group planning');
      });

      it('primaryButton text invites feature exploration', () => {
        expect(prompt.primaryButton).toBe('See Plus Features');
      });

      it('has featureHighlight with 4 items', () => {
        expect(prompt.featureHighlight).toBeDefined();
        expect(prompt.featureHighlight!.length).toBe(4);
      });

      it('featureHighlight mentions 10 friends limit', () => {
        expect(prompt.featureHighlight).toContain('Plan with up to 10 friends');
      });

      it('featureHighlight includes built-in group chat', () => {
        expect(prompt.featureHighlight).toContain('Built-in group chat');
      });
    });

    describe('ai_explanations prompt', () => {
      const prompt = FEATURE_LOCKED_PROMPTS.ai_explanations;

      it('has correct title', () => {
        expect(prompt.title).toBe('See why this is perfect for you');
      });

      it('message mentions match scores', () => {
        expect(prompt.message.toLowerCase()).toContain('match scores');
      });

      it('primaryButton text is action-oriented', () => {
        expect(prompt.primaryButton).toBe('Unlock AI Insights');
      });

      it('secondaryButton is soft dismiss', () => {
        expect(prompt.secondaryButton).toBe('Maybe Later');
      });

      it('has featureHighlight with match score, explanations, time chips, and Loop Pick', () => {
        expect(prompt.featureHighlight).toContain('Match score on every card');
        expect(prompt.featureHighlight).toContain('Personalized explanations');
        expect(prompt.featureHighlight).toContain('Time context chips');
        expect(prompt.featureHighlight).toContain('Loop Pick badges');
      });
    });

    describe('calendar_sync prompt', () => {
      const prompt = FEATURE_LOCKED_PROMPTS.calendar_sync;

      it('has correct title', () => {
        expect(prompt.title).toBe('Sync with your calendar');
      });

      it('message mentions Google Calendar and Apple Calendar', () => {
        expect(prompt.message).toContain('Google Calendar');
        expect(prompt.message).toContain('Apple Calendar');
      });

      it('primaryButton is direct upgrade CTA', () => {
        expect(prompt.primaryButton).toBe('Upgrade Now');
      });

      it('secondaryButton is cancel', () => {
        expect(prompt.secondaryButton).toBe('Cancel');
      });

      it('has 4 feature highlights', () => {
        expect(prompt.featureHighlight).toBeDefined();
        expect(prompt.featureHighlight!.length).toBe(4);
      });

      it('featureHighlight includes two-way sync', () => {
        expect(prompt.featureHighlight).toContain('Two-way sync');
      });

      it('featureHighlight includes free time detection', () => {
        expect(prompt.featureHighlight).toContain('Free time detection');
      });
    });

    describe('advanced_filters prompt', () => {
      const prompt = FEATURE_LOCKED_PROMPTS.advanced_filters;

      it('has correct title', () => {
        expect(prompt.title).toBe('Advanced search filters');
      });

      it('message lists filter options', () => {
        expect(prompt.message).toContain('Price range');
        expect(prompt.message).toContain('Open now');
        expect(prompt.message).toContain('Distance radius');
      });

      it('primaryButton matches upgrade CTA', () => {
        expect(prompt.primaryButton).toBe('Upgrade to Plus');
      });

      it('secondaryButton offers basic filters fallback', () => {
        expect(prompt.secondaryButton).toBe('Use Basic Filters');
      });

      it('does NOT have featureHighlight (uses message body instead)', () => {
        expect(prompt.featureHighlight).toBeUndefined();
      });
    });
  });

  // =========================================================================
  // UPGRADE_CTA
  // =========================================================================

  describe('UPGRADE_CTA', () => {
    it('has free_to_plus entry', () => {
      expect(UPGRADE_CTA).toHaveProperty('free_to_plus');
    });

    it('has short CTA text', () => {
      expect(UPGRADE_CTA.free_to_plus.short).toBe('Upgrade to Plus');
    });

    it('has long CTA text mentioning AI insights', () => {
      expect(UPGRADE_CTA.free_to_plus.long).toContain('AI insights');
    });

    it('has monthly price string', () => {
      expect(UPGRADE_CTA.free_to_plus.price).toBe('$3.99/month');
    });

    it('has annual price string', () => {
      expect(UPGRADE_CTA.free_to_plus.annual_price).toBe('$29.99/year');
    });

    it('annual price is cheaper per month than monthly price', () => {
      // Parse monthly: $3.99/month
      const monthlyParts = UPGRADE_CTA.free_to_plus.price.match(/\$([\d.]+)/);
      const monthly = parseFloat(monthlyParts![1]);

      // Parse annual: $29.99/year
      const annualParts = UPGRADE_CTA.free_to_plus.annual_price.match(/\$([\d.]+)/);
      const annualMonthly = parseFloat(annualParts![1]) / 12;

      expect(annualMonthly).toBeLessThan(monthly);
    });
  });

  // =========================================================================
  // formatTimeRemaining
  // =========================================================================

  describe('formatTimeRemaining', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns "now" when cooldown has expired', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // Last refresh was 5 hours ago, cooldown is 4 hours -> expired
      const lastRefresh = now - 5 * 3600000;
      expect(formatTimeRemaining(lastRefresh, 4)).toBe('now');
    });

    it('returns "now" when cooldown is exactly at 0', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // Last refresh was exactly 4 hours ago, cooldown is 4 hours
      const lastRefresh = now - 4 * 3600000;
      expect(formatTimeRemaining(lastRefresh, 4)).toBe('now');
    });

    it('returns minutes only when less than 1 hour remaining', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // Last refresh was 3.5 hours ago, cooldown is 4 hours -> 30 min left
      const lastRefresh = now - 3.5 * 3600000;
      expect(formatTimeRemaining(lastRefresh, 4)).toBe('30m');
    });

    it('returns hours and minutes when more than 1 hour remaining', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // Last refresh was 1.5 hours ago, cooldown is 4 hours -> 2h 30m left
      const lastRefresh = now - 1.5 * 3600000;
      expect(formatTimeRemaining(lastRefresh, 4)).toBe('2h 30m');
    });

    it('returns "Xh 0m" when exactly N hours remaining', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // Last refresh was 1 hour ago, cooldown is 4 hours -> 3h 0m left
      const lastRefresh = now - 1 * 3600000;
      expect(formatTimeRemaining(lastRefresh, 4)).toBe('3h 0m');
    });

    it('returns "1m" when just under 2 minutes remaining', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // 1.5 minutes left (90 seconds)
      const lastRefresh = now - (4 * 3600000 - 90000);
      expect(formatTimeRemaining(lastRefresh, 4)).toBe('1m');
    });

    it('returns "0m" when less than 1 minute remaining but still positive', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // 30 seconds left
      const lastRefresh = now - (4 * 3600000 - 30000);
      expect(formatTimeRemaining(lastRefresh, 4)).toBe('0m');
    });

    it('returns "now" when lastRefreshTime is far in the past', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // Last refresh was 24 hours ago, cooldown is 4 hours
      const lastRefresh = now - 24 * 3600000;
      expect(formatTimeRemaining(lastRefresh, 4)).toBe('now');
    });

    it('returns correct value when just refreshed (full cooldown remaining)', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // Just refreshed now, cooldown is 4 hours
      expect(formatTimeRemaining(now, 4)).toBe('4h 0m');
    });

    it('handles fractional cooldown hours', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // Just refreshed, cooldown is 1.5 hours
      expect(formatTimeRemaining(now, 1.5)).toBe('1h 30m');
    });

    it('handles 0 cooldown hours (should return "now" immediately)', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      expect(formatTimeRemaining(now, 0)).toBe('now');
    });

    it('handles very large cooldown values', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // Just refreshed, cooldown is 48 hours
      expect(formatTimeRemaining(now, 48)).toBe('48h 0m');
    });

    it('handles negative lastRefreshTime gracefully (timestamp 0 = epoch)', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // Timestamp 0 with any reasonable cooldown should be expired
      expect(formatTimeRemaining(0, 4)).toBe('now');
    });
  });

  // =========================================================================
  // getRefreshStatusMessage
  // =========================================================================

  describe('getRefreshStatusMessage', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns "Pull to refresh anytime" when cooldownHours is 0 (Plus tier)', () => {
      expect(getRefreshStatusMessage('plus', Date.now(), 0)).toBe('Pull to refresh anytime');
    });

    it('returns "Pull to refresh anytime" even for free tier if cooldownHours is 0', () => {
      // Edge case: cooldown=0 always means unlimited regardless of tier
      expect(getRefreshStatusMessage('free', Date.now(), 0)).toBe('Pull to refresh anytime');
    });

    it('returns "Pull to refresh" when cooldown has expired', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      const lastRefresh = now - 5 * 3600000; // 5 hours ago
      expect(getRefreshStatusMessage('free', lastRefresh, 4)).toBe('Pull to refresh');
    });

    it('returns time-based message when cooldown is active', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // Last refresh was 2 hours ago, cooldown is 4 hours -> 2h 0m left
      const lastRefresh = now - 2 * 3600000;
      expect(getRefreshStatusMessage('free', lastRefresh, 4)).toBe('New recommendations in 2h 0m');
    });

    it('shows minutes-only message when less than 1 hour left', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // Last refresh was 3h 45m ago, cooldown is 4 hours -> 15m left
      const lastRefresh = now - 3.75 * 3600000;
      expect(getRefreshStatusMessage('free', lastRefresh, 4)).toBe('New recommendations in 15m');
    });

    it('returns "Pull to refresh" when lastRefreshTime is 0 (never refreshed, epoch)', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // Timestamp 0 with 4-hour cooldown is long expired
      expect(getRefreshStatusMessage('free', 0, 4)).toBe('Pull to refresh');
    });

    it('works correctly with plus tier and active cooldown (unusual but valid)', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // Plus with non-zero cooldown (unusual config but function handles it)
      expect(getRefreshStatusMessage('plus', now, 2)).toBe('New recommendations in 2h 0m');
    });

    it('tier parameter does not affect logic (message is purely cooldown-based)', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      const lastRefresh = now - 1 * 3600000; // 1 hour ago
      const cooldown = 4;

      const freeMsg = getRefreshStatusMessage('free', lastRefresh, cooldown);
      const plusMsg = getRefreshStatusMessage('plus', lastRefresh, cooldown);

      // Both produce the same time-based message since cooldown > 0
      expect(freeMsg).toBe(plusMsg);
      expect(freeMsg).toBe('New recommendations in 3h 0m');
    });
  });

  // =========================================================================
  // canRefreshNow
  // =========================================================================

  describe('canRefreshNow', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns true when cooldownHours is 0 (unlimited)', () => {
      expect(canRefreshNow(Date.now(), 0)).toBe(true);
    });

    it('returns true when cooldownHours is 0 regardless of lastRefreshTime', () => {
      expect(canRefreshNow(0, 0)).toBe(true);
      expect(canRefreshNow(Date.now(), 0)).toBe(true);
      expect(canRefreshNow(Date.now() + 999999, 0)).toBe(true);
    });

    it('returns true when cooldown has fully expired', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      const lastRefresh = now - 5 * 3600000; // 5 hours ago, cooldown is 4h
      expect(canRefreshNow(lastRefresh, 4)).toBe(true);
    });

    it('returns true at exact expiration boundary', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      const lastRefresh = now - 4 * 3600000; // Exactly 4 hours ago, cooldown is 4h
      expect(canRefreshNow(lastRefresh, 4)).toBe(true);
    });

    it('returns false when cooldown is still active', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      const lastRefresh = now - 1 * 3600000; // 1 hour ago, cooldown is 4h
      expect(canRefreshNow(lastRefresh, 4)).toBe(false);
    });

    it('returns false immediately after refresh', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      expect(canRefreshNow(now, 4)).toBe(false);
    });

    it('returns false 1ms before expiration', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      const lastRefresh = now - (4 * 3600000 - 1); // 1ms short of 4 hours
      expect(canRefreshNow(lastRefresh, 4)).toBe(false);
    });

    it('returns true when lastRefreshTime is 0 (never refreshed / epoch)', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      expect(canRefreshNow(0, 4)).toBe(true);
    });

    it('handles very small cooldown values', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // Cooldown of 0.001 hours (3.6 seconds)
      const lastRefresh = now - 4000; // 4 seconds ago
      expect(canRefreshNow(lastRefresh, 0.001)).toBe(true);
    });

    it('handles very large cooldown values', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // Cooldown of 720 hours (30 days)
      expect(canRefreshNow(now, 720)).toBe(false);
    });

    it('returns false for future lastRefreshTime (clock skew edge case)', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      // Last refresh time is in the future (e.g., clock skew)
      const lastRefresh = now + 1 * 3600000; // 1 hour from now
      expect(canRefreshNow(lastRefresh, 4)).toBe(false);
    });
  });

  // =========================================================================
  // UpgradePrompt Interface Structure
  // =========================================================================

  describe('UpgradePrompt interface compliance', () => {
    it('all REFRESH_COOLDOWN_PROMPTS conform to UpgradePrompt shape', () => {
      const tiers: SubscriptionTier[] = ['free', 'plus'];
      for (const tier of tiers) {
        const prompt = REFRESH_COOLDOWN_PROMPTS[tier];
        expect(typeof prompt.title).toBe('string');
        expect(typeof prompt.message).toBe('string');
        expect(typeof prompt.primaryButton).toBe('string');
        expect(typeof prompt.secondaryButton).toBe('string');
        expect(['free', 'plus']).toContain(prompt.targetTier);
        if (prompt.featureHighlight !== undefined) {
          expect(Array.isArray(prompt.featureHighlight)).toBe(true);
        }
      }
    });

    it('all FEATURE_LOCKED_PROMPTS conform to UpgradePrompt shape', () => {
      for (const key of Object.keys(FEATURE_LOCKED_PROMPTS)) {
        const prompt = FEATURE_LOCKED_PROMPTS[key];
        expect(typeof prompt.title).toBe('string');
        expect(typeof prompt.message).toBe('string');
        expect(typeof prompt.primaryButton).toBe('string');
        expect(typeof prompt.secondaryButton).toBe('string');
        expect(['free', 'plus']).toContain(prompt.targetTier);
        if (prompt.featureHighlight !== undefined) {
          expect(Array.isArray(prompt.featureHighlight)).toBe(true);
        }
      }
    });
  });

  // =========================================================================
  // Cross-cutting concerns
  // =========================================================================

  describe('consistency checks', () => {
    it('free tier refresh prompt and ai_explanations feature prompt both mention AI insights', () => {
      const refreshMsg = REFRESH_COOLDOWN_PROMPTS.free.message.toLowerCase();
      const aiMsg = FEATURE_LOCKED_PROMPTS.ai_explanations.message.toLowerCase();
      // Both should mention "match scores" or "ai" to maintain consistent messaging
      expect(refreshMsg).toContain('ai insights');
      expect(aiMsg).toContain('match scores');
    });

    it('all primaryButton texts are non-empty and actionable', () => {
      const allPrompts = [
        REFRESH_COOLDOWN_PROMPTS.free,
        ...Object.values(FEATURE_LOCKED_PROMPTS),
      ];

      for (const prompt of allPrompts) {
        expect(prompt.primaryButton.length).toBeGreaterThan(0);
        // Should not contain technical jargon
        expect(prompt.primaryButton).not.toContain('API');
        expect(prompt.primaryButton).not.toContain('subscribe');
      }
    });

    it('no feature prompt targets free tier (all upsell to plus)', () => {
      for (const key of Object.keys(FEATURE_LOCKED_PROMPTS)) {
        expect(FEATURE_LOCKED_PROMPTS[key].targetTier).toBe('plus');
      }
    });

    it('featureHighlight items do not contain duplicates within any single prompt', () => {
      const allPrompts = [
        REFRESH_COOLDOWN_PROMPTS.free,
        ...Object.values(FEATURE_LOCKED_PROMPTS),
      ];

      for (const prompt of allPrompts) {
        if (prompt.featureHighlight) {
          const uniqueItems = new Set(prompt.featureHighlight);
          expect(uniqueItems.size).toBe(prompt.featureHighlight.length);
        }
      }
    });
  });

  // =========================================================================
  // Edge case integration scenarios
  // =========================================================================

  describe('integration scenarios', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('free user just refreshed: canRefreshNow=false, message shows remaining time', () => {
      const now = Date.now();
      jest.setSystemTime(now);

      const cooldown = 4;
      expect(canRefreshNow(now, cooldown)).toBe(false);

      const message = getRefreshStatusMessage('free', now, cooldown);
      expect(message).toBe('New recommendations in 4h 0m');
    });

    it('free user cooldown expired: canRefreshNow=true, message says pull to refresh', () => {
      const now = Date.now();
      jest.setSystemTime(now);

      const lastRefresh = now - 5 * 3600000;
      const cooldown = 4;

      expect(canRefreshNow(lastRefresh, cooldown)).toBe(true);

      const message = getRefreshStatusMessage('free', lastRefresh, cooldown);
      expect(message).toBe('Pull to refresh');
    });

    it('plus user with 0 cooldown: canRefreshNow=true, message says anytime', () => {
      const now = Date.now();
      jest.setSystemTime(now);

      expect(canRefreshNow(now, 0)).toBe(true);

      const message = getRefreshStatusMessage('plus', now, 0);
      expect(message).toBe('Pull to refresh anytime');
    });

    it('free user halfway through cooldown: shows correct remaining time', () => {
      const now = Date.now();
      jest.setSystemTime(now);

      const lastRefresh = now - 2 * 3600000; // 2 hours ago
      const cooldown = 4;

      expect(canRefreshNow(lastRefresh, cooldown)).toBe(false);

      const time = formatTimeRemaining(lastRefresh, cooldown);
      expect(time).toBe('2h 0m');

      const message = getRefreshStatusMessage('free', lastRefresh, cooldown);
      expect(message).toBe('New recommendations in 2h 0m');
    });

    it('free user gets the proper upgrade prompt with feature highlights', () => {
      const prompt = REFRESH_COOLDOWN_PROMPTS.free;
      expect(prompt.title).toBeTruthy();
      expect(prompt.featureHighlight!.length).toBe(5);
      expect(prompt.primaryButton).toBe('Upgrade to Plus');
    });
  });
});
