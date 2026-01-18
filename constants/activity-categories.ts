/**
 * Activity Categories Configuration
 *
 * Aligned with:
 * - Google Places API types
 * - Ticketmaster categories
 * - Loop recommendation engine
 *
 * Total: 42 categories across 6 major groups
 */

export interface ActivityCategory {
  id: string;
  name: string;
  icon: string; // Emoji or icon name
  group: 'food' | 'entertainment' | 'fitness' | 'culture' | 'shopping' | 'outdoor';
  googlePlacesTypes?: string[]; // Corresponding Google Places API types
  ticketmasterGenres?: string[]; // Corresponding Ticketmaster genres
  description: string;
}

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  // FOOD & DRINK (12 categories)
  {
    id: 'restaurant',
    name: 'Restaurants',
    icon: '🍽️',
    group: 'food',
    googlePlacesTypes: ['restaurant', 'food'],
    description: 'Fine dining, casual eats, all cuisines',
  },
  {
    id: 'cafe',
    name: 'Cafes & Coffee',
    icon: '☕',
    group: 'food',
    googlePlacesTypes: ['cafe', 'coffee_shop'],
    description: 'Coffee shops, tea houses, cafes',
  },
  {
    id: 'bar',
    name: 'Bars & Pubs',
    icon: '🍺',
    group: 'food',
    googlePlacesTypes: ['bar', 'night_club'],
    description: 'Bars, pubs, breweries, wine bars',
  },
  {
    id: 'bakery',
    name: 'Bakeries',
    icon: '🥐',
    group: 'food',
    googlePlacesTypes: ['bakery'],
    description: 'Bakeries, pastry shops, dessert spots',
  },
  {
    id: 'brunch',
    name: 'Brunch Spots',
    icon: '🥞',
    group: 'food',
    googlePlacesTypes: ['restaurant'],
    description: 'Weekend brunch, breakfast places',
  },
  {
    id: 'fast_food',
    name: 'Quick Bites',
    icon: '🍔',
    group: 'food',
    googlePlacesTypes: ['meal_takeaway', 'fast_food'],
    description: 'Fast food, food trucks, quick service',
  },
  {
    id: 'ice_cream',
    name: 'Ice Cream',
    icon: '🍦',
    group: 'food',
    googlePlacesTypes: ['ice_cream'],
    description: 'Ice cream, frozen yogurt, gelato',
  },
  {
    id: 'food_truck',
    name: 'Food Trucks',
    icon: '🚚',
    group: 'food',
    googlePlacesTypes: ['food'],
    description: 'Food trucks, street food',
  },

  // ENTERTAINMENT (14 categories)
  {
    id: 'live_music',
    name: 'Live Music',
    icon: '🎵',
    group: 'entertainment',
    googlePlacesTypes: ['night_club', 'bar'],
    ticketmasterGenres: ['Music', 'Rock', 'Pop', 'Jazz', 'Country'],
    description: 'Concerts, live music venues, music festivals',
  },
  {
    id: 'concerts',
    name: 'Concerts',
    icon: '🎤',
    group: 'entertainment',
    ticketmasterGenres: ['Music'],
    description: 'Large concerts, stadium shows, tours',
  },
  {
    id: 'theater',
    name: 'Theater & Plays',
    icon: '🎭',
    group: 'entertainment',
    googlePlacesTypes: ['movie_theater'],
    ticketmasterGenres: ['Theatre'],
    description: 'Plays, musicals, theatrical performances',
  },
  {
    id: 'comedy',
    name: 'Comedy Shows',
    icon: '😂',
    group: 'entertainment',
    googlePlacesTypes: ['night_club'],
    ticketmasterGenres: ['Comedy'],
    description: 'Stand-up comedy, improv shows',
  },
  {
    id: 'movies',
    name: 'Movie Theaters',
    icon: '🎬',
    group: 'entertainment',
    googlePlacesTypes: ['movie_theater'],
    description: 'Movie theaters, cinema',
  },
  {
    id: 'sports',
    name: 'Sports Events',
    icon: '🏀',
    group: 'entertainment',
    googlePlacesTypes: ['stadium'],
    ticketmasterGenres: ['Sports'],
    description: 'Professional sports, games, matches',
  },
  {
    id: 'nightlife',
    name: 'Nightlife & Clubs',
    icon: '🕺',
    group: 'entertainment',
    googlePlacesTypes: ['night_club'],
    description: 'Nightclubs, dance clubs, DJ sets',
  },
  {
    id: 'karaoke',
    name: 'Karaoke',
    icon: '🎤',
    group: 'entertainment',
    googlePlacesTypes: ['night_club', 'bar'],
    description: 'Karaoke bars, singing lounges',
  },
  {
    id: 'trivia',
    name: 'Trivia Nights',
    icon: '❓',
    group: 'entertainment',
    googlePlacesTypes: ['bar'],
    description: 'Pub trivia, quiz nights',
  },
  {
    id: 'festivals',
    name: 'Festivals',
    icon: '🎪',
    group: 'entertainment',
    ticketmasterGenres: ['Festival'],
    description: 'Music festivals, cultural festivals, fairs',
  },

  // FITNESS & WELLNESS (6 categories)
  {
    id: 'gym',
    name: 'Gyms & Fitness',
    icon: '💪',
    group: 'fitness',
    googlePlacesTypes: ['gym'],
    description: 'Gyms, fitness centers, workout classes',
  },
  {
    id: 'yoga',
    name: 'Yoga & Pilates',
    icon: '🧘',
    group: 'fitness',
    googlePlacesTypes: ['gym'],
    description: 'Yoga studios, pilates classes',
  },
  {
    id: 'running',
    name: 'Running & Cycling',
    icon: '🏃',
    group: 'fitness',
    googlePlacesTypes: ['park'],
    description: 'Running trails, cycling routes, marathons',
  },
  {
    id: 'sports_recreation',
    name: 'Sports & Recreation',
    icon: '⚽',
    group: 'fitness',
    googlePlacesTypes: ['stadium', 'park'],
    description: 'Tennis, basketball, recreational sports',
  },
  {
    id: 'spa',
    name: 'Spa & Wellness',
    icon: '💆',
    group: 'fitness',
    googlePlacesTypes: ['spa', 'beauty_salon'],
    description: 'Spas, massage, wellness centers',
  },

  // CULTURE & LEARNING (6 categories)
  {
    id: 'museum',
    name: 'Museums',
    icon: '🏛️',
    group: 'culture',
    googlePlacesTypes: ['museum'],
    description: 'Art museums, history museums, exhibits',
  },
  {
    id: 'art_gallery',
    name: 'Art Galleries',
    icon: '🖼️',
    group: 'culture',
    googlePlacesTypes: ['art_gallery'],
    description: 'Art galleries, contemporary art, exhibitions',
  },
  {
    id: 'library',
    name: 'Libraries',
    icon: '📚',
    group: 'culture',
    googlePlacesTypes: ['library'],
    description: 'Public libraries, bookstores, reading events',
  },
  {
    id: 'bookstore',
    name: 'Bookstores',
    icon: '📖',
    group: 'culture',
    googlePlacesTypes: ['book_store'],
    description: 'Bookstores, book clubs, author events',
  },
  {
    id: 'workshop',
    name: 'Workshops & Classes',
    icon: '🎨',
    group: 'culture',
    description: 'Art classes, cooking classes, DIY workshops',
  },
  {
    id: 'lectures',
    name: 'Lectures & Talks',
    icon: '🎓',
    group: 'culture',
    description: 'Guest lectures, TED talks, panel discussions',
  },

  // OUTDOOR & NATURE (5 categories)
  {
    id: 'parks',
    name: 'Parks & Gardens',
    icon: '🌳',
    group: 'outdoor',
    googlePlacesTypes: ['park'],
    description: 'City parks, botanical gardens, green spaces',
  },
  {
    id: 'hiking',
    name: 'Hiking & Trails',
    icon: '🥾',
    group: 'outdoor',
    googlePlacesTypes: ['park'],
    description: 'Hiking trails, nature walks, outdoor exploration',
  },
  {
    id: 'beach',
    name: 'Beach & Waterfront',
    icon: '🏖️',
    group: 'outdoor',
    description: 'Beaches, lakefronts, waterfront activities',
  },
  {
    id: 'camping',
    name: 'Camping & Outdoors',
    icon: '⛺',
    group: 'outdoor',
    googlePlacesTypes: ['campground'],
    description: 'Camping, outdoor adventures',
  },
  {
    id: 'bike_trails',
    name: 'Bike Trails',
    icon: '🚴',
    group: 'outdoor',
    googlePlacesTypes: ['park'],
    description: 'Biking trails, cycling routes',
  },

  // SHOPPING & OTHER (4 categories)
  {
    id: 'shopping',
    name: 'Shopping',
    icon: '🛍️',
    group: 'shopping',
    googlePlacesTypes: ['shopping_mall', 'store'],
    description: 'Shopping malls, boutiques, retail therapy',
  },
  {
    id: 'markets',
    name: 'Markets & Fairs',
    icon: '🛒',
    group: 'shopping',
    googlePlacesTypes: ['store'],
    description: 'Farmers markets, flea markets, craft fairs',
  },
  {
    id: 'vintage',
    name: 'Vintage & Thrift',
    icon: '👗',
    group: 'shopping',
    googlePlacesTypes: ['store', 'clothing_store'],
    description: 'Thrift stores, vintage shops, antique markets',
  },
  {
    id: 'tourist_attractions',
    name: 'Tourist Attractions',
    icon: '📸',
    group: 'outdoor',
    googlePlacesTypes: ['tourist_attraction'],
    description: 'Landmarks, sightseeing, attractions',
  },
];

