/**
 * Side Menu Drawer Component
 *
 * Grok-style side menu with premium animations:
 * - Menu slides in from left
 * - Main content scales down (0.92) and shifts right
 * - Blur backdrop appears between layers
 * - Spring animation with minimal bounce
 * - Interactive gesture (swipe from left edge to close)
 */

import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
  Extrapolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { GROK_SPRING, TIMING, MENU_DIMENSIONS, SCALES, BLUR } from '@/constants/animations';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MENU_WIDTH = SCREEN_WIDTH * MENU_DIMENSIONS.widthPercentage;

interface SideMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  menuContent: React.ReactNode;
  children: React.ReactNode;
}

export function SideMenuDrawer({
  isOpen,
  onClose,
  menuContent,
  children,
}: SideMenuDrawerProps) {
  // Animation values
  const translateX = useSharedValue(-MENU_WIDTH);
  const mainContentScale = useSharedValue(1);
  const mainContentTranslateX = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  // Animate on open/close
  useEffect(() => {
    if (isOpen) {
      // Opening - Grok-style spring animation
      translateX.value = withSpring(0, GROK_SPRING);
      mainContentScale.value = withSpring(SCALES.menuOpen, GROK_SPRING);
      mainContentTranslateX.value = withSpring(
        MENU_WIDTH * MENU_DIMENSIONS.contentOffsetPercentage,
        GROK_SPRING
      );
      backdropOpacity.value = withTiming(0.4, TIMING.backdropFadeIn);
    } else {
      // Closing - Faster spring for snappy close
      translateX.value = withSpring(-MENU_WIDTH, { ...GROK_SPRING, duration: 250 });
      mainContentScale.value = withSpring(1, { ...GROK_SPRING, duration: 250 });
      mainContentTranslateX.value = withSpring(0, { ...GROK_SPRING, duration: 250 });
      backdropOpacity.value = withTiming(0, TIMING.backdropFadeOut);
    }
  }, [isOpen]);

  // Pan gesture for interactive closing
  const panGesture = Gesture.Pan()
    .activeOffsetX(-10) // Only activate on leftward swipe
    .onUpdate((event) => {
      if (event.translationX < 0) {
        // Dragging left to close
        const clampedX = Math.max(-MENU_WIDTH, event.translationX);
        translateX.value = clampedX;

        // Calculate progress (0 = fully open, 1 = fully closed)
        const progress = 1 + clampedX / MENU_WIDTH;

        // Interpolate other animations based on progress
        mainContentScale.value = interpolate(
          progress,
          [0, 1],
          [1, SCALES.menuOpen],
          Extrapolate.CLAMP
        );
        mainContentTranslateX.value = interpolate(
          progress,
          [0, 1],
          [0, MENU_WIDTH * MENU_DIMENSIONS.contentOffsetPercentage],
          Extrapolate.CLAMP
        );
        backdropOpacity.value = interpolate(
          progress,
          [0, 1],
          [0, 0.4],
          Extrapolate.CLAMP
        );
      }
    })
    .onEnd((event) => {
      const shouldClose =
        event.translationX < -MENU_WIDTH * MENU_DIMENSIONS.dragThreshold ||
        event.velocityX < -MENU_DIMENSIONS.velocityThreshold;

      if (shouldClose) {
        // Close the menu
        runOnJS(onClose)();
      } else {
        // Snap back open
        translateX.value = withSpring(0, GROK_SPRING);
        mainContentScale.value = withSpring(SCALES.menuOpen, GROK_SPRING);
        mainContentTranslateX.value = withSpring(
          MENU_WIDTH * MENU_DIMENSIONS.contentOffsetPercentage,
          GROK_SPRING
        );
        backdropOpacity.value = withTiming(0.4, TIMING.backdropFadeIn);
      }
    });

  // Animated styles
  const menuStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const mainContentStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: mainContentScale.value },
      { translateX: mainContentTranslateX.value },
    ],
    borderRadius: interpolate(
      mainContentScale.value,
      [SCALES.menuOpen, 1],
      [MENU_DIMENSIONS.contentBorderRadius, 0],
      Extrapolate.CLAMP
    ),
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Main content (scales down when menu opens) */}
      <Animated.View style={[styles.mainContent, mainContentStyle]}>
        {children}
      </Animated.View>

      {/* Dark overlay (tap to close) - only visible when menu is open */}
      {isOpen && (
        <Animated.View
          style={[styles.backdrop, backdropStyle]}
          pointerEvents={isOpen ? 'auto' : 'none'}
        >
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        </Animated.View>
      )}

      {/* Menu drawer */}
      {isOpen && (
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.menu, menuStyle]}>
            {/* Glass blur effect for menu background */}
            <BlurView
              intensity={Platform.OS === 'ios' ? BLUR.menuIntensityIOS : BLUR.menuIntensityAndroid}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            {/* Solid background overlay for better readability */}
            <View style={styles.menuBackground} />
            {/* Menu content */}
            <View style={styles.menuContentContainer}>
              {menuContent}
            </View>
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Dark background visible when content scales
  },
  mainContent: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#fff', // Fallback, will be overridden by children
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 1,
  },
  menu: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: MENU_WIDTH,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    zIndex: 2,
  },
  menuBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `rgba(20, 20, 20, ${BLUR.overlayOpacityDark})`,
  },
  menuContentContainer: {
    flex: 1,
  },
});
