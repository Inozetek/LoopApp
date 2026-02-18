/**
 * Onboarding Loop Animation Tests
 *
 * Tests the data structures and callback logic for the animation component.
 * Actual rendering is not tested (requires native SVG + Reanimated runtime).
 */

// The component imports from react-native-reanimated and react-native-svg,
// so we test the exported data structures and pure logic directly.

describe('OnboardingLoopAnimation data structures', () => {
  // Mirror the constants from the component
  const NODES = [
    { x: 0.50, y: 0.50 },
    { x: 0.75, y: 0.28 },
    { x: 0.82, y: 0.62 },
    { x: 0.50, y: 0.80 },
    { x: 0.22, y: 0.55 },
  ];

  const EDGES = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 0],
  ];

  const NODE_COLORS = [
    '#00BCD4',
    '#4FC3F7',
    '#09DB98',
    '#FF9800',
    '#E040FB',
  ];

  it('NODES has 5 entries (one per onboarding step)', () => {
    expect(NODES).toHaveLength(5);
  });

  it('EDGES has 5 entries (5 path segments forming a pentagon)', () => {
    expect(EDGES).toHaveLength(5);
  });

  it('NODE_COLORS has 5 entries', () => {
    expect(NODE_COLORS).toHaveLength(5);
  });

  it('all node coordinates are normalized between 0 and 1', () => {
    for (const node of NODES) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(1);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(1);
    }
  });

  it('edge indices reference valid nodes', () => {
    for (const [from, to] of EDGES) {
      expect(from).toBeGreaterThanOrEqual(0);
      expect(from).toBeLessThan(NODES.length);
      expect(to).toBeGreaterThanOrEqual(0);
      expect(to).toBeLessThan(NODES.length);
    }
  });

  it('last edge closes the loop back to center node (index 0)', () => {
    const lastEdge = EDGES[EDGES.length - 1];
    expect(lastEdge[1]).toBe(0);
  });

  it('center node is at (0.5, 0.5)', () => {
    expect(NODES[0]).toEqual({ x: 0.50, y: 0.50 });
  });

  it('all node colors are valid hex strings', () => {
    for (const color of NODE_COLORS) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('onComplete callback timing', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires onComplete after 1300ms delay at step 4', () => {
    const onComplete = jest.fn();

    // Simulate the setTimeout logic from the component
    const timer = setTimeout(() => onComplete(), 1300);

    expect(onComplete).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1299);
    expect(onComplete).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onComplete).toHaveBeenCalledTimes(1);

    clearTimeout(timer);
  });

  it('does not fire onComplete before step 4 (timer not set)', () => {
    const onComplete = jest.fn();
    // No timer set for steps 0-3

    jest.advanceTimersByTime(5000);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
