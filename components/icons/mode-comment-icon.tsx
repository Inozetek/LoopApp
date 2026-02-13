import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ModeCommentIconProps {
  size?: number;
  color?: string;
  filled?: boolean;
}

/**
 * Mode Comment Icon - Material Design
 * Speech bubble shape - represents comments/chat/social
 * Tail points to bottom-right (matching Google Fonts)
 */
export function ModeCommentIcon({ size = 24, color = '#000', filled = false }: ModeCommentIconProps) {
  // Filled version: solid speech bubble
  // Outline version: hollow speech bubble
  const path = filled
    ? "M880-80 720-240H160q-33 0-56.5-23.5T80-320v-480q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v720Z"
    : "M880-80 720-240H160q-33 0-56.5-23.5T80-320v-480q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v720ZM160-320h594l46 45v-525H160v480Zm0 0v-480 480Z";

  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      <Path d={path} />
    </Svg>
  );
}
