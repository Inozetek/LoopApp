/**
 * LoopRouteIcon — Organic blob/amoeba shape with stop nodes.
 *
 * Renders a soft, Nickelodeon-splat-style irregular closed path with
 * gentle curves and large circular stop nodes at each lobe.
 *
 * Designed to look crisp at 14–24 px.
 */

import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface LoopRouteIconProps {
  size?: number;
  color?: string;
  /** Number of stop nodes on the blob (default 4) */
  stops?: number;
}

export function LoopRouteIcon({ size = 20, color = '#FFFFFF', stops = 4 }: LoopRouteIconProps) {
  // Soft amoeba shape — gentle, rounded lobes with no sharp turns.
  // All curves use wide control points for smooth, pillowy bends.
  // ViewBox 24x24, centered.
  const blobPath = [
    'M 10 3.5',                          // top — gentle start
    'C 13 3, 16 3.5, 18 6',             // soft sweep to upper-right
    'C 19.5 8, 21 9.5, 21 12',          // right lobe — gentle bulge
    'C 21 14.5, 19.5 17, 17 19',        // sweeps down-right softly
    'C 15 20.5, 12.5 21, 10 20.5',      // bottom sag — wide gentle curve
    'C 7.5 20, 5 18.5, 4 16',           // bottom-left lobe
    'C 3 13.5, 3 10.5, 4 8',            // left side — smooth return
    'C 5 5.5, 7 4, 10 3.5',             // closes gently back to top
    'Z',
  ].join(' ');

  // Stop nodes at the outermost point of each lobe — large and prominent.
  // Top & right nodes get slightly larger radius for visual balance at small sizes
  // (edge positions lose apparent weight due to path curvature).
  const allNodes = [
    { x: 10,  y: 3.5, r: 3.2 },   // top
    { x: 21,  y: 12,  r: 3.2 },   // right
    { x: 10,  y: 20.5, r: 2.8 },  // bottom
    { x: 4,   y: 16,  r: 2.8 },   // bottom-left
    { x: 4,   y: 8,   r: 2.8 },   // upper-left
  ];

  const nodePositions = allNodes.slice(0, stops);

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Soft amoeba path */}
      <Path
        d={blobPath}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Stop nodes — large, prominent */}
      {nodePositions.map((node, i) => (
        <Circle
          key={i}
          cx={node.x}
          cy={node.y}
          r={node.r}
          fill={color}
        />
      ))}
    </Svg>
  );
}
