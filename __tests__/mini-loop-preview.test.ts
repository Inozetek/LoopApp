/**
 * Tests for MiniLoopPreview pure helper functions.
 *
 * These functions handle bounding-box computation, geo-to-SVG projection,
 * category color lookup, and chronological task sorting.
 */

// Mock react-native (needed when component file imports RN primitives)
jest.mock('react-native', () => ({
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
  StyleSheet: { create: (s: any) => s },
}));

// Mock react-native-svg (needed when component file imports SVG elements)
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Polyline: 'Polyline',
  Circle: 'Circle',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  Stop: 'Stop',
}));

import {
  computeBoundingBox,
  projectPoint,
  getCategoryColor,
  sortTasksByTime,
  MiniLoopTask,
  BoundingBox,
} from '@/components/mini-loop-preview';
import { BrandColors, CategoryColors } from '@/constants/brand';

// Pin clock to noon Feb 25 2026 for deterministic date comparisons
jest.useFakeTimers({ now: new Date('2026-02-25T12:00:00Z') });

// ─── computeBoundingBox ──────────────────────────────────────────────

describe('computeBoundingBox', () => {
  it('returns default 0-1 box for empty points array', () => {
    const bbox = computeBoundingBox([]);
    expect(bbox).toEqual({ minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 });
  });

  it('returns a small box (±0.002) around a single point', () => {
    const point = { latitude: 32.78, longitude: -96.8 };
    const bbox = computeBoundingBox([point]);
    expect(bbox.minLat).toBeCloseTo(32.78 - 0.002, 6);
    expect(bbox.maxLat).toBeCloseTo(32.78 + 0.002, 6);
    expect(bbox.minLng).toBeCloseTo(-96.8 - 0.002, 6);
    expect(bbox.maxLng).toBeCloseTo(-96.8 + 0.002, 6);
  });

  it('computes correct min/max with default 15% padding for two points', () => {
    const points = [
      { latitude: 30, longitude: -100 },
      { latitude: 40, longitude: -90 },
    ];
    const bbox = computeBoundingBox(points);

    const latRange = 10;
    const lngRange = 10;
    const padLat = latRange * 0.15;
    const padLng = lngRange * 0.15;

    expect(bbox.minLat).toBeCloseTo(30 - padLat, 6);
    expect(bbox.maxLat).toBeCloseTo(40 + padLat, 6);
    expect(bbox.minLng).toBeCloseTo(-100 - padLng, 6);
    expect(bbox.maxLng).toBeCloseTo(-90 + padLng, 6);
  });

  it('computes correct bounds for multiple points', () => {
    const points = [
      { latitude: 10, longitude: 20 },
      { latitude: 15, longitude: 25 },
      { latitude: 12, longitude: 30 },
      { latitude: 8, longitude: 22 },
    ];
    const bbox = computeBoundingBox(points);

    // raw min/max: lat 8..15, lng 20..30
    const latRange = 7;
    const lngRange = 10;
    const padLat = latRange * 0.15;
    const padLng = lngRange * 0.15;

    expect(bbox.minLat).toBeCloseTo(8 - padLat, 6);
    expect(bbox.maxLat).toBeCloseTo(15 + padLat, 6);
    expect(bbox.minLng).toBeCloseTo(20 - padLng, 6);
    expect(bbox.maxLng).toBeCloseTo(30 + padLng, 6);
  });

  it('applies a custom padding factor', () => {
    const points = [
      { latitude: 0, longitude: 0 },
      { latitude: 10, longitude: 10 },
    ];
    const bbox = computeBoundingBox(points, 0.5);

    const padLat = 10 * 0.5;
    const padLng = 10 * 0.5;

    expect(bbox.minLat).toBeCloseTo(0 - padLat, 6);
    expect(bbox.maxLat).toBeCloseTo(10 + padLat, 6);
    expect(bbox.minLng).toBeCloseTo(0 - padLng, 6);
    expect(bbox.maxLng).toBeCloseTo(10 + padLng, 6);
  });

  it('handles degenerate case: points along same latitude', () => {
    const points = [
      { latitude: 32.78, longitude: -97 },
      { latitude: 32.78, longitude: -96 },
    ];
    const bbox = computeBoundingBox(points);

    // latRange is 0, fallback to 0.001
    const latRange = 0.001;
    const lngRange = 1;
    const padLat = latRange * 0.15;
    const padLng = lngRange * 0.15;

    expect(bbox.minLat).toBeCloseTo(32.78 - padLat, 6);
    expect(bbox.maxLat).toBeCloseTo(32.78 + padLat, 6);
    expect(bbox.minLng).toBeCloseTo(-97 - padLng, 6);
    expect(bbox.maxLng).toBeCloseTo(-96 + padLng, 6);
  });

  it('handles degenerate case: points along same longitude', () => {
    const points = [
      { latitude: 30, longitude: -96.8 },
      { latitude: 35, longitude: -96.8 },
    ];
    const bbox = computeBoundingBox(points);

    const latRange = 5;
    const lngRange = 0.001; // fallback
    const padLat = latRange * 0.15;
    const padLng = lngRange * 0.15;

    expect(bbox.minLat).toBeCloseTo(30 - padLat, 6);
    expect(bbox.maxLat).toBeCloseTo(35 + padLat, 6);
    expect(bbox.minLng).toBeCloseTo(-96.8 - padLng, 6);
    expect(bbox.maxLng).toBeCloseTo(-96.8 + padLng, 6);
  });

  it('applies zero padding when paddingFactor is 0', () => {
    const points = [
      { latitude: 10, longitude: 20 },
      { latitude: 20, longitude: 30 },
    ];
    const bbox = computeBoundingBox(points, 0);

    expect(bbox.minLat).toBeCloseTo(10, 6);
    expect(bbox.maxLat).toBeCloseTo(20, 6);
    expect(bbox.minLng).toBeCloseTo(20, 6);
    expect(bbox.maxLng).toBeCloseTo(30, 6);
  });
});

