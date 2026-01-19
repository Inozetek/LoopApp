/**
 * Tests for business hours utility functions
 */

import {
  parseGoogleHours,
  getBusinessHours,
  isOpenAt,
  getNextOpeningTime,
  suggestVisitTime,
  formatBusinessHours,
  getTodayHours,
  BusinessHours,
  DayHours,
} from '@/utils/business-hours';

// Suppress console.log during tests
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('business-hours', () => {
  describe('parseGoogleHours', () => {
    it('should parse valid Google periods format', () => {
      const periods = [
        { open: { day: 1, time: '0900' }, close: { day: 1, time: '1700' } }, // Monday
        { open: { day: 2, time: '0900' }, close: { day: 2, time: '1700' } }, // Tuesday
      ];

      const result = parseGoogleHours(periods);

      expect(result).toEqual({
        monday: { open: '09:00', close: '17:00' },
        tuesday: { open: '09:00', close: '17:00' },
      });
    });

    it('should handle 24-hour businesses (open without close)', () => {
      const periods = [
        { open: { day: 0, time: '0000' } }, // Sunday open 24h
      ];

      const result = parseGoogleHours(periods);

      expect(result).toEqual({
        sunday: { open: '00:00', close: '23:59' },
      });
    });

    it('should return null for empty periods', () => {
      expect(parseGoogleHours([])).toBeNull();
      expect(parseGoogleHours(undefined)).toBeNull();
    });

    it('should handle late night closing times', () => {
      const periods = [
        { open: { day: 5, time: '1600' }, close: { day: 6, time: '0200' } }, // Friday 4pm - 2am
      ];

      const result = parseGoogleHours(periods);

      expect(result?.friday).toEqual({ open: '16:00', close: '02:00' });
    });
  });

  describe('getBusinessHours', () => {
    it('should use Google hours when available', () => {
      const googleHours = {
        periods: [
          { open: { day: 1, time: '1100' }, close: { day: 1, time: '2200' } },
        ],
      };

      const result = getBusinessHours(googleHours, 'restaurant');

      expect(result.isEstimated).toBe(false);
      expect(result.source).toBe('google');
      expect(result.hours.monday).toEqual({ open: '11:00', close: '22:00' });
    });

    it('should fall back to estimated hours for restaurant', () => {
      const result = getBusinessHours(undefined, 'restaurant');

      expect(result.isEstimated).toBe(true);
      expect(result.source).toBe('estimated');
      expect(result.hours.monday?.open).toBe('11:00');
    });

    it('should fall back to estimated hours for cafe', () => {
      const result = getBusinessHours(undefined, 'cafe');

      expect(result.isEstimated).toBe(true);
      expect(result.hours.monday?.open).toBe('07:00');
      expect(result.hours.monday?.close).toBe('18:00');
    });

    it('should fall back to estimated hours for bar', () => {
      const result = getBusinessHours(undefined, 'bar');

      expect(result.isEstimated).toBe(true);
      expect(result.hours.friday?.open).toBe('16:00');
      expect(result.hours.friday?.close).toBe('03:00');
    });

    it('should fall back to default hours for unknown category', () => {
      const result = getBusinessHours(undefined, 'unknown_category');

      expect(result.isEstimated).toBe(true);
      expect(result.hours.monday?.open).toBe('09:00');
      expect(result.hours.sunday?.isClosed).toBe(true);
    });

    it('should handle category with spaces', () => {
      const result = getBusinessHours(undefined, 'Shopping Mall');

      expect(result.isEstimated).toBe(true);
      expect(result.hours.saturday?.open).toBe('10:00');
    });
  });

  describe('isOpenAt', () => {
    const restaurantHours: BusinessHours = {
      monday: { open: '11:00', close: '22:00' },
      tuesday: { open: '11:00', close: '22:00' },
      wednesday: { isClosed: true },
      thursday: { open: '11:00', close: '22:00' },
      friday: { open: '11:00', close: '23:00' },
      saturday: { open: '11:00', close: '23:00' },
      sunday: { open: '12:00', close: '21:00' },
    };

    it('should return true when business is open', () => {
      // Monday 2pm
      const dateTime = new Date('2026-01-19T14:00:00');
      expect(isOpenAt(restaurantHours, dateTime)).toBe(true);
    });

    it('should return false when business is closed (before opening)', () => {
      // Monday 9am (before 11am opening)
      const dateTime = new Date('2026-01-19T09:00:00');
      expect(isOpenAt(restaurantHours, dateTime)).toBe(false);
    });

    it('should return false when business is closed (after closing)', () => {
      // Monday 11pm (after 10pm closing)
      const dateTime = new Date('2026-01-19T23:00:00');
      expect(isOpenAt(restaurantHours, dateTime)).toBe(false);
    });

    it('should return false on closed day', () => {
      // Wednesday (marked as closed)
      const dateTime = new Date('2026-01-21T14:00:00');
      expect(isOpenAt(restaurantHours, dateTime)).toBe(false);
    });

    it('should return true at exactly opening time', () => {
      // Monday 11am (opening time)
      const dateTime = new Date('2026-01-19T11:00:00');
      expect(isOpenAt(restaurantHours, dateTime)).toBe(true);
    });

    it('should return true at closing time', () => {
      // Monday 10pm (closing time)
      const dateTime = new Date('2026-01-19T22:00:00');
      expect(isOpenAt(restaurantHours, dateTime)).toBe(true);
    });

    describe('overnight hours', () => {
      const barHours: BusinessHours = {
        friday: { open: '16:00', close: '02:00' },
        saturday: { open: '14:00', close: '03:00' },
      };

      it('should return true during evening hours', () => {
        // Friday 10pm
        const dateTime = new Date('2026-01-23T22:00:00');
        expect(isOpenAt(barHours, dateTime)).toBe(true);
      });

      it('should return true after midnight (still technically Friday hours)', () => {
        // Friday 1am (bar is still open from Friday's shift)
        const dateTime = new Date('2026-01-24T01:00:00');
        // Note: This is Saturday at 1am, so it checks Saturday hours
        // Saturday opens at 2pm and closes at 3am, so 1am is within "overnight" hours
        expect(isOpenAt(barHours, dateTime)).toBe(true);
      });

      it('should return false before opening on overnight day', () => {
        // Saturday 10am (before 2pm opening)
        const dateTime = new Date('2026-01-24T10:00:00');
        expect(isOpenAt(barHours, dateTime)).toBe(false);
      });
    });
  });

  describe('getNextOpeningTime', () => {
    const museumHours: BusinessHours = {
      monday: { isClosed: true },
      tuesday: { open: '10:00', close: '17:00' },
      wednesday: { open: '10:00', close: '17:00' },
      thursday: { open: '10:00', close: '17:00' },
      friday: { open: '10:00', close: '17:00' },
      saturday: { open: '10:00', close: '18:00' },
      sunday: { open: '10:00', close: '18:00' },
    };

    it('should return null if already open', () => {
      // Tuesday 2pm (museum is open)
      const fromTime = new Date('2026-01-20T14:00:00');
      expect(getNextOpeningTime(museumHours, fromTime)).toBeNull();
    });

    it('should return later today if closed now but opens later', () => {
      // Tuesday 8am (museum opens at 10am)
      const fromTime = new Date('2026-01-20T08:00:00');
      const nextOpen = getNextOpeningTime(museumHours, fromTime);

      expect(nextOpen).not.toBeNull();
      expect(nextOpen?.getHours()).toBe(10);
      expect(nextOpen?.getDate()).toBe(20); // Same day
    });

    it('should return next day if closed for the day', () => {
      // Tuesday 6pm (museum closed at 5pm)
      const fromTime = new Date('2026-01-20T18:00:00');
      const nextOpen = getNextOpeningTime(museumHours, fromTime);

      expect(nextOpen).not.toBeNull();
      expect(nextOpen?.getDate()).toBe(21); // Wednesday
      expect(nextOpen?.getHours()).toBe(10);
    });

    it('should skip closed days', () => {
      // Monday (museum closed on Mondays)
      const fromTime = new Date('2026-01-19T10:00:00');
      const nextOpen = getNextOpeningTime(museumHours, fromTime);

      expect(nextOpen).not.toBeNull();
      expect(nextOpen?.getDate()).toBe(20); // Tuesday
    });
  });

  describe('suggestVisitTime', () => {
    const cafeHours: BusinessHours = {
      monday: { open: '07:00', close: '18:00' },
      tuesday: { open: '07:00', close: '18:00' },
      wednesday: { open: '07:00', close: '18:00' },
      thursday: { open: '07:00', close: '18:00' },
      friday: { open: '07:00', close: '18:00' },
      saturday: { open: '08:00', close: '17:00' },
      sunday: { open: '08:00', close: '17:00' },
    };

    it('should suggest morning time when preferred', () => {
      const fromTime = new Date('2026-01-19T06:00:00'); // Monday 6am
      const suggestion = suggestVisitTime(cafeHours, 'morning', fromTime);

      expect(suggestion.getHours()).toBe(9); // 9am
    });

    it('should suggest afternoon time when preferred', () => {
      const fromTime = new Date('2026-01-19T06:00:00'); // Monday 6am
      const suggestion = suggestVisitTime(cafeHours, 'afternoon', fromTime);

      expect(suggestion.getHours()).toBe(14); // 2pm
    });

    it('should suggest evening time when preferred', () => {
      const fromTime = new Date('2026-01-19T06:00:00'); // Monday 6am
      const suggestion = suggestVisitTime(cafeHours, 'evening', fromTime);

      // Evening for cafe closing at 6pm should be around 4pm (2hrs before close)
      expect(suggestion.getHours()).toBeLessThanOrEqual(18);
    });
  });

  describe('formatBusinessHours', () => {
    it('should format regular hours', () => {
      const hours: DayHours = { open: '09:00', close: '17:00' };
      expect(formatBusinessHours(hours)).toBe('9:00 AM - 5:00 PM');
    });

    it('should format afternoon hours', () => {
      const hours: DayHours = { open: '14:00', close: '22:00' };
      expect(formatBusinessHours(hours)).toBe('2:00 PM - 10:00 PM');
    });

    it('should handle midnight', () => {
      const hours: DayHours = { open: '00:00', close: '23:59' };
      expect(formatBusinessHours(hours)).toBe('12:00 AM - 11:59 PM');
    });

    it('should return "Closed" for closed days', () => {
      const hours: DayHours = { isClosed: true };
      expect(formatBusinessHours(hours)).toBe('Closed');
    });

    it('should return "Hours unavailable" for undefined', () => {
      expect(formatBusinessHours(undefined)).toBe('Hours unavailable');
    });

    it('should return "Hours unavailable" for missing open/close', () => {
      const hours: DayHours = {};
      expect(formatBusinessHours(hours)).toBe('Hours unavailable');
    });
  });

  describe('getTodayHours', () => {
    const weekHours: BusinessHours = {
      sunday: { open: '12:00', close: '20:00' },
      monday: { open: '09:00', close: '17:00' },
      tuesday: { open: '09:00', close: '17:00' },
      wednesday: { isClosed: true },
      thursday: { open: '09:00', close: '17:00' },
      friday: { open: '09:00', close: '21:00' },
      saturday: { open: '10:00', close: '18:00' },
    };

    it('should return Monday hours on Monday', () => {
      const monday = new Date('2026-01-19T12:00:00'); // Monday
      const hours = getTodayHours(weekHours, monday);
      expect(hours).toEqual({ open: '09:00', close: '17:00' });
    });

    it('should return closed on Wednesday', () => {
      const wednesday = new Date('2026-01-21T12:00:00'); // Wednesday
      const hours = getTodayHours(weekHours, wednesday);
      expect(hours).toEqual({ isClosed: true });
    });

    it('should return Saturday hours on Saturday', () => {
      const saturday = new Date('2026-01-24T12:00:00'); // Saturday
      const hours = getTodayHours(weekHours, saturday);
      expect(hours).toEqual({ open: '10:00', close: '18:00' });
    });

    it('should return Sunday hours on Sunday', () => {
      const sunday = new Date('2026-01-25T12:00:00'); // Sunday
      const hours = getTodayHours(weekHours, sunday);
      expect(hours).toEqual({ open: '12:00', close: '20:00' });
    });
  });
});