/**
 * Group categories by major group
 */
export const CATEGORY_GROUPS: Record<
  string,
  { name: string; icon: string; categories: ActivityCategory[] }
> = {
  food: {
    name: 'Food & Drink',
    icon: '🍽️',
    categories: ACTIVITY_CATEGORIES.filter((c) => c.group === 'food'),
  },
  entertainment: {
    name: 'Entertainment',
    icon: '🎭',
    categories: ACTIVITY_CATEGORIES.filter((c) => c.group === 'entertainment'),
  },
  fitness: {
    name: 'Fitness & Wellness',
    icon: '💪',
    categories: ACTIVITY_CATEGORIES.filter((c) => c.group === 'fitness'),
  },
  culture: {
    name: 'Culture & Learning',
    icon: '🎨',
    categories: ACTIVITY_CATEGORIES.filter((c) => c.group === 'culture'),
  },
  outdoor: {
    name: 'Outdoor & Nature',
    icon: '🌳',
    categories: ACTIVITY_CATEGORIES.filter((c) => c.group === 'outdoor'),
  },
  shopping: {
    name: 'Shopping',
    icon: '🛍️',
    categories: ACTIVITY_CATEGORIES.filter((c) => c.group === 'shopping'),
  },
};

/**
 * Get category by ID
 */
