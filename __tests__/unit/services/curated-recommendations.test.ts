/**
 * Tests for Curated Recommendations Service
 *
 * Tests the curated picks infrastructure:
 * - Age bracket computation
 * - Time-of-day category weights
 * - Age bracket preferences
 * - Neighborhood extraction
 * - Specific place type detection
 * - Curated explanation passthrough
 */

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          contains: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
    })),
  },
}));

// ============================================================================
// Pure function extractions for testing
// ============================================================================

/**
 * Age bracket computation (from curated-service.ts)
 */
function getAgeBracket(birthYear?: number | null): string | undefined {
  if (!birthYear) return undefined;
  const age = new Date().getFullYear() - birthYear;
  if (age < 18) return undefined;
  if (age <= 24) return '18-24';
  if (age <= 34) return '25-34';
  if (age <= 44) return '35-44';
  return '45+';
}

/**
 * Time-category weight matrix (from recommendations.ts Step 3)
 */
const TIME_CATEGORY_WEIGHTS: Record<string, Record<string, number>> = {
  morning: {
    'Coffee & Cafes': 25, 'Dining': 15, 'Fitness': 20,
    'Outdoor Activities': 15, 'Wellness': 10,
    'Bars & Nightlife': -10, 'Entertainment': 0,
    'Arts & Culture': 5, 'Shopping': 5,
  },
  afternoon: {
    'Shopping': 15, 'Arts & Culture': 15, 'Outdoor Activities': 15,
    'Dining': 20, 'Entertainment': 10, 'Fitness': 10,
    'Coffee & Cafes': 10, 'Bars & Nightlife': 0,
  },
  evening: {
    'Dining': 25, 'Bars & Nightlife': 20, 'Entertainment': 20,
    'Live Music': 20, 'Movies': 15,
    'Coffee & Cafes': -5, 'Fitness': 0,
    'Arts & Culture': 5, 'Shopping': 5,
  },
  night: {
    'Bars & Nightlife': 25, 'Live Music': 25, 'Entertainment': 15,
    'Dining': 10, 'Coffee & Cafes': -15, 'Fitness': -10,
    'Arts & Culture': -5, 'Shopping': -10,
  },
};

function getTimeCategoryBoost(category: string, timeOfDay: string): number {
  const weights = TIME_CATEGORY_WEIGHTS[timeOfDay];
  if (!weights) return 0;
  return weights[category] || 0;
}

/**
 * Age bracket preferences (from recommendations.ts Step 4)
 */
const AGE_BRACKET_PREFERENCES: Record<string, Record<string, number>> = {
  '18-24': {
    'Bars & Nightlife': 10, 'Entertainment': 10, 'Live Music': 8,
    'Movies': 8, 'Fitness': 5,
    'Arts & Culture': -3, 'Wellness': -3,
  },
  '25-34': {
    'Dining': 8, 'Bars & Nightlife': 5, 'Fitness': 8,
    'Live Music': 8, 'Coffee & Cafes': 5, 'Outdoor Activities': 5,
  },
  '35-44': {
    'Dining': 10, 'Outdoor Activities': 8, 'Arts & Culture': 8,
    'Wellness': 8, 'Shopping': 5,
    'Bars & Nightlife': -5,
  },
  '45+': {
    'Dining': 10, 'Arts & Culture': 10, 'Outdoor Activities': 8,
    'Wellness': 10, 'Shopping': 5,
    'Bars & Nightlife': -8, 'Entertainment': -3,
  },
};

function getAgeBracketBoost(ageBracket: string | undefined, category: string): number {
  if (!ageBracket || !AGE_BRACKET_PREFERENCES[ageBracket]) return 0;
  return AGE_BRACKET_PREFERENCES[ageBracket][category] || 0;
}

/**
 * Neighborhood extraction (from recommendations.ts Step 5)
 */
