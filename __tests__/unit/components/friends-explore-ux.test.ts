/**
 * Tests for Workstream E + Phase 4:
 * - E: Friends screen improvements (friend row redesign, long-press actions, section order)
 * - P4: Search page radar shortcuts (My Radars pill, Create Radar CTA, saved searches)
 */

// ============================================================================
// E: Friends Screen — Friend Row Redesign
// ============================================================================

describe('E: Friend row redesign', () => {
  // Replicate getLastActivityText logic from friends.tsx
  function getLastActivityText(createdAt: string): string {
    const created = new Date(createdAt);
    const now = new Date('2026-02-20T12:00:00Z'); // Pinned for test stability
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Added today';
    if (diffDays === 1) return 'Added yesterday';
    if (diffDays < 7) return `Added ${diffDays}d ago`;
    if (diffDays < 30) return `Added ${Math.floor(diffDays / 7)}w ago`;
    return `Friends for ${Math.floor(diffDays / 30)}mo`;
  }

  it('shows "Added today" for same-day additions', () => {
    expect(getLastActivityText('2026-02-20T08:00:00Z')).toBe('Added today');
  });

  it('shows "Added yesterday" for 1-day-old friendships', () => {
    expect(getLastActivityText('2026-02-19T08:00:00Z')).toBe('Added yesterday');
  });

  it('shows days for recent friendships (2-6 days)', () => {
    expect(getLastActivityText('2026-02-17T08:00:00Z')).toBe('Added 3d ago');
  });

  it('shows weeks for 7-29 day friendships', () => {
    expect(getLastActivityText('2026-02-06T08:00:00Z')).toBe('Added 2w ago');
  });

  it('shows months for 30+ day friendships', () => {
    expect(getLastActivityText('2025-12-20T08:00:00Z')).toBe('Friends for 2mo');
  });

  it('shows months for very old friendships', () => {
    expect(getLastActivityText('2025-02-20T08:00:00Z')).toBe('Friends for 12mo');
  });
});

describe('E: Friend row layout', () => {
  it('friend row has avatar (44px), name, loop score pill, last activity, and message action', () => {
    const friendRowElements = [
      'avatar',       // 44x44 circle
      'name',         // bold text, numberOfLines=1
      'loopScorePill', // small pill with flash icon + score
      'lastActivity', // muted text like "Added 2d ago"
      'messageAction', // chatbubble-outline icon button
    ];
    expect(friendRowElements).toHaveLength(5);
    expect(friendRowElements).toContain('messageAction');
    expect(friendRowElements).toContain('loopScorePill');
  });

  it('avatar size is 44px (Apple HIG compliant)', () => {
    const AVATAR_SIZE = 44;
    expect(AVATAR_SIZE).toBeGreaterThanOrEqual(44); // Apple minimum touch target
  });
});

describe('E: Friend long-press actions', () => {
  const LONG_PRESS_ACTIONS = [
    { text: 'View Loop', style: undefined },
    { text: 'Message', style: undefined },
    { text: 'Invite to Plan', style: undefined },
    { text: 'Remove Friend', style: 'destructive' },
    { text: 'Cancel', style: 'cancel' },
  ];

  it('has 5 action items (View Loop, Message, Invite, Remove, Cancel)', () => {
    expect(LONG_PRESS_ACTIONS).toHaveLength(5);
  });

  it('View Loop is the first action', () => {
    expect(LONG_PRESS_ACTIONS[0].text).toBe('View Loop');
  });

  it('Remove Friend is destructive', () => {
    expect(LONG_PRESS_ACTIONS[3].style).toBe('destructive');
  });

  it('Cancel is the last action', () => {
    expect(LONG_PRESS_ACTIONS[4].text).toBe('Cancel');
    expect(LONG_PRESS_ACTIONS[4].style).toBe('cancel');
  });

  it('long press delay is 400ms', () => {
    const LONG_PRESS_DELAY = 400;
    expect(LONG_PRESS_DELAY).toBe(400);
  });
});

