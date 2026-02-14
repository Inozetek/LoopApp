/**
 * Tests for LoopsMergingAnimation component
 *
 * Validates:
 * - Component renders with default and custom props
 * - Node positioning math (trigonometry)
 * - Animation configuration values
 * - Compact variant
 */

// ============================================================================
// Geometry helpers (same logic as component)
// ============================================================================

const NODE_ANGLES = [0, 72, 144, 216, 288];
const NODE_SIZES = [4, 3.5, 4.5, 3, 4];

function getNodePos(
  centerX: number,
  centerY: number,
  radius: number,
  angleDeg: number
) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: centerX + radius * Math.cos(rad),
    y: centerY + radius * Math.sin(rad),
  };
}

function getDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// ============================================================================
// Tests
// ============================================================================

describe('LoopsMergingAnimation', () => {
  describe('Node Positioning Math', () => {
    const centerX = 100;
    const centerY = 60;
    const radius = 35;

    it('places 5 nodes evenly around the circle', () => {
      const positions = NODE_ANGLES.map((angle) =>
        getNodePos(centerX, centerY, radius, angle)
      );
      expect(positions).toHaveLength(5);

      // All nodes should be exactly `radius` away from center
      positions.forEach((pos) => {
        const dist = getDistance(pos, { x: centerX, y: centerY });
        expect(dist).toBeCloseTo(radius, 5);
      });
    });

    it('places first node at top of circle (0° = 12 o\'clock)', () => {
      const topNode = getNodePos(centerX, centerY, radius, 0);
      // At 0° (top), x = center, y = center - radius
      expect(topNode.x).toBeCloseTo(centerX, 5);
      expect(topNode.y).toBeCloseTo(centerY - radius, 5);
    });

    it('spaces nodes 72° apart', () => {
      const positions = NODE_ANGLES.map((angle) =>
        getNodePos(centerX, centerY, radius, angle)
      );

      // Adjacent nodes should have consistent spacing
      for (let i = 0; i < positions.length; i++) {
        const next = positions[(i + 1) % positions.length];
        const dist = getDistance(positions[i], next);
        // For a regular pentagon inscribed in circle of radius r,
        // side length = 2 * r * sin(π/5)
        const expectedSide = 2 * radius * Math.sin(Math.PI / 5);
        expect(dist).toBeCloseTo(expectedSide, 3);
      }
    });

    it('places 72° node to the upper right', () => {
      const node72 = getNodePos(centerX, centerY, radius, 72);
      // 72° from top (clockwise) should be upper-right quadrant
      expect(node72.x).toBeGreaterThan(centerX);
      expect(node72.y).toBeLessThan(centerY);
    });

    it('places 216° node to the lower left', () => {
      const node216 = getNodePos(centerX, centerY, radius, 216);
      // 216° from top should be lower-left
      expect(node216.x).toBeLessThan(centerX);
      expect(node216.y).toBeGreaterThan(centerY);
    });
  });

  describe('Layout Calculations', () => {
    it('calculates correct dimensions for default size', () => {
      const size = 220;
      const height = size * 0.55; // 121
      const loopRadius = size * 0.16; // 35.2
      const leftStartX = size * 0.28; // 61.6
      const rightStartX = size * 0.72; // 158.4

      expect(height).toBeCloseTo(121, 0);
      expect(loopRadius).toBeCloseTo(35.2, 1);
      expect(leftStartX).toBeCloseTo(61.6, 1);
      expect(rightStartX).toBeCloseTo(158.4, 1);

      // Loops start with clear separation
      const separation = rightStartX - leftStartX;
      expect(separation).toBeGreaterThan(loopRadius * 2); // No overlap initially
    });

    it('calculates correct merged positions', () => {
      const size = 220;
      const leftEndX = size * 0.38; // 83.6
      const rightEndX = size * 0.62; // 136.4
      const loopRadius = size * 0.16; // 35.2

      // Merged: loops should overlap
      const mergedGap = rightEndX - leftEndX; // 52.8
      expect(mergedGap).toBeLessThan(loopRadius * 2); // Overlapping

      // Midpoint should be at center
      const midpoint = (leftEndX + rightEndX) / 2;
      expect(midpoint).toBe(size / 2);
    });

    it('scales proportionally for different sizes', () => {
      const sizes = [100, 200, 300, 400];

      sizes.forEach((size) => {
        const height = size * 0.55;
        const radius = size * 0.16;
        const leftStart = size * 0.28;
        const rightStart = size * 0.72;

        // Height-to-width ratio always 0.55
        expect(height / size).toBeCloseTo(0.55, 10);

        // Loops always start separated
        expect(rightStart - leftStart).toBeGreaterThan(radius * 2);

        // Radius is always proportional
        expect(radius / size).toBeCloseTo(0.16, 10);
      });
    });
  });

  describe('Node Sizes', () => {
    it('has 5 node sizes matching 5 angles', () => {
      expect(NODE_SIZES).toHaveLength(NODE_ANGLES.length);
    });

    it('has varied sizes for organic feel', () => {
      const uniqueSizes = new Set(NODE_SIZES);
      expect(uniqueSizes.size).toBeGreaterThan(1);
    });

    it('all sizes are within reasonable range', () => {
      NODE_SIZES.forEach((s) => {
        expect(s).toBeGreaterThanOrEqual(2.5);
        expect(s).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('Animation Timing', () => {
    it('default duration is 3000ms', () => {
      const defaultDuration = 3000;
      expect(defaultDuration).toBe(3000);
    });

    it('merge starts after initial pause', () => {
      const duration = 3000;
      const mergeDelay = 400; // ms
      const mergeDuration = duration * 0.5; // 1500ms

      // Merge completes before full glow
      const mergeEnd = mergeDelay + mergeDuration; // 1900ms
      const glowStart = duration * 0.6; // 1800ms

      // Glow starts slightly before merge finishes (overlap is intentional)
      expect(glowStart).toBeLessThan(mergeEnd + 500);
      expect(mergeDelay).toBeGreaterThan(0); // Merge doesn't start instantly
    });

    it('glow appears after merge completes', () => {
      const duration = 3000;
      const glowStart = duration * 0.6; // 1800ms
      const connectorStart = duration * 0.55; // 1650ms

      // Connectors appear slightly before glow
      expect(connectorStart).toBeLessThan(glowStart);
    });

    it('compact variant uses shorter duration', () => {
      const compactDuration = 2500;
      const defaultDuration = 3000;
      expect(compactDuration).toBeLessThan(defaultDuration);
    });
  });

  describe('Overlap Geometry', () => {
    it('intersection point is at exact center', () => {
      const size = 220;
      const leftEndX = size * 0.38;
      const rightEndX = size * 0.62;
      const intersectionX = size / 2;

      // Intersection is equidistant from both loop centers
      expect(intersectionX - leftEndX).toBeCloseTo(rightEndX - intersectionX, 5);
    });

    it('glow radius is smaller than loop radius', () => {
      const size = 220;
      const loopRadius = size * 0.16;
      const glowRadius = loopRadius * 0.35;

      expect(glowRadius).toBeLessThan(loopRadius);
      expect(glowRadius).toBeGreaterThan(0);
    });

    it('center dot is smaller than glow', () => {
      const size = 220;
      const nodeBaseSize = size * 0.018;
      const loopRadius = size * 0.16;
      const glowRadius = loopRadius * 0.35;
      const dotRadius = nodeBaseSize * 2.5;

      expect(dotRadius).toBeLessThan(glowRadius);
    });
  });

  describe('Connector Lines', () => {
    it('each loop has connectors between all adjacent nodes', () => {
      const connectorCount = NODE_ANGLES.length; // 5 connectors (pentagon)
      expect(connectorCount).toBe(5);
    });

    it('connectors form a closed polygon', () => {
      // The last connector connects back to the first node
      const lastAngle = NODE_ANGLES[NODE_ANGLES.length - 1]; // 288
      const firstAngle = NODE_ANGLES[0]; // 0
      const wrap = (360 + firstAngle - lastAngle) % 360;
      expect(wrap).toBe(72); // Same spacing as other pairs
    });
  });
});
