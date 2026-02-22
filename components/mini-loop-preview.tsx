/**
 * MiniLoopPreview - Tiny SVG thumbnail of the user's daily Loop path.
 *
 * Shows category-colored dots connected by a gradient polyline, rendered
 * inside a 52x52px viewport. Tapping opens the full Loop map.
 *
 * Algorithm:
 *   1. Collect lat/lng from tasks (and optionally home location).
 *   2. Compute bounding box + add 15% padding.
 *   3. Project each point into SVG viewport coordinates.
 *   4. Draw polyline connecting points (optionally closing the loop).
 *   5. Draw circles at each node with category colors.
 */

import React, { useMemo } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { BrandColors, CategoryColors } from '@/constants/brand';

/** Matches the task shape from LoopMapView */
export interface MiniLoopTask {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  category: string;
  start_time: string;
}

interface MiniLoopPreviewProps {
  tasks: MiniLoopTask[];
  homeLocation?: { latitude: number; longitude: number };
  /** SVG viewport size (default 52) */
  size?: number;
  /** Called when user taps the preview */
  onPress?: () => void;
}

// ─── Pure helpers (exported for testing) ────────────────────────────

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** Compute bounding box with padding factor. */
export function computeBoundingBox(
  points: { latitude: number; longitude: number }[],
  paddingFactor = 0.15,
): BoundingBox {
  if (points.length === 0) {
    return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
  }
  if (points.length === 1) {
    // Single point — create a small box around it
    const p = points[0];
    const offset = 0.002; // ~200m
    return {
      minLat: p.latitude - offset,
      maxLat: p.latitude + offset,
      minLng: p.longitude - offset,
      maxLng: p.longitude + offset,
    };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const p of points) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
  }

  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;
  const padLat = latRange * paddingFactor;
  const padLng = lngRange * paddingFactor;

  return {
    minLat: minLat - padLat,
    maxLat: maxLat + padLat,
    minLng: minLng - padLng,
    maxLng: maxLng + padLng,
  };
}

/** Project a geographic point to SVG coordinates. Y is inverted (higher lat = lower y). */
export function projectPoint(
  lat: number,
  lng: number,
  bbox: BoundingBox,
  viewportSize: number,
  inset: number,
): { x: number; y: number } {
  const usable = viewportSize - inset * 2;
  const latRange = bbox.maxLat - bbox.minLat || 1;
  const lngRange = bbox.maxLng - bbox.minLng || 1;

  const x = inset + ((lng - bbox.minLng) / lngRange) * usable;
  const y = inset + ((bbox.maxLat - lat) / latRange) * usable; // Invert Y

  return { x, y };
}

/** Get category color with fallback. */
export function getCategoryColor(category: string): string {
  return (CategoryColors as Record<string, string>)[category] || BrandColors.loopBlue;
}

/** Sort tasks chronologically by start_time. */
export function sortTasksByTime(tasks: MiniLoopTask[]): MiniLoopTask[] {
  return [...tasks].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );
}

// ─── Component ──────────────────────────────────────────────────────

export function MiniLoopPreview({
  tasks,
  homeLocation,
  size = 52,
  onPress,
}: MiniLoopPreviewProps) {
  const nodeRadius = size >= 48 ? 4 : 3;
  const strokeWidth = size >= 48 ? 2 : 1.5;
  const inset = nodeRadius + 2; // Keep circles from clipping edge

  const { sortedTasks, points, bbox } = useMemo(() => {
    const sorted = sortTasksByTime(tasks);
    const pts: { latitude: number; longitude: number; category: string }[] = [];

    // Include home as first node if available
    if (homeLocation) {
      pts.push({ ...homeLocation, category: '_home' });
    }

    for (const t of sorted) {
      pts.push({ latitude: t.latitude, longitude: t.longitude, category: t.category });
    }

    // Close the loop back to home if we started from home and have >=2 tasks
    if (homeLocation && sorted.length >= 1) {
      pts.push({ ...homeLocation, category: '_home' });
    }

    const box = computeBoundingBox(pts);
    return { sortedTasks: sorted, points: pts, bbox: box };
  }, [tasks, homeLocation]);

  // Nothing to render
  if (tasks.length === 0) {
    return null;
  }

  const projected = points.map((p) => projectPoint(p.latitude, p.longitude, bbox, size, inset));
  const polylinePoints = projected.map((p) => `${p.x},${p.y}`).join(' ');

  // Determine if we should render as tappable
  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress
    ? { onPress, activeOpacity: 0.7, accessibilityLabel: 'View Loop map', accessibilityRole: 'button' as const }
    : {};

  return (
    <Wrapper style={[styles.container, { width: size, height: size }]} {...wrapperProps}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <SvgLinearGradient id="pathGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={BrandColors.loopBlue} stopOpacity="0.6" />
            <Stop offset="100%" stopColor={BrandColors.loopGreen} stopOpacity="0.6" />
          </SvgLinearGradient>
        </Defs>

        {/* Path connecting all nodes */}
        {projected.length >= 2 && (
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke="url(#pathGrad)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Node circles */}
        {projected.map((p, i) => {
          const pt = points[i];
          const isHome = pt.category === '_home';
          // Skip duplicate home closing node
          if (isHome && i === projected.length - 1 && i > 0) return null;
          const color = isHome ? BrandColors.loopBlue : getCategoryColor(pt.category);
          return (
            <Circle
              key={`node-${i}`}
              cx={p.x}
              cy={p.y}
              r={isHome ? nodeRadius - 1 : nodeRadius}
              fill={color}
              stroke={isHome ? BrandColors.loopBlue : 'none'}
              strokeWidth={isHome ? 1 : 0}
              opacity={isHome ? 0.5 : 1}
            />
          );
        })}
      </Svg>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
