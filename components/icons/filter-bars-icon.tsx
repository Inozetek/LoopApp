/**
 * Filter Bars Icon
 *
 * Custom SVG icon with three horizontal bars of decreasing width.
 * Used for the filter button in iOS 26 Liquid Glass style.
 *
 * Visual representation:
 * ━━━━━━━━━━━━  (longest - top)
 * ━━━━━━━━━━    (medium - middle)
 * ━━━━━━━━      (shortest - bottom)
 */

import React from 'react';
import Svg, { Rect } from 'react-native-svg';

interface FilterBarsIconProps {
  size?: number;
  color?: string;
}

export function FilterBarsIcon({ size = 24, color = '#000' }: FilterBarsIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Top bar - longest (20px width) */}
      <Rect x="2" y="5" width="20" height="2.5" rx="1.25" fill={color} />
      {/* Middle bar - medium (16px width) */}
      <Rect x="4" y="10.5" width="16" height="2.5" rx="1.25" fill={color} />
      {/* Bottom bar - shortest (12px width) */}
      <Rect x="6" y="16" width="12" height="2.5" rx="1.25" fill={color} />
    </Svg>
  );
}
