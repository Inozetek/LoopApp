/**
 * Group Suggestions Map Preview (Web Version)
 * Shows a placeholder since react-native-maps only works on mobile.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors, Typography, BorderRadius, Spacing } from '@/constants/brand';

interface Suggestion {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
}

interface GroupSuggestionsMapProps {
  midpoint: { latitude: number; longitude: number };
  suggestions: Suggestion[];
}

export function GroupSuggestionsMap({ midpoint, suggestions }: GroupSuggestionsMapProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="map-outline" size={32} color={BrandColors.loopBlue} />
      <Text style={[Typography.bodySmall, styles.text]}>
        Map preview available on mobile
      </Text>
      <Text style={[Typography.labelSmall, styles.subtext]}>
        {suggestions.filter((s) => s.latitude).length} venues near midpoint
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 120,
    borderRadius: BorderRadius.md,
    backgroundColor: '#f0f4f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  text: {
    color: BrandColors.loopBlue,
    marginTop: Spacing.sm,
  },
  subtext: {
    color: BrandColors.lightGray,
    marginTop: 2,
  },
});
