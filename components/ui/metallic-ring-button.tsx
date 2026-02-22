/**
 * MetallicRingButton — Reusable metallic gradient ring button
 *
 * Extracted from loop-header.tsx's menu button. Provides a consistent
 * "Grok 2026" frosted glass ring button across all headers.
 *
 * Features:
 * - LinearGradient ring (dark: white 50%/10%/40%, light: black 10%/28%/08%)
 * - Animated inner circle with press-to-lighten
 * - Scale 1 → 1.1 on press
 * - Optional menuProgress integration (stays enlarged while menu is open)
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  interpolateColor,
  Extrapolate,
  withTiming,
  withSpring,
  SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface MetallicRingButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  size?: number;       // outer diameter, default 36
  innerSize?: number;  // inner diameter, default 33
  menuProgress?: SharedValue<number>;
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
  /** Disable haptics on press (for cases where parent handles it) */
  noHaptics?: boolean;
}

export function MetallicRingButton({
  children,
  onPress,
  size = 36,
  innerSize = 33,
  menuProgress,
  hitSlop = { top: 6, bottom: 6, left: 6, right: 6 },
  noHaptics = false,
}: MetallicRingButtonProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const press = useSharedValue(0);

  const scaleStyle = useAnimatedStyle(() => {
    const menuOpen = menuProgress
      ? interpolate(menuProgress.value, [0, 0.1], [0, 1], Extrapolate.CLAMP)
      : 0;
    const p = Math.max(press.value, menuOpen);
    return {
      transform: [{ scale: interpolate(p, [0, 1], [1, 1.1], Extrapolate.CLAMP) }],
    };
  });

  const innerStyle = useAnimatedStyle(() => {
    const menuOpen = menuProgress
      ? interpolate(menuProgress.value, [0, 0.1], [0, 1], Extrapolate.CLAMP)
      : 0;
    const p = Math.max(press.value, menuOpen);
    const darkBg = interpolateColor(p, [0, 1], ['rgba(0,0,0,0.75)', 'rgba(0,0,0,0.55)']);
    // Light mode: rest is a tad softer than pure white, press brightens subtly
    const lightBg = interpolateColor(p, [0, 1], ['rgba(255,255,255,0.70)', 'rgba(255,255,255,0.82)']);
    return {
      backgroundColor: isDark ? darkBg : lightBg,
    };
  });

  // Light mode ring overlay: lightens the gradient border on press
  const ringOverlayStyle = useAnimatedStyle(() => {
    if (isDark) return { opacity: 0 };
    const menuOpen = menuProgress
      ? interpolate(menuProgress.value, [0, 0.1], [0, 1], Extrapolate.CLAMP)
      : 0;
    const p = Math.max(press.value, menuOpen);
    return {
      opacity: interpolate(p, [0, 1], [0, 0.35], Extrapolate.CLAMP),
    };
  });

  const handlePressIn = () => {
    press.value = withTiming(1, { duration: 100 });
  };

  const handlePressOut = () => {
    press.value = withSpring(0, { duration: 400, dampingRatio: 0.55 });
  };

  const handlePress = () => {
    if (!noHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const gradientColors: [string, string, string] = isDark
    ? ['rgba(255,255,255,0.50)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.40)']
    : ['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.08)'];

  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      hitSlop={hitSlop}
      style={styles.touchable}
    >
      <Animated.View style={[{ borderRadius: size / 2 }, scaleStyle]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}
        >
          {/* Light mode: white overlay on ring that fades in on press to lighten the border */}
          <Animated.View
            style={[
              styles.ringOverlay,
              { borderRadius: size / 2 },
              ringOverlayStyle,
            ]}
            pointerEvents="none"
          />
          <Animated.View
            style={[
              styles.inner,
              { width: innerSize, height: innerSize, borderRadius: innerSize / 2 },
              innerStyle,
            ]}
          >
            {children}
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    padding: 4,
    position: 'relative',
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
