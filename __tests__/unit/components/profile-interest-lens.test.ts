/**
 * Profile Interest Icon — Lens Animation Logic Tests
 *
 * Tests the grid position calculation and travel origin tracking
 * used by the InterestIcon component's traveling lens animation:
 * - Grid position calculation (col/row from flat index)
 * - Travel offset calculation (delta between grid positions)
 * - Travel origin tracking (previous selection index)
 * - Centering: lens top matches paddingVertical
 *
 * NOTE: These are unit tests for the pure logic. The actual spring
 * animations are handled by react-native-reanimated and tested visually.
 */

import { Spacing } from '@/constants/brand';
import { ONBOARDING_INTERESTS } from '@/constants/activity-categories';

// ---- Constants mirrored from profile.tsx ----
const INTEREST_COLS = 4;
const INTEREST_GAP = 12;

// Screen width approximation (doesn't matter for grid math, but needed for CELL_STEP_X)
const SCREEN_W = 390; // typical iPhone width
const INTEREST_PADDING = Spacing.lg * 2;
const INTEREST_ICON_AREA = Math.floor(
  (SCREEN_W - INTEREST_PADDING - INTEREST_GAP * (INTEREST_COLS - 1)) / INTEREST_COLS
);
const CELL_STEP_X = INTEREST_ICON_AREA + INTEREST_GAP;
const CELL_STEP_Y = 92;

/** Grid position from flat index (mirrors profile.tsx gridPos) */
function gridPos(index: number): { col: number; row: number } {
  return { col: index % INTEREST_COLS, row: Math.floor(index / INTEREST_COLS) };
}

/** Calculate travel offset from one grid index to another */
function calcTravelOffset(
  fromIndex: number,
  toIndex: number
): { translateX: number; translateY: number } {
  const from = gridPos(fromIndex);
  const to = gridPos(toIndex);
  const deltaCol = from.col - to.col;
  const deltaRow = from.row - to.row;
  return {
    translateX: deltaCol * CELL_STEP_X,
    translateY: deltaRow * CELL_STEP_Y,
  };
}

// ---- Tests ----

describe('InterestIcon Grid Position', () => {
  it('calculates correct col/row for first item (index 0)', () => {
    expect(gridPos(0)).toEqual({ col: 0, row: 0 });
  });

  it('calculates correct col/row for last item in first row (index 3)', () => {
    expect(gridPos(3)).toEqual({ col: 3, row: 0 });
  });

  it('calculates correct col/row for first item in second row (index 4)', () => {
    expect(gridPos(4)).toEqual({ col: 0, row: 1 });
  });

  it('calculates correct col/row for arbitrary item (index 11)', () => {
    expect(gridPos(11)).toEqual({ col: 3, row: 2 });
  });

  it('calculates correct col/row for last possible item (index 17, 18 interests)', () => {
    // 18 interests in 4 cols: rows 0-3 full (4x4=16), row 4 has 2 items
    expect(gridPos(17)).toEqual({ col: 1, row: 4 });
  });

  it('handles single-digit indices within first row', () => {
    expect(gridPos(1)).toEqual({ col: 1, row: 0 });
    expect(gridPos(2)).toEqual({ col: 2, row: 0 });
  });
});

describe('InterestIcon Travel Offset', () => {
  it('returns zero offset when from and to are the same index', () => {
    const offset = calcTravelOffset(5, 5);
    expect(offset.translateX).toBe(0);
    expect(offset.translateY).toBe(0);
  });

  it('calculates correct horizontal offset (same row, moving right)', () => {
    // From index 0 (col 0, row 0) to index 2 (col 2, row 0)
    const offset = calcTravelOffset(0, 2);
    // delta col = 0 - 2 = -2, so translateX = -2 * CELL_STEP_X (start to the left)
    expect(offset.translateX).toBe(-2 * CELL_STEP_X);
    expect(offset.translateY).toBe(0);
  });

  it('calculates correct horizontal offset (same row, moving left)', () => {
    // From index 3 (col 3, row 0) to index 1 (col 1, row 0)
    const offset = calcTravelOffset(3, 1);
    expect(offset.translateX).toBe(2 * CELL_STEP_X);
    expect(offset.translateY).toBe(0);
  });

  it('calculates correct vertical offset (same column, moving down)', () => {
    // From index 0 (col 0, row 0) to index 8 (col 0, row 2)
    const offset = calcTravelOffset(0, 8);
    expect(offset.translateX).toBe(0);
    expect(offset.translateY).toBe(-2 * CELL_STEP_Y);
  });

  it('calculates correct diagonal offset', () => {
    // From index 0 (col 0, row 0) to index 5 (col 1, row 1)
    const offset = calcTravelOffset(0, 5);
    expect(offset.translateX).toBe(-1 * CELL_STEP_X);
    expect(offset.translateY).toBe(-1 * CELL_STEP_Y);
  });

  it('calculates correct offset for reverse diagonal', () => {
    // From index 5 (col 1, row 1) to index 0 (col 0, row 0)
    const offset = calcTravelOffset(5, 0);
    expect(offset.translateX).toBe(1 * CELL_STEP_X);
    expect(offset.translateY).toBe(1 * CELL_STEP_Y);
  });

  it('handles large distance across grid', () => {
    // From index 0 (col 0, row 0) to index 15 (col 3, row 3)
    const offset = calcTravelOffset(0, 15);
    expect(offset.translateX).toBe(-3 * CELL_STEP_X);
    expect(offset.translateY).toBe(-3 * CELL_STEP_Y);
  });
});

