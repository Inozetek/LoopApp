/**
 * Friends Header Component
 *
 * Section title header for Friends tab.
 * Features:
 * - Clean "Groops" text header (Instagram/Snapchat style)
 * - Menu button on left with swipe-to-open gesture (matches rec feed)
 * - Add friend / search button on right with swipe-to-open gesture
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BrandColors, Spacing } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { BlurHeaderWrapper } from '@/components/blur-header-wrapper';
import { MetallicRingButton } from '@/components/ui/metallic-ring-button';

interface FriendsHeaderProps {
  title?: string;
  onAddPress?: () => void;
  notificationCount?: number;
  onChatPress?: () => void;
  chatBadgeCount?: number;
  // Menu drawer gesture callbacks (left button: swipe right to open)
  onMenuPress?: () => void;
  onMenuDrag?: (translationX: number) => void;
  onMenuDragEnd?: (translationX: number, velocityX: number) => void;
  menuProgress?: SharedValue<number>;
  // Search drawer gesture callbacks (right button: swipe left to open)
  onSearchPress?: () => void;
  onSearchDrag?: (absTranslationX: number) => void;
  onSearchDragEnd?: (absTranslationX: number, absVelocityX: number) => void;
  searchProgress?: SharedValue<number>;
}

export function FriendsHeader({
  title = 'Friends',
  onAddPress,
  notificationCount = 0,
  onChatPress,
  chatBadgeCount = 0,
  onMenuPress,
  onMenuDrag,
  onMenuDragEnd,
  menuProgress,
  onSearchPress,
  onSearchDrag,
  onSearchDragEnd,
  searchProgress,
}: FriendsHeaderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const iconColor = isDark ? '#FFFFFF' : '#000000';

  // Pan gesture on menu button: swipe right to open menu drawer
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

  // Pan gesture on search/add button: swipe left to open search drawer
  const searchPan = Gesture.Pan()
    .activeOffsetX([-999, -10])
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      if (event.translationX < 0 && onSearchDrag) {
        onSearchDrag(Math.abs(event.translationX));
      }
    })
    .onEnd((event) => {
      if (onSearchDragEnd) {
        onSearchDragEnd(Math.abs(event.translationX), Math.abs(event.velocityX));
      }
    })
    .runOnJS(true);

  return (
    <BlurHeaderWrapper style={{ paddingTop: insets.top + Spacing.sm }}>
    <View style={styles.container}>
      {/* Left Side - Menu (matches rec feed pattern) */}
      <View style={styles.leftSection}>
        {onMenuPress ? (
          <GestureDetector gesture={menuPan}>
            <View>
              <MetallicRingButton
                onPress={onMenuPress}
                size={36}
                innerSize={33}
                menuProgress={menuProgress}
              >
                <View style={styles.menuLines}>
                  <View style={[styles.menuLine, { backgroundColor: iconColor }]} />
                  <View style={[styles.menuLine, { backgroundColor: iconColor }]} />
                </View>
              </MetallicRingButton>
            </View>
          </GestureDetector>
        ) : onChatPress ? (
          <View>
            <MetallicRingButton onPress={() => onChatPress()} size={36} innerSize={33}>
              <Ionicons name="chatbubble-outline" size={17} color={iconColor} />
            </MetallicRingButton>
            {chatBadgeCount > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.badgeText}>
                  {chatBadgeCount > 9 ? '9+' : chatBadgeCount}
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </View>

      {/* Center - Clean "Groops" text (Instagram/Snapchat style) */}
      <View style={styles.titleContainer}>
        <Text style={[styles.brandTitle, { color: colors.textSecondary || colors.text }]}>Groops</Text>
        {notificationCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {notificationCount > 9 ? '9+' : notificationCount}
            </Text>
          </View>
        )}
      </View>

      {/* Right Side - Search/Add with gesture */}
      <View style={styles.rightSection}>
        {onSearchPress ? (
          <GestureDetector gesture={searchPan}>
            <View>
              <MetallicRingButton
                onPress={onSearchPress}
                size={36}
                innerSize={33}
                menuProgress={searchProgress}
              >
                <Ionicons name="search-outline" size={17} color={iconColor} />
              </MetallicRingButton>
            </View>
          </GestureDetector>
        ) : onAddPress ? (
          <MetallicRingButton onPress={() => onAddPress()} size={36} innerSize={33}>
            <Ionicons name="add" size={18} color={iconColor} />
          </MetallicRingButton>
        ) : null}
      </View>
    </View>
    </BlurHeaderWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  leftSection: {
    width: 48,
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  // ============================================================
  // FONT VARIANTS TO TEST - Uncomment one at a time
  // Keep in sync with calendar-header.tsx
  // ============================================================

  // VARIANT 1: System Default (San Francisco iOS / Roboto Android)
  // Clean, native feel - what most apps use
  brandTitle: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // VARIANT 2: Avenir Next (iOS) - Snapchat's original font
  // Modern, geometric, slightly playful
  // brandTitle: {
  //   fontSize: 22,
  //   fontFamily: Platform.OS === 'ios' ? 'Avenir Next' : 'sans-serif-medium',
  //   fontWeight: '600',
  //   letterSpacing: 0.3,
  // },

  // VARIANT 3: Helvetica Neue - Classic, clean
  // Used by many apps, very neutral
  // brandTitle: {
  //   fontSize: 22,
  //   fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  //   fontWeight: '500',
  //   letterSpacing: 0.5,
  // },

  // VARIANT 4: Georgia (Serif) - Editorial, premium feel
  // Different vibe - more like a magazine
  // brandTitle: {
  //   fontSize: 24,
  //   fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  //   fontWeight: '600',
  //   letterSpacing: 0,
  // },
  badge: {
    backgroundColor: BrandColors.loopBlue,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  rightSection: {
    width: 48,
    alignItems: 'flex-end',
  },
  chatBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: BrandColors.loopBlue,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  menuLines: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  menuLine: {
    width: 14,
    height: 1.5,
    borderRadius: 1,
  },
});
