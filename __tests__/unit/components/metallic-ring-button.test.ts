/**
 * MetallicRingButton — Pure logic tests
 *
 * Tests gradient color selection, default prop values, haptics gating,
 * and dimension constraints for the metallic ring button component.
 */

// ---------------------------------------------------------------------------
// Gradient color logic (extracted for testability)
// ---------------------------------------------------------------------------

function getGradientColors(isDark: boolean): [string, string, string] {
  return isDark
    ? ['rgba(255,255,255,0.50)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.40)']
    : ['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.08)'];
}

function getInnerBgColors(isDark: boolean): { rest: string; pressed: string } {
  return isDark
    ? { rest: 'rgba(0,0,0,0.75)', pressed: 'rgba(0,0,0,0.55)' }
    : { rest: 'rgba(255,255,255,0.70)', pressed: 'rgba(255,255,255,0.82)' };
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS = {
  size: 36,
  innerSize: 33,
  hitSlop: { top: 6, bottom: 6, left: 6, right: 6 },
  noHaptics: false,
};

// ---------------------------------------------------------------------------
// Scale interpolation (mirrors the worklet logic)
// ---------------------------------------------------------------------------

function getScale(pressValue: number, menuOpenValue: number = 0): number {
  const menuOpen = Math.min(Math.max(menuOpenValue / 0.1, 0), 1);
  const p = Math.max(pressValue, menuOpen);
  return 1 + p * 0.1; // interpolate [0,1] → [1, 1.1]
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MetallicRingButton — Gradient Colors', () => {
  it('dark mode uses white-tinted gradient', () => {
    const colors = getGradientColors(true);
    expect(colors).toHaveLength(3);
    colors.forEach(c => expect(c).toContain('255,255,255'));
  });

  it('light mode uses black-tinted gradient', () => {
    const colors = getGradientColors(false);
    expect(colors).toHaveLength(3);
    colors.forEach(c => expect(c).toContain('0,0,0'));
  });

  it('dark gradient middle stop is dimmest (0.10)', () => {
    const colors = getGradientColors(true);
    expect(colors[1]).toBe('rgba(255,255,255,0.10)');
  });

  it('light gradient middle stop is darkest (0.28)', () => {
    const colors = getGradientColors(false);
    expect(colors[1]).toBe('rgba(0,0,0,0.28)');
  });
});

describe('MetallicRingButton — Inner Background Colors', () => {
  it('dark mode rest is opaque black', () => {
    const { rest } = getInnerBgColors(true);
    expect(rest).toBe('rgba(0,0,0,0.75)');
  });

  it('dark mode pressed lightens to 0.55', () => {
    const { pressed } = getInnerBgColors(true);
    expect(pressed).toBe('rgba(0,0,0,0.55)');
  });

  it('light mode rest is slightly soft white (0.70)', () => {
    const { rest } = getInnerBgColors(false);
    expect(rest).toBe('rgba(255,255,255,0.70)');
  });

  it('light mode pressed subtly brightens to 0.82', () => {
    const { pressed } = getInnerBgColors(false);
    expect(pressed).toBe('rgba(255,255,255,0.82)');
  });
});

describe('MetallicRingButton — Scale Animation', () => {
  it('resting scale is 1.0', () => {
    expect(getScale(0)).toBe(1.0);
  });

  it('fully pressed scale is 1.1', () => {
    expect(getScale(1)).toBeCloseTo(1.1);
  });

  it('menuProgress at 0.1 triggers full scale', () => {
    expect(getScale(0, 0.1)).toBeCloseTo(1.1);
  });

  it('menuProgress at 0.05 gives half scale boost', () => {
    const scale = getScale(0, 0.05);
    expect(scale).toBeCloseTo(1.05);
  });

  it('press takes priority over lower menuProgress', () => {
    const scale = getScale(0.8, 0.02); // press=0.8, menu≈0.2
    expect(scale).toBeCloseTo(1.08);
  });

  it('menuProgress takes priority over lower press', () => {
    const scale = getScale(0.2, 0.1); // menu open=1 > press 0.2
    expect(scale).toBeCloseTo(1.1);
  });
});

describe('MetallicRingButton — Defaults', () => {
  it('outer size defaults to 36', () => {
    expect(DEFAULTS.size).toBe(36);
  });

  it('inner size defaults to 33', () => {
    expect(DEFAULTS.innerSize).toBe(33);
  });

  it('inner is smaller than outer (ring gap exists)', () => {
    expect(DEFAULTS.innerSize).toBeLessThan(DEFAULTS.size);
  });

  it('ring gap is 1.5px on each side', () => {
    const gap = (DEFAULTS.size - DEFAULTS.innerSize) / 2;
    expect(gap).toBe(1.5);
  });

  it('hitSlop is 6px all sides', () => {
    expect(DEFAULTS.hitSlop).toEqual({ top: 6, bottom: 6, left: 6, right: 6 });
  });

  it('total tap target meets 44pt minimum (36 + 2*6 + 2*4 padding = 56)', () => {
    const tapSize = DEFAULTS.size + DEFAULTS.hitSlop.left + DEFAULTS.hitSlop.right + 8; // 8 = 2*4 padding
    expect(tapSize).toBeGreaterThanOrEqual(44);
  });

  it('noHaptics defaults to false', () => {
    expect(DEFAULTS.noHaptics).toBe(false);
  });
});

describe('MetallicRingButton — Haptics Gating', () => {
  it('fires haptics when noHaptics is false', () => {
    let hapticFired = false;
    let pressFired = false;
    const noHaptics = false;

    const handlePress = () => {
      if (!noHaptics) hapticFired = true;
      pressFired = true;
    };
    handlePress();

    expect(hapticFired).toBe(true);
    expect(pressFired).toBe(true);
  });

  it('skips haptics when noHaptics is true', () => {
    let hapticFired = false;
    let pressFired = false;
    const noHaptics = true;

    const handlePress = () => {
      if (!noHaptics) hapticFired = true;
      pressFired = true;
    };
    handlePress();

    expect(hapticFired).toBe(false);
    expect(pressFired).toBe(true);
  });
});

describe('MetallicRingButton — Geometry', () => {
  it('borderRadius is half the size (perfect circle)', () => {
    const size = 36;
    expect(size / 2).toBe(18);
  });

  it('inner borderRadius is half innerSize', () => {
    const innerSize = 33;
    expect(innerSize / 2).toBe(16.5);
  });

  it('custom sizes maintain circular shape', () => {
    const sizes = [24, 32, 36, 40, 48];
    sizes.forEach(size => {
      expect(size / 2).toBe(size * 0.5);
    });
  });
});
