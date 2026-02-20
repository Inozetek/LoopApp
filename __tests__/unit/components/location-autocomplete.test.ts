/**
 * Tests for LocationAutocomplete pure helper functions.
 *
 * Tests filterRecentLocations() and dedupeByAddress() logic.
 * Functions are duplicated here (same as calendar-day-cell.test.ts pattern)
 * to avoid importing the component which pulls in react-native.
 */

interface RecentLocation {
  address: string;
  placeName: string;
  latitude: number;
  longitude: number;
  category?: string;
  lastUsed: string;
}

// ── Mirrors filterRecentLocations from location-autocomplete.tsx ──

function filterRecentLocations(
  recents: RecentLocation[],
  query: string,
): RecentLocation[] {
  if (!recents.length) return [];
  if (query.length === 0) return recents;
  const q = query.toLowerCase();
  return recents.filter(
    r => r.address.toLowerCase().includes(q) || r.placeName.toLowerCase().includes(q),
  );
}

// ── Mirrors dedupeByAddress from location-autocomplete.tsx ──

function dedupeByAddress(
  rows: Array<{ address: string; lastUsed: string; [key: string]: any }>,
): typeof rows {
  const seen = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = row.address.trim().toLowerCase();
    const existing = seen.get(key);
    if (!existing || row.lastUsed > existing.lastUsed) {
      seen.set(key, row);
    }
  }
  return Array.from(seen.values());
}

// ── Test data ──────────────────────────────────────────────────────

const STARBUCKS: RecentLocation = {
  address: '123 Main St, Dallas, TX 75201',
  placeName: 'Starbucks',
  latitude: 32.7767,
  longitude: -96.7970,
  category: 'dining',
  lastUsed: '2026-02-18T10:00:00Z',
};

const GYM: RecentLocation = {
  address: '456 Oak Ave, Dallas, TX 75202',
  placeName: 'The Gym',
  latitude: 32.7800,
  longitude: -96.8000,
  category: 'fitness',
  lastUsed: '2026-02-17T18:00:00Z',
};

const MOMS_HOUSE: RecentLocation = {
  address: '789 Elm Dr, Plano, TX 75023',
  placeName: "Mom's House",
  latitude: 33.0198,
  longitude: -96.6989,
  category: 'personal',
  lastUsed: '2026-02-15T12:00:00Z',
};

const RECENTS = [STARBUCKS, GYM, MOMS_HOUSE];

// ── filterRecentLocations tests ────────────────────────────────────

describe('LocationAutocomplete - filterRecentLocations', () => {
  it('returns all recents when query is empty', () => {
    expect(filterRecentLocations(RECENTS, '')).toEqual(RECENTS);
  });

  it('returns empty array when recents is empty', () => {
    expect(filterRecentLocations([], 'star')).toEqual([]);
  });

  it('filters by place name (case-insensitive)', () => {
    const result = filterRecentLocations(RECENTS, 'star');
    expect(result).toEqual([STARBUCKS]);
  });

  it('filters by address (case-insensitive)', () => {
    const result = filterRecentLocations(RECENTS, 'oak ave');
    expect(result).toEqual([GYM]);
  });

  it('matches partial address', () => {
    const result = filterRecentLocations(RECENTS, 'plano');
    expect(result).toEqual([MOMS_HOUSE]);
  });

  it('returns multiple matches when query is broad', () => {
    const result = filterRecentLocations(RECENTS, 'dallas');
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(STARBUCKS);
    expect(result).toContainEqual(GYM);
  });

  it('returns empty when no match', () => {
    const result = filterRecentLocations(RECENTS, 'zzz_no_match');
    expect(result).toEqual([]);
  });

  it('is case insensitive for placeName', () => {
    const result = filterRecentLocations(RECENTS, 'STARBUCKS');
    expect(result).toEqual([STARBUCKS]);
  });

  it('matches apostrophe in placeName', () => {
    const result = filterRecentLocations(RECENTS, "mom's");
    expect(result).toEqual([MOMS_HOUSE]);
  });
});

// ── dedupeByAddress tests ──────────────────────────────────────────

describe('LocationAutocomplete - dedupeByAddress', () => {
  it('returns empty array for empty input', () => {
    expect(dedupeByAddress([])).toEqual([]);
  });

  it('returns single row unchanged', () => {
    const rows = [{ address: '123 Main St', lastUsed: '2026-02-18T10:00:00Z' }];
    expect(dedupeByAddress(rows)).toEqual(rows);
  });

  it('dedupes by normalized address (case + whitespace)', () => {
    const rows = [
      { address: '123 Main St', lastUsed: '2026-02-18T10:00:00Z', title: 'First' },
      { address: '  123 main st  ', lastUsed: '2026-02-17T10:00:00Z', title: 'Second' },
    ];
    const result = dedupeByAddress(rows);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('First'); // Keeps the more recent one
  });

  it('keeps the most recent entry when duplicates exist', () => {
    const older = { address: '123 Main St', lastUsed: '2026-02-15T10:00:00Z', title: 'Older' };
    const newer = { address: '123 main st', lastUsed: '2026-02-18T10:00:00Z', title: 'Newer' };
    const result = dedupeByAddress([older, newer]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Newer');
  });

  it('preserves different addresses', () => {
    const rows = [
      { address: '123 Main St', lastUsed: '2026-02-18T10:00:00Z' },
      { address: '456 Oak Ave', lastUsed: '2026-02-17T10:00:00Z' },
      { address: '789 Elm Dr', lastUsed: '2026-02-16T10:00:00Z' },
    ];
    const result = dedupeByAddress(rows);
    expect(result).toHaveLength(3);
  });

  it('handles multiple groups of duplicates', () => {
    const rows = [
      { address: '123 Main St', lastUsed: '2026-02-18T10:00:00Z', id: 1 },
      { address: '456 Oak Ave', lastUsed: '2026-02-17T10:00:00Z', id: 2 },
      { address: '123 main st', lastUsed: '2026-02-16T10:00:00Z', id: 3 },
      { address: '456 oak ave', lastUsed: '2026-02-19T10:00:00Z', id: 4 },
    ];
    const result = dedupeByAddress(rows);
    expect(result).toHaveLength(2);
    // 123 Main St group: id 1 is most recent
    expect(result.find(r => r.id === 1)).toBeTruthy();
    // 456 Oak Ave group: id 4 is most recent
    expect(result.find(r => r.id === 4)).toBeTruthy();
  });
});
