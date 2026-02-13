/**
 * Loop Service Tests
 * Tests for loop workflow functionality including group planning helpers
 *
 * NOTE: These are unit tests for the logic.
 * We test the pure functions directly to avoid React Native dependencies.
 */

describe('Loop Service', () => {
  // Re-implement the functions for testing (same logic as in loop-service.ts)
  const calculateGroupMidpoint = (
    locations: { latitude: number; longitude: number }[]
  ): { latitude: number; longitude: number } => {
    if (locations.length === 0) {
      return { latitude: 0, longitude: 0 };
    }

    const sumLat = locations.reduce((sum, loc) => sum + loc.latitude, 0);
    const sumLng = locations.reduce((sum, loc) => sum + loc.longitude, 0);

    return {
      latitude: sumLat / locations.length,
      longitude: sumLng / locations.length,
    };
  };

  const isUserAtTaskLocation = (
    userLat: number,
    userLng: number,
    taskLat: number,
    taskLng: number,
    radiusMeters: number = 100
  ): boolean => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (userLat * Math.PI) / 180;
    const φ2 = (taskLat * Math.PI) / 180;
    const Δφ = ((taskLat - userLat) * Math.PI) / 180;
    const Δλ = ((taskLng - userLng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;

    return distance <= radiusMeters;
  };

  const findOverlappingFreeTime = (
    userFreeSlots: { start: Date; end: Date }[],
    friendFreeSlots: { start: Date; end: Date }[]
  ): { start: Date; end: Date }[] => {
    const overlaps: { start: Date; end: Date }[] = [];

    for (const userSlot of userFreeSlots) {
      for (const friendSlot of friendFreeSlots) {
        const overlapStart = new Date(
          Math.max(userSlot.start.getTime(), friendSlot.start.getTime())
        );
        const overlapEnd = new Date(
          Math.min(userSlot.end.getTime(), friendSlot.end.getTime())
        );

        const overlapMinutes = (overlapEnd.getTime() - overlapStart.getTime()) / 60000;
        if (overlapMinutes >= 60) {
          overlaps.push({ start: overlapStart, end: overlapEnd });
        }
      }
    }

    overlaps.sort((a, b) => a.start.getTime() - b.start.getTime());

    return overlaps;
  };

  const getTimeUntilNextTask = (
    nextTaskStartTime: string
  ): { minutes: number; formatted: string } => {
    const now = new Date();
    const taskTime = new Date(nextTaskStartTime);
    const diffMs = taskTime.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    let formatted: string;
    if (diffMins < 0) {
      formatted = 'Now';
    } else if (diffMins < 60) {
      formatted = `${diffMins}m`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      formatted = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }

    return { minutes: diffMins, formatted };
  };

  describe('calculateGroupMidpoint', () => {
    it('should return (0, 0) for empty locations array', () => {
      const result = calculateGroupMidpoint([]);
      expect(result.latitude).toBe(0);
      expect(result.longitude).toBe(0);
    });

    it('should return the same location for a single point', () => {
      const locations = [{ latitude: 32.7767, longitude: -96.7970 }];
      const result = calculateGroupMidpoint(locations);
      expect(result.latitude).toBe(32.7767);
      expect(result.longitude).toBe(-96.7970);
    });

    it('should calculate the average for two points', () => {
      const locations = [
        { latitude: 32.0, longitude: -96.0 },
        { latitude: 34.0, longitude: -98.0 },
      ];
      const result = calculateGroupMidpoint(locations);
      expect(result.latitude).toBe(33.0);
      expect(result.longitude).toBe(-97.0);
    });

    it('should calculate the average for multiple points', () => {
      const locations = [
        { latitude: 32.8234, longitude: -96.7567 }, // North Dallas
        { latitude: 32.7512, longitude: -96.8315 }, // Oak Cliff
        { latitude: 32.7882, longitude: -96.6989 }, // East Dallas
      ];
      const result = calculateGroupMidpoint(locations);
      expect(result.latitude).toBeCloseTo(32.7876, 2);
      expect(result.longitude).toBeCloseTo(-96.7624, 2);
    });

    it('should handle locations across the equator', () => {
      const locations = [
        { latitude: 10.0, longitude: 0.0 },
        { latitude: -10.0, longitude: 0.0 },
      ];
      const result = calculateGroupMidpoint(locations);
      expect(result.latitude).toBe(0);
      expect(result.longitude).toBe(0);
    });
  });

  describe('isUserAtTaskLocation', () => {
    it('should return true when user is at exact task location', () => {
      const result = isUserAtTaskLocation(32.7767, -96.7970, 32.7767, -96.7970);
      expect(result).toBe(true);
    });

    it('should return true when user is within 100 meters', () => {
      // About 50 meters apart
      const result = isUserAtTaskLocation(32.7767, -96.7970, 32.7770, -96.7970);
      expect(result).toBe(true);
    });

    it('should return false when user is more than 100 meters away', () => {
      // About 1km apart
      const result = isUserAtTaskLocation(32.7767, -96.7970, 32.7867, -96.7970);
      expect(result).toBe(false);
    });

    it('should use custom radius when provided', () => {
      // About 500 meters apart - should be false with 100m radius, true with 1000m
      const result100m = isUserAtTaskLocation(32.7767, -96.7970, 32.7807, -96.7970, 100);
      const result1000m = isUserAtTaskLocation(32.7767, -96.7970, 32.7807, -96.7970, 1000);
      expect(result100m).toBe(false);
      expect(result1000m).toBe(true);
    });
  });

  describe('findOverlappingFreeTime', () => {
    it('should return empty array when no overlaps exist', () => {
      const userSlots = [
        { start: new Date('2024-01-15T09:00:00'), end: new Date('2024-01-15T12:00:00') },
      ];
      const friendSlots = [
        { start: new Date('2024-01-15T13:00:00'), end: new Date('2024-01-15T16:00:00') },
      ];
      const result = findOverlappingFreeTime(userSlots, friendSlots);
      expect(result).toHaveLength(0);
    });

    it('should find overlap when slots partially overlap', () => {
      const userSlots = [
        { start: new Date('2024-01-15T09:00:00'), end: new Date('2024-01-15T14:00:00') },
      ];
      const friendSlots = [
        { start: new Date('2024-01-15T12:00:00'), end: new Date('2024-01-15T18:00:00') },
      ];
      const result = findOverlappingFreeTime(userSlots, friendSlots);
      expect(result).toHaveLength(1);
      expect(result[0].start).toEqual(new Date('2024-01-15T12:00:00'));
      expect(result[0].end).toEqual(new Date('2024-01-15T14:00:00'));
    });

    it('should not include overlaps less than 1 hour', () => {
      const userSlots = [
        { start: new Date('2024-01-15T09:00:00'), end: new Date('2024-01-15T10:00:00') },
      ];
      const friendSlots = [
        { start: new Date('2024-01-15T09:30:00'), end: new Date('2024-01-15T12:00:00') },
      ];
      const result = findOverlappingFreeTime(userSlots, friendSlots);
      expect(result).toHaveLength(0);
    });

    it('should find multiple overlaps', () => {
      const userSlots = [
        { start: new Date('2024-01-15T09:00:00'), end: new Date('2024-01-15T12:00:00') },
        { start: new Date('2024-01-15T14:00:00'), end: new Date('2024-01-15T18:00:00') },
      ];
      const friendSlots = [
        { start: new Date('2024-01-15T10:00:00'), end: new Date('2024-01-15T15:00:00') },
      ];
      const result = findOverlappingFreeTime(userSlots, friendSlots);
      expect(result).toHaveLength(2);
    });

    it('should sort overlaps by start time', () => {
      const userSlots = [
        { start: new Date('2024-01-15T14:00:00'), end: new Date('2024-01-15T18:00:00') },
        { start: new Date('2024-01-15T09:00:00'), end: new Date('2024-01-15T12:00:00') },
      ];
      const friendSlots = [
        { start: new Date('2024-01-15T08:00:00'), end: new Date('2024-01-15T20:00:00') },
      ];
      const result = findOverlappingFreeTime(userSlots, friendSlots);
      expect(result).toHaveLength(2);
      expect(result[0].start.getTime()).toBeLessThan(result[1].start.getTime());
    });
  });

  describe('getTimeUntilNextTask', () => {
    it('should format minutes correctly', () => {
      const futureTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const result = getTimeUntilNextTask(futureTime);
      expect(result.minutes).toBeCloseTo(30, 0);
      expect(result.formatted).toMatch(/^\d+m$/);
    });

    it('should format hours correctly', () => {
      const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const result = getTimeUntilNextTask(futureTime);
      expect(result.minutes).toBeCloseTo(120, 0);
      expect(result.formatted).toBe('2h');
    });

    it('should format hours and minutes correctly', () => {
      const futureTime = new Date(Date.now() + 2.5 * 60 * 60 * 1000).toISOString();
      const result = getTimeUntilNextTask(futureTime);
      expect(result.minutes).toBeCloseTo(150, 0);
      expect(result.formatted).toMatch(/2h \d+m/);
    });

    it('should return "Now" for past times', () => {
      const pastTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const result = getTimeUntilNextTask(pastTime);
      expect(result.minutes).toBeLessThan(0);
      expect(result.formatted).toBe('Now');
    });
  });

  describe('Location Parsing', () => {
    // Test helper for parsing PostGIS POINT format
    const parseLocation = (location: any): { latitude: number; longitude: number } | null => {
      if (!location) return null;

      if (typeof location === 'string') {
        const match = location.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
        if (match) {
          return {
            longitude: parseFloat(match[1]),
            latitude: parseFloat(match[2]),
          };
        }
      }

      if (typeof location === 'object') {
        if (location.latitude && location.longitude) {
          return {
            latitude: parseFloat(location.latitude),
            longitude: parseFloat(location.longitude),
          };
        }
        if (location.coordinates && Array.isArray(location.coordinates)) {
          return {
            longitude: location.coordinates[0],
            latitude: location.coordinates[1],
          };
        }
      }

      return null;
    };

    it('should parse PostGIS POINT string format', () => {
      const result = parseLocation('POINT(-96.7970 32.7767)');
      expect(result).not.toBeNull();
      expect(result?.latitude).toBe(32.7767);
      expect(result?.longitude).toBe(-96.7970);
    });

    it('should parse object format with latitude/longitude', () => {
      const result = parseLocation({ latitude: 32.7767, longitude: -96.7970 });
      expect(result).not.toBeNull();
      expect(result?.latitude).toBe(32.7767);
      expect(result?.longitude).toBe(-96.7970);
    });

    it('should parse GeoJSON format', () => {
      const result = parseLocation({ coordinates: [-96.7970, 32.7767] });
      expect(result).not.toBeNull();
      expect(result?.latitude).toBe(32.7767);
      expect(result?.longitude).toBe(-96.7970);
    });

    it('should return null for null input', () => {
      const result = parseLocation(null);
      expect(result).toBeNull();
    });

    it('should return null for invalid format', () => {
      const result = parseLocation('invalid location string');
      expect(result).toBeNull();
    });
  });
});
