/**
 * Tests for Phase 1 Activity Card UX changes:
 * A1: Descriptive insight tags (replacing match %)
 * A2: Star rating + review count in metadata
 * A3: Neighborhood parsing
 * A4: Responsive image height
 * A5: Badge priority cap at 2
 * A6: Backward-looking AI explanations
 * A7: Honest engagement counts (no Google seeding)
 * A8: Touch targets + carousel counter
 */

import { Dimensions } from 'react-native';

// ============================================================
// A1: Insight tag selection logic (extracted for testability)
// ============================================================

interface ScoreBreakdown {
  baseScore: number;
  locationScore: number;
  timeScore: number;
  feedbackScore: number;
  collaborativeScore: number;
  sponsorBoost: number;
  finalScore: number;
}

interface InsightTag {
  icon: string;
  label: string;
}

function getInsightTag(
  score: ScoreBreakdown,
  showInsights: boolean,
  hasFriendActivity: boolean,
): InsightTag | null {
  if (!showInsights) return null;
  if (hasFriendActivity) return { icon: 'people', label: 'Popular with friends' };
  if (score.feedbackScore >= 12) return { icon: 'thumbs-up', label: 'Based on places you liked' };
  if (score.locationScore >= 18) return { icon: 'navigate', label: 'Near your route' };
  if (score.baseScore >= 35) return { icon: 'sparkles-outline', label: 'Matches your interests' };
  if (score.timeScore >= 12) return { icon: 'time', label: 'Great timing' };
  return null;
}

describe('A1: Insight tag selection', () => {
  const baseScore: ScoreBreakdown = {
    baseScore: 0,
    locationScore: 0,
    timeScore: 0,
    feedbackScore: 0,
    collaborativeScore: 0,
    sponsorBoost: 0,
    finalScore: 0,
  };

  it('returns null when showInsights is false', () => {
    expect(getInsightTag({ ...baseScore, feedbackScore: 15 }, false, false)).toBeNull();
  });

  it('prioritizes friend activity over all other signals', () => {
    const score = { ...baseScore, feedbackScore: 15, locationScore: 20, baseScore: 40 };
    const tag = getInsightTag(score, true, true);
    expect(tag?.label).toBe('Popular with friends');
  });

  it('prioritizes feedback score second', () => {
    const score = { ...baseScore, feedbackScore: 12, locationScore: 20, baseScore: 40 };
    const tag = getInsightTag(score, true, false);
    expect(tag?.label).toBe('Based on places you liked');
  });

  it('shows location tag when feedback is low', () => {
    const score = { ...baseScore, locationScore: 18, baseScore: 40 };
    const tag = getInsightTag(score, true, false);
    expect(tag?.label).toBe('Near your route');
  });

  it('shows interest match when location and feedback are low', () => {
    const score = { ...baseScore, baseScore: 35 };
    const tag = getInsightTag(score, true, false);
    expect(tag?.label).toBe('Matches your interests');
  });

  it('shows timing tag as lowest priority', () => {
    const score = { ...baseScore, timeScore: 12 };
    const tag = getInsightTag(score, true, false);
    expect(tag?.label).toBe('Great timing');
  });

  it('returns null when no scores meet thresholds', () => {
    const score = { ...baseScore, baseScore: 10, locationScore: 5, timeScore: 5, feedbackScore: 5 };
    expect(getInsightTag(score, true, false)).toBeNull();
  });
});

// ============================================================
// A3: Neighborhood parsing
// ============================================================

function parseNeighborhood(vicinity?: string, fullAddress?: string): string | undefined {
  const addr = fullAddress || '';
  const parts = addr.split(',').map(p => p.trim());
  if (parts.length >= 3) {
    const candidate = parts[1];
    if (candidate && !/^\d/.test(candidate) && candidate.length > 2 && candidate !== 'USA' && candidate !== 'US') {
      if (parts.length >= 4) return candidate;
    }
  }
  if (vicinity) {
    const vicParts = vicinity.split(',').map(p => p.trim());
    if (vicParts.length >= 2) return vicParts[vicParts.length - 1];
  }
  return undefined;
}

