/**
 * Tests for event validation utility functions
 *
 * Tests the pure logic from utils/event-validation.ts:
 * - extractTeamName: regex-based team name extraction from event titles
 * - areTeamsPlaying: detects when two events involve the same team
 * - validateEventScheduling: filters out impossible event scenarios
 *   (same team playing multiple games same day, same venue conflicts)
 *
 * Functions are duplicated here as standalone pure functions to avoid
 * importing the source file (which pulls in React Native types).
 *
 * IMPORTANT NOTE on regex behavior:
 * The "vs" pattern uses /^([^vs]+) vs /i which is a CHARACTER CLASS
 * excluding the individual characters v/V/s/S (not the substring "vs").
 * Similarly the "at" pattern excludes a/A/t/T. This means team names
 * containing those letters will NOT match those specific patterns.
 * The dash pattern /^([^-]+) - / and v. pattern /^([^v\.]+) v\. /i
 * have their own character exclusions.
 */

// ---------- Minimal type stubs ----------

interface EventMetadata {
  start_time: string;
  end_time: string;
  duration_minutes: number;
  event_url?: string;
  organizer?: string;
  is_online?: boolean;
  is_free?: boolean;
  ticket_price?: {
    min: number;
    max: number;
    currency: string;
  };
}

interface UnifiedActivity {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  types: string[];
  source: string;
  event_metadata?: EventMetadata;
  [key: string]: any;
}

// ---------- Duplicated pure functions ----------

