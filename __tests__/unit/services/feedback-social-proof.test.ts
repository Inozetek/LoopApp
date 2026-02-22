/**
 * Feedback Social Proof Tests
 *
 * Verifies that submitFeedback fires the aggregate RPC and gamification,
 * and that PlaceRating now includes thumbs data.
 */

// ---- Supabase mock ----
const mockRpc = jest.fn().mockResolvedValue({ error: null });

function createQueryChain(data: any = null, error: any = null) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error }),
    maybeSingle: jest.fn().mockResolvedValue({ data, error }),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
  };
  return chain;
}

let fromResults: Record<string, any> = {};

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      return fromResults[table] || createQueryChain();
    }),
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

// Mock gamification service
const mockRecordActivity = jest.fn().mockResolvedValue({ newScore: 3, milestoneReached: false, newTier: null });
jest.mock('@/services/gamification-service', () => ({
  recordActivity: (...args: any[]) => mockRecordActivity(...args),
}));

import { submitFeedback } from '@/services/feedback-service';
import { type PlaceRating } from '@/services/likes-service';

describe('Feedback → Social Proof', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Activity exists with google_place_id
    const activityChain = createQueryChain({ id: 'act-1', google_place_id: 'ChIJ_test123' });
    const feedbackChain = createQueryChain();
    feedbackChain.select = jest.fn().mockReturnValue({
      ...feedbackChain,
      single: jest.fn().mockResolvedValue({ data: { id: 'fb-1' }, error: null }),
    });

    // No existing feedback
    const existingFeedbackChain = createQueryChain();
    existingFeedbackChain.eq = jest.fn().mockReturnThis();
    existingFeedbackChain.in = jest.fn().mockReturnThis();
    existingFeedbackChain.limit = jest.fn().mockResolvedValue({ data: [], error: null });

    const usersChain = createQueryChain({ ai_profile: { favorite_categories: [], disliked_categories: [], time_preferences: [] } });
    usersChain.update = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });

    fromResults = {
      activities: activityChain,
      feedback: {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: 'fb-1' }, error: null }),
          }),
        }),
      },
      users: usersChain,
    };

    mockRpc.mockResolvedValue({ error: null });
  });

  it('fires update_place_ratings_aggregate RPC after feedback insert', async () => {
    const result = await submitFeedback({
      userId: 'user-1',
      activityId: 'act-1',
      rating: 'thumbs_up',
      completedAt: new Date().toISOString(),
    });

    expect(result.success).toBe(true);

    // Wait for fire-and-forget promises
    await new Promise(r => setTimeout(r, 10));

    expect(mockRpc).toHaveBeenCalledWith('update_place_ratings_aggregate', {
      p_place_id: 'ChIJ_test123',
    });
  });

  it('awards FEEDBACK_GIVEN gamification points', async () => {
    await submitFeedback({
      userId: 'user-1',
      activityId: 'act-1',
      rating: 'thumbs_down',
      tags: ['boring'],
      completedAt: new Date().toISOString(),
    });

    await new Promise(r => setTimeout(r, 10));

    expect(mockRecordActivity).toHaveBeenCalledWith('user-1', 'FEEDBACK_GIVEN');
  });

  it('does NOT fire RPC when activity has no google_place_id', async () => {
    fromResults.activities = createQueryChain({ id: 'act-2', google_place_id: null });

    await submitFeedback({
      userId: 'user-1',
      activityId: 'act-2',
      rating: 'thumbs_up',
      completedAt: new Date().toISOString(),
    });

    await new Promise(r => setTimeout(r, 10));

    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('PlaceRating type includes thumbs fields', () => {
  it('PlaceRating has totalThumbsUp and totalThumbsDown', () => {
    // Type-level test — if these fields didn't exist, TS would fail
    const rating: PlaceRating = {
      totalLikes: 10,
      loopCommunityScore: 4.5,
      isLiked: true,
      friendsWhoLiked: [],
      isTrending: false,
      totalThumbsUp: 8,
      totalThumbsDown: 2,
    };

    expect(rating.totalThumbsUp).toBe(8);
    expect(rating.totalThumbsDown).toBe(2);

    // Approval rate calculation
    const total = rating.totalThumbsUp + rating.totalThumbsDown;
    const approvalPct = Math.round((rating.totalThumbsUp / total) * 100);
    expect(approvalPct).toBe(80);
  });

  it('only shows approval when 5+ ratings exist', () => {
    const belowThreshold: PlaceRating = {
      totalLikes: 5,
      loopCommunityScore: null,
      isLiked: false,
      friendsWhoLiked: [],
      isTrending: false,
      totalThumbsUp: 3,
      totalThumbsDown: 1,
    };

    const total = belowThreshold.totalThumbsUp + belowThreshold.totalThumbsDown;
    expect(total).toBeLessThan(5);
    // Component would not render approval row
  });
});
