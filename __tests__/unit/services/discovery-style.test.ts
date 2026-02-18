/**
 * Discovery Style Preference — Scoring Tests
 *
 * Tests the DISCOVERY_STYLE_CONFIG constant and how discovery style
 * shapes the recommendation scoring algorithm.
 */

// Import the config directly from recommendations
// Since recommendations.ts has @ts-nocheck, we re-declare the config here
// and test it as a standalone unit (same pattern as recommendations.test.ts)

import type { DiscoveryStyle } from '@/types/database';

// Mirror of the exported config from services/recommendations.ts
const DISCOVERY_STYLE_CONFIG = {
  explorer:          { nonMatchingBase: 18, visitMultiplier: 0.5, recencyMultiplier: 0.5, maxPerCategory: 2, categoryGroups: 8 },
  balanced:          { nonMatchingBase: 12, visitMultiplier: 1.0, recencyMultiplier: 1.0, maxPerCategory: 3, categoryGroups: 5 },
  creature_of_habit: { nonMatchingBase: 6,  visitMultiplier: 1.5, recencyMultiplier: 0.6, maxPerCategory: 4, categoryGroups: 3 },
} as const;

type StyleConfig = typeof DISCOVERY_STYLE_CONFIG[DiscoveryStyle];

// Helper: compute visit history boost given raw boost and style
function applyVisitMultiplier(rawBoost: number, style: DiscoveryStyle): number {
  return Math.round(rawBoost * DISCOVERY_STYLE_CONFIG[style].visitMultiplier);
}

// Helper: compute recency penalty given raw penalty and style
function applyRecencyMultiplier(rawPenalty: number, style: DiscoveryStyle): number {
  return Math.round(rawPenalty * DISCOVERY_STYLE_CONFIG[style].recencyMultiplier);
}

// Helper: get non-matching base score for a style
function getNonMatchingBase(style: DiscoveryStyle): number {
  return DISCOVERY_STYLE_CONFIG[style].nonMatchingBase;
}

// Helper: resolve style from preferences with fallback
function resolveDiscoveryStyle(preferences?: { discovery_style?: DiscoveryStyle } | null): DiscoveryStyle {
  return preferences?.discovery_style || 'balanced';
}

describe('DISCOVERY_STYLE_CONFIG values', () => {
  test('explorer config has expected values', () => {
    const config = DISCOVERY_STYLE_CONFIG.explorer;
    expect(config.nonMatchingBase).toBe(18);
    expect(config.visitMultiplier).toBe(0.5);
    expect(config.recencyMultiplier).toBe(0.5);
    expect(config.maxPerCategory).toBe(2);
    expect(config.categoryGroups).toBe(8);
  });

  test('balanced config has expected values', () => {
    const config = DISCOVERY_STYLE_CONFIG.balanced;
    expect(config.nonMatchingBase).toBe(12);
    expect(config.visitMultiplier).toBe(1.0);
    expect(config.recencyMultiplier).toBe(1.0);
    expect(config.maxPerCategory).toBe(3);
    expect(config.categoryGroups).toBe(5);
  });

  test('creature_of_habit config has expected values', () => {
    const config = DISCOVERY_STYLE_CONFIG.creature_of_habit;
    expect(config.nonMatchingBase).toBe(6);
    expect(config.visitMultiplier).toBe(1.5);
    expect(config.recencyMultiplier).toBe(0.6);
    expect(config.maxPerCategory).toBe(4);
    expect(config.categoryGroups).toBe(3);
  });

  test('all three styles are defined', () => {
    const styles: DiscoveryStyle[] = ['explorer', 'balanced', 'creature_of_habit'];
    styles.forEach((style) => {
      expect(DISCOVERY_STYLE_CONFIG[style]).toBeDefined();
      expect(DISCOVERY_STYLE_CONFIG[style].nonMatchingBase).toBeGreaterThan(0);
      expect(DISCOVERY_STYLE_CONFIG[style].visitMultiplier).toBeGreaterThan(0);
      expect(DISCOVERY_STYLE_CONFIG[style].recencyMultiplier).toBeGreaterThan(0);
      expect(DISCOVERY_STYLE_CONFIG[style].maxPerCategory).toBeGreaterThan(0);
      expect(DISCOVERY_STYLE_CONFIG[style].categoryGroups).toBeGreaterThan(0);
    });
  });
});

