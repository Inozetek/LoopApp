/**
 * Route Calculations Utility
 * Calculate distance and estimated travel time for routes
 */

export interface Coordinate {
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

// ===================================
// Loop Routing & Chaining (Day 1 Sprint)
// ===================================

/**
 * Determine if two events should be chained
 * Logic: Chain if round-trip home time > time gap between events
 *
 * @param eventA - First event (must have end_time and location)
 * @param eventB - Second event (must have start_time and location)
 * @param homeLocation - User's home location
 * @returns Whether events should be chained
 */
export function shouldChainEvents(
  eventA: { end_time: string; location: Coordinate },
  eventB: { start_time: string; location: Coordinate },
  homeLocation: Coordinate
): boolean {
  // Calculate travel times
  const travelAToHome = estimateTravelTime(calculateDistance(eventA.location, homeLocation));
  const travelHomeToB = estimateTravelTime(calculateDistance(homeLocation, eventB.location));
  const roundTripTime = travelAToHome + travelHomeToB;

  // Calculate time gap between events (in minutes)
  const endA = new Date(eventA.end_time);
  const startB = new Date(eventB.start_time);
  const timeGapMinutes = (startB.getTime() - endA.getTime()) / (1000 * 60);

  // Chain if not enough time to go home
  return roundTripTime > timeGapMinutes;
}

/**
 * Calculate recommended departure time for an event
 *
 * @param eventStartTime - Event start time (ISO string or Date)
 * @param travelTimeMinutes - Estimated travel time
 * @param parkingBuffer - Additional time for parking/walking (default: 10 min)
 * @param isChained - Whether this is a chained event (adds 5 min buffer)
 * @returns Recommended departure time (Date object)
 */
export function calculateDepartureTime(
  eventStartTime: string | Date,
  travelTimeMinutes: number,
  parkingBuffer: number = 10,
  isChained: boolean = false
): Date {
  const startTime = typeof eventStartTime === 'string' ? new Date(eventStartTime) : eventStartTime;
  let bufferMinutes = parkingBuffer;

  // Add extra buffer for chained events
  if (isChained) {
    bufferMinutes += 5;
  }

  const totalMinutes = travelTimeMinutes + bufferMinutes;
  const departureTime = new Date(startTime.getTime() - totalMinutes * 60 * 1000);

  return departureTime;
}

/**
 * Calculate midpoint between multiple locations (for group planning)
 * Uses Cartesian coordinate averaging for accurate results
 *
 * @param locations - Array of user locations
 * @returns Midpoint location
 */
export function calculateMidpoint(locations: Coordinate[]): Coordinate {
  if (locations.length === 0) {
    throw new Error('Need at least one location to calculate midpoint');
  }

  if (locations.length === 1) {
    return locations[0];
  }

  // Convert to Cartesian coordinates
  let x = 0;
  let y = 0;
  let z = 0;

  for (const loc of locations) {
    const lat = (loc.latitude * Math.PI) / 180;
    const lon = (loc.longitude * Math.PI) / 180;

    x += Math.cos(lat) * Math.cos(lon);
    y += Math.cos(lat) * Math.sin(lon);
    z += Math.sin(lat);
  }

  const total = locations.length;
  x = x / total;
  y = y / total;
  z = z / total;

  // Convert back to latitude/longitude
  const centralLon = Math.atan2(y, x);
  const centralSquareRoot = Math.sqrt(x * x + y * y);
  const centralLat = Math.atan2(z, centralSquareRoot);

  return {
    latitude: (centralLat * 180) / Math.PI,
    longitude: (centralLon * 180) / Math.PI,
  };
}

/**
 * Format time for departure notifications
 * @param date - Date object to format
 * @returns Formatted string (e.g., "3:45 PM")
 */
export function formatDepartureTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Calculate total distance and time for a chained route
 * @param waypoints - Array of locations in route order (includes home at start/end)
 * @returns Object with total distance and time
 */
export function calculateChainedRouteStats(waypoints: Coordinate[]) {
  const distance = calculateRouteDistance(waypoints);
  const time = estimateTravelTime(distance);

  // Add buffers for multiple stops
  const numStops = waypoints.length - 2; // Exclude home (start/end)
  const bufferPerStop = 10; // 10 min parking/walking per stop
  const totalBuffer = numStops * bufferPerStop;

  return {
    distanceMiles: distance,
    estimatedMinutes: time + totalBuffer,
    distanceFormatted: formatDistance(distance),
    timeFormatted: formatDuration(time + totalBuffer),
    numStops,
  };
}
