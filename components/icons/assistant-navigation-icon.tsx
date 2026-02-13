import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface AssistantNavigationIconProps {
  size?: number;
  color?: string;
}

/**
 * Assistant Navigation Icon - Material Design
 * Diamond/arrow shape pointing up - represents navigation/direction guidance
 */
export function AssistantNavigationIcon({ size = 24, color = '#000' }: AssistantNavigationIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      <Path d="M480-80 200-360l280-280 280 280L480-80Zm0-160 120-120-120-120-120 120 120 120Zm0-360L200-880h560L480-600Zm0-136 74-104h-148l74 104Zm0 0Z" />
    </Svg>
  );
}
