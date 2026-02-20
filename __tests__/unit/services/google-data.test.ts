/**
 * Tests for Google Data Extraction Service
 *
 * Tests pure logic functions duplicated from services/google-data.ts:
 * - EVENT_KEYWORD_MAPPING: calendar event keyword to Loop category mapping
 * - LOCATION_KEYWORD_MAPPING: location keyword to Loop category mapping
 * - Interest extraction from event titles
 * - Category extraction from event titles and locations
 * - Favorite places extraction (visit counting, sorting, top-15 cap)
 * - Schedule pattern detection (busiest days, free slots)
 * - mapGoogleToLoopCategories: filters extracted categories to Loop's predefined list
 * - mergeExtractedInterests: merges Google and Facebook extracted data
 *
 * Pattern: Pure functions are duplicated in-test to avoid importing
 * the source file (which may pull in React Native dependencies).
 */

// Mock Supabase client (source file does not import it, but keeping for safety)
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(),
    })),
  },
}));

// ====================================================================
// Duplicated pure logic from services/google-data.ts
// ====================================================================

interface CalendarEvent {
  id: string;
  title: string;
  location?: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  status: string;
}

interface ExtractedGoogleData {
  interests: string[];
  categories: string[];
  favoritePlaces: Array<{
    name: string;
    category?: string;
    address?: string;
    visitCount: number;
  }>;
  calendarEvents: CalendarEvent[];
  scheduleSummary: {
    totalEvents: number;
    eventsWithLocations: number;
    busiestDays: string[];
    typicalFreeSlots: string[];
  };
}

const EVENT_KEYWORD_MAPPING: Record<string, string[]> = {
  'gym': ['fitness', 'gym'],
  'workout': ['fitness', 'gym'],
  'yoga': ['fitness', 'wellness'],
  'pilates': ['fitness', 'wellness'],
  'crossfit': ['fitness', 'gym'],
  'run': ['fitness', 'outdoors'],
  'hike': ['outdoors', 'nature'],
  'dinner': ['dining', 'food'],
  'lunch': ['dining', 'food'],
  'brunch': ['dining', 'food'],
  'restaurant': ['dining', 'food'],
  'coffee': ['coffee', 'cafe'],
  'happy hour': ['nightlife', 'drinks'],
  'bar': ['nightlife', 'drinks'],
  'movie': ['movies', 'entertainment'],
  'concert': ['live music', 'entertainment'],
  'show': ['entertainment'],
  'museum': ['art', 'culture', 'museums'],
  'gallery': ['art', 'culture'],
  'park': ['outdoors', 'nature', 'parks'],
  'beach': ['outdoors', 'nature'],
  'spa': ['wellness', 'self-care'],
  'salon': ['wellness', 'self-care'],
  'church': ['community'],
  'game': ['sports', 'entertainment'],
  'match': ['sports'],
  'practice': ['sports', 'fitness'],
  'class': ['fitness', 'culture'],
  'meetup': ['social'],
  'party': ['social', 'nightlife'],
  'birthday': ['social'],
  'wedding': ['social'],
  'travel': ['travel'],
  'flight': ['travel'],
  'hotel': ['travel'],
  'shopping': ['shopping'],
  'market': ['shopping', 'food'],
};

const LOCATION_KEYWORD_MAPPING: Record<string, string[]> = {
  'gym': ['fitness'],
  'fitness': ['fitness'],
  'yoga': ['fitness', 'wellness'],
  'restaurant': ['dining'],
  'cafe': ['coffee'],
  'coffee': ['coffee'],
  'starbucks': ['coffee'],
  'bar': ['nightlife'],
  'brewery': ['nightlife', 'drinks'],
  'theater': ['entertainment'],
  'cinema': ['movies'],
  'museum': ['art', 'culture'],
  'park': ['outdoors'],
  'church': ['community'],
  'mall': ['shopping'],
  'salon': ['wellness'],
  'spa': ['wellness'],
  'stadium': ['sports'],
  'arena': ['sports', 'entertainment'],
  'hotel': ['travel'],
  'airport': ['travel'],
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Mirrors the core extraction logic from extractGoogleInterests.
 * Pulls out categories and interests from event titles using EVENT_KEYWORD_MAPPING.
 */
function extractCategoriesAndInterests(events: CalendarEvent[]): {
  categories: string[];
  interests: string[];
} {
  const categorySet = new Set<string>();
  const interestSet = new Set<string>();

  for (const event of events) {
    const titleLower = event.title.toLowerCase();

    for (const [keyword, categories] of Object.entries(EVENT_KEYWORD_MAPPING)) {
      if (titleLower.includes(keyword)) {
        categories.forEach(cat => categorySet.add(cat));
        interestSet.add(keyword);
      }
    }

    if (event.location) {
      const locationLower = event.location.toLowerCase();
      for (const [keyword, categories] of Object.entries(LOCATION_KEYWORD_MAPPING)) {
        if (locationLower.includes(keyword)) {
          categories.forEach(cat => categorySet.add(cat));
        }
      }
    }
  }

  return {
    categories: Array.from(categorySet),
    interests: Array.from(interestSet),
  };
}

/**
 * Mirrors favorite places extraction from extractGoogleInterests.
 * Counts location occurrences, sorts by frequency, caps at 15.
 */
function extractFavoritePlaces(events: CalendarEvent[]): {
  places: ExtractedGoogleData['favoritePlaces'];
  eventsWithLocations: number;
} {
  const locationCounts = new Map<string, number>();
  let eventsWithLocations = 0;

  for (const event of events) {
    if (event.location) {
      const loc = event.location.trim();
      locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1);
      eventsWithLocations++;
    }
  }

  const places = Array.from(locationCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([address, visitCount]) => {
      const addressLower = address.toLowerCase();
      let category: string | undefined;
      for (const [keyword, categories] of Object.entries(LOCATION_KEYWORD_MAPPING)) {
        if (addressLower.includes(keyword)) {
          category = categories[0];
          break;
        }
      }
      return { name: address.split(',')[0], category, address, visitCount };
    });

  return { places, eventsWithLocations };
}

