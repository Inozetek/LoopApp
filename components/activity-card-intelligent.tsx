/**
 * Activity Card - Intelligent & Data-Dense
 * Shows WHY Loop recommends this, not just pretty pictures
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Activity, Recommendation } from '@/types/activity';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface ActivityCardIntelligentProps {
  recommendation: Recommendation;
  onAddToCalendar: () => void;
  onSeeDetails: () => void;
  index: number;
}

export function ActivityCardIntelligent({
  recommendation,
  onAddToCalendar,
  onSeeDetails,
  index,
}: ActivityCardIntelligentProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  // Use flat Recommendation structure (not nested activity)
  const score = recommendation.scoreBreakdown || {
    baseScore: 0,
    locationScore: 0,
    timeScore: 0,
    feedbackScore: 0,
    collaborativeScore: 0,
    sponsoredBoost: 0,
    finalScore: recommendation.score || 0,
  };

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: index * 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getPriceDisplay = (priceRange?: number) => {
    if (!priceRange || priceRange === 0) return 'Free';
    return '$'.repeat(Math.max(1, priceRange));
  };

  const getDistanceText = (distanceStr?: string) => {
    if (!distanceStr) return 'Nearby';
    return distanceStr; // Already formatted as "X mi" from recommendation
  };

  // Confidence score color
  const getScoreColor = (finalScore: number) => {
    if (finalScore >= 80) return BrandColors.success;
    if (finalScore >= 60) return BrandColors.loopBlue;
    if (finalScore >= 40) return BrandColors.warning;
    return BrandColors.error;
  };

  // Score breakdown for transparency
  const getScoreBreakdown = () => {
    const breakdown = [];
    if (score.baseScore >= 30) breakdown.push(`Matches your interests`);
    if (score.locationScore >= 15) breakdown.push(`Very close by`);
    if (score.timeScore >= 12) breakdown.push(`Perfect timing`);
    if (score.feedbackScore >= 10) breakdown.push(`You liked similar places`);

    // Ensure we always have at least one reason
    if (breakdown.length === 0) {
      breakdown.push(`Recommended for you`);
    }

    return breakdown;
  };

  const scoreBreakdown = getScoreBreakdown();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Pressable
        onPress={onSeeDetails}
        onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        style={[styles.card, { backgroundColor: colors.card }]}
      >
        {/* Header Row */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.name, Typography.titleLarge, { color: colors.text }]} numberOfLines={2}>
              {recommendation.title}
            </Text>
            <View style={styles.metadata}>
              {recommendation.rating != null && recommendation.rating > 0 && (
                <>
                  <View style={styles.metaItem}>
                    <IconSymbol name="star.fill" size={14} color={BrandColors.star} />
                    <Text style={[styles.metaText, { color: colors.text }]}>
                      {recommendation.rating.toFixed(1)}
                    </Text>
                  </View>
                  <View style={styles.metaDivider} />
                </>
              )}
              <Text style={[styles.metaText, { color: colors.text }]}>
                {getPriceDisplay(recommendation.priceRange)}
              </Text>
              <View style={styles.metaDivider} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {getDistanceText(recommendation.distance)}
              </Text>
            </View>
          </View>

          {/* Confidence Score Badge */}
          <View style={[styles.scoreBadge, { backgroundColor: `${getScoreColor(score.finalScore || 0)}15` }]}>
            <Text style={[styles.scoreNumber, { color: getScoreColor(score.finalScore || 0) }]}>
              {Math.round(score.finalScore || 0)}
            </Text>
            <Text style={[styles.scoreLabel, { color: getScoreColor(score.finalScore || 0) }]}>
              match
            </Text>
          </View>
        </View>

        {/* Category Badge */}
        <View style={[styles.categoryBadge, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
            {recommendation.category}
          </Text>
        </View>

        {/* Why Loop Recommends This */}
        <View style={[styles.reasonContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={styles.reasonHeader}>
            <IconSymbol name="sparkles" size={16} color={colors.primary} />
            <Text style={[styles.reasonTitle, { color: colors.text }]}>
              Why we recommend this
            </Text>
          </View>
          {scoreBreakdown.map((reason, idx) => (
            <View key={idx} style={styles.reasonItem}>
              <View style={[styles.reasonDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.reasonText, { color: colors.textSecondary }]}>
                {reason}
              </Text>
            </View>
          ))}
        </View>

        {/* Score Breakdown (Expandable) */}
        <View style={styles.scoreDetails}>
          <Text style={[styles.scoreDetailsLabel, { color: colors.textSecondary }]}>
            Score Breakdown:
          </Text>
          <View style={styles.scoreBar}>
            <View style={[styles.scoreSegment, { width: `${((score.baseScore || 0) / 100) * 100}%`, backgroundColor: '#4CAF50' }]} />
            <View style={[styles.scoreSegment, { width: `${((score.locationScore || 0) / 100) * 100}%`, backgroundColor: '#2196F3' }]} />
            <View style={[styles.scoreSegment, { width: `${((score.timeScore || 0) / 100) * 100}%`, backgroundColor: '#FF9800' }]} />
            <View style={[styles.scoreSegment, { width: `${((score.feedbackScore || 0) / 100) * 100}%`, backgroundColor: '#9C27B0' }]} />
          </View>
          <View style={styles.scoreLabels}>
            <Text style={[styles.scoreLabelItem, { color: colors.textSecondary }]}>
              Interest {score.baseScore || 0}
            </Text>
            <Text style={[styles.scoreLabelItem, { color: colors.textSecondary }]}>
              Location {score.locationScore || 0}
            </Text>
            <Text style={[styles.scoreLabelItem, { color: colors.textSecondary }]}>
              Timing {score.timeScore || 0}
            </Text>
          </View>
        </View>

        {/* Action Button */}
        <Pressable
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={onAddToCalendar}
          onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        >
          <IconSymbol name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add to Calendar</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
    // Removed paddingHorizontal - let parent FlatList handle horizontal spacing
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  name: {
    marginBottom: Spacing.xs,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '500',
  },
  metaDivider: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#999',
  },
  scoreBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    minWidth: 60,
  },
  scoreNumber: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reasonContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  reasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  reasonTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  reasonDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  reasonText: {
    fontSize: 13,
    flex: 1,
  },
  scoreDetails: {
    marginBottom: Spacing.md,
  },
  scoreDetailsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  scoreBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  scoreSegment: {
    height: '100%',
  },
  scoreLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  scoreLabelItem: {
    fontSize: 11,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    shadowColor: BrandColors.loopBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
