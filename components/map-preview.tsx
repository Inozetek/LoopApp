/**
 * Map Preview Component (Native)
 *
 * Shows a small interactive map pin for a single location.
 * Used in the calendar create-event modal.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors, Typography, Spacing } from '@/constants/brand';

let MapView: any;
let Marker: any;
let PROVIDER_GOOGLE: any;
let mapsAvailable = false;

if (Platform.OS !== 'web') {
  try {
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
    PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
    mapsAvailable = true;
  } catch {
    mapsAvailable = false;
  }
}

interface MapPreviewProps {
  latitude: number;
  longitude: number;
  markerColor?: string;
}

export function MapPreview({ latitude, longitude, markerColor = BrandColors.loopBlue }: MapPreviewProps) {
  if (!mapsAvailable || !MapView) {
    return (
      <View style={styles.fallback}>
        <Ionicons name="map-outline" size={48} color={BrandColors.loopBlue} />
        <Text style={styles.fallbackText}>
          {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        scrollEnabled
        zoomEnabled
        pitchEnabled={false}
        rotateEnabled
        showsUserLocation
        showsMyLocationButton={false}
      >
        <Marker
          coordinate={{ latitude, longitude }}
          pinColor={markerColor}
        />
      </MapView>
      <View style={styles.hint}>
        <Ionicons name="information-circle" size={14} color="#999" />
        <Text style={styles.hintText}>Pinch to zoom</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: 180,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  hintText: {
    fontSize: 12,
    color: '#999',
  },
  fallback: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  fallbackText: {
    ...Typography.bodySmall,
    color: '#999',
    marginTop: Spacing.sm,
  },
});
