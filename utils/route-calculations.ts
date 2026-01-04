/**
 * Route Calculations Utility
 * Calculate distance and estimated travel time for routes
 */

interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Calculate distance between two points using Haversine formula
 * @returns distance in miles
 */
export function calculateDistance(point1: Coordinate, point2: Coordinate): number {
  const R = 3958.8; // Earth's radius in miles
  const lat1 = point1.latitude * Math.PI / 180;
  const lat2 = point2.latitude * Math.PI / 180;
  const deltaLat = (point2.latitude - point1.latitude) * Math.PI / 180;
  const deltaLon = (point2.longitude - point1.longitude) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Calculate total distance for a route (sequence of coordinates)
 * @returns distance in miles
 */
export function calculateRouteDistance(coordinates: Coordinate[]): number {
  if (coordinates.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    totalDistance += calculateDistance(coordinates[i], coordinates[i + 1]);
  }

  return totalDistance;
}

/**
 * Estimate travel time based on distance
 * Assumes average speeds: 25 mph for short distances, 35 mph for longer routes
 * @param distanceMiles - total distance in miles
 * @returns estimated time in minutes
 */
export function estimateTravelTime(distanceMiles: number): number {
  // For very short distances (< 1 mile), assume 15 mph (local streets, parking, etc.)
  if (distanceMiles < 1) {
    return Math.ceil((distanceMiles / 15) * 60);
  }

  // For short distances (1-5 miles), assume 25 mph (city driving)
  if (distanceMiles < 5) {
    return Math.ceil((distanceMiles / 25) * 60);
  }

  // For longer distances, assume 35 mph (mix of city and highway)
  return Math.ceil((distanceMiles / 35) * 60);
}

/**
 * Format distance for display
 * @param miles - distance in miles
 * @returns formatted string (e.g. "2.3 mi" or "0.5 mi")
 */
export function formatDistance(miles: number): string {
  if (miles < 0.1) return '< 0.1 mi';
  return `${miles.toFixed(1)} mi`;
}

/**
 * Format time duration for display
 * @param minutes - duration in minutes
 * @returns formatted string (e.g. "15 min" or "1h 30m")
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}

/**
 * Calculate route statistics for a Loop
 * @param coordinates - array of waypoints (home, tasks, home)
 * @returns object with total distance, estimated time, and formatted strings
 */
export function calculateRouteStats(coordinates: Coordinate[]) {
  const distance = calculateRouteDistance(coordinates);
  const time = estimateTravelTime(distance);

  return {
    distanceMiles: distance,
    estimatedMinutes: time,
    distanceFormatted: formatDistance(distance),
    timeFormatted: formatDuration(time),
  };
}

// ===================================
// Phase 1.6b: Travel Time Smart Defaults
// ===================================

/**
 * Calculate travel time between two locations (with buffer)
 * Returns travel time in minutes with parking/walking buffer
 */
export function calculateTravelTimeWithBuffer(
  from: Coordinate,
  to: Coordinate
): number {
  const distance = calculateDistance(from, to);
  const baseTime = estimateTravelTime(distance);

  // Add 5 min buffer for parking/walking (minimum 5 min)
  return Math.max(5, baseTime + 5);
}

/**
 * Suggest optimal start time for a new activity based on previous task
 * Returns suggested Date object
 *
 * Calculation:
 * - Previous task end time
 * + Travel time to new location
 * + 5 min buffer
 * = Suggested start time
 */
export function suggestStartTimeFromPreviousTask(
  previousTaskEndTime: Date,
  previousTaskLocation: Coordinate,
  newTaskLocation: Coordinate
): Date {
  const travelMinutes = calculateTravelTimeWithBuffer(
    previousTaskLocation,
    newTaskLocation
  );

  // Add travel time to previous task end time
  const suggestedStart = new Date(previousTaskEndTime);
  suggestedStart.setMinutes(suggestedStart.getMinutes() + travelMinutes);

  return suggestedStart;
}

/**
 * Check if travel time is reasonable (< 30 min)
 * Used to determine if we should suggest this time or fall back to defaults
 */
export function isReasonableTravelTime(minutes: number): boolean {
  return minutes <= 30;
}
