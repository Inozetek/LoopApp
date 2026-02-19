/**
 * Tests for CalendarDayCell gradient color extraction logic
 *
 * Tests the pure `getGradientColors` function used to compute
 * the gradient ring colors from event dots.
 *
 * The function is duplicated here (same as recommendations.test.ts pattern)
 * to avoid importing the component which pulls in react-native.
 */

interface DayDot {
  key: string;
  color: string;
  selectedDotColor?: string;
}

/**
 * Mirrors getGradientColors from calendar-day-cell.tsx
 * Extract unique colors from dots for gradient ring.
 * Returns at least 2 colors (duplicates the single color for LinearGradient).
 */
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

describe('CalendarDayCell - getGradientColors', () => {
  it('returns empty array when no dots', () => {
    expect(getGradientColors([])).toEqual([]);
  });

  it('duplicates single color for LinearGradient compatibility', () => {
    const dots = [{ key: 'a', color: '#FF0000' }];
    expect(getGradientColors(dots)).toEqual(['#FF0000', '#FF0000']);
  });

  it('returns two unique colors for two different dots', () => {
    const dots = [
      { key: 'a', color: '#FF0000' },
      { key: 'b', color: '#00FF00' },
    ];
    expect(getGradientColors(dots)).toEqual(['#FF0000', '#00FF00']);
  });

  it('deduplicates same-color dots', () => {
    const dots = [
      { key: 'a', color: '#FF0000' },
      { key: 'b', color: '#FF0000' },
      { key: 'c', color: '#00FF00' },
    ];
    expect(getGradientColors(dots)).toEqual(['#FF0000', '#00FF00']);
  });

  it('returns three unique colors for three different dots', () => {
    const dots = [
      { key: 'a', color: '#FF0000' },
      { key: 'b', color: '#00FF00' },
      { key: 'c', color: '#0000FF' },
    ];
    expect(getGradientColors(dots)).toEqual(['#FF0000', '#00FF00', '#0000FF']);
  });

  it('handles all same-color dots', () => {
    const dots = [
      { key: 'a', color: '#123456' },
      { key: 'b', color: '#123456' },
      { key: 'c', color: '#123456' },
    ];
    // Single unique color, duplicated for LinearGradient
    expect(getGradientColors(dots)).toEqual(['#123456', '#123456']);
  });

  it('preserves order of first occurrence', () => {
    const dots = [
      { key: 'a', color: '#BLUE' },
      { key: 'b', color: '#RED' },
      { key: 'c', color: '#BLUE' },
      { key: 'd', color: '#GREEN' },
    ];
    expect(getGradientColors(dots)).toEqual(['#BLUE', '#RED', '#GREEN']);
  });

  it('handles four+ unique colors', () => {
    const dots = [
      { key: 'a', color: '#AA' },
      { key: 'b', color: '#BB' },
      { key: 'c', color: '#CC' },
      { key: 'd', color: '#DD' },
    ];
    expect(getGradientColors(dots)).toEqual(['#AA', '#BB', '#CC', '#DD']);
  });
});

// ---------------------------------------------------------------------------
// Pill Gradient Colors (smooth blend, keeps duplicates for proportion)
// ---------------------------------------------------------------------------

const MAX_PILL_SEGMENTS = 5;

/**
 * Mirrors getPillGradientColors from calendar-day-cell.tsx
 * Keeps duplicate colors so event distribution is proportional in gradient.
 * Returns at least 2 colors for LinearGradient compatibility.
 */
function getPillGradientColors(dots: DayDot[]): string[] {
  const colors = dots.slice(0, MAX_PILL_SEGMENTS).map(d => d.color);
  if (colors.length === 0) return [];
  if (colors.length === 1) return [colors[0], colors[0]];
  return colors;
}

describe('CalendarDayCell - getPillGradientColors', () => {
  it('returns empty for no dots', () => {
    expect(getPillGradientColors([])).toEqual([]);
  });

  it('duplicates single color for LinearGradient compat', () => {
    expect(getPillGradientColors([{ key: 'a', color: '#FF0000' }]))
      .toEqual(['#FF0000', '#FF0000']);
  });

  it('returns 2 colors for 2 events', () => {
    const dots = [
      { key: 'a', color: '#FF0000' },
      { key: 'b', color: '#00FF00' },
    ];
    expect(getPillGradientColors(dots)).toEqual(['#FF0000', '#00FF00']);
  });

  it('returns 3 colors for 3 events', () => {
    const dots = [
      { key: 'a', color: '#FF0000' },
      { key: 'b', color: '#00FF00' },
      { key: 'c', color: '#0000FF' },
    ];
    expect(getPillGradientColors(dots)).toEqual(['#FF0000', '#00FF00', '#0000FF']);
  });

  it('keeps duplicate colors (proportional representation)', () => {
    const dots = [
      { key: 'a', color: '#FF0000' },
      { key: 'b', color: '#FF0000' },
      { key: 'c', color: '#00FF00' },
    ];
    // Unlike getGradientColors (which dedupes), pill keeps all for proportional gradient
    expect(getPillGradientColors(dots)).toEqual(['#FF0000', '#FF0000', '#00FF00']);
  });

  it('caps at 5 colors for 7 events', () => {
    const dots = Array.from({ length: 7 }, (_, i) => ({
      key: `k${i}`,
      color: `#C${i}`,
    }));
    const result = getPillGradientColors(dots);
    expect(result).toHaveLength(5);
    expect(result).toEqual(['#C0', '#C1', '#C2', '#C3', '#C4']);
  });

  it('caps at 5 colors for 20 events', () => {
    const dots = Array.from({ length: 20 }, (_, i) => ({
      key: `k${i}`,
      color: `#${String(i).padStart(2, '0')}`,
    }));
    expect(getPillGradientColors(dots)).toHaveLength(5);
  });

  it('preserves original order (first 5 events)', () => {
    const colors = ['red', 'green', 'blue', 'orange', 'purple', 'cyan', 'pink'];
    const dots = colors.map((c, i) => ({ key: `k${i}`, color: c }));
    expect(getPillGradientColors(dots)).toEqual(['red', 'green', 'blue', 'orange', 'purple']);
  });
});
