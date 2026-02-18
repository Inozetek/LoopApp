/**
 * Tests for automatic feedback prompt logic
 *
 * Tests the auto-detection of past events needing feedback
 * and the updated shouldPromptForFeedback priority logic.
 */

// Replicate types
interface CompletedActivity {
  eventId: string;
  activityId: string | null;
  activityName: string;
  activityCategory: string;
  completedAt: string;
  recommendationId: string | null;
  place?: { id: string; name: string; address?: string };
}

// Replicate the filtering/dedup logic used in getPastEventsNeedingFeedback

interface PastEvent {
  id: string;
  title: string;
  category: string | null;
  activity_id: string | null;
  end_time: string;
  completed_at: string | null;
  status: string;
  address: string;
  google_place_id: string | null;
}

function filterPastEventsNeedingFeedback(
  events: PastEvent[],
  feedbackActivityIds: Set<string>,
  now: Date,
  windowHours: number = 48,
): CompletedActivity[] {
  const cutoff = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

  return events
    .filter((event) => {
      // Must be in time window
      const endTime = new Date(event.end_time);
      if (endTime >= now || endTime <= cutoff) return false;
      // Must not be cancelled
      if (event.status !== 'scheduled' && event.status !== 'completed') return false;
      // Must not already have feedback
      if (event.activity_id && feedbackActivityIds.has(event.activity_id)) return false;
      return true;
    })
    .map((event) => ({
      eventId: event.id,
      activityId: event.activity_id,
      activityName: event.title,
      activityCategory: event.category || 'other',
      completedAt: event.completed_at || event.end_time,
      recommendationId: null,
      place: event.google_place_id || event.activity_id ? {
        id: event.google_place_id || event.activity_id || event.id,
        name: event.title,
        address: event.address || undefined,
      } : undefined,
    }));
}

// Replicate shouldPromptForFeedback priority logic
function shouldPromptForFeedback(
  completedPending: CompletedActivity[],
  pastPending: CompletedActivity[],
): { shouldPrompt: boolean; activity?: CompletedActivity } {
  if (completedPending.length > 0) {
    return { shouldPrompt: true, activity: completedPending[0] };
  }
  if (pastPending.length > 0) {
    return { shouldPrompt: true, activity: pastPending[0] };
  }
  return { shouldPrompt: false };
}

// Replicate dedup logic from index.tsx pending count
function countPendingFeedback(
  completed: CompletedActivity[],
  past: CompletedActivity[],
): number {
  const seenIds = new Set(completed.map((a) => a.eventId));
  const uniquePast = past.filter((a) => !seenIds.has(a.eventId));
  return completed.length + uniquePast.length;
}

// --- Test helpers ---

const NOW = new Date('2025-06-15T18:00:00.000Z');

function makeEvent(overrides: Partial<PastEvent> & { id: string }): PastEvent {
  return {
    title: 'Test Event',
    category: 'dining',
    activity_id: null,
    end_time: '2025-06-15T14:00:00.000Z',
    completed_at: null,
    status: 'scheduled',
    address: '123 Main St',
    google_place_id: null,
    ...overrides,
  };
}

// ======================================================================
// TESTS
// ======================================================================

