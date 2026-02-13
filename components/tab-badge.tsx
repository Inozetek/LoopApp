/**
 * Tab Badge Component
 * Shows a notification indicator on tab bar icons
 *
 * Design: Instagram/Snapchat-style integrated indicator
 * - Small dot sits within the icon's visual space
 * - Subtle gradient glow effect
 * - No harsh floating badges
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BrandColors } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface TabBadgeProps {
  children: React.ReactNode;
  count?: number;
  showDot?: boolean; // Show just a dot instead of count
}

export function TabBadge({ children, count = 0, showDot = false }: TabBadgeProps) {
  const colorScheme = useColorScheme();
  const shouldShow = showDot || count > 0;
  const borderColor = colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF';

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
            count > 0 && !showDot && styles.countBadge
          ]}>
            {count > 0 && !showDot && (
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
    top: -2,
    right: -2,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrandColors.loopBlue,
    borderWidth: 1.5,
  },
  countBadge: {
    width: 'auto',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