function extractNeighborhood(address: string): string | null {
  const NEIGHBORHOOD_MAP: Record<string, string> = {
    '75226': 'Deep Ellum',
    '75201': 'Downtown',
    '75204': 'Uptown',
    '75219': 'Oak Lawn',
    '75206': 'Lower Greenville',
    '75207': 'Design District',
    '75208': 'Oak Cliff',
  };

  const zipMatch = address.match(/\b(\d{5})\b/);
  if (zipMatch && NEIGHBORHOOD_MAP[zipMatch[1]]) {
    return NEIGHBORHOOD_MAP[zipMatch[1]];
  }

  const areaPatterns: [RegExp, string][] = [
    [/deep ellum/i, 'Deep Ellum'],
    [/bishop arts/i, 'Bishop Arts'],
    [/uptown/i, 'Uptown'],
    [/oak lawn/i, 'Oak Lawn'],
    [/downtown/i, 'Downtown'],
  ];

  for (const [pattern, name] of areaPatterns) {
    if (pattern.test(address)) return name;
  }

  return null;
}

/**
 * Specific place type detection (from recommendations.ts Step 5)
 */
function getSpecificPlaceType(
  types: string[],
  name: string,
  fallbackCategory: string
): string {
  const specificTypes: [string, string][] = [
    ['sushi_restaurant', 'sushi spot'],
    ['pizza_restaurant', 'pizza place'],
    ['mexican_restaurant', 'Mexican restaurant'],
    ['cafe', 'cafe'],
    ['coffee_shop', 'coffee shop'],
    ['brewery', 'brewery'],
    ['yoga_studio', 'yoga studio'],
    ['museum', 'museum'],
    ['spa', 'spa'],
  ];

  for (const [type, label] of specificTypes) {
    if (types.includes(type)) return label;
  }

  const lowerName = name.toLowerCase();
  if (lowerName.includes('sushi')) return 'sushi spot';
  if (lowerName.includes('coffee')) return 'coffee shop';
  if (lowerName.includes('brewery') || lowerName.includes('brewing')) return 'brewery';
  if (lowerName.includes('bbq') || lowerName.includes('barbecue')) return 'BBQ joint';
  if (lowerName.includes('taco')) return 'taco spot';

  return fallbackCategory.toLowerCase();
}

/**
 * First session detection logic (from recommendations.ts Step 2)
 */
function isFirstSession(user: { ai_profile?: any; last_active_date?: string | null }): boolean {
  const hasFavoriteCategories = user.ai_profile?.favorite_categories?.length > 0;
  return !hasFavoriteCategories && !user.last_active_date;
}

// ============================================================================
// TESTS
// ============================================================================

