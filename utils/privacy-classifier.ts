/**
 * Privacy Classifier
 *
 * Classifies places/activities into privacy-sensitive categories.
 * Sensitive categories default to private visibility for likes.
 *
 * Categories considered sensitive:
 * - Adult entertainment and products
 * - Alcohol and cannabis
 * - Gambling
 * - Firearms
 * - Healthcare (mental health, fertility, addiction, etc.)
 * - Financial services (pawn shops, payday loans)
 */

// ============================================================================
// SENSITIVE CATEGORY PATTERNS
// ============================================================================

interface SensitivePattern {
  pattern: RegExp;
  category: string;
  defaultVisibility: 'private' | 'friends';
  reason: string;
}

const SENSITIVE_PATTERNS: SensitivePattern[] = [
  // Adult entertainment and products
  { pattern: /adult.*entertainment|erotic|xxx|pornograph/i, category: 'Adult Entertainment', defaultVisibility: 'private', reason: 'Adult content' },
  { pattern: /sex.*shop|adult.*store|adult.*shop|lingerie.*store/i, category: 'Adult Stores', defaultVisibility: 'private', reason: 'Adult products' },
  { pattern: /strip.*club|gentlemen.*club|exotic.*dance/i, category: 'Strip Clubs', defaultVisibility: 'private', reason: 'Adult entertainment' },
  { pattern: /escort|massage.*parlor/i, category: 'Adult Services', defaultVisibility: 'private', reason: 'Adult services' },

  // Alcohol
  { pattern: /liquor.*store|wine.*store|beer.*store|alcohol.*store/i, category: 'Liquor Stores', defaultVisibility: 'private', reason: 'Alcohol purchases' },
  { pattern: /^bar$|^pub$|tavern|saloon|brewery|distillery/i, category: 'Bars', defaultVisibility: 'friends', reason: 'Alcohol venue' },

  // Cannabis
  { pattern: /cannabis|marijuana|dispensary|weed.*store/i, category: 'Cannabis', defaultVisibility: 'private', reason: 'Cannabis purchases' },
  { pattern: /smoke.*shop|head.*shop|vape.*shop/i, category: 'Smoke Shops', defaultVisibility: 'private', reason: 'Smoking products' },

  // Gambling
  { pattern: /casino|gambling|slot.*machine|poker.*room/i, category: 'Gambling', defaultVisibility: 'private', reason: 'Gambling venues' },
  { pattern: /betting.*shop|bookmaker|sportsbook/i, category: 'Betting', defaultVisibility: 'private', reason: 'Gambling services' },

  // Firearms
  { pattern: /gun.*store|gun.*shop|firearms|ammunition|shooting.*range/i, category: 'Firearms', defaultVisibility: 'private', reason: 'Firearms' },

  // Healthcare - Mental Health
  { pattern: /psychiatr|mental.*health|psycholog.*clinic|therapy.*center/i, category: 'Mental Health', defaultVisibility: 'private', reason: 'Healthcare privacy' },
  { pattern: /counseling.*center|behavioral.*health/i, category: 'Counseling', defaultVisibility: 'private', reason: 'Healthcare privacy' },

  // Healthcare - Reproductive
  { pattern: /fertility.*clinic|ivf.*center|reproductive/i, category: 'Fertility', defaultVisibility: 'private', reason: 'Healthcare privacy' },
  { pattern: /abortion.*clinic|planned.*parenthood/i, category: 'Reproductive Health', defaultVisibility: 'private', reason: 'Healthcare privacy' },
  { pattern: /std.*clinic|sexual.*health|hiv.*testing/i, category: 'Sexual Health', defaultVisibility: 'private', reason: 'Healthcare privacy' },

  // Healthcare - Addiction
  { pattern: /rehab.*center|rehabilitation|addiction.*treatment/i, category: 'Rehabilitation', defaultVisibility: 'private', reason: 'Healthcare privacy' },
  { pattern: /detox.*center|recovery.*center|sober.*living/i, category: 'Recovery', defaultVisibility: 'private', reason: 'Healthcare privacy' },
  { pattern: /alcoholics.*anonymous|narcotics.*anonymous|aa.*meeting|na.*meeting/i, category: 'Support Groups', defaultVisibility: 'private', reason: 'Healthcare privacy' },

  // Healthcare - Other Sensitive
  { pattern: /weight.*loss.*clinic|bariatric|obesity.*clinic/i, category: 'Weight Loss', defaultVisibility: 'private', reason: 'Healthcare privacy' },
  { pattern: /plastic.*surgery|cosmetic.*surgery|botox/i, category: 'Cosmetic Surgery', defaultVisibility: 'private', reason: 'Healthcare privacy' },
  { pattern: /dermatolog.*clinic|skin.*clinic|acne.*treatment/i, category: 'Dermatology', defaultVisibility: 'friends', reason: 'Healthcare privacy' },
  { pattern: /hair.*transplant|hair.*restoration/i, category: 'Hair Restoration', defaultVisibility: 'private', reason: 'Healthcare privacy' },

  // Financial - Sensitive
  { pattern: /pawn.*shop|pawnbroker/i, category: 'Pawn Shop', defaultVisibility: 'private', reason: 'Financial privacy' },
  { pattern: /payday.*loan|cash.*advance|title.*loan/i, category: 'Payday Loans', defaultVisibility: 'private', reason: 'Financial privacy' },
  { pattern: /bankruptcy.*attorney|debt.*relief|credit.*repair/i, category: 'Debt Services', defaultVisibility: 'private', reason: 'Financial privacy' },

  // Legal - Sensitive
  { pattern: /bail.*bonds|bondsman/i, category: 'Bail Bonds', defaultVisibility: 'private', reason: 'Legal privacy' },
  { pattern: /criminal.*defense.*attorney|dui.*lawyer/i, category: 'Criminal Defense', defaultVisibility: 'private', reason: 'Legal privacy' },
  { pattern: /divorce.*attorney|family.*law/i, category: 'Family Law', defaultVisibility: 'private', reason: 'Legal privacy' },
];

