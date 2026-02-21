/**
 * Search Suggestions Panel
 *
 * Shown when the search bar is focused but query is empty.
 * Displays recent searches and trending items near the user.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Spacing, BrandColors } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors } from '@/constants/brand';
import { ExploreTile } from '@/components/explore-tile';
import type { ExploreItem } from '@/types/explore';

interface SearchSuggestionsPanelProps {
  recentSearches: string[];
  trendingItems: ExploreItem[];
  onRecentSearchPress: (query: string) => void;
  onClearRecent: () => void;
  onTrendingPress: (item: ExploreItem) => void;
  tileSize: number;
  onRadarsPress?: () => void;
  radarCount?: number;
}

export function SearchSuggestionsPanel({
  recentSearches,
  trendingItems,
  onRecentSearchPress,
  onClearRecent,
  onTrendingPress,
  tileSize,
  onRadarsPress,
  radarCount = 0,
}: SearchSuggestionsPanelProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = ThemeColors[colorScheme];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* My Radars Quick Access */}
      {onRadarsPress && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.radarShortcut, { backgroundColor: colors.card }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onRadarsPress();
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.radarIconBg, { backgroundColor: BrandColors.loopOrange + '15' }]}>
              <Ionicons name="radio-outline" size={18} color={BrandColors.loopOrange} />
            </View>
            <View style={styles.radarShortcutText}>
              <Text style={[styles.radarTitle, { color: colors.text }]}>My Radars</Text>
              <Text style={[styles.radarSubtitle, { color: colors.textSecondary }]}>
                {radarCount > 0 ? `${radarCount} active` : 'Set alerts for new spots'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent</Text>
            <TouchableOpacity onPress={onClearRecent} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.clearText, { color: colors.textSecondary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentRow}
          >
            {recentSearches.map((query) => (
              <TouchableOpacity
                key={query}
                style={[styles.recentPill, { backgroundColor: colors.card }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onRecentSearchPress(query);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.recentText, { color: colors.text }]} numberOfLines={1}>
                  {query}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Trending Near You */}
      {trendingItems.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Trending near you</Text>
          <View style={styles.trendingGrid}>
            {trendingItems.slice(0, 6).map((item) => (
              <ExploreTile
                key={item.id}
                item={{ ...item, tileSize: 'small' }}
                width={tileSize}
                height={tileSize}
                onPress={onTrendingPress}
                borderColor={colors.border}
              />
            ))}
          </View>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  clearText: {
    fontSize: 13,
    marginBottom: Spacing.sm,
  },
  recentRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  recentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  recentText: {
    fontSize: 13,
    maxWidth: 120,
  },
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  radarShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  radarIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarShortcutText: {
    flex: 1,
  },
  radarTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  radarSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
});
