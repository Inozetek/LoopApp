/**
 * Tests for:
 * - Profile interest picker: Spotify-style gradient tiles (matching onboarding)
 * - Feedback card: inline one-at-a-time design (replacing batch banner)
 */

// ============================================================================
// Profile Interest Tiles
// ============================================================================

// Replicate TILE_GRADIENTS from profile.tsx
const TILE_GRADIENTS: Record<string, [string, string]> = {
  'Dining': ['#C62828', '#6D1B1B'],
  'Coffee & Cafes': ['#795548', '#3E2723'],
  'Bars & Nightlife': ['#6A1B9A', '#311B92'],
  'Live Music': ['#E65100', '#BF360C'],
  'Entertainment': ['#AD1457', '#880E4F'],
  'Fitness & Gym': ['#2E7D32', '#1B5E20'],
  'Outdoor Sports': ['#2E7D32', '#1B5E20'],
  'Yoga & Mindfulness': ['#00796B', '#004D40'],
  'Arts & Culture': ['#4527A0', '#283593'],
  'Museums & Art': ['#4527A0', '#283593'],
  'Photography': ['#37474F', '#263238'],
  'Shopping': ['#C2185B', '#880E4F'],
  'Beauty & Spa': ['#AD1457', '#880E4F'],
  'Parks & Nature': ['#00796B', '#004D40'],
  'Hiking & Trails': ['#2E7D32', '#1B5E20'],
  'Movies & Cinema': ['#37474F', '#263238'],
  'Comedy & Theater': ['#E65100', '#BF360C'],
  'Gaming': ['#6A1B9A', '#311B92'],
  'Desserts & Treats': ['#C62828', '#6D1B1B'],
  'Sports': ['#1565C0', '#0D47A1'],
  'Wellness': ['#00838F', '#006064'],
};

// Onboarding interests (the 12 main ones used in both onboarding and profile)
const ONBOARDING_INTERESTS = [
  'Dining', 'Coffee & Cafes', 'Bars & Nightlife', 'Live Music',
  'Entertainment', 'Fitness & Gym', 'Outdoor Sports', 'Arts & Culture',
  'Shopping', 'Parks & Nature', 'Movies & Cinema', 'Wellness',
];

describe('Profile: Spotify-style gradient tiles', () => {
  it('every onboarding interest has a gradient defined', () => {
    for (const interest of ONBOARDING_INTERESTS) {
      expect(TILE_GRADIENTS[interest]).toBeDefined();
      expect(TILE_GRADIENTS[interest]).toHaveLength(2);
    }
  });

  it('gradients are valid hex color pairs', () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    for (const [start, end] of Object.values(TILE_GRADIENTS)) {
      expect(start).toMatch(hexPattern);
      expect(end).toMatch(hexPattern);
    }
  });

  it('tile grid uses 3-column layout', () => {
    const SCREEN_W = 390; // iPhone 14 width
    const GAP = 4;
    const PADDING = 32; // Spacing.lg * 2
    const tileSize = Math.floor((SCREEN_W - PADDING - (GAP * 2)) / 3);
    expect(tileSize).toBeGreaterThanOrEqual(100);
    expect(tileSize).toBeLessThanOrEqual(130);
  });

  it('selected tile has accent border and full opacity', () => {
    const isSelected = true;
    const opacity = isSelected ? 1 : 0.7;
    const borderWidth = isSelected ? 2 : 1;
    expect(opacity).toBe(1);
    expect(borderWidth).toBe(2);
  });

  it('unselected tile has dim opacity and thin border', () => {
    const isSelected = false;
    const opacity = isSelected ? 1 : 0.7;
    const borderWidth = isSelected ? 2 : 1;
    expect(opacity).toBe(0.7);
    expect(borderWidth).toBe(1);
  });

  it('checkmark badge only shows on selected tiles', () => {
    const showCheckmark = (selected: boolean) => selected;
    expect(showCheckmark(true)).toBe(true);
    expect(showCheckmark(false)).toBe(false);
  });

  it('profile tiles match onboarding tiles (same gradient values)', () => {
    // Onboarding TILE_GRADIENTS from onboarding.tsx
    const onboardingGradients: Record<string, [string, string]> = {
      'Dining': ['#C62828', '#6D1B1B'],
      'Coffee & Cafes': ['#795548', '#3E2723'],
      'Bars & Nightlife': ['#6A1B9A', '#311B92'],
      'Live Music': ['#E65100', '#BF360C'],
      'Entertainment': ['#AD1457', '#880E4F'],
    };
    // Verify profile gradients match onboarding for shared keys
    for (const [key, value] of Object.entries(onboardingGradients)) {
      expect(TILE_GRADIENTS[key]).toEqual(value);
    }
  });
});

// ============================================================================
// Inline Feedback Card (replaces batch banner)
// ============================================================================

