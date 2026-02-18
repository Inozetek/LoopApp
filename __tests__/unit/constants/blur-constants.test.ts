/**
 * Tests for BLUR constants in animations.ts
 *
 * Verifies the centralized blur/glass-effect values used by
 * side-menu-drawer and animated-drawer for frosted glass menus.
 */

// Mock react-native-reanimated (imported by animations.ts for Easing)
jest.mock('react-native-reanimated', () => ({
  Easing: {
    out: jest.fn(() => jest.fn()),
    in: jest.fn(() => jest.fn()),
    quad: 'quad',
    cubic: 'cubic',
  },
}));

import { BLUR } from '@/constants/animations';

describe('BLUR constants', () => {
  it('exports a BLUR object', () => {
    expect(BLUR).toBeDefined();
    expect(typeof BLUR).toBe('object');
  });

  it('has higher intensity on Android to compensate for weaker BlurView', () => {
    expect(BLUR.menuIntensityAndroid).toBeGreaterThan(BLUR.menuIntensityIOS);
  });

  it('iOS intensity is 100', () => {
    expect(BLUR.menuIntensityIOS).toBe(100);
  });

  it('Android intensity is 120', () => {
    expect(BLUR.menuIntensityAndroid).toBe(120);
  });

  it('dark overlay opacity is translucent (< 0.7) to reveal blur', () => {
    expect(BLUR.overlayOpacityDark).toBeLessThan(0.7);
    expect(BLUR.overlayOpacityDark).toBeGreaterThan(0.3);
  });

  it('light overlay opacity is translucent (< 0.7) to reveal blur', () => {
    expect(BLUR.overlayOpacityLight).toBeLessThan(0.7);
    expect(BLUR.overlayOpacityLight).toBeGreaterThan(0.3);
  });

  it('dark overlay is 0.55', () => {
    expect(BLUR.overlayOpacityDark).toBe(0.55);
  });

  it('light overlay is 0.60', () => {
    expect(BLUR.overlayOpacityLight).toBe(0.60);
  });
});
