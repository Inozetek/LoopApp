/**
 * Loop Header Component
 *
 * Redesigned header: [Avatar] [Loop Logo] [Search]
 * - Left: Profile avatar with notification badge overlay
 * - Center: Loop logo (tap to scroll to top / refresh)
 * - Right: Search icon (opens AdvancedSearchModal)
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  interpolate,
  interpolateColor,
  Extrapolate,
  Easing,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BrandColors, Spacing, Shadows } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { LoopLogoVariant } from '@/components/loop-logo-variant';

const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * Custom hamburger icon — 3 horizontal bars with slight asymmetry for character.
 * Top & bottom bars are 20px wide, middle bar is 16px. Grok-style.
 */
function HamburgerIcon({ color }: { color: string }) {
  return (
    <View style={hamburgerStyles.container}>
      <View style={[hamburgerStyles.bar, hamburgerStyles.barTop, { backgroundColor: color }]} />
      <View style={[hamburgerStyles.bar, hamburgerStyles.barMid, { backgroundColor: color }]} />
      <View style={[hamburgerStyles.bar, hamburgerStyles.barBot, { backgroundColor: color }]} />
    </View>
  );
}

const hamburgerStyles = StyleSheet.create({
  container: {
    width: 20,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 4.5,
  },
  bar: {
    height: 2,
    borderRadius: 1,
  },
  barTop: { width: 20 },
  barMid: { width: 16 },
  barBot: { width: 20 },
});

function FilterIcon({ color }: { color: string }) {
  return (
    <View style={filterIconStyles.container}>
      <View style={[filterIconStyles.line, filterIconStyles.lineTop, { backgroundColor: color }]} />
      <View style={[filterIconStyles.line, filterIconStyles.lineMid, { backgroundColor: color }]} />
      <View style={[filterIconStyles.line, filterIconStyles.lineBot, { backgroundColor: color }]} />
    </View>
  );
}

const filterIconStyles = StyleSheet.create({
  container: {
    width: 18,
    alignItems: 'center',
    gap: 2,
  },
  line: {
    borderRadius: 0.5,
  },
  lineTop: { width: 17, height: 1 },
  lineMid: { width: 15, height: 1 },
  lineBot: { width: 12, height: 1 },
});

interface LoopHeaderProps {
  showBackButton?: boolean;
  onBackPress?: () => void;
  // Profile avatar (left side) — opens Profile Drawer
  showProfileAvatar?: boolean;
  onProfilePress?: () => void;
  // Legacy: Menu button support for non-home screens
  showMenuButton?: boolean;
  onMenuPress?: () => void;
  isMenuOpen?: boolean;
  // Search button (right side) — opens AdvancedSearchModal
  showSearchButton?: boolean;
  onSearchPress?: () => void;
  hasActiveFilters?: boolean; // Shows dot indicator when filters are active
  // Legacy: Filter button support for screens that haven't migrated
  showFilterButton?: boolean;
  onFilterPress?: (position: { x: number; y: number }) => void;
  isFilterActive?: boolean;
  // Legacy: Other buttons
  showSettingsButton?: boolean;
  onSettingsPress?: () => void;
  showNotificationBell?: boolean;
  onNotificationPress?: () => void;
  showAddButton?: boolean;
  onAddPress?: () => void;
  rightAction?: React.ReactNode;
  onDashboardOpen?: () => void;
  onLogoPress?: () => void;
  notificationCount?: number;
  isLoading?: boolean;
  showProfileButton?: boolean;
  // Chat button (right side) — navigates to chat list
  showChatButton?: boolean;
  onChatPress?: () => void;
  chatBadgeCount?: number;
  // Swipe-to-open gesture callbacks on hamburger button
  onMenuDrag?: (translationX: number) => void;
  onMenuDragEnd?: (translationX: number, velocityX: number) => void;
  // Menu animation progress (0→1) — keeps button enlarged while menu is open/dragging
  menuProgress?: SharedValue<number>;
}