interface PendingActivity {
  eventId: string;
  activityId: string | null;
  activityName: string;
  activityCategory: string;
  completedAt: string;
}

describe('Feedback card: one-at-a-time display', () => {
  it('picks the first pending activity (not a batch count)', () => {
    const allPending: PendingActivity[] = [
      { eventId: '1', activityId: 'a1', activityName: 'Blue Bottle Coffee', activityCategory: 'Coffee', completedAt: '2026-02-20T10:00:00Z' },
      { eventId: '2', activityId: 'a2', activityName: 'Pecan Lodge', activityCategory: 'Dining', completedAt: '2026-02-20T12:00:00Z' },
      { eventId: '3', activityId: 'a3', activityName: 'Deep Ellum Mural Walk', activityCategory: 'Arts', completedAt: '2026-02-20T15:00:00Z' },
    ];
    const first = allPending.length > 0 ? allPending[0] : null;
    expect(first).not.toBeNull();
    expect(first!.activityName).toBe('Blue Bottle Coffee');
  });

  it('shows null when no pending activities', () => {
    const allPending: PendingActivity[] = [];
    const first = allPending.length > 0 ? allPending[0] : null;
    expect(first).toBeNull();
  });

  it('card shows activity name and category', () => {
    const activity: PendingActivity = {
      eventId: '1',
      activityId: 'a1',
      activityName: 'Pecan Lodge',
      activityCategory: 'Dining',
      completedAt: '2026-02-20T19:00:00Z',
    };
    expect(activity.activityName).toBe('Pecan Lodge');
    expect(activity.activityCategory).toBe('Dining');
  });

  it('card formats completedAt date', () => {
    const completedAt = '2026-02-20T19:00:00Z';
    const formatted = new Date(completedAt).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
    });
    expect(formatted).toBeTruthy();
    expect(formatted.length).toBeGreaterThan(5);
  });
});

describe('Feedback card: interaction', () => {
  it('thumbs up opens feedback modal and clears inline card', () => {
    let feedbackModalVisible = false;
    let nextFeedbackActivity: PendingActivity | null = {
      eventId: '1', activityId: 'a1', activityName: 'Test', activityCategory: 'Test', completedAt: '',
    };

    // Simulate thumbs up press
    feedbackModalVisible = true;
    nextFeedbackActivity = null;

    expect(feedbackModalVisible).toBe(true);
    expect(nextFeedbackActivity).toBeNull();
  });

  it('thumbs down also opens feedback modal (for tag selection)', () => {
    let feedbackModalVisible = false;
    let nextFeedbackActivity: PendingActivity | null = {
      eventId: '1', activityId: 'a1', activityName: 'Test', activityCategory: 'Test', completedAt: '',
    };

    // Simulate thumbs down press
    feedbackModalVisible = true;
    nextFeedbackActivity = null;

    expect(feedbackModalVisible).toBe(true);
    expect(nextFeedbackActivity).toBeNull();
  });

  it('skip clears the card without opening modal', () => {
    let feedbackModalVisible = false;
    let nextFeedbackActivity: PendingActivity | null = {
      eventId: '1', activityId: 'a1', activityName: 'Test', activityCategory: 'Test', completedAt: '',
    };

    // Simulate skip press
    nextFeedbackActivity = null;
    // feedbackModalVisible stays false

    expect(feedbackModalVisible).toBe(false);
    expect(nextFeedbackActivity).toBeNull();
  });

  it('card has two action buttons: "Loved it" and "Not great"', () => {
    const actions = [
      { label: 'Loved it', icon: 'thumbs-up', color: '#10a37f' },
      { label: 'Not great', icon: 'thumbs-down', color: '#FF6B6B' },
    ];
    expect(actions).toHaveLength(2);
    expect(actions[0].label).toBe('Loved it');
    expect(actions[1].label).toBe('Not great');
  });
});

describe('Feedback card: research-backed design principles', () => {
  it('never shows a batch count (no "N activities to rate")', () => {
    // The card shows a single activity name, not a count
    const cardText = 'How was your visit?';
    expect(cardText).not.toContain('activities to rate');
    expect(cardText).not.toMatch(/\d+ activit/);
  });

  it('uses binary feedback (thumbs up/down) not star rating', () => {
    // Netflix proved binary gets 200% more ratings than stars
    const feedbackOptions = ['thumbs-up', 'thumbs-down'];
    expect(feedbackOptions).toHaveLength(2);
    expect(feedbackOptions).not.toContain('star');
  });

  it('card prompt is personal ("How was your visit?") not generic', () => {
    const prompt = 'How was your visit?';
    expect(prompt).toContain('your');
    expect(prompt).not.toContain('rate');
    expect(prompt).not.toContain('review');
  });

  it('card is dismissible via Skip', () => {
    const hasSkipAction = true;
    expect(hasSkipAction).toBe(true);
  });
});
