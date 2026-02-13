/**
 * Google Data Extraction Service
 *
 * Extracts user schedule and activity patterns from Google Calendar after OAuth.
 * Uses calendar.readonly scope to access:
 * - Calendar events → schedule patterns, free time detection
 * - Event locations → frequently visited places and preferences
 * - Event categories → activity interest signals
 */

export interface GoogleUserProfile {
  id: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  photo?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  location?: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  status: string;
}

export interface ExtractedGoogleData {
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

/**
 * Map common event keywords to Loop activity categories
 */
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

/**
 * Map location keywords to Loop categories
 */
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
 * Extract schedule data and interests from user's Google Calendar
 * Called after successful Google Sign-In with calendar.readonly scope
 */
export async function extractGoogleInterests(
  accessToken: string
): Promise<ExtractedGoogleData> {
  console.log('Extracting data from Google Calendar...');

  const result: ExtractedGoogleData = {
    interests: [],
    categories: [],
    favoritePlaces: [],
    calendarEvents: [],
    scheduleSummary: {
      totalEvents: 0,
      eventsWithLocations: 0,
      busiestDays: [],
      typicalFreeSlots: [],
    },
  };

  try {
    const [events, profileData] = await Promise.all([
      fetchCalendarEvents(accessToken).catch(() => []),
      fetchGoogleProfile(accessToken).catch(() => null),
    ]);

    if (events.length > 0) {
      result.calendarEvents = events;
      result.scheduleSummary.totalEvents = events.length;

      // Extract categories from event titles
      const categorySet = new Set<string>();
      const interestSet = new Set<string>();

      for (const event of events) {
        const titleLower = event.title.toLowerCase();

        // Match event title keywords to categories
        for (const [keyword, categories] of Object.entries(EVENT_KEYWORD_MAPPING)) {
          if (titleLower.includes(keyword)) {
            categories.forEach(cat => categorySet.add(cat));
            interestSet.add(keyword);
          }
        }

        // Match location keywords to categories
        if (event.location) {
          const locationLower = event.location.toLowerCase();
          for (const [keyword, categories] of Object.entries(LOCATION_KEYWORD_MAPPING)) {
            if (locationLower.includes(keyword)) {
              categories.forEach(cat => categorySet.add(cat));
            }
          }
        }
      }

      result.categories = Array.from(categorySet);
      result.interests = Array.from(interestSet);

      // Extract favorite places from event locations
      const locationCounts = new Map<string, number>();
      for (const event of events) {
        if (event.location) {
          const loc = event.location.trim();
          locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1);
          result.scheduleSummary.eventsWithLocations++;
        }
      }

      // Sort by visit frequency, take top 15
      result.favoritePlaces = Array.from(locationCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([address, visitCount]) => {
          // Try to categorize the place
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

      // Analyze busiest days
      const dayCounts = new Map<number, number>();
      for (const event of events) {
        if (!event.isAllDay) {
          const day = new Date(event.startTime).getDay();
          dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
        }
      }
      result.scheduleSummary.busiestDays = Array.from(dayCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([day]) => DAY_NAMES[day]);

      console.log('Extracted Google Calendar data:', {
        events: events.length,
        categories: result.categories.length,
        places: result.favoritePlaces.length,
        busiestDays: result.scheduleSummary.busiestDays,
      });
    }

    return result;
  } catch (error) {
    console.error('Error extracting Google Calendar data:', error);
    return result;
  }
}

/**
 * Fetch user's Google profile
 */
async function fetchGoogleProfile(accessToken: string): Promise<GoogleUserProfile | null> {
  try {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      console.error('Google Profile API error:', await response.text());
      return null;
    }

    const data = await response.json();
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      givenName: data.given_name,
      familyName: data.family_name,
      photo: data.picture,
    };
  } catch (error) {
    console.error('Error fetching Google profile:', error);
    return null;
  }
}

/**
 * Fetch user's calendar events from the last 3 months + next month
 * Requires calendar.readonly scope
 */
async function fetchCalendarEvents(
  accessToken: string
): Promise<CalendarEvent[]> {
  try {
    // Look back 3 months for pattern detection, forward 1 month for upcoming schedule
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const oneMonthAhead = new Date(now);
    oneMonthAhead.setMonth(oneMonthAhead.getMonth() + 1);

    const timeMin = threeMonthsAgo.toISOString();
    const timeMax = oneMonthAhead.toISOString();

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `maxResults=500&` +
      `singleEvents=true&` +
      `orderBy=startTime`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      console.log('Google Calendar API error:', response.status, await response.text());
      return [];
    }

    const data = await response.json();
    const items = data.items || [];

    return items
      .filter((item: any) => item.status !== 'cancelled')
      .map((item: any) => ({
        id: item.id || '',
        title: item.summary || 'Untitled',
        location: item.location || undefined,
        startTime: item.start?.dateTime || item.start?.date || '',
        endTime: item.end?.dateTime || item.end?.date || '',
        isAllDay: !item.start?.dateTime,
        status: item.status || 'confirmed',
      }));
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return [];
  }
}

/**
 * Map extracted categories to Loop's predefined interest categories
 */
export function mapGoogleToLoopCategories(extractedCategories: string[]): string[] {
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
 * Merge Google and Facebook extracted interests
 */
export function mergeExtractedInterests(
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