export function LoopHeader({
  showBackButton = false,
  onBackPress,
  showProfileAvatar = false,
  onProfilePress,
  showMenuButton = false,
  onMenuPress,
  isMenuOpen = false,
  showSearchButton = false,
  onSearchPress,
  hasActiveFilters = false,
  showFilterButton = false,
  onFilterPress,
  isFilterActive = false,
  showSettingsButton = false,
  onSettingsPress,
  showNotificationBell = false,
  onNotificationPress,
  showAddButton = false,
  onAddPress,
  rightAction,
  onDashboardOpen,
  onLogoPress,
  notificationCount = 0,
  isLoading = false,
  showProfileButton = false,
  showChatButton = false,
  onChatPress,
  chatBadgeCount = 0,
  onMenuDrag,
  onMenuDragEnd,
  menuProgress,
}: LoopHeaderProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Shimmer animation for border glow effect
  const shimmerTranslate = useSharedValue(-SCREEN_WIDTH);

  // Shimmer effect
  useEffect(() => {
    const runShimmer = () => {
      shimmerTranslate.value = -SCREEN_WIDTH;
      shimmerTranslate.value = withTiming(SCREEN_WIDTH, {
        duration: 1500,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      });
    };

    if (isLoading) {
      const interval = setInterval(() => runShimmer(), 2500);
      runShimmer();
      return () => clearInterval(interval);
    } else {
      const initialTimeout = setTimeout(() => runShimmer(), 1000);
      const interval = setInterval(() => runShimmer(), 12000);
      return () => {
        clearTimeout(initialTimeout);
        clearInterval(interval);
      };
    }
  }, [isLoading]);

  const handleLogoPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onLogoPress) {
      onLogoPress();
    } else {
      router.push('/(tabs)');
    }
  };

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTranslate.value }],
  }));

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (!user?.name) return '?';
    const parts = user.name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0][0].toUpperCase();
  };

  // Press micro-interactions — grow + lighten bg + brighten border
  const menuPress = useSharedValue(0);
  const searchPress = useSharedValue(0);

  // Menu button: scale up, lighten bg, brighten border
  // Combines touch press state AND menu-open state via Math.max —
  // button stays enlarged while menu is dragging/open, without fighting touch animations
  const menuButtonStyle = useAnimatedStyle(() => {
    // menuOpen ramps to 1 quickly (by menuProgress=0.1) and back smoothly
    const menuOpen = menuProgress
      ? interpolate(menuProgress.value, [0, 0.1], [0, 1], Extrapolate.CLAMP)
      : 0;
    const p = Math.max(menuPress.value, menuOpen);
    return {
      transform: [{ scale: interpolate(p, [0, 1], [1, 1.1], Extrapolate.CLAMP) }],
      backgroundColor: interpolateColor(p, [0, 1], ['#131315', '#2C2C30']),
      borderColor: interpolateColor(p, [0, 1], ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.25)']),
    };
  });

  // Search button: same grow + lighten treatment
  const searchButtonStyle = useAnimatedStyle(() => {
    const p = searchPress.value;
    const baseBg = colorScheme === 'dark' ? '#222224' : '#E5E5EA';
    const pressedBg = colorScheme === 'dark' ? '#38383C' : '#CDCDD2';
    const baseBorder = colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const pressedBorder = colorScheme === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.16)';
    return {
      transform: [{ scale: interpolate(p, [0, 1], [1, 1.1], Extrapolate.CLAMP) }],
      backgroundColor: interpolateColor(p, [0, 1], [baseBg, pressedBg]),
      borderColor: interpolateColor(p, [0, 1], [baseBorder, pressedBorder]),
    };
  });

  const handlePressIn = (sv: Animated.SharedValue<number>) => {
    sv.value = withTiming(1, { duration: 100 });
  };
  const handlePressOut = (sv: Animated.SharedValue<number>) => {
    sv.value = withSpring(0, { duration: 400, dampingRatio: 0.55 });
  };

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
        ) : showProfileAvatar ? (
          (() => {
            // Pan gesture on menu button: swipe right to open menu
            const menuPan = Gesture.Pan()
              .activeOffsetX([10, 999])
              .failOffsetY([-15, 15])
              .onUpdate((event) => {
                if (event.translationX > 0 && onMenuDrag) {
                  onMenuDrag(event.translationX);
                }
              })
              .onEnd((event) => {
                if (onMenuDragEnd) {
                  onMenuDragEnd(event.translationX, event.velocityX);
                }
              })
              .runOnJS(true);

            return (
              <GestureDetector gesture={menuPan}>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onProfilePress?.();
                  }}
                  onPressIn={() => handlePressIn(menuPress)}
                  onPressOut={() => handlePressOut(menuPress)}
                  style={styles.filterButton}
                  activeOpacity={1}
                >
                  <Animated.View style={[styles.menuCircle, menuButtonStyle]}>
                    <View style={styles.menuLines}>
                      <View style={[styles.menuLine, { backgroundColor: '#FFFFFF' }]} />
                      <View style={[styles.menuLine, { backgroundColor: '#FFFFFF' }]} />
                    </View>
                  </Animated.View>
                </TouchableOpacity>
              </GestureDetector>
            );
          })()
        ) : showMenuButton ? (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onMenuPress?.();
            }}
            style={styles.iconButton}
          >
            <Ionicons name={isMenuOpen ? 'close' : 'menu'} size={26} color={colors.text} />
          </TouchableOpacity>
        ) : showNotificationBell ? (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onNotificationPress?.();
            }}
            style={styles.iconButton}
          >
            <View>
              <Ionicons name="notifications-outline" size={24} color={colors.text} />
              {notificationCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </Text>
                </View>
              )}
            </View>
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

      {/* Center - Loop Logo (tap to scroll top / refresh) */}
      <View style={styles.logoContainer}>
        <TouchableOpacity
          onPress={handleLogoPress}
          activeOpacity={0.7}
          style={styles.logoTouchable}
        >
          <LoopLogoVariant size={22} flat />
        </TouchableOpacity>
      </View>

      {/* Right Side */}
      <View style={styles.rightSection}>
        {rightAction ? (
          rightAction
        ) : showSearchButton ? (
          <View style={styles.rightIconRow}>
            <TouchableOpacity
              onPress={() => {
                console.log('🔍 Filter button pressed, onSearchPress:', !!onSearchPress);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSearchPress?.();
              }}
              onPressIn={() => handlePressIn(searchPress)}
              onPressOut={() => handlePressOut(searchPress)}
              activeOpacity={1}
              style={styles.filterButton}
            >
              <Animated.View style={[styles.filterCircle, searchButtonStyle]}>
                <Ionicons name="search-outline" size={17} color={colors.text} />
              </Animated.View>
              {/* Active filter dot indicator */}
              {hasActiveFilters && (
                <View style={styles.filterDot} />
              )}
            </TouchableOpacity>
            {showChatButton && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onChatPress?.();
                }}
                style={styles.iconButton}
              >
                <View>
                  <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.text} />
                  {chatBadgeCount > 0 && (
                    <View style={styles.chatBadge}>
                      <Text style={styles.chatBadgeText}>
                        {chatBadgeCount > 9 ? '9+' : chatBadgeCount}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}
          </View>
        ) : showFilterButton ? (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onFilterPress?.({ x: SCREEN_WIDTH - 40, y: 100 });
            }}
            style={styles.filterButton}
          >
            <View style={[styles.filterCircle, {
              backgroundColor: colorScheme === 'dark'
                ? 'rgba(34,34,36,0.85)'
                : 'rgba(229,229,234,0.65)',
              borderColor: colorScheme === 'dark'
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(0,0,0,0.08)',
            }]}>
              <Ionicons name="search-outline" size={17} color={colors.text} />
            </View>
          </TouchableOpacity>
        ) : showAddButton ? (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onAddPress?.();
            }}
            style={styles.iconButton}
          >
            <Ionicons name="add-circle-outline" size={26} color={colors.text} />
          </TouchableOpacity>
        ) : showSettingsButton ? (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSettingsPress?.();
            }}
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
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  rightIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: Spacing.sm,
  },
  chatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: BrandColors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chatBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    includeFontPadding: false,
  },
  // Profile avatar button
  avatarButton: {
    padding: Spacing.xs,
    position: 'relative',
  },
  avatarContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: BrandColors.loopBlue,
    includeFontPadding: false,
  },
  avatarBadge: {
    position: 'absolute',
    top: -1,
    right: -3,
    backgroundColor: BrandColors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  avatarBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    includeFontPadding: false,
  },
  // Bell icon badge
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: BrandColors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    includeFontPadding: false,
  },
  // Menu button (dark circle with two horizontal bars)
  menuCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    // backgroundColor + borderColor driven by animated style
  },
  menuLines: {
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLine: {
    width: 14,
    height: 2,
    borderRadius: 1,
  },
  // Circular filter button
  filterButton: {
    padding: Spacing.xs,
    position: 'relative',
  },
  filterCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  // Active filter dot on filter circle
  filterDot: {
    position: 'absolute',
    top: -1,
    right: 1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrandColors.loopBlue,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
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
    width: SCREEN_WIDTH * 0.4,
    height: 1,
  },
  shimmerGradient: {
    flex: 1,
    height: 1,
  },
});