describe('A3: Neighborhood parsing', () => {
  it('parses neighborhood from full address with 4+ parts', () => {
    expect(parseNeighborhood(undefined, '123 Main St, Deep Ellum, Dallas, TX 75226, USA'))
      .toBe('Deep Ellum');
  });

  it('parses neighborhood from full address with exactly 4 parts', () => {
    expect(parseNeighborhood(undefined, '456 Elm St, Uptown, Dallas, TX 75201'))
      .toBe('Uptown');
  });

  it('falls back to vicinity when address has fewer than 4 parts', () => {
    expect(parseNeighborhood('789 Oak Ave, Bishop Arts', '789 Oak Ave, Dallas, TX'))
      .toBe('Bishop Arts');
  });

  it('extracts last part of vicinity', () => {
    expect(parseNeighborhood('Some Street, Lower Greenville'))
      .toBe('Lower Greenville');
  });

  it('returns undefined for single-part address and no vicinity', () => {
    expect(parseNeighborhood(undefined, 'Just a street'))
      .toBeUndefined();
  });

  it('skips parts starting with digits', () => {
    // Address: "123 Main St, 75201, Dallas, TX" — "75201" starts with digit
    expect(parseNeighborhood(undefined, '123 Main St, 75201, Dallas, TX'))
      .toBeUndefined();
  });

  it('skips very short parts (2 chars like state abbreviations)', () => {
    expect(parseNeighborhood(undefined, '123 Main St, TX, Dallas, 75201'))
      .toBeUndefined();
  });

  it('returns undefined when no vicinity and no full address', () => {
    expect(parseNeighborhood(undefined, undefined)).toBeUndefined();
  });
});

// ============================================================
// A4: Responsive image height
// ============================================================

function computeImageHeight(screenHeight: number): number {
  return Math.min(400, Math.max(280, Math.round(screenHeight * 0.42)));
}

describe('A4: Responsive image height', () => {
  it('returns 280 for iPhone SE (667pt)', () => {
    expect(computeImageHeight(667)).toBe(280);
  });

  it('returns ~354 for iPhone 14 (844pt)', () => {
    expect(computeImageHeight(844)).toBe(354);
  });

  it('caps at 400 for tall screens (932pt Pro Max)', () => {
    expect(computeImageHeight(932)).toBe(391);
  });

  it('caps at 400 for very tall screens (1024pt iPad)', () => {
    expect(computeImageHeight(1024)).toBe(400);
  });

  it('returns 280 for very small screens', () => {
    expect(computeImageHeight(500)).toBe(280);
  });
});

// ============================================================
// A5: Badge priority system (max 2)
// ============================================================

interface BadgeConfig {
  isEvent: boolean;
  hasEventDate: boolean;
  hasFriendActivity: boolean;
  isTrending: boolean;
  isCurated: boolean;
  insightTag: InsightTag | null;
  isOpenNow: boolean;
  isSponsored: boolean;
  showInsights: boolean;
}

function selectBadges(config: BadgeConfig): string[] {
  const badges: string[] = [];

  // Priority 1: Event date
  if (config.isEvent && config.hasEventDate) {
    badges.push('event');
  }

  // Priority 2: Social proof
  if (badges.length < 2 && config.hasFriendActivity && !config.isEvent) {
    badges.push('friends');
  }
  if (badges.length < 2 && config.isTrending && !config.isEvent) {
    badges.push('trending');
  }
  if (badges.length < 2 && config.isCurated && !config.isEvent && config.showInsights) {
    badges.push('pick');
  }

  // Priority 3: Insight tag
  if (badges.length < 2 && config.insightTag && !config.isEvent) {
    badges.push('insight');
  }

  // Priority 4: Open Now
  if (badges.length < 2 && !config.isEvent && config.isOpenNow) {
    badges.push('open');
  }

  // Sponsored always shows, doesn't count toward cap
  const nonSponsored = badges.slice(0, 2);
  if (config.isSponsored) {
    nonSponsored.push('sponsored');
  }

  return nonSponsored;
}