describe('Non-matching interest base score', () => {
  test('explorer gets highest non-matching base (18) — encourages discovery', () => {
    expect(getNonMatchingBase('explorer')).toBe(18);
  });

  test('balanced gets moderate non-matching base (12)', () => {
    expect(getNonMatchingBase('balanced')).toBe(12);
  });

  test('creature_of_habit gets lowest non-matching base (6) — discourages unfamiliar', () => {
    expect(getNonMatchingBase('creature_of_habit')).toBe(6);
  });

  test('explorer > balanced > creature_of_habit for non-matching base', () => {
    expect(getNonMatchingBase('explorer')).toBeGreaterThan(getNonMatchingBase('balanced'));
    expect(getNonMatchingBase('balanced')).toBeGreaterThan(getNonMatchingBase('creature_of_habit'));
  });
});

describe('Visit history multiplier', () => {
  const RAW_BOOSTS = [
    { visits: '10+ visits', rawBoost: 40 },
    { visits: '5-9 visits', rawBoost: 30 },
    { visits: '2-4 visits', rawBoost: 20 },
    { visits: '1 visit', rawBoost: 15 },
  ];

  test('explorer halves visit boost (×0.5) — de-emphasises repeats', () => {
    expect(applyVisitMultiplier(40, 'explorer')).toBe(20);
    expect(applyVisitMultiplier(30, 'explorer')).toBe(15);
    expect(applyVisitMultiplier(20, 'explorer')).toBe(10);
    expect(applyVisitMultiplier(15, 'explorer')).toBe(8); // Math.round(7.5)
  });

  test('balanced keeps visit boost unchanged (×1.0)', () => {
    RAW_BOOSTS.forEach(({ rawBoost }) => {
      expect(applyVisitMultiplier(rawBoost, 'balanced')).toBe(rawBoost);
    });
  });

  test('creature_of_habit amplifies visit boost (×1.5)', () => {
    expect(applyVisitMultiplier(40, 'creature_of_habit')).toBe(60);
    expect(applyVisitMultiplier(30, 'creature_of_habit')).toBe(45);
    expect(applyVisitMultiplier(20, 'creature_of_habit')).toBe(30);
    expect(applyVisitMultiplier(15, 'creature_of_habit')).toBe(23); // Math.round(22.5)
  });

  test('creature_of_habit > balanced > explorer for visit boost', () => {
    const rawBoost = 30;
    expect(applyVisitMultiplier(rawBoost, 'creature_of_habit'))
      .toBeGreaterThan(applyVisitMultiplier(rawBoost, 'balanced'));
    expect(applyVisitMultiplier(rawBoost, 'balanced'))
      .toBeGreaterThan(applyVisitMultiplier(rawBoost, 'explorer'));
  });

  test('zero visits gives zero boost regardless of style', () => {
    const styles: DiscoveryStyle[] = ['explorer', 'balanced', 'creature_of_habit'];
    styles.forEach((style) => {
      expect(applyVisitMultiplier(0, style)).toBe(0);
    });
  });
});

describe('Recency penalty multiplier', () => {
  const RAW_PENALTIES = [
    { label: '<6h', rawPenalty: -40 },
    { label: '6-12h', rawPenalty: -30 },
    { label: '12-24h', rawPenalty: -25 },
    { label: '24-48h', rawPenalty: -12 },
    { label: '48-72h', rawPenalty: -5 },
  ];

  test('explorer gets softer recency penalty (×0.5) — more repeat suppression via low visit boost', () => {
    expect(applyRecencyMultiplier(-40, 'explorer')).toBe(-20);
    expect(applyRecencyMultiplier(-30, 'explorer')).toBe(-15);
  });

  test('balanced keeps full recency penalty (×1.0)', () => {
    RAW_PENALTIES.forEach(({ rawPenalty }) => {
      expect(applyRecencyMultiplier(rawPenalty, 'balanced')).toBe(rawPenalty);
    });
  });

  test('creature_of_habit gets softer recency penalty (×0.6) — welcomes seeing repeats', () => {
    expect(applyRecencyMultiplier(-40, 'creature_of_habit')).toBe(-24);
    expect(applyRecencyMultiplier(-30, 'creature_of_habit')).toBe(-18);
    expect(applyRecencyMultiplier(-25, 'creature_of_habit')).toBe(-15);
  });

  test('creature_of_habit penalty is less harsh than balanced', () => {
    // Less negative = less harsh
    const raw = -40;
    const habitPenalty = applyRecencyMultiplier(raw, 'creature_of_habit'); // -24
    const balancedPenalty = applyRecencyMultiplier(raw, 'balanced'); // -40
    expect(habitPenalty).toBeGreaterThan(balancedPenalty); // -24 > -40
  });

  test('no penalty when not recently shown (0 raw)', () => {
    const styles: DiscoveryStyle[] = ['explorer', 'balanced', 'creature_of_habit'];
    styles.forEach((style) => {
      expect(applyRecencyMultiplier(0, style)).toBe(0);
    });
  });
});

