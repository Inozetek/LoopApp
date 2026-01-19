/**
 * Feed Mode Toggle Component
 *
 * Allows users to switch between two feed modes:
 * - Daily: AI-curated, subscription-tier limited (5/15/30 recommendations)
 * - Explore: Browse mode, infinite scroll, no daily limits
 *
 * Design: Segmented control with smooth animation between states
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface FeedModeToggleProps {
  /** Current feed mode */
  mode: 'daily' | 'explore';
  /** Callback when mode changes */
  onChange: (mode: 'daily' | 'explore') => void;
  /** Number of daily recommendations remaining (optional, shows badge) */
  dailyRecommendationsLeft?: number;
}

export function FeedModeToggle({
  mode,
  onChange,
  dailyRecommendationsLeft,
}: FeedModeToggleProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  // Animation for sliding background indicator
  const slideAnim = React.useRef(new Animated.Value(mode === 'daily' ? 0 : 1)).current;

  React.useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: mode === 'daily' ? 0 : 1,
      useNativeDriver: true,
      tension: 150,
      friction: 10,
    }).start();
  }, [mode, slideAnim]);

  const handlePress = (newMode: 'daily' | 'explore') => {
    if (newMode !== mode) {
      onChange(newMode);
    }
  };

  // Calculate sliding indicator position
  const indicatorTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 120], // Adjust based on button width
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* Sliding background indicator */}
      <Animated.View
        style={[
          styles.indicator,
          {
            backgroundColor: colors.tint,
            transform: [{ translateX: indicatorTranslateX }],
          },
        ]}
      />

      {/* Daily button */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => handlePress('daily')}
        activeOpacity={0.7}
      >
        <View style={styles.buttonContent}>
          <Text
            style={[
              styles.buttonText,
              {
                color: mode === 'daily' ? colors.background : colors.text,
                fontWeight: mode === 'daily' ? '700' : '500',
              },
            ]}
          >
            Daily
          </Text>
          {mode === 'daily' && dailyRecommendationsLeft !== undefined && (
            <View
              style={[
                styles.countBadge,
                { backgroundColor: colors.background, opacity: 0.9 },
              ]}
            >
              <Text style={[styles.countText, { color: colors.tint }]}>
                {dailyRecommendationsLeft}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Explore button */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => handlePress('explore')}
        activeOpacity={0.7}
      >
        <View style={styles.buttonContent}>
          <Text
            style={[
              styles.buttonText,
              {
                color: mode === 'explore' ? colors.background : colors.text,
                fontWeight: mode === 'explore' ? '700' : '500',
              },
            ]}
          >
            Explore
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 2,
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: 16,
    marginVertical: 12,
  },
  indicator: {
    position: 'absolute',
    top: 2,
    left: 0,
    width: 116,
    height: 38,
    borderRadius: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonText: {
    fontSize: 15,
    letterSpacing: 0.2,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
