/**
 * Filter Popover Component
 *
 * iOS 26 "Liquid Glass" style popover mimicking iOS Phone app's filter UI.
 * Features:
 * - Simple segmented control: "For You" vs "Explore" modes
 * - Liquid Glass effect with refraction and specular highlights (iOS 26+)
 * - Skia GPU-accelerated BackdropBlur as secondary tier
 * - Materialization animation (blur-to-clear emergence)
 * - Graceful fallback to BlurView on older iOS/Android
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  interpolate,
  Extrapolate,
  useDerivedValue,
} from 'react-native-reanimated';
import { GROK_SPRING, TIMING, BACKDROP } from '@/constants/animations';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import { FilterSheetFilters, FilterMode } from '@/components/filter-sheet';

// Try to import Liquid Glass, fallback gracefully
let LiquidGlassView: React.ComponentType<any> | null = null;
let isLiquidGlassSupported = false;

try {
  const liquidGlass = require('@callstack/liquid-glass');
  LiquidGlassView = liquidGlass.LiquidGlassView;
  isLiquidGlassSupported = liquidGlass.isLiquidGlassSupported ?? (Platform.OS === 'ios');
} catch {
  // Package not available, will use fallback
}

// Try to import Skia for GPU-accelerated effects (Tier 2)
// NOTE: Skia requires a native development build (not Expo Go)
let Canvas: React.ComponentType<any> | null = null;
let BackdropBlur: React.ComponentType<any> | null = null;
let Fill: React.ComponentType<any> | null = null;
let Rect: React.ComponentType<any> | null = null;

// IMPORTANT: Set to false to use BlurView fallback (works in Expo Go)
const ENABLE_SKIA_POPOVER = false;
let isSkiaAvailable = false;

if (ENABLE_SKIA_POPOVER) {
  try {
    const skia = require('@shopify/react-native-skia');
    Canvas = skia.Canvas;
    BackdropBlur = skia.BackdropBlur;
    Fill = skia.Fill;
    Rect = skia.Rect;
    isSkiaAvailable = true;
  } catch {
    // Skia not available, will use expo-blur fallback
  }
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Re-export for backwards compatibility
export type FilterPopoverFilters = FilterSheetFilters;
export type { FilterMode };

interface FilterPopoverProps {
  visible: boolean;
  anchorPosition: { x: number; y: number };
  onClose: () => void;
  filters: FilterPopoverFilters;
  onFiltersChange: (filters: FilterPopoverFilters) => void;
  onOpenAdvanced?: () => void;
}

// Animated BlurView for materialization effect
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export function FilterPopover({
  visible,
  anchorPosition,
  onClose,
  filters,
  onFiltersChange,
  onOpenAdvanced,
}: FilterPopoverProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  // Materialization animation values
  const containerOpacity = useSharedValue(0);
  const contentBlur = useSharedValue(20); // Start blurred for materialization
  const contentOpacity = useSharedValue(0);
  const scale = useSharedValue(0.95);

  // Animate materialization when visible changes (Grok-quality springs)
  useEffect(() => {
    if (visible) {
      // Opening - Materialization effect with Grok-quality animations
      containerOpacity.value = withTiming(1, TIMING.contentFadeIn);
      scale.value = withSpring(1, GROK_SPRING);
      contentBlur.value = withTiming(0, TIMING.blurIn);
      contentOpacity.value = withDelay(50, withTiming(1, TIMING.contentFadeIn));
    } else {
      // Closing - Dematerialization with smooth springs
      contentOpacity.value = withTiming(0, TIMING.contentFadeOut);
      contentBlur.value = withTiming(10, TIMING.blurOut);
      scale.value = withSpring(0.97, { ...GROK_SPRING, duration: 200 });
      containerOpacity.value = withDelay(50, withTiming(0, TIMING.backdropFadeOut));
    }
  }, [visible]);

  // Container animated style
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: scale.value }],
  }));

  // Content animated style (for blur effect on content)
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  // Backdrop animated style (using consistent backdrop opacity)
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      containerOpacity.value,
      [0, 1],
      [0, BACKDROP.popover],
      Extrapolate.CLAMP
    ),
  }));

  // Handle mode selection
  const selectMode = (mode: FilterMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFiltersChange({ ...filters, mode });
    // Auto-close after selection (like iOS Phone app)
    setTimeout(() => onClose(), 150);
  };

  // Handle opening advanced filters
  const handleOpenAdvanced = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    setTimeout(() => onOpenAdvanced?.(), 200);
  };

  // Calculate popover position
  const popoverWidth = 200;
  const popoverLeft = Math.max(
    Spacing.md,
    Math.min(anchorPosition.x - popoverWidth + 24, SCREEN_WIDTH - popoverWidth - Spacing.md)
  );
  const popoverTop = anchorPosition.y + 8;

  if (!visible) return null;

  // Glass container - Tiered approach:
  // Tier 1: iOS 26+ Liquid Glass (best quality)
  // Tier 2: Skia GPU-accelerated BackdropBlur (excellent cross-platform)
  // Tier 3: expo-blur BlurView (fallback)
  const GlassBackground = ({ children }: { children: React.ReactNode }) => {
    // Tier 1: iOS 26+ Liquid Glass
    if (isLiquidGlassSupported && LiquidGlassView) {
      return (
        <LiquidGlassView
          style={styles.glassContainer}
        >
          {children}
        </LiquidGlassView>
      );
    }

    // Tier 2: Skia GPU-accelerated BackdropBlur
    if (isSkiaAvailable && Canvas && BackdropBlur && Fill) {
      const popoverWidth = 200;
      const popoverHeight = onOpenAdvanced ? 180 : 130; // Approximate height

      return (
        <View style={styles.glassContainer}>
          {/* Skia canvas for GPU-accelerated backdrop blur */}
          <Canvas style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.lg }]}>
            <BackdropBlur blur={15} clip={{ x: 0, y: 0, width: popoverWidth, height: popoverHeight }}>
              <Fill color={colorScheme === 'dark' ? 'rgba(30, 30, 30, 0.75)' : 'rgba(255, 255, 255, 0.75)'} />
            </BackdropBlur>
          </Canvas>
          <View style={styles.skiaContentContainer}>
            {children}
          </View>
        </View>
      );
    }

    // Tier 3: expo-blur fallback for older devices
    return (
      <BlurView
        intensity={colorScheme === 'dark' ? 80 : 90}
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
        style={styles.glassContainer}
      >
        <View
          style={[
            styles.fallbackGlassOverlay,
            {
              backgroundColor: colorScheme === 'dark'
                ? 'rgba(30, 30, 30, 0.85)'
                : 'rgba(255, 255, 255, 0.85)',
            },
          ]}
        >
          {children}
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

      {/* Popover with materialization */}
      <Animated.View
        style={[
          styles.popover,
          containerStyle,
          {
            left: popoverLeft,
            top: popoverTop,
            width: popoverWidth,
          },
        ]}
      >
        <GlassBackground>
          <Animated.View style={[styles.content, contentStyle]}>
            {/* Mode Selection - iOS Phone app style */}
            <View style={styles.modeSection}>
              {/* For You Option */}
              <TouchableOpacity
                onPress={() => selectMode('for_you')}
                style={[
                  styles.modeOption,
                  filters.mode === 'for_you' && styles.modeOptionSelected,
                  filters.mode === 'for_you' && { backgroundColor: BrandColors.loopBlue },
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="sparkles"
                  size={18}
                  color={filters.mode === 'for_you' ? '#FFFFFF' : colors.text}
                />
                <Text
                  style={[
                    styles.modeLabel,
                    { color: filters.mode === 'for_you' ? '#FFFFFF' : colors.text },
                  ]}
                >
                  For You
                </Text>
                {filters.mode === 'for_you' && (
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>

              {/* Explore Option */}
              <TouchableOpacity
                onPress={() => selectMode('explore')}
                style={[
                  styles.modeOption,
                  filters.mode === 'explore' && styles.modeOptionSelected,
                  filters.mode === 'explore' && { backgroundColor: BrandColors.loopPurple },
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="compass-outline"
                  size={18}
                  color={filters.mode === 'explore' ? '#FFFFFF' : colors.text}
                />
                <Text
                  style={[
                    styles.modeLabel,
                    { color: filters.mode === 'explore' ? '#FFFFFF' : colors.text },
                  ]}
                >
                  Explore
                </Text>
                {filters.mode === 'explore' && (
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>

            {/* Divider */}
            {onOpenAdvanced && (
              <>
                <View
                  style={[
                    styles.divider,
                    {
                      backgroundColor: colorScheme === 'dark'
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(0, 0, 0, 0.08)',
                    },
                  ]}
                />

                {/* More Filters Link */}
                <TouchableOpacity
                  onPress={handleOpenAdvanced}
                  style={styles.advancedButton}
                  activeOpacity={0.7}
                >
                  <View style={styles.advancedContent}>
                    <Ionicons
                      name="options-outline"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={[styles.advancedText, { color: colors.textSecondary }]}>
                      More Filters
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </GlassBackground>
      </Animated.View>
    </Modal>
  );
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
    // Transform origin at top-right for scale animation
    transformOrigin: 'top right',
  },
  glassContainer: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  fallbackGlassOverlay: {
    borderRadius: BorderRadius.lg,
  },
  skiaContentContainer: {
    position: 'relative',
    zIndex: 1,
  },
  content: {
    padding: Spacing.sm,
  },
  modeSection: {
    gap: Spacing.xs,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modeOptionSelected: {
    // Background color applied inline
  },
  modeLabel: {
    flex: 1,
    ...Typography.bodyMedium,
    fontFamily: 'Urbanist-SemiBold',
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  advancedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  advancedText: {
    ...Typography.labelMedium,
    fontFamily: 'Urbanist-Medium',
  },
});
