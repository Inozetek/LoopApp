/**
 * Tests for glass bottom sheet animation constants
 *
 * Validates the animation configuration values used by
 * SeeDetailsModal and DailyDashboardModal for frosted glass effects.
 *
 * Constants are duplicated here to avoid importing from animations.ts
 * which pulls in react-native-reanimated (not available in node test env).
 */

/**
 * Mirrors MENU_CONTENT_BLUR from constants/animations.ts
 */
const MENU_CONTENT_BLUR = {
  backgroundBlurIntensity: 140,
  menuMaterializeBlur: 70,
  contentScale: 0.92,
  contentTranslateX: 60,
  contentBorderRadius: 20,
  backdropOpacity: 0.85,
  drawerBlurIntensity: 120,
  drawerMinOpacity: 0.55,
  drawerMaxOpacity: 0.97,
} as const;

/**
 * Mirrors BOTTOM_SHEET_BLUR from constants/animations.ts
 */
const BOTTOM_SHEET_BLUR = {
  backdropIntensityIOS: 25,
  backdropIntensityAndroid: 35,
  backdropOverlayOpacity: 0.25,
  sheetInitialScale: 0.97,
} as const;

/**
 * Mirrors MENU_OPEN_SPRING from constants/animations.ts
 */
const MENU_OPEN_SPRING = {
  duration: 500,
  dampingRatio: 0.82,
} as const;

