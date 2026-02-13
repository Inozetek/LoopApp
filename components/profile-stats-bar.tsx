/**
 * Profile Stats Bar
 *
 * Compact, mature stats row for the profile screen.
 * Replaces the old ProfileScoreHero with a Grok/LinkedIn-inspired aesthetic:
 * - 48px score ring (single accent color, no tier-dependent coloring)
 * - Ionicons outline icons (no emoji)
 * - Uniform muted colors for all stats
 *
 * Exports:
 *   ProfileStatsBar (default) — score ring + 3 stat columns
 *   TraitPills (named)        — horizontal wrap row of interest pills
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ThemeColors,
  BrandColors,
  Spacing,
  BorderRadius,
} from '@/constants/brand';
import {
  getCurrentTier,
  getTierProgress,
} from '@/utils/personality-generator';

// ---- Types ----

export interface FeedbackStats {
  totalFeedback: number;
  thumbsUpCount: number;
  thumbsDownCount: number;
  satisfactionRate: number;
}

interface ProfileStatsBarProps {
  loopScore: number;
  streakDays: number;
  feedbackStats: FeedbackStats;
}

interface TraitPillsProps {
  traits: string[];
}

// ---- Score Ring (48px, loopBlue always) ----

const RING_SIZE = 48;
const STROKE_WIDTH = 4;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ScoreRing({
  score,
  textColor,
  trackColor,
}: {
  score: number;
  textColor: string;
  trackColor: string;
}) {
  const progress = getTierProgress(score);
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  return (
    <View style={ringStyles.container}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        {/* Track */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          stroke={trackColor}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* Progress */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          stroke={BrandColors.loopBlue}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      <View style={ringStyles.labelContainer}>
        <Text style={[ringStyles.scoreNumber, { color: textColor }]}>{score}</Text>
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  container: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
});

// ---- FB-style thumbs-up (pure outline, no filled cuff) ----

function ThumbsUpIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="-1 -1 26 26" fill="none">
      {/* Thumb + hand */}
      <Path
        d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Cuff */}
      <Path
        d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ---- Stat Column ----

function StatColumn({
  icon,
  value,
  label,
  color,
  iconColor,
  customIcon,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  color: string;
  iconColor?: string;
  customIcon?: React.ReactNode;
}) {
  return (
    <View style={statStyles.column}>
      <View style={statStyles.valueRow}>
        <Text style={[statStyles.value, { color }]} numberOfLines={1}>{value}</Text>
        {customIcon ?? <Ionicons name={icon!} size={14} color={iconColor ?? color} />}
      </View>
      <Text style={[statStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});

// ---- ProfileStatsBar ----

export default function ProfileStatsBar({
  loopScore,
  streakDays,
  feedbackStats,
}: ProfileStatsBarProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const tier = getCurrentTier(loopScore);

  return (
    <View style={styles.row}>
      {/* Score ring + tier label */}
      <View style={styles.scoreSection}>
        <ScoreRing score={loopScore} textColor={colors.text} trackColor={colors.border} />
        <Text style={[styles.tierLabel, { color: colors.textSecondary }]}>{tier.label}</Text>
      </View>

      {/* Vertical divider */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* 3 stat columns */}
      <StatColumn
        icon="chatbubble-outline"
        value={String(feedbackStats.totalFeedback)}
        label="Reviews"
        color={colors.text}
      />
      <StatColumn
        customIcon={<ThumbsUpIcon size={14} color={colors.text} />}
        value={String(feedbackStats.thumbsUpCount)}
        label="Approved"
        color={colors.text}
      />
      <StatColumn
        icon="flame-outline"
        value={String(streakDays)}
        label="Streak"
        color={colors.text}
      />
    </View>
  );
}

// ---- TraitPills ----

export function TraitPills({ traits }: TraitPillsProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  if (traits.length === 0) return null;

  return (
    <View style={pillStyles.row}>
      {traits.map((trait) => (
        <View key={trait} style={[pillStyles.pill, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[pillStyles.text, { color: colors.textSecondary }]}>{trait}</Text>
        </View>
      ))}
    </View>
  );
}

const pillStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
});

// ---- Shared styles ----

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  scoreSection: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: 4,
  },
  tierLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 32,
    marginHorizontal: Spacing.sm,
  },
});
