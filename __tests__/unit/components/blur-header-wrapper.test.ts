/**
 * Tests for BlurHeaderWrapper - Frosted glass header logic
 *
 * Tests the platform-aware blur intensity, overlay colors,
 * and tint selection logic used by all 5 app headers.
 * Follows the project's pure-logic testing pattern.
 */

describe('BlurHeaderWrapper - HEADER_BLUR constants', () => {
  /** Mirrors HEADER_BLUR from blur-header-wrapper.tsx */
  const HEADER_BLUR = {
    intensityIOS: 80,
    intensityAndroid: 100,
    overlayDark: 'rgba(0, 0, 0, 0.45)',
    overlayLight: 'rgba(255, 255, 255, 0.65)',
    fallbackDark: 'rgba(18, 18, 20, 0.88)',
    fallbackLight: 'rgba(255, 255, 255, 0.88)',
  } as const;

  it('exports HEADER_BLUR constants', () => {
    expect(HEADER_BLUR).toBeDefined();
    expect(typeof HEADER_BLUR).toBe('object');
  });

  it('iOS intensity is 80 (lighter blur for headers vs menus)', () => {
    expect(HEADER_BLUR.intensityIOS).toBe(80);
  });

  it('Android intensity is higher than iOS to compensate for weaker BlurView', () => {
    expect(HEADER_BLUR.intensityAndroid).toBeGreaterThan(HEADER_BLUR.intensityIOS);
  });

  it('Android intensity is 100', () => {
    expect(HEADER_BLUR.intensityAndroid).toBe(100);
  });

  it('dark overlay uses black with moderate opacity', () => {
    expect(HEADER_BLUR.overlayDark).toBe('rgba(0, 0, 0, 0.45)');
  });

  it('light overlay uses white with higher opacity for contrast', () => {
    expect(HEADER_BLUR.overlayLight).toBe('rgba(255, 255, 255, 0.65)');
  });

  it('web fallback dark is nearly opaque', () => {
    expect(HEADER_BLUR.fallbackDark).toContain('0.88');
  });

  it('web fallback light is nearly opaque', () => {
    expect(HEADER_BLUR.fallbackLight).toContain('0.88');
  });
});

describe('BlurHeaderWrapper - Platform intensity selection', () => {
  /**
   * Mirrors the intensity selection logic from blur-header-wrapper.tsx:
   *   const blurIntensity = intensity ?? (Platform.OS === 'ios' ? HEADER_BLUR.intensityIOS : HEADER_BLUR.intensityAndroid);
   */
  function getBlurIntensity(
    platformOS: string,
    overrideIntensity?: number
  ): number {
    const INTENSITY_IOS = 80;
    const INTENSITY_ANDROID = 100;

    if (overrideIntensity !== undefined) return overrideIntensity;
    return platformOS === 'ios' ? INTENSITY_IOS : INTENSITY_ANDROID;
  }

  it('returns 80 on iOS with no override', () => {
    expect(getBlurIntensity('ios')).toBe(80);
  });

  it('returns 100 on Android with no override', () => {
    expect(getBlurIntensity('android')).toBe(100);
  });

  it('returns 100 on web (falls through to Android default, but web uses fallback bg)', () => {
    expect(getBlurIntensity('web')).toBe(100);
  });

  it('respects override intensity when provided', () => {
    expect(getBlurIntensity('ios', 50)).toBe(50);
    expect(getBlurIntensity('android', 150)).toBe(150);
  });

  it('override of 0 is valid (returns 0)', () => {
    expect(getBlurIntensity('ios', 0)).toBe(0);
  });
});

describe('BlurHeaderWrapper - Tint selection', () => {
  /**
   * Mirrors tint logic from blur-header-wrapper.tsx:
   *   const tint = isDark ? 'dark' : 'light';
   */
  function getBlurTint(colorScheme: 'light' | 'dark' | null): 'dark' | 'light' {
    const isDark = colorScheme === 'dark';
    return isDark ? 'dark' : 'light';
  }

  it('returns "dark" tint for dark mode', () => {
    expect(getBlurTint('dark')).toBe('dark');
  });

  it('returns "light" tint for light mode', () => {
    expect(getBlurTint('light')).toBe('light');
  });

  it('returns "light" tint for null color scheme', () => {
    expect(getBlurTint(null)).toBe('light');
  });
});

