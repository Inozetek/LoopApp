/**
 * Menu Content Wrapper
 *
 * Grok-style main content wrapper that:
 * - Scales down to 0.88 when side menu opens
 * - Applies rounded corners (20-24pt) during animation
 * - Uses 120fps GPU-accelerated transforms
 * - Syncs with menu animation progress
 */

import React, { useEffect } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useMenuAnimation } from '@/contexts/menu-animation-context';
import { GROK_SPRING, SCALES, MENU_DIMENSIONS } from '@/constants/animations';

interface MenuContentWrapperProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function MenuContentWrapper({ children, style }: MenuContentWrapperProps) {
  const { menuProgress, isMenuOpen } = useMenuAnimation();

  // Animate progress when menu state changes
  useEffect(() => {
    menuProgress.value = withSpring(isMenuOpen ? 1 : 0, GROK_SPRING);
  }, [isMenuOpen, menuProgress]);

  // Animated style for main content scaling
  const contentStyle = useAnimatedStyle(() => {
    // Scale: 1 → 0.92 (matches Grok's ~0.88-0.92 scale)
    const scale = interpolate(
      menuProgress.value,
      [0, 1],
      [1, SCALES.menuOpen],
      Extrapolate.CLAMP
    );

    // Border radius: 0 → 20 (rounded corners when scaled)
    const borderRadius = interpolate(
      menuProgress.value,
      [0, 1],
      [0, MENU_DIMENSIONS.contentBorderRadius],
      Extrapolate.CLAMP
    );

    // Slight horizontal shift (optional - Grok shifts content right)
    const translateX = interpolate(
      menuProgress.value,
      [0, 1],
      [0, 40],
      Extrapolate.CLAMP
    );

    // Subtle rotation for premium feel (1-2 degrees)
    const rotateZ = interpolate(
      menuProgress.value,
      [0, 1],
      [0, -1.5], // Slight counter-clockwise rotation
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { scale },
        { translateX },
        { rotateZ: `${rotateZ}deg` },
      ],
      borderRadius,
      overflow: 'hidden',
    };
  });

  return (
    <Animated.View style={[styles.container, contentStyle, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
