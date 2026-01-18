/**
 * Review Topic Extraction Utility
 * Extracts common themes from review text (e.g., "Great food", "Friendly staff")
 */

import type { PlaceReview } from '@/services/google-places';

export interface ReviewTopic {
  topic: string;
  count: number;
  sentiment: 'positive' | 'negative' | 'neutral';
}

// Common positive and negative keywords
const POSITIVE_KEYWORDS = [
  'great', 'excellent', 'amazing', 'fantastic', 'love', 'best',
  'delicious', 'friendly', 'clean', 'fresh', 'tasty', 'perfect',
  'helpful', 'quick', 'fast', 'awesome', 'wonderful', 'good',
];

const NEGATIVE_KEYWORDS = [
  'bad', 'terrible', 'awful', 'disgusting', 'slow', 'rude',
  'dirty', 'cold', 'overpriced', 'expensive', 'poor', 'worst',
];

// Topic categories with related keywords
const TOPIC_CATEGORIES: Record<string, string[]> = {
  food: ['food', 'meal', 'dish', 'menu', 'breakfast', 'lunch', 'dinner', 'dessert', 'burger', 'pizza', 'sushi', 'salad'],
  service: ['service', 'staff', 'waiter', 'waitress', 'server', 'host', 'manager', 'team'],
  atmosphere: ['atmosphere', 'ambiance', 'vibe', 'decor', 'music', 'lighting', 'seating', 'patio'],
  price: ['price', 'value', 'affordable', 'cheap', 'worth'],
  cleanliness: ['clean', 'spotless', 'neat', 'tidy', 'hygiene'],
  location: ['location', 'parking', 'convenient', 'accessible'],
};

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Extract review topics from a list of reviews
 * Returns top topics with sentiment analysis
 */
export function extractReviewTopics(reviews: PlaceReview[]): ReviewTopic[] {
  const topicCounts = new Map<string, { count: number; sentiment: 'positive' | 'negative' }>();

  reviews.forEach(review => {
    const text = review.text.text.toLowerCase();
    const rating = review.rating;

    // Overall sentiment from rating
    const overallSentiment: 'positive' | 'negative' = rating >= 4 ? 'positive' : 'negative';

    // Extract topics based on keyword matches
    Object.entries(TOPIC_CATEGORIES).forEach(([category, keywords]) => {
      const categoryMatched = keywords.some(keyword => text.includes(keyword));

      if (categoryMatched) {
        // Find positive/negative adjectives near this category
        const positiveMatch = POSITIVE_KEYWORDS.find(adj => text.includes(adj));
        const negativeMatch = NEGATIVE_KEYWORDS.find(adj => text.includes(adj));

        let topicLabel = '';
        let topicSentiment: 'positive' | 'negative' = overallSentiment;

        if (positiveMatch) {
          topicLabel = `${capitalize(positiveMatch)} ${category}`;
          topicSentiment = 'positive';
        } else if (negativeMatch) {
          topicLabel = `${capitalize(negativeMatch)} ${category}`;
          topicSentiment = 'negative';
        } else {
          topicLabel = capitalize(category);
        }

        const existing = topicCounts.get(topicLabel);
        if (existing) {
          existing.count++;
        } else {
          topicCounts.set(topicLabel, { count: 1, sentiment: topicSentiment });
        }
      }
    });
  });

  // Convert to array and sort by count (most common first)
  const topics: ReviewTopic[] = Array.from(topicCounts.entries())
    .map(([topic, data]) => ({
      topic,
      count: data.count,
      sentiment: data.sentiment,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8); // Top 8 topics

  return topics;
}
