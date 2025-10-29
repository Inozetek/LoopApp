// @ts-nocheck - Type interface differences between Activity and Recommendation
import { Activity, RecommendationScore, Recommendation } from '@/types/activity';
import { UserProfile } from '@/types/database';

/**
 * Core recommendation scoring algorithm (MVP version)
 * Based on CLAUDE.md scoring system:
 * - Base score: 40 points (interest match)
 * - Location score: 20 points (distance/route)
 * - Time context: 15 points (time of day)
 * - Feedback history: 15 points (past ratings)
 * - Collaborative: 10 points (similar users)
 * - Sponsor boost: +15-30% (after base scoring)
 */

interface ScoringContext {
  userLocation?: { latitude: number; longitude: number };
  currentTime?: Date;
  userInterests: string[];
  maxDistance?: number; // in miles
  feedbackHistory?: {
    likedCategories: string[];
    dislikedCategories: string[];
    preferredPriceRange: number[];
  };
}

/**
 * Calculate recommendation score for an activity
 */
export function calculateActivityScore(
  activity: Activity,
  context: ScoringContext
): RecommendationScore {
  let baseScore = calculateBaseScore(activity, context.userInterests);
  let locationScore = calculateLocationScore(activity, context);
  let timeScore = calculateTimeScore(activity, context.currentTime);
  let feedbackScore = calculateFeedbackScore(activity, context.feedbackHistory);
  let collaborativeScore = 5; // Default for MVP (no collaborative filtering yet)

  // Total before sponsor boost
  const totalBeforeSponsor = baseScore + locationScore + timeScore + feedbackScore + collaborativeScore;

  // Apply sponsor boost (but cap if base score is too low)
  let sponsorBoost = 0;
  if (activity.isSponsored) {
    const boostPercent = activity.sponsorTier === 'premium' ? 0.3 :
                        activity.sponsorTier === 'boosted' ? 0.15 : 0;

    // Critical rule: If base score < 40, cap boost at +10 points
    if (totalBeforeSponsor < 40) {
      sponsorBoost = Math.min(totalBeforeSponsor * boostPercent, 10);
    } else {
      sponsorBoost = totalBeforeSponsor * boostPercent;
    }
  }

  const finalScore = totalBeforeSponsor + sponsorBoost;

  return {
    baseScore,
    locationScore,
    timeScore,
    feedbackScore,
    collaborativeScore,
    sponsorBoost,
    finalScore,
  };
}

/**
 * Calculate base score (0-40 points) based on interest match
 */
function calculateBaseScore(activity: Activity, userInterests: string[]): number {
  const normalizedInterests = userInterests.map(i => i.toLowerCase());
  const activityCategory = activity.category.toLowerCase();

  // Check if category is in user's top 3 interests
  const topThreeInterests = normalizedInterests.slice(0, 3);
  if (topThreeInterests.includes(activityCategory)) {
    return 40; // Perfect match
  }

  // Check if in any interests
  if (normalizedInterests.includes(activityCategory)) {
    return 30; // Good match
  }

  // Check for related categories
  const relatedMatches = findRelatedCategories(activityCategory, normalizedInterests);
  if (relatedMatches > 0) {
    return 20; // Partial match
  }

  // No match, but still eligible
  return 10; // Base score for variety
}

/**
 * Calculate location score (0-20 points) based on distance
 */
function calculateLocationScore(
  activity: Activity,
  context: ScoringContext
): number {
  if (!activity.distance) return 10; // Default if distance unknown

  const maxDistance = context.maxDistance || 5;

  // On commute route (within 0.5 miles) - highest priority
  if (activity.distance <= 0.5) return 20;

  // Near home/work (within 1 mile)
  if (activity.distance <= 1) return 15;

  // Within preferred distance
  if (activity.distance <= maxDistance) {
    // Score decreases linearly with distance
    const ratio = 1 - (activity.distance / maxDistance);
    return Math.floor(10 + (5 * ratio));
  }

  // Too far, but still show it
  return 5;
}

/**
 * Calculate time context score (0-15 points)
 */
function calculateTimeScore(activity: Activity, currentTime: Date = new Date()): number {
  const hour = currentTime.getHours();
  const category = activity.category.toLowerCase();

  // Morning (6-11am)
  if (hour >= 6 && hour < 11) {
    if (['coffee', 'breakfast', 'fitness', 'outdoor'].includes(category)) return 15;
    return 8;
  }

  // Lunch (11am-2pm)
  if (hour >= 11 && hour < 14) {
    if (['dining', 'coffee', 'restaurant'].includes(category)) return 15;
    return 8;
  }

  // Afternoon (2-5pm)
  if (hour >= 14 && hour < 17) {
    if (['shopping', 'arts', 'culture', 'outdoor'].includes(category)) return 15;
    return 10;
  }

  // Evening (5-9pm)
  if (hour >= 17 && hour < 21) {
    if (['dining', 'bars', 'entertainment', 'live music'].includes(category)) return 15;
    return 10;
  }

  // Night (9pm+)
  if (hour >= 21 || hour < 6) {
    if (['bars', 'nightlife', 'entertainment'].includes(category)) return 15;
    return 5;
  }

  return 10; // Default
}

/**
 * Calculate feedback score (0-15 points) based on past ratings
 */
