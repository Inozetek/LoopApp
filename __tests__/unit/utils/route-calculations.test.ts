/**
 * Tests for route calculation utilities
 */

import {
  calculateDistance,
  calculateRouteDistance,
  estimateTravelTime,
  formatDistance,
  formatDuration,
  calculateRouteStats,
  calculateTravelTimeWithBuffer,
  suggestStartTimeFromPreviousTask,
  isReasonableTravelTime,
  shouldChainEvents,
  calculateDepartureTime,
  calculateMidpoint,
  formatDepartureTime,
  calculateChainedRouteStats,
  Coordinate,
} from '@/utils/route-calculations';

// Test locations
const DALLAS_DOWNTOWN: Coordinate = { latitude: 32.7767, longitude: -96.7970 };
const DALLAS_UPTOWN: Coordinate = { latitude: 32.8028, longitude: -96.8004 };
const PLANO: Coordinate = { latitude: 33.0198, longitude: -96.6989 };
const FORT_WORTH: Coordinate = { latitude: 32.7555, longitude: -97.3308 };
const NEW_YORK: Coordinate = { latitude: 40.7128, longitude: -74.0060 };
const LOS_ANGELES: Coordinate = { latitude: 34.0522, longitude: -118.2437 };

describe('route-calculations', () => {
  describe('calculateDistance', () => {
    it('should return 0 for same point', () => {
      const distance = calculateDistance(DALLAS_DOWNTOWN, DALLAS_DOWNTOWN);
      expect(distance).toBe(0);
    });

    it('should calculate short distance (Dallas Downtown to Uptown ~1.8 miles)', () => {
      const distance = calculateDistance(DALLAS_DOWNTOWN, DALLAS_UPTOWN);
      // Uptown is about 1.8 miles from Downtown Dallas
      expect(distance).toBeGreaterThan(1.5);
      expect(distance).toBeLessThan(2.5);
    });

    it('should calculate medium distance (Dallas to Plano ~18 miles)', () => {
      const distance = calculateDistance(DALLAS_DOWNTOWN, PLANO);
      // Plano is about 18 miles from Downtown Dallas
      expect(distance).toBeGreaterThan(15);
      expect(distance).toBeLessThan(22);
    });

    it('should calculate longer distance (Dallas to Fort Worth ~30 miles)', () => {
      const distance = calculateDistance(DALLAS_DOWNTOWN, FORT_WORTH);
      // Fort Worth is about 30 miles from Downtown Dallas
      expect(distance).toBeGreaterThan(28);
      expect(distance).toBeLessThan(35);
    });

    it('should calculate cross-country distance (NY to LA ~2450 miles)', () => {
      const distance = calculateDistance(NEW_YORK, LOS_ANGELES);
      // NY to LA is about 2450 miles as the crow flies
      expect(distance).toBeGreaterThan(2400);
      expect(distance).toBeLessThan(2500);
    });

    it('should be commutative (A to B equals B to A)', () => {
      const distanceAB = calculateDistance(DALLAS_DOWNTOWN, PLANO);
      const distanceBA = calculateDistance(PLANO, DALLAS_DOWNTOWN);
      expect(distanceAB).toBeCloseTo(distanceBA, 10);
    });
  });

  describe('calculateRouteDistance', () => {
    it('should return 0 for empty array', () => {
      expect(calculateRouteDistance([])).toBe(0);
    });

    it('should return 0 for single point', () => {
      expect(calculateRouteDistance([DALLAS_DOWNTOWN])).toBe(0);
    });

    it('should calculate distance for two points', () => {
      const distance = calculateRouteDistance([DALLAS_DOWNTOWN, PLANO]);
      const directDistance = calculateDistance(DALLAS_DOWNTOWN, PLANO);
      expect(distance).toBeCloseTo(directDistance, 10);
    });

    it('should sum distances for multiple waypoints', () => {
      // Downtown -> Uptown -> Plano
      const routeDistance = calculateRouteDistance([DALLAS_DOWNTOWN, DALLAS_UPTOWN, PLANO]);
      const leg1 = calculateDistance(DALLAS_DOWNTOWN, DALLAS_UPTOWN);
      const leg2 = calculateDistance(DALLAS_UPTOWN, PLANO);
      expect(routeDistance).toBeCloseTo(leg1 + leg2, 10);
    });

    it('should calculate round trip distance', () => {
      // Downtown -> Plano -> Downtown
      const routeDistance = calculateRouteDistance([DALLAS_DOWNTOWN, PLANO, DALLAS_DOWNTOWN]);
      const oneWay = calculateDistance(DALLAS_DOWNTOWN, PLANO);
      expect(routeDistance).toBeCloseTo(oneWay * 2, 10);
    });
  });

  describe('estimateTravelTime', () => {
    it('should return at least 1 minute for very short distance', () => {
      const time = estimateTravelTime(0.1); // 0.1 miles
      expect(time).toBeGreaterThanOrEqual(1);
    });

    it('should use 15mph for distances under 1 mile', () => {
      // 0.5 miles at 15 mph = 2 minutes
      const time = estimateTravelTime(0.5);
      expect(time).toBe(2); // ceil(0.5 / 15 * 60) = ceil(2) = 2
    });

    it('should use 25mph for distances 1-5 miles', () => {
      // 2.5 miles at 25 mph = 6 minutes
      const time = estimateTravelTime(2.5);
      expect(time).toBe(6); // ceil(2.5 / 25 * 60) = ceil(6) = 6
    });

    it('should use 35mph for distances over 5 miles', () => {
      // 17.5 miles at 35 mph = 30 minutes
      const time = estimateTravelTime(17.5);
      expect(time).toBe(30); // ceil(17.5 / 35 * 60) = ceil(30) = 30
    });

    it('should round up to whole minutes', () => {
      // 3 miles at 25 mph = 7.2 minutes -> 8 minutes
      const time = estimateTravelTime(3);
      expect(time).toBe(8); // ceil(3 / 25 * 60) = ceil(7.2) = 8
    });
  });

  describe('formatDistance', () => {
    it('should show "< 0.1 mi" for very short distances', () => {
      expect(formatDistance(0.05)).toBe('< 0.1 mi');
      expect(formatDistance(0.09)).toBe('< 0.1 mi');
    });

    it('should show one decimal place', () => {
      expect(formatDistance(2.34)).toBe('2.3 mi');
      expect(formatDistance(5.0)).toBe('5.0 mi');
      expect(formatDistance(10.567)).toBe('10.6 mi');
    });
  });

  describe('formatDuration', () => {
    it('should show minutes for < 60 min', () => {
      expect(formatDuration(5)).toBe('5 min');
      expect(formatDuration(45)).toBe('45 min');
      expect(formatDuration(59)).toBe('59 min');
    });

    it('should show hours only when no remaining minutes', () => {
      expect(formatDuration(60)).toBe('1h');
      expect(formatDuration(120)).toBe('2h');
    });

    it('should show hours and minutes', () => {
      expect(formatDuration(75)).toBe('1h 15m');
      expect(formatDuration(150)).toBe('2h 30m');
    });

    it('should round minutes', () => {
      expect(formatDuration(63.7)).toBe('1h 4m');
    });
  });

  describe('calculateRouteStats', () => {
    it('should return complete stats object', () => {
      const stats = calculateRouteStats([DALLAS_DOWNTOWN, PLANO, DALLAS_DOWNTOWN]);

      expect(stats).toHaveProperty('distanceMiles');
      expect(stats).toHaveProperty('estimatedMinutes');
      expect(stats).toHaveProperty('distanceFormatted');
      expect(stats).toHaveProperty('timeFormatted');

      expect(stats.distanceMiles).toBeGreaterThan(30); // Round trip ~36 miles
      expect(stats.estimatedMinutes).toBeGreaterThan(0);
      expect(stats.distanceFormatted).toMatch(/\d+\.\d+ mi/);
    });
  });

  describe('calculateTravelTimeWithBuffer', () => {
    it('should add 5 minute buffer to travel time', () => {
      // 2.5 miles = 6 min + 5 buffer = 11 min
      const time = calculateTravelTimeWithBuffer(DALLAS_DOWNTOWN, DALLAS_UPTOWN);
      const baseTime = estimateTravelTime(calculateDistance(DALLAS_DOWNTOWN, DALLAS_UPTOWN));
      expect(time).toBe(baseTime + 5);
    });

    it('should have minimum 5 minutes', () => {
      // Same location = 0 miles, but minimum 5 min
      const time = calculateTravelTimeWithBuffer(DALLAS_DOWNTOWN, DALLAS_DOWNTOWN);
      expect(time).toBe(5);
    });
  });

  describe('suggestStartTimeFromPreviousTask', () => {
    it('should add travel time to previous task end time', () => {
      const previousEnd = new Date('2026-01-19T14:00:00');
      const suggested = suggestStartTimeFromPreviousTask(
        previousEnd,
        DALLAS_DOWNTOWN,
        DALLAS_UPTOWN
      );

      // Should be after previous end time
      expect(suggested.getTime()).toBeGreaterThan(previousEnd.getTime());

      // Travel time is ~5-10 min + 5 buffer
      const diffMinutes = (suggested.getTime() - previousEnd.getTime()) / (1000 * 60);
      expect(diffMinutes).toBeGreaterThanOrEqual(5);
      expect(diffMinutes).toBeLessThan(20);
    });
  });

  describe('isReasonableTravelTime', () => {
    it('should return true for <= 30 minutes', () => {
      expect(isReasonableTravelTime(10)).toBe(true);
      expect(isReasonableTravelTime(30)).toBe(true);
    });

    it('should return false for > 30 minutes', () => {
      expect(isReasonableTravelTime(31)).toBe(false);
      expect(isReasonableTravelTime(60)).toBe(false);
    });
  });

  describe('shouldChainEvents', () => {
    const home = DALLAS_DOWNTOWN;

    it('should chain events when round trip home takes too long', () => {
      // Event A ends at Plano, Event B starts at Uptown 30 min later
      // Round trip: Plano -> Dallas -> Uptown = ~36 miles = ~62 min
      // Gap: 30 min
      // Should chain (62 > 30)
      const eventA = {
        end_time: '2026-01-19T14:00:00',
        location: PLANO,
      };
      const eventB = {
        start_time: '2026-01-19T14:30:00',
        location: DALLAS_UPTOWN,
      };

      expect(shouldChainEvents(eventA, eventB, home)).toBe(true);
    });

    it('should not chain events when there is plenty of time', () => {
      // Event A ends at Uptown, Event B starts at Downtown 3 hours later
      // Round trip: Uptown -> Dallas -> Downtown = ~4 miles = ~10 min
      // Gap: 180 min
      // Should NOT chain (10 < 180)
      const eventA = {
        end_time: '2026-01-19T12:00:00',
        location: DALLAS_UPTOWN,
      };
      const eventB = {
        start_time: '2026-01-19T15:00:00',
        location: DALLAS_DOWNTOWN,
      };

      expect(shouldChainEvents(eventA, eventB, home)).toBe(false);
    });
  });

  describe('calculateDepartureTime', () => {
    it('should subtract travel time and buffer from event start', () => {
      const eventStart = new Date('2026-01-19T18:00:00');
      const travelTime = 30; // 30 minutes
      const buffer = 10; // 10 minutes

      const departure = calculateDepartureTime(eventStart, travelTime, buffer);

      // Should be 40 minutes before event
      const diffMinutes = (eventStart.getTime() - departure.getTime()) / (1000 * 60);
      expect(diffMinutes).toBe(40);
    });

    it('should use default 10 min buffer', () => {
      const eventStart = new Date('2026-01-19T18:00:00');
      const departure = calculateDepartureTime(eventStart, 20);

      // 20 + 10 = 30 minutes before
      const diffMinutes = (eventStart.getTime() - departure.getTime()) / (1000 * 60);
      expect(diffMinutes).toBe(30);
    });

    it('should add extra 5 min for chained events', () => {
      const eventStart = new Date('2026-01-19T18:00:00');
      const departure = calculateDepartureTime(eventStart, 20, 10, true);

      // 20 + 10 + 5 = 35 minutes before
      const diffMinutes = (eventStart.getTime() - departure.getTime()) / (1000 * 60);
      expect(diffMinutes).toBe(35);
    });

    it('should accept ISO string for event start', () => {
      const departure = calculateDepartureTime('2026-01-19T18:00:00', 30, 10);
      expect(departure).toBeInstanceOf(Date);
      expect(departure.getHours()).toBe(17); // 6pm - 40min = 5:20pm
      expect(departure.getMinutes()).toBe(20);
    });
  });

  describe('calculateMidpoint', () => {
    it('should throw error for empty array', () => {
      expect(() => calculateMidpoint([])).toThrow('Need at least one location');
    });

    it('should return same point for single location', () => {
      const result = calculateMidpoint([DALLAS_DOWNTOWN]);
      expect(result.latitude).toBe(DALLAS_DOWNTOWN.latitude);
      expect(result.longitude).toBe(DALLAS_DOWNTOWN.longitude);
    });

    it('should calculate midpoint between two points', () => {
      const midpoint = calculateMidpoint([DALLAS_DOWNTOWN, PLANO]);

      // Midpoint should be between the two latitudes
      expect(midpoint.latitude).toBeGreaterThan(DALLAS_DOWNTOWN.latitude);
      expect(midpoint.latitude).toBeLessThan(PLANO.latitude);

      // Midpoint should be roughly equidistant from both
      const distToDowntown = calculateDistance(midpoint, DALLAS_DOWNTOWN);
      const distToPlano = calculateDistance(midpoint, PLANO);
      expect(distToDowntown).toBeCloseTo(distToPlano, 0);
    });

    it('should calculate centroid for multiple points', () => {
      const midpoint = calculateMidpoint([DALLAS_DOWNTOWN, DALLAS_UPTOWN, PLANO]);

      // Midpoint should be within the bounding box of all points
      const minLat = Math.min(DALLAS_DOWNTOWN.latitude, DALLAS_UPTOWN.latitude, PLANO.latitude);
      const maxLat = Math.max(DALLAS_DOWNTOWN.latitude, DALLAS_UPTOWN.latitude, PLANO.latitude);

      expect(midpoint.latitude).toBeGreaterThanOrEqual(minLat);
      expect(midpoint.latitude).toBeLessThanOrEqual(maxLat);
    });
  });

  describe('formatDepartureTime', () => {
    it('should format morning time with AM', () => {
      const morning = new Date('2026-01-19T09:30:00');
      expect(formatDepartureTime(morning)).toMatch(/9:30\s*AM/i);
    });

    it('should format afternoon time with PM', () => {
      const afternoon = new Date('2026-01-19T14:45:00');
      expect(formatDepartureTime(afternoon)).toMatch(/2:45\s*PM/i);
    });

    it('should handle midnight', () => {
      const midnight = new Date('2026-01-19T00:00:00');
      expect(formatDepartureTime(midnight)).toMatch(/12:00\s*AM/i);
    });

    it('should handle noon', () => {
      const noon = new Date('2026-01-19T12:00:00');
      expect(formatDepartureTime(noon)).toMatch(/12:00\s*PM/i);
    });
  });

  describe('calculateChainedRouteStats', () => {
    it('should calculate stats with stop buffers', () => {
      // Home -> Stop1 -> Stop2 -> Home
      const waypoints = [DALLAS_DOWNTOWN, DALLAS_UPTOWN, PLANO, DALLAS_DOWNTOWN];
      const stats = calculateChainedRouteStats(waypoints);

      expect(stats).toHaveProperty('distanceMiles');
      expect(stats).toHaveProperty('estimatedMinutes');
      expect(stats).toHaveProperty('distanceFormatted');
      expect(stats).toHaveProperty('timeFormatted');
      expect(stats).toHaveProperty('numStops');

      // Should have 2 stops (excluding home at start/end)
      expect(stats.numStops).toBe(2);

      // Time should include 20 min buffer (10 min per stop)
      const baseTime = estimateTravelTime(calculateRouteDistance(waypoints));
      expect(stats.estimatedMinutes).toBe(baseTime + 20);
    });

    it('should handle route with single stop', () => {
      const waypoints = [DALLAS_DOWNTOWN, PLANO, DALLAS_DOWNTOWN];
      const stats = calculateChainedRouteStats(waypoints);

      expect(stats.numStops).toBe(1);
    });
  });
});
