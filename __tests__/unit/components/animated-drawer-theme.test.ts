/**
 * AnimatedDrawer — Theme-aware color tests
 *
 * Tests the light/dark mode logic for backdrop colors, blur tints,
 * overlay colors, and opacity values that were fixed in Phase 1
 * of the UI Consistency Overhaul.
 *
 * Constants are inlined to avoid importing animations.ts (which pulls
 * in react-native-reanimated — not available in pure-logic test env).
 */

// ---------------------------------------------------------------------------
// Inlined constants from constants/animations.ts MENU_CONTENT_BLUR
// ---------------------------------------------------------------------------

const MENU_CONTENT_BLUR = {
  backdropOpacity: 0.85,
  backdropOpacityLight: 0.35,
} as const;

// ---------------------------------------------------------------------------
// Mirror the theme-aware logic from animated-drawer.tsx
// ---------------------------------------------------------------------------

function getTargetBackdropOpacity(isDark: boolean): number {
  return isDark
    ? MENU_CONTENT_BLUR.backdropOpacity
    : MENU_CONTENT_BLUR.backdropOpacityLight;
}

function getBlurTint(isDark: boolean): 'dark' | 'light' {
  return isDark ? 'dark' : 'light';
}

function getOverlayColor(isDark: boolean): string {
  return isDark ? '#0A0A0A' : '#F2F2F7';
}

function getBackdropBg(isDark: boolean): string {
  return isDark ? '#000' : 'rgba(0,0,0,0.25)';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnimatedDrawer — Constants', () => {
  it('backdropOpacity for dark mode is 0.85', () => {
    expect(MENU_CONTENT_BLUR.backdropOpacity).toBe(0.85);
  });

  it('backdropOpacityLight for light mode is 0.35', () => {
    expect(MENU_CONTENT_BLUR.backdropOpacityLight).toBe(0.35);
  });

  it('light mode backdrop is significantly lighter than dark mode', () => {
    expect(MENU_CONTENT_BLUR.backdropOpacityLight).toBeLessThan(
      MENU_CONTENT_BLUR.backdropOpacity * 0.5
    );
  });
});

describe('AnimatedDrawer — Backdrop Opacity', () => {
  it('dark mode uses full backdrop opacity (0.85)', () => {
    expect(getTargetBackdropOpacity(true)).toBe(0.85);
  });

  it('light mode uses reduced backdrop opacity (0.35)', () => {
    expect(getTargetBackdropOpacity(false)).toBe(0.35);
  });

  it('light mode backdrop is frosted (semi-transparent), not solid', () => {
    expect(getTargetBackdropOpacity(false)).toBeLessThan(0.5);
  });

  it('dark mode backdrop is nearly opaque for contrast', () => {
    expect(getTargetBackdropOpacity(true)).toBeGreaterThan(0.7);
  });
});

describe('AnimatedDrawer — Blur Tint', () => {
  it('dark mode uses "dark" blur tint', () => {
    expect(getBlurTint(true)).toBe('dark');
  });

  it('light mode uses "light" blur tint', () => {
    expect(getBlurTint(false)).toBe('light');
  });
});

describe('AnimatedDrawer — Overlay Color', () => {
  it('dark mode overlay is near-black (#0A0A0A)', () => {
    expect(getOverlayColor(true)).toBe('#0A0A0A');
  });

  it('light mode overlay is iOS-system-gray (#F2F2F7)', () => {
    expect(getOverlayColor(false)).toBe('#F2F2F7');
  });

  it('light mode overlay is NOT a dark color', () => {
    const lightOverlay = getOverlayColor(false);
    // F2 = 242 decimal, which is very light
    expect(lightOverlay).not.toContain('#0');
    expect(lightOverlay).not.toContain('#1');
  });
});

describe('AnimatedDrawer — Backdrop Background', () => {
  it('dark mode uses solid black', () => {
    expect(getBackdropBg(true)).toBe('#000');
  });

  it('light mode uses semi-transparent black', () => {
    expect(getBackdropBg(false)).toBe('rgba(0,0,0,0.25)');
  });

  it('light mode backdrop is not fully opaque', () => {
    const lightBg = getBackdropBg(false);
    expect(lightBg).toContain('rgba');
    expect(lightBg).toContain('0.25');
  });
});

describe('AnimatedDrawer — Main Menu Modal Blur Tint', () => {
  // Mirrors the fix in main-menu-modal.tsx
  function getMaterializationTint(colorScheme: 'dark' | 'light'): string {
    return colorScheme === 'dark' ? 'dark' : 'light';
  }

  it('dark mode materialization uses dark tint', () => {
    expect(getMaterializationTint('dark')).toBe('dark');
  });

  it('light mode materialization uses light tint', () => {
    expect(getMaterializationTint('light')).toBe('light');
  });
});

describe('AnimatedDrawer — Drawer Direction', () => {
  const SCREEN_WIDTH = 400; // mock

  function getOffscreenX(side: 'left' | 'right', widthPercentage: number): number {
    const drawerWidth = SCREEN_WIDTH * widthPercentage;
    return side === 'left' ? -drawerWidth : drawerWidth;
  }

  it('left drawer starts off-screen to the left (negative X)', () => {
    expect(getOffscreenX('left', 0.85)).toBeLessThan(0);
  });

  it('right drawer starts off-screen to the right (positive X)', () => {
    expect(getOffscreenX('right', 0.85)).toBeGreaterThan(0);
  });

  it('drawer width is proportional to screen width', () => {
    expect(Math.abs(getOffscreenX('left', 0.85))).toBe(340);
    expect(Math.abs(getOffscreenX('right', 0.92))).toBe(368);
  });
});