// ─── projectPoint ────────────────────────────────────────────────────

describe('projectPoint', () => {
  const standardBbox: BoundingBox = {
    minLat: 0,
    maxLat: 10,
    minLng: 0,
    maxLng: 10,
  };
  const viewportSize = 100;
  const inset = 10;

  it('projects min-corner point (minLng, minLat) to bottom-left (inset, viewport-inset)', () => {
    // minLat -> maxLat - minLat = 10 in numerator -> y = inset + (10/10)*80 = 90
    // minLng -> 0 in numerator -> x = inset + (0/10)*80 = 10
    const result = projectPoint(0, 0, standardBbox, viewportSize, inset);
    expect(result.x).toBeCloseTo(10, 4);
    expect(result.y).toBeCloseTo(90, 4);
  });

  it('projects max-corner point (maxLng, maxLat) to top-right (viewport-inset, inset)', () => {
    // maxLat -> numerator = 0 -> y = inset = 10
    // maxLng -> numerator = 10 -> x = inset + (10/10)*80 = 90
    const result = projectPoint(10, 10, standardBbox, viewportSize, inset);
    expect(result.x).toBeCloseTo(90, 4);
    expect(result.y).toBeCloseTo(10, 4);
  });

  it('projects center point to viewport center', () => {
    const result = projectPoint(5, 5, standardBbox, viewportSize, inset);
    expect(result.x).toBeCloseTo(50, 4);
    expect(result.y).toBeCloseTo(50, 4);
  });

  it('works with different viewport sizes', () => {
    const smallViewport = 52;
    const smallInset = 6;
    // usable = 52 - 12 = 40
    const result = projectPoint(5, 5, standardBbox, smallViewport, smallInset);
    // x = 6 + (5/10)*40 = 6 + 20 = 26
    // y = 6 + (5/10)*40 = 6 + 20 = 26
    expect(result.x).toBeCloseTo(26, 4);
    expect(result.y).toBeCloseTo(26, 4);
  });

  it('inverts Y axis: higher latitude produces lower y value', () => {
    const highLat = projectPoint(9, 5, standardBbox, viewportSize, inset);
    const lowLat = projectPoint(1, 5, standardBbox, viewportSize, inset);
    expect(highLat.y).toBeLessThan(lowLat.y);
  });

  it('handles degenerate bbox with zero lat range (uses fallback divisor 1)', () => {
    const degenerateBbox: BoundingBox = {
      minLat: 5,
      maxLat: 5, // zero range
      minLng: 0,
      maxLng: 10,
    };
    // latRange fallback = 1
    // y = inset + ((5 - 5) / 1) * 80 = 10
    const result = projectPoint(5, 5, degenerateBbox, viewportSize, inset);
    expect(result.y).toBeCloseTo(10, 4);
    expect(result.x).toBeCloseTo(50, 4);
  });

  it('handles degenerate bbox with zero lng range (uses fallback divisor 1)', () => {
    const degenerateBbox: BoundingBox = {
      minLat: 0,
      maxLat: 10,
      minLng: 5,
      maxLng: 5, // zero range
    };
    // lngRange fallback = 1
    // x = inset + ((5 - 5) / 1) * 80 = 10
    const result = projectPoint(5, 5, degenerateBbox, viewportSize, inset);
    expect(result.x).toBeCloseTo(10, 4);
    expect(result.y).toBeCloseTo(50, 4);
  });

  it('maps quarter points correctly', () => {
    // lat=2.5, lng=7.5 -> x = 10 + (7.5/10)*80 = 70, y = 10 + (7.5/10)*80 = 70
    const result = projectPoint(2.5, 7.5, standardBbox, viewportSize, inset);
    expect(result.x).toBeCloseTo(70, 4);
    expect(result.y).toBeCloseTo(70, 4);
  });
});

