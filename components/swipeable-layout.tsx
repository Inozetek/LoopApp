/**
 * Swipeable Layout Wrapper
 * Enables Snapchat-style swipe navigation between tabs
 * Edge-based swipes with drag-to-reveal animation
 */

import React, { useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EDGE_ZONE = 50; // Pixels from edge where swipe can start
const SWIPE_THRESHOLD = 60; // Minimum distance to trigger navigation
const VELOCITY_THRESHOLD = 600; // Minimum velocity for quick swipes
const TRANSLATION_RATIO = 0.8; // How much screen moves with drag (0.8 = 80% follows, Snapchat-like)

interface SwipeableLayoutProps {
  children: React.ReactNode;
}

function SwipeableLayout({ children }: SwipeableLayoutProps) {
  const router = useRouter();
  const segments = useSegments();
  const startXRef = useRef(0);
  const isEdgeSwipeRef = useRef(false);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const getCurrentScreen = (): number => {
    const lastSegment = segments[segments.length - 1];
    if (lastSegment === 'calendar') return 0;
    if (lastSegment === '(tabs)' || !lastSegment) return 1; // Default to feed
    if (lastSegment === 'friends') return 2;
    return 1; // Default to feed
  };

  const navigateToScreen = (screenIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (screenIndex === 0) {
      router.push('/(tabs)/calendar');
    } else if (screenIndex === 1) {
      router.push('/(tabs)');
    } else if (screenIndex === 2) {
      router.push('/(tabs)/friends');
    }
  };

  const resetAnimation = () => {
    translateX.value = withSpring(0, { damping: 25, stiffness: 400 });
    opacity.value = withSpring(1, { damping: 25, stiffness: 400 });
  };

  const panGesture = Gesture.Pan()
    .onBegin((event) => {
      // Store starting X position
      startXRef.current = event.absoluteX;

      // Check if swipe started from edge
      const fromLeftEdge = event.absoluteX < EDGE_ZONE;
      const fromRightEdge = event.absoluteX > SCREEN_WIDTH - EDGE_ZONE;

      isEdgeSwipeRef.current = fromLeftEdge || fromRightEdge;
    })
    .onUpdate((event) => {
      // Only animate if started from edge
      if (!isEdgeSwipeRef.current) return;

      const currentScreen = getCurrentScreen();
      const { translationX: tx } = event;

      // Swipe from left edge - reveal previous screen
      if (startXRef.current < EDGE_ZONE && currentScreen > 0 && tx > 0) {
        translateX.value = Math.min(tx * TRANSLATION_RATIO, SCREEN_WIDTH * TRANSLATION_RATIO);
        opacity.value = Math.max(0.85, 1 - (tx / SCREEN_WIDTH) * 0.15); // More subtle fade
      }
      // Swipe from right edge - reveal next screen
      else if (startXRef.current > SCREEN_WIDTH - EDGE_ZONE && currentScreen < 2 && tx < 0) {
        translateX.value = Math.max(tx * TRANSLATION_RATIO, -SCREEN_WIDTH * TRANSLATION_RATIO);
        opacity.value = Math.max(0.85, 1 - (Math.abs(tx) / SCREEN_WIDTH) * 0.15); // More subtle fade
      }
    })
    .onEnd((event) => {
      // Only process if started from edge
      if (!isEdgeSwipeRef.current) {
        runOnJS(resetAnimation)();
        return;
      }

      const { translationX: tx, velocityX } = event;
      const currentScreen = getCurrentScreen();

      // Determine if swipe is strong enough
      const isQuickSwipe = Math.abs(velocityX) > VELOCITY_THRESHOLD;
      const isLongSwipe = Math.abs(tx) > SWIPE_THRESHOLD;

      let shouldNavigate = false;

      // Swipe right from left edge (go to previous screen)
      if (tx > 0 && startXRef.current < EDGE_ZONE && currentScreen > 0 && (isQuickSwipe || isLongSwipe)) {
        shouldNavigate = true;
        runOnJS(navigateToScreen)(currentScreen - 1);
      }
      // Swipe left from right edge (go to next screen)
      else if (tx < 0 && startXRef.current > SCREEN_WIDTH - EDGE_ZONE && currentScreen < 2 && (isQuickSwipe || isLongSwipe)) {
        shouldNavigate = true;
        runOnJS(navigateToScreen)(currentScreen + 1);
      }

      // Reset animation if not navigating
      if (!shouldNavigate) {
        runOnJS(resetAnimation)();
      } else {
        // Smooth transition to new screen
        translateX.value = withSpring(0, { damping: 25, stiffness: 400 });
        opacity.value = withSpring(1, { damping: 25, stiffness: 400 });
      }
    })
    .runOnJS(true);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

// Default export required by Expo Router
export default SwipeableLayout;
