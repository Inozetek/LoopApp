/**
 * Explore Header Component
 *
 * Instagram-style header for Explore tab with full-width search bar
 * and horizontal category filter chips.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Spacing, BorderRadius } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { CATEGORIES } from '@/components/category-selector';
import { BlurHeaderWrapper } from '@/components/blur-header-wrapper';

/** Short labels for category chips */
const SHORT_LABELS: Record<string, string> = {
  all: 'All',
  dining: 'Dining',
  coffee: 'Coffee',
  nightlife: 'Bars',
  entertainment: 'Fun',
  culture: 'Arts',
  shopping: 'Shopping',
  fitness: 'Fitness',
  outdoors: 'Outdoors',
  events: 'Events',
  family: 'Family',
  attractions: 'Sights',
  everyday: 'Everyday',
};

interface ExploreHeaderProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onSearchSubmit?: () => void;
  onFilterPress?: () => void;
  placeholder?: string;
  selectedCategory: string;
  onCategoryChange: (categoryId: string) => void;
  onSearchFocus?: () => void;
  onSearchBlur?: () => void;
}

export function ExploreHeader({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onFilterPress,
  placeholder = 'Search activities, places...',
  selectedCategory,
  onCategoryChange,
  onSearchFocus,
  onSearchBlur,
}: ExploreHeaderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const handleFilterPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFilterPress?.();
  };

  const handleCategoryPress = (categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCategoryChange(categoryId);
  };

  return (
    <BlurHeaderWrapper style={{ paddingTop: insets.top + Spacing.sm }}>
    <View style={styles.outerContainer}>
      {/* Search Row */}
      <View style={styles.searchRow}>
        <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
          <Ionicons name="search" size={20} color={colors.icon} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={onSearchChange}
            onSubmitEditing={onSearchSubmit}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            placeholder={placeholder}
            placeholderTextColor={colors.icon}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={200}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSearchChange('');
              }}
              style={styles.clearButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.icon} />
            </TouchableOpacity>
          )}
        </View>

        {onFilterPress && (
          <TouchableOpacity
            onPress={handleFilterPress}
            style={[styles.filterButton, { backgroundColor: colors.card }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="options-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
        style={styles.chipsScroll}
      >
        {CATEGORIES.map((cat) => {
          const isSelected = cat.id === selectedCategory;
          return (
            <TouchableOpacity
              key={cat.id}
              testID={`category-chip-${cat.id}`}
              onPress={() => handleCategoryPress(cat.id)}
              activeOpacity={0.7}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? cat.color : colors.card,
                  borderColor: isSelected ? cat.color : colors.card,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? '#FFFFFF' : colors.text },
                ]}
              >
                {SHORT_LABELS[cat.id] || cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
    </BlurHeaderWrapper>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    paddingBottom: 0,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  clearButton: {
    marginLeft: Spacing.xs,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsScroll: {
    maxHeight: 36,
  },
  chipsContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
