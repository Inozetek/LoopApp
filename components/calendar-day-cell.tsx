/**
 * CalendarDayCell - Custom day component for react-native-calendars
 *
 * Renders colored dots (up to 3), a "+N" badge for overflow events,
 * and a subtle spring scale animation on selection.
 */

import React, { useEffect } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { BrandColors, Typography, Spacing } from '@/constants/brand';
import { QUICK_SPRING } from '@/constants/animations';

interface DayDot {
  key: string;
  color: string;
  selectedDotColor?: string;
}

export interface CalendarDayCellProps {
  date?: { day: number; month: number; year: number; dateString: string; timestamp: number };
  state?: 'selected' | 'disabled' | 'today' | '';
  marking?: {
    marked?: boolean;
    selected?: boolean;
    selectedColor?: string;
    selectedTextColor?: string;
    dots?: DayDot[];
    extraCount?: number;
    disabled?: boolean;
    disableTouchEvent?: boolean;
  };
  onPress?: (date: any) => void;
  theme?: any;
}

const CalendarDayCellInner: React.FC<CalendarDayCellProps> = ({
  date,
  state,
  marking,
  onPress,
  theme,
}) => {
  const isSelected = marking?.selected || state === 'selected';
  const isDisabled = state === 'disabled' || marking?.disabled;
  const isToday = state === 'today';
  const dots = marking?.dots || [];
  const extraCount = marking?.extraCount || 0;

  // Spring scale animation on selection
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isSelected) {
      // Set to slightly smaller scale, then spring back to 1 for a "pop" effect
      scale.value = 0.85;
      scale.value = withSpring(1, QUICK_SPRING);
    }
  }, [isSelected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (!isDisabled && date && onPress) {
      onPress(date);
    }
  };

  // Determine text color
  let dayTextColor = theme?.dayTextColor || '#2d4150';
  if (isSelected) {
    dayTextColor = marking?.selectedTextColor || '#FFFFFF';
  } else if (isDisabled) {
    dayTextColor = theme?.textDisabledColor || '#d9e1e8';
  } else if (isToday) {
    dayTextColor = theme?.todayTextColor || BrandColors.loopBlue;
  }

  // Determine background
  const bgColor = isSelected
    ? (marking?.selectedColor || BrandColors.loopBlue)
    : 'transparent';

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isDisabled || marking?.disableTouchEvent}
      activeOpacity={0.6}
      style={styles.wrapper}
    >
      <Animated.View style={[styles.container, animatedStyle]}>
        {/* Day number circle */}
        <View
          style={[
            styles.dayCircle,
            isSelected && [styles.dayCircleSelected, { backgroundColor: bgColor }],
            isToday && !isSelected && styles.dayCircleToday,
          ]}
        >
          <Text
            style={[
              styles.dayText,
              { color: dayTextColor },
              isToday && !isSelected && styles.dayTextToday,
              isSelected && styles.dayTextSelected,
            ]}
          >
            {date?.day}
          </Text>
        </View>

        {/* Dots row */}
        <View style={styles.dotsRow}>
          {dots.slice(0, 3).map((dot, index) => (
            <View
              key={dot.key || `dot-${index}`}
              style={[
                styles.dot,
                {
                  backgroundColor: isSelected
                    ? (dot.selectedDotColor || '#FFFFFF')
                    : dot.color,
                },
              ]}
            />
          ))}
          {/* +N badge when more than 3 events */}
          {extraCount > 0 && (
            <View style={styles.extraBadge}>
              <Text style={styles.extraBadgeText}>+{extraCount}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

export const CalendarDayCell = React.memo(CalendarDayCellInner);

const DAY_SIZE = 36;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    minHeight: 52,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    // backgroundColor is set dynamically
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: BrandColors.loopBlue,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '400',
  },
  dayTextToday: {
    fontWeight: '600',
  },
  dayTextSelected: {
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    height: 12,
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  extraBadge: {
    paddingHorizontal: 3,
    paddingVertical: 0,
    borderRadius: 6,
    backgroundColor: BrandColors.veryLightGray,
    marginLeft: 1,
  },
  extraBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 12,
  },
});