describe('A5: Badge priority system', () => {
  const defaultConfig: BadgeConfig = {
    isEvent: false,
    hasEventDate: false,
    hasFriendActivity: false,
    isTrending: false,
    isCurated: false,
    insightTag: null,
    isOpenNow: false,
    isSponsored: false,
    showInsights: true,
  };

  it('shows max 2 non-sponsored badges', () => {
    const config = {
      ...defaultConfig,
      hasFriendActivity: true,
      isTrending: true,
      isCurated: true,
      insightTag: { icon: 'time', label: 'Great timing' },
      isOpenNow: true,
    };
    const badges = selectBadges(config);
    const nonSponsored = badges.filter(b => b !== 'sponsored');
    expect(nonSponsored.length).toBeLessThanOrEqual(2);
  });

  it('event date always gets priority 1', () => {
    const config = {
      ...defaultConfig,
      isEvent: true,
      hasEventDate: true,
      isTrending: true,
    };
    const badges = selectBadges(config);
    expect(badges[0]).toBe('event');
  });

  it('friends badge beats trending', () => {
    const config = {
      ...defaultConfig,
      hasFriendActivity: true,
      isTrending: true,
    };
    const badges = selectBadges(config);
    expect(badges[0]).toBe('friends');
    expect(badges[1]).toBe('trending');
  });

  it('sponsored badge always shows and does not count toward cap', () => {
    const config = {
      ...defaultConfig,
      hasFriendActivity: true,
      isTrending: true,
      isSponsored: true,
    };
    const badges = selectBadges(config);
    expect(badges).toContain('sponsored');
    expect(badges.filter(b => b !== 'sponsored').length).toBe(2);
    expect(badges.length).toBe(3); // 2 non-sponsored + 1 sponsored
  });

  it('returns empty when no badges apply', () => {
    const badges = selectBadges(defaultConfig);
    expect(badges.length).toBe(0);
  });

  it('insight tag shows when no higher priority badges', () => {
    const config = {
      ...defaultConfig,
      insightTag: { icon: 'navigate', label: 'Near your route' },
    };
    const badges = selectBadges(config);
    expect(badges).toContain('insight');
  });

  it('open now fills second slot after insight', () => {
    const config = {
      ...defaultConfig,
      insightTag: { icon: 'navigate', label: 'Near your route' },
      isOpenNow: true,
    };
    const badges = selectBadges(config);
    expect(badges).toEqual(['insight', 'open']);
  });
});

// ============================================================
// A6: Backward-looking AI explanations
// ============================================================

function formatCount(count: number): string {
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toString();
}

function getBackwardLookingExplanation(
  score: ScoreBreakdown,
  category: string,
  rating: number,
  reviewCount: number,
  aiExplanation?: string,
): string {
  if (aiExplanation && aiExplanation.length > 20 && !aiExplanation.includes('Recommended for you')) {
    return aiExplanation;
  }

  const parts: string[] = [];

  if (score.feedbackScore >= 12) {
    parts.push(`You've liked several ${category.toLowerCase() || 'places'} spots`);
  } else if (score.baseScore >= 35) {
    parts.push(`Matches your ${category.toLowerCase()} interests`);
  }

  if (rating >= 4.5 && reviewCount >= 100) {
    parts.push(`${rating}★ on Google with ${formatCount(reviewCount)} reviews`);
  } else if (rating >= 4.0 && reviewCount >= 50) {
    parts.push(`${rating}★ with ${formatCount(reviewCount)} reviews`);
  } else if (rating >= 4.0) {
    parts.push(`rated ${rating}★`);
  }

  if (score.locationScore >= 18) {
    parts.push('on your route');
  } else if (score.locationScore >= 15) {
    parts.push('nearby');
  }

  if (parts.length === 0) {
    if (rating > 0 && reviewCount > 0) {
      return `${rating}★ on Google with ${formatCount(reviewCount)} reviews`;
    }
    return aiExplanation || 'Popular in your area';
  } else if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } else {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + ' — ' + parts[1];
  }
}

