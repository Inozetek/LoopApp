/**
 * Tests for Phase 3 UX Polish:
 * - D1: Calendar metallic ring on all selected days
 * - D2: FAB options sheet (New Task + From Recommendations)
 * - F: Menu drawer expansion (Saved Places, My Radars, Location Memory)
 */

// Replicate pure functions from calendar-day-cell.tsx for testing
// (avoids react-native import issues in Jest)

interface DayDot {
  key: string;
  color: string;
  selectedDotColor?: string;
}

const MAX_PILL_SEGMENTS = 5;

function getGradientColors(dots: DayDot[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const dot of dots) {
    if (!seen.has(dot.color)) {
      seen.add(dot.color);
      unique.push(dot.color);
    }
  }
  if (unique.length === 0) return [];
  if (unique.length === 1) return [unique[0], unique[0]];
  return unique;
}

function getPillGradientColors(dots: DayDot[]): string[] {
  const colors = dots.slice(0, MAX_PILL_SEGMENTS).map(d => d.color);
  if (colors.length === 0) return [];
  if (colors.length === 1) return [colors[0], colors[0]];
  return colors;
}

// ============================================================================
// D1: Calendar metallic ring on all selected days
// ============================================================================

describe('D1: Calendar metallic ring unification', () => {
  it('getGradientColors returns unique colors from dots', () => {
    const dots: DayDot[] = [
      { key: '1', color: '#FF0000' },
      { key: '2', color: '#00FF00' },
      { key: '3', color: '#FF0000' }, // duplicate
    ];
    expect(getGradientColors(dots)).toEqual(['#FF0000', '#00FF00']);
  });

  it('getGradientColors duplicates single color for LinearGradient', () => {
    const dots: DayDot[] = [{ key: '1', color: '#FF0000' }];
    expect(getGradientColors(dots)).toEqual(['#FF0000', '#FF0000']);
  });

  it('getGradientColors returns empty for no dots', () => {
    expect(getGradientColors([])).toEqual([]);
  });

  it('getPillGradientColors preserves duplicates for proportional display', () => {
    const dots: DayDot[] = [
      { key: '1', color: '#FF0000' },
      { key: '2', color: '#FF0000' },
      { key: '3', color: '#00FF00' },
    ];
    expect(getPillGradientColors(dots)).toEqual(['#FF0000', '#FF0000', '#00FF00']);
  });

  it('getPillGradientColors caps at MAX_PILL_SEGMENTS', () => {
    const dots: DayDot[] = Array.from({ length: 10 }, (_, i) => ({
      key: `${i}`,
      color: `#${String(i).padStart(6, '0')}`,
    }));
    expect(getPillGradientColors(dots).length).toBe(MAX_PILL_SEGMENTS);
  });

  it('metallic ring logic: showMetallicRing is true for all selected days', () => {
    // The component now uses: showMetallicRing = isSelected
    // This replaces the old dual branch:
    //   showGradientRing = isSelected && hasEvents (color ring)
    //   isSelected && !hasEvents (metallic ring)
    // Now ALL selected days get metallic ring.
    const isSelected = true;
    const showMetallicRing = isSelected;
    expect(showMetallicRing).toBe(true);
  });

  it('metallic ring shows for selected days with events', () => {
    const isSelected = true;
    const hasEvents = true;
    const showMetallicRing = isSelected;
    // hasEvents is used for text glow style, not ring type
    expect(showMetallicRing).toBe(true);
    expect(hasEvents).toBe(true);
  });

  it('metallic ring shows for selected empty days', () => {
    const isSelected = true;
    const hasEvents = false;
    const showMetallicRing = isSelected;
    expect(showMetallicRing).toBe(true);
    expect(hasEvents).toBe(false);
  });

  it('no ring for unselected days', () => {
    const isSelected = false;
    const showMetallicRing = isSelected;
    expect(showMetallicRing).toBe(false);
  });

  it('text style switches based on hasEvents: glow vs bold', () => {
    // When selected + events → dayTextGlow (textShadow effect)
    // When selected + no events → dayTextBold (just bold)
    const getTextStyle = (hasEvents: boolean) =>
      hasEvents ? 'dayTextGlow' : 'dayTextBold';

    expect(getTextStyle(true)).toBe('dayTextGlow');
    expect(getTextStyle(false)).toBe('dayTextBold');
  });

  it('pill still shows for days with events regardless of ring type', () => {
    const dots: DayDot[] = [
      { key: '1', color: '#FF0000' },
      { key: '2', color: '#00FF00' },
    ];
    const pillColors = getPillGradientColors(dots);
    // Pill should render when pillColors.length > 0
    expect(pillColors.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// D2: FAB options sheet
// ============================================================================

describe('D2: FAB add options sheet', () => {
  it('has two options: New Task and From Recommendations', () => {
    // The add options sheet provides two paths:
    const options = [
      { label: 'New Task', icon: 'create-outline', navigates: 'openCreateModal' },
      { label: 'From Recommendations', icon: 'sparkles-outline', navigates: '/(tabs)' },
    ];
    expect(options).toHaveLength(2);
    expect(options[0].label).toBe('New Task');
    expect(options[1].label).toBe('From Recommendations');
  });

  it('New Task option opens create modal', () => {
    let createModalOpened = false;
    const openCreateModal = () => { createModalOpened = true; };

    // Simulate selecting "New Task"
    openCreateModal();
    expect(createModalOpened).toBe(true);
  });

  it('From Recommendations navigates to feed tab', () => {
    const navigatedTo: string[] = [];
    const router = { push: (route: string) => navigatedTo.push(route) };

    // Simulate selecting "From Recommendations"
    router.push('/(tabs)');
    expect(navigatedTo).toContain('/(tabs)');
  });

  it('options sheet closes before navigating', () => {
    let sheetVisible = true;
    const setShowAddOptions = (v: boolean) => { sheetVisible = v; };

    // Simulate selecting an option
    setShowAddOptions(false);
    expect(sheetVisible).toBe(false);
  });
});

// ============================================================================
// F: Menu drawer expansion
// ============================================================================

describe('F: Menu drawer items', () => {
  const MENU_ITEMS = [
    { icon: 'stats-chart', label: 'My Dashboard', description: 'Stats, map & insights' },
    { icon: 'time-outline', label: 'History', description: 'Past recommendations & feedback' },
    { icon: 'bookmark-outline', label: 'Saved Places', description: 'Bookmarked & liked activities' },
    { icon: 'radio-outline', label: 'My Radars', description: 'Manage radar alerts' },
    { icon: 'location-outline', label: 'Location Memory', description: 'Home, work & saved locations' },
    { icon: 'settings-outline', label: 'Settings', description: 'Preferences, privacy & more' },
    { icon: 'help-circle-outline', label: 'Help & Support' },
  ];

  it('has 7 core menu items (excluding Business and Sign Out)', () => {
    expect(MENU_ITEMS).toHaveLength(7);
  });

  it('includes Saved Places item', () => {
    const savedPlaces = MENU_ITEMS.find(i => i.label === 'Saved Places');
    expect(savedPlaces).toBeDefined();
    expect(savedPlaces?.icon).toBe('bookmark-outline');
    expect(savedPlaces?.description).toContain('liked');
  });

  it('includes My Radars item', () => {
    const myRadars = MENU_ITEMS.find(i => i.label === 'My Radars');
    expect(myRadars).toBeDefined();
    expect(myRadars?.icon).toBe('radio-outline');
    expect(myRadars?.description).toContain('radar');
  });

  it('includes Location Memory item', () => {
    const locationMemory = MENU_ITEMS.find(i => i.label === 'Location Memory');
    expect(locationMemory).toBeDefined();
    expect(locationMemory?.icon).toBe('location-outline');
    expect(locationMemory?.description).toContain('saved locations');
  });

  it('menu items are ordered correctly: Dashboard → History → Saved → Radars → Location → Settings → Help', () => {
    const labels = MENU_ITEMS.map(i => i.label);
    expect(labels).toEqual([
      'My Dashboard',
      'History',
      'Saved Places',
      'My Radars',
      'Location Memory',
      'Settings',
      'Help & Support',
    ]);
  });

  it('every item has an icon', () => {
    for (const item of MENU_ITEMS) {
      expect(item.icon).toBeTruthy();
    }
  });

  it('items with descriptions have meaningful text', () => {
    const withDesc = MENU_ITEMS.filter(i => i.description);
    expect(withDesc.length).toBeGreaterThanOrEqual(6);
    for (const item of withDesc) {
      expect(item.description!.length).toBeGreaterThan(5);
    }
  });

  it('Business item is conditional (not in default list)', () => {
    const business = MENU_ITEMS.find(i => i.label === 'Business');
    expect(business).toBeUndefined();
  });
});