describe('filterPastEventsNeedingFeedback', () => {
  it('returns events that ended within 48-hour window', () => {
    const events = [
      makeEvent({ id: '1', end_time: '2025-06-15T10:00:00.000Z' }), // 8 hours ago
      makeEvent({ id: '2', end_time: '2025-06-14T10:00:00.000Z' }), // 32 hours ago
    ];

    const result = filterPastEventsNeedingFeedback(events, new Set(), NOW);
    expect(result).toHaveLength(2);
  });

  it('excludes events older than 48 hours', () => {
    const events = [
      makeEvent({ id: '1', end_time: '2025-06-13T10:00:00.000Z' }), // 56 hours ago
    ];

    const result = filterPastEventsNeedingFeedback(events, new Set(), NOW);
    expect(result).toHaveLength(0);
  });

  it('excludes events that have not ended yet', () => {
    const events = [
      makeEvent({ id: '1', end_time: '2025-06-15T20:00:00.000Z' }), // 2 hours from now
    ];

    const result = filterPastEventsNeedingFeedback(events, new Set(), NOW);
    expect(result).toHaveLength(0);
  });

  it('excludes cancelled events', () => {
    const events = [
      makeEvent({ id: '1', status: 'cancelled', end_time: '2025-06-15T10:00:00.000Z' }),
    ];

    const result = filterPastEventsNeedingFeedback(events, new Set(), NOW);
    expect(result).toHaveLength(0);
  });

  it('includes both scheduled and completed events', () => {
    const events = [
      makeEvent({ id: '1', status: 'scheduled', end_time: '2025-06-15T10:00:00.000Z' }),
      makeEvent({ id: '2', status: 'completed', end_time: '2025-06-15T12:00:00.000Z', completed_at: '2025-06-15T12:30:00.000Z' }),
    ];

    const result = filterPastEventsNeedingFeedback(events, new Set(), NOW);
    expect(result).toHaveLength(2);
  });

  it('excludes events that already have feedback', () => {
    const events = [
      makeEvent({ id: '1', activity_id: 'act-1', end_time: '2025-06-15T10:00:00.000Z' }),
      makeEvent({ id: '2', activity_id: 'act-2', end_time: '2025-06-15T12:00:00.000Z' }),
    ];

    const feedbackIds = new Set(['act-1']);
    const result = filterPastEventsNeedingFeedback(events, feedbackIds, NOW);

    expect(result).toHaveLength(1);
    expect(result[0].eventId).toBe('2');
  });

  it('includes events without activity_id even when feedback exists for others', () => {
    const events = [
      makeEvent({ id: '1', activity_id: null, end_time: '2025-06-15T10:00:00.000Z' }),
    ];

    const feedbackIds = new Set(['some-other-activity']);
    const result = filterPastEventsNeedingFeedback(events, feedbackIds, NOW);

    expect(result).toHaveLength(1);
  });

  it('returns empty array for no events', () => {
    const result = filterPastEventsNeedingFeedback([], new Set(), NOW);
    expect(result).toHaveLength(0);
  });

  it('maps event fields correctly', () => {
    const events = [
      makeEvent({
        id: 'evt-1',
        title: 'Dinner at Luigi',
        category: 'dining',
        activity_id: 'act-1',
        end_time: '2025-06-15T14:00:00.000Z',
        address: '456 Oak Ave',
        google_place_id: 'ChIJ-place-id',
      }),
    ];

    const result = filterPastEventsNeedingFeedback(events, new Set(), NOW);

    expect(result[0].eventId).toBe('evt-1');
    expect(result[0].activityName).toBe('Dinner at Luigi');
    expect(result[0].activityCategory).toBe('dining');
    expect(result[0].activityId).toBe('act-1');
    expect(result[0].place?.id).toBe('ChIJ-place-id');
    expect(result[0].place?.name).toBe('Dinner at Luigi');
    expect(result[0].place?.address).toBe('456 Oak Ave');
  });

  it('uses "other" for null category', () => {
    const events = [
      makeEvent({ id: '1', category: null, end_time: '2025-06-15T10:00:00.000Z' }),
    ];

    const result = filterPastEventsNeedingFeedback(events, new Set(), NOW);
    expect(result[0].activityCategory).toBe('other');
  });

  it('uses end_time as completedAt when completed_at is null', () => {
    const events = [
      makeEvent({ id: '1', completed_at: null, end_time: '2025-06-15T14:00:00.000Z' }),
    ];

    const result = filterPastEventsNeedingFeedback(events, new Set(), NOW);
    expect(result[0].completedAt).toBe('2025-06-15T14:00:00.000Z');
  });

  it('uses completed_at when available', () => {
    const events = [
      makeEvent({
        id: '1',
        status: 'completed',
        completed_at: '2025-06-15T14:30:00.000Z',
        end_time: '2025-06-15T14:00:00.000Z',
      }),
    ];

    const result = filterPastEventsNeedingFeedback(events, new Set(), NOW);
    expect(result[0].completedAt).toBe('2025-06-15T14:30:00.000Z');
  });
});

