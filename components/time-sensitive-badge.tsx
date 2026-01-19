/**
 * Time-Sensitive Badge Component
 *
 * Displays urgency badges for time-sensitive activities:
 * - "🔥 ACTIVE NOW" - Happy hour happening right now (pulsing red)
 * - "⏰ STARTS IN X HOURS" - Event/deal starting soon (orange)
 * - "⚡ TODAY ONLY" - Deal expires today (yellow)
 *
 * Used in recommendation cards to highlight time-sensitive opportunities.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface TimeSensitiveBadgeProps {
  /** Whether this activity/deal is currently active (e.g., happy hour happening now) */
  isActiveNow?: boolean;
  /** When this deal/event expires */
  dealExpiresAt?: Date;
  /** Number of hours until event/deal starts */
  startsIn?: number;
}

export function TimeSensitiveBadge({
  isActiveNow,
  dealExpiresAt,
  startsIn,
}: TimeSensitiveBadgeProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActiveNow) {
      // Pulsing animation for "ACTIVE NOW"
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => {
        pulse.stop();
      };
    }
  }, [isActiveNow, pulseAnim]);

  // Determine which badge to show (priority order)
  if (isActiveNow) {
    return (
      <Animated.View
        style={[
          styles.badge,
          styles.activeNow,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Text style={styles.badgeText}>🔥 ACTIVE NOW</Text>
      </Animated.View>
    );
  }

  if (startsIn !== undefined && startsIn <= 2) {
    return (
      <View style={[styles.badge, styles.startsSoon]}>
        <Text style={styles.badgeText}>⏰ STARTS IN {Math.ceil(startsIn)}H</Text>
      </View>
    );
  }

  if (dealExpiresAt) {
    const now = new Date();
    const hoursLeft = (dealExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursLeft > 0 && hoursLeft <= 24) {
      return (
        <View style={[styles.badge, styles.todayOnly]}>
          <Text style={styles.badgeText}>⚡ TODAY ONLY</Text>
        </View>
      );
    }
  }

  // No time-sensitive badge needed
  return null;
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  activeNow: {
    backgroundColor: '#FF3B30', // Red
  },
  startsSoon: {
    backgroundColor: '#FF9500', // Orange
  },
  todayOnly: {
    backgroundColor: '#FFCC00', // Yellow
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
