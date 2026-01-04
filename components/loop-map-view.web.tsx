/**
 * Loop Map View Component (Web Version)
 *
 * Web-compatible placeholder for the map view.
 * On web, we show a simple message since react-native-maps only works on mobile.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors, Typography, Spacing } from '@/constants/brand';

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
  return (
    <View style={styles.container}>
      <Ionicons name="map" size={48} color={BrandColors.loopBlue} />
      <Text style={styles.title}>Map View</Text>
      <Text style={styles.description}>
        Interactive map with your daily loop is available on mobile
      </Text>
      {tasks.length > 0 && (
        <Text style={styles.taskCount}>
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} scheduled
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: '#f5f5f5',
  },
  title: {
    ...Typography.titleLarge,
    color: BrandColors.almostBlack,
    marginTop: Spacing.md,
  },
  description: {
    ...Typography.bodyMedium,
    color: BrandColors.veryLightGray,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  taskCount: {
    ...Typography.bodySmall,
    color: BrandColors.loopBlue,
    marginTop: Spacing.lg,
    fontWeight: '600',
  },
});
