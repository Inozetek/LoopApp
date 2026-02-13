import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ForumIconProps {
  size?: number;
  color?: string;
}

/**
 * Forum Icon - Material Design
 * Two overlapping speech bubbles - represents group conversation/forum
 */
export function ForumIcon({ size = 24, color = '#000' }: ForumIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      <Path d="M280-240q-33 0-56.5-23.5T200-320v-80h520v-360h80q33 0 56.5 23.5T880-680v600L720-240H280ZM80-280v-560q0-33 23.5-56.5T160-920h480q33 0 56.5 23.5T720-840v320q0 33-23.5 56.5T640-440H240L80-280Zm560-440H160v360l46-40h434v-320Zm-480 0v320-320Z" />
    </Svg>
  );
}
