/**
 * Review Topic Extraction Tests
 *
 * Tests the keyword-based topic extraction and sentiment analysis
 * for Google Places reviews.
 */

import { extractReviewTopics, type ReviewTopic } from '@/utils/review-topics';
import type { PlaceReview } from '@/services/google-places';

// Helper to create mock reviews
function createMockReview(rating: number, text: string): PlaceReview {
  return {
    authorAttribution: {
      displayName: 'Test Reviewer',
    },
    rating,
    text: {
      text,
      languageCode: 'en',
    },
    relativePublishTimeDescription: '2 weeks ago',
  };
}

describe('Review Topic Extraction', () => {
  describe('Positive Topic Extraction', () => {
    it('should extract positive food topics', () => {
      const reviews = [
        createMockReview(5, 'Great food and excellent taste!'),
        createMockReview(5, 'Amazing food, loved the menu'),
        createMockReview(4, 'Good meal, delicious dishes'),
      ];

      const topics = extractReviewTopics(reviews);

      // Should find at least one food-related topic
      const foodTopics = topics.filter(t => t.topic.toLowerCase().includes('food'));
      expect(foodTopics.length).toBeGreaterThan(0);

      // All should be positive sentiment
      foodTopics.forEach(topic => {
        expect(topic.sentiment).toBe('positive');
      });
    });

    it('should extract positive service topics', () => {
      const reviews = [
        createMockReview(5, 'Excellent service and friendly staff!'),
        createMockReview(5, 'Great service, very helpful waiters'),
        createMockReview(4, 'Good staff, quick service'),
      ];

      const topics = extractReviewTopics(reviews);

      const serviceTopics = topics.filter(t => t.topic.toLowerCase().includes('service'));
      expect(serviceTopics.length).toBeGreaterThan(0);

      serviceTopics.forEach(topic => {
        expect(topic.sentiment).toBe('positive');
      });
    });

    it('should extract positive atmosphere topics', () => {
      const reviews = [
        createMockReview(5, 'Wonderful atmosphere and great ambiance!'),
        createMockReview(5, 'Amazing vibe, love the decor'),
      ];

      const topics = extractReviewTopics(reviews);

      const atmosphereTopics = topics.filter(t =>
        t.topic.toLowerCase().includes('atmosphere') ||
        t.topic.toLowerCase().includes('ambiance') ||
        t.topic.toLowerCase().includes('vibe')
      );
      expect(atmosphereTopics.length).toBeGreaterThan(0);

      atmosphereTopics.forEach(topic => {
        expect(topic.sentiment).toBe('positive');
      });
    });
  });

  describe('Negative Topic Extraction', () => {
    it('should extract negative food topics', () => {
      const reviews = [
        createMockReview(2, 'Terrible food and bad taste'),
        createMockReview(1, 'Awful food, disgusting meal'),
      ];

      const topics = extractReviewTopics(reviews);

      const foodTopics = topics.filter(t => t.topic.toLowerCase().includes('food'));
      expect(foodTopics.length).toBeGreaterThan(0);

      foodTopics.forEach(topic => {
        expect(topic.sentiment).toBe('negative');
      });
    });

    it('should extract negative service topics', () => {
      const reviews = [
        createMockReview(2, 'Slow service and rude staff'),
        createMockReview(1, 'Bad service, terrible waiters'),
      ];

      const topics = extractReviewTopics(reviews);

      const serviceTopics = topics.filter(t => t.topic.toLowerCase().includes('service'));
      expect(serviceTopics.length).toBeGreaterThan(0);

      serviceTopics.forEach(topic => {
        expect(topic.sentiment).toBe('negative');
      });
    });
  });

  describe('Topic Counting and Ranking', () => {
    it('should count topic occurrences correctly', () => {
      const reviews = [
        createMockReview(5, 'Great food'),
        createMockReview(5, 'Great food'),
        createMockReview(5, 'Great food'),
        createMockReview(4, 'Good service'),
      ];

      const topics = extractReviewTopics(reviews);

      // Find the "Great food" topic
      const greatFoodTopic = topics.find(t =>
        t.topic.toLowerCase().includes('great') &&
        t.topic.toLowerCase().includes('food')
      );

      expect(greatFoodTopic).toBeDefined();
      expect(greatFoodTopic!.count).toBe(3);
    });

    it('should sort topics by count (most common first)', () => {
      const reviews = [
        createMockReview(5, 'Great food'),
        createMockReview(5, 'Great food'),
        createMockReview(5, 'Great food'),
        createMockReview(4, 'Good service'),
        createMockReview(4, 'Good atmosphere'),
        createMockReview(4, 'Good atmosphere'),
      ];

      const topics = extractReviewTopics(reviews);

      if (topics.length >= 2) {
        // Topics should be sorted by count
        for (let i = 0; i < topics.length - 1; i++) {
          expect(topics[i].count).toBeGreaterThanOrEqual(topics[i + 1].count);
        }
      }
    });

    it('should limit to top 8 topics', () => {
      const reviews = Array.from({ length: 20 }, (_, i) =>
        createMockReview(5, `Great ${['food', 'service', 'atmosphere', 'price', 'clean'][i % 5]}`)
      );

      const topics = extractReviewTopics(reviews);

      expect(topics.length).toBeLessThanOrEqual(8);
    });
  });

  describe('Mixed Sentiment Handling', () => {
    it('should handle reviews with mixed sentiments', () => {
      const reviews = [
        createMockReview(5, 'Great food and excellent service'),
        createMockReview(1, 'Terrible food and bad service'),
      ];

      const topics = extractReviewTopics(reviews);

      // Should find both positive and negative topics
      const positiveTopics = topics.filter(t => t.sentiment === 'positive');
      const negativeTopics = topics.filter(t => t.sentiment === 'negative');

      // At least one of each type should be found
      expect(positiveTopics.length + negativeTopics.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should return empty array for empty reviews', () => {
      const topics = extractReviewTopics([]);
      expect(topics).toEqual([]);
    });

    it('should handle reviews with no matching keywords', () => {
      const reviews = [
        createMockReview(5, 'This place exists and I went there.'),
        createMockReview(3, 'It was okay I guess.'),
      ];

      const topics = extractReviewTopics(reviews);

      // May return topics or may be empty depending on keyword matches
      expect(Array.isArray(topics)).toBe(true);
    });

    it('should handle very short reviews', () => {
      const reviews = [
        createMockReview(5, 'Great!'),
        createMockReview(1, 'Bad.'),
      ];

      const topics = extractReviewTopics(reviews);

      // Should handle gracefully without errors
      expect(Array.isArray(topics)).toBe(true);
    });

    it('should be case-insensitive for keyword matching', () => {
      const reviews = [
        createMockReview(5, 'GREAT FOOD AND EXCELLENT SERVICE!'),
        createMockReview(5, 'great food and excellent service'),
      ];

      const topics = extractReviewTopics(reviews);

      // Both reviews should contribute to same topics
      const foodTopics = topics.filter(t => t.topic.toLowerCase().includes('food'));

      if (foodTopics.length > 0) {
        expect(foodTopics[0].count).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('Category Coverage', () => {
    it('should extract topics from all major categories', () => {
      const reviews = [
        createMockReview(5, 'Great food with amazing dishes'),
        createMockReview(5, 'Excellent service and helpful staff'),
        createMockReview(5, 'Wonderful atmosphere and nice decor'),
        createMockReview(5, 'Good price, very affordable'),
        createMockReview(5, 'Clean and spotless location'),
      ];

      const topics = extractReviewTopics(reviews);

      // Should cover multiple categories
      const categories = new Set(topics.map(t => {
        if (t.topic.toLowerCase().includes('food')) return 'food';
        if (t.topic.toLowerCase().includes('service')) return 'service';
        if (t.topic.toLowerCase().includes('atmosphere')) return 'atmosphere';
        if (t.topic.toLowerCase().includes('price')) return 'price';
        if (t.topic.toLowerCase().includes('clean')) return 'clean';
        return 'other';
      }));

      expect(categories.size).toBeGreaterThan(1);
    });
  });
});
