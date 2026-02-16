import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';

export type DiscoveryMode = 'for_you' | 'explore';

interface DiscoveryModeToggleProps {
  mode: DiscoveryMode;
  onModeChange: (mode: DiscoveryMode) => void;
}

export function DiscoveryModeToggle({ mode, onModeChange }: DiscoveryModeToggleProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const handleToggle = (newMode: DiscoveryMode) => {
    if (newMode === mode) return; // Don't toggle if already selected
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onModeChange(newMode);
  };

  return (
    <View style={styles.container}>
      <Text style={[Typography.titleMedium, { color: colors.text, marginBottom: Spacing.md }]}>
        Feed Mode
      </Text>

      <View style={styles.toggleContainer}>
        {/* For You Mode Button */}
        <TouchableOpacity
          style={[
            styles.toggleButton,
            { backgroundColor: colors.cardBackground, borderColor: colors.border },
            mode === 'for_you' && { backgroundColor: BrandColors.loopBlue, borderColor: BrandColors.loopBlue }
          ]}
          onPress={() => handleToggle('for_you')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="sparkles"
            size={20}
            color={mode === 'for_you' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text style={[
            Typography.labelLarge,
            { color: mode === 'for_you' ? '#FFFFFF' : colors.textSecondary }
          ]}>
            For You
          </Text>
        </TouchableOpacity>

        {/* Explore Mode Button */}
        <TouchableOpacity
          style={[
            styles.toggleButton,
            { backgroundColor: colors.cardBackground, borderColor: colors.border },
            mode === 'explore' && { backgroundColor: BrandColors.loopBlue, borderColor: BrandColors.loopBlue }
          ]}
          onPress={() => handleToggle('explore')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="compass"
            size={20}
            color={mode === 'explore' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text style={[
            Typography.labelLarge,
            { color: mode === 'explore' ? '#FFFFFF' : colors.textSecondary }
          ]}>
            Explore
          </Text>
        </TouchableOpacity>
      </View>

      {/* Explanation text */}
      <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: Spacing.sm, lineHeight: 18 }]}>
        {mode === 'for_you'
          ? "AI-personalized picks based on your interests, location, and feedback"
          : "Discovering activities across all categories - help us learn your preferences!"
        }
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
  },
});