describe('Glass Bottom Sheet - Animation Constants', () => {
  describe('MENU_CONTENT_BLUR', () => {
    it('has strong background blur intensity (100-180)', () => {
      expect(MENU_CONTENT_BLUR.backgroundBlurIntensity).toBeGreaterThanOrEqual(100);
      expect(MENU_CONTENT_BLUR.backgroundBlurIntensity).toBeLessThanOrEqual(180);
    });

    it('has materialization blur that starts > 0', () => {
      expect(MENU_CONTENT_BLUR.menuMaterializeBlur).toBeGreaterThan(0);
      expect(MENU_CONTENT_BLUR.menuMaterializeBlur).toBeLessThanOrEqual(100);
    });

    it('scales content down modestly (0.85-0.99)', () => {
      expect(MENU_CONTENT_BLUR.contentScale).toBeGreaterThanOrEqual(0.85);
      expect(MENU_CONTENT_BLUR.contentScale).toBeLessThan(1);
    });

    it('shifts content right with positive translateX', () => {
      expect(MENU_CONTENT_BLUR.contentTranslateX).toBeGreaterThan(0);
      expect(MENU_CONTENT_BLUR.contentTranslateX).toBeLessThanOrEqual(100);
    });

    it('has reasonable border radius (10-30)', () => {
      expect(MENU_CONTENT_BLUR.contentBorderRadius).toBeGreaterThanOrEqual(10);
      expect(MENU_CONTENT_BLUR.contentBorderRadius).toBeLessThanOrEqual(30);
    });

    it('has strong backdrop opacity for solid black background behind drawer', () => {
      expect(MENU_CONTENT_BLUR.backdropOpacity).toBeGreaterThanOrEqual(0.7);
      expect(MENU_CONTENT_BLUR.backdropOpacity).toBeLessThanOrEqual(1);
    });
  });

  describe('MENU_CONTENT_BLUR - drawer blur constants', () => {
    it('has drawer blur intensity in reasonable range (80-160)', () => {
      expect(MENU_CONTENT_BLUR.drawerBlurIntensity).toBeGreaterThanOrEqual(80);
      expect(MENU_CONTENT_BLUR.drawerBlurIntensity).toBeLessThanOrEqual(160);
    });

    it('has drawerMinOpacity less than drawerMaxOpacity', () => {
      expect(MENU_CONTENT_BLUR.drawerMinOpacity).toBeLessThan(MENU_CONTENT_BLUR.drawerMaxOpacity);
    });

    it('has drawerMinOpacity in valid range (0-1)', () => {
      expect(MENU_CONTENT_BLUR.drawerMinOpacity).toBeGreaterThanOrEqual(0);
      expect(MENU_CONTENT_BLUR.drawerMinOpacity).toBeLessThanOrEqual(1);
    });

    it('has drawerMaxOpacity in valid range (0-1)', () => {
      expect(MENU_CONTENT_BLUR.drawerMaxOpacity).toBeGreaterThanOrEqual(0);
      expect(MENU_CONTENT_BLUR.drawerMaxOpacity).toBeLessThanOrEqual(1);
    });

    it('drawerMaxOpacity is close to backdrop opacity for visual consistency', () => {
      // Both should be in a similar high-opacity range
      expect(Math.abs(MENU_CONTENT_BLUR.drawerMaxOpacity - MENU_CONTENT_BLUR.backdropOpacity)).toBeLessThan(0.15);
    });
  });

  describe('MENU_OPEN_SPRING', () => {
    it('is slower than standard GROK_SPRING (350ms)', () => {
      expect(MENU_OPEN_SPRING.duration).toBeGreaterThan(350);
    });

    it('has a reasonable damping ratio (0.7-0.95)', () => {
      expect(MENU_OPEN_SPRING.dampingRatio).toBeGreaterThanOrEqual(0.7);
      expect(MENU_OPEN_SPRING.dampingRatio).toBeLessThanOrEqual(0.95);
    });

    it('has premium, deliberate feel (duration >= 450ms)', () => {
      expect(MENU_OPEN_SPRING.duration).toBeGreaterThanOrEqual(450);
    });
  });

  describe('BOTTOM_SHEET_BLUR', () => {
    it('has iOS backdrop blur intensity in valid range', () => {
      expect(BOTTOM_SHEET_BLUR.backdropIntensityIOS).toBeGreaterThan(0);
      expect(BOTTOM_SHEET_BLUR.backdropIntensityIOS).toBeLessThanOrEqual(50);
    });

    it('has Android blur >= iOS (to compensate for weaker blur)', () => {
      expect(BOTTOM_SHEET_BLUR.backdropIntensityAndroid).toBeGreaterThanOrEqual(
        BOTTOM_SHEET_BLUR.backdropIntensityIOS
      );
    });

    it('has semi-transparent overlay (0 < opacity < 1)', () => {
      expect(BOTTOM_SHEET_BLUR.backdropOverlayOpacity).toBeGreaterThan(0);
      expect(BOTTOM_SHEET_BLUR.backdropOverlayOpacity).toBeLessThan(1);
    });

    it('has initial scale < 1 for materialization pop-in', () => {
      expect(BOTTOM_SHEET_BLUR.sheetInitialScale).toBeLessThan(1);
      expect(BOTTOM_SHEET_BLUR.sheetInitialScale).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('Menu transition math', () => {
    /**
     * Mirrors the interpolation logic used in index.tsx menuContentStyle:
     *   scale: interpolate(progress, [0, 1], [1, contentScale])
     *   translateX: interpolate(progress, [0, 1], [0, contentTranslateX])
     *   borderRadius: interpolate(progress, [0, 1], [0, contentBorderRadius])
     */
    function interpolate(progress: number, from: number, to: number): number {
      const clamped = Math.max(0, Math.min(1, progress));
      return from + (to - from) * clamped;
    }

    it('content scale is 1 when menu is closed (progress=0)', () => {
      const scale = interpolate(0, 1, MENU_CONTENT_BLUR.contentScale);
      expect(scale).toBe(1);
    });

    it('content scale is 0.92 when menu is fully open (progress=1)', () => {
      const scale = interpolate(1, 1, MENU_CONTENT_BLUR.contentScale);
      expect(scale).toBe(MENU_CONTENT_BLUR.contentScale);
    });

    it('translateX is 0 when closed, 60 when open', () => {
      expect(interpolate(0, 0, MENU_CONTENT_BLUR.contentTranslateX)).toBe(0);
      expect(interpolate(1, 0, MENU_CONTENT_BLUR.contentTranslateX)).toBe(60);
    });

    it('border radius is 0 when closed, 20 when open', () => {
      expect(interpolate(0, 0, MENU_CONTENT_BLUR.contentBorderRadius)).toBe(0);
      expect(interpolate(1, 0, MENU_CONTENT_BLUR.contentBorderRadius)).toBe(20);
    });

    it('half-open state produces proportional values', () => {
      const halfScale = interpolate(0.5, 1, MENU_CONTENT_BLUR.contentScale);
      expect(halfScale).toBeCloseTo(0.96, 2);

      const halfTranslate = interpolate(0.5, 0, MENU_CONTENT_BLUR.contentTranslateX);
      expect(halfTranslate).toBe(30);
    });
  });

  describe('Materialization blur math', () => {
    /**
     * Menu content blur goes from menuMaterializeBlur → 0 as menu opens:
     *   intensity: interpolate(progress, [0, 1], [menuMaterializeBlur, 0])
     */
    function materializeBlur(progress: number): number {
      const clamped = Math.max(0, Math.min(1, progress));
      return MENU_CONTENT_BLUR.menuMaterializeBlur * (1 - clamped);
    }

    it('is fully blurred when menu starts opening (progress=0)', () => {
      expect(materializeBlur(0)).toBe(70);
    });

    it('is clear when menu is fully open (progress=1)', () => {
      expect(materializeBlur(1)).toBe(0);
    });

    it('is half-blurred at progress=0.5', () => {
      expect(materializeBlur(0.5)).toBe(35);
    });
  });

  describe('Drawer panel overlay math', () => {
    /**
     * Drawer dark overlay opacity animates from drawerMinOpacity → drawerMaxOpacity:
     *   opacity: interpolate(progress, [0, 1], [drawerMinOpacity, drawerMaxOpacity])
     */
    function drawerOverlayOpacity(progress: number): number {
      const clamped = Math.max(0, Math.min(1, progress));
      return MENU_CONTENT_BLUR.drawerMinOpacity +
        (MENU_CONTENT_BLUR.drawerMaxOpacity - MENU_CONTENT_BLUR.drawerMinOpacity) * clamped;
    }

    it('starts at drawerMinOpacity when menu begins opening (progress=0)', () => {
      expect(drawerOverlayOpacity(0)).toBeCloseTo(0.55, 2);
    });

    it('reaches drawerMaxOpacity when menu is fully open (progress=1)', () => {
      expect(drawerOverlayOpacity(1)).toBeCloseTo(0.97, 2);
    });

    it('is between min and max at progress=0.5', () => {
      const opacity = drawerOverlayOpacity(0.5);
      expect(opacity).toBeGreaterThan(MENU_CONTENT_BLUR.drawerMinOpacity);
      expect(opacity).toBeLessThan(MENU_CONTENT_BLUR.drawerMaxOpacity);
      expect(opacity).toBeCloseTo(0.76, 2);
    });
  });
});
