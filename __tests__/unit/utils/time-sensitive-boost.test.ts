/**
 * Tests for time-sensitive boost calculations
 */

import {
  calculateTimeSensitiveBoost,
  isActivityActiveNow,
  getHoursUntilDealStarts,
} from '@/utils/time-sensitive-boost';
import type { UnifiedActivity, YelpDeal } from '@/types/activity';

// Helper to create a minimal UnifiedActivity for testing
function createActivity(overrides: Partial<UnifiedActivity> = {}): UnifiedActivity {
  return {
    place_id: 'test-place-123',
    name: 'Test Place',
    formatted_address: '123 Test St',
    geometry: { location: { lat: 32.7767, lng: -96.7970 } },
    types: ['restaurant'],
    source: 'google_places',
    ...overrides,
  };
}

// Helper to create a YelpDeal
function createDeal(overrides: Partial<YelpDeal> = {}): YelpDeal {
  return {
    id: 'deal-123',
    title: 'Happy Hour',
    ...overrides,
  };
}

describe('time-sensitive-boost', () => {
  // Store original Date
  const RealDate = global.Date;

  afterEach(() => {
    // Restore Date after each test
    global.Date = RealDate;
  });

  // Helper to mock current date/time
  function mockDateTime(isoString: string) {
    const mockDate = new RealDate(isoString);
    global.Date = class extends RealDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(mockDate.getTime());
        } else {
          // @ts-ignore
          super(...args);
        }
      }
      static now() {
        return mockDate.getTime();
      }
    } as any;
  }

  describe('calculateTimeSensitiveBoost', () => {
    describe('with no time-sensitive data', () => {
      it('should return 0 for activity with no deals or events', () => {
        const activity = createActivity();
        expect(calculateTimeSensitiveBoost(activity)).toBe(0);
      });
    });

    describe('with Yelp deals', () => {
      it('should return 25 for active happy hour', () => {
        // Mock time: Wednesday 5pm (during typical happy hour 4-7pm)
        mockDateTime('2026-01-21T17:00:00');

        const activity = createActivity({
          yelp_metadata: {
            yelp_id: 'yelp-123',
            yelp_url: 'https://yelp.com/biz/test',
            review_count: 100,
            categories: ['bars'],
            deals: [
              createDeal({
                title: 'Happy Hour: 50% off drinks',
                time_start: '16:00',
                time_end: '19:00',
                days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
              }),
            ],
          },
        });

        expect(calculateTimeSensitiveBoost(activity)).toBe(25);
      });

      it('should return 20 for deal starting in 1-2 hours', () => {
        // Mock time: Wednesday 2pm (happy hour starts at 4pm)
        mockDateTime('2026-01-21T14:00:00');

        const activity = createActivity({
          yelp_metadata: {
            yelp_id: 'yelp-123',
            yelp_url: 'https://yelp.com/biz/test',
            review_count: 100,
            categories: ['bars'],
            deals: [
              createDeal({
                title: 'Happy Hour',
                time_start: '16:00',
                time_end: '19:00',
                days: ['wednesday'],
              }),
            ],
          },
        });

        expect(calculateTimeSensitiveBoost(activity)).toBe(20);
      });

      it('should return 15 for deal starting in 2-4 hours', () => {
        // Mock time: Wednesday 1pm (happy hour starts at 4pm - 3 hours away)
        mockDateTime('2026-01-21T13:00:00');

        const activity = createActivity({
          yelp_metadata: {
            yelp_id: 'yelp-123',
            yelp_url: 'https://yelp.com/biz/test',
            review_count: 100,
            categories: ['bars'],
            deals: [
              createDeal({
                title: 'Happy Hour',
                time_start: '16:00',
                time_end: '19:00',
                days: ['wednesday'],
              }),
            ],
          },
        });

        expect(calculateTimeSensitiveBoost(activity)).toBe(15);
      });

      it('should return 0 for deal not active today (wrong day)', () => {
        // Mock time: Thursday 5pm
        mockDateTime('2026-01-22T17:00:00');

        const activity = createActivity({
          yelp_metadata: {
            yelp_id: 'yelp-123',
            yelp_url: 'https://yelp.com/biz/test',
            review_count: 100,
            categories: ['bars'],
            deals: [
              createDeal({
                title: 'Monday Special',
                time_start: '16:00',
                time_end: '19:00',
                days: ['monday'], // Only on Monday
              }),
            ],
          },
        });

        expect(calculateTimeSensitiveBoost(activity)).toBe(0);
      });

      it('should return 15 for deal with no specific time window', () => {
        // Mock time: Wednesday 10am
        mockDateTime('2026-01-21T10:00:00');

        const activity = createActivity({
          yelp_metadata: {
            yelp_id: 'yelp-123',
            yelp_url: 'https://yelp.com/biz/test',
            review_count: 100,
            categories: ['restaurants'],
            deals: [
              createDeal({
                title: 'All Day Special',
                days: ['wednesday'],
                // No time_start/time_end = always active
              }),
            ],
          },
        });

        expect(calculateTimeSensitiveBoost(activity)).toBe(15);
      });
    });

    describe('with Groupon deals', () => {
      it('should return 20 for deal expiring within 24 hours', () => {
        // Mock time: Wednesday noon
        mockDateTime('2026-01-21T12:00:00');

        const activity = createActivity({
          groupon_metadata: {
            deal_id: 'groupon-123',
            deal_url: 'https://groupon.com/deals/test',
            original_price: 5000,
            deal_price: 2500,
            discount_percent: 50,
            voucher_expiration: '2026-01-22T00:00:00', // Expires in 12 hours
            fine_print: 'Some restrictions apply',
            merchant_name: 'Test Merchant',
          },
        });

        expect(calculateTimeSensitiveBoost(activity)).toBe(20);
      });

      it('should return 10 for deal expiring within 48 hours', () => {
        // Mock time: Wednesday noon
        mockDateTime('2026-01-21T12:00:00');

        const activity = createActivity({
          groupon_metadata: {
            deal_id: 'groupon-123',
            deal_url: 'https://groupon.com/deals/test',
            original_price: 5000,
            deal_price: 2500,
            discount_percent: 50,
            voucher_expiration: '2026-01-23T00:00:00', // Expires in 36 hours
            fine_print: 'Some restrictions apply',
            merchant_name: 'Test Merchant',
          },
        });

        expect(calculateTimeSensitiveBoost(activity)).toBe(10);
      });

      it('should return 0 for deal expiring in more than 48 hours', () => {
        // Mock time: Wednesday noon
        mockDateTime('2026-01-21T12:00:00');

        const activity = createActivity({
          groupon_metadata: {
            deal_id: 'groupon-123',
            deal_url: 'https://groupon.com/deals/test',
            original_price: 5000,
            deal_price: 2500,
            discount_percent: 50,
            voucher_expiration: '2026-01-30T00:00:00', // Expires in 9 days
            fine_print: 'Some restrictions apply',
            merchant_name: 'Test Merchant',
          },
        });

        expect(calculateTimeSensitiveBoost(activity)).toBe(0);
      });
    });

    describe('with event metadata (Ticketmaster)', () => {
      it('should return 25 for event starting within 3 hours', () => {
        // Mock time: Wednesday 6pm
        mockDateTime('2026-01-21T18:00:00');

        const activity = createActivity({
          event_metadata: {
            start_time: '2026-01-21T20:00:00', // 8pm - 2 hours away
            end_time: '2026-01-21T23:00:00',
            duration_minutes: 180,
          },
        });

        expect(calculateTimeSensitiveBoost(activity)).toBe(25);
      });

      it('should return 20 for event starting within 12 hours', () => {
        // Mock time: Wednesday 10am
        mockDateTime('2026-01-21T10:00:00');

        const activity = createActivity({
          event_metadata: {
            start_time: '2026-01-21T20:00:00', // 8pm - 10 hours away
            end_time: '2026-01-21T23:00:00',
            duration_minutes: 180,
          },
        });

        expect(calculateTimeSensitiveBoost(activity)).toBe(20);
      });

      it('should return 15 for event starting within 24 hours', () => {
        // Mock time: Wednesday 10am
        mockDateTime('2026-01-21T10:00:00');

        const activity = createActivity({
          event_metadata: {
            start_time: '2026-01-21T23:00:00', // 11pm - 13 hours away
            end_time: '2026-01-22T02:00:00',
            duration_minutes: 180,
          },
        });

        expect(calculateTimeSensitiveBoost(activity)).toBe(15);
      });

      it('should return 10 for event tomorrow', () => {
        // Mock time: Wednesday 10am
        mockDateTime('2026-01-21T10:00:00');

        const activity = createActivity({
          event_metadata: {
            start_time: '2026-01-22T20:00:00', // Tomorrow 8pm - 34 hours away
            end_time: '2026-01-22T23:00:00',
            duration_minutes: 180,
          },
        });

        expect(calculateTimeSensitiveBoost(activity)).toBe(10);
      });

      it('should return 0 for event more than 48 hours away', () => {
        // Mock time: Wednesday 10am
        mockDateTime('2026-01-21T10:00:00');

        const activity = createActivity({
          event_metadata: {
            start_time: '2026-01-25T20:00:00', // Saturday 8pm - 4+ days away
            end_time: '2026-01-25T23:00:00',
            duration_minutes: 180,
          },
        });

        expect(calculateTimeSensitiveBoost(activity)).toBe(0);
      });
    });

    describe('with multiple time-sensitive sources', () => {
      it('should return the maximum boost across all sources', () => {
        // Mock time: Wednesday 6pm
        mockDateTime('2026-01-21T18:00:00');

        const activity = createActivity({
          // Yelp deal: active now = 25 points
          yelp_metadata: {
            yelp_id: 'yelp-123',
            yelp_url: 'https://yelp.com/biz/test',
            review_count: 100,
            categories: ['bars'],
            deals: [
              createDeal({
                title: 'Happy Hour',
                time_start: '16:00',
                time_end: '19:00',
                days: ['wednesday'],
              }),
            ],
          },
          // Groupon: expires in 36 hours = 10 points
          groupon_metadata: {
            deal_id: 'groupon-123',
            deal_url: 'https://groupon.com/deals/test',
            original_price: 5000,
            deal_price: 2500,
            discount_percent: 50,
            voucher_expiration: '2026-01-23T06:00:00',
            fine_print: 'Some restrictions apply',
            merchant_name: 'Test Merchant',
          },
        });

        // Should return max(25, 10) = 25
        expect(calculateTimeSensitiveBoost(activity)).toBe(25);
      });
    });
  });

  describe('isActivityActiveNow', () => {
    it('should return true for deal active now', () => {
      // Mock time: Wednesday 5pm
      mockDateTime('2026-01-21T17:00:00');

      const activity = createActivity({
        yelp_metadata: {
          yelp_id: 'yelp-123',
          yelp_url: 'https://yelp.com/biz/test',
          review_count: 100,
          categories: ['bars'],
          deals: [
            createDeal({
              title: 'Happy Hour',
              time_start: '16:00',
              time_end: '19:00',
              days: ['wednesday'],
            }),
          ],
        },
      });

      expect(isActivityActiveNow(activity)).toBe(true);
    });

    it('should return false for deal not active now', () => {
      // Mock time: Wednesday 10am (before happy hour)
      mockDateTime('2026-01-21T10:00:00');

      const activity = createActivity({
        yelp_metadata: {
          yelp_id: 'yelp-123',
          yelp_url: 'https://yelp.com/biz/test',
          review_count: 100,
          categories: ['bars'],
          deals: [
            createDeal({
              title: 'Happy Hour',
              time_start: '16:00',
              time_end: '19:00',
              days: ['wednesday'],
            }),
          ],
        },
      });

      expect(isActivityActiveNow(activity)).toBe(false);
    });

    it('should return true for event starting within 1 hour', () => {
      // Mock time: Wednesday 7:30pm
      mockDateTime('2026-01-21T19:30:00');

      const activity = createActivity({
        event_metadata: {
          start_time: '2026-01-21T20:00:00', // 8pm - 30 min away
          end_time: '2026-01-21T23:00:00',
          duration_minutes: 180,
        },
      });

      expect(isActivityActiveNow(activity)).toBe(true);
    });

    it('should return false for event starting more than 1 hour away', () => {
      // Mock time: Wednesday 6pm
      mockDateTime('2026-01-21T18:00:00');

      const activity = createActivity({
        event_metadata: {
          start_time: '2026-01-21T20:00:00', // 8pm - 2 hours away
          end_time: '2026-01-21T23:00:00',
          duration_minutes: 180,
        },
      });

      expect(isActivityActiveNow(activity)).toBe(false);
    });

    it('should return true for deal with no time restriction on correct day', () => {
      // Mock time: Wednesday 10am
      mockDateTime('2026-01-21T10:00:00');

      const activity = createActivity({
        extractedDeals: [
          createDeal({
            title: 'All Day Special',
            days: ['wednesday'],
            // No time_start/time_end
          }),
        ],
      });

      expect(isActivityActiveNow(activity)).toBe(true);
    });
  });

  describe('getHoursUntilDealStarts', () => {
    it('should return hours until deal starts', () => {
      // Mock time: 2pm
      mockDateTime('2026-01-21T14:00:00');

      const deal = createDeal({
        time_start: '17:00', // 5pm
      });

      expect(getHoursUntilDealStarts(deal)).toBe(3);
    });

    it('should return undefined if deal has no start time', () => {
      const deal = createDeal({
        title: 'All Day Deal',
        // No time_start
      });

      expect(getHoursUntilDealStarts(deal)).toBeUndefined();
    });

    it('should return undefined if deal has already started', () => {
      // Mock time: 6pm
      mockDateTime('2026-01-21T18:00:00');

      const deal = createDeal({
        time_start: '16:00', // 4pm - already passed
      });

      expect(getHoursUntilDealStarts(deal)).toBeUndefined();
    });
  });
});
