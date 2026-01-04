/**
 * Advanced Search Modal
 *
 * Comprehensive search and filter interface for feed customization:
 * - Search for places/events near user
 * - Filter by category, price, rating, distance
 * - Date picker for future recommendations
 * - Group recommendations toggle
 * - Map view with Google Places + user's tasks + events
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';

import { BrandColors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { LocationAutocomplete } from '@/components/location-autocomplete';

// Category options for filtering
const CATEGORIES = [
  { id: 'dining', label: 'Dining', icon: 'restaurant', color: '#FF6B6B' },
  { id: 'coffee', label: 'Coffee & Cafes', icon: 'cafe', color: '#D4A574' },
  { id: 'sports', label: 'Sports', icon: 'basketball', color: '#4ECDC4' },
  { id: 'fitness', label: 'Fitness', icon: 'fitness', color: '#95E1D3' },
  { id: 'music', label: 'Music', icon: 'musical-notes', color: '#9B59B6' },
  { id: 'entertainment', label: 'Entertainment', icon: 'film', color: '#3498DB' },
  { id: 'nightlife', label: 'Nightlife', icon: 'wine', color: '#E74C3C' },
  { id: 'shopping', label: 'Shopping', icon: 'cart', color: '#F39C12' },
  { id: 'arts', label: 'Arts & Culture', icon: 'color-palette', color: '#1ABC9C' },
  { id: 'outdoors', label: 'Outdoors', icon: 'leaf', color: '#27AE60' },
  { id: 'family', label: 'Family & Kids', icon: 'people', color: '#E91E63' },
  { id: 'wellness', label: 'Wellness', icon: 'heart', color: '#FF69B4' },
];

export interface SearchFilters {
  searchQuery: string;
  location: { latitude: number; longitude: number; address: string } | null;
  categories: string[];
  priceRange: number[]; // [min, max] where 0 = Free, 1-3 = $-$$$
  minRating: number; // 0-5 stars
  maxDistance: number; // in miles
  date: Date;
  timeOfDay: string[]; // ['morning', 'afternoon', 'evening', 'night']
  openNow: boolean;
  groupOnly: boolean;
  showMap: boolean;
}

interface AdvancedSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: SearchFilters) => void;
  currentFilters?: Partial<SearchFilters>;
  userLocation?: { latitude: number; longitude: number };
}

export function AdvancedSearchModal({
  visible,
  onClose,
  onApplyFilters,
  currentFilters = {},
  userLocation,
}: AdvancedSearchModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];

  // Search state
  const [searchQuery, setSearchQuery] = useState(currentFilters.searchQuery || '');
  const [searchLocation, setSearchLocation] = useState<{ latitude: number; longitude: number; address: string } | null>(
    currentFilters.location || null
  );

  // Filter state
  const [selectedCategories, setSelectedCategories] = useState<string[]>(currentFilters.categories || []);
  const [priceRange, setPriceRange] = useState<number[]>(currentFilters.priceRange || [0, 3]);
  const [minRating, setMinRating] = useState(currentFilters.minRating || 0);
  const [maxDistance, setMaxDistance] = useState(currentFilters.maxDistance || 10);
  const [selectedDate, setSelectedDate] = useState(currentFilters.date || new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<string[]>(currentFilters.timeOfDay || []);
  const [openNow, setOpenNow] = useState(currentFilters.openNow || false);
  const [groupOnly, setGroupOnly] = useState(currentFilters.groupOnly || false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleCategory = (categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleTimeOfDay = (time: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeOfDay(prev =>
      prev.includes(time)
        ? prev.filter(t => t !== time)
        : [...prev, time]
    );
  };

  const handleApply = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const filters: SearchFilters = {
      searchQuery,
      location: searchLocation,
      categories: selectedCategories,
      priceRange,
      minRating,
      maxDistance,
      date: selectedDate,
      timeOfDay,
      openNow,
      groupOnly,
      showMap: false,
    };

    onApplyFilters(filters);
    onClose();
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSearchQuery('');
    setSearchLocation(null);
    setSelectedCategories([]);
    setPriceRange([0, 3]);
    setMinRating(0);
    setMaxDistance(10);
    setSelectedDate(new Date());
    setTimeOfDay([]);
    setOpenNow(false);
    setGroupOnly(false);
  };

  const getPriceLabel = (value: number) => {
    if (value === 0) return 'Free';
    return '$'.repeat(value);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[Typography.headlineMedium, { color: colors.text }]}>
            Search & Filters
          </Text>
          <TouchableOpacity onPress={handleReset} style={styles.headerButton}>
            <Text style={[Typography.labelLarge, { color: BrandColors.loopBlue }]}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Search Bar */}
          <View style={styles.section}>
            <Text style={[Typography.labelLarge, styles.sectionTitle, { color: colors.text }]}>
              Search Location
            </Text>
            <LocationAutocomplete
              value={searchLocation?.address || ''}
              onChangeText={(text) => {
                if (!text) setSearchLocation(null);
              }}
              onSelectLocation={(location) => {
                setSearchLocation({
                  latitude: location.latitude,
                  longitude: location.longitude,
                  address: location.address,
                });
              }}
              placeholder="Search for a place or area..."
              isDark={isDark}
              userLocation={userLocation}
            />
            {searchLocation && (
              <TouchableOpacity
                onPress={() => setSearchLocation(null)}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color={colors.icon} />
                <Text style={[Typography.bodySmall, { color: colors.icon, marginLeft: 4 }]}>
                  Clear location
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Date Selector */}
          <View style={styles.section}>
            <Text style={[Typography.labelLarge, styles.sectionTitle, { color: colors.text }]}>
              Recommendation Date
            </Text>
            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: isDark ? '#2f3133' : '#f5f5f5' }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={BrandColors.loopBlue} />
              <Text style={[Typography.bodyLarge, { color: colors.text, marginLeft: Spacing.sm }]}>
                {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (date) setSelectedDate(date);
                }}
              />
            )}
          </View>

          {/* Category Filters */}
          <View style={styles.section}>
            <Text style={[Typography.labelLarge, styles.sectionTitle, { color: colors.text }]}>
              Categories ({selectedCategories.length} selected)
            </Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((category) => {
                const isSelected = selectedCategories.includes(category.id);
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: isSelected ? category.color : (isDark ? '#2f3133' : '#f5f5f5'),
                        borderColor: isSelected ? category.color : colors.border,
                      },
                    ]}
                    onPress={() => toggleCategory(category.id)}
                  >
                    <Ionicons
                      name={category.icon as any}
                      size={18}
                      color={isSelected ? '#ffffff' : colors.icon}
                    />
                    <Text
                      style={[
                        Typography.labelSmall,
                        {
                          color: isSelected ? '#ffffff' : colors.text,
                          marginTop: 4,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Quick Toggles */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="time-outline" size={20} color={BrandColors.loopBlue} />
                <Text style={[Typography.bodyLarge, { color: colors.text, marginLeft: 8 }]}>
                  Open Now
                </Text>
              </View>
              <Switch
                value={openNow}
                onValueChange={setOpenNow}
                trackColor={{ false: colors.border, true: BrandColors.loopBlue }}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="people-outline" size={20} color={BrandColors.loopBlue} />
                <Text style={[Typography.bodyLarge, { color: colors.text, marginLeft: 8 }]}>
                  Group Recommendations Only
                </Text>
              </View>
              <Switch
                value={groupOnly}
                onValueChange={setGroupOnly}
                trackColor={{ false: colors.border, true: BrandColors.loopBlue }}
              />
            </View>
          </View>

          {/* Advanced Filters (Collapsible) */}
          <TouchableOpacity
            style={styles.advancedToggle}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowAdvanced(!showAdvanced);
            }}
          >
            <Text style={[Typography.labelLarge, { color: BrandColors.loopBlue }]}>
              Advanced Filters
            </Text>
            <Ionicons
              name={showAdvanced ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={BrandColors.loopBlue}
            />
          </TouchableOpacity>

          {showAdvanced && (
            <View style={styles.advancedSection}>
              {/* Distance Slider */}
              <View style={styles.sliderContainer}>
                <View style={styles.sliderHeader}>
                  <Text style={[Typography.labelMedium, { color: colors.text }]}>Max Distance</Text>
                  <Text style={[Typography.labelLarge, { color: BrandColors.loopBlue }]}>
                    {maxDistance} mi
                  </Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={50}
                  step={1}
                  value={maxDistance}
                  onValueChange={setMaxDistance}
                  minimumTrackTintColor={BrandColors.loopBlue}
                  maximumTrackTintColor={colors.border}
                  thumbTintColor={BrandColors.loopBlue}
                />
                <View style={styles.sliderLabels}>
                  <Text style={[Typography.bodySmall, { color: colors.icon }]}>1 mi</Text>
                  <Text style={[Typography.bodySmall, { color: colors.icon }]}>50 mi</Text>
                </View>
              </View>

              {/* Price Range */}
              <View style={styles.sliderContainer}>
                <View style={styles.sliderHeader}>
                  <Text style={[Typography.labelMedium, { color: colors.text }]}>Price Range</Text>
                  <Text style={[Typography.labelLarge, { color: BrandColors.loopBlue }]}>
                    {getPriceLabel(priceRange[0])} - {getPriceLabel(priceRange[1])}
                  </Text>
                </View>
                <View style={styles.priceChips}>
                  {[0, 1, 2, 3].map((price) => (
                    <TouchableOpacity
                      key={price}
                      style={[
                        styles.priceChip,
                        {
                          backgroundColor:
                            price >= priceRange[0] && price <= priceRange[1]
                              ? BrandColors.loopBlue
                              : isDark
                              ? '#2f3133'
                              : '#f5f5f5',
                          borderColor:
                            price >= priceRange[0] && price <= priceRange[1]
                              ? BrandColors.loopBlue
                              : colors.border,
                        },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        // Toggle price in range
                        if (price < priceRange[0]) {
                          setPriceRange([price, priceRange[1]]);
                        } else if (price > priceRange[1]) {
                          setPriceRange([priceRange[0], price]);
                        }
                      }}
                    >
                      <Text
                        style={[
                          Typography.labelMedium,
                          {
                            color:
                              price >= priceRange[0] && price <= priceRange[1]
                                ? '#ffffff'
                                : colors.text,
                          },
                        ]}
                      >
                        {getPriceLabel(price)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Rating Filter */}
              <View style={styles.sliderContainer}>
                <View style={styles.sliderHeader}>
                  <Text style={[Typography.labelMedium, { color: colors.text }]}>Minimum Rating</Text>
                  <Text style={[Typography.labelLarge, { color: BrandColors.loopBlue }]}>
                    {minRating === 0 ? 'Any' : `${minRating.toFixed(1)}+ ⭐`}
                  </Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={5}
                  step={0.5}
                  value={minRating}
                  onValueChange={setMinRating}
                  minimumTrackTintColor={BrandColors.loopBlue}
                  maximumTrackTintColor={colors.border}
                  thumbTintColor={BrandColors.loopBlue}
                />
                <View style={styles.sliderLabels}>
                  <Text style={[Typography.bodySmall, { color: colors.icon }]}>Any</Text>
                  <Text style={[Typography.bodySmall, { color: colors.icon }]}>5.0 ⭐</Text>
                </View>
              </View>

              {/* Time of Day */}
              <View style={styles.timeOfDayContainer}>
                <Text style={[Typography.labelMedium, styles.sectionTitle, { color: colors.text }]}>
                  Time of Day
                </Text>
                <View style={styles.timeChips}>
                  {[
                    { id: 'morning', label: 'Morning', icon: 'sunny' },
                    { id: 'afternoon', label: 'Afternoon', icon: 'partly-sunny' },
                    { id: 'evening', label: 'Evening', icon: 'moon' },
                    { id: 'night', label: 'Night', icon: 'moon-outline' },
                  ].map((time) => {
                    const isSelected = timeOfDay.includes(time.id);
                    return (
                      <TouchableOpacity
                        key={time.id}
                        style={[
                          styles.timeChip,
                          {
                            backgroundColor: isSelected
                              ? BrandColors.loopBlue
                              : isDark
                              ? '#2f3133'
                              : '#f5f5f5',
                            borderColor: isSelected ? BrandColors.loopBlue : colors.border,
                          },
                        ]}
                        onPress={() => toggleTimeOfDay(time.id)}
                      >
                        <Ionicons
                          name={time.icon as any}
                          size={16}
                          color={isSelected ? '#ffffff' : colors.icon}
                        />
                        <Text
                          style={[
                            Typography.labelSmall,
                            { color: isSelected ? '#ffffff' : colors.text, marginLeft: 4 },
                          ]}
                        >
                          {time.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Apply Button */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.applyButton, { backgroundColor: BrandColors.loopBlue }]}
            onPress={handleApply}
          >
            <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
            <Text style={[Typography.labelLarge, { color: '#ffffff', marginLeft: 8 }]}>
              Apply Filters
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: Spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryChip: {
    width: '31%',
    aspectRatio: 1.2,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    padding: Spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  advancedSection: {
    paddingTop: Spacing.md,
  },
  sliderContainer: {
    marginBottom: Spacing.xl,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceChips: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  priceChip: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  timeOfDayContainer: {
    marginTop: Spacing.md,
  },
  timeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    ...Shadows.md,
  },
});
