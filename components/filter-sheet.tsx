/**
 * Filter Sheet Component
 *
 * iOS 2026 "Liquid Glass" style bottom sheet for filtering recommendations.
 * Features:
 * - Category, distance, price, and rating filters
 * - Blur background
 * - Smooth animations
 * - Haptic feedback
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Filter mode type - matches iOS Phone app pattern (All vs Missed -> AI Curated vs Explore)
export type FilterMode = 'ai_curated' | 'explore';

export interface FilterSheetFilters {
  mode: FilterMode; // Primary filter mode - AI Curated or Explore
  categories: string[];
  maxDistance: number; // in miles
  priceRange: 'any' | 1 | 2 | 3 | 4;
  minRating: number; // 0-5
  timeOfDay: 'any' | 'morning' | 'afternoon' | 'evening' | 'night';
}

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterSheetFilters;
  onFiltersChange: (filters: FilterSheetFilters) => void;
  onApply: () => void;
  onReset: () => void;
}

const CATEGORIES = [
  { id: 'restaurant', label: 'Restaurants', icon: 'restaurant-outline' },
  { id: 'cafe', label: 'Cafes', icon: 'cafe-outline' },
  { id: 'bar', label: 'Bars', icon: 'beer-outline' },
  { id: 'park', label: 'Parks', icon: 'leaf-outline' },
  { id: 'museum', label: 'Museums', icon: 'business-outline' },
  { id: 'shopping_mall', label: 'Shopping', icon: 'bag-outline' },
  { id: 'gym', label: 'Fitness', icon: 'barbell-outline' },
  { id: 'movie_theater', label: 'Movies', icon: 'film-outline' },
  { id: 'night_club', label: 'Nightlife', icon: 'moon-outline' },
  { id: 'tourist_attraction', label: 'Attractions', icon: 'camera-outline' },
];

const DISTANCES = [
  { value: 1, label: '1 mi' },
  { value: 3, label: '3 mi' },
  { value: 5, label: '5 mi' },
  { value: 10, label: '10 mi' },
  { value: 25, label: '25 mi' },
  { value: 100, label: 'Any' },
];

const PRICE_LEVELS = [
  { value: 'any' as const, label: 'Any' },
  { value: 1 as const, label: '$' },
  { value: 2 as const, label: '$$' },
  { value: 3 as const, label: '$$$' },
  { value: 4 as const, label: '$$$$' },
];

const RATINGS = [
  { value: 0, label: 'Any' },
  { value: 3, label: '3+' },
  { value: 3.5, label: '3.5+' },
  { value: 4, label: '4+' },
  { value: 4.5, label: '4.5+' },
];

const TIME_OPTIONS = [
  { value: 'any' as const, label: 'Any Time', icon: 'time-outline' },
  { value: 'morning' as const, label: 'Morning', icon: 'sunny-outline' },
  { value: 'afternoon' as const, label: 'Afternoon', icon: 'partly-sunny-outline' },
  { value: 'evening' as const, label: 'Evening', icon: 'cloudy-night-outline' },
  { value: 'night' as const, label: 'Night', icon: 'moon-outline' },
];

export function FilterSheet({
  visible,
  onClose,
  filters,
  onFiltersChange,
  onApply,
  onReset,
}: FilterSheetProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.categories.length > 0) count++;
    if (filters.maxDistance < 100) count++;
    if (filters.priceRange !== 'any') count++;
    if (filters.minRating > 0) count++;
    if (filters.timeOfDay !== 'any') count++;
    return count;
  }, [filters]);

  const toggleCategory = useCallback(
    (categoryId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newCategories = filters.categories.includes(categoryId)
        ? filters.categories.filter((c) => c !== categoryId)
        : [...filters.categories, categoryId];
      onFiltersChange({ ...filters, categories: newCategories });
    },
    [filters, onFiltersChange]
  );

  const setDistance = useCallback(
    (distance: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onFiltersChange({ ...filters, maxDistance: distance });
    },
    [filters, onFiltersChange]
  );

  const setPrice = useCallback(
    (price: FilterSheetFilters['priceRange']) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onFiltersChange({ ...filters, priceRange: price });
    },
    [filters, onFiltersChange]
  );

  const setRating = useCallback(
    (rating: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onFiltersChange({ ...filters, minRating: rating });
    },
    [filters, onFiltersChange]
  );

  const setTimeOfDay = useCallback(
    (time: FilterSheetFilters['timeOfDay']) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onFiltersChange({ ...filters, timeOfDay: time });
    },
    [filters, onFiltersChange]
  );

  const handleApply = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onApply();
    onClose();
  }, [onApply, onClose]);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReset();
  }, [onReset]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <BlurView
          intensity={colorScheme === 'dark' ? 40 : 20}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={styles.backdrop}
        >
          <TouchableWithoutFeedback>
            <Animated.View
              entering={SlideInDown.springify().damping(20)}
              exiting={SlideOutDown.springify().damping(20)}
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.cardBackground,
                  paddingBottom: insets.bottom + Spacing.md,
                },
              ]}
            >
              {/* Handle */}
              <View style={styles.handleContainer}>
                <View style={[styles.handle, { backgroundColor: colors.border }]} />
              </View>

              {/* Header */}
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Filters</Text>
                {activeFilterCount > 0 && (
                  <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
                    <Text style={[styles.resetText, { color: BrandColors.loopBlue }]}>
                      Reset ({activeFilterCount})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
              >
                {/* Categories */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    Categories
                  </Text>
                  <View style={styles.categoryGrid}>
                    {CATEGORIES.map((category) => {
                      const isSelected = filters.categories.includes(category.id);
                      return (
                        <TouchableOpacity
                          key={category.id}
                          onPress={() => toggleCategory(category.id)}
                          style={[
                            styles.categoryChip,
                            {
                              backgroundColor: isSelected
                                ? BrandColors.loopBlue
                                : colors.background,
                              borderColor: isSelected ? BrandColors.loopBlue : colors.border,
                            },
                          ]}
                        >
                          <Ionicons
                            name={category.icon as any}
                            size={16}
                            color={isSelected ? '#FFFFFF' : colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.categoryLabel,
                              { color: isSelected ? '#FFFFFF' : colors.text },
                            ]}
                          >
                            {category.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Time of Day */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    Time of Day
                  </Text>
                  <View style={styles.optionRow}>
                    {TIME_OPTIONS.map((option) => {
                      const isSelected = filters.timeOfDay === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          onPress={() => setTimeOfDay(option.value)}
                          style={[
                            styles.optionChip,
                            {
                              backgroundColor: isSelected
                                ? BrandColors.loopBlue
                                : colors.background,
                              borderColor: isSelected ? BrandColors.loopBlue : colors.border,
                            },
                          ]}
                        >
                          <Ionicons
                            name={option.icon as any}
                            size={14}
                            color={isSelected ? '#FFFFFF' : colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.optionLabel,
                              { color: isSelected ? '#FFFFFF' : colors.text },
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Distance */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    Distance
                  </Text>
                  <View style={styles.optionRow}>
                    {DISTANCES.map((option) => {
                      const isSelected = filters.maxDistance === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          onPress={() => setDistance(option.value)}
                          style={[
                            styles.optionChip,
                            {
                              backgroundColor: isSelected
                                ? BrandColors.loopBlue
                                : colors.background,
                              borderColor: isSelected ? BrandColors.loopBlue : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionLabel,
                              { color: isSelected ? '#FFFFFF' : colors.text },
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Price Range */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    Price Range
                  </Text>
                  <View style={styles.optionRow}>
                    {PRICE_LEVELS.map((option) => {
                      const isSelected = filters.priceRange === option.value;
                      return (
                        <TouchableOpacity
                          key={String(option.value)}
                          onPress={() => setPrice(option.value)}
                          style={[
                            styles.optionChip,
                            {
                              backgroundColor: isSelected
                                ? BrandColors.loopBlue
                                : colors.background,
                              borderColor: isSelected ? BrandColors.loopBlue : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionLabel,
                              { color: isSelected ? '#FFFFFF' : colors.text },
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Minimum Rating */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    Minimum Rating
                  </Text>
                  <View style={styles.optionRow}>
                    {RATINGS.map((option) => {
                      const isSelected = filters.minRating === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          onPress={() => setRating(option.value)}
                          style={[
                            styles.optionChip,
                            {
                              backgroundColor: isSelected
                                ? BrandColors.loopBlue
                                : colors.background,
                              borderColor: isSelected ? BrandColors.loopBlue : colors.border,
                            },
                          ]}
                        >
                          {option.value > 0 && (
                            <Ionicons name="star" size={12} color={isSelected ? '#FFFFFF' : '#FFD700'} />
                          )}
                          <Text
                            style={[
                              styles.optionLabel,
                              { color: isSelected ? '#FFFFFF' : colors.text },
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>

              {/* Apply Button */}
              <View style={styles.footer}>
                <TouchableOpacity
                  onPress={handleApply}
                  style={[styles.applyButton, { backgroundColor: BrandColors.loopBlue }]}
                >
                  <Text style={styles.applyButtonText}>
                    Apply Filters
                    {activeFilterCount > 0 && ` (${activeFilterCount})`}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </BlurView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    ...Typography.headlineMedium,
    fontFamily: 'Urbanist-Bold',
  },
  resetButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  resetText: {
    ...Typography.labelMedium,
    fontFamily: 'Urbanist-SemiBold',
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.labelMedium,
    fontFamily: 'Urbanist-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  categoryLabel: {
    ...Typography.bodySmall,
    fontFamily: 'Urbanist-Medium',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  optionLabel: {
    ...Typography.bodySmall,
    fontFamily: 'Urbanist-Medium',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  applyButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  applyButtonText: {
    ...Typography.labelLarge,
    fontFamily: 'Urbanist-Bold',
    color: '#FFFFFF',
  },
});