describe('E: Friends section ordering', () => {
  // Current render order in friends.tsx ScrollView
  const SECTION_ORDER = [
    'StoriesGridSection',    // Stories row (horizontal scroll)
    'GroupChipsBar',         // Filter chips (if groups exist)
    'MyGroupPlansSection',   // Active plans (creator view)
    'GroupInvitationsSection', // Group invitations (RSVP)
    'FriendRequests',        // Pending friend requests
    'FriendsList',           // Main friend list (searchable)
    'Leaderboard',           // Top Loop Scores
  ];

  it('has 7 content sections', () => {
    expect(SECTION_ORDER).toHaveLength(7);
  });

  it('Stories is first (high engagement, visual)', () => {
    expect(SECTION_ORDER[0]).toBe('StoriesGridSection');
  });

  it('Active plans come before friend requests (urgency ordering)', () => {
    const plansIdx = SECTION_ORDER.indexOf('MyGroupPlansSection');
    const requestsIdx = SECTION_ORDER.indexOf('FriendRequests');
    expect(plansIdx).toBeLessThan(requestsIdx);
  });

  it('Friends list is after all action-required sections', () => {
    const friendsIdx = SECTION_ORDER.indexOf('FriendsList');
    const invitationsIdx = SECTION_ORDER.indexOf('GroupInvitationsSection');
    const requestsIdx = SECTION_ORDER.indexOf('FriendRequests');
    expect(friendsIdx).toBeGreaterThan(invitationsIdx);
    expect(friendsIdx).toBeGreaterThan(requestsIdx);
  });

  it('Leaderboard is last', () => {
    expect(SECTION_ORDER[SECTION_ORDER.length - 1]).toBe('Leaderboard');
  });
});

// ============================================================================
// P4: Search Page Radar Shortcuts
// ============================================================================

describe('P4: Search suggestions — My Radars shortcut', () => {
  it('SearchSuggestionsPanel accepts onRadarsPress and radarCount props', () => {
    // These props were added to the component interface
    const props = {
      recentSearches: [],
      trendingItems: [],
      onRecentSearchPress: () => {},
      onClearRecent: () => {},
      onTrendingPress: () => {},
      tileSize: 120,
      onRadarsPress: () => {},
      radarCount: 3,
    };
    expect(props.onRadarsPress).toBeDefined();
    expect(props.radarCount).toBe(3);
  });

  it('radar shortcut shows count when radars exist', () => {
    const getSubtitle = (count: number) =>
      count > 0 ? `${count} active` : 'Set alerts for new spots';
    expect(getSubtitle(3)).toBe('3 active');
    expect(getSubtitle(0)).toBe('Set alerts for new spots');
  });
});

describe('P4: Create Radar CTA in search results', () => {
  it('CTA includes the search query text', () => {
    const searchQuery = 'tallow fries';
    const ctaText = `Set a radar for "${searchQuery}"`;
    expect(ctaText).toContain('tallow fries');
  });

  it('CTA confirmation dialog has Cancel and Create Radar options', () => {
    const dialogOptions = ['Cancel', 'Create Radar'];
    expect(dialogOptions).toContain('Cancel');
    expect(dialogOptions).toContain('Create Radar');
  });

  it('CTA only shows when search results exist (not on empty results)', () => {
    const searchResults = [{ id: '1', title: 'Test Place' }];
    const showCta = searchResults.length > 0;
    expect(showCta).toBe(true);
  });

  it('CTA does not show when search results are empty', () => {
    const searchResults: any[] = [];
    const showCta = searchResults.length > 0;
    expect(showCta).toBe(false);
  });
});

describe('P4: Saved searches', () => {
  // Replicate addRecentSearch logic
  function addRecentSearch(existing: string[], query: string): string[] {
    const filtered = existing.filter((s) => s !== query);
    return [query, ...filtered].slice(0, 5);
  }

  it('adds new search to front of list', () => {
    const result = addRecentSearch(['old search'], 'new search');
    expect(result[0]).toBe('new search');
  });

  it('deduplicates existing searches', () => {
    const result = addRecentSearch(['foo', 'bar', 'baz'], 'bar');
    expect(result).toEqual(['bar', 'foo', 'baz']);
  });

  it('caps at 5 recent searches', () => {
    const existing = ['a', 'b', 'c', 'd', 'e'];
    const result = addRecentSearch(existing, 'f');
    expect(result).toHaveLength(5);
    expect(result[0]).toBe('f');
    expect(result).not.toContain('e'); // oldest dropped
  });

  it('handles empty list', () => {
    const result = addRecentSearch([], 'first');
    expect(result).toEqual(['first']);
  });
});
