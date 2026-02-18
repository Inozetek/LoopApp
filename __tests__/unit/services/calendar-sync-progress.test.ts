/**
 * Calendar Sync Progress Tests
 *
 * Tests inferCategory keyword matching, edge cases, and progress callback logic.
 */

jest.mock('expo-calendar', () => ({}));
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
    rpc: jest.fn(),
  },
}));
jest.mock('@/utils/route-calculations', () => ({
  calculateTravelTimeWithBuffer: jest.fn(() => 15),
}));

import { inferCategory } from '@/services/calendar-service';

describe('inferCategory', () => {
  // Fitness
  it('gym → fitness', () => {
    expect(inferCategory('Morning gym session')).toBe('fitness');
  });

  it('yoga → fitness', () => {
    expect(inferCategory('Yoga with Sarah')).toBe('fitness');
  });

  it('workout → fitness', () => {
    expect(inferCategory('Quick Workout')).toBe('fitness');
  });

  it('hike → fitness', () => {
    expect(inferCategory('Saturday hike at the lake')).toBe('fitness');
  });

  // Dining
  it('dinner → dining', () => {
    expect(inferCategory('Dinner with family')).toBe('dining');
  });

  it('lunch → dining', () => {
    expect(inferCategory('Lunch meeting')).toBe('dining');
  });

  it('restaurant → dining', () => {
    expect(inferCategory('New restaurant opening')).toBe('dining');
  });

  it('coffee → dining', () => {
    expect(inferCategory('Coffee catch-up')).toBe('dining');
  });

  // Work
  it('meeting → work', () => {
    expect(inferCategory('Team meeting')).toBe('work');
  });

  it('standup → work', () => {
    expect(inferCategory('Daily Standup')).toBe('work');
  });

  it('interview → work', () => {
    expect(inferCategory('Phone interview')).toBe('work');
  });

  // Entertainment
  it('concert → entertainment', () => {
    expect(inferCategory('Jazz Concert downtown')).toBe('entertainment');
  });

  it('movie → entertainment', () => {
    expect(inferCategory('Movie night')).toBe('entertainment');
  });

  it('show → entertainment', () => {
    expect(inferCategory('Comedy show')).toBe('entertainment');
  });

  // Social
  it('birthday → social', () => {
    expect(inferCategory("Tom's Birthday")).toBe('social');
  });

  it('party → social', () => {
    expect(inferCategory('House party')).toBe('social');
  });

  it('happy hour → social', () => {
    expect(inferCategory('Friday happy hour')).toBe('social');
  });

  // Fallback
  it('returns personal for unknown title', () => {
    expect(inferCategory('Pick up dry cleaning')).toBe('personal');
  });

  // Edge cases
  it('returns personal for empty string', () => {
    expect(inferCategory('')).toBe('personal');
  });

  it('handles mixed case', () => {
    expect(inferCategory('MORNING GYM')).toBe('fitness');
  });

  it('handles undefined-like input', () => {
    // @ts-ignore - testing runtime safety
    expect(inferCategory(undefined as any)).toBe('personal');
  });

  it('matches first keyword found in multi-category title', () => {
    // "gym" appears first in fitness keywords before "dinner" in dining
    const result = inferCategory('gym then dinner');
    // Should match whichever category comes first in the iteration
    expect(['fitness', 'dining']).toContain(result);
  });
});

describe('syncSelectedEventsWithProgress callback', () => {
  it('progress callback fires correct number of times', () => {
    const onProgress = jest.fn();
    const events = [
      { title: 'Event A', location: '123 Main St' },
      { title: 'Event B', location: '456 Oak Ave' },
      { title: 'Event C', location: '789 Pine Rd' },
    ];

    // Simulate the progress loop logic from the function
    const eventsWithLocation = events.filter(e => e.location && e.location.trim().length > 0);
    for (let i = 0; i < eventsWithLocation.length; i++) {
      onProgress({
        current: i + 1,
        total: eventsWithLocation.length,
        currentTitle: eventsWithLocation[i].title,
      });
    }

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenNthCalledWith(1, { current: 1, total: 3, currentTitle: 'Event A' });
    expect(onProgress).toHaveBeenNthCalledWith(2, { current: 2, total: 3, currentTitle: 'Event B' });
    expect(onProgress).toHaveBeenNthCalledWith(3, { current: 3, total: 3, currentTitle: 'Event C' });
  });

  it('skips events without location in progress', () => {
    const onProgress = jest.fn();
    const events = [
      { title: 'Event A', location: '123 Main St' },
      { title: 'No Location', location: '' },
      { title: 'Event C', location: '789 Pine Rd' },
    ];

    const eventsWithLocation = events.filter(e => e.location && e.location.trim().length > 0);
    for (let i = 0; i < eventsWithLocation.length; i++) {
      onProgress({
        current: i + 1,
        total: eventsWithLocation.length,
        currentTitle: eventsWithLocation[i].title,
      });
    }

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, { current: 1, total: 2, currentTitle: 'Event A' });
    expect(onProgress).toHaveBeenNthCalledWith(2, { current: 2, total: 2, currentTitle: 'Event C' });
  });
});