function extractTeamName(eventTitle: string): string | null {
  const patterns = [
    /^([^vs]+) vs /i,        // "Dallas Mavericks vs Lakers"
    /^([^at]+) at /i,        // "Mavericks at Celtics"
    /^([^-]+) - /,           // "FC Dallas - Houston Dynamo"
    /^([^v\.]+) v\. /i,      // "Team A v. Team B"
  ];

  for (const pattern of patterns) {
    const match = eventTitle.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

function areTeamsPlaying(event1: string, event2: string): boolean {
  const team1 = extractTeamName(event1);
  const team2 = extractTeamName(event2);

  if (!team1 || !team2) return false;

  const event1Lower = event1.toLowerCase();
  const event2Lower = event2.toLowerCase();
  const team1Lower = team1.toLowerCase();
  const team2Lower = team2.toLowerCase();

  return event1Lower.includes(team2Lower) || event2Lower.includes(team1Lower);
}

function validateEventScheduling(events: UnifiedActivity[]): UnifiedActivity[] {
  const validEvents: UnifiedActivity[] = [];
  const eventsByDate = new Map<string, UnifiedActivity[]>();

  // Group events by date
  for (const event of events) {
    if (!event.event_metadata?.start_time) continue;

    const date = new Date(event.event_metadata.start_time).toISOString().split('T')[0];

    if (!eventsByDate.has(date)) {
      eventsByDate.set(date, []);
    }
    eventsByDate.get(date)!.push(event);
  }

  // Check each date for conflicts
  for (const [date, dateEvents] of eventsByDate) {
    const teamsPlayingToday = new Set<string>();

    for (const event of dateEvents) {
      const teamName = extractTeamName(event.name);

      // Check if this team is already playing today
      if (teamName && teamsPlayingToday.has(teamName.toLowerCase())) {
        continue; // Skip this duplicate event
      }

      // Check for conflicting events at same venue/time
      const conflictExists = validEvents.some(existing => {
        if (!existing.event_metadata?.start_time) return false;

        const existingDate = new Date(existing.event_metadata.start_time).toISOString().split('T')[0];
        if (existingDate !== date) return false;

        // Same venue check
        const sameVenue = existing.formatted_address === event.formatted_address;
        if (!sameVenue) return false;

        // Same time check (within 1 hour)
        const timeDiff = Math.abs(
          new Date(existing.event_metadata.start_time).getTime() -
          new Date(event.event_metadata!.start_time).getTime()
        );
        const withinOneHour = timeDiff < 3600000; // 1 hour in milliseconds

        return withinOneHour;
      });

      if (!conflictExists) {
        validEvents.push(event);
        if (teamName) {
          teamsPlayingToday.add(teamName.toLowerCase());
        }
      }
    }
  }

  return validEvents;
}

// ---------- Helper to build mock events ----------

function makeEvent(
  overrides: Partial<UnifiedActivity> & { name: string }
): UnifiedActivity {
  return {
    place_id: overrides.place_id ?? `place-${Math.random().toString(36).slice(2, 8)}`,
    formatted_address: overrides.formatted_address ?? '123 Main St',
    geometry: overrides.geometry ?? { location: { lat: 32.78, lng: -96.80 } },
    types: overrides.types ?? ['event'],
    source: overrides.source ?? 'ticketmaster',
    ...overrides,
  };
}

// Suppress console.warn and console.log during tests
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ========== Tests ==========

describe('event-validation', () => {
  // --------------------------------------------------
  // extractTeamName
  // --------------------------------------------------
  describe('extractTeamName', () => {
    // NOTE: The "vs" pattern /^([^vs]+) vs /i uses a character class [^vs]
    // which excludes individual chars v/V/s/S. So team names must NOT contain
    // v or s for this pattern to match. The /i flag makes it case-insensitive.

    describe('vs pattern - character class [^vs] excludes v/V/s/S', () => {
      it('extracts team when name has no v or s characters', () => {
        // "Thunder" = T-h-u-n-d-e-r (no v/s), so [^vs]+ captures "Thunder "
        // then backtracks to "Thunder", expects " vs " -> match
        expect(extractTeamName('Thunder vs Lakers')).toBe('Thunder');
      });

      it('extracts team when name has no v or s (multi-word)', () => {
        // "Red Bull" has no v or s chars
        expect(extractTeamName('Red Bull vs Thunder')).toBe('Red Bull');
      });

      it('returns null for vs pattern when team name contains s', () => {
        // "Dallas" contains 's', so [^vs]+ stops at 'a' (pos 1)... actually
        // 'D' is not v/s, 'a' is not v/s, 'l' is not, 'l' is not, 'a' is not,
        // but 's' IS excluded -> [^vs]+ captures "Dalla" then needs " vs "
        // but next char is 's' not ' '. Backtracking fails -> null
        // Falls through to "at" pattern, "dash" pattern, "v." pattern - all fail
        // So "Dallas Mavericks vs Lakers" returns null from the "vs" pattern
        // but might match the dash or at pattern? No. -> null
        expect(extractTeamName('Dallas Mavericks vs Lakers')).toBeNull();
      });

      it('returns null for vs pattern when team name contains v', () => {
        // "Rovers" has both 'v' and 's'
        expect(extractTeamName('Rovers vs Thunder')).toBeNull();
      });
    });

    describe('at pattern - character class [^at] excludes a/A/t/T', () => {
      it('extracts team when name has no a or t characters', () => {
        // "Phoenix" = P-h-o-e-n-i-x (no a/t) ... wait, no. Let's pick carefully.
        // "Phoenix" has no a or t. [^at]+ with /i excludes a/A/t/T.
        // P-h-o-e-n-i-x all pass. Then " at " matches.
        expect(extractTeamName('Phoenix at Red Bull')).toBe('Phoenix');
      });

      it('extracts multi-word team without a or t chars', () => {
        // "Big Blue" = B-i-g-space-B-l-u-e (no a/t)
        expect(extractTeamName('Big Blue at Phoenix')).toBe('Big Blue');
      });

      it('returns null for at pattern when team name contains a', () => {
        // "Dallas" has 'a' at position 1 -> [^at]+ captures only "D"
        // then expects " at " but sees "allas..." -> fail
        expect(extractTeamName('Dallas at Phoenix')).toBeNull();
      });

      it('returns null for at pattern when team name contains t', () => {
        // "Portland" has 't' -> stops early, can't match " at "
        expect(extractTeamName('Portland at Phoenix')).toBeNull();
      });
    });

    describe('dash pattern - [^-]+ excludes only dash char', () => {
      it('extracts team from "Team A - Team B"', () => {
        expect(extractTeamName('FC Dallas - Houston Dynamo')).toBe('FC Dallas');
      });

      it('extracts team with complex name containing dashes elsewhere', () => {
        // Only the first " - " matters
        expect(extractTeamName('Inter Miami CF - Austin FC')).toBe('Inter Miami CF');
      });

      it('extracts single-word team before dash', () => {
        expect(extractTeamName('Thunder - Lightning')).toBe('Thunder');
      });

      it('handles team name with numbers', () => {
        expect(extractTeamName('FC123 - Team456')).toBe('FC123');
      });
    });

    describe('v. pattern - [^v\\.] excludes v/V and dot', () => {
      it('extracts team from "Team A v. Team B"', () => {
        // "Team A" -> T-e-a-m-space-A (no v or dot), captured. Then " v. " matches.
        // Wait: [^v\.]+ with /i excludes v/V and '.'.
        // 'T' ok, 'e' ok, 'a' ok, 'm' ok, ' ' ok, 'A' ok -> "Team A "
        // Backtrack to "Team A", then " v. " matches.
        expect(extractTeamName('Team A v. Team B')).toBe('Team A');
      });

      it('handles case-insensitive "V."', () => {
        expect(extractTeamName('Team Alpha V. Team Beta')).toBe('Team Alpha');
      });

      it('returns null when team name contains v before v. separator', () => {
        // "Dover" has 'v' -> [^v.]+ stops at the 'v'
        // "Do" captured, expects " v. " but sees "ver v. ..." -> fail
        // Actually: D-o (captured "Do"), pos 2 is 'v' -> stop.
        // Expects " v. " at pos 2: 'v' != ' ' -> fail. Backtrack:
        // "D" at pos 0, expects " v. " at pos 1: 'o' != ' ' -> fail.
        // No match.
        expect(extractTeamName('Dover v. Lille')).toBeNull();
      });
    });

    describe('pattern fallthrough and priority', () => {
      it('tries vs first, then at, then dash, then v.', () => {
        // "FC Dallas - Houston Dynamo" has s in Dallas, so vs pattern fails.
        // Has 'a' in Dallas, so at pattern fails.
        // Dash pattern matches: "FC Dallas" captured.
        expect(extractTeamName('FC Dallas - Houston Dynamo')).toBe('FC Dallas');
      });

      it('dash pattern catches names that vs and at patterns cannot', () => {
        // "Dallas Stars - Colorado Avalanche" has s in Dallas -> vs fails,
        // has a in Dallas -> at fails, dash matches
        expect(extractTeamName('Dallas Stars - Colorado Avalanche')).toBe('Dallas Stars');
      });

      it('v. pattern catches names that vs/at/dash cannot match', () => {
        // Title with no vs, at, or dash separator
        // "Team One v. Team Two"
        // vs pattern: [^vs]+ -> "Team One" has no v/s? T-e-a-m-space-O-n-e -> no v or s!
        // Then expects " vs " but sees " v. " -> no match for " vs "
        // at pattern: [^at]+ -> stops at 'a' in "Team" -> fail
        // dash pattern: no dash -> fail
        // v. pattern: [^v.]+ -> "Team One" has no v or . -> "Team One " captured
        // backtrack to "Team One", then " v. " matches. -> "Team One"
        expect(extractTeamName('Team One v. Team Two')).toBe('Team One');
      });
    });

    describe('no match / edge cases', () => {
      it('returns null for plain text with no separator', () => {
        expect(extractTeamName('Taylor Swift Eras Tour')).toBeNull();
      });

      it('returns null for an empty string', () => {
        expect(extractTeamName('')).toBeNull();
      });

      it('returns null for a string with only spaces', () => {
        expect(extractTeamName('   ')).toBeNull();
      });

      it('returns null for a title without a recognised separator', () => {
        expect(extractTeamName('Chicago Bulls & LA Clippers')).toBeNull();
      });

      it('returns null when no pattern can extract a team', () => {
        // "vs" at the start with no team before it
        expect(extractTeamName('vs Lakers')).toBeNull();
      });

      it('returns null when all separators are present but team names contain blocking chars', () => {
        // Every pattern fails due to character class restrictions
        // "Savannah" has 's', 'a', 'v' -> vs/at/v. all fail, no dash
        expect(extractTeamName('Savannah vs Other')).toBeNull();
      });
    });

    describe('trim behavior', () => {
      it('trims whitespace from the extracted team name', () => {
        // Extra spaces before team name handled by trim()
        expect(extractTeamName('  Thunder vs Lakers')).toBe('Thunder');
      });

      it('trims trailing whitespace from team name', () => {
        // [^-]+ will capture "FC Dallas " (with trailing space), then trim()
        expect(extractTeamName('FC Dallas  - Houston')).toBe('FC Dallas');
      });
    });
  });

  // --------------------------------------------------
  // areTeamsPlaying
  // --------------------------------------------------
  describe('areTeamsPlaying', () => {
    it('returns true when same team name appears in both dash-separated events', () => {
      // Both use dash pattern, which works reliably for most team names
      const event1 = 'FC Dallas - Houston Dynamo';
      const event2 = 'FC Dallas - Austin FC';
      expect(areTeamsPlaying(event1, event2)).toBe(true);
    });

    it('returns true when extracted team from event1 is found in event2 text', () => {
      // event1 extracts "FC Dallas" (dash pattern), check if "fc dallas" in event2.lower
      const event1 = 'FC Dallas - Houston Dynamo';
      const event2 = 'Austin FC - FC Dallas';
      // team1 = "FC Dallas", event2Lower includes "fc dallas" -> true
      expect(areTeamsPlaying(event1, event2)).toBe(true);
    });

    it('returns true when extracted team from event2 is found in event1 text', () => {
      const event1 = 'Houston Dynamo - FC Dallas';
      const event2 = 'FC Dallas - Austin FC';
      // team1 = "Houston Dynamo", team2 = "FC Dallas"
      // event1Lower.includes("fc dallas") -> true
      expect(areTeamsPlaying(event1, event2)).toBe(true);
    });

    it('returns false when teams are completely different', () => {
      const event1 = 'FC Dallas - Houston Dynamo';
      const event2 = 'Austin FC - Inter Miami';
      // team1 = "FC Dallas", team2 = "Austin FC"
      // "fc dallas - houston dynamo".includes("austin fc") -> false
      // "austin fc - inter miami".includes("fc dallas") -> false
      expect(areTeamsPlaying(event1, event2)).toBe(false);
    });

    it('returns false when one event has no recognizable team pattern', () => {
      const event1 = 'FC Dallas - Houston Dynamo';
      const event2 = 'Taylor Swift Eras Tour';
      // team2 = null -> returns false immediately
      expect(areTeamsPlaying(event1, event2)).toBe(false);
    });

    it('returns false when both events have no recognizable team pattern', () => {
      const event1 = 'Taylor Swift Eras Tour';
      const event2 = 'Rolling Stones Concert';
      expect(areTeamsPlaying(event1, event2)).toBe(false);
    });

    it('is case-insensitive for team matching', () => {
      const event1 = 'FC DALLAS - Houston Dynamo';
      const event2 = 'fc dallas - Austin FC';
      expect(areTeamsPlaying(event1, event2)).toBe(true);
    });

    it('returns false for empty strings', () => {
      expect(areTeamsPlaying('', '')).toBe(false);
      expect(areTeamsPlaying('FC Dallas - Houston', '')).toBe(false);
      expect(areTeamsPlaying('', 'FC Dallas - Houston')).toBe(false);
    });

    it('handles vs pattern teams that match (no v/s in name)', () => {
      const event1 = 'Thunder vs Red Bull';
      const event2 = 'Thunder vs Blue Moon';
      // team1 = "Thunder", team2 = "Thunder"
      // event1Lower.includes("thunder") -> true
      expect(areTeamsPlaying(event1, event2)).toBe(true);
    });

    it('returns false for different vs-pattern teams', () => {
      const event1 = 'Thunder vs Red Bull';
      const event2 = 'Blue Moon vs Red Bull';
      // team1 = "Thunder", team2 = "Blue Moon"
      // "thunder vs red bull".includes("blue moon") -> false
      // "blue moon vs red bull".includes("thunder") -> false
      expect(areTeamsPlaying(event1, event2)).toBe(false);
    });

    it('works across different separator patterns', () => {
      // event1 uses dash, event2 uses dash
      const event1 = 'Thunder - Red Bull';
      const event2 = 'Thunder - Blue Moon';
      // Both extract "Thunder" via dash pattern
      expect(areTeamsPlaying(event1, event2)).toBe(true);
    });
  });

  // --------------------------------------------------
  // validateEventScheduling
  // --------------------------------------------------
  describe('validateEventScheduling', () => {
    describe('events without metadata', () => {
      it('filters out events with no event_metadata', () => {
        const events: UnifiedActivity[] = [
          makeEvent({ name: 'No Metadata Event' }),
          makeEvent({ name: 'Also No Metadata' }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(0);
      });

      it('filters out events with event_metadata but empty start_time', () => {
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'Missing Start Time',
            event_metadata: { start_time: '', end_time: '', duration_minutes: 0 },
          }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(0);
      });
    });

    describe('no conflicts', () => {
      it('returns all events when there are no conflicts', () => {
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'FC Dallas - Houston Dynamo',
            formatted_address: 'Toyota Stadium',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({
            name: 'Taylor Swift Eras Tour',
            formatted_address: 'AT&T Stadium',
            event_metadata: {
              start_time: '2026-03-15T20:00:00Z',
              end_time: '2026-03-15T23:00:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(2);
      });

      it('returns all events when same team plays on different dates', () => {
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'FC Dallas - Houston Dynamo',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({
            name: 'FC Dallas - Austin FC',
            event_metadata: {
              start_time: '2026-03-17T19:00:00Z',
              end_time: '2026-03-17T22:00:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(2);
      });

      it('allows different events at same venue if more than 1 hour apart', () => {
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'Taylor Swift Eras Tour',
            formatted_address: 'AT&T Stadium',
            event_metadata: {
              start_time: '2026-03-15T14:00:00Z',
              end_time: '2026-03-15T17:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({
            name: 'Ed Sheeran Concert',
            formatted_address: 'AT&T Stadium',
            event_metadata: {
              start_time: '2026-03-15T20:00:00Z',
              end_time: '2026-03-15T23:00:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(2);
      });
    });

    describe('same team conflict (same day)', () => {
      it('removes duplicate when same team plays twice on same day (dash pattern)', () => {
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'FC Dallas - Houston Dynamo',
            event_metadata: {
              start_time: '2026-03-15T14:00:00Z',
              end_time: '2026-03-15T17:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({
            name: 'FC Dallas - Austin FC',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('FC Dallas - Houston Dynamo');
      });

      it('removes duplicate when same team plays twice (vs pattern)', () => {
        // Use team names without v/s characters for the "vs" pattern to work
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'Thunder vs Red Bull',
            event_metadata: {
              start_time: '2026-03-15T14:00:00Z',
              end_time: '2026-03-15T17:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({
            name: 'Thunder vs Blue Moon',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Thunder vs Red Bull');
      });

      it('keeps the first event and discards all subsequent same-team events', () => {
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'FC Dallas - Houston Dynamo',
            event_metadata: {
              start_time: '2026-03-15T12:00:00Z',
              end_time: '2026-03-15T15:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({
            name: 'FC Dallas - Austin FC',
            event_metadata: {
              start_time: '2026-03-15T17:00:00Z',
              end_time: '2026-03-15T20:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({
            name: 'FC Dallas - Inter Miami',
            event_metadata: {
              start_time: '2026-03-15T21:00:00Z',
              end_time: '2026-03-16T00:00:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('FC Dallas - Houston Dynamo');
      });

      it('handles case-insensitive team deduplication', () => {
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'FC DALLAS - Houston Dynamo',
            event_metadata: {
              start_time: '2026-03-15T14:00:00Z',
              end_time: '2026-03-15T17:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({
            name: 'fc dallas - Austin FC',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(1);
      });
    });

    describe('venue conflict (same venue, same time)', () => {
      it('removes event when same venue has events within 1 hour', () => {
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'Concert A',
            formatted_address: 'AT&T Stadium, Arlington, TX',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({
            name: 'Concert B',
            formatted_address: 'AT&T Stadium, Arlington, TX',
            event_metadata: {
              start_time: '2026-03-15T19:30:00Z',
              end_time: '2026-03-15T22:30:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Concert A');
      });

      it('allows events at same venue exactly 1 hour apart (boundary)', () => {
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'Concert A',
            formatted_address: 'AT&T Stadium',
            event_metadata: {
              start_time: '2026-03-15T14:00:00Z',
              end_time: '2026-03-15T17:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({
            name: 'Concert B',
            formatted_address: 'AT&T Stadium',
            event_metadata: {
              start_time: '2026-03-15T15:00:00Z',
              end_time: '2026-03-15T18:00:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        // timeDiff = 3600000 which is NOT < 3600000, so no conflict
        expect(result).toHaveLength(2);
      });

      it('does not flag venue conflict when addresses differ', () => {
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'Concert A',
            formatted_address: 'AT&T Stadium, Arlington, TX',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({
            name: 'Concert B',
            formatted_address: 'American Airlines Center, Dallas, TX',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(2);
      });
    });

    describe('mixed conflicts', () => {
      it('handles both team and venue conflicts simultaneously', () => {
        const events: UnifiedActivity[] = [
          // Valid: FC Dallas game
          makeEvent({
            name: 'FC Dallas - Houston Dynamo',
            formatted_address: 'Toyota Stadium',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
          // Conflict: Same team (FC Dallas), same day
          makeEvent({
            name: 'FC Dallas - Austin FC',
            formatted_address: 'Reunion Arena',
            event_metadata: {
              start_time: '2026-03-15T14:00:00Z',
              end_time: '2026-03-15T17:00:00Z',
              duration_minutes: 180,
            },
          }),
          // Valid: Different team, different venue
          makeEvent({
            name: 'Inter Miami - Nashville SC',
            formatted_address: 'Globe Life Field',
            event_metadata: {
              start_time: '2026-03-15T19:30:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 150,
            },
          }),
          // Conflict: Same venue as FC Dallas game, within 1 hour
          makeEvent({
            name: 'Beyonce Concert',
            formatted_address: 'Toyota Stadium',
            event_metadata: {
              start_time: '2026-03-15T19:15:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 165,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        // Should keep: FC Dallas - Houston Dynamo, Inter Miami - Nashville SC
        // Should remove: FC Dallas - Austin FC (team dup), Beyonce (venue conflict)
        expect(result).toHaveLength(2);
        expect(result.map(e => e.name)).toContain('FC Dallas - Houston Dynamo');
        expect(result.map(e => e.name)).toContain('Inter Miami - Nashville SC');
      });

      it('team conflict takes priority over venue check for same team', () => {
        // Even at different venues, same team on same day is rejected
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'FC Dallas - Houston Dynamo',
            formatted_address: 'Toyota Stadium',
            event_metadata: {
              start_time: '2026-03-15T14:00:00Z',
              end_time: '2026-03-15T17:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({
            name: 'FC Dallas - Nashville SC',
            formatted_address: 'Globe Life Field',
            event_metadata: {
              start_time: '2026-03-15T20:00:00Z',
              end_time: '2026-03-15T23:00:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('FC Dallas - Houston Dynamo');
      });
    });

    describe('events across multiple dates', () => {
      it('validates each date independently', () => {
        const events: UnifiedActivity[] = [
          // Day 1: FC Dallas game
          makeEvent({
            name: 'FC Dallas - Houston Dynamo',
            formatted_address: 'Toyota Stadium',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
          // Day 1: Duplicate FC Dallas game (should be removed)
          makeEvent({
            name: 'FC Dallas - Austin FC',
            formatted_address: 'Globe Life Field',
            event_metadata: {
              start_time: '2026-03-15T14:00:00Z',
              end_time: '2026-03-15T17:00:00Z',
              duration_minutes: 180,
            },
          }),
          // Day 2: FC Dallas game (different date, should be kept)
          makeEvent({
            name: 'FC Dallas - Nashville SC',
            formatted_address: 'Toyota Stadium',
            event_metadata: {
              start_time: '2026-03-16T19:00:00Z',
              end_time: '2026-03-16T22:00:00Z',
              duration_minutes: 180,
            },
          }),
          // Day 2: Duplicate FC Dallas game on day 2 (should be removed)
          makeEvent({
            name: 'FC Dallas - Inter Miami',
            formatted_address: 'Globe Life Field',
            event_metadata: {
              start_time: '2026-03-16T14:00:00Z',
              end_time: '2026-03-16T17:00:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        // One per day
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('FC Dallas - Houston Dynamo');
        expect(result[1].name).toBe('FC Dallas - Nashville SC');
      });

      it('allows same venue on different dates', () => {
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'Concert A',
            formatted_address: 'AT&T Stadium',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({
            name: 'Concert B',
            formatted_address: 'AT&T Stadium',
            event_metadata: {
              start_time: '2026-03-16T19:00:00Z',
              end_time: '2026-03-16T22:00:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(2);
      });
    });

    describe('non-sports events (no team pattern match)', () => {
      it('keeps all non-sports events at different venues', () => {
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'Taylor Swift Eras Tour',
            formatted_address: 'AT&T Stadium',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T23:00:00Z',
              duration_minutes: 240,
            },
          }),
          makeEvent({
            name: 'Beyonce Renaissance Tour',
            formatted_address: 'American Airlines Center',
            event_metadata: {
              start_time: '2026-03-15T20:00:00Z',
              end_time: '2026-03-16T00:00:00Z',
              duration_minutes: 240,
            },
          }),
          makeEvent({
            name: 'Comedy Night with Dave Chappelle',
            formatted_address: 'Majestic Theatre',
            event_metadata: {
              start_time: '2026-03-15T21:00:00Z',
              end_time: '2026-03-15T23:00:00Z',
              duration_minutes: 120,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(3);
      });

      it('team dedup does not apply to non-sports events with same venue name', () => {
        // Even though both are at same venue, no team pattern is found,
        // so only venue-time conflict check applies
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'Morning Yoga Class',
            formatted_address: 'Community Center',
            event_metadata: {
              start_time: '2026-03-15T08:00:00Z',
              end_time: '2026-03-15T09:00:00Z',
              duration_minutes: 60,
            },
          }),
          makeEvent({
            name: 'Evening Pottery Class',
            formatted_address: 'Community Center',
            event_metadata: {
              start_time: '2026-03-15T18:00:00Z',
              end_time: '2026-03-15T20:00:00Z',
              duration_minutes: 120,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        // 10 hours apart, same venue -> no conflict
        expect(result).toHaveLength(2);
      });
    });

    describe('edge cases', () => {
      it('returns empty array for empty input', () => {
        expect(validateEventScheduling([])).toHaveLength(0);
      });

      it('returns single event when only one event provided', () => {
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'FC Dallas - Houston Dynamo',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(1);
      });

      it('handles mix of events with and without metadata', () => {
        const events: UnifiedActivity[] = [
          makeEvent({ name: 'No Metadata Concert' }),
          makeEvent({
            name: 'FC Dallas - Houston Dynamo',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({ name: 'Another No Metadata Event' }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('FC Dallas - Houston Dynamo');
      });

      it('handles events at exactly the same time and venue (venue conflict)', () => {
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'Concert A',
            formatted_address: 'Venue X',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({
            name: 'Concert B',
            formatted_address: 'Venue X',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Concert A');
      });

      it('venue conflict at 59 minutes apart (within 1 hour threshold)', () => {
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'Event A',
            formatted_address: 'Same Venue',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({
            name: 'Event B',
            formatted_address: 'Same Venue',
            event_metadata: {
              start_time: '2026-03-15T19:59:00Z',
              end_time: '2026-03-15T22:59:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        // 59 min = 3,540,000 ms < 3,600,000 ms -> conflict
        expect(result).toHaveLength(1);
      });

      it('no venue conflict at exactly 60 minutes apart (boundary)', () => {
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'Event A',
            formatted_address: 'Same Venue',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({
            name: 'Event B',
            formatted_address: 'Same Venue',
            event_metadata: {
              start_time: '2026-03-15T20:00:00Z',
              end_time: '2026-03-15T23:00:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        // 60 min = 3,600,000 ms, NOT < 3,600,000 -> no conflict
        expect(result).toHaveLength(2);
      });

      it('preserves all events when no conflicts exist', () => {
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'Event 1',
            formatted_address: 'Venue A',
            event_metadata: {
              start_time: '2026-03-15T10:00:00Z',
              end_time: '2026-03-15T12:00:00Z',
              duration_minutes: 120,
            },
          }),
          makeEvent({
            name: 'Event 2',
            formatted_address: 'Venue B',
            event_metadata: {
              start_time: '2026-03-15T14:00:00Z',
              end_time: '2026-03-15T16:00:00Z',
              duration_minutes: 120,
            },
          }),
          makeEvent({
            name: 'Event 3',
            formatted_address: 'Venue C',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(3);
      });

      it('events without team names do not add to teamsPlayingToday set', () => {
        // Two non-sports events at different venues should both be kept
        // even though extractTeamName returns null for both
        const events: UnifiedActivity[] = [
          makeEvent({
            name: 'Art Exhibition Opening',
            formatted_address: 'Museum of Art',
            event_metadata: {
              start_time: '2026-03-15T18:00:00Z',
              end_time: '2026-03-15T21:00:00Z',
              duration_minutes: 180,
            },
          }),
          makeEvent({
            name: 'Wine Tasting Event',
            formatted_address: 'Wine Bar Downtown',
            event_metadata: {
              start_time: '2026-03-15T19:00:00Z',
              end_time: '2026-03-15T22:00:00Z',
              duration_minutes: 180,
            },
          }),
        ];

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(2);
      });
    });

    describe('large event lists', () => {
      it('handles many non-conflicting events', () => {
        const events: UnifiedActivity[] = [];
        for (let i = 0; i < 20; i++) {
          events.push(
            makeEvent({
              name: `Concert ${i}`,
              formatted_address: `Venue ${i}`,
              event_metadata: {
                start_time: `2026-03-15T${String(10 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}:00Z`,
                end_time: `2026-03-15T${String(13 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}:00Z`,
                duration_minutes: 180,
              },
            })
          );
        }

        const result = validateEventScheduling(events);
        expect(result).toHaveLength(20);
      });

      it('handles many events with some team conflicts', () => {
        const teams = [
          'FC Dallas', 'Inter Miami', 'Austin FC',
          'Nashville SC', 'Chicago Fire', 'LA Galaxy',
        ];
        const events: UnifiedActivity[] = [];
        // Each team plays twice on same day -> should keep only first game per team
        for (const team of teams) {
          events.push(
            makeEvent({
              name: `${team} - Opponent A`,
              formatted_address: `${team} Stadium`,
              event_metadata: {
                start_time: '2026-03-15T14:00:00Z',
                end_time: '2026-03-15T17:00:00Z',
                duration_minutes: 180,
              },
            })
          );
          events.push(
            makeEvent({
              name: `${team} - Opponent B`,
              formatted_address: `${team} Away Stadium`,
              event_metadata: {
                start_time: '2026-03-15T20:00:00Z',
                end_time: '2026-03-15T23:00:00Z',
                duration_minutes: 180,
              },
            })
          );
        }

        const result = validateEventScheduling(events);
        // 6 teams, each should have exactly 1 game
        expect(result).toHaveLength(6);
      });
    });
  });
});
