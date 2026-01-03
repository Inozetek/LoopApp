/**
 * Loop Header Component
 *
 * Snapchat-style header with centered Loop logo
 * Appears at the top of all main screens
 * Features: Swipe-down gesture to open dashboard, notification badge, blinking arrow hint
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Alert } from 'react-native';
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
import { useAuth } from '@/contexts/auth-context';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface LoopHeaderProps {
  showBackButton?: boolean;
  onBackPress?: () => void; // Custom back navigation handler
  showProfileButton?: boolean;
  onProfilePress?: () => void;
  showSettingsButton?: boolean;
  onSettingsPress?: () => void;
  rightAction?: React.ReactNode;
  onDashboardOpen?: () => void;
  onLogoPress?: () => void; // Open advanced search/filters
  notificationCount?: number;
  isLoading?: boolean; // Trigger continuous shimmer when loading
}

export function LoopHeader({
  showBackButton = false,
  onBackPress,
  showProfileButton = false,
  onProfilePress,
  showSettingsButton = true,
  onSettingsPress,
  rightAction,
  onDashboardOpen,
  onLogoPress,
  notificationCount = 0,
  isLoading = false,
}: LoopHeaderProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { signOut, user } = useAuth();

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
        duration: 1500, // RESTORED: 1500ms for smoother, more elegant shimmer (not 1000ms)
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      });
    };

    if (isLoading) {
      // Increased frequency when loading - repeat every 2.5 seconds
      // This allows the animation to complete fully (1500ms) before starting again
      const interval = setInterval(() => {
        runShimmer();
      }, 2500);

      // Run immediately
      runShimmer();

      return () => clearInterval(interval);
    } else {
      // Normal shimmer - every 12 seconds
      const initialTimeout = setTimeout(() => runShimmer(), 1000);
      const interval = setInterval(() => {
        runShimmer();
      }, 12000);

      return () => {
        clearTimeout(initialTimeout);
        clearInterval(interval);
      };
    }
  }, [isLoading]);

  const handleLogoPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onLogoPress) {
      // Custom action (e.g., open advanced search)
      onLogoPress();
    } else {
      // Default: return to For You feed (like Snapchat)
      router.push('/(tabs)');
    }
  };

  const handleDashboardOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onDashboardOpen) {
      onDashboardOpen();
    }
  };

  const handleSettingsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (onSettingsPress) {
      onSettingsPress();
      return;
    }

    // Default settings menu with logout option
    Alert.alert(
      'Settings',
      user?.name ? `Signed in as ${user.name}` : 'Account Options',
      [
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            const { error } = await signOut();
            if (error) {
              Alert.alert('Error', 'Failed to logout. Please try again.');
            } else {
              router.replace('/auth/login');
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
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
        {showBackButton ? (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (onBackPress) {
                onBackPress();
              } else {
                router.back();
              }
            }}
            style={styles.iconButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : showProfileButton ? (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onProfilePress?.();
            }}
            style={styles.iconButton}
          >
            <Ionicons name="person-circle-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : null}
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
              source={require('@/assets/images/loop-logo3.png')}
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
            onPress={handleSettingsPress}
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