// ─── getCategoryColor ────────────────────────────────────────────────

describe('getCategoryColor', () => {
  it('returns the correct color for "dining"', () => {
    expect(getCategoryColor('dining')).toBe(CategoryColors.dining);
    expect(getCategoryColor('dining')).toBe('#EF4444');
  });

  it('returns the correct color for "fitness"', () => {
    expect(getCategoryColor('fitness')).toBe(CategoryColors.fitness);
    expect(getCategoryColor('fitness')).toBe(BrandColors.loopGreen);
  });

  it('returns the correct color for "entertainment"', () => {
    expect(getCategoryColor('entertainment')).toBe(CategoryColors.entertainment);
    expect(getCategoryColor('entertainment')).toBe(BrandColors.loopBlue);
  });

  it('returns loopBlue fallback for an unknown category', () => {
    expect(getCategoryColor('nonexistent_category')).toBe(BrandColors.loopBlue);
  });

  it('returns loopBlue fallback for the "_home" category (not in CategoryColors)', () => {
    expect(getCategoryColor('_home')).toBe(BrandColors.loopBlue);
  });
});

// ─── sortTasksByTime ─────────────────────────────────────────────────

describe('sortTasksByTime', () => {
  const makeMockTask = (id: string, startTime: string): MiniLoopTask => ({
    id,
    title: `Task ${id}`,
    latitude: 32.78,
    longitude: -96.8,
    category: 'dining',
    start_time: startTime,
  });

  it('returns an empty array when given an empty array', () => {
    expect(sortTasksByTime([])).toEqual([]);
  });

  it('returns the same single task when given one task', () => {
    const task = makeMockTask('1', '2026-02-25T09:00:00Z');
    const result = sortTasksByTime([task]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('sorts unsorted tasks in chronological order', () => {
    const tasks = [
      makeMockTask('c', '2026-02-25T18:00:00Z'),
      makeMockTask('a', '2026-02-25T08:00:00Z'),
      makeMockTask('b', '2026-02-25T12:00:00Z'),
    ];
    const result = sortTasksByTime(tasks);
    expect(result.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('preserves already-sorted order', () => {
    const tasks = [
      makeMockTask('1', '2026-02-25T06:00:00Z'),
      makeMockTask('2', '2026-02-25T10:00:00Z'),
      makeMockTask('3', '2026-02-25T14:00:00Z'),
      makeMockTask('4', '2026-02-25T20:00:00Z'),
    ];
    const result = sortTasksByTime(tasks);
    expect(result.map((t) => t.id)).toEqual(['1', '2', '3', '4']);
  });

  it('does not mutate the original array', () => {
    const tasks = [
      makeMockTask('b', '2026-02-25T14:00:00Z'),
      makeMockTask('a', '2026-02-25T08:00:00Z'),
    ];
    const originalOrder = tasks.map((t) => t.id);
    sortTasksByTime(tasks);
    expect(tasks.map((t) => t.id)).toEqual(originalOrder);
  });

  it('handles tasks with identical start times (stable-ish sort)', () => {
    const tasks = [
      makeMockTask('first', '2026-02-25T12:00:00Z'),
      makeMockTask('second', '2026-02-25T12:00:00Z'),
    ];
    const result = sortTasksByTime(tasks);
    expect(result).toHaveLength(2);
    // Both should still be present
    const ids = result.map((t) => t.id);
    expect(ids).toContain('first');
    expect(ids).toContain('second');
  });
});
