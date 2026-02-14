/**
 * Group Suggestions Map Preview
 * Shows a small map with the midpoint marker and venue markers
 * for group activity suggestions.
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BrandColors, BorderRadius } from '@/constants/brand';

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

// Conditionally load react-native-maps on native only
let MapView: any = null;
let Marker: any = null;

if (Platform.OS !== 'web') {
  try {
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
  } catch {
    // Maps not available
  }
}

export function GroupSuggestionsMap({ midpoint, suggestions }: GroupSuggestionsMapProps) {
  if (!MapView || Platform.OS === 'web') {
    // Web fallback handled by .web.tsx file
    return null;
  }

  // Calculate map region to fit all points
  const allLats = [midpoint.latitude, ...suggestions.filter((s) => s.latitude).map((s) => s.latitude!)];
  const allLngs = [midpoint.longitude, ...suggestions.filter((s) => s.longitude).map((s) => s.longitude!)];
  const minLat = Math.min(...allLats);
  const maxLat = Math.max(...allLats);
  const minLng = Math.min(...allLngs);
  const maxLng = Math.max(...allLngs);
  const latDelta = Math.max((maxLat - minLat) * 1.5, 0.02);
  const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.02);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: (minLat + maxLat) / 2,
          longitude: (minLng + maxLng) / 2,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {/* Midpoint marker */}
        <Marker
          coordinate={midpoint}
          pinColor={BrandColors.loopBlue}
          title="Group Midpoint"
        />

        {/* Venue markers */}
        {suggestions.map((s) =>
          s.latitude && s.longitude ? (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.latitude, longitude: s.longitude }}
              pinColor={BrandColors.loopGreen}
              title={s.name}
            />
          ) : null
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 180,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: 12,
  },
  map: {
    flex: 1,
  },
});
