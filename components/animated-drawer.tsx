/**
 * AnimatedDrawer - Reusable Grok-style slide-in/slide-out drawer
 *
 * Extracted from MainMenuModal. Supports left or right side,
 * frosted-glass blur background, spring physics, pan gesture to close.
 *
 * The drawer panel is a transparent blur with a dark overlay that
 * animates in opacity — not a solid #0A0A0A rectangle.
 *
 * Usage:
 *   <AnimatedDrawer visible={visible} onClose={onClose} side="left">
 *     {children}
 *   </AnimatedDrawer>
 */

import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useDerivedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { GROK_SPRING, MENU_OPEN_SPRING, TIMING, MENU_DIMENSIONS, MENU_CONTENT_BLUR } from '@/constants/animations';
import { AnimatedBlurView, SUPPORTS_ANIMATED_BLUR, ANDROID_BLUR_METHOD } from '@/components/ui/animated-blur-view';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnimatedDrawerProps {
  visible: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  widthPercentage?: number;
  children: React.ReactNode;
  /** Optional shared value for syncing main content scale animation */
  menuProgress?: SharedValue<number>;
  /** When true, the drawer was opened by a gesture — skip the opening spring in useEffect */
  gestureControlled?: boolean;
}

export function AnimatedDrawer({
  visible,
  onClose,
  side = 'left',
  widthPercentage = MENU_DIMENSIONS.widthPercentage,
  children,
  menuProgress,
  gestureControlled = false,
}: AnimatedDrawerProps) {
  const colorScheme = useColorScheme();
  const drawerWidth = SCREEN_WIDTH * widthPercentage;

  // Off-screen position depends on side
  const offscreenX = side === 'left' ? -drawerWidth : drawerWidth;

  const translateX = useSharedValue(offscreenX);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // If gesture-controlled, the gesture already drove menuProgress and translateX
      // — don't run the opening spring (it would fight the gesture position).
      if (!gestureControlled) {
        // Programmatic open (icon press) — use slower, premium spring
        translateX.value = withSpring(0, MENU_OPEN_SPRING);
        backdropOpacity.value = withTiming(MENU_CONTENT_BLUR.backdropOpacity, TIMING.backdropFadeIn);
        if (menuProgress) {
          menuProgress.value = withSpring(1, MENU_OPEN_SPRING);
        }
      }
    } else {
      translateX.value = withSpring(offscreenX, { ...GROK_SPRING, duration: 250 });
      backdropOpacity.value = withTiming(0, TIMING.backdropFadeOut);
      if (menuProgress) {
        menuProgress.value = withSpring(0, { ...GROK_SPRING, duration: 250 });
      }
    }
  }, [visible]);

  // When gesture-controlled, derive translateX from menuProgress to keep them in sync
  useDerivedValue(() => {
    if (gestureControlled && visible) {
      const progress = menuProgress ? menuProgress.value : 0;
      translateX.value = interpolate(progress, [0, 1], [offscreenX, 0], Extrapolate.CLAMP);
      backdropOpacity.value = interpolate(progress, [0, 1], [0, MENU_CONTENT_BLUR.backdropOpacity], Extrapolate.CLAMP);
    }
  });

  // Pan gesture for interactive closing
  const panGesture = Gesture.Pan()
    .activeOffsetX(side === 'left' ? -10 : 10)
    .onUpdate((event) => {
      const tx = event.translationX;
      if (side === 'left') {
        // Swiping left to close
        if (tx < 0) {
          const clampedX = Math.max(-drawerWidth, tx);
          translateX.value = clampedX;
          const progress = 1 + clampedX / drawerWidth;
          backdropOpacity.value = interpolate(progress, [0, 1], [0, MENU_CONTENT_BLUR.backdropOpacity], Extrapolate.CLAMP);
          if (menuProgress) {
            menuProgress.value = progress;
          }
        }
      } else {
        // Swiping right to close
        if (tx > 0) {
          const clampedX = Math.min(drawerWidth, tx);
          translateX.value = clampedX;
          const progress = 1 - clampedX / drawerWidth;
          backdropOpacity.value = interpolate(progress, [0, 1], [0, MENU_CONTENT_BLUR.backdropOpacity], Extrapolate.CLAMP);
          if (menuProgress) {
            menuProgress.value = progress;
          }
        }
      }
    })
    .onEnd((event) => {
      const threshold = drawerWidth * MENU_DIMENSIONS.dragThreshold;
      const velocityThreshold = MENU_DIMENSIONS.velocityThreshold;

      let shouldClose: boolean;
      if (side === 'left') {
        shouldClose =
          event.translationX < -threshold ||
          event.velocityX < -velocityThreshold;
      } else {
        shouldClose =
          event.translationX > threshold ||
          event.velocityX > velocityThreshold;
      }

      if (shouldClose) {
        if (menuProgress) {
          menuProgress.value = withSpring(0, { ...GROK_SPRING, duration: 250 });
        }
        runOnJS(onClose)();
      } else {
        translateX.value = withSpring(0, GROK_SPRING);
        backdropOpacity.value = withTiming(MENU_CONTENT_BLUR.backdropOpacity, TIMING.backdropFadeIn);
        if (menuProgress) {
          menuProgress.value = withSpring(1, GROK_SPRING);
        }
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Drawer panel blur: intensity animates with menu progress
  const drawerBlurProps = useAnimatedProps(() => ({
    intensity: SUPPORTS_ANIMATED_BLUR
      ? interpolate(
          menuProgress ? menuProgress.value : (visible ? 1 : 0),
          [0, 1],
          [0, MENU_CONTENT_BLUR.drawerBlurIntensity],
          Extrapolate.CLAMP,
        )
      : MENU_CONTENT_BLUR.drawerBlurIntensity,
  }));

  // Dark overlay on the drawer panel: fades from drawerMinOpacity → drawerMaxOpacity
  const drawerOverlayStyle = useAnimatedStyle(() => {
    const progress = menuProgress ? menuProgress.value : (visible ? 1 : 0);
    return {
      opacity: interpolate(
        progress,
        [0, 1],
        [MENU_CONTENT_BLUR.drawerMinOpacity, MENU_CONTENT_BLUR.drawerMaxOpacity],
        Extrapolate.CLAMP,
      ),
    };
  });

  // Drawer blur visibility (for Android opacity fallback)
  const drawerBlurStyle = useAnimatedStyle(() => {
    if (SUPPORTS_ANIMATED_BLUR) return { opacity: 1 };
    const progress = menuProgress ? menuProgress.value : (visible ? 1 : 0);
    return {
      opacity: interpolate(progress, [0, 1], [0, 1], Extrapolate.CLAMP),
    };
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        {/* Backdrop - tap to close */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </TouchableWithoutFeedback>

        {/* Drawer panel */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.drawer,
              drawerStyle,
              {
                width: drawerWidth,
                [side === 'left' ? 'left' : 'right']: 0,
              },
            ]}
          >
            {/* Frosted glass blur on top for subtle texture during transition */}
            <AnimatedBlurView
              animatedProps={drawerBlurProps}
              tint="dark"
              experimentalBlurMethod={ANDROID_BLUR_METHOD}
              style={[StyleSheet.absoluteFill, drawerBlurStyle]}
            />
            {/* Dark overlay on top of blur */}
            <Animated.View
              style={[
                styles.drawerOverlay,
                drawerOverlayStyle,
                {
                  backgroundColor:
                    colorScheme === 'dark'
                      ? '#0A0A0A'
                      : '#111111',
                },
              ]}
            />

            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
