/**
 * Loop Map View Component
 *
 * Visualizes a user's daily "loop" - their scheduled tasks connected by routes on a map.
 * Shows numbered task pins connected by polylines, forming a literal loop.
 */

import React, { useRef, useEffect, useMemo, useState, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, ActivityIndicator, LayoutChangeEvent, TouchableOpacity, Animated as RNAnimated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors, CategoryColors, Typography, Spacing, BorderRadius } from '@/constants/brand';
import { getMapStyle } from '@/constants/map-styles';
import { calculateRouteStats } from '@/utils/route-calculations';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Error Boundary for catching map rendering errors
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class MapErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🗺️ Map Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Conditionally import react-native-maps only on native platforms
let MapView: any;
let Marker: any;
let Polyline: any;
let Callout: any;
let PROVIDER_GOOGLE: any;
let PROVIDER_DEFAULT: any;
let mapsLoadError: Error | null = null;

if (Platform.OS !== 'web') {
  try {
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
    Polyline = maps.Polyline;
    Callout = maps.Callout;
    PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
    PROVIDER_DEFAULT = maps.PROVIDER_DEFAULT;
  } catch (error) {
    console.error('Failed to load react-native-maps:', error);
    mapsLoadError = error as Error;
  }
}

// Check if Google Maps API key is available
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

interface TaskLocation {
  id: string;
  title: string;
  // Support both flat and nested formats
  latitude?: number;
  longitude?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  address: string;
  start_time: string;
  category: string;
}

interface LoopMapViewProps {
  tasks: TaskLocation[];
  homeLocation?: { latitude: number; longitude: number };
  currentLocation?: { latitude: number; longitude: number };
  onTaskPress?: (taskId: string) => void;
  onViewFeed?: () => void; // Navigate to recommendation feed from home
}

// Normalize coordinates from various PostGIS formats
const normalizeCoordinates = (task: TaskLocation): { latitude: number; longitude: number } | null => {
  // Prefer flat coords
  if (typeof task.latitude === 'number' && typeof task.longitude === 'number' &&
      !isNaN(task.latitude) && !isNaN(task.longitude)) {
    return { latitude: task.latitude, longitude: task.longitude };
  }
  // Fall back to nested
  if (task.location?.latitude && task.location?.longitude &&
      !isNaN(task.location.latitude) && !isNaN(task.location.longitude)) {
    return { latitude: task.location.latitude, longitude: task.location.longitude };
  }
  return null;
};

