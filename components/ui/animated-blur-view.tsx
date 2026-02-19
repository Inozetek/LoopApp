/**
 * AnimatedBlurView - Reanimated-compatible BlurView
 *
 * Platform-aware animated blur:
 * - iOS: Animates `intensity` via useAnimatedProps (smooth Core Image blur)
 * - Android: Animates `intensity` via dimezisBlurView RenderEffect (API 31+)
 * - Web: Fixed intensity with animated opacity (no native blur support)
 *
 * Usage:
 *   const blurProps = useAnimatedProps(() => ({ intensity: progress.value * 50 }));
 *   const blurStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
 *   <AnimatedBlurView animatedProps={blurProps} style={blurStyle} tint="dark" />
 */

import { Platform } from 'react-native';
import { BlurView, BlurViewProps } from 'expo-blur';
import ReanimatedModule, { AnimatedProps } from 'react-native-reanimated';

const Animated = ReanimatedModule;

/**
 * Animated.createAnimatedComponent(BlurView) for native intensity animation.
 * On web, use this with a fixed intensity and animate opacity instead.
 */
export const AnimatedBlurView = Animated.createAnimatedComponent(BlurView) as
  React.ComponentClass<AnimatedProps<BlurViewProps>>;

/**
 * Whether the platform supports smooth animated blur intensity.
 * iOS: true (Core Image blur)
 * Android: true (dimezisBlurView RenderEffect, API 31+)
 * Web: false (use opacity fallback)
 */
export const SUPPORTS_ANIMATED_BLUR = Platform.OS !== 'web';

/**
 * Whether the platform supports animating blur intensity from high → 0
 * for materialization effects (content emerging from blur to sharp).
 * iOS: true  — Core Image blur intensity is independent of tint overlay
 * Android: false — dimezisBlurView ties tint opacity to intensity, so
 *          reducing intensity to 0 removes both blur AND the dark tint,
 *          making the panel transparent rather than sharp. Use opacity
 *          fallback instead.
 * Web: false
 */
export const SUPPORTS_MATERIALIZATION_BLUR = Platform.OS === 'ios';

/**
 * Android experimental blur method for expo-blur's `experimentalBlurMethod`.
 * Uses the dimezis library on Android for better blur quality.
 * Undefined on other platforms (uses default).
 */
export const ANDROID_BLUR_METHOD: 'dimezisBlurView' | undefined =
  Platform.OS === 'android' ? 'dimezisBlurView' : undefined;
