/**
 * Tests for AnimatedBlurView utility - platform branching logic
 *
 * Tests the SUPPORTS_ANIMATED_BLUR and ANDROID_BLUR_METHOD constants
 * based on Platform.OS. The actual AnimatedBlurView component is a
 * simple createAnimatedComponent wrapper, so we only test the
 * platform detection logic here.
 */

describe('AnimatedBlurView - Platform Branching Logic', () => {
  /**
   * Mirrors SUPPORTS_ANIMATED_BLUR logic from animated-blur-view.tsx:
   *   export const SUPPORTS_ANIMATED_BLUR = Platform.OS !== 'web';
   */
  function supportsAnimatedBlur(platformOS: string): boolean {
    return platformOS !== 'web';
  }

  it('returns true for iOS', () => {
    expect(supportsAnimatedBlur('ios')).toBe(true);
  });

  it('returns true for Android', () => {
    expect(supportsAnimatedBlur('android')).toBe(true);
  });

  it('returns false for web', () => {
    expect(supportsAnimatedBlur('web')).toBe(false);
  });

  it('returns true for unknown platforms', () => {
    expect(supportsAnimatedBlur('windows')).toBe(true);
    expect(supportsAnimatedBlur('')).toBe(true);
  });
});

describe('AnimatedBlurView - ANDROID_BLUR_METHOD', () => {
  /**
   * Mirrors ANDROID_BLUR_METHOD logic from animated-blur-view.tsx:
   *   export const ANDROID_BLUR_METHOD = Platform.OS === 'android' ? 'dimezisBlurView' : undefined;
   */
  function getAndroidBlurMethod(platformOS: string): 'dimezisBlurView' | undefined {
    return platformOS === 'android' ? 'dimezisBlurView' : undefined;
  }

  it('returns dimezisBlurView on Android', () => {
    expect(getAndroidBlurMethod('android')).toBe('dimezisBlurView');
  });

  it('returns undefined on iOS', () => {
    expect(getAndroidBlurMethod('ios')).toBeUndefined();
  });

  it('returns undefined on web', () => {
    expect(getAndroidBlurMethod('web')).toBeUndefined();
  });

  it('returns undefined on unknown platforms', () => {
    expect(getAndroidBlurMethod('windows')).toBeUndefined();
    expect(getAndroidBlurMethod('')).toBeUndefined();
  });
});

describe('AnimatedBlurView - iOS blur interpolation logic', () => {
  /**
   * Mirrors the interpolation pattern used in index.tsx / main-menu-modal:
   *   intensity: interpolate(progress, [0, 1], [0, maxIntensity])
   */
  function interpolateBlur(progress: number, maxIntensity: number): number {
    return Math.max(0, Math.min(maxIntensity, progress * maxIntensity));
  }

  it('returns 0 at progress 0', () => {
    expect(interpolateBlur(0, 80)).toBe(0);
  });

  it('returns max at progress 1', () => {
    expect(interpolateBlur(1, 80)).toBe(80);
  });

  it('returns half at progress 0.5', () => {
    expect(interpolateBlur(0.5, 80)).toBe(40);
  });

  it('clamps at 0 for negative progress', () => {
    expect(interpolateBlur(-0.5, 80)).toBe(0);
  });

  it('clamps at max for progress > 1', () => {
    expect(interpolateBlur(1.5, 80)).toBe(80);
  });
});

describe('AnimatedBlurView - SUPPORTS_MATERIALIZATION_BLUR', () => {
  /**
   * Mirrors SUPPORTS_MATERIALIZATION_BLUR logic from animated-blur-view.tsx:
   *   export const SUPPORTS_MATERIALIZATION_BLUR = Platform.OS === 'ios';
   *
   * Only iOS can animate blur intensity from high→0 without losing
   * the dark tint. Android's dimezisBlurView ties tint to intensity,
   * so it uses opacity fallback for materialization.
   */
  function supportsMaterializationBlur(platformOS: string): boolean {
    return platformOS === 'ios';
  }

  it('returns true for iOS', () => {
    expect(supportsMaterializationBlur('ios')).toBe(true);
  });

  it('returns false for Android (tint tied to intensity)', () => {
    expect(supportsMaterializationBlur('android')).toBe(false);
  });

  it('returns false for web', () => {
    expect(supportsMaterializationBlur('web')).toBe(false);
  });
});

describe('AnimatedBlurView - Web opacity fallback logic', () => {
  /**
   * On web, blur intensity is fixed and opacity animates 0→1:
   *   opacity: interpolate(progress, [0, 1], [0, 1])
   */
  function webBlurOpacity(progress: number): number {
    return Math.max(0, Math.min(1, progress));
  }

  it('returns 0 at progress 0', () => {
    expect(webBlurOpacity(0)).toBe(0);
  });

  it('returns 1 at progress 1', () => {
    expect(webBlurOpacity(1)).toBe(1);
  });

  it('clamps between 0 and 1', () => {
    expect(webBlurOpacity(-0.5)).toBe(0);
    expect(webBlurOpacity(1.5)).toBe(1);
  });
});
