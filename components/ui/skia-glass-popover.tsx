/**
 * Skia Glass Popover Component
 *
 * GPU-accelerated glass popover with:
 * - Skia BackdropBlur for premium blur effects
 * - Materialization animation (blur-to-clear emergence)
 * - iOS 26+ Liquid Glass support via @callstack/liquid-glass
 * - Graceful fallback for older devices
 */

import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  Modal,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { GROK_SPRING, TIMING, BACKDROP } from '@/constants/animations';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BorderRadius } from '@/constants/brand';

// Try to import Skia for GPU-accelerated effects
// NOTE: Skia requires a native development build (not Expo Go)
let Canvas: React.ComponentType<any> | null = null;
let BackdropBlur: React.ComponentType<any> | null = null;
let Fill: React.ComponentType<any> | null = null;
let RoundedRect: React.ComponentType<any> | null = null;

// IMPORTANT: Set to false to use BlurView fallback (works in Expo Go)
const ENABLE_SKIA_GLASS = false;
let isSkiaAvailable = false;

if (ENABLE_SKIA_GLASS) {
  try {
    const skia = require('@shopify/react-native-skia');
    Canvas = skia.Canvas;
    BackdropBlur = skia.BackdropBlur;
    Fill = skia.Fill;
    RoundedRect = skia.RoundedRect;
    isSkiaAvailable = true;
  } catch {
    // Skia not available, will use fallback
  }
}

// Try to import Liquid Glass for iOS 26+
let LiquidGlassView: React.ComponentType<any> | null = null;
let isLiquidGlassSupported = false;

try {
  const liquidGlass = require('@callstack/liquid-glass');
  LiquidGlassView = liquidGlass.LiquidGlassView;
  isLiquidGlassSupported = liquidGlass.isLiquidGlassSupported ?? (Platform.OS === 'ios');
} catch {
  // Liquid Glass not available
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SkiaGlassPopoverProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Anchor position for the popover */
  anchorPosition: { x: number; y: number };
  /** Width of the popover */
  width?: number;
  /** Transform origin for scale animation */
  transformOrigin?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
}

export function SkiaGlassPopover({
  visible,
  onClose,
  children,
  anchorPosition,
  width = 200,
  transformOrigin = 'top-right',
}: SkiaGlassPopoverProps) {
  const colorScheme = useColorScheme();

  // Animation values
  const containerOpacity = useSharedValue(0);
  const scale = useSharedValue(0.95);
  const contentOpacity = useSharedValue(0);

  // Animate on visibility change
  useEffect(() => {
    if (visible) {
      // Opening - Materialization effect
      containerOpacity.value = withTiming(1, TIMING.contentFadeIn);
      scale.value = withSpring(1, GROK_SPRING);
      contentOpacity.value = withTiming(1, { duration: 200 });
    } else {
      // Closing - Dematerialization
      contentOpacity.value = withTiming(0, TIMING.contentFadeOut);
      scale.value = withSpring(0.97, { ...GROK_SPRING, duration: 200 });
      containerOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible]);

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: scale.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      containerOpacity.value,
      [0, 1],
      [0, BACKDROP.popover],
      Extrapolate.CLAMP
    ),
  }));

  // Calculate popover position
  const popoverLeft = Math.max(
    8,
    Math.min(anchorPosition.x - width + 24, SCREEN_WIDTH - width - 8)
  );
  const popoverTop = anchorPosition.y + 8;

  if (!visible) return null;

  // Render the glass container based on available technology
  const renderGlassContainer = () => {
    // Priority 1: iOS 26+ Liquid Glass
    if (isLiquidGlassSupported && LiquidGlassView) {
      return (
        <LiquidGlassView style={styles.glassContainer}>
          <Animated.View style={contentStyle}>
            {children}
          </Animated.View>
        </LiquidGlassView>
      );
    }

    // Priority 2: Skia GPU-accelerated blur
    if (isSkiaAvailable && Canvas && BackdropBlur && Fill) {
      return (
        <View style={styles.glassContainer}>
          {/* Skia canvas for GPU-accelerated backdrop blur */}
          <Canvas style={StyleSheet.absoluteFill}>
            <BackdropBlur blur={15} clip={{ x: 0, y: 0, width, height: 300 }}>
              <Fill color={colorScheme === 'dark' ? 'rgba(30, 30, 30, 0.7)' : 'rgba(255, 255, 255, 0.7)'} />
            </BackdropBlur>
          </Canvas>
          <Animated.View style={[styles.skiaContentOverlay, contentStyle]}>
            {children}
          </Animated.View>
        </View>
      );
    }

    // Priority 3: expo-blur fallback
    return (
      <BlurView
        intensity={colorScheme === 'dark' ? 80 : 90}
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
        style={styles.glassContainer}
      >
        <View
          style={[
            styles.fallbackOverlay,
            {
              backgroundColor: colorScheme === 'dark'
                ? 'rgba(30, 30, 30, 0.85)'
                : 'rgba(255, 255, 255, 0.85)',
            },
          ]}
        >
          <Animated.View style={contentStyle}>
            {children}
          </Animated.View>
        </View>
      </BlurView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop - tap to close */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </TouchableWithoutFeedback>

      {/* Popover with glass effect */}
      <Animated.View
        style={[
          styles.popover,
          containerStyle,
          {
            left: popoverLeft,
            top: popoverTop,
            width,
            // Set transform origin based on prop
            ...(Platform.OS === 'web' && {
              transformOrigin: transformOrigin.replace('-', ' '),
            }),
          },
        ]}
      >
        {renderGlassContainer()}
      </Animated.View>
    </Modal>
  );
}

/**
 * Hook to check if Skia glass effects are available
 */
export function useSkiaGlassAvailable() {
  return {
    isSkiaAvailable,
    isLiquidGlassSupported,
    preferredMethod: isLiquidGlassSupported
      ? 'liquid-glass'
      : isSkiaAvailable
      ? 'skia'
      : 'blur-view',
  };
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  popover: {
    position: 'absolute',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  glassContainer: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  skiaContentOverlay: {
    position: 'relative',
  },
  fallbackOverlay: {
    borderRadius: BorderRadius.lg,
  },
});
