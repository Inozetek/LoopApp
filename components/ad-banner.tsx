/**
 * Ad Banner Placeholder
 * Shows where banner ads will appear (AdMob integration coming later)
 */

import { View, Text, StyleSheet, Platform } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius } from '@/constants/brand';

interface AdBannerProps {
  size?: 'banner' | 'large' | 'medium';
}

export function AdBanner({ size = 'banner' }: AdBannerProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  // Standard IAB ad sizes
  const adSizes = {
    banner: { width: 320, height: 50 },      // Standard banner
    large: { width: 320, height: 100 },       // Large banner
    medium: { width: 300, height: 250 },      // Medium rectangle
  };

  const { width, height } = adSizes[size];

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBackground }]}>
      <View
        style={[
          styles.adPlaceholder,
          {
            width,
            height,
            borderColor: colors.border,
            backgroundColor: colors.backgroundSecondary,
          }
        ]}
      >
        <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
          Ad Space
        </Text>
        <Text style={[styles.placeholderSubtext, { color: colors.textTertiary }]}>
          {width} × {height}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  adPlaceholder: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    ...Typography.caption,
    fontFamily: 'Urbanist-Medium',
    marginBottom: 4,
  },
  placeholderSubtext: {
    ...Typography.caption,
    fontSize: 10,
  },
});
