import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Unknown5IconProps {
  size?: number;
  color?: string;
}

export function Unknown5Icon({ size = 24, color = '#000' }: Unknown5IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      <Path d="M160-480v-80h320v80H160ZM480-80q-80 0-153.5-29.5T196-196l56-56q47 44 106 68t122 24q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800v-80q83 0 155.5 31.5t127 86q54.5 54.5 86 127t31.5 155q0 82.5-31.5 155.5t-86 127.5q-54.5 54.5-127 86T480-80Z" />
    </Svg>
  );
}
