/**
 * AnimatedDrawer - Reusable Grok-style slide-in/slide-out drawer
 *
 * Extracted from MainMenuModal. Supports left or right side,
 * glass blur background, spring physics, pan gesture to close.
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
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { GROK_SPRING, TIMING, MENU_DIMENSIONS, BLUR } from '@/constants/animations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnimatedDrawerProps {
  visible: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  widthPercentage?: number;
  children: React.ReactNode;
  /** Optional shared value for syncing main content scale animation */
  menuProgress?: SharedValue<number>;
}

export function AnimatedDrawer({
  visible,
  onClose,
  side = 'left',
  widthPercentage = MENU_DIMENSIONS.widthPercentage,
  children,
  menuProgress,
}: AnimatedDrawerProps) {
  const colorScheme = useColorScheme();
  const drawerWidth = SCREEN_WIDTH * widthPercentage;

  // Off-screen position depends on side
  const offscreenX = side === 'left' ? -drawerWidth : drawerWidth;

  const translateX = useSharedValue(offscreenX);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateX.value = withSpring(0, GROK_SPRING);
      backdropOpacity.value = withTiming(0.5, TIMING.backdropFadeIn);
      if (menuProgress) {
        menuProgress.value = withSpring(1, GROK_SPRING);
      }
    } else {
      translateX.value = withSpring(offscreenX, { ...GROK_SPRING, duration: 250 });
      backdropOpacity.value = withTiming(0, TIMING.backdropFadeOut);
      if (menuProgress) {
        menuProgress.value = withSpring(0, { ...GROK_SPRING, duration: 250 });
      }
    }
  }, [visible]);

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
          backdropOpacity.value = interpolate(progress, [0, 1], [0, 0.5], Extrapolate.CLAMP);
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
          backdropOpacity.value = interpolate(progress, [0, 1], [0, 0.5], Extrapolate.CLAMP);
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
        backdropOpacity.value = withTiming(0.5, TIMING.backdropFadeIn);
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
            {/* Glass blur background */}
            <BlurView
              intensity={Platform.OS === 'ios' ? BLUR.menuIntensityIOS : BLUR.menuIntensityAndroid}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.drawerBackground,
                {
                  backgroundColor:
                    colorScheme === 'dark'
                      ? `rgba(20, 20, 20, ${BLUR.overlayOpacityDark})`
                      : `rgba(255, 255, 255, ${BLUR.overlayOpacityLight})`,
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
  },
  drawerBackground: {
    ...StyleSheet.absoluteFillObject,
  },
});
