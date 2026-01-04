import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius } from '@/constants/brand';

export const CATEGORIES = [
  { id: 'all', label: 'All Categories', icon: 'apps', color: '#007AFF' },
  { id: 'dining', label: 'Dining', icon: 'restaurant', color: '#FF6B6B' },
  { id: 'coffee', label: 'Coffee & Cafes', icon: 'cafe', color: '#D4A574' },
  { id: 'nightlife', label: 'Bars & Nightlife', icon: 'beer', color: '#9B59B6' },
  { id: 'entertainment', label: 'Entertainment', icon: 'game-controller', color: '#E74C3C' },
  { id: 'culture', label: 'Arts & Culture', icon: 'color-palette', color: '#F39C12' },
  { id: 'shopping', label: 'Shopping', icon: 'cart', color: '#3498DB' },
  { id: 'fitness', label: 'Fitness & Wellness', icon: 'fitness', color: '#2ECC71' },
  { id: 'outdoors', label: 'Parks & Outdoors', icon: 'leaf', color: '#27AE60' },
  { id: 'events', label: 'Events & Venues', icon: 'calendar', color: '#E67E22' },
  { id: 'family', label: 'Family & Kids', icon: 'people', color: '#FF69B4' },
  { id: 'attractions', label: 'Tourist Attractions', icon: 'star', color: '#FFD700' },
  { id: 'everyday', label: 'Everyday & Specialty', icon: 'storefront', color: '#95A5A6' },
];

interface CategorySelectorProps {
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  mode?: 'single' | 'multi';
}

export function CategorySelector({
  selectedCategories,
  onCategoriesChange,
  mode = 'multi'
}: CategorySelectorProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const handleCategoryToggle = (categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (categoryId === 'all') {
      onCategoriesChange([]);
      return;
    }

    if (mode === 'single') {
      onCategoriesChange([categoryId]);
    } else {
      const isSelected = selectedCategories.includes(categoryId);
      if (isSelected) {
        onCategoriesChange(selectedCategories.filter(c => c !== categoryId));
      } else {
        onCategoriesChange([...selectedCategories, categoryId]);
      }
    }
  };

  const isAllSelected = selectedCategories.length === 0;

  return (
    <View style={styles.container}>
      <Text style={[Typography.titleMedium, { color: colors.text, marginBottom: Spacing.md }]}>
        Categories
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {CATEGORIES.map(category => {
          const isSelected = category.id === 'all'
            ? isAllSelected
            : selectedCategories.includes(category.id);

          return (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryChip,
                { backgroundColor: colors.cardBackground, borderColor: colors.border },
                isSelected && { backgroundColor: category.color, borderColor: category.color }
              ]}
              onPress={() => handleCategoryToggle(category.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={category.icon as any}
                size={18}
                color={isSelected ? '#FFFFFF' : category.color}
              />
              <Text style={[
                Typography.labelMedium,
                { color: isSelected ? '#FFFFFF' : colors.text }
              ]}>
                {category.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {mode === 'multi' && selectedCategories.length > 0 && (
        <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: Spacing.sm }]}>
          {selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'} selected
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },
  scrollContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
