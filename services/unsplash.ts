/**
 * Unsplash API Service
 * Provides fallback images for activities when Google Places doesn't have photos
 * Free tier: 50 requests/hour
 */

// Map activity categories to Unsplash search queries
const CATEGORY_SEARCH_QUERIES: Record<string, string> = {
  Dining: 'restaurant interior food',
  Coffee: 'coffee shop cafe',
  Bars: 'bar nightlife cocktails',
  Nightlife: 'nightclub party music',
  Fitness: 'gym workout fitness',
  Outdoor: 'park nature outdoor',
  Culture: 'museum art gallery',
  Entertainment: 'theater entertainment venue',
  Shopping: 'shopping mall boutique',
  Art: 'art gallery exhibition',
  Other: 'urban cityscape activity',
};

export interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  user: {
    name: string;
    username: string;
  };
  description: string | null;
  alt_description: string | null;
}

interface UnsplashSearchResponse {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

/**
 * Search for images on Unsplash based on activity category
 * Returns a random image from the first page of results
 */
export async function searchUnsplashImage(category: string): Promise<string> {
  const API_KEY = process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY;

  if (!API_KEY) {
    console.warn('⚠️ No Unsplash API key found, skipping fallback images');
    return '';
  }

  try {
    // Get search query for category
    const query = CATEGORY_SEARCH_QUERIES[category] || CATEGORY_SEARCH_QUERIES['Other'];

    console.log(`🖼️ Searching Unsplash for: ${query}`);

    // Call Unsplash API
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
      {
        headers: {
          Authorization: `Client-ID ${API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error('❌ Unsplash API error:', response.status);
      return '';
    }

    const data: UnsplashSearchResponse = await response.json();

    if (data.results.length === 0) {
      console.warn('⚠️ No Unsplash images found for query:', query);
      return '';
    }

    // Pick a random image from results (adds variety)
    const randomIndex = Math.floor(Math.random() * data.results.length);
    const photo = data.results[randomIndex];

    // Return regular size URL (optimized for feed cards)
    // Add size params: w=600&h=400&fit=crop for consistent dimensions
    const imageUrl = `${photo.urls.regular}&w=600&h=400&fit=crop`;

    console.log(`✅ Found Unsplash image: ${photo.id}`);

    return imageUrl;

  } catch (error) {
    console.error('❌ Error fetching Unsplash image:', error);
    return '';
  }
}

/**
 * Batch search for multiple categories (more efficient for recommendation feed)
 * Returns a map of category -> image URL
 */
export async function batchSearchUnsplashImages(
  categories: string[]
): Promise<Record<string, string>> {
  const uniqueCategories = [...new Set(categories)];

  // Fetch all images in parallel
  const results = await Promise.all(
    uniqueCategories.map(async (category) => {
      const url = await searchUnsplashImage(category);
      return { category, url };
    })
  );

  // Convert to map
  const imageMap: Record<string, string> = {};
  for (const { category, url } of results) {
    imageMap[category] = url;
  }

  return imageMap;
}

/**
 * Get a cached Unsplash image for a category
 * Implements simple in-memory cache to reduce API calls
 */
const imageCache: Map<string, { url: string; timestamp: number }> = new Map();
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

export async function getCachedUnsplashImage(category: string): Promise<string> {
  // Check cache first
  const cached = imageCache.get(category);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_DURATION_MS) {
    console.log(`💾 Using cached Unsplash image for ${category}`);
    return cached.url;
  }

  // Fetch new image
  const url = await searchUnsplashImage(category);

  // Cache it
  if (url) {
    imageCache.set(category, { url, timestamp: now });
  }

  return url;
}