function calculateFeedbackScore(
  activity: Activity,
  feedbackHistory?: {
    likedCategories: string[];
    dislikedCategories: string[];
    preferredPriceRange: number[];
  }
): number {
  if (!feedbackHistory) return 8; // Neutral for new users

  const category = activity.category.toLowerCase();
  let score = 8;

  // Past thumbs up on similar category
  if (feedbackHistory.likedCategories.includes(category)) {
    score += 7;
  }

  // Past thumbs down on similar category
  if (feedbackHistory.dislikedCategories.includes(category)) {
    score -= 5;
  }

  // Price range match
  if (feedbackHistory.preferredPriceRange.includes(activity.priceRange)) {
    score += 3;
  }

  return Math.max(0, Math.min(15, score));
}

/**
 * Find related categories (e.g., "bars" relates to "nightlife")
 */
function findRelatedCategories(category: string, userInterests: string[]): number {
  const relatedMap: Record<string, string[]> = {
    'coffee': ['dining', 'breakfast'],
    'bars': ['nightlife', 'entertainment', 'live music'],
    'dining': ['coffee', 'bars'],
    'fitness': ['outdoor', 'wellness', 'sports'],
    'arts': ['culture', 'entertainment'],
    'live music': ['bars', 'nightlife', 'entertainment'],
    'shopping': ['arts', 'culture'],
  };

  const relatedCategories = relatedMap[category] || [];
  return relatedCategories.filter(rc => userInterests.includes(rc)).length;
}

/**
 * Generate recommendations from activities with scoring
 * Now uses AI profile data collected from user feedback!
 */
export function generateRecommendations(
  activities: Activity[],
  user: UserProfile,
  context: Partial<ScoringContext> = {}
): Recommendation[] {
  // Parse preferences and AI profile from JSON
  const preferences = (user.preferences || {}) as any;
  const aiProfile = (user.ai_profile || {
    preferred_distance_miles: 5.0,
    budget_level: 2,
    favorite_categories: [],
    disliked_categories: [],
    price_sensitivity: 'medium',
    time_preferences: [],
    distance_tolerance: 'medium',
  }) as any;

  // Build enhanced scoring context using AI-learned preferences
  const scoringContext: ScoringContext = {
    userInterests: (user.interests || []) as string[],
    maxDistance: aiProfile.preferred_distance_miles || preferences.max_distance_miles || 5,
    currentTime: new Date(),
    feedbackHistory: {
      likedCategories: aiProfile.favorite_categories || [],
      dislikedCategories: aiProfile.disliked_categories || [],
      preferredPriceRange: [aiProfile.budget_level || 2],
    },
    ...context,
  };

  // Score all activities
  const scored = activities.map(activity => {
    const score = calculateActivityScore(activity, scoringContext);
    return {
      activity,
      score,
    };
  });

  // Sort by final score (high to low)
  scored.sort((a, b) => b.score.finalScore - a.score.finalScore);

  // Apply business rules
  const filtered = applyBusinessRules(scored);

  // Convert to Recommendation objects
  return filtered.map((item, index) => ({
    id: `rec-${item.activity.id}-${Date.now()}`,
    activity: item.activity,
    score: item.score,
    reason: generateReason(item.activity, item.score, scoringContext),
    recommendedFor: new Date(),
    confidence: Math.min(item.score.finalScore / 100, 1),
    status: 'pending',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  }));
}

/**
 * Apply business rules to recommendations
 */
function applyBusinessRules(
  scored: Array<{ activity: Activity; score: RecommendationScore }>
): Array<{ activity: Activity; score: RecommendationScore }> {
  const result: typeof scored = [];
  const seenBusinesses = new Set<string>();
  const categoryCount: Record<string, number> = {};
  let sponsoredInTop5 = 0;

  for (const item of scored) {
    // Never show same business twice
    if (seenBusinesses.has(item.activity.name)) continue;

    // Max 2 sponsored activities in top 5 (40% sponsored mix)
    if (result.length < 5 && item.activity.isSponsored) {
      if (sponsoredInTop5 >= 2) continue;
      sponsoredInTop5++;
    }

    // Diversity requirement: At least 3 different categories in top 5
    if (result.length < 5) {
      categoryCount[item.activity.category] = (categoryCount[item.activity.category] || 0) + 1;
      const uniqueCategories = Object.keys(categoryCount).length;
      const sameCategory = categoryCount[item.activity.category];

      // Don't allow >2 of same category in top 5 if we have <3 unique categories
      if (uniqueCategories < 3 && sameCategory > 2) continue;
    }

    seenBusinesses.add(item.activity.name);
    result.push(item);

    // Return top 10
    if (result.length >= 10) break;
  }

  return result;
}

/**
 * Generate AI-like explanation for why this activity was recommended
 */
function generateReason(
  activity: Activity,
  score: RecommendationScore,
  context: ScoringContext
): string {
  const reasons: string[] = [];

  // Interest match
  if (score.baseScore >= 30) {
    const matchedInterest = context.userInterests.find(
      i => i.toLowerCase() === activity.category.toLowerCase()
    );
    if (matchedInterest) {
      reasons.push(`Perfect for your interest in ${matchedInterest.toLowerCase()}`);
    }
  }

  // Location proximity
  if (score.locationScore >= 15 && activity.distance) {
    reasons.push(`Just ${activity.distance.toFixed(1)} miles away`);
  }

  // Time relevance
  if (score.timeScore >= 12) {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    reasons.push(`Great for ${timeOfDay} activities`);
  }

  // High rating
  if (activity.rating && activity.rating >= 4.5) {
    reasons.push(`Highly rated (${activity.rating.toFixed(1)}⭐)`);
  }

  // Combine reasons
  if (reasons.length === 0) {
    return `Discover something new in ${activity.location.city || 'your area'}`;
  }

  if (reasons.length === 1) {
    return reasons[0];
  }

  return `${reasons[0]}, ${reasons[1]}`;
}
