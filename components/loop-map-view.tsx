/**
 * Loop Map View Component
 *
 * Visualizes a user's daily "loop" - their scheduled tasks connected by routes on a map.
 * Shows numbered task pins connected by polylines, forming a literal loop.
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors, Typography, Spacing } from '@/constants/brand';

// Conditionally import react-native-maps only on native platforms
let MapView: any;
let Marker: any;
let Polyline: any;
let Callout: any;
let PROVIDER_GOOGLE: any;

if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Polyline = maps.Polyline;
  Callout = maps.Callout;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
}

interface TaskLocation {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  address: string;
  start_time: string;
  category: string;
}

interface LoopMapViewProps {
  tasks: TaskLocation[];
  homeLocation?: { latitude: number; longitude: number };
  onTaskPress?: (taskId: string) => void;
}

export function LoopMapView({ tasks, homeLocation, onTaskPress }: LoopMapViewProps) {
  const mapRef = useRef<any>(null);

  // Default to Dallas if no location provided (demo mode)
  const defaultHome = homeLocation || {
    latitude: 32.7767,
    longitude: -96.7970,
  };

  // Fit map to show all tasks
  useEffect(() => {
    if (tasks.length > 0 && mapRef.current) {
      const coordinates = [
        defaultHome,
        ...tasks.map(t => ({ latitude: t.latitude, longitude: t.longitude })),
      ];

      // Slight delay to ensure map is rendered
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }, 100);
    }
  }, [tasks]);

  // Build route coordinates (home → task1 → task2 → ... → home)
  const routeCoordinates = [
    defaultHome,
    ...tasks.map(task => ({
      latitude: task.latitude,
      longitude: task.longitude,
    })),
    defaultHome, // Complete the loop
  ];

  const getCategoryColor = (category: string): string => {
    const colors: { [key: string]: string } = {
      dining: '#FF6B6B',
      entertainment: '#4ECDC4',
      fitness: '#95E1D3',
      social: '#F38181',
      work: '#AA96DA',
      personal: '#FCBAD3',
      travel: '#A8D8EA',
      other: '#C7CEEA',
    };
    return colors[category.toLowerCase()] || BrandColors.loopBlue;
  };

  if (tasks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="map-outline" size={64} color={BrandColors.loopBlue} />
        <Text style={[styles.emptyTitle, Typography.headlineSmall]}>
          No Tasks Scheduled
        </Text>
        <Text style={[styles.emptySubtitle, Typography.bodyMedium]}>
          Add tasks to see your Loop visualization
        </Text>
      </View>
    );
  }

  // Web fallback - maps not supported on web
  if (Platform.OS === 'web') {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="map-outline" size={64} color={BrandColors.loopBlue} />
        <Text style={[styles.emptyTitle, Typography.headlineSmall]}>
          Map View Not Available
        </Text>
        <Text style={[styles.emptySubtitle, Typography.bodyMedium]}>
          Loop Map View is only available on iOS and Android.
          {'\n\n'}
          You have {tasks.length} task{tasks.length !== 1 ? 's' : ''} scheduled today.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: defaultHome.latitude,
          longitude: defaultHome.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {/* Home Marker (Starting Point) */}
        <Marker
          coordinate={defaultHome}
          title="Home"
          description="Start/End Point"
          pinColor={BrandColors.loopGreen}
        >
          <View style={styles.homeMarker}>
            <Ionicons name="home" size={24} color="white" />
          </View>
        </Marker>

        {/* Task Markers (Numbered) with Labels */}
        {tasks.map((task, index) => (
          <Marker
            key={task.id}
            coordinate={{
              latitude: task.latitude,
              longitude: task.longitude,
            }}
            title={task.title}
            description={task.address}
            onPress={() => onTaskPress?.(task.id)}
          >
            <View style={styles.markerContainer}>
              {/* Label above pin (always visible) - like Google Maps */}
              <View style={styles.markerLabel}>
                <Text style={styles.markerLabelText} numberOfLines={1}>
                  {task.title}
                </Text>
              </View>
              {/* Pin with number */}
              <View
                style={[
                  styles.taskMarker,
                  { backgroundColor: getCategoryColor(task.category) },
                ]}
              >
                <Text style={styles.taskNumber}>{index + 1}</Text>
              </View>
            </View>

            {/* Callout (shown when tapped) */}
            <Callout onPress={() => onTaskPress?.(task.id)}>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle} numberOfLines={2}>
                  {task.title}
                </Text>
                <Text style={styles.calloutSubtitle} numberOfLines={2}>
                  {task.address}
                </Text>
                <Text style={styles.calloutTime}>
                  {new Date(task.start_time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
                <Text style={styles.calloutTap}>Tap to view details</Text>
              </View>
            </Callout>
          </Marker>
        ))}

        {/* Route Polyline (The "Loop") */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={BrandColors.loopBlue}
            strokeWidth={3}
            lineDashPattern={[1]}
          />
        )}
      </MapView>

      {/* Loop Stats Overlay */}
      <View style={styles.statsOverlay}>
        <View style={styles.statItem}>
          <Ionicons name="location" size={16} color={BrandColors.loopBlue} />
          <Text style={styles.statText}>{tasks.length} stops</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="time" size={16} color={BrandColors.loopBlue} />
          <Text style={styles.statText}>
            {tasks.length > 0
              ? `${new Date(tasks[0].start_time).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })} start`
              : 'No start time'}
          </Text>
        </View>
      </View>

      {/* Task Timeline (Optional - can expand this) */}
      {tasks.length > 0 && (
        <View style={styles.timelineHint}>
          <Text style={styles.timelineText}>
            🏠 → {tasks.map((_, i) => `${i + 1}`).join(' → ')} → 🏠
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: '#f8f9fa',
  },
  emptyTitle: {
    marginTop: Spacing.lg,
    color: '#1a1a1a',
  },
  emptySubtitle: {
    marginTop: Spacing.sm,
    color: '#666',
    textAlign: 'center',
  },
  homeMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BrandColors.loopGreen,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  taskNumber: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  markerLabel: {
    marginBottom: 4, // Space between label and pin (changed from marginTop)
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    maxWidth: 120,
  },
  markerLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  calloutContainer: {
    padding: 12,
    minWidth: 200,
    maxWidth: 250,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  calloutSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  calloutTime: {
    fontSize: 13,
    fontWeight: '600',
    color: BrandColors.loopBlue,
    marginBottom: 8,
  },
  calloutTap: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  statsOverlay: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e0e0e0',
    marginHorizontal: Spacing.md,
  },
  statText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  timelineHint: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  timelineText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
});
