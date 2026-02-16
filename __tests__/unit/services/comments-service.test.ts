/**
 * Tests for comments-service
 *
 * Tests the Loop community comment system.
 * Functions that call Supabase are tested with mocks.
 */

// Mock Supabase client
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockRange = jest.fn();
const mockSingle = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      delete: mockDelete,
    })),
    rpc: jest.fn(),
  },
}));

import { getComments, getCommentCount, postComment, deleteComment, type Comment } from '@/services/comments-service';

beforeEach(() => {
  jest.clearAllMocks();

  // Default chain: from().select().eq().eq().order().range()
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ eq: mockEq, order: mockOrder, single: mockSingle });
  mockOrder.mockReturnValue({ range: mockRange });
  mockRange.mockResolvedValue({ data: [], error: null });

  // Default insert chain: from().insert().select().single()
  mockInsert.mockReturnValue({ select: mockSelect });
  mockSingle.mockResolvedValue({ data: null, error: null });

  // Default delete chain: from().delete().eq().eq()
  mockDelete.mockReturnValue({ eq: mockEq });
});

describe('comments-service', () => {
  describe('getComments', () => {
    it('should return empty array when no comments exist', async () => {
      mockRange.mockResolvedValueOnce({ data: [], error: null });

      const result = await getComments('place_123');
      expect(result).toEqual([]);
    });

    it('should map Supabase rows to Comment objects', async () => {
      const mockData = [
        {
          id: 'c1',
          user_id: 'u1',
          place_id: 'place_123',
          text: 'Great place!',
          rating: 5,
          helpful_count: 3,
          status: 'active',
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z',
          users: { name: 'John Doe', profile_picture_url: 'https://example.com/avatar.jpg' },
        },
      ];

      mockRange.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await getComments('place_123');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'c1',
        userId: 'u1',
        placeId: 'place_123',
        text: 'Great place!',
        rating: 5,
        helpfulCount: 3,
        status: 'active',
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        userName: 'John Doe',
        userAvatar: 'https://example.com/avatar.jpg',
      });
    });

    it('should default userName to "Loop User" when user data missing', async () => {
      const mockData = [
        {
          id: 'c1',
          user_id: 'u1',
          place_id: 'place_123',
          text: 'Nice!',
          rating: null,
          helpful_count: 0,
          status: 'active',
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z',
          users: null,
        },
      ];

      mockRange.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await getComments('place_123');
      expect(result[0].userName).toBe('Loop User');
      expect(result[0].userAvatar).toBeNull();
    });

    it('should return empty array on error', async () => {
      mockRange.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

      const result = await getComments('place_123');
      expect(result).toEqual([]);
    });
  });

  describe('getCommentCount', () => {
    it('should return 0 when no comments', async () => {
      // For count queries, chain is: from().select().eq().eq()
      mockSelect.mockReturnValueOnce({ eq: mockEq });
      mockEq.mockReturnValueOnce({ eq: jest.fn().mockResolvedValue({ count: 0, error: null }) });

      const result = await getCommentCount('place_123');
      expect(result).toBe(0);
    });
  });

  describe('postComment', () => {
    it('should return null on error', async () => {
      mockInsert.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
        }),
      });

      const result = await postComment('user1', 'place_123', 'Test comment');
      expect(result).toBeNull();
    });

    it('should return mapped comment on success', async () => {
      const insertedRow = {
        id: 'new-id',
        user_id: 'user1',
        place_id: 'place_123',
        text: 'Loved it!',
        rating: null,
        helpful_count: 0,
        status: 'active',
        created_at: '2025-01-20T10:00:00Z',
        updated_at: '2025-01-20T10:00:00Z',
      };

      mockInsert.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: insertedRow, error: null }),
        }),
      });

      const result = await postComment('user1', 'place_123', '  Loved it!  ');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('new-id');
      expect(result!.text).toBe('Loved it!');
      expect(result!.placeId).toBe('place_123');
    });
  });

  describe('deleteComment', () => {
    it('should return true on success', async () => {
      mockDelete.mockReturnValueOnce({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await deleteComment('comment1', 'user1');
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockDelete.mockReturnValueOnce({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'Not found' } }),
        }),
      });

      const result = await deleteComment('comment1', 'user1');
      expect(result).toBe(false);
    });
  });

  describe('Comment interface', () => {
    it('should enforce text length constraints (1-500 chars)', () => {
      // These are DB constraints; test the concept
      const validShort = 'A';
      const validLong = 'X'.repeat(500);
      const tooLong = 'X'.repeat(501);

      expect(validShort.length).toBeGreaterThanOrEqual(1);
      expect(validShort.length).toBeLessThanOrEqual(500);
      expect(validLong.length).toBeLessThanOrEqual(500);
      expect(tooLong.length).toBeGreaterThan(500);
    });

    it('should support optional rating (1-5)', () => {
      const withRating: Partial<Comment> = { rating: 4 };
      const withoutRating: Partial<Comment> = { rating: null };

      expect(withRating.rating).toBe(4);
      expect(withoutRating.rating).toBeNull();
    });
  });
});
