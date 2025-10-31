/**
 * Loop Header Component
 *
 * Snapchat-style header with centered Loop logo
 * Appears at the top of all main screens
 * Features: Swipe-down gesture to open dashboard, notification badge, blinking arrow hint
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
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
  Extrapolate
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BrandColors, Spacing, Shadows } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

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

  // Blinking arrow animation - shows for 5 seconds every 1 minute when there are notifications
  const arrowOpacity = useSharedValue(0);

  useEffect(() => {
    // Only blink if there are unread notifications
    if (notificationCount === 0) {
      arrowOpacity.value = 0;
      return;
    }

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

    // Start immediately on mount (when notifications exist)
    startBlinking();

    // Repeat every 60 seconds
    const interval = setInterval(() => {
      startBlinking();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [notificationCount]); // Re-run when notification count changes

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
});
