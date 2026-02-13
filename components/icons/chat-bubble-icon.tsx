import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ChatBubbleIconProps {
  size?: number;
  color?: string;
}

/**
 * Chat Bubble Icon - Clean bubble outline (no message lines)
 * Used for Friends/Groups tab to represent social/chat features
 */
export function ChatBubbleIcon({ size = 24, color = '#000' }: ChatBubbleIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      {/* Clean speech bubble outline - no internal lines */}
      <Path d="M80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240L80-80Zm126-240h594v-480H160v525l46-45Zm-46 0v-480 480Z" />
    </Svg>
  );
}

/**
 * Chat Icon with message lines inside
 */
export function ChatIcon({ size = 24, color = '#000' }: ChatBubbleIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      {/* Chat bubble with message lines */}
      <Path d="M240-400h480v-80H240v80Zm0-120h480v-80H240v80Zm0-120h480v-80H240v80ZM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240L80-80Zm126-240h594v-480H160v525l46-45Zm-46 0v-480 480Z" />
    </Svg>
  );
}

/**
 * Filled variant of chat bubble icon
 */
export function ChatBubbleFilledIcon({ size = 24, color = '#000' }: ChatBubbleIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      {/* Material Design chat bubble filled */}
      <Path d="M80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240L80-80Zm160-320h480v-80H240v80Zm0-120h480v-80H240v80Zm0-120h480v-80H240v80Z" />
    </Svg>
  );
}

/**
 * Two overlapping chat bubbles - great for group chat/friends
 */
export function GroupChatIcon({ size = 24, color = '#000' }: ChatBubbleIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      {/* Two chat bubbles overlapping */}
      <Path d="M280-240q-33 0-56.5-23.5T200-320v-400q0-33 23.5-56.5T280-800h400q33 0 56.5 23.5T760-720v400q0 33-23.5 56.5T680-240H280Zm0-80h400v-400H280v400Zm-80 240v-80h480v-480h80v480q0 33-23.5 56.5T680-80H200Zm80-320h400v-80H280v80Zm0-120h400v-80H280v80Z" />
    </Svg>
  );
}