// ============================================================================
// MAIN CLASSIFICATION FUNCTION
// ============================================================================

export interface PrivacyClassification {
  isSensitive: boolean;
  defaultVisibility: 'private' | 'friends' | 'public';
  matchedCategory?: string;
  reason?: string;
}

/**
 * Classify a place/activity for privacy sensitivity
 *
 * @param category - The place category (e.g., "restaurant", "liquor_store")
 * @param placeName - Optional place name for additional pattern matching
 * @returns Classification with sensitivity flag and default visibility
 */
export function classifyPrivacy(
  category: string | undefined | null,
  placeName?: string
): PrivacyClassification {
  const textToCheck = [
    category?.toLowerCase() || '',
    placeName?.toLowerCase() || '',
  ].join(' ');

  // Check against all patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.pattern.test(textToCheck)) {
      return {
        isSensitive: true,
        defaultVisibility: pattern.defaultVisibility,
        matchedCategory: pattern.category,
        reason: pattern.reason,
      };
    }
  }

  // Not sensitive - default to friends visibility
  return {
    isSensitive: false,
    defaultVisibility: 'friends',
  };
}

/**
 * Check if a category string matches any sensitive pattern
 * Simpler check without full classification
 */
export function isSensitiveCategory(category: string | undefined | null): boolean {
  if (!category) return false;

  const lowerCategory = category.toLowerCase();

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.pattern.test(lowerCategory)) {
      return true;
    }
  }

  return false;
}

/**
 * Get all sensitive category patterns (for database sync)
 */
export function getSensitivePatterns(): Array<{
  pattern: string;
  category: string;
  defaultVisibility: string;
  reason: string;
}> {
  return SENSITIVE_PATTERNS.map(p => ({
    pattern: p.pattern.source,
    category: p.category,
    defaultVisibility: p.defaultVisibility,
    reason: p.reason,
  }));
}

/**
 * Batch classify multiple places
 * Returns a map of placeId -> classification
 */
export function batchClassifyPrivacy(
  places: Array<{ id: string; category?: string; name?: string }>
): Map<string, PrivacyClassification> {
  const results = new Map<string, PrivacyClassification>();

  for (const place of places) {
    results.set(place.id, classifyPrivacy(place.category, place.name));
  }

  return results;
}