/**
 * Mirrors busiest days analysis from extractGoogleInterests.
 * Counts non-all-day events per weekday, returns top 3.
 */
function analyzeBusiestDays(events: CalendarEvent[]): string[] {
  const dayCounts = new Map<number, number>();
  for (const event of events) {
    if (!event.isAllDay) {
      const day = new Date(event.startTime).getDay();
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    }
  }
  return Array.from(dayCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([day]) => DAY_NAMES[day]);
}

/**
 * Mirrors mapGoogleToLoopCategories from google-data.ts
 */
function mapGoogleToLoopCategories(extractedCategories: string[]): string[] {
  const LOOP_CATEGORIES = [
    'coffee',
    'dining',
    'live music',
    'nightlife',
    'fitness',
    'outdoors',
    'art',
    'shopping',
    'movies',
    'sports',
    'wellness',
    'culture',
  ];

  return LOOP_CATEGORIES.filter(category =>
    extractedCategories.includes(category)
  );
}

/**
 * Mirrors mergeExtractedInterests from google-data.ts
 */
function mergeExtractedInterests(
  google: ExtractedGoogleData | null,
  facebook: { interests: string[]; categories: string[] } | null
): { interests: string[]; categories: string[] } {
  const allInterests = new Set<string>();
  const allCategories = new Set<string>();

  if (google) {
    google.interests.forEach(i => allInterests.add(i));
    google.categories.forEach(c => allCategories.add(c));
  }

  if (facebook) {
    facebook.interests.forEach(i => allInterests.add(i));
    facebook.categories.forEach(c => allCategories.add(c));
  }

  return {
    interests: Array.from(allInterests).slice(0, 100),
    categories: Array.from(allCategories),
  };
}

// ====================================================================
// Helper to create mock CalendarEvent
// ====================================================================

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: overrides.id || 'evt-1',
    title: overrides.title || 'Untitled',
    location: overrides.location,
    startTime: overrides.startTime || '2025-09-15T10:00:00Z',
    endTime: overrides.endTime || '2025-09-15T11:00:00Z',
    isAllDay: overrides.isAllDay ?? false,
    status: overrides.status || 'confirmed',
  };
}

// ====================================================================
// Tests
// ====================================================================

