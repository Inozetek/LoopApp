import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ChevronLineUpIconProps {
  size?: number;
  color?: string;
}

export function ChevronLineUpIcon({ size = 24, color = '#000' }: ChevronLineUpIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      <Path d="M240-640v-80h480v80H240Zm56 416-56-56 240-240 240 240-56 56-184-184-184 184Z" />
    </Svg>
  );
}