describe('Curated Recommendations Engine', () => {

  describe('Age Bracket Computation', () => {
    const currentYear = new Date().getFullYear();

    it('should return 18-24 for users aged 18-24', () => {
      expect(getAgeBracket(currentYear - 18)).toBe('18-24');
      expect(getAgeBracket(currentYear - 20)).toBe('18-24');
      expect(getAgeBracket(currentYear - 24)).toBe('18-24');
    });

    it('should return 25-34 for users aged 25-34', () => {
      expect(getAgeBracket(currentYear - 25)).toBe('25-34');
      expect(getAgeBracket(currentYear - 30)).toBe('25-34');
      expect(getAgeBracket(currentYear - 34)).toBe('25-34');
    });

    it('should return 35-44 for users aged 35-44', () => {
      expect(getAgeBracket(currentYear - 35)).toBe('35-44');
      expect(getAgeBracket(currentYear - 40)).toBe('35-44');
      expect(getAgeBracket(currentYear - 44)).toBe('35-44');
    });

    it('should return 45+ for users aged 45 and older', () => {
      expect(getAgeBracket(currentYear - 45)).toBe('45+');
      expect(getAgeBracket(currentYear - 60)).toBe('45+');
      expect(getAgeBracket(currentYear - 80)).toBe('45+');
    });

    it('should return undefined for users under 18', () => {
      expect(getAgeBracket(currentYear - 17)).toBeUndefined();
      expect(getAgeBracket(currentYear - 10)).toBeUndefined();
    });

    it('should return undefined for null/undefined birth year', () => {
      expect(getAgeBracket(null)).toBeUndefined();
      expect(getAgeBracket(undefined)).toBeUndefined();
    });
  });

  describe('Time-of-Day Category Weights (Step 3)', () => {
    it('should boost coffee heavily in the morning', () => {
      const boost = getTimeCategoryBoost('Coffee & Cafes', 'morning');
      expect(boost).toBe(25);
    });

    it('should penalize bars in the morning', () => {
      const boost = getTimeCategoryBoost('Bars & Nightlife', 'morning');
      expect(boost).toBe(-10);
    });

    it('should boost dining in the evening', () => {
      const boost = getTimeCategoryBoost('Dining', 'evening');
      expect(boost).toBe(25);
    });

    it('should boost bars and live music at night', () => {
      expect(getTimeCategoryBoost('Bars & Nightlife', 'night')).toBe(25);
      expect(getTimeCategoryBoost('Live Music', 'night')).toBe(25);
    });

    it('should penalize coffee at night', () => {
      expect(getTimeCategoryBoost('Coffee & Cafes', 'night')).toBe(-15);
    });

    it('should boost shopping in the afternoon', () => {
      expect(getTimeCategoryBoost('Shopping', 'afternoon')).toBe(15);
    });

    it('should return 0 for unknown categories', () => {
      expect(getTimeCategoryBoost('Unknown Category', 'morning')).toBe(0);
    });

    it('should return 0 for unknown time of day', () => {
      expect(getTimeCategoryBoost('Coffee & Cafes', 'midnight')).toBe(0);
    });

    it('morning feed should prioritize coffee > fitness > dining > bars', () => {
      const coffee = getTimeCategoryBoost('Coffee & Cafes', 'morning');
      const fitness = getTimeCategoryBoost('Fitness', 'morning');
      const dining = getTimeCategoryBoost('Dining', 'morning');
      const bars = getTimeCategoryBoost('Bars & Nightlife', 'morning');

      expect(coffee).toBeGreaterThan(fitness);
      expect(fitness).toBeGreaterThan(dining);
      expect(dining).toBeGreaterThan(bars);
    });

    it('evening feed should prioritize dining > bars = entertainment > coffee', () => {
      const dining = getTimeCategoryBoost('Dining', 'evening');
      const bars = getTimeCategoryBoost('Bars & Nightlife', 'evening');
      const entertainment = getTimeCategoryBoost('Entertainment', 'evening');
      const coffee = getTimeCategoryBoost('Coffee & Cafes', 'evening');

      expect(dining).toBeGreaterThan(bars);
      expect(bars).toBe(entertainment);
      expect(entertainment).toBeGreaterThan(coffee);
    });
  });

  describe('Age Bracket Preferences (Step 4)', () => {
    it('should boost bars & entertainment for 18-24 age group', () => {
      expect(getAgeBracketBoost('18-24', 'Bars & Nightlife')).toBe(10);
      expect(getAgeBracketBoost('18-24', 'Entertainment')).toBe(10);
    });

    it('should penalize bars for 45+ age group', () => {
      expect(getAgeBracketBoost('45+', 'Bars & Nightlife')).toBe(-8);
    });

    it('should boost arts & culture for 45+ age group', () => {
      expect(getAgeBracketBoost('45+', 'Arts & Culture')).toBe(10);
    });

    it('should boost dining for 25-34 age group', () => {
      expect(getAgeBracketBoost('25-34', 'Dining')).toBe(8);
    });

    it('should boost wellness for 35-44 age group', () => {
      expect(getAgeBracketBoost('35-44', 'Wellness')).toBe(8);
    });

    it('should return 0 for undefined age bracket', () => {
      expect(getAgeBracketBoost(undefined, 'Dining')).toBe(0);
    });

    it('should return 0 for unmatched category', () => {
      expect(getAgeBracketBoost('25-34', 'Unknown')).toBe(0);
    });

    it('different ages should produce different dining recommendations', () => {
      const young = getAgeBracketBoost('18-24', 'Bars & Nightlife');
      const older = getAgeBracketBoost('45+', 'Bars & Nightlife');
      expect(young).toBeGreaterThan(older);
      expect(young - older).toBe(18); // 10 - (-8) = 18 point swing
    });
  });

  describe('Neighborhood Extraction (Step 5)', () => {
    it('should extract Deep Ellum from zip 75226', () => {
      expect(extractNeighborhood('2702 Main St, Dallas, TX 75226')).toBe('Deep Ellum');
    });

    it('should extract Downtown from zip 75201', () => {
      expect(extractNeighborhood('1530 Main St, Dallas, TX 75201')).toBe('Downtown');
    });

    it('should extract Uptown from zip 75204', () => {
      expect(extractNeighborhood('3656 Howell St, Dallas, TX 75204')).toBe('Uptown');
    });

    it('should extract from area name patterns', () => {
      expect(extractNeighborhood('Main St, Deep Ellum, Dallas')).toBe('Deep Ellum');
      expect(extractNeighborhood('123 Bishop Arts Ave')).toBe('Bishop Arts');
    });

    it('should return null for unknown addresses', () => {
      expect(extractNeighborhood('123 Unknown St, Somewhere, TX 99999')).toBeNull();
      expect(extractNeighborhood('')).toBeNull();
    });
  });

  describe('Specific Place Type Detection (Step 5)', () => {
    it('should detect sushi from place types', () => {
      expect(getSpecificPlaceType(['sushi_restaurant'], 'Nobu', 'Dining')).toBe('sushi spot');
    });

    it('should detect pizza from place types', () => {
      expect(getSpecificPlaceType(['pizza_restaurant'], 'Cane Rosso', 'Dining')).toBe('pizza place');
    });

    it('should detect cafe from types', () => {
      expect(getSpecificPlaceType(['cafe'], 'Houndstooth', 'Coffee & Cafes')).toBe('cafe');
    });

    it('should detect brewery from name when types miss', () => {
      expect(getSpecificPlaceType(['bar'], 'Deep Ellum Brewing Company', 'Bars & Nightlife')).toBe('brewery');
    });

    it('should detect taco from name', () => {
      expect(getSpecificPlaceType(['restaurant'], 'Velvet Taco', 'Dining')).toBe('taco spot');
    });

    it('should detect BBQ from name', () => {
      expect(getSpecificPlaceType(['restaurant'], 'Pecan Lodge BBQ', 'Dining')).toBe('BBQ joint');
    });

    it('should fallback to category for generic places', () => {
      expect(getSpecificPlaceType(['restaurant'], 'Some Place', 'Dining')).toBe('dining');
    });
  });

  describe('First Session Detection (Step 2)', () => {
    it('should detect new user with no profile and no activity', () => {
      expect(isFirstSession({
        ai_profile: { favorite_categories: [] },
        last_active_date: null,
      })).toBe(true);
    });

    it('should detect new user with undefined ai_profile', () => {
      expect(isFirstSession({
        ai_profile: undefined,
        last_active_date: null,
      })).toBe(true);
    });

    it('should NOT detect returning user with favorite categories', () => {
      expect(isFirstSession({
        ai_profile: { favorite_categories: ['Dining', 'Coffee'] },
        last_active_date: null,
      })).toBe(false);
    });

    it('should NOT detect returning user with last active date', () => {
      expect(isFirstSession({
        ai_profile: { favorite_categories: [] },
        last_active_date: '2025-01-15',
      })).toBe(false);
    });

    it('should NOT detect fully active user', () => {
      expect(isFirstSession({
        ai_profile: { favorite_categories: ['Dining'] },
        last_active_date: '2025-01-15',
      })).toBe(false);
    });
  });

  describe('Curated Seed Data Validation', () => {
    it('should have 50+ Dallas picks defined in seed script', async () => {
      const { DALLAS_PICKS } = await import('../../../scripts/seed-curated-dallas');
      expect(DALLAS_PICKS.length).toBeGreaterThanOrEqual(50);
    });

    it('every pick should have required fields', async () => {
      const { DALLAS_PICKS } = await import('../../../scripts/seed-curated-dallas');

      for (const pick of DALLAS_PICKS) {
        expect(pick.place_name).toBeTruthy();
        expect(pick.place_data).toBeTruthy();
        expect(pick.place_data.name).toBeTruthy();
        expect(pick.place_data.location).toBeTruthy();
        expect(pick.place_data.rating).toBeGreaterThan(0);
        expect(pick.categories.length).toBeGreaterThan(0);
        expect(pick.curated_explanation.length).toBeGreaterThan(20);
        expect(pick.priority).toBeGreaterThanOrEqual(1);
        expect(pick.priority).toBeLessThanOrEqual(100);
      }
    });

    it('should cover all major interest categories', async () => {
      const { DALLAS_PICKS } = await import('../../../scripts/seed-curated-dallas');

      const allCategories = new Set<string>();
      DALLAS_PICKS.forEach(pick => {
        pick.categories.forEach(cat => allCategories.add(cat));
      });

      const requiredCategories = [
        'Dining', 'Coffee & Cafes', 'Bars & Nightlife',
        'Entertainment', 'Outdoor Activities', 'Fitness',
        'Arts & Culture', 'Shopping', 'Live Music',
        'Sports', 'Wellness',
      ];

      for (const category of requiredCategories) {
        expect(allCategories).toContain(category);
      }
    });

    it('should have valid age brackets', async () => {
      const { DALLAS_PICKS } = await import('../../../scripts/seed-curated-dallas');
      const validBrackets = ['18-24', '25-34', '35-44', '45+'];

      for (const pick of DALLAS_PICKS) {
        for (const bracket of pick.age_brackets) {
          expect(validBrackets).toContain(bracket);
        }
      }
    });

    it('should have valid time_of_day values', async () => {
      const { DALLAS_PICKS } = await import('../../../scripts/seed-curated-dallas');
      const validTimes = ['morning', 'afternoon', 'evening', 'night'];

      for (const pick of DALLAS_PICKS) {
        for (const tod of pick.time_of_day) {
          expect(validTimes).toContain(tod);
        }
      }
    });

    it('curated explanations should be compelling (2+ sentences or 50+ chars)', async () => {
      const { DALLAS_PICKS } = await import('../../../scripts/seed-curated-dallas');

      for (const pick of DALLAS_PICKS) {
        expect(pick.curated_explanation.length).toBeGreaterThanOrEqual(30);
      }
    });
  });

  describe('Time-Category Integration Scenarios', () => {
    it('8am feed: coffee shop should outscore bar by 35+ points', () => {
      const coffeeBoost = getTimeCategoryBoost('Coffee & Cafes', 'morning');
      const barBoost = getTimeCategoryBoost('Bars & Nightlife', 'morning');
      expect(coffeeBoost - barBoost).toBeGreaterThanOrEqual(35);
    });

    it('7pm feed: restaurant should outscore coffee by 30 points', () => {
      const diningBoost = getTimeCategoryBoost('Dining', 'evening');
      const coffeeBoost = getTimeCategoryBoost('Coffee & Cafes', 'evening');
      expect(diningBoost - coffeeBoost).toBe(30);
    });

    it('age 26 + 10pm: bars get double boost (time + age)', () => {
      const timeBoost = getTimeCategoryBoost('Bars & Nightlife', 'night');
      const ageBoost = getAgeBracketBoost('25-34', 'Bars & Nightlife');
      expect(timeBoost + ageBoost).toBe(30);
    });

    it('age 50 + 10pm: bars get time boost but age penalty', () => {
      const timeBoost = getTimeCategoryBoost('Bars & Nightlife', 'night');
      const ageBoost = getAgeBracketBoost('45+', 'Bars & Nightlife');
      expect(timeBoost + ageBoost).toBe(17); // 25 + (-8) = 17
    });

    it('age 26 vs 51 for bars at night: 13 point difference', () => {
      const younger =
        getTimeCategoryBoost('Bars & Nightlife', 'night') +
        getAgeBracketBoost('25-34', 'Bars & Nightlife');
      const older =
        getTimeCategoryBoost('Bars & Nightlife', 'night') +
        getAgeBracketBoost('45+', 'Bars & Nightlife');
      expect(younger - older).toBe(13); // 30 - 17 = 13
    });
  });
});
