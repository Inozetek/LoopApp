/**
 * Animated Tab Icon Component
 *
 * Provides consistent animation behavior for all tab bar icons:
 * - Subtle scale animation on selection
 * - Optional badge indicator
 * - Smooth transitions
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated as RNAnimated, View, Text, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandColors, BorderRadius } from '@/constants/brand';

interface AnimatedTabIconProps {
  name?: string;
  focusedName?: string; // Filled icon name when selected (Instagram-style)
  size: number;
  color: string;
  focused?: boolean;
  badge?: number; // Optional badge count
  customIcon?: (props: { size: number; color: string; focused: boolean }) => React.ReactNode;
}

export function AnimatedTabIcon({
  name,
  focusedName,
  size,
  color,
  focused = false,
  badge,
  customIcon,
}: AnimatedTabIconProps) {
  // Use filled icon when focused (Instagram-style)
  const iconName = focused && focusedName ? focusedName : name;
  // Animation for scale effect when selected
  const scaleAnim = useRef(new RNAnimated.Value(focused ? 1 : 0.92)).current;

  // Badge persistence: once the tab has been visited while having a badge,
  // keep showing the dot (not count) even after navigating away.
  // Only resets when badge count drops to 0.
  const [hasSeen, setHasSeen] = useState(false);

  useEffect(() => {
    if (focused && badge && badge > 0) {
      setHasSeen(true);
    }
  }, [focused, badge]);

  useEffect(() => {
    if (!badge || badge <= 0) {
      setHasSeen(false);
    }
  }, [badge]);

  const showAsDot = badge !== undefined && badge > 0 && (focused || hasSeen);

  useEffect(() => {
    RNAnimated.spring(scaleAnim, {
      toValue: focused ? 1.05 : 0.92,
      friction: 5,
      tension: 350,
      useNativeDriver: true,
    }).start();
  }, [focused, scaleAnim]);

  return (
    <RNAnimated.View
      style={[
        styles.container,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      {customIcon ? customIcon({ size, color, focused }) : <IconSymbol size={size} name={iconName as any} color={color} />}

      {/* Badge: dot (persistent after first visit) or count pill (before first visit) */}
      {badge !== undefined && badge > 0 && (
        showAsDot ? (
          <View style={styles.dotContainer}>
            <View style={styles.dot} />
          </View>
        ) : (
          <View style={styles.badgeContainer}>
            <View style={styles.badgePill}>
              <Text style={styles.badgeText}>
                {badge > 99 ? '99+' : badge}
              </Text>
            </View>
          </View>
        )
      )}
    </RNAnimated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: -3,
    right: -6,
  },
  badgePill: {
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: BrandColors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  dotContainer: {
    position: 'absolute',
    bottom: 1,
    right: -3,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: BrandColors.error,
  },
});