export function getCategoryById(id: string): ActivityCategory | undefined {
  return ACTIVITY_CATEGORIES.find((cat) => cat.id === id);
}

/**
 * Get category by Google Places type
 */
export function getCategoryByGoogleType(type: string): ActivityCategory | undefined {
  return ACTIVITY_CATEGORIES.find((cat) =>
    cat.googlePlacesTypes?.includes(type)
  );
}

/**
 * Get category by Ticketmaster genre
 */
export function getCategoryByTicketmasterGenre(
  genre: string
): ActivityCategory | undefined {
  return ACTIVITY_CATEGORIES.find((cat) =>
    cat.ticketmasterGenres?.some((g) =>
      g.toLowerCase().includes(genre.toLowerCase())
    )
  );
}

/**
 * Get popular categories (for default suggestions)
 */
export const POPULAR_CATEGORIES = [
  'restaurant',
  'cafe',
  'bar',
  'live_music',
  'movies',
  'parks',
  'gym',
  'museum',
  'brunch',
  'shopping',
];

/**
 * =============================================================================
 * UNIFIED INTEREST TAXONOMY
 * =============================================================================
 *
 * Maps user-friendly interest labels (shown in onboarding) to category IDs.
 * This is the SINGLE SOURCE OF TRUTH for interest/category mapping.
 *
 * Usage:
 * - Onboarding UI shows: INTEREST_GROUPS keys (e.g., "Dining", "Fitness")
 * - Database stores: INTEREST_GROUPS keys in users.interests[]
 * - Recommendations use: mapInterestsToCategoryIds() to get category IDs
 */

export interface InterestGroup {
  label: string;           // User-facing label (e.g., "Dining")
  icon: string;            // Emoji for UI
  description: string;     // Short description
  categoryIds: string[];   // Mapped category IDs from ACTIVITY_CATEGORIES
}

/**
 * Interest groups for onboarding - maps user-friendly labels to category IDs
 * These are the 18 interests shown during onboarding
 */