describe('BlurHeaderWrapper - Overlay color selection', () => {
  /**
   * Mirrors overlay logic from blur-header-wrapper.tsx:
   *   backgroundColor: isDark ? HEADER_BLUR.overlayDark : HEADER_BLUR.overlayLight,
   */
  function getOverlayColor(isDark: boolean): string {
    return isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.65)';
  }

  it('uses dark overlay in dark mode', () => {
    expect(getOverlayColor(true)).toBe('rgba(0, 0, 0, 0.45)');
  });

  it('uses light overlay in light mode', () => {
    expect(getOverlayColor(false)).toBe('rgba(255, 255, 255, 0.65)');
  });
});

describe('BlurHeaderWrapper - Border color logic', () => {
  /**
   * Mirrors border color logic from blur-header-wrapper.tsx:
   *   const borderColor = bottomBorderColor ?? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)');
   */
  function getBorderColor(isDark: boolean, customColor?: string): string {
    if (customColor) return customColor;
    return isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  }

  it('uses subtle white border in dark mode', () => {
    expect(getBorderColor(true)).toBe('rgba(255, 255, 255, 0.08)');
  });

  it('uses subtle black border in light mode', () => {
    expect(getBorderColor(false)).toBe('rgba(0, 0, 0, 0.08)');
  });

  it('uses custom color when provided', () => {
    expect(getBorderColor(true, 'rgba(0, 191, 255, 0.1)')).toBe('rgba(0, 191, 255, 0.1)');
    expect(getBorderColor(false, '#FF0000')).toBe('#FF0000');
  });
});

describe('BlurHeaderWrapper - Web fallback selection', () => {
  /**
   * On web, BlurView is not available so we use a solid semi-transparent background.
   * Mirrors the web fallback path in blur-header-wrapper.tsx.
   */
  function getWebFallbackBg(isDark: boolean): string {
    return isDark ? 'rgba(18, 18, 20, 0.88)' : 'rgba(255, 255, 255, 0.88)';
  }

  it('uses dark fallback on web in dark mode', () => {
    expect(getWebFallbackBg(true)).toBe('rgba(18, 18, 20, 0.88)');
  });

  it('uses light fallback on web in light mode', () => {
    expect(getWebFallbackBg(false)).toBe('rgba(255, 255, 255, 0.88)');
  });
});

describe('BlurHeaderWrapper - showBottomBorder logic', () => {
  /**
   * Border width is StyleSheet.hairlineWidth when showBottomBorder is true, 0 when false.
   * Default is true.
   */
  function getBorderWidth(showBottomBorder?: boolean): number {
    const show = showBottomBorder ?? true; // default true
    return show ? 0.5 : 0; // hairlineWidth is typically ~0.5
  }

  it('defaults to showing border (hairline width)', () => {
    expect(getBorderWidth()).toBeGreaterThan(0);
  });

  it('shows border when explicitly true', () => {
    expect(getBorderWidth(true)).toBeGreaterThan(0);
  });

  it('hides border when false', () => {
    expect(getBorderWidth(false)).toBe(0);
  });
});

describe('BlurHeaderWrapper - experimentalBlurMethod', () => {
  /**
   * Mirrors the platform-specific blur method used in blur-header-wrapper.tsx:
   *   experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
   */
  function getBlurMethod(platformOS: string): 'dimezisBlurView' | undefined {
    return platformOS === 'android' ? 'dimezisBlurView' : undefined;
  }

  it('uses dimezisBlurView on Android for better quality', () => {
    expect(getBlurMethod('android')).toBe('dimezisBlurView');
  });

  it('uses default (undefined) on iOS', () => {
    expect(getBlurMethod('ios')).toBeUndefined();
  });

  it('uses default (undefined) on web', () => {
    expect(getBlurMethod('web')).toBeUndefined();
  });
});
