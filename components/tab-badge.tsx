/**
 * Tab Badge Component
 * Shows a notification indicator on tab bar icons
 *
 * Design: Instagram-style animated indicator
 * - Count badge shows for ~4 seconds, then collapses to small red dot
 * - Red dot persists until dismissed
 * - No white border — clean red badge
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated as RNAnimated } from 'react-native';
import { BrandColors } from '@/constants/brand';

const COUNT_DISPLAY_DURATION = 4000; // Show count for 4 seconds before collapsing to dot

interface TabBadgeProps {
  children: React.ReactNode;
  count?: number;
  showDot?: boolean; // Show just a dot instead of count
  focused?: boolean; // When focused, count badge transitions to a simple dot (Instagram pattern)
}

export function TabBadge({ children, count = 0, showDot = false, focused = false }: TabBadgeProps) {
  const shouldShow = showDot || count > 0;

  // Badge persistence: once tab is visited while having a count, keep showing dot
  const [hasSeen, setHasSeen] = useState(false);

  // Instagram-style: count → dot collapse after 4 seconds
  const [showCount, setShowCount] = useState(true);
  const collapseAnim = useRef(new RNAnimated.Value(1)).current; // 1 = full count, 0 = dot
  const countTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCountRef = useRef<number>(0);

  useEffect(() => {
    if (focused && count > 0) {
      setHasSeen(true);
    }
  }, [focused, count]);

  useEffect(() => {
    if (count <= 0) {
      setHasSeen(false);
      setShowCount(true);
      collapseAnim.setValue(1);
      lastCountRef.current = 0;
    }
  }, [count, collapseAnim]);

  // When a new count appears, show it for 4s then animate to dot
  useEffect(() => {
    if (count > 0 && count !== lastCountRef.current) {
      lastCountRef.current = count;
      setShowCount(true);
      collapseAnim.setValue(1);

      if (countTimerRef.current) clearTimeout(countTimerRef.current);

      countTimerRef.current = setTimeout(() => {
        RNAnimated.timing(collapseAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowCount(false);
        });
      }, COUNT_DISPLAY_DURATION);
    }

    return () => {
      if (countTimerRef.current) clearTimeout(countTimerRef.current);
    };
  }, [count, collapseAnim]);

  const showAsDot = showDot || ((focused || hasSeen) && count > 0) || (!showCount && count > 0);

  return (
    <View style={styles.container}>
      {children}
      {shouldShow && (
        <View style={styles.badgeContainer}>
          {/* Glow effect behind badge */}
          <View style={styles.badgeGlow} />
          {/* Badge: animated count that collapses to dot */}
          {count > 0 && !showAsDot ? (
            <RNAnimated.View style={[
              styles.countBadge,
              {
                opacity: collapseAnim,
                transform: [{ scale: collapseAnim }],
              },
            ]}>
              <Text style={styles.badgeText}>
                {count > 9 ? '9+' : count}
              </Text>
            </RNAnimated.View>
          ) : (
            <View style={styles.badge} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: -2,
    right: -5,
    alignItems: 'center',
  },
  badgeGlow: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BrandColors.error,
    opacity: 0.3,
  },
  badge: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: BrandColors.error,
  },
  countBadge: {
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: BrandColors.error,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
