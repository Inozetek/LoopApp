/**
 * CalendarDayCell - Custom day component for react-native-calendars
 *
 * Visual states:
 *   Regular day:           plain number, no decoration
 *   Regular day + events:  plain number + color gradient pill
 *   Today idle:            thin silver ring + white text (+ silver pill if events)
 *   Selected empty:        neutral ring (silver dark / gray light) + no fill + bold text
 *   Selected + events:     gradient color ring + no fill + white bold glow text + pill
 *   Today selected empty:  loopBlue ring + blue fill + white bold text
 *   Today selected+events: gradient color ring + glow text + pill
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import { Text, Pressable, View, StyleSheet } from 'react-native';
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

  // Detect light/dark from calendar background
  const bg = theme?.calendarBackground || '#FFFFFF';
  const isDark = bg === '#0D0D0D' || bg === '#000000' || bg === '#151718';
  const selectedTextColor = isDark ? '#FFFFFF' : '#000000';

  // Text color logic
  let dayTextColor = theme?.dayTextColor || '#2d4150';
  if (isSelected) {
    dayTextColor = selectedTextColor;
  } else if (isDisabled) {
    dayTextColor = theme?.textDisabledColor || '#d9e1e8';
  } else if (isToday) {
    dayTextColor = isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.30)';
  }

  return (
    <Pressable
      onPressIn={handlePress}
      disabled={isDisabled || marking?.disableTouchEvent}
      style={styles.wrapper}
    >
      <Animated.View style={[styles.container, animatedStyle]}>
        {showGradientRing ? (
          /* Selected + events — gradient ring from event colors */
          <LinearGradient
            colors={gradientColors as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientRing}
          >
            <View
              style={[
                styles.ringInner,
                { backgroundColor: isDark ? 'rgba(0,0,0,0.95)' : (theme?.calendarBackground || '#FFFFFF') },
              ]}
            >
              {/* Barely-there tint matching ring colors — lens effect
                 Scale opacity by color count: fewer colors = more concentrated
                 tint, so dial down; more colors = more diffused, so dial up. */}
              <LinearGradient
                colors={gradientColors.map(c => {
                  if (!isDark) return c + '07';
                  // Convert hex color to rgba with task-count-scaled opacity
                  // 1 task → 0.033, 2 → 0.022, 3 → 0.011, 4 → 0.040, 5+ → 0.052
                  const opacities: Record<number, number> = { 1: 0.033, 2: 0.022, 3: 0.011, 4: 0.040 };
                  const a = opacities[dots.length] ?? 0.052;
                  const r = parseInt(c.slice(1, 3), 16);
                  const g = parseInt(c.slice(3, 5), 16);
                  const b = parseInt(c.slice(5, 7), 16);
                  return `rgba(${r},${g},${b},${a})`;
                }) as [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={[styles.dayText, styles.dayTextGlow, { color: selectedTextColor }]}>
                {date?.day}
              </Text>
            </View>
          </LinearGradient>
        ) : isSelected && isToday ? (
          /* Today selected empty — loopBlue ring + blue fill */
          <View style={[styles.dayCircle, styles.dayCircleTodaySelected]}>
            <Text style={[styles.dayText, styles.dayTextBold, { color: selectedTextColor }]}>
              {date?.day}
            </Text>
          </View>
        ) : isSelected ? (
          /* Selected empty — shiny metallic gradient ring */
          <LinearGradient
            colors={
              isDark
                ? ['rgba(255,255,255,0.50)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.40)']
                : ['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.06)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientRing}
          >
            <View
              style={[
                styles.ringInner,
                { backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.75)' },
              ]}
            >
              <Text style={[styles.dayText, styles.dayTextBold, { color: selectedTextColor }]}>
                {date?.day}
              </Text>
            </View>
          </LinearGradient>
        ) : (
          /* Default — plain text, optional today ring */
          <View style={[styles.dayCircle, isToday && {
            borderWidth: 1.5,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.20)',
            borderRadius: DAY_SIZE / 2,
          }]}>
            <Text
              style={[
                styles.dayText,
                { color: dayTextColor },
              ]}
            >
              {date?.day}
            </Text>
          </View>
        )}

        {/* Gradient color pill — loopBlue for today idle, event colors otherwise */}
        {pillColors.length > 0 && (
          <LinearGradient
            colors={
              isToday && !isSelected
                ? isDark
                  ? ['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0.35)']
                  : ['rgba(0, 0, 0, 0.20)', 'rgba(0, 0, 0, 0.20)']
                : pillColors as [string, string, ...string[]]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.pillGradient}
          />
        )}
      </Animated.View>
    </Pressable>
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
  dayCircle: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleTodaySelected: {
    borderWidth: 1.5,
    borderColor: BrandColors.loopBlue,
    backgroundColor: 'rgba(0, 166, 217, 0.02)',
    borderRadius: DAY_SIZE / 2,
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
