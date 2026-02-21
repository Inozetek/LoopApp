/**
 * BlurHeaderWrapper - Frosted glass header background
 *
 * Provides an Apple Calendar / Grok style translucent blur effect
 * behind header content. Content scrolls behind the header for
 * a premium layered feel.
 *
 * Usage:
 *   <BlurHeaderWrapper style={{ paddingTop: insets.top }}>
 *     {header content}
 *   </BlurHeaderWrapper>
 *
 * Platform behavior:
 * - iOS: Native BlurView with configurable intensity
 * - Android: BlurView via dimezisBlurView experimental method
 * - Web: Semi-transparent background fallback (no native blur)
 */

import React from 'react';
import { View, StyleSheet, Platform, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Blur intensity tuned per platform */
const HEADER_BLUR = {
  intensityIOS: 80,
  intensityAndroid: 100,
  /** Semi-transparent overlay on top of blur for contrast */
  overlayDark: 'rgba(0, 0, 0, 0.45)',
  overlayLight: 'rgba(255, 255, 255, 0.65)',
  /** Web fallback (no native blur) */
  fallbackDark: 'rgba(18, 18, 20, 0.88)',
  fallbackLight: 'rgba(255, 255, 255, 0.88)',
} as const;

export { HEADER_BLUR };

interface BlurHeaderWrapperProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Override blur intensity (default: platform-tuned) */
  intensity?: number;
  /** Whether to show the bottom border shimmer line. Default true. */
  showBottomBorder?: boolean;
  /** Custom bottom border color. */
  bottomBorderColor?: string;
}

export function BlurHeaderWrapper({
  children,
  style,
  intensity,
  showBottomBorder = true,
  bottomBorderColor,
}: BlurHeaderWrapperProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const blurIntensity = intensity ?? (Platform.OS === 'ios' ? HEADER_BLUR.intensityIOS : HEADER_BLUR.intensityAndroid);
  const tint = isDark ? 'dark' : 'light';

  const borderColor = bottomBorderColor ?? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)');

  if (Platform.OS === 'web') {
    // Web fallback: semi-transparent solid background with backdrop-filter
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? HEADER_BLUR.fallbackDark : HEADER_BLUR.fallbackLight,
            borderBottomColor: borderColor,
            borderBottomWidth: showBottomBorder ? StyleSheet.hairlineWidth : 0,
          },
          // @ts-ignore - web-only CSS property
          { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          borderBottomColor: borderColor,
          borderBottomWidth: showBottomBorder ? StyleSheet.hairlineWidth : 0,
        },
        style,
      ]}
    >
      {/* Blur layer */}
      <BlurView
        intensity={blurIntensity}
        tint={tint}
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        style={StyleSheet.absoluteFill}
      />
      {/* Semi-transparent overlay for better text contrast */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDark ? HEADER_BLUR.overlayDark : HEADER_BLUR.overlayLight,
          },
        ]}
      />
      {/* Header content */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