export const INTEREST_GROUPS: Record<string, InterestGroup> = {
  'Dining': {
    label: 'Dining',
    icon: '🍽️',
    description: 'Restaurants and food experiences',
    categoryIds: ['restaurant', 'brunch', 'fast_food', 'food_truck'],
  },
  'Coffee & Cafes': {
    label: 'Coffee & Cafes',
    icon: '☕',
    description: 'Coffee shops and cafes',
    categoryIds: ['cafe', 'bakery'],
  },
  'Bars & Nightlife': {
    label: 'Bars & Nightlife',
    icon: '🍺',
    description: 'Bars, pubs, and nightclubs',
    categoryIds: ['bar', 'nightlife'],
  },
  'Live Music': {
    label: 'Live Music',
    icon: '🎵',
    description: 'Concerts and live performances',
    categoryIds: ['live_music', 'concerts', 'festivals'],
  },
  'Entertainment': {
    label: 'Entertainment',
    icon: '🎭',
    description: 'Shows, movies, and fun activities',
    categoryIds: ['theater', 'comedy', 'movies', 'karaoke', 'trivia'],
  },
  'Sports': {
    label: 'Sports',
    icon: '🏀',
    description: 'Sports events and games',
    categoryIds: ['sports', 'sports_recreation'],
  },
  'Fitness': {
    label: 'Fitness',
    icon: '💪',
    description: 'Gyms, classes, and workouts',
    categoryIds: ['gym', 'yoga', 'running'],
  },
  'Wellness': {
    label: 'Wellness',
    icon: '💆',
    description: 'Spa, relaxation, and self-care',
    categoryIds: ['spa'],
  },
  'Arts & Culture': {
    label: 'Arts & Culture',
    icon: '🎨',
    description: 'Museums, galleries, and cultural experiences',
    categoryIds: ['museum', 'art_gallery', 'workshop', 'lectures'],
  },
  'Outdoor Activities': {
    label: 'Outdoor Activities',
    icon: '🌳',
    description: 'Parks, hiking, and nature',
    categoryIds: ['parks', 'hiking', 'beach', 'camping', 'bike_trails'],
  },
  'Shopping': {
    label: 'Shopping',
    icon: '🛍️',
    description: 'Retail therapy and markets',
    categoryIds: ['shopping', 'markets', 'vintage'],
  },
  'Movies': {
    label: 'Movies',
    icon: '🎬',
    description: 'Cinema and film experiences',
    categoryIds: ['movies'],
  },
  'Gaming': {
    label: 'Gaming',
    icon: '🎮',
    description: 'Video games and gaming events',
    categoryIds: ['trivia'], // Limited mapping - gaming venues not in Google Places
  },
  'Photography': {
    label: 'Photography',
    icon: '📸',
    description: 'Photo-worthy spots and tours',
    categoryIds: ['tourist_attractions', 'parks', 'art_gallery'],
  },
  'Food & Cooking': {
    label: 'Food & Cooking',
    icon: '👨‍🍳',
    description: 'Cooking classes and food experiences',
    categoryIds: ['workshop', 'restaurant', 'markets'],
  },
  'Technology': {
    label: 'Technology',
    icon: '💻',
    description: 'Tech events and meetups',
    categoryIds: ['lectures', 'workshop'],
  },
  'Reading': {
    label: 'Reading',
    icon: '📚',
    description: 'Bookstores and literary events',
    categoryIds: ['bookstore', 'library'],
  },
  'Travel': {
    label: 'Travel',
    icon: '✈️',
    description: 'Tourist attractions and exploration',
    categoryIds: ['tourist_attractions', 'museum', 'parks'],
  },
};

/**
 * Get the list of interest labels for onboarding UI
 */
export const ONBOARDING_INTERESTS = Object.keys(INTEREST_GROUPS);

/**
 * Convert user interests (labels) to category IDs for recommendations
 * @param interests Array of interest labels (e.g., ['Dining', 'Fitness'])
 * @returns Array of unique category IDs (e.g., ['restaurant', 'brunch', 'gym', 'yoga'])
 */
export function mapInterestsToCategoryIds(interests: string[]): string[] {
  const categoryIds = new Set<string>();

  for (const interest of interests) {
    const group = INTEREST_GROUPS[interest];
    if (group) {
      group.categoryIds.forEach(id => categoryIds.add(id));
    }
  }

  return Array.from(categoryIds);
}

/**
 * Convert category IDs back to interest labels
 * @param categoryIds Array of category IDs
 * @returns Array of matching interest labels
 */
export function mapCategoryIdsToInterests(categoryIds: string[]): string[] {
  const interests = new Set<string>();

  for (const [label, group] of Object.entries(INTEREST_GROUPS)) {
    const hasMatch = group.categoryIds.some(id => categoryIds.includes(id));
    if (hasMatch) {
      interests.add(label);
    }
  }

  return Array.from(interests);
}

/**
 * Get all category IDs that match a single interest
 */
export function getCategoryIdsForInterest(interest: string): string[] {
  return INTEREST_GROUPS[interest]?.categoryIds || [];
}

/**
 * Check if a category ID matches any of the user's interests
 */
export function categoryMatchesInterests(categoryId: string, interests: string[]): boolean {
  for (const interest of interests) {
    const group = INTEREST_GROUPS[interest];
    if (group?.categoryIds.includes(categoryId)) {
      return true;
    }
  }
  return false;
}

/**
 * Get interest group details by label
 */
export function getInterestGroup(label: string): InterestGroup | undefined {
  return INTEREST_GROUPS[label];
}
