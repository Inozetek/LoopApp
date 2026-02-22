/**
 * DateContextBanner — Shows day summary above the feed when a non-today date is selected.
 * Displays: "Saturday, Feb 22 — 3 events, 4 hrs free"
 * with a subtle gradient background and calendar icon.
 */

import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import type { DaySlotAnalysis } from '@/types/time-slots';

interface DateContextBannerProps {
  analysis: DaySlotAnalysis;
}

export function DateContextBanner({ analysis }: DateContextBannerProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colorScheme === 'dark'
            ? 'rgba(0, 166, 217, 0.08)'
            : 'rgba(0, 166, 217, 0.06)',
          borderColor: colorScheme === 'dark'
            ? 'rgba(0, 166, 217, 0.15)'
            : 'rgba(0, 166, 217, 0.12)',
        },
      ]}
      testID="date-context-banner"
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name="calendar"
          size={16}
          color={BrandColors.loopBlue}
        />
      </View>
      <View style={styles.textContainer}>
        <Text
          style={[styles.summary, { color: colors.text }]}
          numberOfLines={1}
        >
          {analysis.daySummary}
        </Text>
        {analysis.schedulableGapCount > 0 && (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {analysis.schedulableGapCount} time slot{analysis.schedulableGapCount > 1 ? 's' : ''} available for activities
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  iconContainer: {
    marginRight: Spacing.sm + 2,
  },
  textContainer: {
    flex: 1,
  },
  summary: {
    ...Typography.labelMedium,
    fontFamily: 'Urbanist-SemiBold',
  },
  hint: {
    ...Typography.caption,
    marginTop: 2,
  },
});