describe('Google Data Extraction Service - Pure Logic', () => {

  // ---------------------------------------------------------------
  // EVENT_KEYWORD_MAPPING tests
  // ---------------------------------------------------------------
  describe('EVENT_KEYWORD_MAPPING coverage', () => {
    it('should have 37 keyword entries', () => {
      expect(Object.keys(EVENT_KEYWORD_MAPPING).length).toBe(37);
    });

    it.each([
      ['gym', ['fitness', 'gym']],
      ['workout', ['fitness', 'gym']],
      ['yoga', ['fitness', 'wellness']],
      ['pilates', ['fitness', 'wellness']],
      ['crossfit', ['fitness', 'gym']],
      ['run', ['fitness', 'outdoors']],
      ['hike', ['outdoors', 'nature']],
      ['dinner', ['dining', 'food']],
      ['lunch', ['dining', 'food']],
      ['brunch', ['dining', 'food']],
      ['restaurant', ['dining', 'food']],
      ['coffee', ['coffee', 'cafe']],
      ['happy hour', ['nightlife', 'drinks']],
      ['bar', ['nightlife', 'drinks']],
      ['movie', ['movies', 'entertainment']],
      ['concert', ['live music', 'entertainment']],
      ['show', ['entertainment']],
      ['museum', ['art', 'culture', 'museums']],
      ['gallery', ['art', 'culture']],
      ['park', ['outdoors', 'nature', 'parks']],
      ['beach', ['outdoors', 'nature']],
      ['spa', ['wellness', 'self-care']],
      ['salon', ['wellness', 'self-care']],
      ['church', ['community']],
      ['game', ['sports', 'entertainment']],
      ['match', ['sports']],
      ['practice', ['sports', 'fitness']],
      ['class', ['fitness', 'culture']],
      ['meetup', ['social']],
      ['party', ['social', 'nightlife']],
      ['birthday', ['social']],
      ['wedding', ['social']],
      ['travel', ['travel']],
      ['flight', ['travel']],
      ['hotel', ['travel']],
      ['shopping', ['shopping']],
      ['market', ['shopping', 'food']],
    ])('keyword "%s" maps to %j', (keyword, expectedCategories) => {
      expect(EVENT_KEYWORD_MAPPING[keyword]).toEqual(expectedCategories);
    });
  });

  // ---------------------------------------------------------------
  // LOCATION_KEYWORD_MAPPING tests
  // ---------------------------------------------------------------
  describe('LOCATION_KEYWORD_MAPPING coverage', () => {
    it('should have 21 location keyword entries', () => {
      expect(Object.keys(LOCATION_KEYWORD_MAPPING).length).toBe(21);
    });

    it.each([
      ['gym', ['fitness']],
      ['fitness', ['fitness']],
      ['yoga', ['fitness', 'wellness']],
      ['restaurant', ['dining']],
      ['cafe', ['coffee']],
      ['coffee', ['coffee']],
      ['starbucks', ['coffee']],
      ['bar', ['nightlife']],
      ['brewery', ['nightlife', 'drinks']],
      ['theater', ['entertainment']],
      ['cinema', ['movies']],
      ['museum', ['art', 'culture']],
      ['park', ['outdoors']],
      ['church', ['community']],
      ['mall', ['shopping']],
      ['salon', ['wellness']],
      ['spa', ['wellness']],
      ['stadium', ['sports']],
      ['arena', ['sports', 'entertainment']],
      ['hotel', ['travel']],
      ['airport', ['travel']],
    ])('location keyword "%s" maps to %j', (keyword, expectedCategories) => {
      expect(LOCATION_KEYWORD_MAPPING[keyword]).toEqual(expectedCategories);
    });
  });

  // ---------------------------------------------------------------
  // extractCategoriesAndInterests
  // ---------------------------------------------------------------
  describe('extractCategoriesAndInterests', () => {
    it('should return empty arrays for empty events', () => {
      const result = extractCategoriesAndInterests([]);
      expect(result.categories).toEqual([]);
      expect(result.interests).toEqual([]);
    });

    it('should extract categories from a single event title', () => {
      const events = [makeEvent({ title: 'Morning Yoga Session' })];
      const result = extractCategoriesAndInterests(events);
      expect(result.categories).toContain('fitness');
      expect(result.categories).toContain('wellness');
      expect(result.interests).toContain('yoga');
    });

    it('should extract multiple keywords from one title', () => {
      const events = [makeEvent({ title: 'Dinner and a Movie' })];
      const result = extractCategoriesAndInterests(events);
      expect(result.categories).toContain('dining');
      expect(result.categories).toContain('food');
      expect(result.categories).toContain('movies');
      expect(result.categories).toContain('entertainment');
      expect(result.interests).toContain('dinner');
      expect(result.interests).toContain('movie');
    });

    it('should be case-insensitive for event titles', () => {
      const events = [makeEvent({ title: 'CROSSFIT at 6AM' })];
      const result = extractCategoriesAndInterests(events);
      expect(result.categories).toContain('fitness');
      expect(result.categories).toContain('gym');
      expect(result.interests).toContain('crossfit');
    });

    it('should match partial words containing the keyword', () => {
      // "running" contains "run"
      const events = [makeEvent({ title: 'Morning running group' })];
      const result = extractCategoriesAndInterests(events);
      expect(result.interests).toContain('run');
      expect(result.categories).toContain('fitness');
      expect(result.categories).toContain('outdoors');
    });

    it('should match "happy hour" as a multi-word keyword', () => {
      const events = [makeEvent({ title: 'Team Happy Hour on Friday' })];
      const result = extractCategoriesAndInterests(events);
      expect(result.interests).toContain('happy hour');
      expect(result.categories).toContain('nightlife');
      expect(result.categories).toContain('drinks');
    });

    it('should extract categories from event location keywords', () => {
      const events = [makeEvent({ title: 'Meeting', location: 'Starbucks, 123 Main St' })];
      const result = extractCategoriesAndInterests(events);
      expect(result.categories).toContain('coffee');
    });

    it('should be case-insensitive for location matching', () => {
      const events = [makeEvent({ title: 'Workout', location: 'Equinox GYM, Downtown' })];
      const result = extractCategoriesAndInterests(events);
      // From title "workout"
      expect(result.categories).toContain('fitness');
      expect(result.categories).toContain('gym');
      // From location "gym"
      // fitness already present
    });

    it('should combine title and location categories', () => {
      const events = [makeEvent({ title: 'Dinner reservation', location: 'The Italian Restaurant, Oak Park Mall' })];
      const result = extractCategoriesAndInterests(events);
      // From title "dinner"
      expect(result.categories).toContain('dining');
      expect(result.categories).toContain('food');
      // From location "restaurant" -> dining
      // From location "mall" -> shopping
      expect(result.categories).toContain('shopping');
      // From location "park" -> outdoors
      expect(result.categories).toContain('outdoors');
    });

    it('should deduplicate categories across multiple events', () => {
      const events = [
        makeEvent({ title: 'Morning Coffee' }),
        makeEvent({ title: 'Afternoon Coffee with Bob' }),
      ];
      const result = extractCategoriesAndInterests(events);
      const coffeeCount = result.categories.filter(c => c === 'coffee').length;
      expect(coffeeCount).toBe(1); // deduplicated
      const coffeeInterestCount = result.interests.filter(i => i === 'coffee').length;
      expect(coffeeInterestCount).toBe(1);
    });

    it('should not extract anything from unrecognized event titles', () => {
      const events = [makeEvent({ title: 'Q4 strategy sync' })];
      const result = extractCategoriesAndInterests(events);
      expect(result.categories).toEqual([]);
      expect(result.interests).toEqual([]);
    });

    it('should not extract interests from location keywords (only categories)', () => {
      const events = [makeEvent({ title: 'Board meeting', location: 'Downtown Cinema' })];
      const result = extractCategoriesAndInterests(events);
      // Location adds categories but not interests
      expect(result.categories).toContain('movies');
      // "cinema" is not in EVENT_KEYWORD_MAPPING, so no interest from it
      expect(result.interests).not.toContain('cinema');
    });

    it('should handle events with no location gracefully', () => {
      const events = [makeEvent({ title: 'Yoga', location: undefined })];
      const result = extractCategoriesAndInterests(events);
      expect(result.categories).toContain('fitness');
      expect(result.categories).toContain('wellness');
    });

    it('should extract from many events with diverse keywords', () => {
      const events = [
        makeEvent({ title: 'Gym session' }),
        makeEvent({ title: 'Lunch with Sarah' }),
        makeEvent({ title: 'Concert at Red Rocks' }),
        makeEvent({ title: 'Flight to NYC' }),
        makeEvent({ title: 'Hotel check-in' }),
        makeEvent({ title: 'Birthday party' }),
      ];
      const result = extractCategoriesAndInterests(events);
      expect(result.interests).toContain('gym');
      expect(result.interests).toContain('lunch');
      expect(result.interests).toContain('concert');
      expect(result.interests).toContain('flight');
      expect(result.interests).toContain('hotel');
      expect(result.interests).toContain('birthday');
      expect(result.interests).toContain('party');
      expect(result.categories).toContain('fitness');
      expect(result.categories).toContain('dining');
      expect(result.categories).toContain('live music');
      expect(result.categories).toContain('travel');
      expect(result.categories).toContain('social');
      expect(result.categories).toContain('nightlife');
    });

    it('should handle "show" keyword matching substrings like "shower"', () => {
      // "shower" contains "show" so it will match
      const events = [makeEvent({ title: 'Baby shower for Amy' })];
      const result = extractCategoriesAndInterests(events);
      // This is expected behavior since the matching is substring-based
      expect(result.interests).toContain('show');
      expect(result.categories).toContain('entertainment');
    });

    it('should handle "market" keyword for farmers market', () => {
      const events = [makeEvent({ title: "Farmer's Market Saturday" })];
      const result = extractCategoriesAndInterests(events);
      expect(result.interests).toContain('market');
      expect(result.categories).toContain('shopping');
      expect(result.categories).toContain('food');
    });

    it('should detect "bar" in longer words like "barbecue"', () => {
      const events = [makeEvent({ title: 'Barbecue at the lake' })];
      const result = extractCategoriesAndInterests(events);
      // substring match: "barbecue" contains "bar"
      expect(result.interests).toContain('bar');
      expect(result.categories).toContain('nightlife');
    });

    it('should match brewery in location but not add to interests', () => {
      const events = [makeEvent({ title: 'Team event', location: 'Deep Ellum Brewery' })];
      const result = extractCategoriesAndInterests(events);
      expect(result.categories).toContain('nightlife');
      expect(result.categories).toContain('drinks');
      // brewery is not an EVENT_KEYWORD, so no interest added
      expect(result.interests).not.toContain('brewery');
    });
  });

  // ---------------------------------------------------------------
  // extractFavoritePlaces
  // ---------------------------------------------------------------
  describe('extractFavoritePlaces', () => {
    it('should return empty for events with no locations', () => {
      const events = [
        makeEvent({ title: 'Meeting' }),
        makeEvent({ title: 'Call' }),
      ];
      const result = extractFavoritePlaces(events);
      expect(result.places).toEqual([]);
      expect(result.eventsWithLocations).toBe(0);
    });

    it('should count visits to the same location', () => {
      const events = [
        makeEvent({ title: 'Coffee', location: 'Starbucks, 123 Main St' }),
        makeEvent({ title: 'Coffee', location: 'Starbucks, 123 Main St' }),
        makeEvent({ title: 'Coffee', location: 'Starbucks, 123 Main St' }),
      ];
      const result = extractFavoritePlaces(events);
      expect(result.places).toHaveLength(1);
      expect(result.places[0].visitCount).toBe(3);
      expect(result.eventsWithLocations).toBe(3);
    });

    it('should sort places by visit frequency (most visited first)', () => {
      const events = [
        makeEvent({ location: 'Place A' }),
        makeEvent({ location: 'Place B' }),
        makeEvent({ location: 'Place B' }),
        makeEvent({ location: 'Place C' }),
        makeEvent({ location: 'Place C' }),
        makeEvent({ location: 'Place C' }),
      ];
      const result = extractFavoritePlaces(events);
      expect(result.places[0].address).toBe('Place C');
      expect(result.places[0].visitCount).toBe(3);
      expect(result.places[1].address).toBe('Place B');
      expect(result.places[1].visitCount).toBe(2);
      expect(result.places[2].address).toBe('Place A');
      expect(result.places[2].visitCount).toBe(1);
    });

    it('should cap at 15 places', () => {
      const events: CalendarEvent[] = [];
      for (let i = 0; i < 20; i++) {
        events.push(makeEvent({ location: `Place ${i}` }));
      }
      const result = extractFavoritePlaces(events);
      expect(result.places.length).toBe(15);
    });

    it('should extract name from first part before comma', () => {
      const events = [makeEvent({ location: 'Starbucks, 123 Main St, Dallas, TX' })];
      const result = extractFavoritePlaces(events);
      expect(result.places[0].name).toBe('Starbucks');
      expect(result.places[0].address).toBe('Starbucks, 123 Main St, Dallas, TX');
    });

    it('should use full address as name when no comma present', () => {
      const events = [makeEvent({ location: 'Central Park' })];
      const result = extractFavoritePlaces(events);
      expect(result.places[0].name).toBe('Central Park');
    });

    it('should categorize places using LOCATION_KEYWORD_MAPPING', () => {
      const events = [
        makeEvent({ location: 'Planet Fitness, Dallas' }),
        makeEvent({ location: 'AMC Cinema, Plano' }),
        makeEvent({ location: 'Hilton Hotel, Fort Worth' }),
      ];
      const result = extractFavoritePlaces(events);
      const fitness = result.places.find(p => p.name === 'Planet Fitness');
      const cinema = result.places.find(p => p.name === 'AMC Cinema');
      const hotel = result.places.find(p => p.name === 'Hilton Hotel');
      expect(fitness?.category).toBe('fitness');
      expect(cinema?.category).toBe('movies');
      expect(hotel?.category).toBe('travel');
    });

    it('should use first matching category for location', () => {
      // "yoga studio" contains "yoga" -> ['fitness', 'wellness'], first is 'fitness'
      const events = [makeEvent({ location: 'Hot Yoga Studio' })];
      const result = extractFavoritePlaces(events);
      expect(result.places[0].category).toBe('fitness');
    });

    it('should leave category undefined for unrecognized locations', () => {
      const events = [makeEvent({ location: '742 Evergreen Terrace' })];
      const result = extractFavoritePlaces(events);
      expect(result.places[0].category).toBeUndefined();
    });

    it('should trim whitespace from locations', () => {
      const events = [
        makeEvent({ location: '  Starbucks, Main St  ' }),
        makeEvent({ location: '  Starbucks, Main St  ' }),
      ];
      const result = extractFavoritePlaces(events);
      expect(result.places).toHaveLength(1);
      expect(result.places[0].visitCount).toBe(2);
    });

    it('should treat different casing as different locations', () => {
      // The source trims but does NOT lowercase before counting
      const events = [
        makeEvent({ location: 'Starbucks' }),
        makeEvent({ location: 'starbucks' }),
      ];
      const result = extractFavoritePlaces(events);
      expect(result.places).toHaveLength(2);
    });

    it('should count eventsWithLocations correctly with mixed events', () => {
      const events = [
        makeEvent({ title: 'Call', location: undefined }),
        makeEvent({ title: 'Lunch', location: 'Chipotle' }),
        makeEvent({ title: 'Meeting', location: undefined }),
        makeEvent({ title: 'Dinner', location: 'Olive Garden' }),
      ];
      const result = extractFavoritePlaces(events);
      expect(result.eventsWithLocations).toBe(2);
    });
  });

  // ---------------------------------------------------------------
  // analyzeBusiestDays
  // ---------------------------------------------------------------
  describe('analyzeBusiestDays', () => {
    it('should return empty array for no events', () => {
      expect(analyzeBusiestDays([])).toEqual([]);
    });

    it('should skip all-day events', () => {
      const events = [
        makeEvent({ startTime: '2025-09-15T10:00:00Z', isAllDay: true }),
        makeEvent({ startTime: '2025-09-15T10:00:00Z', isAllDay: true }),
      ];
      expect(analyzeBusiestDays(events)).toEqual([]);
    });

    it('should identify the busiest day', () => {
      // 2025-09-15 is a Monday
      const events = [
        makeEvent({ startTime: '2025-09-15T10:00:00Z' }), // Monday
        makeEvent({ startTime: '2025-09-15T14:00:00Z' }), // Monday
        makeEvent({ startTime: '2025-09-15T16:00:00Z' }), // Monday
        makeEvent({ startTime: '2025-09-16T10:00:00Z' }), // Tuesday
      ];
      const result = analyzeBusiestDays(events);
      expect(result[0]).toBe('Monday');
    });

    it('should return at most 3 busiest days', () => {
      const events = [
        makeEvent({ startTime: '2025-09-15T10:00:00Z' }), // Monday
        makeEvent({ startTime: '2025-09-16T10:00:00Z' }), // Tuesday
        makeEvent({ startTime: '2025-09-17T10:00:00Z' }), // Wednesday
        makeEvent({ startTime: '2025-09-18T10:00:00Z' }), // Thursday
        makeEvent({ startTime: '2025-09-19T10:00:00Z' }), // Friday
      ];
      const result = analyzeBusiestDays(events);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should sort by event count descending', () => {
      const events = [
        // Tuesday (1 event)
        makeEvent({ startTime: '2025-09-16T10:00:00Z' }),
        // Wednesday (3 events)
        makeEvent({ startTime: '2025-09-17T09:00:00Z' }),
        makeEvent({ startTime: '2025-09-17T12:00:00Z' }),
        makeEvent({ startTime: '2025-09-17T15:00:00Z' }),
        // Thursday (2 events)
        makeEvent({ startTime: '2025-09-18T10:00:00Z' }),
        makeEvent({ startTime: '2025-09-18T14:00:00Z' }),
      ];
      const result = analyzeBusiestDays(events);
      expect(result[0]).toBe('Wednesday');
      expect(result[1]).toBe('Thursday');
      expect(result[2]).toBe('Tuesday');
    });

    it('should handle weekend days correctly', () => {
      // 2025-09-14 is a Sunday, 2025-09-13 is a Saturday
      const events = [
        makeEvent({ startTime: '2025-09-14T10:00:00Z' }), // Sunday
        makeEvent({ startTime: '2025-09-14T14:00:00Z' }), // Sunday
        makeEvent({ startTime: '2025-09-13T10:00:00Z' }), // Saturday
      ];
      const result = analyzeBusiestDays(events);
      expect(result[0]).toBe('Sunday');
      expect(result[1]).toBe('Saturday');
    });

    it('should use correct DAY_NAMES mapping', () => {
      expect(DAY_NAMES).toEqual([
        'Sunday', 'Monday', 'Tuesday', 'Wednesday',
        'Thursday', 'Friday', 'Saturday',
      ]);
    });

    it('should count events from different weeks on the same weekday together', () => {
      // Two Mondays in different weeks
      const events = [
        makeEvent({ startTime: '2025-09-15T10:00:00Z' }), // Monday week 1
        makeEvent({ startTime: '2025-09-22T10:00:00Z' }), // Monday week 2
        makeEvent({ startTime: '2025-09-16T10:00:00Z' }), // Tuesday week 1
      ];
      const result = analyzeBusiestDays(events);
      expect(result[0]).toBe('Monday');
    });

    it('should mix all-day and timed events, counting only timed ones', () => {
      const events = [
        makeEvent({ startTime: '2025-09-15T10:00:00Z', isAllDay: false }), // Monday counted
        makeEvent({ startTime: '2025-09-15T10:00:00Z', isAllDay: true }),  // Monday skipped
        makeEvent({ startTime: '2025-09-16T10:00:00Z', isAllDay: false }), // Tuesday counted
        makeEvent({ startTime: '2025-09-16T14:00:00Z', isAllDay: false }), // Tuesday counted
      ];
      const result = analyzeBusiestDays(events);
      expect(result[0]).toBe('Tuesday');
      expect(result[1]).toBe('Monday');
    });
  });

  // ---------------------------------------------------------------
  // mapGoogleToLoopCategories
  // ---------------------------------------------------------------
  describe('mapGoogleToLoopCategories', () => {
    it('should return empty array for empty input', () => {
      expect(mapGoogleToLoopCategories([])).toEqual([]);
    });

    it('should return empty array when no categories match', () => {
      expect(mapGoogleToLoopCategories(['unknown', 'random', 'misc'])).toEqual([]);
    });

    it('should filter to only known Loop categories', () => {
      const input = ['coffee', 'dining', 'unknown', 'fitness'];
      const result = mapGoogleToLoopCategories(input);
      expect(result).toEqual(['coffee', 'dining', 'fitness']);
    });

    it('should include all 12 Loop categories when all are present', () => {
      const allCategories = [
        'coffee', 'dining', 'live music', 'nightlife',
        'fitness', 'outdoors', 'art', 'shopping',
        'movies', 'sports', 'wellness', 'culture',
      ];
      const result = mapGoogleToLoopCategories(allCategories);
      expect(result).toEqual(allCategories);
      expect(result).toHaveLength(12);
    });

    it('should preserve Loop category order regardless of input order', () => {
      const input = ['wellness', 'coffee', 'art'];
      const result = mapGoogleToLoopCategories(input);
      // LOOP_CATEGORIES order: coffee, dining, live music, nightlife, fitness, outdoors, art, shopping, movies, sports, wellness, culture
      expect(result).toEqual(['coffee', 'art', 'wellness']);
    });

    it('should exclude categories not in Loop predefined list', () => {
      // These are in EVENT_KEYWORD_MAPPING but not in LOOP_CATEGORIES
      const input = ['food', 'cafe', 'nature', 'parks', 'museums', 'self-care', 'drinks', 'community', 'social', 'travel', 'gym'];
      const result = mapGoogleToLoopCategories(input);
      expect(result).toEqual([]);
    });

    it('should handle single matching category', () => {
      expect(mapGoogleToLoopCategories(['movies'])).toEqual(['movies']);
    });

    it('should handle duplicate inputs gracefully (returns each once)', () => {
      const input = ['coffee', 'coffee', 'dining'];
      const result = mapGoogleToLoopCategories(input);
      // filter doesn't deduplicate but since LOOP_CATEGORIES is unique,
      // each Loop category only appears once in the result
      expect(result).toEqual(['coffee', 'dining']);
    });
  });

  // ---------------------------------------------------------------
  // mergeExtractedInterests
  // ---------------------------------------------------------------
  describe('mergeExtractedInterests', () => {
    const makeGoogleData = (overrides: Partial<ExtractedGoogleData> = {}): ExtractedGoogleData => ({
      interests: overrides.interests || [],
      categories: overrides.categories || [],
      favoritePlaces: overrides.favoritePlaces || [],
      calendarEvents: overrides.calendarEvents || [],
      scheduleSummary: overrides.scheduleSummary || {
        totalEvents: 0,
        eventsWithLocations: 0,
        busiestDays: [],
        typicalFreeSlots: [],
      },
    });

    it('should return empty arrays when both inputs are null', () => {
      const result = mergeExtractedInterests(null, null);
      expect(result.interests).toEqual([]);
      expect(result.categories).toEqual([]);
    });

    it('should return Google data when Facebook is null', () => {
      const google = makeGoogleData({
        interests: ['yoga', 'coffee'],
        categories: ['fitness', 'coffee'],
      });
      const result = mergeExtractedInterests(google, null);
      expect(result.interests).toEqual(['yoga', 'coffee']);
      expect(result.categories).toEqual(['fitness', 'coffee']);
    });

    it('should return Facebook data when Google is null', () => {
      const facebook = {
        interests: ['hiking', 'live music'],
        categories: ['outdoors', 'entertainment'],
      };
      const result = mergeExtractedInterests(null, facebook);
      expect(result.interests).toEqual(['hiking', 'live music']);
      expect(result.categories).toEqual(['outdoors', 'entertainment']);
    });

    it('should merge and deduplicate interests from both sources', () => {
      const google = makeGoogleData({
        interests: ['yoga', 'coffee', 'dinner'],
        categories: ['fitness', 'coffee', 'dining'],
      });
      const facebook = {
        interests: ['coffee', 'hiking'],
        categories: ['coffee', 'outdoors'],
      };
      const result = mergeExtractedInterests(google, facebook);
      expect(result.interests).toContain('yoga');
      expect(result.interests).toContain('coffee');
      expect(result.interests).toContain('dinner');
      expect(result.interests).toContain('hiking');
      expect(result.interests).toHaveLength(4); // no duplicates
      expect(result.categories).toContain('fitness');
      expect(result.categories).toContain('coffee');
      expect(result.categories).toContain('dining');
      expect(result.categories).toContain('outdoors');
      expect(result.categories).toHaveLength(4);
    });

    it('should cap interests at 100 items', () => {
      const manyInterests = Array.from({ length: 80 }, (_, i) => `interest_g_${i}`);
      const google = makeGoogleData({ interests: manyInterests, categories: [] });
      const fbInterests = Array.from({ length: 80 }, (_, i) => `interest_f_${i}`);
      const facebook = { interests: fbInterests, categories: [] };
      const result = mergeExtractedInterests(google, facebook);
      expect(result.interests.length).toBe(100);
    });

    it('should NOT cap categories', () => {
      const manyCategories = Array.from({ length: 50 }, (_, i) => `cat_g_${i}`);
      const google = makeGoogleData({ interests: [], categories: manyCategories });
      const fbCategories = Array.from({ length: 50 }, (_, i) => `cat_f_${i}`);
      const facebook = { interests: [], categories: fbCategories };
      const result = mergeExtractedInterests(google, facebook);
      expect(result.categories.length).toBe(100); // all unique, no cap
    });

    it('should handle empty arrays in both sources', () => {
      const google = makeGoogleData({ interests: [], categories: [] });
      const facebook = { interests: [], categories: [] };
      const result = mergeExtractedInterests(google, facebook);
      expect(result.interests).toEqual([]);
      expect(result.categories).toEqual([]);
    });

    it('should handle Google with data and Facebook with empty arrays', () => {
      const google = makeGoogleData({
        interests: ['gym'],
        categories: ['fitness'],
      });
      const facebook = { interests: [], categories: [] };
      const result = mergeExtractedInterests(google, facebook);
      expect(result.interests).toEqual(['gym']);
      expect(result.categories).toEqual(['fitness']);
    });
  });

  // ---------------------------------------------------------------
  // Integration-style tests: full pipeline
  // ---------------------------------------------------------------
  describe('Full extraction pipeline (integration)', () => {
    it('should handle a realistic set of calendar events', () => {
      const events: CalendarEvent[] = [
        makeEvent({ id: '1', title: 'Morning Yoga', location: 'CorePower Yoga, Dallas', startTime: '2025-09-15T07:00:00Z' }),
        makeEvent({ id: '2', title: 'Team Lunch', location: 'Chipotle, Plano', startTime: '2025-09-15T12:00:00Z' }),
        makeEvent({ id: '3', title: 'Concert at House of Blues', startTime: '2025-09-15T20:00:00Z' }),
        makeEvent({ id: '4', title: 'Morning Coffee', location: 'Starbucks, Dallas', startTime: '2025-09-16T08:00:00Z' }),
        makeEvent({ id: '5', title: 'Morning Coffee', location: 'Starbucks, Dallas', startTime: '2025-09-17T08:00:00Z' }),
        makeEvent({ id: '6', title: 'Birthday Party', location: 'TopGolf, Allen', startTime: '2025-09-20T18:00:00Z' }),
        makeEvent({ id: '7', title: 'All Day Conference', startTime: '2025-09-18T00:00:00Z', isAllDay: true }),
        makeEvent({ id: '8', title: 'Gym Session', location: 'Planet Fitness, Richardson', startTime: '2025-09-16T17:00:00Z' }),
        makeEvent({ id: '9', title: 'Hike at Cedar Ridge', location: 'Cedar Ridge Preserve Park', startTime: '2025-09-21T09:00:00Z' }),
      ];

      // Test categories & interests
      const catResult = extractCategoriesAndInterests(events);
      expect(catResult.interests).toContain('yoga');
      expect(catResult.interests).toContain('lunch');
      expect(catResult.interests).toContain('concert');
      expect(catResult.interests).toContain('coffee');
      expect(catResult.interests).toContain('birthday');
      expect(catResult.interests).toContain('party');
      expect(catResult.interests).toContain('gym');
      expect(catResult.interests).toContain('hike');
      expect(catResult.categories).toContain('fitness');
      expect(catResult.categories).toContain('wellness');
      expect(catResult.categories).toContain('dining');
      expect(catResult.categories).toContain('live music');
      expect(catResult.categories).toContain('coffee');
      expect(catResult.categories).toContain('social');
      expect(catResult.categories).toContain('outdoors');

      // Test favorite places
      const placesResult = extractFavoritePlaces(events);
      expect(placesResult.eventsWithLocations).toBe(7);
      // Starbucks visited twice, should be first
      expect(placesResult.places[0].name).toBe('Starbucks');
      expect(placesResult.places[0].visitCount).toBe(2);
      expect(placesResult.places[0].category).toBe('coffee');

      // Planet Fitness should have fitness category
      const planetFitness = placesResult.places.find(p => p.name === 'Planet Fitness');
      expect(planetFitness).toBeDefined();
      expect(planetFitness?.category).toBe('fitness');

      // Cedar Ridge Preserve Park should have outdoors category
      const park = placesResult.places.find(p => p.name === 'Cedar Ridge Preserve Park');
      expect(park).toBeDefined();
      expect(park?.category).toBe('outdoors');

      // Test busiest days
      const busiestDays = analyzeBusiestDays(events);
      // Monday (3 events: yoga, lunch, concert), Tuesday (2: coffee, gym) => Monday should be first
      expect(busiestDays[0]).toBe('Monday');
    });

    it('should handle completely empty calendar', () => {
      const events: CalendarEvent[] = [];
      const catResult = extractCategoriesAndInterests(events);
      const placesResult = extractFavoritePlaces(events);
      const busiestDays = analyzeBusiestDays(events);

      expect(catResult.categories).toEqual([]);
      expect(catResult.interests).toEqual([]);
      expect(placesResult.places).toEqual([]);
      expect(placesResult.eventsWithLocations).toBe(0);
      expect(busiestDays).toEqual([]);
    });

    it('should handle events with only generic titles and no locations', () => {
      const events = [
        makeEvent({ title: 'Meeting with John' }),
        makeEvent({ title: 'Sync call' }),
        makeEvent({ title: '1:1 with manager' }),
        makeEvent({ title: 'Sprint planning' }),
      ];
      const catResult = extractCategoriesAndInterests(events);
      const placesResult = extractFavoritePlaces(events);

      expect(catResult.categories).toEqual([]);
      expect(catResult.interests).toEqual([]);
      expect(placesResult.places).toEqual([]);
    });

    it('should correctly map extracted categories to Loop categories', () => {
      const events = [
        makeEvent({ title: 'Yoga class', location: 'Studio Yoga' }),
        makeEvent({ title: 'Coffee with Alice' }),
        makeEvent({ title: 'Museum visit', location: 'Dallas Museum of Art' }),
        makeEvent({ title: 'Shopping trip', location: 'NorthPark Mall' }),
      ];
      const catResult = extractCategoriesAndInterests(events);
      const loopCategories = mapGoogleToLoopCategories(catResult.categories);

      expect(loopCategories).toContain('fitness');
      expect(loopCategories).toContain('wellness');
      expect(loopCategories).toContain('coffee');
      expect(loopCategories).toContain('art');
      expect(loopCategories).toContain('culture');
      expect(loopCategories).toContain('shopping');

      // These should be excluded (in extraction but not LOOP_CATEGORIES):
      // 'cafe', 'self-care', 'museums' are not Loop categories
      expect(loopCategories).not.toContain('cafe');
      expect(loopCategories).not.toContain('museums');
    });
  });

  // ---------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------
  describe('Edge cases', () => {
    it('should handle event titles with special characters', () => {
      const events = [makeEvent({ title: '***YOGA*** @ 6am!!!' })];
      const result = extractCategoriesAndInterests(events);
      expect(result.interests).toContain('yoga');
    });

    it('should handle very long event titles', () => {
      const longTitle = 'a'.repeat(1000) + ' coffee ' + 'b'.repeat(1000);
      const events = [makeEvent({ title: longTitle })];
      const result = extractCategoriesAndInterests(events);
      expect(result.interests).toContain('coffee');
    });

    it('should handle empty string title', () => {
      const events = [makeEvent({ title: '' })];
      const result = extractCategoriesAndInterests(events);
      expect(result.interests).toEqual([]);
      expect(result.categories).toEqual([]);
    });

    it('should handle location that is empty string', () => {
      // In source, empty string is truthy, so it would be processed
      const events = [makeEvent({ title: 'Meeting', location: '' })];
      const placesResult = extractFavoritePlaces(events);
      // empty string is falsy, so it should not count
      expect(placesResult.eventsWithLocations).toBe(0);
    });

    it('should handle events with invalid startTime for busiest days', () => {
      const events = [makeEvent({ startTime: 'not-a-date', isAllDay: false })];
      // new Date('not-a-date').getDay() returns NaN
      const result = analyzeBusiestDays(events);
      // NaN key won't map to DAY_NAMES, resulting in 'undefined' string
      expect(result).toHaveLength(1);
    });

    it('should handle location with only commas', () => {
      const events = [makeEvent({ location: ',,,' })];
      const result = extractFavoritePlaces(events);
      expect(result.places).toHaveLength(1);
      expect(result.places[0].name).toBe(''); // split on comma gives empty first element
    });

    it('should handle mergeExtractedInterests with exactly 100 Google interests', () => {
      const google: ExtractedGoogleData = {
        interests: Array.from({ length: 100 }, (_, i) => `g_${i}`),
        categories: [],
        favoritePlaces: [],
        calendarEvents: [],
        scheduleSummary: { totalEvents: 0, eventsWithLocations: 0, busiestDays: [], typicalFreeSlots: [] },
      };
      const result = mergeExtractedInterests(google, null);
      expect(result.interests).toHaveLength(100);
    });

    it('should handle mergeExtractedInterests where Google has 99 unique + 1 overlapping with Facebook', () => {
      const google: ExtractedGoogleData = {
        interests: Array.from({ length: 99 }, (_, i) => `g_${i}`).concat(['shared']),
        categories: [],
        favoritePlaces: [],
        calendarEvents: [],
        scheduleSummary: { totalEvents: 0, eventsWithLocations: 0, busiestDays: [], typicalFreeSlots: [] },
      };
      const facebook = { interests: ['shared', 'fb_unique'], categories: [] };
      const result = mergeExtractedInterests(google, facebook);
      // 99 unique google + 'shared' (deduped) + 'fb_unique' = 101, capped at 100
      expect(result.interests).toHaveLength(100);
      // 'shared' should appear once
      expect(result.interests.filter(i => i === 'shared')).toHaveLength(1);
    });
  });
});
