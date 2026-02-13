import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface NavigationIconProps {
  size?: number;
  color?: string;
}

export function NavigationIcon({ size = 24, color = '#000' }: NavigationIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      <Path d="m200-120-40-40 320-720 320 720-40 40-280-120-280 120Zm84-124 196-84 196 84-196-440-196 440Zm196-84Z" />
    </Svg>
  );
}
