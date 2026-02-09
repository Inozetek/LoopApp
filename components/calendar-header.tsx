/**
 * Calendar Header Component
 *
 * Section title header for Calendar tab.
 * Features:
 * - "L [logo] P" spelling LOOP with Venn diagram logo
 * - Add event button on right
 * - Optional subtitle (e.g., "Today, Dec 15")
 *
 * Logo Design (v3.0):
 * - Two overlapping circles (Venn diagram)
 * - Left: Cyan, Right: Green
 * - Thin strokes with transparent fills
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BrandColors, Spacing, Typography } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { LoopLogoVariant } from '@/components/loop-logo-variant';

interface CalendarHeaderProps {
  title?: string;
  subtitle?: string;
  onAddPress?: () => void;
  onMenuPress?: () => void;
  onTitlePress?: () => void;
  showLoopIcon?: boolean;
}

export function CalendarHeader({
  title = 'Loop',
  subtitle,
  onAddPress,
  onMenuPress,
  onTitlePress,
  showLoopIcon = true,
}: CalendarHeaderProps) {
  const colorScheme = useColorScheme();
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
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.sm }]}>
      {/* Left Side - Menu Button */}
      <View style={styles.leftSection}>
        {onMenuPress && (
          <TouchableOpacity
            onPress={handleMenuPress}
            style={styles.iconButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="menu" size={26} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Center - "L [logo] P" spelling LOOP (tappable to toggle map) */}
      <TouchableOpacity
        style={styles.titleContainer}
        onPress={handleTitlePress}
        activeOpacity={onTitlePress ? 0.7 : 1}
        disabled={!onTitlePress}
      >
        {showLoopIcon ? (
          <View style={styles.loopBrandContainer}>
            {/* L + OO (logo) + P = LOOP */}
            <View style={styles.letterBorderBlue}>
              <Text style={[styles.loopLetter, { color: colors.text }]}>L</Text>
            </View>
            <LoopLogoVariant size={22} style={styles.loopLogo} />
            <View style={styles.letterBorderGreen}>
              <Text style={[styles.loopLetter, { color: colors.text }]}>P</Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        )}
        {subtitle && (
          <Text style={[styles.subtitle, { color: colors.icon }]}>{subtitle}</Text>
        )}
      </TouchableOpacity>

      {/* Right Side - Add Button */}
      <View style={styles.rightSection}>
        {onAddPress && (
          <TouchableOpacity
            onPress={handleAddPress}
            style={styles.iconButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add-circle-outline" size={28} color={BrandColors.loopBlue} />
          </TouchableOpacity>
        )}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
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
  loopBrandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loopLetter: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  loopLogo: {
    marginHorizontal: 2, // Tight spacing for "L OO P" effect
  },
  letterBorderBlue: {
    borderWidth: 1.5,
    borderColor: BrandColors.loopBlueLight, // #2ECEFF
    borderRadius: 4,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  letterBorderGreen: {
    borderWidth: 1.5,
    borderColor: BrandColors.loopGreen, // #09DB98
    borderRadius: 4,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
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
});
