/**
 * Animated Tab Icon Component
 *
 * Provides consistent animation behavior for all tab bar icons:
 * - Subtle scale animation on selection
 * - Optional badge indicator
 * - Smooth transitions
 */

import React, { useEffect, useRef } from 'react';
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

      {/* Badge indicator */}
      {badge !== undefined && badge > 0 && (
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
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
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: BrandColors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
