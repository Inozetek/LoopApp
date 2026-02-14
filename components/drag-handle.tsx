/**
 * DragHandle - Reusable iOS-style drag handle pill for bottom sheet modals
 *
 * Renders a small centered pill bar. If onClose is provided, wraps a
 * PanResponder so swiping down > 80px fires onClose().
 */

import React, { useRef } from 'react';
import { View, StyleSheet, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';

interface DragHandleProps {
  onClose?: () => void;
}

export function DragHandle({ onClose }: DragHandleProps) {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !!onClose,
      onMoveShouldSetPanResponder: (_e: GestureResponderEvent, gs: PanResponderGestureState) =>
        !!onClose && gs.dy > 10,
      onPanResponderRelease: (_e: GestureResponderEvent, gs: PanResponderGestureState) => {
        if (onClose && gs.dy > 80) {
          onClose();
        }
      },
    })
  ).current;

  return (
    <View style={styles.hitArea} {...panResponder.panHandlers}>
      <View style={styles.pill} />
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  pill: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
});
