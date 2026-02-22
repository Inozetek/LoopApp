/**
 * Estimated Activity Durations by Category
 * Used by the time slot engine to determine how long activities typically take.
 * Values are in minutes. Each category has a typical and minimum duration.
 */

export interface DurationEstimate {
  /** Typical visit duration in minutes */
  typical: number;
  /** Minimum reasonable duration in minutes */
  minimum: number;
  /** Maximum typical duration in minutes */
  maximum: number;
}

/** Duration estimates per activity category (lowercase keys) */
export const ACTIVITY_DURATIONS: Record<string, DurationEstimate> = {
  // Dining
  dining: { typical: 75, minimum: 45, maximum: 120 },
  restaurant: { typical: 75, minimum: 45, maximum: 120 },
  fine_dining: { typical: 120, minimum: 90, maximum: 180 },
  fast_food: { typical: 30, minimum: 20, maximum: 45 },

  // Coffee & Cafes
  coffee: { typical: 45, minimum: 20, maximum: 90 },
  'coffee & cafes': { typical: 45, minimum: 20, maximum: 90 },
  cafe: { typical: 45, minimum: 20, maximum: 90 },
  bakery: { typical: 30, minimum: 15, maximum: 60 },

  // Bars & Nightlife
  bars: { typical: 90, minimum: 45, maximum: 180 },
  'bars & nightlife': { typical: 90, minimum: 45, maximum: 180 },
  nightlife: { typical: 120, minimum: 60, maximum: 240 },
  bar: { typical: 90, minimum: 45, maximum: 180 },

  // Live Music & Entertainment
  'live music': { typical: 150, minimum: 90, maximum: 240 },
  live_music: { typical: 150, minimum: 90, maximum: 240 },
  entertainment: { typical: 120, minimum: 60, maximum: 180 },
  concert: { typical: 180, minimum: 120, maximum: 300 },
  theater: { typical: 150, minimum: 120, maximum: 180 },
  comedy: { typical: 90, minimum: 60, maximum: 120 },

  // Fitness & Sports
  fitness: { typical: 60, minimum: 30, maximum: 120 },
  gym: { typical: 60, minimum: 30, maximum: 120 },
  sports: { typical: 90, minimum: 60, maximum: 180 },
  yoga: { typical: 60, minimum: 45, maximum: 90 },

  // Outdoor Activities
  'outdoor activities': { typical: 120, minimum: 60, maximum: 240 },
  outdoors: { typical: 120, minimum: 60, maximum: 240 },
  hiking: { typical: 180, minimum: 90, maximum: 360 },
  park: { typical: 60, minimum: 30, maximum: 180 },
  beach: { typical: 150, minimum: 60, maximum: 300 },

  // Arts & Culture
  'arts & culture': { typical: 90, minimum: 45, maximum: 180 },
  arts: { typical: 90, minimum: 45, maximum: 180 },
  museum: { typical: 120, minimum: 60, maximum: 180 },
  gallery: { typical: 60, minimum: 30, maximum: 120 },

  // Shopping
  shopping: { typical: 60, minimum: 30, maximum: 180 },
  mall: { typical: 90, minimum: 45, maximum: 180 },

  // Movies
  movies: { typical: 150, minimum: 120, maximum: 180 },
  cinema: { typical: 150, minimum: 120, maximum: 180 },

  // Wellness
  wellness: { typical: 75, minimum: 45, maximum: 150 },
  spa: { typical: 90, minimum: 60, maximum: 180 },

  // Events
  events: { typical: 120, minimum: 60, maximum: 240 },
  festival: { typical: 180, minimum: 120, maximum: 480 },
  workshop: { typical: 90, minimum: 60, maximum: 120 },

  // Travel
  travel: { typical: 120, minimum: 60, maximum: 480 },
  attraction: { typical: 90, minimum: 45, maximum: 180 },

  // Family
  family: { typical: 90, minimum: 45, maximum: 180 },

  // Default fallback
  other: { typical: 60, minimum: 30, maximum: 120 },
};

/** Minimum free time gap to consider schedulable (minutes) */
export const MIN_SCHEDULABLE_GAP = 45;

/** Default travel buffer between events (minutes) */
export const DEFAULT_TRAVEL_BUFFER = 15;

/** Maximum travel buffer (minutes) — for far-away events */
export const MAX_TRAVEL_BUFFER = 45;

/**
 * Get the estimated duration for an activity category.
 * Falls back to 'other' if category not found.
 */
export function getEstimatedDuration(category: string): DurationEstimate {
  const key = category.toLowerCase();
  return ACTIVITY_DURATIONS[key] || ACTIVITY_DURATIONS.other;
}
