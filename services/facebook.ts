/**
 * Facebook Graph API Service
 * Extracts user interests, likes, and profile data after OAuth
 */

export interface FacebookUser {
  id: string;
  name: string;
  email: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

export interface FacebookLike {
  id: string;
  name: string;
  category?: string;
}

export interface FacebookInterest {
  id: string;
  name: string;
  category?: string;
}

export interface ExtractedInterests {
  interests: string[];
  categories: string[];
  favoriteActivities: string[];
}

/**
 * Map Facebook page categories to Loop activity categories
 */
const CATEGORY_MAPPING: Record<string, string[]> = {
  // Food & Dining
  'Restaurant': ['dining', 'food'],
  'Cafe': ['coffee', 'cafe'],
  'Food & Beverage': ['dining', 'food'],
  'Pizza Place': ['dining', 'food'],
  'Bar': ['nightlife', 'drinks'],
  'Brewery': ['drinks', 'nightlife'],
  'Coffee Shop': ['coffee', 'cafe'],

  // Entertainment
  'Movie Theater': ['movies', 'entertainment'],
  'Concert Venue': ['live music', 'entertainment', 'concerts'],
  'Music Venue': ['live music', 'entertainment'],
  'Comedy Club': ['entertainment', 'comedy'],
  'Theater': ['entertainment', 'theater'],
  'Art Gallery': ['art', 'culture'],
  'Museum': ['art', 'culture', 'museums'],

  // Recreation
  'Park': ['outdoors', 'nature', 'parks'],
  'Gym/Physical Fitness Center': ['fitness', 'gym'],
  'Sports Venue': ['sports'],
  'Outdoor Recreation': ['outdoors', 'recreation'],
  'Hiking Trail': ['hiking', 'outdoors'],

  // Shopping
  'Shopping Mall': ['shopping'],
  'Clothing Store': ['shopping', 'fashion'],
  'Bookstore': ['books', 'shopping'],

  // Culture
  'Landmark': ['landmarks', 'sightseeing'],
  'Historical Place': ['history', 'culture'],

  // Nightlife
  'Night Club': ['nightlife', 'dancing'],
  'Lounge': ['nightlife', 'drinks'],

  // Wellness
  'Spa': ['wellness', 'self-care'],
  'Yoga Studio': ['yoga', 'wellness', 'fitness'],
};

/**
 * Fetch user's basic profile info from Facebook
 */
export async function getFacebookUserProfile(accessToken: string): Promise<FacebookUser | null> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name,email,picture&access_token=${accessToken}`
    );

    if (!response.ok) {
      console.error('Facebook API error:', await response.text());
      return null;
    }

    const data = await response.json();
    return data as FacebookUser;
  } catch (error) {
    console.error('Error fetching Facebook profile:', error);
    return null;
  }
}

/**
 * Fetch user's liked pages (requires user_likes permission)
 */
export async function getFacebookLikes(accessToken: string): Promise<FacebookLike[]> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/likes?fields=id,name,category&limit=100&access_token=${accessToken}`
    );

    if (!response.ok) {
      console.error('Facebook Likes API error:', await response.text());
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching Facebook likes:', error);
    return [];
  }
}

/**
 * Fetch user's interests (requires user_interests permission - deprecated by Facebook)
 * Note: This endpoint is no longer available in newer Facebook Graph API versions
 * We'll rely on likes instead
 */
export async function getFacebookInterests(accessToken: string): Promise<FacebookInterest[]> {
  try {
    // Facebook deprecated user_interests endpoint
    // Return empty array and rely on likes instead
    console.warn('Facebook user_interests endpoint is deprecated. Using likes instead.');
    return [];
  } catch (error) {
    console.error('Error fetching Facebook interests:', error);
    return [];
  }
}

/**
 * Extract Loop-compatible interests from Facebook likes and interests
 */
export function extractLoopInterests(
  likes: FacebookLike[],
  interests: FacebookInterest[] = []
): ExtractedInterests {
  const loopInterests: string[] = [];
  const loopCategories: string[] = [];
  const favoriteActivities: string[] = [];

  // Process likes
  for (const like of likes) {
    const category = like.category;
    if (category && CATEGORY_MAPPING[category]) {
      loopCategories.push(...CATEGORY_MAPPING[category]);
      favoriteActivities.push(like.name);
    }

    // Add the page name as a raw interest (e.g., "Taylor Swift", "Hiking")
    loopInterests.push(like.name.toLowerCase());
  }

  // Remove duplicates
  const uniqueInterests = Array.from(new Set(loopInterests));
  const uniqueCategories = Array.from(new Set(loopCategories));
  const uniqueActivities = Array.from(new Set(favoriteActivities)).slice(0, 20); // Top 20

  return {
    interests: uniqueInterests.slice(0, 50), // Top 50 interests
    categories: uniqueCategories,
    favoriteActivities: uniqueActivities,
  };
}

/**
 * Complete flow: Get Facebook data and extract Loop interests
 */
export async function extractInterestsFromFacebook(
  accessToken: string
): Promise<ExtractedInterests> {
  console.log('Extracting interests from Facebook...');

  const [likes, interests] = await Promise.all([
    getFacebookLikes(accessToken),
    getFacebookInterests(accessToken),
  ]);

  console.log(`Found ${likes.length} likes, ${interests.length} interests`);

  const extracted = extractLoopInterests(likes, interests);

  console.log('Extracted Loop interests:', {
    interestsCount: extracted.interests.length,
    categoriesCount: extracted.categories.length,
    favoritesCount: extracted.favoriteActivities.length,
  });

  return extracted;
}

/**
 * Map extracted categories to Loop's predefined interest categories
 * Used during onboarding to pre-select user interests
 */
export function mapToLoopCategories(extractedCategories: string[]): string[] {
  // Loop's predefined categories (from onboarding)
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

  // Find matches
  const matched = LOOP_CATEGORIES.filter(category =>
    extractedCategories.includes(category)
  );

  return matched;
}
