/**
 * Calendar Header Component
 *
 * Section title header for Calendar tab.
 * Features:
 * - Clean "Loop" text header (Instagram/Snapchat style)
 * - Add event button on right
 * - Optional subtitle (e.g., "Today, Dec 15")
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Spacing, Typography, BrandColors } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { BlurHeaderWrapper } from '@/components/blur-header-wrapper';
import { MetallicRingButton } from '@/components/ui/metallic-ring-button';

interface CalendarHeaderProps {
  title?: string;
  subtitle?: string;
  onAddPress?: () => void;
  onMenuPress?: () => void;
  onTitlePress?: () => void;
  showLoopIcon?: boolean;
  /** Badge count to show on the hamburger menu button (e.g. pending feedback) */
  menuBadgeCount?: number;
}

export function CalendarHeader({
  title = 'Loop',
  subtitle,
  onAddPress,
  onMenuPress,
  onTitlePress,
  showLoopIcon = true,
  menuBadgeCount = 0,
}: CalendarHeaderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const handleAddPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAddPress?.();
  };

  const handleMenuPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onMenuPress?.();
  };

  const handleTitlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onTitlePress?.();
  };

  return (
    <BlurHeaderWrapper style={{ paddingTop: insets.top + Spacing.sm }}>
    <View style={styles.container}>
      {/* Left Side - Menu Button */}
      <View style={styles.leftSection}>
        {onMenuPress && (
          <View style={{ position: 'relative' }}>
            <MetallicRingButton onPress={handleMenuPress} size={36} innerSize={33}>
              <View style={calMenuStyles.lines}>
                <View style={[calMenuStyles.line, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]} />
                <View style={[calMenuStyles.line, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]} />
              </View>
            </MetallicRingButton>
            {menuBadgeCount > 0 && (
              <View style={styles.menuBadgeDot} />
            )}
          </View>
        )}
      </View>

      {/* Center - Clean "Loop" text (Instagram/Snapchat style) */}
      <TouchableOpacity
        style={styles.titleContainer}
        onPress={handleTitlePress}
        activeOpacity={onTitlePress ? 0.7 : 1}
        disabled={!onTitlePress}
      >
        <Text style={[styles.brandTitle, { color: colors.textSecondary || colors.text }]}>Loop</Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: colors.icon }]}>{subtitle}</Text>
        )}
      </TouchableOpacity>

      {/* Right Side - Add Button */}
      <View style={styles.rightSection}>
        {onAddPress && (
          <MetallicRingButton onPress={handleAddPress} size={36} innerSize={33}>
            <Ionicons name="add" size={18} color={isDark ? '#FFFFFF' : '#000000'} />
          </MetallicRingButton>
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
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ============================================================
  // FONT VARIANTS TO TEST - Uncomment one at a time
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
  title: {
    ...Typography.titleLarge,
    fontWeight: '700',
  },
  subtitle: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
  rightSection: {
    width: 40,
    alignItems: 'flex-end',
  },
  iconButton: {
    padding: Spacing.xs,
  },
  menuBadgeDot: {
    position: 'absolute',
    bottom: 5,
    right: 5.5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrandColors.error,
    zIndex: 1,
  },
});

const calMenuStyles = StyleSheet.create({
  lines: {
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: 15.5,
    height: 1.5,
    borderRadius: 0.75,
  },
});
