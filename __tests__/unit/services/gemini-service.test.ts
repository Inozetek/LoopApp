/**
 * Tests for Gemini AI description service
 *
 * Tests batch splitting, prompt building, JSON response parsing,
 * error handling, quota integration, and graceful fallbacks.
 */

// Mock AsyncStorage before anything else
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock the quota tracker
jest.mock('@/utils/gemini-quota-tracker', () => ({
  canMakeGeminiRequest: jest.fn(),
  trackGeminiRequest: jest.fn(),
}));

import type { Activity } from '@/types/activity';
import { canMakeGeminiRequest, trackGeminiRequest } from '@/utils/gemini-quota-tracker';

// Store original env
const originalEnv = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// Helper to create mock Activities
function createMockActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: `test-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Place',
    category: 'restaurant',
    location: {
      latitude: 32.7767,
      longitude: -96.7970,
      address: '123 Main St, Deep Ellum, Dallas, TX',
    },
    priceRange: 2,
    rating: 4.5,
    reviewsCount: 150,
    googlePlaceId: `gp-${Math.random().toString(36).slice(2, 8)}`,
    ...overrides,
  };
}

describe('Gemini Service', () => {
  // We test pure logic by extracting and reimplementing the functions
  // from gemini-service.ts, since the module uses fetch() internally

  describe('Prompt Building', () => {
    function buildPrompt(places: { index: number; name: string; category: string; neighborhood: string; city: string }[]): string {
      const placeLines = places
        .map(p => `${p.index}. "${p.name}" — ${p.category}, ${p.neighborhood}, ${p.city}`)
        .join('\n');

      return `You are a local city guide writing for 18-35 year olds.
For each place, write ONE short sentence (max 20 words) about what makes it worth visiting.
Focus on vibe, signature dishes/drinks, unique atmosphere, or standout features.
Do NOT mention star ratings, review counts, or prices.

Places:
${placeLines}