export function LoopMapView({ tasks, homeLocation, currentLocation, onTaskPress, onViewFeed }: LoopMapViewProps) {
  const mapRef = useRef<any>(null);
  const colorScheme = useColorScheme();
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const lastFitRef = useRef<string>('');
  const [containerReady, setContainerReady] = useState(false);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [homeSelected, setHomeSelected] = useState(false);

  // Animation for the "in progress" route line
  const routePulseAnim = useRef(new RNAnimated.Value(0)).current;

  // Animation values for glow and line pulse effects
  const glowAnim = useRef(new RNAnimated.Value(0)).current;
  const linePulseAnim = useRef(new RNAnimated.Value(0)).current;

  // Use provided home location or fall back to Dallas for demo mode
  const hasRealHome = Boolean(homeLocation?.latitude && homeLocation?.longitude);
  const defaultHome = useMemo(() => {
    if (hasRealHome) {
      console.log('🏠 Using provided home location:', homeLocation);
      return homeLocation!;
    }
    console.log('⚠️ No home location provided, using Dallas default');
    return {
      latitude: 32.7767,
      longitude: -96.7970,
    };
  }, [homeLocation?.latitude, homeLocation?.longitude, hasRealHome]);

  // Memoize valid task coordinates to prevent recalculation
  const validTaskCoords = useMemo(() => {
    return tasks
      .map(task => {
        const coords = normalizeCoordinates(task);
        if (!coords) return null;

        const { latitude, longitude } = coords;

        // Validate ranges
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          console.warn(`⚠️ Invalid coordinate range for task: ${task.title}`);
          return null;
        }

        return { id: task.id, latitude, longitude, startTime: task.start_time };
      })
      .filter((coord): coord is { id: string; latitude: number; longitude: number; startTime: string } => coord !== null);
  }, [tasks]);

  // Find the next upcoming task based on current time
  const nextTaskInfo = useMemo(() => {
    const now = new Date();
    const upcomingTasks = tasks
      .map((task, index) => {
        const startTime = new Date(task.start_time);
        return { task, index, startTime, diff: startTime.getTime() - now.getTime() };
      })
      .filter(t => t.diff > -60 * 60 * 1000) // Include tasks started within last hour
      .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff));

    if (upcomingTasks.length > 0) {
      const nextTask = upcomingTasks[0];
      const coords = normalizeCoordinates(nextTask.task);
      return {
        taskId: nextTask.task.id,
        index: nextTask.index,
        coords,
        isUpcoming: nextTask.diff > 0,
      };
    }
    return null;
  }, [tasks]);

  // Calculate route segments: completed (blue), in-progress (animated), and future (gray)
  const routeSegments = useMemo(() => {
    if (validTaskCoords.length === 0) return { completed: [], inProgress: null, future: [] };

    const now = new Date();
    const taskCoords = validTaskCoords.map(({ latitude, longitude }) => ({ latitude, longitude }));

    // Find the index of the next task (first task that hasn't started yet or started within last hour)
    let nextTaskIndex = validTaskCoords.findIndex(coord => {
      const task = tasks.find(t => t.id === coord.id);
      if (!task) return false;
      const startTime = new Date(task.start_time);
      const diff = startTime.getTime() - now.getTime();
      return diff > -60 * 60 * 1000; // Task hasn't started or started within last hour
    });

    // If no upcoming tasks, all are completed
    if (nextTaskIndex === -1) {
      nextTaskIndex = validTaskCoords.length;
    }

    // Build route segments
    const allPoints = hasRealHome ? [defaultHome, ...taskCoords, defaultHome] : taskCoords;

    // Completed segments: home -> all tasks up to (but not including) next task
    const completedSegments: { latitude: number; longitude: number }[][] = [];
    if (hasRealHome && nextTaskIndex > 0) {
      // Home to first completed task, then between completed tasks
      const completedPoints = [defaultHome, ...taskCoords.slice(0, nextTaskIndex)];
      if (completedPoints.length >= 2) {
        completedSegments.push(completedPoints);
      }
    } else if (!hasRealHome && nextTaskIndex > 0) {
      // Just between completed tasks
      const completedPoints = taskCoords.slice(0, nextTaskIndex);
      if (completedPoints.length >= 2) {
        completedSegments.push(completedPoints);
      }
    }

    // In-progress segment: from last completed task (or home) to next task
    let inProgressSegment: { latitude: number; longitude: number }[] | null = null;
    if (nextTaskIndex < validTaskCoords.length) {
      const nextTaskCoord = taskCoords[nextTaskIndex];
      let startPoint: { latitude: number; longitude: number };

      if (currentLocation) {
        // Use current location as start point
        startPoint = currentLocation;
      } else if (nextTaskIndex > 0) {
        // Start from last completed task
        startPoint = taskCoords[nextTaskIndex - 1];
      } else if (hasRealHome) {
        // Start from home
        startPoint = defaultHome;
      } else {
        startPoint = nextTaskCoord; // Fallback
      }

      if (startPoint !== nextTaskCoord) {
        inProgressSegment = [startPoint, nextTaskCoord];
      }
    }

    // Future segments: from next task onwards
    const futureSegments: { latitude: number; longitude: number }[][] = [];
    if (nextTaskIndex < validTaskCoords.length) {
      const futurePoints = taskCoords.slice(nextTaskIndex);
      if (futurePoints.length >= 2) {
        futureSegments.push(futurePoints);
      }
      // Add return to home segment if applicable
      if (hasRealHome && futurePoints.length > 0) {
        futureSegments.push([futurePoints[futurePoints.length - 1], defaultHome]);
      }
    } else if (hasRealHome && validTaskCoords.length > 0) {
      // All tasks completed, return home segment is future
      futureSegments.push([taskCoords[taskCoords.length - 1], defaultHome]);
    }

    return {
      completed: completedSegments,
      inProgress: inProgressSegment,
      future: futureSegments,
    };
  }, [validTaskCoords, tasks, hasRealHome, defaultHome, currentLocation]);

  // Animation for the in-progress route
  const [inProgressOpacity, setInProgressOpacity] = useState(0.4);

  useEffect(() => {
    if (!mapReady || !routeSegments.inProgress) return;

    // Pulse animation for in-progress route
    const pulseAnimation = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(routePulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        RNAnimated.timing(routePulseAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );

    pulseAnimation.start();

    // Update opacity based on animation
    const listenerId = routePulseAnim.addListener(({ value }) => {
      setInProgressOpacity(0.3 + value * 0.7); // Pulse between 0.3 and 1.0
    });

    return () => {
      pulseAnimation.stop();
      routePulseAnim.removeListener(listenerId);
    };
  }, [mapReady, routeSegments.inProgress, routePulseAnim]);

  // Start glow and line pulse animations when map is ready
  useEffect(() => {
    if (!mapReady) return;

    // Pulsing glow animation for next task marker
    const glowAnimation = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        RNAnimated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );

    // Subtle pulsing line animation
    const lineAnimation = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(linePulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        RNAnimated.timing(linePulseAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    glowAnimation.start();
    lineAnimation.start();

    return () => {
      glowAnimation.stop();
      lineAnimation.stop();
    };
  }, [mapReady, glowAnim, linePulseAnim]);

  // Note: Animation values (glowAnim, linePulseAnim) are kept for future use
  // but not currently used in rendering. The glow effect is now achieved
  // with static shadow styles for better marker stability.

  // Build route coordinates (home → task1 → task2 → ... → home)
  // Only include home in route if we have a real home location
  const routeCoordinates = useMemo(() => {
    const taskCoords = validTaskCoords.map(({ latitude, longitude }) => ({ latitude, longitude }));

    if (hasRealHome) {
      // Full loop: home → tasks → home
      return [defaultHome, ...taskCoords, defaultHome];
    } else {
      // Just connect tasks without home
      return taskCoords;
    }
  }, [defaultHome, validTaskCoords, hasRealHome]);

  // Calculate route statistics (distance and time)
  const routeStats = useMemo(() => {
    return calculateRouteStats(routeCoordinates);
  }, [routeCoordinates]);

  // Create a stable key for fit comparison
  const fitKey = useMemo(() => {
    return validTaskCoords.map(c => `${c.id}`).join(',') + `|${defaultHome.latitude},${defaultHome.longitude}`;
  }, [validTaskCoords, defaultHome]);

  // Fit map to show all tasks - only when tasks actually change
  useEffect(() => {
    if (!mapReady || validTaskCoords.length === 0 || !mapRef.current) return;

    // Prevent duplicate fits
    if (lastFitRef.current === fitKey) return;
    lastFitRef.current = fitKey;

    const coordinates = [
      defaultHome,
      ...validTaskCoords.map(({ latitude, longitude }) => ({ latitude, longitude })),
    ];

    // Delay to ensure map is rendered
    const timeoutId = setTimeout(() => {
      try {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 80, right: 50, bottom: 80, left: 50 },
          animated: true,
        });
      } catch (error) {
        console.error('Error fitting map to coordinates:', error);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [mapReady, fitKey, defaultHome, validTaskCoords]);

  const handleMapReady = useCallback(() => {
    console.log('🗺️ Map is ready');
    setMapReady(true);
  }, []);

  const handleMapError = useCallback((error: any) => {
    console.error('🗺️ Map error:', error);
    setMapError('Map failed to load. Please try again.');
  }, []);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setContainerDimensions({ width, height });
      setContainerReady(true);
    }
  }, []);

  // Use the same category colors as the calendar list view
  const getCategoryColor = (category: string | undefined): string => {
    if (!category) return BrandColors.loopBlue;
    return CategoryColors[category.toLowerCase()] || BrandColors.loopBlue;
  };

  // Calculate initial region - prioritize: current location > next task > first task > home
  // IMPORTANT: This useMemo must be called before any early returns to comply with React hooks rules
  const initialFocusPoint = useMemo(() => {
    // Priority 1: Current location if available
    if (currentLocation?.latitude && currentLocation?.longitude) {
      return {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        source: 'current',
      };
    }
    // Priority 2: Next upcoming task
    if (nextTaskInfo?.coords) {
      return {
        latitude: nextTaskInfo.coords.latitude,
        longitude: nextTaskInfo.coords.longitude,
        source: 'nextTask',
      };
    }
    // Priority 3: First task
    if (validTaskCoords.length > 0) {
      return {
        latitude: validTaskCoords[0].latitude,
        longitude: validTaskCoords[0].longitude,
        source: 'firstTask',
      };
    }
    // Fallback to home
    return {
      latitude: defaultHome.latitude,
      longitude: defaultHome.longitude,
      source: 'home',
    };
  }, [currentLocation, nextTaskInfo, validTaskCoords, defaultHome]);

  // Build "next task" route coordinates for animated line
  // IMPORTANT: This useMemo must be called before any early returns to comply with React hooks rules
  const nextTaskRouteCoords = useMemo(() => {
    if (!nextTaskInfo?.coords) return null;

    const startPoint = currentLocation || (hasRealHome ? defaultHome : null);
    if (!startPoint) return null;

    return [
      { latitude: startPoint.latitude, longitude: startPoint.longitude },
      { latitude: nextTaskInfo.coords.latitude, longitude: nextTaskInfo.coords.longitude },
    ];
  }, [nextTaskInfo, currentLocation, hasRealHome, defaultHome]);

  // No tasks scheduled
  if (tasks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="calendar-outline" size={64} color={BrandColors.loopOrange} />
        <Text style={[styles.emptyTitle, Typography.headlineSmall]}>
          Your Loop is Empty
        </Text>
        <Text style={[styles.emptySubtitle, Typography.bodyMedium]}>
          Add stops to see your Loop
        </Text>
      </View>
    );
  }

  // Tasks exist but no valid coordinates
  if (validTaskCoords.length === 0 && tasks.length > 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="warning-outline" size={64} color={BrandColors.loopOrange} />
        <Text style={[styles.emptyTitle, Typography.headlineSmall]}>
          Location Data Missing
        </Text>
        <Text style={[styles.emptySubtitle, Typography.bodyMedium]}>
          {tasks.length} stop{tasks.length > 1 ? 's' : ''} found, but no valid locations.
          {'\n'}
          Please ensure your stops have addresses.
        </Text>
      </View>
    );
  }

  // Note: homeLocation is optional - we use defaultHome as fallback (Dallas coordinates)
  // This allows the map to work in demo mode or when home is not set

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
          You have {tasks.length} stop{tasks.length !== 1 ? 's' : ''} in your Loop today.
        </Text>
      </View>
    );
  }

  // Maps module failed to load
  if (mapsLoadError || !MapView) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="warning-outline" size={64} color={BrandColors.loopOrange} />
        <Text style={[styles.emptyTitle, Typography.headlineSmall]}>
          Map Unavailable
        </Text>
        <Text style={[styles.emptySubtitle, Typography.bodyMedium]}>
          Could not load map component.
          {'\n'}
          {validTaskCoords.length} stop{validTaskCoords.length !== 1 ? 's' : ''} with valid locations.
        </Text>
      </View>
    );
  }

  // Runtime map error
  if (mapError) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={BrandColors.loopOrange} />
        <Text style={[styles.emptyTitle, Typography.headlineSmall]}>
          Map Error
        </Text>
        <Text style={[styles.emptySubtitle, Typography.bodyMedium]}>
          {mapError}
        </Text>
      </View>
    );
  }

  // Error fallback for MapErrorBoundary
  const mapErrorFallback = (
    <View style={styles.emptyContainer}>
      <Ionicons name="alert-circle-outline" size={64} color={BrandColors.loopOrange} />
      <Text style={[styles.emptyTitle, Typography.headlineSmall]}>
        Map Rendering Error
      </Text>
      <Text style={[styles.emptySubtitle, Typography.bodyMedium]}>
        Something went wrong displaying the map.
        {'\n'}
        {validTaskCoords.length} stop{validTaskCoords.length !== 1 ? 's' : ''} in your Loop.
      </Text>
    </View>
  );

  // Determine map provider - use Google Maps on both iOS and Android if API key available
  // Google Maps provides: custom styling, traffic layers, Street View previews, consistent UX cross-platform
  // Note: Apple Maps is kept as fallback if Google Maps fails to load
  const mapProvider = GOOGLE_MAPS_API_KEY ? PROVIDER_GOOGLE : undefined;

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {!containerReady ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.loopBlue} />
          <Text style={styles.loadingText}>Preparing map...</Text>
        </View>
      ) : (
        <MapErrorBoundary fallback={mapErrorFallback}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={mapProvider}
            onMapReady={handleMapReady}
            onError={handleMapError}
            initialRegion={{
              latitude: initialFocusPoint.latitude,
              longitude: initialFocusPoint.longitude,
              latitudeDelta: 0.05, // Start closer for a zoom-out effect
              longitudeDelta: 0.05,
            }}
            showsUserLocation={Boolean(currentLocation)}
            showsMyLocationButton={false}
            showsCompass={true}
            rotateEnabled={false}
            pitchEnabled={false}
            mapType="standard"
            customMapStyle={mapProvider === PROVIDER_GOOGLE ? getMapStyle(colorScheme ?? null) : undefined}
          >
            {/* COMPLETED routes - Bold Google Maps blue with navy border */}
            {/* Border layer (dark navy) */}
            {routeSegments.completed.map((segment, index) => (
              <Polyline
                key={`completed-border-${index}`}
                coordinates={segment}
                strokeColor={BrandColors.routeCompletedBorder}
                strokeWidth={7}
                lineCap="round"
                lineJoin="round"
              />
            ))}
            {/* Fill layer (Google Maps blue) */}
            {routeSegments.completed.map((segment, index) => (
              <Polyline
                key={`completed-${index}`}
                coordinates={segment}
                strokeColor={BrandColors.routeCompleted}
                strokeWidth={5}
                lineCap="round"
                lineJoin="round"
              />
            ))}

            {/* FUTURE routes - lighter blue with medium border (not yet traveled) */}
            {/* Border layer (medium blue) */}
            {routeSegments.future.map((segment, index) => (
              <Polyline
                key={`future-border-${index}`}
                coordinates={segment}
                strokeColor={BrandColors.routeFutureBorder}
                strokeWidth={6}
                lineCap="round"
                lineJoin="round"
              />
            ))}
            {/* Fill layer (light blue) */}
            {routeSegments.future.map((segment, index) => (
              <Polyline
                key={`future-${index}`}
                coordinates={segment}
                strokeColor={BrandColors.routeFuture}
                strokeWidth={4}
                lineCap="round"
                lineJoin="round"
              />
            ))}

            {/* IN-PROGRESS route - animated pulsing with navy border (current leg) */}
            {routeSegments.inProgress && (
              <>
                {/* Border layer (dark navy, matches completed) */}
                <Polyline
                  coordinates={routeSegments.inProgress}
                  strokeColor={BrandColors.routeInProgressBorder}
                  strokeWidth={8}
                  lineCap="round"
                  lineJoin="round"
                />
                {/* Fill layer (pulsing opacity 0.3-1.0 of Google Maps blue) */}
                <Polyline
                  coordinates={routeSegments.inProgress}
                  strokeColor={`rgba(26, 115, 232, ${inProgressOpacity})`}
                  strokeWidth={6}
                  lineCap="round"
                  lineJoin="round"
                />
              </>
            )}

            {/* Home marker - tappable to show tray */}
            {hasRealHome && (
              <Marker
                coordinate={defaultHome}
                title="Home"
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={homeSelected}
                onPress={() => {
                  setSelectedTaskId(null); // Deselect any task
                  setHomeSelected(!homeSelected);
                }}
              >
                <View style={[
                  styles.homeMarker,
                  homeSelected && styles.homeMarkerSelected,
                ]}>
                  <Ionicons name="home" size={20} color="white" />
                </View>
              </Marker>
            )}

            {/* Task markers with numbers - using validated coordinates */}
            {validTaskCoords.map((coord, index) => {
              const task = tasks.find(t => t.id === coord.id);
              const category = task?.category;
              const markerColor = getCategoryColor(category);
              const isSelected = selectedTaskId === coord.id;
              const isNextTask = nextTaskInfo?.taskId === coord.id;

              // Use consistent marker structure to prevent unmount/remount issues
              // The key fix: always use the same component tree structure
              return (
                <Marker
                  key={coord.id}
                  coordinate={{
                    latitude: coord.latitude,
                    longitude: coord.longitude,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={true}
                  stopPropagation={true}
                  onPress={() => {
                    // Toggle selection - tap same marker to deselect
                    setHomeSelected(false); // Deselect home when selecting a task
                    setSelectedTaskId(isSelected ? null : coord.id);
                  }}
                >
                  {/* Single consistent View structure - no conditional component tree */}
                  <View style={styles.markerWrapper}>
                    <View style={[
                      styles.taskMarker,
                      { backgroundColor: isNextTask ? BrandColors.loopBlue : markerColor },
                      isNextTask && styles.nextTaskMarker,
                      isSelected && styles.taskMarkerSelected,
                      isNextTask && styles.nextTaskGlow,
                    ]}>
                      <Text style={[
                        styles.taskNumber,
                        isNextTask && styles.nextTaskNumber,
                        isSelected && styles.taskNumberSelected,
                      ]}>
                        {index + 1}
                      </Text>
                    </View>
                  </View>
                </Marker>
              );
            })}

            {/* Current location marker if provided */}
            {currentLocation && (
              <Marker
                coordinate={currentLocation}
                title="You are here"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.currentLocationMarker}>
                  <View style={styles.currentLocationDot} />
                </View>
              </Marker>
            )}
          </MapView>
        </MapErrorBoundary>
      )}

      {/* Loop Stats Overlay */}
      {mapReady && (
        <View style={styles.statsOverlay}>
          <View style={styles.statItem}>
            <Ionicons name="location" size={16} color={BrandColors.loopBlue} />
            <Text style={styles.statText}>{validTaskCoords.length} {validTaskCoords.length === 1 ? 'stop' : 'stops'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="navigate" size={16} color={BrandColors.loopGreen} />
            <Text style={styles.statText}>{routeStats.distanceFormatted}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="time" size={16} color={BrandColors.loopOrange} />
            <Text style={styles.statText}>{routeStats.timeFormatted}</Text>
          </View>
        </View>
      )}

      {/* Next Task Indicator */}
      {mapReady && nextTaskInfo && !selectedTaskId && (() => {
        const nextTask = tasks.find(t => t.id === nextTaskInfo.taskId);
        if (!nextTask) return null;
        const taskTime = new Date(nextTask.start_time);
        const now = new Date();
        const diffMs = taskTime.getTime() - now.getTime();
        const diffMins = Math.round(diffMs / 60000);

        let timeLabel = '';
        if (diffMins < 0) {
          timeLabel = 'Now';
        } else if (diffMins < 60) {
          timeLabel = `in ${diffMins}m`;
        } else {
          const hours = Math.floor(diffMins / 60);
          timeLabel = `in ${hours}h`;
        }

        return (
          <View style={styles.nextTaskIndicator}>
            <View style={styles.nextTaskIndicatorBadge}>
              <Text style={styles.nextTaskIndicatorBadgeText}>NEXT</Text>
            </View>
            <Text style={styles.nextTaskIndicatorTitle} numberOfLines={1}>
              {nextTask.title}
            </Text>
            <Text style={styles.nextTaskIndicatorTime}>{timeLabel}</Text>
          </View>
        );
      })()}

      {/* Home Detail Panel */}
      {mapReady && homeSelected && !selectedTaskId && (
        <View style={styles.homeDetailPanel}>
          <TouchableOpacity
            style={styles.taskDetailClose}
            onPress={() => setHomeSelected(false)}
          >
            <Ionicons name="close" size={20} color="#666" />
          </TouchableOpacity>

          <View style={styles.taskDetailHeader}>
            <View style={[styles.taskDetailBadge, { backgroundColor: BrandColors.loopGreen }]}>
              <Ionicons name="home" size={16} color="white" />
            </View>
            <View style={styles.taskDetailInfo}>
              <Text style={styles.taskDetailTitle}>Home</Text>
              <Text style={styles.homeDetailSubtitle}>Your starting point</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.taskDetailButton, { backgroundColor: BrandColors.loopBlue }]}
            onPress={() => {
              onViewFeed?.();
              setHomeSelected(false);
            }}
          >
            <Ionicons name="sparkles" size={16} color="white" />
            <Text style={styles.taskDetailButtonText}>View Feed</Text>
            <Ionicons name="chevron-forward" size={16} color="white" />
          </TouchableOpacity>
        </View>
      )}

      {/* Selected Task Detail Panel */}
      {mapReady && selectedTaskId && (() => {
        const selectedIndex = validTaskCoords.findIndex(c => c.id === selectedTaskId);
        const selectedTask = tasks.find(t => t.id === selectedTaskId);
        if (!selectedTask || selectedIndex === -1) return null;

        const categoryColor = getCategoryColor(selectedTask.category);
        const formattedTime = selectedTask.start_time
          ? new Date(selectedTask.start_time).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })
          : '';

        return (
          <View style={styles.taskDetailPanel}>
            <TouchableOpacity
              style={styles.taskDetailClose}
              onPress={() => setSelectedTaskId(null)}
            >
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>

            <View style={styles.taskDetailHeader}>
              <View style={[styles.taskDetailBadge, { backgroundColor: categoryColor }]}>
                <Text style={styles.taskDetailBadgeText}>{selectedIndex + 1}</Text>
              </View>
              <View style={styles.taskDetailInfo}>
                <Text style={styles.taskDetailTitle} numberOfLines={1}>
                  {selectedTask.title || 'Stop'}
                </Text>
                {formattedTime && (
                  <Text style={styles.taskDetailTime}>
                    <Ionicons name="time-outline" size={12} color={BrandColors.loopBlue} /> {formattedTime}
                  </Text>
                )}
              </View>
            </View>

            {selectedTask.address && (
              <View style={styles.taskDetailAddress}>
                <Ionicons name="location-outline" size={14} color="#666" />
                <Text style={styles.taskDetailAddressText} numberOfLines={2}>
                  {selectedTask.address}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.taskDetailButton, { backgroundColor: BrandColors.loopBlue }]}
              onPress={() => {
                onTaskPress?.(selectedTaskId);
                setSelectedTaskId(null);
              }}
            >
              <Text style={styles.taskDetailButtonText}>View Details</Text>
              <Ionicons name="chevron-forward" size={16} color="white" />
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* Task Timeline hint at bottom - hide when task selected */}
      {mapReady && validTaskCoords.length > 0 && !selectedTaskId && (
        <View style={styles.timelineHint}>
          <Text style={styles.timelineText}>
            {hasRealHome ? '🏠 → ' : ''}
            {validTaskCoords.map((_, i) => `${i + 1}`).join(' → ')}
            {hasRealHome ? ' → 🏠' : ''}
          </Text>
        </View>
      )}

      {/* Warning if home not set - hide when task selected */}
      {mapReady && !hasRealHome && !selectedTaskId && (
        <View style={styles.homeWarning}>
          <Ionicons name="warning-outline" size={14} color="#f59e0b" />
          <Text style={styles.homeWarningText}>
            Set your home address in settings to see the full loop
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
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
  homeMarkerSelected: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 4,
    shadowColor: BrandColors.loopGreen,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
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
  taskMarkerSelected: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 4,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  // Next task marker styling
  nextTaskMarker: {
    borderWidth: 4,
    borderColor: 'white',
  },
  nextTaskGlow: {
    shadowColor: BrandColors.loopBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 12,
  },
  nextTaskNumber: {
    fontWeight: '900',
  },
  // Current location marker (blue pulsing dot)
  currentLocationMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BrandColors.blueOverlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BrandColors.loopBlue,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: BrandColors.loopBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  taskNumber: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  taskNumberSelected: {
    fontSize: 18,
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
  homeWarning: {
    position: 'absolute',
    bottom: Spacing.md + 40,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'rgba(254, 243, 199, 0.95)',
    borderRadius: 8,
    padding: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  homeWarningText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
  },
  // Next Task Indicator
  nextTaskIndicator: {
    position: 'absolute',
    top: Spacing.md + 60,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: BrandColors.loopBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderLeftWidth: 3,
    borderLeftColor: BrandColors.loopBlue,
  },
  nextTaskIndicatorBadge: {
    backgroundColor: BrandColors.loopBlue,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: Spacing.sm,
  },
  nextTaskIndicatorBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  nextTaskIndicatorTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  nextTaskIndicatorTime: {
    fontSize: 13,
    fontWeight: '600',
    color: BrandColors.loopBlue,
    marginLeft: Spacing.sm,
  },
  // Task Detail Panel Styles
  taskDetailPanel: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'white',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  taskDetailClose: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  taskDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  taskDetailBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  taskDetailBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  taskDetailInfo: {
    flex: 1,
    marginRight: 30, // Leave room for close button
  },
  taskDetailTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  taskDetailTime: {
    fontSize: 13,
    color: BrandColors.loopBlue,
    marginTop: 2,
  },
  taskDetailAddress: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    paddingLeft: 40, // Align with title
    gap: 6,
  },
  taskDetailAddressText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  taskDetailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  taskDetailButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // Home Detail Panel Styles
  homeDetailPanel: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'white',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  homeDetailSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  // Loop Summary Styles (temporary replacement for map)
  loopSummaryContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: Spacing.lg,
  },
  loopSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  loopSummaryTitle: {
    color: '#1a1a1a',
  },
  loopStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loopStatItem: {
    alignItems: 'center',
    gap: 4,
  },
  loopStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  loopStatLabel: {
    fontSize: 12,
    color: '#666',
  },
  loopTimeline: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loopTimelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: Spacing.md,
  },
  loopTimelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    paddingLeft: 4,
  },
  loopTimelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  loopTimelineNumber: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  loopTimelineContent: {
    flex: 1,
    paddingTop: 4,
  },
  loopTimelineLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  loopTimelineAddress: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});
