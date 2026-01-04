/**
 * Combined Map View Component
 *
 * Shows a unified map with:
 * - Google Places results (search results)
 * - User's scheduled calendar tasks
 * - Routes connecting user's tasks
 * - Legend explaining different pin types
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { BrandColors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import type { Recommendation } from '@/types/activity';

interface CalendarTask {
  id: string;
  title: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  start_time: string;
  category: string;
}

interface CombinedMapViewProps {
  searchResults: Recommendation[]; // Google Places results
  calendarTasks?: CalendarTask[]; // User's scheduled tasks
  userLocation?: { latitude: number; longitude: number };
  onMarkerPress?: (item: Recommendation | CalendarTask, type: 'search' | 'task') => void;
}

export function CombinedMapView({
  searchResults,
  calendarTasks = [],
  userLocation,
  onMarkerPress,
}: CombinedMapViewProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const mapRef = useRef<MapView>(null);

  const [showLegend, setShowLegend] = useState(true);
  const [initialRegion, setInitialRegion] = useState<Region | undefined>(undefined);

  useEffect(() => {
    // Calculate initial region to show all markers
    if (searchResults.length === 0 && calendarTasks.length === 0 && !userLocation) {
      return;
    }

    const allCoordinates: Array<{ latitude: number; longitude: number }> = [];

    // Add user location
    if (userLocation) {
      allCoordinates.push(userLocation);
    }

    // Add search results
    searchResults.forEach(result => {
      if (result.activity?.location) {
        allCoordinates.push({
          latitude: result.activity.location.latitude,
          longitude: result.activity.location.longitude,
        });
      }
    });

    // Add calendar tasks
    calendarTasks.forEach(task => {
      if (task.location) {
        allCoordinates.push({
          latitude: task.location.latitude,
          longitude: task.location.longitude,
        });
      }
    });

    if (allCoordinates.length === 0) return;

    // Calculate bounding box
    const latitudes = allCoordinates.map(c => c.latitude);
    const longitudes = allCoordinates.map(c => c.longitude);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latDelta = (maxLat - minLat) * 1.5; // Add 50% padding
    const lngDelta = (maxLng - minLng) * 1.5;

    setInitialRegion({
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(latDelta, 0.05), // Minimum zoom level
      longitudeDelta: Math.max(lngDelta, 0.05),
    });
  }, [searchResults, calendarTasks, userLocation]);

  // Fit map to show all markers
  const fitMapToMarkers = () => {
    if (!mapRef.current) return;

    const coordinates: Array<{ latitude: number; longitude: number }> = [];

    if (userLocation) coordinates.push(userLocation);

    searchResults.forEach(result => {
      if (result.activity?.location) {
        coordinates.push({
          latitude: result.activity.location.latitude,
          longitude: result.activity.location.longitude,
        });
      }
    });

    calendarTasks.forEach(task => {
      if (task.location) {
        coordinates.push({
          latitude: task.location.latitude,
          longitude: task.location.longitude,
        });
      }
    });

    if (coordinates.length > 0) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
        animated: true,
      });
    }
  };

  // Get category icon and color
  const getCategoryIcon = (category: string): { icon: string; color: string } => {
    const categoryMap: Record<string, { icon: string; color: string }> = {
      dining: { icon: 'restaurant', color: '#FF6B6B' },
      coffee: { icon: 'cafe', color: '#D4A574' },
      fitness: { icon: 'fitness', color: '#95E1D3' },
      entertainment: { icon: 'film', color: '#3498DB' },
      nightlife: { icon: 'wine', color: '#E74C3C' },
      shopping: { icon: 'cart', color: '#F39C12' },
      outdoor: { icon: 'leaf', color: '#27AE60' },
      culture: { icon: 'color-palette', color: '#1ABC9C' },
    };

    return categoryMap[category.toLowerCase()] || { icon: 'location', color: BrandColors.loopBlue };
  };

  // Create polyline for calendar tasks (route connecting tasks)
  const taskRoute = calendarTasks
    .filter(task => task.location)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .map(task => ({
      latitude: task.location.latitude,
      longitude: task.location.longitude,
    }));

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        customMapStyle={isDark ? darkMapStyle : []}
      >
        {/* User's Current Location */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title="Your Location"
            pinColor={BrandColors.loopBlue}
          />
        )}

        {/* Search Results (Google Places) */}
        {searchResults.map((result, index) => {
          if (!result.activity?.location) return null;

          const { icon, color } = getCategoryIcon(result.category);

          return (
            <Marker
              key={`search-${result.id}`}
              coordinate={{
                latitude: result.activity.location.latitude,
                longitude: result.activity.location.longitude,
              }}
              title={result.title}
              description={`${result.category} • ${result.distance}`}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onMarkerPress?.(result, 'search');
              }}
            >
              <View style={[styles.customMarker, { backgroundColor: color }]}>
                <Ionicons name={icon as any} size={20} color="#ffffff" />
              </View>
            </Marker>
          );
        })}

        {/* Calendar Tasks (Numbered) */}
        {calendarTasks.map((task, index) => {
          if (!task.location) return null;

          const { icon, color } = getCategoryIcon(task.category);

          return (
            <Marker
              key={`task-${task.id}`}
              coordinate={{
                latitude: task.location.latitude,
                longitude: task.location.longitude,
              }}
              title={task.title}
              description={new Date(task.start_time).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onMarkerPress?.(task, 'task');
              }}
            >
              <View style={[styles.customMarker, styles.taskMarker, { backgroundColor: color }]}>
                <Text style={styles.taskNumber}>{index + 1}</Text>
              </View>
            </Marker>
          );
        })}

        {/* Polyline connecting calendar tasks */}
        {taskRoute.length > 1 && (
          <Polyline
            coordinates={taskRoute}
            strokeColor={BrandColors.loopBlue}
            strokeWidth={3}
            lineDashPattern={[5, 5]}
          />
        )}
      </MapView>

      {/* Legend */}
      {showLegend && (
        <View style={[styles.legend, { backgroundColor: colors.background }]}>
          <View style={styles.legendHeader}>
            <Text style={[Typography.labelLarge, { color: colors.text }]}>Map Legend</Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowLegend(false);
              }}
            >
              <Ionicons name="close" size={20} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: BrandColors.loopBlue }]} />
              <Text style={[Typography.bodySmall, { color: colors.text }]}>Your Location</Text>
            </View>

            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF6B6B' }]} />
              <Text style={[Typography.bodySmall, { color: colors.text }]}>Search Results</Text>
            </View>

            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.taskDot, { backgroundColor: '#27AE60' }]}>
                <Text style={styles.legendNumber}>1</Text>
              </View>
              <Text style={[Typography.bodySmall, { color: colors.text }]}>Your Scheduled Tasks</Text>
            </View>

            <View style={styles.legendItem}>
              <View style={styles.legendLine} />
              <Text style={[Typography.bodySmall, { color: colors.text }]}>Suggested Route</Text>
            </View>
          </View>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.background }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            fitMapToMarkers();
          }}
        >
          <Ionicons name="expand-outline" size={24} color={BrandColors.loopBlue} />
        </TouchableOpacity>

        {!showLegend && (
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.background }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowLegend(true);
            }}
          >
            <Ionicons name="information-circle-outline" size={24} color={BrandColors.loopBlue} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// Dark mode map style (Google Maps style array)
const darkMapStyle = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#212121' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#212121' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#757575' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#bdbdbd' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#757575' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#181818' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#616161' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#1b1b1b' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.fill',
    stylers: [{ color: '#2c2c2c' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8a8a8a' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#373737' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#3c3c3c' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [{ color: '#4e4e4e' }],
  },
  {
    featureType: 'road.local',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#616161' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#757575' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#000000' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3d3d3d' }],
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  customMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    ...Shadows.md,
  },
  taskMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  taskNumber: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  legend: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadows.lg,
  },
  legendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  legendItems: {
    gap: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  legendDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  taskDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendNumber: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  legendLine: {
    width: 24,
    height: 3,
    backgroundColor: BrandColors.loopBlue,
    borderRadius: 2,
  },
  controls: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
    gap: Spacing.sm,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
});