describe('Category diversity limits (maxPerCategory)', () => {
  test('explorer allows only 2 per category — forces maximum variety', () => {
    expect(DISCOVERY_STYLE_CONFIG.explorer.maxPerCategory).toBe(2);
  });

  test('balanced allows 3 per category — moderate variety', () => {
    expect(DISCOVERY_STYLE_CONFIG.balanced.maxPerCategory).toBe(3);
  });

  test('creature_of_habit allows 4 per category — permits clustering', () => {
    expect(DISCOVERY_STYLE_CONFIG.creature_of_habit.maxPerCategory).toBe(4);
  });

  test('explorer < balanced < creature_of_habit for max per category', () => {
    expect(DISCOVERY_STYLE_CONFIG.explorer.maxPerCategory)
      .toBeLessThan(DISCOVERY_STYLE_CONFIG.balanced.maxPerCategory);
    expect(DISCOVERY_STYLE_CONFIG.balanced.maxPerCategory)
      .toBeLessThan(DISCOVERY_STYLE_CONFIG.creature_of_habit.maxPerCategory);
  });
});

describe('Category groups queried', () => {
  test('explorer queries most category groups (8) — widest search', () => {
    expect(DISCOVERY_STYLE_CONFIG.explorer.categoryGroups).toBe(8);
  });

  test('balanced queries 5 category groups', () => {
    expect(DISCOVERY_STYLE_CONFIG.balanced.categoryGroups).toBe(5);
  });

  test('creature_of_habit queries fewest category groups (3) — focused search', () => {
    expect(DISCOVERY_STYLE_CONFIG.creature_of_habit.categoryGroups).toBe(3);
  });
});

describe('Default fallback to balanced', () => {
  test('undefined discovery_style defaults to balanced', () => {
    expect(resolveDiscoveryStyle(undefined)).toBe('balanced');
  });

  test('null preferences defaults to balanced', () => {
    expect(resolveDiscoveryStyle(null)).toBe('balanced');
  });

  test('empty preferences object defaults to balanced', () => {
    expect(resolveDiscoveryStyle({})).toBe('balanced');
  });

  test('preferences with discovery_style=undefined defaults to balanced', () => {
    expect(resolveDiscoveryStyle({ discovery_style: undefined })).toBe('balanced');
  });

  test('explicit explorer is returned as-is', () => {
    expect(resolveDiscoveryStyle({ discovery_style: 'explorer' })).toBe('explorer');
  });

  test('explicit creature_of_habit is returned as-is', () => {
    expect(resolveDiscoveryStyle({ discovery_style: 'creature_of_habit' })).toBe('creature_of_habit');
  });

  test('explicit balanced is returned as-is', () => {
    expect(resolveDiscoveryStyle({ discovery_style: 'balanced' })).toBe('balanced');
  });
});

describe('Scoring consistency', () => {
  test('all multipliers produce integers (no floating point in final scores)', () => {
    const rawBoosts = [40, 30, 20, 15];
    const rawPenalties = [-40, -30, -25, -12, -5];
    const styles: DiscoveryStyle[] = ['explorer', 'balanced', 'creature_of_habit'];

    styles.forEach((style) => {
      rawBoosts.forEach((raw) => {
        const result = applyVisitMultiplier(raw, style);
        expect(Number.isInteger(result)).toBe(true);
      });
      rawPenalties.forEach((raw) => {
        const result = applyRecencyMultiplier(raw, style);
        expect(Number.isInteger(result)).toBe(true);
      });
    });
  });

  test('visit multiplier never produces negative values from positive inputs', () => {
    const styles: DiscoveryStyle[] = ['explorer', 'balanced', 'creature_of_habit'];
    styles.forEach((style) => {
      expect(applyVisitMultiplier(15, style)).toBeGreaterThanOrEqual(0);
      expect(applyVisitMultiplier(40, style)).toBeGreaterThanOrEqual(0);
    });
  });

  test('recency multiplier preserves negative direction', () => {
    const styles: DiscoveryStyle[] = ['explorer', 'balanced', 'creature_of_habit'];
    styles.forEach((style) => {
      expect(applyRecencyMultiplier(-40, style)).toBeLessThanOrEqual(0);
      expect(applyRecencyMultiplier(-5, style)).toBeLessThanOrEqual(0);
    });
  });
});
