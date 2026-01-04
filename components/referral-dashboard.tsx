/**
 * Referral Dashboard - Show User's Referral Performance
 *
 * Displays:
 * - Referral stats
 * - Progress to next reward
 * - Active rewards
 * - Leaderboard rank
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { BrandColors, Spacing, BorderRadius, Shadows, Typography } from '@/constants/brand';
import {
  getReferralStats,
  getActiveRewards,
  type ReferralStats,
  type ReferralReward,
} from '@/services/referral-service';
// import { ReferralShareModal } from './referral-share-modal'; // TODO: Restore when implementing referral feature

interface ReferralDashboardProps {
  userId: string;
  userName?: string;
}

export function ReferralDashboard({ userId, userName }: ReferralDashboardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [rewards, setRewards] = useState<ReferralReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    loadReferralData();
  }, [userId]);

  const loadReferralData = async () => {
    setLoading(true);
    const [statsData, rewardsData] = await Promise.all([
      getReferralStats(userId),
      getActiveRewards(userId),
    ]);
    setStats(statsData);
    setRewards(rewardsData);
    setLoading(false);
  };

  const handleInviteFriends = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowShareModal(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.loopBlue} />
      </View>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Card */}
      <View style={[styles.card, { backgroundColor: colors.background }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>🎁 Referral Rewards</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Friends Invited"
            value={stats.completedReferrals.toString()}
            icon="people"
            color={BrandColors.loopGreen}
          />
          <StatCard
            label="Rewards Earned"
            value={stats.rewardsEarned.toString()}
            icon="gift"
            color={BrandColors.loopBlue}
          />
          <StatCard
            label="Plus Days Won"
            value={stats.totalPlusDaysEarned.toString()}
            icon="calendar"
            color="#FF9500"
          />
        </View>

        {/* Progress to Next Reward */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressTitle, { color: colors.text }]}>Next Milestone</Text>
            <Text style={[styles.progressValue, { color: BrandColors.loopBlue }]}>
              {stats.completedReferrals}/{stats.nextMilestone.count}
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={[styles.progressBarBg, { backgroundColor: colors.icon + '20' }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: BrandColors.loopGreen,
                  width: `${Math.min(stats.nextMilestone.progress * 100, 100)}%`,
                },
              ]}
            />
          </View>

          <Text style={[styles.progressReward, { color: colors.text }]}>
            🎯 {stats.nextMilestone.reward}
          </Text>
        </View>

        {/* Invite Button */}
        <TouchableOpacity
          style={[styles.inviteButton, { backgroundColor: BrandColors.loopBlue }]}
          onPress={handleInviteFriends}
          activeOpacity={0.8}
        >
          <Ionicons name="share-social" size={20} color="#FFFFFF" />
          <Text style={styles.inviteButtonText}>Invite Friends</Text>
        </TouchableOpacity>
      </View>

      {/* Active Rewards */}
      {rewards.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Active Rewards</Text>
          </View>

          {rewards.map((reward) => (
            <View key={reward.id} style={[styles.rewardCard, { backgroundColor: colors.icon + '10' }]}>
              <View style={styles.rewardContent}>
                <Text style={[styles.rewardDescription, { color: colors.text }]}>{reward.description}</Text>
                {reward.expiresAt && (
                  <Text style={[styles.rewardExpiry, { color: colors.icon }]}>
                    Expires {new Date(reward.expiresAt).toLocaleDateString()}
                  </Text>
                )}
              </View>
              <View style={[styles.rewardBadge, { backgroundColor: BrandColors.loopGreen }]}>
                <Text style={styles.rewardBadgeText}>{reward.plusDays}d</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* How It Works */}
      <View style={[styles.card, { backgroundColor: colors.background }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>How It Works</Text>
        </View>

        <View style={styles.stepsContainer}>
          <Step
            number={1}
            title="Share your code"
            description="Invite friends via SMS, WhatsApp, or Instagram"
            icon="share-social"
          />
          <Step
            number={2}
            title="They sign up"
            description="Friends get 7 days Loop Plus free with your code"
            icon="person-add"
          />
          <Step
            number={3}
            title="You both win"
            description="Invite 3 friends → Get 1 month Loop Plus free!"
            icon="trophy"
          />
        </View>
      </View>

      {/* Share Modal */}
      {/* TODO: Restore when implementing referral feature
      <ReferralShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        userId={userId}
        userName={userName}
      />
      */}
    </ScrollView>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.statCard, { backgroundColor: colors.icon + '10' }]}>
      <Ionicons name={icon} size={24} color={color} style={styles.statIcon} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.icon }]}>{label}</Text>
    </View>
  );
}

interface StepProps {
  number: number;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

function Step({ number, title, description, icon }: StepProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={styles.step}>
      <View style={[styles.stepNumber, { backgroundColor: BrandColors.loopBlue }]}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <Ionicons name={icon} size={20} color={BrandColors.loopBlue} />
          <Text style={[styles.stepTitle, { color: colors.text }]}>{title}</Text>
        </View>
        <Text style={[styles.stepDescription, { color: colors.icon }]}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  cardHeader: {
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.titleLarge,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  statIcon: {
    marginBottom: Spacing.xs,
  },
  statValue: {
    ...Typography.headlineMedium,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    ...Typography.labelSmall,
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: Spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  progressTitle: {
    ...Typography.titleMedium,
  },
  progressValue: {
    ...Typography.titleMedium,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressReward: {
    ...Typography.bodySmall,
    textAlign: 'center',
  },
  inviteButton: {
    height: 52,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadows.md,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    ...Typography.titleMedium,
  },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  rewardContent: {
    flex: 1,
  },
  rewardDescription: {
    ...Typography.bodyMedium,
    marginBottom: Spacing.xs,
  },
  rewardExpiry: {
    ...Typography.labelSmall,
  },
  rewardBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  rewardBadgeText: {
    color: '#FFFFFF',
    ...Typography.labelSmall,
  },
  stepsContainer: {
    gap: Spacing.md,
  },
  step: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#FFFFFF',
    ...Typography.bodyMedium,
  },
  stepContent: {
    flex: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  stepTitle: {
    ...Typography.titleMedium,
  },
  stepDescription: {
    ...Typography.bodySmall,
    lineHeight: 18,
  },
});
