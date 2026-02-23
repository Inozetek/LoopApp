/**
 * Gemini AI Description Service
 *
 * Generates short, natural-sounding place descriptions using Google Gemini 2.0 Flash.
 * Called once during city cache seed — descriptions stored in place_data JSONB.
 * Zero API calls at recommendation serve time.
 *
 * Free tier: 1,500 req/day, 1M tokens/day. One batch per category during seed.
 * Graceful fallback: if API fails, returns empty map → template explanations take over.
 */

import { canMakeGeminiRequest, trackGeminiRequest } from '@/utils/gemini-quota-tracker';
import type { Activity } from '@/types/activity';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const BATCH_SIZE = 15; // Max places per prompt to keep token count low

/**
 * Build the prompt for a batch of places
 */
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

/**
 * Extract neighborhood from address string
 */
function extractNeighborhood(address: string): string {
  // Try to pull a neighborhood/area name from address
  const parts = address.split(',').map(s => s.trim());
  // Second part is often the neighborhood/city area
  if (parts.length >= 2) {
    return parts[1];
  }
  return parts[0] || 'the area';
}

/**
 * Extract a human-readable category from the Activity
 */
function getReadableCategory(activity: Activity): string {
  if (activity.subcategory) return activity.subcategory;
  // Map common category codes to readable names
  const categoryMap: Record<string, string> = {
    restaurant: 'restaurant',
    cafe: 'cafe',
    bar: 'bar',
    night_club: 'nightclub',
    park: 'park',
    museum: 'museum',
    gym: 'gym',
    movie_theater: 'movie theater',
    shopping_mall: 'shopping',
    bakery: 'bakery',
    book_store: 'bookstore',
    spa: 'spa',
    art_gallery: 'art gallery',
    bowling_alley: 'bowling alley',
    amusement_park: 'amusement park',
    tourist_attraction: 'attraction',
  };
  return categoryMap[activity.category] || activity.category;
}

/**
 * Call the Gemini API with a single prompt
 * Returns parsed JSON response or null on failure
 */
async function callGeminiAPI(prompt: string, apiKey: string): Promise<Record<string, string> | null> {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingBudget: 0 }, // Disable thinking to save tokens
        },
      }),
    });

    if (response.status === 429) {
      console.warn('⚠️ Gemini: Rate limited (429). Skipping batch.');
      return null;
    }

    if (!response.ok) {
      console.warn(`⚠️ Gemini: API error ${response.status}. Skipping batch.`);
      return null;
    }

    const data = await response.json();

    // Extract text from Gemini response
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.warn('⚠️ Gemini: Empty response. Skipping batch.');
      return null;
    }

    // Parse JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('⚠️ Gemini: No JSON found in response. Skipping batch.');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (error) {
    console.warn('⚠️ Gemini: Request failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Generate AI descriptions for a batch of activities
 *
 * Batches up to 15 places per prompt. Returns a Map<place_id, description>.
 * On any failure (API error, rate limit, quota exhausted, missing key),
 * returns empty map — existing template explanations take over seamlessly.
 *
 * @param places - Activities to generate descriptions for
 * @param city - City name for prompt context
 * @returns Map of googlePlaceId → AI description string
 */
export async function generatePlaceDescriptions(
  places: Activity[],
  city: string = ''
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  // Check for API key
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') {
    console.log('ℹ️ Gemini: No API key configured. Using template descriptions.');
    return result;
  }

  // Filter to places with valid IDs
  const validPlaces = places.filter(p => p.googlePlaceId || p.id);
  if (validPlaces.length === 0) return result;

  // Split into batches
  const batches: Activity[][] = [];
  for (let i = 0; i < validPlaces.length; i += BATCH_SIZE) {
    batches.push(validPlaces.slice(i, i + BATCH_SIZE));
  }

  console.log(`✨ Gemini: Generating descriptions for ${validPlaces.length} places in ${batches.length} batch(es)...`);

  for (const batch of batches) {
    // Check quota before each batch call
    const canCall = await canMakeGeminiRequest();
    if (!canCall) {
      console.log('ℹ️ Gemini: Monthly quota reached. Remaining places will use templates.');
      break;
    }

    // Build prompt data
    const promptPlaces = batch.map((place, idx) => ({
      index: idx + 1,
      name: place.name,
      category: getReadableCategory(place),
      neighborhood: extractNeighborhood(place.location.address),
      city: city || place.location.city || 'the area',
    }));

    const prompt = buildPrompt(promptPlaces);
    const parsed = await callGeminiAPI(prompt, apiKey);

    if (parsed) {
      await trackGeminiRequest();

      // Map responses back to place IDs
      let matchCount = 0;
      batch.forEach((place, idx) => {
        const key = String(idx + 1);
        const description = parsed[key];
        if (description && typeof description === 'string') {
          const placeId = place.googlePlaceId || place.id;
          result.set(placeId, description.trim());
          matchCount++;
        }
      });

      console.log(`✨ Gemini: Got ${matchCount}/${batch.length} descriptions in this batch`);
    }

    // Small delay between batches to be respectful of rate limits
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`✨ Gemini: Generated ${result.size} total descriptions`);
  return result;
}
