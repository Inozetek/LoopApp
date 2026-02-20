/**
 * Tests for menu edge gesture and swipeable layout disableLeftEdgeSwipe logic.
 *
 * These test the pure functions / decision logic extracted from:
 * - SwipeableLayout: disableLeftEdgeSwipe prop behavior
 * - index.tsx: edge gesture thresholds and snap decisions
 * - loop-header.tsx: hamburger swipe gesture threshold
 */

const EDGE_ZONE_MENU = 30; // Left-edge detection zone (px)
const DRAWER_WIDTH = 340; // Example: 400px screen * 0.85
const SNAP_OPEN_DISTANCE = 60; // Minimum drag distance to snap open
const SNAP_OPEN_VELOCITY = 600; // Minimum velocity to snap open

/**
 * Mirrors SwipeableLayout's edge detection with disableLeftEdgeSwipe:
 *   isEdgeSwipe = (fromLeftEdge && !disableLeftEdgeSwipe) || fromRightEdge
 */
function isEdgeSwipe(
  absoluteX: number,
  screenWidth: number,
  edgeZone: number,
  disableLeftEdge: boolean,
): boolean {
  const fromLeftEdge = absoluteX < edgeZone;
  const fromRightEdge = absoluteX > screenWidth - edgeZone;
  return (fromLeftEdge && !disableLeftEdge) || fromRightEdge;
}

/**
 * Mirrors the menu open gesture progress calculation:
 *   progress = min(translationX / drawerWidth, 1)
 */
function menuDragProgress(translationX: number, drawerWidth: number): number {
  return Math.max(0, Math.min(translationX / drawerWidth, 1));
}

/**
 * Mirrors the snap decision from onEnd:
 *   snap open if tx > 60 || velocityX > 600
 */
function shouldSnapOpen(translationX: number, velocityX: number): boolean {
  return translationX > SNAP_OPEN_DISTANCE || velocityX > SNAP_OPEN_VELOCITY;
}

/**
 * Mirrors the edge zone check in menuEdgeGesture.onUpdate:
 *   startX = absoluteX - translationX
 *   if startX > EDGE_ZONE_MENU → ignore
 */
function isWithinEdgeZone(absoluteX: number, translationX: number): boolean {
  const startX = absoluteX - translationX;
  return startX <= EDGE_ZONE_MENU;
}

describe('SwipeableLayout - disableLeftEdgeSwipe', () => {
  const SCREEN_WIDTH = 400;
  const EDGE_ZONE = 50;

  it('detects left-edge swipe when NOT disabled', () => {
    expect(isEdgeSwipe(10, SCREEN_WIDTH, EDGE_ZONE, false)).toBe(true);
  });

  it('blocks left-edge swipe when disabled', () => {
    expect(isEdgeSwipe(10, SCREEN_WIDTH, EDGE_ZONE, true)).toBe(false);
  });

  it('still allows right-edge swipe when left is disabled', () => {
    expect(isEdgeSwipe(390, SCREEN_WIDTH, EDGE_ZONE, true)).toBe(true);
  });

  it('does not trigger for center-screen touches', () => {
    expect(isEdgeSwipe(200, SCREEN_WIDTH, EDGE_ZONE, false)).toBe(false);
    expect(isEdgeSwipe(200, SCREEN_WIDTH, EDGE_ZONE, true)).toBe(false);
  });

  it('triggers at exact edge boundary', () => {
    // absoluteX = 49 is inside 50px edge zone
    expect(isEdgeSwipe(49, SCREEN_WIDTH, EDGE_ZONE, false)).toBe(true);
    // absoluteX = 50 is outside edge zone
    expect(isEdgeSwipe(50, SCREEN_WIDTH, EDGE_ZONE, false)).toBe(false);
  });
});

describe('Menu edge gesture - progress calculation', () => {
  it('returns 0 for no drag', () => {
    expect(menuDragProgress(0, DRAWER_WIDTH)).toBe(0);
  });

  it('returns 1 when dragged full drawer width', () => {
    expect(menuDragProgress(DRAWER_WIDTH, DRAWER_WIDTH)).toBe(1);
  });

  it('caps at 1 for over-drag', () => {
    expect(menuDragProgress(DRAWER_WIDTH + 100, DRAWER_WIDTH)).toBe(1);
  });

  it('clamps negative values to 0', () => {
    expect(menuDragProgress(-50, DRAWER_WIDTH)).toBe(0);
  });

  it('is proportional at midpoint', () => {
    expect(menuDragProgress(DRAWER_WIDTH / 2, DRAWER_WIDTH)).toBeCloseTo(0.5, 5);
  });
});

describe('Menu edge gesture - snap decision', () => {
  it('snaps open with sufficient distance', () => {
    expect(shouldSnapOpen(70, 0)).toBe(true);
  });

  it('snaps open with sufficient velocity', () => {
    expect(shouldSnapOpen(30, 700)).toBe(true);
  });

  it('snaps open with both distance and velocity', () => {
    expect(shouldSnapOpen(70, 700)).toBe(true);
  });

  it('does not snap open with insufficient drag', () => {
    expect(shouldSnapOpen(40, 300)).toBe(false);
  });

  it('boundary: exactly at distance threshold does not snap', () => {
    expect(shouldSnapOpen(60, 0)).toBe(false);
  });

  it('boundary: exactly at velocity threshold does not snap', () => {
    expect(shouldSnapOpen(0, 600)).toBe(false);
  });

  it('boundary: just above distance threshold snaps', () => {
    expect(shouldSnapOpen(61, 0)).toBe(true);
  });

  it('boundary: just above velocity threshold snaps', () => {
    expect(shouldSnapOpen(0, 601)).toBe(true);
  });
});

describe('Menu edge gesture - edge zone detection', () => {
  it('accepts touch starting within edge zone', () => {
    // absoluteX=50, translationX=30 → startX=20 (within 30px zone)
    expect(isWithinEdgeZone(50, 30)).toBe(true);
  });

  it('rejects touch starting outside edge zone', () => {
    // absoluteX=150, translationX=30 → startX=120 (outside 30px zone)
    expect(isWithinEdgeZone(150, 30)).toBe(false);
  });

  it('accepts touch at exact edge boundary', () => {
    // absoluteX=50, translationX=20 → startX=30 (exactly at boundary)
    expect(isWithinEdgeZone(50, 20)).toBe(true);
  });

  it('rejects touch just outside edge boundary', () => {
    // absoluteX=52, translationX=20 → startX=32 (just outside)
    expect(isWithinEdgeZone(52, 20)).toBe(false);
  });

  it('handles zero translation', () => {
    // Touch starting at absoluteX=10, no drag yet
    expect(isWithinEdgeZone(10, 0)).toBe(true);
  });
});
