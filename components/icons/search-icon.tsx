import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

interface SearchIconProps {
  size?: number;
  color?: string;
  filled?: boolean;
}

/**
 * Custom Search Icon
 * - Outline: Standard magnifying glass outline
 * - Filled: Circle (glass) is filled, handle remains outline
 */
export function SearchIcon({ size = 24, color = '#000', filled = false }: SearchIconProps) {
  const strokeWidth = 2;
  const circleRadius = 7.5;
  const circleCenterX = 11;
  const circleCenterY = 11;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Magnifying glass circle */}
      <Circle
        cx={circleCenterX}
        cy={circleCenterY}
        r={circleRadius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill={filled ? color : 'none'}
      />
      {/* Handle */}
      <Line
        x1={16.5}
        y1={16.5}
        x2={21}
        y2={21}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