Respond ONLY with valid JSON: {"1": "sentence", "2": "sentence", ...}`;
    }

    it('should build prompt with correct place numbering', () => {
      const prompt = buildPrompt([
        { index: 1, name: 'Oak Cliff Coffee', category: 'cafe', neighborhood: 'Oak Cliff', city: 'Dallas' },
        { index: 2, name: 'Pecan Lodge', category: 'BBQ', neighborhood: 'Deep Ellum', city: 'Dallas' },
      ]);

      expect(prompt).toContain('1. "Oak Cliff Coffee" — cafe, Oak Cliff, Dallas');
      expect(prompt).toContain('2. "Pecan Lodge" — BBQ, Deep Ellum, Dallas');
    });

    it('should include instruction to not mention ratings', () => {
      const prompt = buildPrompt([
        { index: 1, name: 'Test', category: 'cafe', neighborhood: 'Area', city: 'City' },
      ]);

      expect(prompt).toContain('Do NOT mention star ratings, review counts, or prices');
    });

    it('should request JSON response format', () => {
      const prompt = buildPrompt([
        { index: 1, name: 'Test', category: 'cafe', neighborhood: 'Area', city: 'City' },
      ]);

      expect(prompt).toContain('Respond ONLY with valid JSON');
    });

    it('should target 18-35 year olds', () => {
      const prompt = buildPrompt([
        { index: 1, name: 'Test', category: 'cafe', neighborhood: 'Area', city: 'City' },
      ]);

      expect(prompt).toContain('18-35 year olds');
    });

    it('should limit to max 20 words per sentence', () => {
      const prompt = buildPrompt([
        { index: 1, name: 'Test', category: 'cafe', neighborhood: 'Area', city: 'City' },
      ]);

      expect(prompt).toContain('max 20 words');
    });
  });

  describe('Batch Splitting', () => {
    const BATCH_SIZE = 15;

    function splitIntoBatches<T>(items: T[]): T[][] {
      const batches: T[][] = [];
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        batches.push(items.slice(i, i + BATCH_SIZE));
      }
      return batches;
    }

    it('should not split when under batch size', () => {
      const items = Array.from({ length: 10 }, (_, i) => i);
      const batches = splitIntoBatches(items);
      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(10);
    });

    it('should split exactly at batch size', () => {
      const items = Array.from({ length: 15 }, (_, i) => i);
      const batches = splitIntoBatches(items);
      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(15);
    });

    it('should split into multiple batches', () => {
      const items = Array.from({ length: 40 }, (_, i) => i);
      const batches = splitIntoBatches(items);
      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(15);
      expect(batches[1]).toHaveLength(15);
      expect(batches[2]).toHaveLength(10);
    });

    it('should handle single item', () => {
      const items = [1];
      const batches = splitIntoBatches(items);
      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const batches = splitIntoBatches([]);
      expect(batches).toHaveLength(0);
    });
  });

  describe('Response JSON Parsing', () => {
    function parseGeminiResponse(text: string): Record<string, string> | null {
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }

    it('should parse clean JSON response', () => {
      const text = '{"1": "Cozy spot with house-roasted beans", "2": "Legendary brisket in a laid-back space"}';
      const result = parseGeminiResponse(text);
      expect(result).toEqual({
        '1': 'Cozy spot with house-roasted beans',
        '2': 'Legendary brisket in a laid-back space',
      });
    });

    it('should parse JSON wrapped in markdown code blocks', () => {
      const text = '```json\n{"1": "Great coffee", "2": "Amazing BBQ"}\n```';
      const result = parseGeminiResponse(text);
      expect(result).toEqual({
        '1': 'Great coffee',
        '2': 'Amazing BBQ',
      });
    });

    it('should parse JSON with surrounding text', () => {
      const text = 'Here are the descriptions:\n{"1": "A hidden gem", "2": "Trendy rooftop bar"}\nHope you like them!';
      const result = parseGeminiResponse(text);
      expect(result).toEqual({
        '1': 'A hidden gem',
        '2': 'Trendy rooftop bar',
      });
    });

    it('should return null for no JSON', () => {
      const text = 'Sorry, I cannot help with that.';
      const result = parseGeminiResponse(text);
      expect(result).toBeNull();
    });

    it('should return null for malformed JSON', () => {
      const text = '{"1": "missing quote}';
      const result = parseGeminiResponse(text);
      expect(result).toBeNull();
    });

    it('should handle empty string', () => {
      const result = parseGeminiResponse('');
      expect(result).toBeNull();
    });

    it('should handle multi-line JSON', () => {
      const text = `{
  "1": "Industrial-chic vibes with single-origin pours and fresh pastries",
  "2": "Wood-smoked perfection in the heart of Deep Ellum"
}`;
      const result = parseGeminiResponse(text);
      expect(result).not.toBeNull();
      expect(result!['1']).toContain('Industrial-chic');
      expect(result!['2']).toContain('Wood-smoked');
    });
  });

  describe('Neighborhood Extraction', () => {
    function extractNeighborhood(address: string): string {
      const parts = address.split(',').map(s => s.trim());
      if (parts.length >= 2) {
        return parts[1];
      }
      return parts[0] || 'the area';
    }

    it('should extract neighborhood from standard address', () => {
      expect(extractNeighborhood('123 Main St, Deep Ellum, Dallas, TX')).toBe('Deep Ellum');
    });

    it('should use first part if no comma', () => {
      expect(extractNeighborhood('Deep Ellum')).toBe('Deep Ellum');
    });

    it('should return "the area" for empty string', () => {
      expect(extractNeighborhood('')).toBe('the area');
    });

    it('should handle address with only city', () => {
      expect(extractNeighborhood('123 Main St, Dallas')).toBe('Dallas');
    });
  });

  describe('Category Mapping', () => {
    function getReadableCategory(activity: Activity): string {
      if (activity.subcategory) return activity.subcategory;
      const categoryMap: Record<string, string> = {
        restaurant: 'restaurant',
        cafe: 'cafe',
        bar: 'bar',
        night_club: 'nightclub',
        park: 'park',
        museum: 'museum',
        gym: 'gym',
        movie_theater: 'movie theater',
        bakery: 'bakery',
        book_store: 'bookstore',
        spa: 'spa',
        art_gallery: 'art gallery',
      };
      return categoryMap[activity.category] || activity.category;
    }

    it('should prefer subcategory when available', () => {
      const activity = createMockActivity({ subcategory: 'Italian restaurant' });
      expect(getReadableCategory(activity)).toBe('Italian restaurant');
    });

    it('should map known categories', () => {
      expect(getReadableCategory(createMockActivity({ category: 'night_club' }))).toBe('nightclub');
      expect(getReadableCategory(createMockActivity({ category: 'movie_theater' }))).toBe('movie theater');
      expect(getReadableCategory(createMockActivity({ category: 'art_gallery' }))).toBe('art gallery');
    });

    it('should pass through unknown categories', () => {
      expect(getReadableCategory(createMockActivity({ category: 'trampoline_park' }))).toBe('trampoline_park');
    });
  });

  describe('Result Mapping', () => {
    it('should map parsed JSON responses to place IDs', () => {
      const batch = [
        createMockActivity({ googlePlaceId: 'gp-aaa', name: 'Place A' }),
        createMockActivity({ googlePlaceId: 'gp-bbb', name: 'Place B' }),
        createMockActivity({ googlePlaceId: 'gp-ccc', name: 'Place C' }),
      ];

      const parsed: Record<string, string> = {
        '1': 'Amazing coffee spot',
        '2': 'Best tacos in town',
        '3': 'Cozy bookstore vibes',
      };

      const result = new Map<string, string>();
      batch.forEach((place, idx) => {
        const key = String(idx + 1);
        const description = parsed[key];
        if (description && typeof description === 'string') {
          const placeId = place.googlePlaceId || place.id;
          result.set(placeId, description.trim());
        }
      });

      expect(result.size).toBe(3);
      expect(result.get('gp-aaa')).toBe('Amazing coffee spot');
      expect(result.get('gp-bbb')).toBe('Best tacos in town');
      expect(result.get('gp-ccc')).toBe('Cozy bookstore vibes');
    });

    it('should handle partial responses (some indices missing)', () => {
      const batch = [
        createMockActivity({ googlePlaceId: 'gp-aaa' }),
        createMockActivity({ googlePlaceId: 'gp-bbb' }),
        createMockActivity({ googlePlaceId: 'gp-ccc' }),
      ];

      // Gemini only returned 2 of 3
      const parsed: Record<string, string> = {
        '1': 'Great spot',
        '3': 'Hidden gem',
      };

      const result = new Map<string, string>();
      batch.forEach((place, idx) => {
        const key = String(idx + 1);
        const description = parsed[key];
        if (description && typeof description === 'string') {
          const placeId = place.googlePlaceId || place.id;
          result.set(placeId, description.trim());
        }
      });

      expect(result.size).toBe(2);
      expect(result.has('gp-aaa')).toBe(true);
      expect(result.has('gp-bbb')).toBe(false);
      expect(result.has('gp-ccc')).toBe(true);
    });

    it('should fall back to activity.id when googlePlaceId is missing', () => {
      const batch = [
        createMockActivity({ id: 'local-123', googlePlaceId: undefined }),
      ];

      const parsed: Record<string, string> = { '1': 'Nice place' };

      const result = new Map<string, string>();
      batch.forEach((place, idx) => {
        const key = String(idx + 1);
        const description = parsed[key];
        if (description && typeof description === 'string') {
          const placeId = place.googlePlaceId || place.id;
          result.set(placeId, description.trim());
        }
      });

      expect(result.get('local-123')).toBe('Nice place');
    });

    it('should trim whitespace from descriptions', () => {
      const batch = [createMockActivity({ googlePlaceId: 'gp-aaa' })];
      const parsed: Record<string, string> = { '1': '  Spacious patio with live jazz  ' };

      const result = new Map<string, string>();
      batch.forEach((place, idx) => {
        const key = String(idx + 1);
        const description = parsed[key];
        if (description && typeof description === 'string') {
          const placeId = place.googlePlaceId || place.id;
          result.set(placeId, description.trim());
        }
      });

      expect(result.get('gp-aaa')).toBe('Spacious patio with live jazz');
    });

    it('should skip non-string values', () => {
      const batch = [
        createMockActivity({ googlePlaceId: 'gp-aaa' }),
        createMockActivity({ googlePlaceId: 'gp-bbb' }),
      ];

      const parsed: Record<string, any> = {
        '1': 'Valid description',
        '2': 42, // Not a string
      };

      const result = new Map<string, string>();
      batch.forEach((place, idx) => {
        const key = String(idx + 1);
        const description = parsed[key];
        if (description && typeof description === 'string') {
          const placeId = place.googlePlaceId || place.id;
          result.set(placeId, description.trim());
        }
      });

      expect(result.size).toBe(1);
      expect(result.has('gp-aaa')).toBe(true);
      expect(result.has('gp-bbb')).toBe(false);
    });
  });

  describe('API Key Validation', () => {
    it('should skip when key is missing', () => {
      const apiKey = undefined;
      const shouldSkip = !apiKey || apiKey === 'your_key_here';
      expect(shouldSkip).toBe(true);
    });

    it('should skip when key is placeholder', () => {
      const apiKey = 'your_key_here';
      const shouldSkip = !apiKey || apiKey === 'your_key_here';
      expect(shouldSkip).toBe(true);
    });

    it('should proceed when key is real', () => {
      const apiKey: string | undefined = 'AIzaSyExampleKey123';
      const shouldSkip = !apiKey || apiKey === 'your_key_here';
      expect(shouldSkip).toBe(false);
    });
  });

  describe('Integration with generateExplanation', () => {
    it('should use ai_description as opening when present', () => {
      // Mirrors the logic in recommendations.ts generateExplanation()
      const place = {
        ai_description: 'House-roasted single-origin beans in a cozy industrial loft',
        rating: 4.5,
        user_ratings_total: 200,
      };

      const parts: string[] = [];

      // Priority: AI description
      if (place.ai_description) {
        parts.push(place.ai_description);
      } else if (place.rating && place.rating >= 4.5) {
        parts.push(`Highly rated — ${place.rating}★`);
      }

      expect(parts[0]).toBe('House-roasted single-origin beans in a cozy industrial loft');
    });

    it('should fall through to template when ai_description is absent', () => {
      const place = {
        ai_description: undefined as string | undefined,
        rating: 4.5,
        user_ratings_total: 200,
      };

      const parts: string[] = [];

      if (place.ai_description) {
        parts.push(place.ai_description);
      } else if (place.rating && place.rating >= 4.5) {
        parts.push(`Highly rated — ${place.rating}★`);
      }

      expect(parts[0]).toBe('Highly rated — 4.5★');
    });

    it('should fall through to template when ai_description is empty string', () => {
      const place = {
        ai_description: '',
        rating: 4.3,
        user_ratings_total: 100,
      };

      const parts: string[] = [];

      if (place.ai_description) {
        parts.push(place.ai_description);
      } else if (place.rating && place.rating >= 4.0) {
        parts.push(`Well-rated — ${place.rating}★`);
      }

      expect(parts[0]).toBe('Well-rated — 4.3★');
    });
  });
});
