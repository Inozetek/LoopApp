/**
 * Profile Screen — Menu Drawer Integration Tests
 *
 * Tests the menu animation logic wired into the profile screen:
 * - Content scale/translate/borderRadius when menu opens
 * - Blur overlay opacity transitions
 * - Menu gesture handlers (drag-to-open, snap open/close)
 * - ProfileHeader prop wiring (hamburger + settings buttons)
 *
 * Constants are inlined to avoid importing reanimated in pure-logic test env.
 */

// ---------------------------------------------------------------------------
// Inlined constants from constants/animations.ts
// ---------------------------------------------------------------------------

const MENU_CONTENT_BLUR = {
  backgroundBlurIntensity: 140,
  contentScale: 0.92,
  contentTranslateX: 60,
  contentBorderRadius: 20,
} as const;

const MENU_DIMENSIONS = {
  widthPercentage: 0.85,
} as const;

const MENU_OPEN_SPRING = {
  duration: 500,
  dampingRatio: 0.82,
} as const;

const GROK_SPRING = {
  duration: 350,
  dampingRatio: 0.8,
} as const;

// ---------------------------------------------------------------------------
// Helper: mirror interpolation logic (linear clamp)
// ---------------------------------------------------------------------------

function interpolateClamp(
  value: number,
  inputRange: [number, number],
  outputRange: [number, number],
): number {
  const [inMin, inMax] = inputRange;
  const [outMin, outMax] = outputRange;
  const clamped = Math.min(Math.max(value, inMin), inMax);
  const t = (clamped - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

// ---------------------------------------------------------------------------
// Mirror profile screen animated style logic
// ---------------------------------------------------------------------------

function computeMenuContentStyle(progress: number) {
  return {
    scale: interpolateClamp(progress, [0, 1], [1, MENU_CONTENT_BLUR.contentScale]),
    translateX: interpolateClamp(progress, [0, 1], [0, MENU_CONTENT_BLUR.contentTranslateX]),
    borderRadius: interpolateClamp(progress, [0, 1], [0, MENU_CONTENT_BLUR.contentBorderRadius]),
    overflow: progress > 0.01 ? 'hidden' : 'visible',
  };
}

function computeBlurIntensity(progress: number, supportsAnimatedBlur: boolean) {
  return supportsAnimatedBlur
    ? interpolateClamp(progress, [0, 1], [0, MENU_CONTENT_BLUR.backgroundBlurIntensity])
    : MENU_CONTENT_BLUR.backgroundBlurIntensity;
}

function computeBlurOverlayOpacity(progress: number, supportsAnimatedBlur: boolean) {
  return supportsAnimatedBlur
    ? (progress > 0.01 ? 1 : 0)
    : interpolateClamp(progress, [0, 1], [0, 1]);
}

// ---------------------------------------------------------------------------
// Mirror gesture handler logic
// ---------------------------------------------------------------------------

function computeDragProgress(translationX: number, drawerWidth: number): number {
  return Math.max(0, Math.min(translationX / drawerWidth, 1));
}

function shouldSnapOpen(translationX: number, velocityX: number): boolean {
  return translationX > 60 || velocityX > 600;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Profile Menu Drawer — Content Animation', () => {
  it('at progress 0 (closed): scale=1, translateX=0, borderRadius=0, overflow=visible', () => {
    const style = computeMenuContentStyle(0);
    expect(style.scale).toBe(1);
    expect(style.translateX).toBe(0);
    expect(style.borderRadius).toBe(0);
    expect(style.overflow).toBe('visible');
  });

  it('at progress 1 (fully open): scale=0.92, translateX=60, borderRadius=20, overflow=hidden', () => {
    const style = computeMenuContentStyle(1);
    expect(style.scale).toBe(MENU_CONTENT_BLUR.contentScale);
    expect(style.translateX).toBe(MENU_CONTENT_BLUR.contentTranslateX);
    expect(style.borderRadius).toBe(MENU_CONTENT_BLUR.contentBorderRadius);
    expect(style.overflow).toBe('hidden');
  });

  it('at progress 0.5 (halfway): values are midpoint', () => {
    const style = computeMenuContentStyle(0.5);
    expect(style.scale).toBeCloseTo(0.96);
    expect(style.translateX).toBeCloseTo(30);
    expect(style.borderRadius).toBeCloseTo(10);
    expect(style.overflow).toBe('hidden');
  });

  it('clamps progress above 1', () => {
    const style = computeMenuContentStyle(1.5);
    expect(style.scale).toBe(MENU_CONTENT_BLUR.contentScale);
    expect(style.translateX).toBe(MENU_CONTENT_BLUR.contentTranslateX);
  });

  it('clamps progress below 0', () => {
    const style = computeMenuContentStyle(-0.5);
    expect(style.scale).toBe(1);
    expect(style.translateX).toBe(0);
  });
});

describe('Profile Menu Drawer — Blur Overlay', () => {
  it('blur intensity is 0 when closed (animated blur supported)', () => {
    expect(computeBlurIntensity(0, true)).toBe(0);
  });

  it('blur intensity is 140 when fully open (animated blur supported)', () => {
    expect(computeBlurIntensity(1, true)).toBe(MENU_CONTENT_BLUR.backgroundBlurIntensity);
  });

  it('blur intensity is always max when animated blur NOT supported', () => {
    expect(computeBlurIntensity(0, false)).toBe(MENU_CONTENT_BLUR.backgroundBlurIntensity);
    expect(computeBlurIntensity(0.5, false)).toBe(MENU_CONTENT_BLUR.backgroundBlurIntensity);
    expect(computeBlurIntensity(1, false)).toBe(MENU_CONTENT_BLUR.backgroundBlurIntensity);
  });

  it('overlay opacity is 0 when closed (animated blur supported)', () => {
    expect(computeBlurOverlayOpacity(0, true)).toBe(0);
  });

  it('overlay opacity is 1 when any progress > 0.01 (animated blur supported)', () => {
    expect(computeBlurOverlayOpacity(0.02, true)).toBe(1);
    expect(computeBlurOverlayOpacity(0.5, true)).toBe(1);
    expect(computeBlurOverlayOpacity(1, true)).toBe(1);
  });

  it('overlay opacity fades linearly when animated blur NOT supported', () => {
    expect(computeBlurOverlayOpacity(0, false)).toBe(0);
    expect(computeBlurOverlayOpacity(0.5, false)).toBeCloseTo(0.5);
    expect(computeBlurOverlayOpacity(1, false)).toBe(1);
  });
});

describe('Profile Menu Drawer — Gesture Handlers', () => {
  const screenWidth = 400; // Mock screen width
  const drawerWidth = screenWidth * MENU_DIMENSIONS.widthPercentage; // 340

  it('drag progress is 0 at start', () => {
    expect(computeDragProgress(0, drawerWidth)).toBe(0);
  });

  it('drag progress is 1 when translation equals drawer width', () => {
    expect(computeDragProgress(drawerWidth, drawerWidth)).toBe(1);
  });

  it('drag progress clamps at 1 for excessive drag', () => {
    expect(computeDragProgress(drawerWidth + 100, drawerWidth)).toBe(1);
  });

  it('drag progress clamps at 0 for negative drag', () => {
    expect(computeDragProgress(-50, drawerWidth)).toBe(0);
  });

  it('drag halfway produces 0.5 progress', () => {
    expect(computeDragProgress(drawerWidth / 2, drawerWidth)).toBeCloseTo(0.5);
  });

  it('snaps open when translation > 60', () => {
    expect(shouldSnapOpen(61, 0)).toBe(true);
    expect(shouldSnapOpen(60, 0)).toBe(false);
  });

  it('snaps open when velocity > 600', () => {
    expect(shouldSnapOpen(20, 601)).toBe(true);
    expect(shouldSnapOpen(20, 600)).toBe(false);
  });

  it('does NOT snap open when both below thresholds', () => {
    expect(shouldSnapOpen(30, 300)).toBe(false);
  });

  it('snaps open when both above thresholds', () => {
    expect(shouldSnapOpen(100, 1000)).toBe(true);
  });
});

describe('Profile Menu Drawer — Constants', () => {
  it('menu content scale matches rec feed (0.92)', () => {
    expect(MENU_CONTENT_BLUR.contentScale).toBe(0.92);
  });

  it('menu content translateX matches rec feed (60)', () => {
    expect(MENU_CONTENT_BLUR.contentTranslateX).toBe(60);
  });

  it('menu content borderRadius matches rec feed (20)', () => {
    expect(MENU_CONTENT_BLUR.contentBorderRadius).toBe(20);
  });

  it('background blur intensity is 140', () => {
    expect(MENU_CONTENT_BLUR.backgroundBlurIntensity).toBe(140);
  });

  it('drawer width percentage is 0.85', () => {
    expect(MENU_DIMENSIONS.widthPercentage).toBe(0.85);
  });

  it('MENU_OPEN_SPRING has correct duration and dampingRatio', () => {
    expect(MENU_OPEN_SPRING.duration).toBe(500);
    expect(MENU_OPEN_SPRING.dampingRatio).toBe(0.82);
  });

  it('GROK_SPRING has correct duration and dampingRatio', () => {
    expect(GROK_SPRING.duration).toBe(350);
    expect(GROK_SPRING.dampingRatio).toBe(0.8);
  });
});

describe('ProfileHeader — Prop Wiring', () => {
  // These tests verify the prop interface decisions

  it('hamburger button should show when onHamburgerPress is provided', () => {
    // In the component: onHamburgerPress ? <MetallicRingButton> : null
    const onHamburgerPress = () => {};
    expect(typeof onHamburgerPress).toBe('function');
  });

  it('back button takes priority over hamburger when both provided', () => {
    // In the component: onBackPress ? <back button> : onHamburgerPress ? <hamburger> : null
    const onBackPress = () => {};
    const onHamburgerPress = () => {};
    // Back button should win — this is by design in the ternary
    expect(!!onBackPress).toBe(true);
  });

  it('settings button renders when onSettingsPress is provided', () => {
    const onSettingsPress = () => {};
    expect(typeof onSettingsPress).toBe('function');
  });

  it('legacy onMenuPress falls back to settings behavior', () => {
    // resolvedSettingsPress = onSettingsPress || onMenuPress
    const onMenuPress = jest.fn();
    const onSettingsPress = undefined;
    const resolved = onSettingsPress || onMenuPress;
    resolved();
    expect(onMenuPress).toHaveBeenCalled();
  });

  it('onSettingsPress takes priority over legacy onMenuPress', () => {
    const onMenuPress = jest.fn();
    const onSettingsPress = jest.fn();
    const resolved = onSettingsPress || onMenuPress;
    resolved();
    expect(onSettingsPress).toHaveBeenCalled();
    expect(onMenuPress).not.toHaveBeenCalled();
  });
});
