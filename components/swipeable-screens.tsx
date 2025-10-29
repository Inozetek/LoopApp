import React, { useRef } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Spring configuration for smooth, snappy animations (60fps)
const SPRING_CONFIG = {
  damping: 25,
  stiffness: 200,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

// Gesture thresholds
const SWIPE_VELOCITY_THRESHOLD = 500; // pixels/second
const SWIPE_DISTANCE_THRESHOLD = SCREEN_WIDTH * 0.25; // 25% of screen width

interface SwipeableScreensProps {
  leftScreen: React.ReactNode;
  centerScreen: React.ReactNode;
  rightScreen: React.ReactNode;
  onScreenChange?: (screenIndex: number) => void;
}

export function SwipeableScreens({
  leftScreen,
  centerScreen,
  rightScreen,
  onScreenChange,
}: SwipeableScreensProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Current screen index (0 = left/friends, 1 = center/feed, 2 = right/calendar)
  const currentScreen = useSharedValue(1);
  const translateX = useSharedValue(-SCREEN_WIDTH); // Start at center screen

  const handleScreenChange = (screenIndex: number) => {
    onScreenChange?.(screenIndex);
  };

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      // Calculate new position based on gesture
      const newTranslateX = -SCREEN_WIDTH * currentScreen.value + event.translationX;

      // Apply boundaries (can't swipe beyond first/last screen)
      const minX = -SCREEN_WIDTH * 2; // Rightmost position (calendar screen)
      const maxX = 0; // Leftmost position (friends screen)

      translateX.value = Math.max(minX, Math.min(maxX, newTranslateX));
    })
    .onEnd((event) => {
      const velocity = event.velocityX;
      const translation = event.translationX;

      // Determine target screen based on velocity or distance
      let targetScreen = currentScreen.value;

      // Fast swipe (velocity-based)
      if (Math.abs(velocity) > SWIPE_VELOCITY_THRESHOLD) {
        if (velocity > 0 && currentScreen.value > 0) {
          targetScreen = currentScreen.value - 1; // Swipe right
        } else if (velocity < 0 && currentScreen.value < 2) {
          targetScreen = currentScreen.value + 1; // Swipe left
        }
      }
      // Slow swipe (distance-based)
      else {
        if (translation > SWIPE_DISTANCE_THRESHOLD && currentScreen.value > 0) {
          targetScreen = currentScreen.value - 1; // Swipe right
        } else if (translation < -SWIPE_DISTANCE_THRESHOLD && currentScreen.value < 2) {
          targetScreen = currentScreen.value + 1; // Swipe left
        }
      }

      // Snap to target screen
      currentScreen.value = targetScreen;
      translateX.value = withSpring(-SCREEN_WIDTH * targetScreen, SPRING_CONFIG);

      // Notify parent of screen change
      runOnJS(handleScreenChange)(targetScreen);
    })
    .activeOffsetX([-10, 10]) // Require 10px horizontal movement to activate
    .failOffsetY([-20, 20]); // Fail if vertical movement exceeds 20px (allows scrolling)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Animated styles for indicator dots
  const getDotStyle = (index: number) => {
    return useAnimatedStyle(() => {
      const isActive = currentScreen.value === index;
      const opacity = interpolate(
        Math.abs(currentScreen.value - index),
        [0, 1],
        [1, 0.3],
        Extrapolation.CLAMP
      );

      const scale = interpolate(
        Math.abs(currentScreen.value - index),
        [0, 1],
        [1, 0.6],
        Extrapolation.CLAMP
      );

      return {
        opacity,
        transform: [{ scale }],
      };
    });
  };

  return (
    <View style={styles.container}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.screensContainer, animatedStyle]}>
          {/* Left Screen (Friends) */}
          <View style={[styles.screen, { backgroundColor: colors.background }]}>
            {leftScreen}
          </View>

          {/* Center Screen (Feed) - Home */}
          <View style={[styles.screen, { backgroundColor: colors.background }]}>
            {centerScreen}
          </View>

          {/* Right Screen (Calendar) */}
          <View style={[styles.screen, { backgroundColor: colors.background }]}>
            {rightScreen}
          </View>
        </Animated.View>
      </GestureDetector>

      {/* Screen Indicator Dots */}
      <View style={[styles.indicatorContainer, { backgroundColor: colors.background }]}>
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: colors.icon },
            getDotStyle(0),
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: colors.tint },
            getDotStyle(1),
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: colors.icon },
            getDotStyle(2),
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screensContainer: {
    flex: 1,
    flexDirection: 'row',
    width: SCREEN_WIDTH * 3, // Three screens side by side
  },
  screen: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  indicatorContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 90 : 70, // Above tab bar
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