describe('shouldPromptForFeedback priority', () => {
  const completedActivity: CompletedActivity = {
    eventId: 'completed-1',
    activityId: 'act-1',
    activityName: 'Completed Activity',
    activityCategory: 'dining',
    completedAt: '2025-06-15T14:00:00.000Z',
    recommendationId: null,
  };

  const pastActivity: CompletedActivity = {
    eventId: 'past-1',
    activityId: 'act-2',
    activityName: 'Past Activity',
    activityCategory: 'fitness',
    completedAt: '2025-06-15T12:00:00.000Z',
    recommendationId: null,
  };

  it('returns completed event first when both exist', () => {
    const result = shouldPromptForFeedback([completedActivity], [pastActivity]);
    expect(result.shouldPrompt).toBe(true);
    expect(result.activity?.eventId).toBe('completed-1');
  });

  it('falls back to past event when no completed events', () => {
    const result = shouldPromptForFeedback([], [pastActivity]);
    expect(result.shouldPrompt).toBe(true);
    expect(result.activity?.eventId).toBe('past-1');
  });

  it('returns shouldPrompt=false when no events at all', () => {
    const result = shouldPromptForFeedback([], []);
    expect(result.shouldPrompt).toBe(false);
    expect(result.activity).toBeUndefined();
  });

  it('uses first completed event when multiple exist', () => {
    const completed2: CompletedActivity = { ...completedActivity, eventId: 'completed-2' };
    const result = shouldPromptForFeedback([completedActivity, completed2], []);
    expect(result.activity?.eventId).toBe('completed-1');
  });
});

describe('countPendingFeedback (deduplication)', () => {
  it('deduplicates events that appear in both completed and past lists', () => {
    const completed: CompletedActivity[] = [{
      eventId: 'evt-1', activityId: 'a', activityName: 'A',
      activityCategory: 'dining', completedAt: '', recommendationId: null,
    }];
    const past: CompletedActivity[] = [
      { eventId: 'evt-1', activityId: 'a', activityName: 'A', activityCategory: 'dining', completedAt: '', recommendationId: null },
      { eventId: 'evt-2', activityId: 'b', activityName: 'B', activityCategory: 'fitness', completedAt: '', recommendationId: null },
    ];

    expect(countPendingFeedback(completed, past)).toBe(2); // evt-1 + evt-2 (not 3)
  });

  it('counts correctly when no overlap', () => {
    const completed: CompletedActivity[] = [{
      eventId: 'evt-1', activityId: 'a', activityName: 'A',
      activityCategory: 'dining', completedAt: '', recommendationId: null,
    }];
    const past: CompletedActivity[] = [{
      eventId: 'evt-2', activityId: 'b', activityName: 'B',
      activityCategory: 'fitness', completedAt: '', recommendationId: null,
    }];

    expect(countPendingFeedback(completed, past)).toBe(2);
  });

  it('returns 0 when both lists are empty', () => {
    expect(countPendingFeedback([], [])).toBe(0);
  });

  it('handles completed-only scenario', () => {
    const completed: CompletedActivity[] = [{
      eventId: 'evt-1', activityId: 'a', activityName: 'A',
      activityCategory: 'dining', completedAt: '', recommendationId: null,
    }];

    expect(countPendingFeedback(completed, [])).toBe(1);
  });

  it('handles past-only scenario', () => {
    const past: CompletedActivity[] = [
      { eventId: 'evt-1', activityId: 'a', activityName: 'A', activityCategory: 'dining', completedAt: '', recommendationId: null },
      { eventId: 'evt-2', activityId: 'b', activityName: 'B', activityCategory: 'fitness', completedAt: '', recommendationId: null },
    ];

    expect(countPendingFeedback([], past)).toBe(2);
  });
});

describe('48-hour window edge cases', () => {
  it('includes event at exactly 47 hours 59 minutes ago', () => {
    const almostExpired = new Date(NOW.getTime() - (47 * 60 + 59) * 60 * 1000);
    const events = [
      makeEvent({ id: '1', end_time: almostExpired.toISOString() }),
    ];

    const result = filterPastEventsNeedingFeedback(events, new Set(), NOW);
    expect(result).toHaveLength(1);
  });

  it('excludes event at exactly 48 hours ago', () => {
    const exactCutoff = new Date(NOW.getTime() - 48 * 60 * 60 * 1000);
    const events = [
      makeEvent({ id: '1', end_time: exactCutoff.toISOString() }),
    ];

    const result = filterPastEventsNeedingFeedback(events, new Set(), NOW);
    expect(result).toHaveLength(0);
  });

  it('includes event that ended 1 minute ago', () => {
    const justEnded = new Date(NOW.getTime() - 60 * 1000);
    const events = [
      makeEvent({ id: '1', end_time: justEnded.toISOString() }),
    ];

    const result = filterPastEventsNeedingFeedback(events, new Set(), NOW);
    expect(result).toHaveLength(1);
  });
});
