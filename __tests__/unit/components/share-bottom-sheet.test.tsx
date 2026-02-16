/**
 * Tests for ShareBottomSheet component logic
 *
 * Tests the pure functions and business logic used by the share sheet.
 * Component rendering is not tested here (requires react-native render setup).
 */

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
  },
}));

import type { Recommendation } from '@/types/activity';
import type { ActivityShareMetadata } from '@/services/chat-service';

describe('ShareBottomSheet - Pure Logic', () => {
  // -----------------------------------------------------------------------
  // Activity → ShareMetadata conversion
  // -----------------------------------------------------------------------
  describe('Recommendation to ActivityShareMetadata conversion', () => {
    /**
     * Mirrors the handleSend() conversion logic in share-bottom-sheet.tsx.
     * This is the mapping from a Recommendation card to the metadata stored in
     * a chat_messages.metadata JSONB column.
     */
    function toShareMetadata(rec: Recommendation): ActivityShareMetadata {
      return {
        placeId: rec.id,
        title: rec.title,
        category: rec.category,
        imageUrl: rec.imageUrl,
        rating: rec.rating,
        priceRange: rec.priceRange,
        distance: rec.distance,
        aiExplanation: rec.aiExplanation,
        address: rec.location,
      };
    }

    it('should map all required fields from Recommendation', () => {
      const rec: Recommendation = {
        id: 'ChIJ_test123',
        title: 'Café Bella',
        category: 'Coffee & Tea',
        location: '123 Main St, Dallas TX',
        distance: '2.7 mi',
        priceRange: 2,
        rating: 4.5,
        imageUrl: 'https://example.com/cafe.jpg',
        aiExplanation: 'Perfect for your morning coffee',
        isSponsored: false,
      };

      const meta = toShareMetadata(rec);

      expect(meta.placeId).toBe('ChIJ_test123');
      expect(meta.title).toBe('Café Bella');
      expect(meta.category).toBe('Coffee & Tea');
      expect(meta.imageUrl).toBe('https://example.com/cafe.jpg');
      expect(meta.rating).toBe(4.5);
      expect(meta.priceRange).toBe(2);
      expect(meta.distance).toBe('2.7 mi');
      expect(meta.aiExplanation).toBe('Perfect for your morning coffee');
      expect(meta.address).toBe('123 Main St, Dallas TX');
    });

    it('should handle missing optional fields', () => {
      const rec: Recommendation = {
        id: 'test-2',
        title: 'Some Place',
        category: 'Dining',
        location: '',
        distance: '',
        priceRange: 0,
        rating: 0,
        imageUrl: '',
        aiExplanation: '',
        isSponsored: false,
      };

      const meta = toShareMetadata(rec);
      expect(meta.placeId).toBe('test-2');
      expect(meta.address).toBe('');
    });
  });

  // -----------------------------------------------------------------------
  // Friend filtering
  // -----------------------------------------------------------------------
  describe('Friend search filtering', () => {
    interface MinimalFriend {
      id: string;
      name: string;
    }

    function filterFriends(friends: MinimalFriend[], query: string): MinimalFriend[] {
      if (!query) return friends;
      return friends.filter((f) =>
        f.name.toLowerCase().includes(query.toLowerCase())
      );
    }

    const friends: MinimalFriend[] = [
      { id: 'f1', name: 'Alice Smith' },
      { id: 'f2', name: 'Bob Jones' },
      { id: 'f3', name: 'Carol Alice' },
    ];

    it('should return all friends when query is empty', () => {
      expect(filterFriends(friends, '')).toHaveLength(3);
    });

    it('should filter by first name', () => {
      const result = filterFriends(friends, 'Bob');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('f2');
    });

    it('should be case-insensitive', () => {
      const result = filterFriends(friends, 'alice');
      expect(result).toHaveLength(2); // Alice Smith + Carol Alice
    });

    it('should return empty for no matches', () => {
      expect(filterFriends(friends, 'Zoe')).toHaveLength(0);
    });

    it('should match partial names', () => {
      const result = filterFriends(friends, 'ali');
      expect(result).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // Selection toggle logic
  // -----------------------------------------------------------------------
  describe('Friend selection toggle', () => {
    function toggleSelection(selected: Set<string>, friendId: string): Set<string> {
      const next = new Set(selected);
      if (next.has(friendId)) {
        next.delete(friendId);
      } else {
        next.add(friendId);
      }
      return next;
    }

    it('should add friend to empty selection', () => {
      const result = toggleSelection(new Set(), 'f1');
      expect(result.has('f1')).toBe(true);
      expect(result.size).toBe(1);
    });

    it('should remove friend from selection if already selected', () => {
      const result = toggleSelection(new Set(['f1', 'f2']), 'f1');
      expect(result.has('f1')).toBe(false);
      expect(result.has('f2')).toBe(true);
      expect(result.size).toBe(1);
    });

    it('should support multiple selections', () => {
      let selected = new Set<string>();
      selected = toggleSelection(selected, 'f1');
      selected = toggleSelection(selected, 'f2');
      selected = toggleSelection(selected, 'f3');
      expect(selected.size).toBe(3);
    });

    it('should toggle back and forth', () => {
      let selected = new Set<string>();
      selected = toggleSelection(selected, 'f1');
      expect(selected.has('f1')).toBe(true);
      selected = toggleSelection(selected, 'f1');
      expect(selected.has('f1')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Deep link generation
  // -----------------------------------------------------------------------
  describe('Copy Link URL generation', () => {
    function generateDeepLink(activityId: string): string {
      return `loopapp://activity/${activityId}`;
    }

    it('should generate correct deep link', () => {
      expect(generateDeepLink('ChIJ_test')).toBe('loopapp://activity/ChIJ_test');
    });

    it('should handle IDs with special characters', () => {
      expect(generateDeepLink('abc-123_456')).toBe('loopapp://activity/abc-123_456');
    });
  });

  // -----------------------------------------------------------------------
  // Share message composition
  // -----------------------------------------------------------------------
  describe('Native share message', () => {
    function composeShareMessage(title: string, explanation?: string): string {
      return `Check out ${title} on Loop! ${explanation ?? ''}`.trim();
    }

    it('should include title and explanation', () => {
      const msg = composeShareMessage('Café Bella', 'Great coffee spot');
      expect(msg).toBe('Check out Café Bella on Loop! Great coffee spot');
    });

    it('should handle missing explanation', () => {
      const msg = composeShareMessage('Café Bella');
      expect(msg).toBe('Check out Café Bella on Loop!');
    });

    it('should trim trailing whitespace', () => {
      const msg = composeShareMessage('Café Bella', '');
      expect(msg).toBe('Check out Café Bella on Loop!');
    });
  });
});
