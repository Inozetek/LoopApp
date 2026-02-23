/**
 * DateFilterBar — Horizontal pill chips for date-filtered recommendations
 * Pills: Today | Tomorrow | This Wknd | Next Week | [calendar icon]
 * Always visible below the header spacer, above the collapsible feed filters.
 */

import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import type { DateFilterSelection } from '@/types/time-slots';

interface DateFilterBarProps {
  selection: DateFilterSelection;
  onSelectionChange: (selection: DateFilterSelection) => void;
  onCalendarPress: () => void;
}

/** Generate the quick-pick date options */
function getDatePills(): { label: string; getDate: () => Date }[] {
  return [
    {
      label: 'Today',
      getDate: () => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      },
    },
    {
      label: 'Tomorrow',
      getDate: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(0, 0, 0, 0);
        return d;
      },
    },
    {
      label: 'This Wknd',
      getDate: () => {
        const d = new Date();
        const dayOfWeek = d.getDay();
        // Find next Saturday (or today if Saturday)
        const daysUntilSat = dayOfWeek === 6 ? 0 : (6 - dayOfWeek + 7) % 7;
        d.setDate(d.getDate() + daysUntilSat);
        d.setHours(0, 0, 0, 0);
        return d;
      },
    },
    {
      label: 'Next Week',
      getDate: () => {
        const d = new Date();
        const dayOfWeek = d.getDay();
        // Find next Monday
        const daysUntilMon = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
        d.setDate(d.getDate() + daysUntilMon);
        d.setHours(0, 0, 0, 0);
        return d;
      },
    },
  ];
}

/** Check if a date is today */
function isToday(date: Date | null): boolean {
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function DateFilterBar({
  selection,
  onSelectionChange,
  onCalendarPress,
}: DateFilterBarProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const pills = getDatePills();

  const handlePillPress = (label: string, getDate: () => Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (label === 'Today') {
      // "Today" acts as reset — clear filter
      onSelectionChange({ date: null, quickLabel: null });
    } else {
      onSelectionChange({ date: getDate(), quickLabel: label });
    }
  };

  const isActive = (label: string): boolean => {
    if (label === 'Today') {
      // Active when no filter or filter is today
      return selection.date === null || isToday(selection.date);
    }
    return selection.quickLabel === label;
  };

  const hasCustomDate = selection.date !== null && selection.quickLabel === null;

  return (
    <View style={styles.container} testID="date-filter-bar">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {pills.map(({ label, getDate }) => {
          const active = isActive(label);
          return (
            <Pressable
              key={label}
              onPress={() => handlePillPress(label, getDate)}
              style={[
                styles.pill,
                {
                  backgroundColor: active
                    ? BrandColors.loopBlue
                    : colorScheme === 'dark'
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.05)',
                },
              ]}
              testID={`date-pill-${label.toLowerCase().replace(/\s/g, '-')}`}
            >
              <Text
                style={[
                  styles.pillText,
                  {
                    color: active ? '#FFFFFF' : colors.text,
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}

        {/* Custom date indicator (when picked from calendar) */}
        {hasCustomDate && selection.date && (
          <View
            style={[
              styles.pill,
              { backgroundColor: BrandColors.loopBlue },
            ]}
          >
            <Ionicons name="calendar" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={[styles.pillText, { color: '#FFFFFF' }]}>
              {selection.date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
        )}

        {/* Calendar picker button */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onCalendarPress();
          }}
          style={[
            styles.calendarButton,
            {
              backgroundColor: hasCustomDate
                ? `${BrandColors.loopBlue}20`
                : colorScheme === 'dark'
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.05)',
            },
          ]}
          testID="date-filter-calendar-btn"
        >
          <Ionicons
            name="calendar-outline"
            size={18}
            color={hasCustomDate ? BrandColors.loopBlue : colors.textSecondary}
          />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  pillText: {
    ...Typography.labelMedium,
    fontFamily: 'Urbanist-SemiBold',
  },
  calendarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Export for testing
export const _testExports = { getDatePills, isToday };
