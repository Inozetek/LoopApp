/**
 * CalendarDayCell - Custom day component for react-native-calendars
 *
 * Visual states:
 *   Unselected day:        plain number, no decoration
 *   Unselected today:      loop-blue number, no circle
 *   Unselected w/ events:  plain number + gradient color pill
 *   Selected day:          blue circle (border + 12% fill) + white bold text
 *   Selected w/ events:    gradient ring (event colors) + white bold text + green pill
 *   Selected today:        blue circle + white text (+ green pill if events)
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BrandColors } from '@/constants/brand';
import { QUICK_SPRING } from '@/constants/animations';

interface DayDot {
  key: string;
  color: string;
  selectedDotColor?: string;
}

export interface CalendarDayCellProps {
  date?: { day: number; month: number; year: number; dateString: string; timestamp: number };
  state?: 'selected' | 'disabled' | 'today' | 'inactive' | '';
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

/**
 * Extract unique colors from dots for gradient ring.
 * Returns at least 2 colors (duplicates the single color for LinearGradient).
 */
export function getGradientColors(dots: DayDot[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const dot of dots) {
    if (!seen.has(dot.color)) {
      seen.add(dot.color);
      unique.push(dot.color);
    }
  }
  if (unique.length === 0) return [];
  if (unique.length === 1) return [unique[0], unique[0]];
  return unique;
}

/**
 * Build gradient colors for the pill indicator.
 * Keeps duplicate colors (unlike ring) so event distribution is proportional.
 * Returns at least 2 colors for LinearGradient compatibility.
 */
export function getPillGradientColors(dots: DayDot[]): string[] {
  const colors = dots.slice(0, MAX_PILL_SEGMENTS).map(d => d.color);
  if (colors.length === 0) return [];
  if (colors.length === 1) return [colors[0], colors[0]];
  return colors;
}

const RING_OUTER = 38;
const RING_INNER = 35;
const PILL_WIDTH = 26;
const PILL_HEIGHT = 3;
const PILL_RADIUS = PILL_HEIGHT / 2;
export const MAX_PILL_SEGMENTS = 5;

/**
 * Custom memo comparator — ensures re-render on any meaningful prop change.
 * The default shallow compare misses marking going from an object to undefined
 * (react-native-calendars drops the key entirely for unselected days with no events).
 */
function arePropsEqual(
  prev: CalendarDayCellProps,
  next: CalendarDayCellProps,
): boolean {
  if (prev.marking?.selected !== next.marking?.selected) return false;
  if (prev.state !== next.state) return false;

  const prevDots = prev.marking?.dots;
  const nextDots = next.marking?.dots;
  if (prevDots?.length !== nextDots?.length) return false;
  if (prevDots && nextDots) {
    for (let i = 0; i < prevDots.length; i++) {
      if (prevDots[i].color !== nextDots[i].color) return false;
    }
  }

  if (prev.theme?.dayTextColor !== next.theme?.dayTextColor) return false;
  if (prev.theme?.calendarBackground !== next.theme?.calendarBackground) return false;

  return true;
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
  const now = new Date();
  const isToday = date
    ? date.year === now.getFullYear() && date.month === now.getMonth() + 1 && date.day === now.getDate()
    : state === 'today';
  const dots = marking?.dots || [];

  const gradientColors = useMemo(() => getGradientColors(dots), [dots]);
  const pillColors = useMemo(() => getPillGradientColors(dots), [dots]);
  const hasEvents = gradientColors.length > 0;

  // Gradient ring appears on any selected day with events
  const showGradientRing = isSelected && hasEvents;

  // Spring scale animation on selection
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isSelected) {
      scale.value = 0.85;
      scale.value = withSpring(1, QUICK_SPRING);
    }
  }, [isSelected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    if (!isDisabled && date && onPress) {
      onPress(date);
    }
  }, [isDisabled, date, onPress]);

  // Text color logic
  let dayTextColor = theme?.dayTextColor || '#2d4150';
  if (isSelected) {
    dayTextColor = '#FFFFFF';
  } else if (isDisabled) {
    dayTextColor = theme?.textDisabledColor || '#d9e1e8';
  } else if (isToday) {
    dayTextColor = BrandColors.loopBlue;
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isDisabled || marking?.disableTouchEvent}
      activeOpacity={0.6}
      style={styles.wrapper}
    >
      <Animated.View style={[styles.container, animatedStyle]}>
        {showGradientRing ? (
          /* Selected day with events — gradient ring from event colors */
          <LinearGradient
            colors={gradientColors as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientRing}
          >
            <View
              style={[
                styles.ringInner,
                { backgroundColor: theme?.calendarBackground || '#FFFFFF' },
              ]}
            >
              {/* Semi-transparent gradient fill reflecting the ring colors */}
              <LinearGradient
                colors={gradientColors.map(c => c + '1A') as [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ringFill}
              />
              <Text style={[styles.dayText, styles.dayTextSelected, { color: '#FFFFFF' }, styles.dayTextGlow]}>
                {date?.day}
              </Text>
            </View>
          </LinearGradient>
        ) : (
          /* All other states — plain circle (decorated only when selected) */
          <View
            style={[
              styles.dayCircle,
              isSelected && styles.dayCircleSelected,
            ]}
          >
            <Text
              style={[
                styles.dayText,
                { color: dayTextColor },
                (isToday || isSelected) && styles.dayTextBold,
                isSelected && styles.dayTextGlow,
              ]}
            >
              {date?.day}
            </Text>
          </View>
        )}

        {/* Gradient color pill — hidden for unselected today (just blue number) */}
        {pillColors.length > 0 && !(isToday && !isSelected) && (
          <LinearGradient
            colors={pillColors as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.pillGradient}
          />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

export const CalendarDayCell = React.memo(CalendarDayCellInner, arePropsEqual);

const DAY_SIZE = 36;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 44,
    minHeight: 52,
    paddingTop: 4,
  },
  container: {
    alignItems: 'center',
  },
  gradientRing: {
    width: RING_OUTER,
    height: RING_OUTER,
    borderRadius: RING_OUTER / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: RING_INNER,
    height: RING_INNER,
    borderRadius: RING_INNER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ringFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RING_INNER / 2,
  },
  dayCircle: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    borderWidth: 1.5,
    borderColor: BrandColors.loopBlue,
    backgroundColor: 'rgba(0, 166, 217, 0.12)',
    borderRadius: DAY_SIZE / 2,
    overflow: 'hidden',
  },
  dayText: {
    fontSize: 16,
    fontWeight: '400',
  },
  dayTextBold: {
    fontWeight: '600',
  },
  dayTextGlow: {
    fontWeight: '600',
    textShadowColor: 'rgba(255, 255, 255, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  pillGradient: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    marginTop: 8,
  },
});