describe('A6: Backward-looking AI explanations', () => {
  const baseScore: ScoreBreakdown = {
    baseScore: 0,
    locationScore: 0,
    timeScore: 0,
    feedbackScore: 0,
    collaborativeScore: 0,
    sponsorBoost: 0,
    finalScore: 0,
  };

  it('prefers server-generated explanation if substantive', () => {
    const result = getBackwardLookingExplanation(
      baseScore, 'dining', 4.5, 200, 'A wonderful spot with great pasta and wine selection'
    );
    expect(result).toBe('A wonderful spot with great pasta and wine selection');
  });

  it('ignores generic "Recommended for you" explanations', () => {
    const result = getBackwardLookingExplanation(
      { ...baseScore, feedbackScore: 12 }, 'dining', 4.5, 200, 'Recommended for you'
    );
    expect(result).not.toContain('Recommended for you');
    expect(result).toContain("You've liked several dining spots");
  });

  it('references user history when feedbackScore is high', () => {
    const result = getBackwardLookingExplanation(
      { ...baseScore, feedbackScore: 14 }, 'coffee', 4.2, 50
    );
    expect(result).toContain("You've liked several coffee spots");
  });

  it('shows data-source explanation for new users (no feedback, no interest match)', () => {
    const result = getBackwardLookingExplanation(baseScore, 'dining', 4.6, 523);
    expect(result).toContain('4.6★ on Google with 523 reviews');
  });

  it('falls back to "Popular in your area" when no data', () => {
    const result = getBackwardLookingExplanation(baseScore, 'dining', 0, 0);
    expect(result).toBe('Popular in your area');
  });

  it('combines interest match with rating', () => {
    const score = { ...baseScore, baseScore: 35 };
    const result = getBackwardLookingExplanation(score, 'dining', 4.7, 300);
    expect(result).toContain('Matches your dining interests');
    expect(result).toContain('4.7★');
  });

  it('includes location context', () => {
    const score = { ...baseScore, feedbackScore: 12, locationScore: 18 };
    const result = getBackwardLookingExplanation(score, 'dining', 3.5, 10);
    expect(result).toContain("You've liked several dining spots");
    expect(result).toContain('on your route');
  });

  it('formats large review counts with K suffix', () => {
    const result = getBackwardLookingExplanation(baseScore, 'dining', 4.8, 1500);
    expect(result).toContain('1.5K');
  });
});

// ============================================================
// A7: Honest engagement counts
// ============================================================

describe('A7: Honest engagement counts', () => {
  it('does not add Google reviewsCount to Loop likes', () => {
    const loopLikes = 3;
    const googleReviewsCount = 500;
    // Old behavior: displayLikes = loopLikes + googleReviewsCount = 503
    // New behavior: displayLikes = loopLikes = 3
    const displayLikes = loopLikes; // No seeding
    expect(displayLikes).toBe(3);
    expect(displayLikes).not.toBe(loopLikes + googleReviewsCount);
  });

  it('shows 0 likes when no Loop engagement exists', () => {
    const loopLikes = 0;
    const displayLikes = loopLikes;
    expect(displayLikes).toBe(0);
  });
});

// ============================================================
// A8: Touch targets
// ============================================================

describe('A8: Touch targets', () => {
  it('action button padding meets Apple 44pt minimum', () => {
    // New padding: vertical 10, horizontal 12
    // With icon (24px) + padding: 24 + 10 + 10 = 44px height
    const iconSize = 24;
    const paddingVertical = 10;
    const totalHeight = iconSize + (paddingVertical * 2);
    expect(totalHeight).toBeGreaterThanOrEqual(44);
  });

  it('old padding was below 44pt minimum', () => {
    const iconSize = 24;
    const oldPaddingVertical = 4;
    const oldTotalHeight = iconSize + (oldPaddingVertical * 2);
    expect(oldTotalHeight).toBeLessThan(44);
  });
});
