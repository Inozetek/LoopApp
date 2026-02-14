/**
 * Map Preview Component (Web)
 *
 * Web fallback — react-native-maps only works on mobile.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors, Typography, Spacing } from '@/constants/brand';

interface MapPreviewProps {
  latitude: number;
  longitude: number;
  markerColor?: string;
}

export function MapPreview({ latitude, longitude }: MapPreviewProps) {
  return (
    <View style={styles.fallback}>
      <Ionicons name="map-outline" size={48} color={BrandColors.loopBlue} />
      <Text style={styles.fallbackText}>
        Map preview available on mobile
      </Text>
      <Text style={styles.coordsText}>
        {latitude.toFixed(4)}, {longitude.toFixed(4)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  fallbackText: {
    ...Typography.bodyMedium,
    color: '#999',
    marginTop: Spacing.sm,
  },
  coordsText: {
    ...Typography.bodySmall,
    color: BrandColors.loopBlue,
    marginTop: Spacing.xs,
  },
});
