/**
 * Loop Header Component
 *
 * Snapchat-style header with centered Loop logo
 * Appears at the top of all main screens
 * Features: Swipe-down gesture to open dashboard, notification badge, blinking arrow hint
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  runOnJS,
  interpolate,
  Extrapolate,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BrandColors, Spacing, Shadows } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface LoopHeaderProps {
  showBackButton?: boolean;
  showSettingsButton?: boolean;
  onSettingsPress?: () => void;
  rightAction?: React.ReactNode;
  onDashboardOpen?: () => void;
  notificationCount?: number;
}

export function LoopHeader({
  showBackButton = false,
  showSettingsButton = true,
  onSettingsPress,
  rightAction,
  onDashboardOpen,
  notificationCount = 0,
}: LoopHeaderProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  // Animated values for swipe gesture
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // Blinking arrow animation - shows on load and when there are notifications
  const arrowOpacity = useSharedValue(0);
  const [hasInitialBlink, setHasInitialBlink] = React.useState(false);

  // Shimmer animation for border glow effect
  const shimmerTranslate = useSharedValue(-SCREEN_WIDTH);

  useEffect(() => {
    // Function to start the blinking animation
    const startBlinking = () => {
      arrowOpacity.value = withSequence(
        withTiming(1, { duration: 300 }), // Fade in
        withRepeat(
          withSequence(
            withTiming(0.4, { duration: 500 }),
            withTiming(1, { duration: 500 })
          ),
          4, // Blink 4 times over ~4 seconds
          false
        ),
        withTiming(0, { duration: 300 }) // Fade out
      );
    };

    // Always blink on initial mount (show users the feature exists)
    if (!hasInitialBlink && onDashboardOpen) {
      setHasInitialBlink(true);
      setTimeout(() => startBlinking(), 300);
    }

    // Continue blinking every 60 seconds if there are notifications
    if (notificationCount > 0) {
      const interval = setInterval(() => {
        startBlinking();
      }, 60000); // 60 seconds

      return () => clearInterval(interval);
    }
  }, [notificationCount, hasInitialBlink, onDashboardOpen]);

  // Shimmer effect - subtle glow that moves across border periodically
  useEffect(() => {
    const runShimmer = () => {
      shimmerTranslate.value = -SCREEN_WIDTH;
      shimmerTranslate.value = withTiming(SCREEN_WIDTH, {
        duration: 2000,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      });
    };

    // Initial shimmer after 1 second
    const initialTimeout = setTimeout(() => runShimmer(), 1000);

    // Repeat every 8 seconds
    const interval = setInterval(() => {
      runShimmer();
    }, 8000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const handleLogoPress = () => {
    // Tapping logo returns to For You feed (like Snapchat)
    router.push('/(tabs)');
  };

  const handleDashboardOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onDashboardOpen) {
      onDashboardOpen();
    }
  };

  // Swipe-down gesture from logo area
  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((event) => {
      // Only allow downward swipes
      if (event.translationY > 0) {
        translateY.value = event.translationY * 0.5; // Dampening effect
      }
    })
    .onEnd((event) => {
      isDragging.value = false;

      // Trigger dashboard if swiped down more than 50px or fast velocity
      if (event.translationY > 50 || event.velocityY > 800) {
        runOnJS(handleDashboardOpen)();
      }

      // Reset position
      translateY.value = withSpring(0, {
        damping: 15,
        stiffness: 150,
      });
    })
    .runOnJS(true);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Blinking arrow style
  const blinkingArrowStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.value,
  }));

  // Shimmer style
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTranslate.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.sm }]}>
      {/* Left Side */}
      <View style={styles.leftSection}>
        {showBackButton && (
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Center - Loop Logo with Swipe Gesture */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.logoContainer, animatedStyle]}>
          <TouchableOpacity
            onPress={handleLogoPress}
            activeOpacity={0.7}
            style={styles.logoTouchable}
          >
            <Image
              source={require('@/assets/images/loop-logo6.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            {/* Notification Badge */}
            {notificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Text>
              </View>
            )}

            {/* Blinking Arrow Hint (appears every 1 min for 5 sec) */}
            {onDashboardOpen && (
              <Animated.View style={[styles.blinkingArrow, blinkingArrowStyle]}>
                <Ionicons name="chevron-down" size={16} color={BrandColors.loopBlue} />
              </Animated.View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>

      {/* Right Side */}
      <View style={styles.rightSection}>
        {rightAction ? (
          rightAction
        ) : showSettingsButton ? (
          <TouchableOpacity
            onPress={onSettingsPress}
            style={styles.iconButton}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Shimmer Glow Effect on Border */}
      <View style={styles.shimmerContainer} pointerEvents="none">
        <Animated.View style={[styles.shimmerWrapper, shimmerStyle]}>
          <LinearGradient
            colors={[
              'rgba(0, 191, 255, 0)',
              'rgba(0, 191, 255, 0.4)',
              'rgba(0, 191, 255, 0.7)',
              'rgba(0, 191, 255, 0.4)',
              'rgba(0, 191, 255, 0)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shimmerGradient}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 191, 255, 0.1)',
    ...Shadows.sm,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  logoContainer: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTouchable: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    height: 32,
    width: 80,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  iconButton: {
    padding: Spacing.sm,
  },
  // Notification Badge
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#FF6B9D',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    includeFontPadding: false,
  },
  // Blinking Arrow (larger, more prominent)
  blinkingArrow: {
    position: 'absolute',
    bottom: -16,
    alignSelf: 'center',
  },
  // Shimmer glow effect
  shimmerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    overflow: 'hidden',
  },
  shimmerWrapper: {
    width: SCREEN_WIDTH * 0.4, // Shimmer gradient width
    height: 1,
  },
  shimmerGradient: {
    flex: 1,
    height: 1,
  },
});
