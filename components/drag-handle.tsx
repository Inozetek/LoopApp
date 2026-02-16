/**
 * DragHandle - Reusable iOS-style drag handle pill for bottom sheet modals
 *
 * Renders a small centered pill bar. If onClose is provided, wraps a
 * PanResponder so swiping down > 80px fires onClose().
 */

import React, { useRef } from 'react';
import { View, StyleSheet, PanResponder, GestureResponderEvent, PanResponderGestureState, useColorScheme } from 'react-native';

interface DragHandleProps {
  onClose?: () => void;
}

export function DragHandle({ onClose }: DragHandleProps) {
  const colorScheme = useColorScheme();
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
      <View style={[styles.pill, { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.25)' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  pill: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
});