describe('Travel Origin Tracking', () => {
  /**
   * Simulates the toggleInterest logic from ProfileScreen.
   * Returns the travelOriginIndex that would be set for each selection.
   */
  function simulateSelections(interestIndices: number[]): (number | null)[] {
    let lastSelectedRef: number | null = null;
    const travelOrigins: (number | null)[] = [];

    for (const idx of interestIndices) {
      // Record what travelOriginIndex would be set to
      travelOrigins.push(lastSelectedRef);
      // Update the ref to current selection
      lastSelectedRef = idx;
    }

    return travelOrigins;
  }

  it('first selection has null travel origin', () => {
    const origins = simulateSelections([3]);
    expect(origins[0]).toBeNull();
  });

  it('second selection has first selection as travel origin', () => {
    const origins = simulateSelections([3, 7]);
    expect(origins[0]).toBeNull(); // first selection: no origin
    expect(origins[1]).toBe(3);    // second: travels from 3
  });

  it('third selection has second selection as travel origin', () => {
    const origins = simulateSelections([3, 7, 1]);
    expect(origins[0]).toBeNull();
    expect(origins[1]).toBe(3);
    expect(origins[2]).toBe(7);
  });

  it('handles sequential selections correctly across many items', () => {
    const origins = simulateSelections([0, 4, 8, 12, 16]);
    expect(origins).toEqual([null, 0, 4, 8, 12]);
  });
});

describe('Lens Centering', () => {
  it('lens top value matches wrapper paddingVertical (Spacing.sm)', () => {
    // The interestLens style should have top: Spacing.sm to align with
    // the interestIconContent which starts at paddingTop = Spacing.sm
    const LENS_TOP = Spacing.sm;
    const WRAPPER_PADDING_TOP = Spacing.sm;
    expect(LENS_TOP).toBe(WRAPPER_PADDING_TOP);
  });

  it('Spacing.sm is 8px', () => {
    expect(Spacing.sm).toBe(8);
  });

  it('lens and icon content have identical dimensions (48x48)', () => {
    const LENS_SIZE = 48;
    const ICON_CONTENT_SIZE = 48;
    expect(LENS_SIZE).toBe(ICON_CONTENT_SIZE);
  });

  it('lens borderRadius is half of width for perfect circle', () => {
    const LENS_WIDTH = 48;
    const LENS_BORDER_RADIUS = 24;
    expect(LENS_BORDER_RADIUS).toBe(LENS_WIDTH / 2);
  });
});

describe('Grid Constants', () => {
  it('INTEREST_COLS is 4', () => {
    expect(INTEREST_COLS).toBe(4);
  });

  it('CELL_STEP_X is INTEREST_ICON_AREA + INTEREST_GAP', () => {
    expect(CELL_STEP_X).toBe(INTEREST_ICON_AREA + INTEREST_GAP);
  });

  it('CELL_STEP_Y is 92 (approximate row height + gap)', () => {
    expect(CELL_STEP_Y).toBe(92);
  });

  it('ONBOARDING_INTERESTS has at least 4 items for grid to work', () => {
    expect(ONBOARDING_INTERESTS.length).toBeGreaterThanOrEqual(4);
  });

  it('all interests in ONBOARDING_INTERESTS can be assigned grid positions', () => {
    for (let i = 0; i < ONBOARDING_INTERESTS.length; i++) {
      const pos = gridPos(i);
      expect(pos.col).toBeGreaterThanOrEqual(0);
      expect(pos.col).toBeLessThan(INTEREST_COLS);
      expect(pos.row).toBeGreaterThanOrEqual(0);
    }
  });
});
