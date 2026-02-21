/**
 * Friends Header Component
 *
 * Section title header for Friends tab.
 * Features:
 * - Clean "Groops" text header (Instagram/Snapchat style)
 * - Add friend button on right
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BrandColors, Spacing } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { BlurHeaderWrapper } from '@/components/blur-header-wrapper';

interface FriendsHeaderProps {
  title?: string;
  onAddPress?: () => void;
  notificationCount?: number;
  onChatPress?: () => void;
  chatBadgeCount?: number;
}

export function FriendsHeader({
  title = 'Friends',
  onAddPress,
  notificationCount = 0,
  onChatPress,
  chatBadgeCount = 0,
}: FriendsHeaderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const handleAddPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAddPress?.();
  };

  const handleChatPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChatPress?.();
  };

  return (
    <BlurHeaderWrapper style={{ paddingTop: insets.top + Spacing.sm }}>
    <View style={styles.container}>
      {/* Left Side */}
      <View style={styles.leftSection} />

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

      {/* Right Side - Chat + Add */}
      <View style={styles.rightSection}>
        {onChatPress && (
          <View>
            <TouchableOpacity
              onPress={handleChatPress}
              style={styles.addButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            {chatBadgeCount > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.badgeText}>
                  {chatBadgeCount > 9 ? '9+' : chatBadgeCount}
                </Text>
              </View>
            )}
          </View>
        )}
        {onAddPress && (
          <TouchableOpacity
            onPress={handleAddPress}
            style={styles.addButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add-circle-outline" size={26} color={colors.text} />
          </TouchableOpacity>
        )}
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
    width: 40,
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
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
  addButton: {
    padding: Spacing.xs,
    marginTop: 1,
  },
  chatBadge: {
    position: 'absolute',
    top: 0,
    right: -2,
    backgroundColor: BrandColors.loopBlue,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
