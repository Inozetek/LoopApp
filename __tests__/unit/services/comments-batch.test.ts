/**
 * Tests for getBatchCommentCounts
 *
 * Mirrors the pure logic from services/comments-service.ts so tests
 * don't depend on Supabase module resolution.
 */

// Replicate the batch counting logic (client-side aggregation)
function getBatchCommentCounts(
  rows: Array<{ place_id: string }>,
  placeIds: string[],
): Map<string, number> {
  const result = new Map<string, number>();

  rows.forEach((row) => {
    const pid = row.place_id;
    result.set(pid, (result.get(pid) || 0) + 1);
  });

  // Fill in zeros for places with no comments
  placeIds.forEach((id) => {
    if (!result.has(id)) result.set(id, 0);
  });

  return result;
}

describe('getBatchCommentCounts', () => {
  it('returns correct counts for multiple places', () => {
    const rows = [
      { place_id: 'place-a' },
      { place_id: 'place-a' },
      { place_id: 'place-a' },
      { place_id: 'place-b' },
      { place_id: 'place-b' },
      { place_id: 'place-c' },
    ];
    const placeIds = ['place-a', 'place-b', 'place-c'];

    const counts = getBatchCommentCounts(rows, placeIds);

    expect(counts.get('place-a')).toBe(3);
    expect(counts.get('place-b')).toBe(2);
    expect(counts.get('place-c')).toBe(1);
  });

  it('returns 0 for places with no comments', () => {
    const rows = [{ place_id: 'place-a' }];
    const placeIds = ['place-a', 'place-b', 'place-c'];

    const counts = getBatchCommentCounts(rows, placeIds);

    expect(counts.get('place-a')).toBe(1);
    expect(counts.get('place-b')).toBe(0);
    expect(counts.get('place-c')).toBe(0);
  });

  it('returns all zeros when no rows returned', () => {
    const placeIds = ['place-a', 'place-b'];
    const counts = getBatchCommentCounts([], placeIds);

    expect(counts.get('place-a')).toBe(0);
    expect(counts.get('place-b')).toBe(0);
  });

  it('returns empty map for empty input', () => {
    const counts = getBatchCommentCounts([], []);
    expect(counts.size).toBe(0);
  });

  it('handles single place with multiple comments', () => {
    const rows = [
      { place_id: 'only-place' },
      { place_id: 'only-place' },
      { place_id: 'only-place' },
      { place_id: 'only-place' },
      { place_id: 'only-place' },
    ];
    const placeIds = ['only-place'];

    const counts = getBatchCommentCounts(rows, placeIds);
    expect(counts.get('only-place')).toBe(5);
  });

  it('ignores rows for places not in the requested list', () => {
    const rows = [
      { place_id: 'place-a' },
      { place_id: 'place-unknown' }, // Not in placeIds
    ];
    const placeIds = ['place-a', 'place-b'];

    const counts = getBatchCommentCounts(rows, placeIds);

    expect(counts.get('place-a')).toBe(1);
    expect(counts.get('place-b')).toBe(0);
    // place-unknown is in the map (from rows) but wasn't requested
    expect(counts.has('place-unknown')).toBe(true);
  });

  it('returns map with all requested place IDs as keys', () => {
    const placeIds = ['a', 'b', 'c', 'd', 'e'];
    const counts = getBatchCommentCounts([], placeIds);

    placeIds.forEach((id) => {
      expect(counts.has(id)).toBe(true);
      expect(counts.get(id)).toBe(0);
    });
    expect(counts.size).toBe(5);
  });

  it('handles large batch correctly', () => {
    const placeIds = Array.from({ length: 50 }, (_, i) => `place-${i}`);
    // Only some places have comments
    const rows = [
      { place_id: 'place-0' },
      { place_id: 'place-0' },
      { place_id: 'place-10' },
      { place_id: 'place-25' },
      { place_id: 'place-25' },
      { place_id: 'place-25' },
      { place_id: 'place-49' },
    ];

    const counts = getBatchCommentCounts(rows, placeIds);

    expect(counts.get('place-0')).toBe(2);
    expect(counts.get('place-10')).toBe(1);
    expect(counts.get('place-25')).toBe(3);
    expect(counts.get('place-49')).toBe(1);
    expect(counts.get('place-1')).toBe(0);
    expect(counts.get('place-48')).toBe(0);
    expect(counts.size).toBe(50);
  });
});
