/**
 * Edge Pan Menu Trigger
 *
 * Invisible gesture detector on the left edge of the screen
 * that opens the main menu when swiped from the left edge.
 * Similar to iOS Safari's back gesture or Android's edge navigation.
 */

import React from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const EDGE_WIDTH = 30; // Width of the edge detection zone
const TRIGGER_THRESHOLD = 50; // How far to swipe to trigger menu

interface EdgePanMenuTriggerProps {
  onTrigger: () => void;
  enabled?: boolean;
}

export function EdgePanMenuTrigger({ onTrigger, enabled = true }: EdgePanMenuTriggerProps) {
  const startX = useSharedValue(0);
  const hasTriggered = useSharedValue(false);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const triggerMenu = () => {
    onTrigger();
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX(10) // Start detecting after 10px horizontal movement
    .failOffsetY([-30, 30]) // Fail if vertical movement exceeds 30px
    .onBegin((event) => {
      'worklet';
      startX.value = event.x;
      hasTriggered.value = false;
    })
    .onUpdate((event) => {
      'worklet';
      // Only trigger if started from the edge and hasn't triggered yet
      if (startX.value <= EDGE_WIDTH && !hasTriggered.value) {
        const deltaX = event.translationX;

        if (deltaX > TRIGGER_THRESHOLD) {
          hasTriggered.value = true;
          runOnJS(triggerHaptic)();
          runOnJS(triggerMenu)();
        }
      }
    })
    .enabled(enabled);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={styles.edgeZone} pointerEvents="box-only" />
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  edgeZone: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: EDGE_WIDTH,
    zIndex: 1000, // Above other content
  },
});
