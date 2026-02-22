/**
 * BlurHeaderWrapper - Frosted header zone
 *
 * Content scrolling behind the header gets blurred. Buttons float above
 * with their own contrast via MetallicRingButton backgrounds.
 *
 * A feather gradient extends below the blur zone for a soft fade-out
 * instead of a hard cutoff.
 *
 * Platform behavior:
 * - iOS: Native BlurView — real frosted glass
 * - Android: BlurView (dimezisBlurView) — content blurs as it scrolls behind
 * - Web: CSS backdrop-filter blur
 */

import React from 'react';
import { View, StyleSheet, Platform, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/use-color-scheme';

const HEADER_BLUR = {
  intensityIOS: 50,
  intensityAndroid: 35,
  overlayDark: 'rgba(0, 0, 0, 0.04)',
  overlayLight: 'rgba(255, 255, 255, 0.06)',
  overlayDarkAndroid: 'rgba(0, 0, 0, 0.45)',
  overlayLightAndroid: 'rgba(255, 255, 255, 0.50)',
  fallbackDark: 'rgba(0, 0, 0, 0.45)',
  fallbackLight: 'rgba(255, 255, 255, 0.55)',
  /** Height of the soft gradient feather below the header */
  featherHeight: 60,
  /** iOS only: how far BlurView extends past header to soften the hard edge */
  iosBlurOverhang: 20,
} as const;

/** Multi-stop gradient colors for smooth Grok-style feather (no hard line) */
const FEATHER_STOPS = {
  dark: {
    android: [
      'rgba(0, 0, 0, 0.45)',   // full overlay
      'rgba(0, 0, 0, 0.28)',   // ~60%
      'rgba(0, 0, 0, 0.10)',   // ~22%
      'transparent',
    ] as const,
    ios: [
      'rgba(0, 0, 0, 0.04)',   // full overlay
      'rgba(0, 0, 0, 0.025)',  // ~60%
      'rgba(0, 0, 0, 0.008)',  // ~20%
      'transparent',
    ] as const,
  },
  light: {
    android: [
      'rgba(255, 255, 255, 0.50)',  // full overlay
      'rgba(255, 255, 255, 0.30)',  // ~60%
      'rgba(255, 255, 255, 0.10)',  // ~20%
      'transparent',
    ] as const,
    ios: [
      'rgba(255, 255, 255, 0.06)',   // full overlay
      'rgba(255, 255, 255, 0.035)',  // ~58%
      'rgba(255, 255, 255, 0.012)',  // ~20%
      'transparent',
    ] as const,
  },
} as const;

const FEATHER_LOCATIONS = [0, 0.3, 0.65, 1] as const;

export { HEADER_BLUR };

/**
 * Base height of standard header content (icon row + padding), excluding safe-area insets.
 * Used by screens to compute top padding so content starts below the absolute header.
 */
export const BLUR_HEADER_HEIGHT = {
  standard: 64,
  explore: 108,
} as const;

interface BlurHeaderWrapperProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Override blur intensity (iOS only, default 50) */
  intensity?: number;
  /** Whether to show the bottom border line. Default false. */
  showBottomBorder?: boolean;
  /** Custom bottom border color */
  bottomBorderColor?: string;
  /** Override overlay opacity (0-1) */
  overlayOpacity?: number;
}

export function BlurHeaderWrapper({
  children,
  style,
  intensity,
  showBottomBorder = false,
  bottomBorderColor,
  overlayOpacity,
}: BlurHeaderWrapperProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const borderColor = bottomBorderColor ?? (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)');
  const borderStyle = showBottomBorder
    ? { borderBottomColor: borderColor, borderBottomWidth: StyleSheet.hairlineWidth }
    : {};

  // ── Web: CSS backdrop-filter ──
  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? HEADER_BLUR.fallbackDark : HEADER_BLUR.fallbackLight,
            ...borderStyle,
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

  // ── Android: Solid opaque header (blur doesn't render well on Android) ──
  if (Platform.OS === 'android') {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? '#000000' : '#FFFFFF',
            ...borderStyle,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  // ── iOS: native BlurView — real frosted glass + feather ──
  const blurIntensity = intensity ?? HEADER_BLUR.intensityIOS;
  const tint = isDark ? 'dark' : 'light';

  const overlayColor = overlayOpacity !== undefined
    ? isDark ? `rgba(0, 0, 0, ${overlayOpacity})` : `rgba(255, 255, 255, ${overlayOpacity})`
    : isDark ? HEADER_BLUR.overlayDark : HEADER_BLUR.overlayLight;

  return (
    <View style={[styles.containerOpen, borderStyle, style]}>
      {/* BlurView extends slightly past header bottom so the blur fades
          naturally instead of clipping with a hard edge (iOS only). */}
      <View style={styles.iosBlurExtended}>
        <BlurView
          intensity={blurIntensity}
          tint={tint}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {/* Overlay stays clipped to header bounds */}
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: overlayColor },
          ]}
        />
      </View>
      {/* Feather gradient — multi-stop soft fade below header */}
      <LinearGradient
        colors={[...(isDark ? FEATHER_STOPS.dark.ios : FEATHER_STOPS.light.ios)]}
        locations={[...FEATHER_LOCATIONS]}
        style={styles.featherGradient}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Used by web — keeps overflow: hidden */
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'hidden',
  },
  /** Used by iOS/Android — overflow visible so feather gradient can extend below */
  containerOpen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'visible',
  },
  /** iOS only: BlurView extends slightly past the header so the native blur
   *  fades smoothly instead of clipping with a hard edge. Android keeps
   *  blur + overlay in a single clipped container (BlurView hard-edges there). */
  iosBlurExtended: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -HEADER_BLUR.iosBlurOverhang,
    overflow: 'hidden',
  },
  /** Gradient that extends below the header for a soft fade-out.
   *  Starts 10px inside the header to mask the blur's bottom edge. */
  featherGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -(HEADER_BLUR.featherHeight - 10),
    height: HEADER_BLUR.featherHeight,
  },
});
