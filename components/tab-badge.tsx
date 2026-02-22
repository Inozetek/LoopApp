/**
 * Tab Badge Component
 * Shows a notification indicator on tab bar icons
 *
 * Design: Instagram/Snapchat-style integrated indicator
 * - Small dot sits within the icon's visual space
 * - Subtle gradient glow effect
 * - No harsh floating badges
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BrandColors } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface TabBadgeProps {
  children: React.ReactNode;
  count?: number;
  showDot?: boolean; // Show just a dot instead of count
  focused?: boolean; // When focused, count badge transitions to a simple dot (Instagram pattern)
}

export function TabBadge({ children, count = 0, showDot = false, focused = false }: TabBadgeProps) {
  const colorScheme = useColorScheme();
  const shouldShow = showDot || count > 0;
  const borderColor = colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF';

  // Badge persistence: once tab is visited while having a count, keep showing dot
  const [hasSeen, setHasSeen] = useState(false);

  useEffect(() => {
    if (focused && count > 0) {
      setHasSeen(true);
    }
  }, [focused, count]);

  useEffect(() => {
    if (count <= 0) {
      setHasSeen(false);
    }
  }, [count]);

  const showAsDot = showDot || ((focused || hasSeen) && count > 0);

  return (
    <View style={styles.container}>
      {children}
      {shouldShow && (
        <View style={styles.badgeContainer}>
          {/* Glow effect behind badge */}
          <View style={styles.badgeGlow} />
          {/* Badge itself */}
          <View style={[
            styles.badge,
            { borderColor },
            count > 0 && !showAsDot && styles.countBadge
          ]}>
            {count > 0 && !showAsDot && (
              <Text style={styles.badgeText}>
                {count > 9 ? '9+' : count}
              </Text>
            )}
          </View>
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
    backgroundColor: BrandColors.loopBlue,
    opacity: 0.3,
  },
  badge: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: BrandColors.loopBlue,
    borderWidth: 1.5,
  },
  countBadge: {
    width: 'auto',
    minWidth: 14,
    height: 14,
    borderRadius: 7,
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
