/**
 * Chat Activity Card — compact activity card rendered inline in chat messages
 *
 * Shows image thumbnail, title, category, rating, and action buttons.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { BrandColors, ThemeColors, Spacing, BorderRadius } from '@/constants/brand';
import type { ActivityShareMetadata, InviteStatus } from '@/services/chat-service';

interface ChatActivityCardProps {
  metadata: ActivityShareMetadata;
  isSentByMe: boolean;
  onViewDetails?: () => void;
  onAddToLoop?: () => void;
  onAcceptInvite?: () => void;
  onDeclineInvite?: () => void;
}

export function ChatActivityCard({
  metadata,
  isSentByMe,
  onViewDetails,
  onAddToLoop,
  onAcceptInvite,
  onDeclineInvite,
}: ChatActivityCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const themeColors = ThemeColors[colorScheme ?? 'light'];

  const inviteStatus = metadata.inviteStatus;
  const isResolved = inviteStatus === 'accepted' || inviteStatus === 'declined';

  const renderPriceRange = (range: number) => {
    return '$'.repeat(Math.max(1, Math.min(range, 4)));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Image + Info Row */}
      <View style={styles.topRow}>
        {metadata.imageUrl ? (
          <Image source={{ uri: metadata.imageUrl }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnailFallback, { backgroundColor: BrandColors.loopBlue + '15' }]}>
            <Ionicons name="location" size={28} color={BrandColors.loopBlue} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {metadata.title}
          </Text>
          <Text style={[styles.category, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {metadata.category}
          </Text>
          <View style={styles.metaRow}>
            {metadata.rating > 0 && (
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={12} color="#FBBF24" />
                <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                  {metadata.rating.toFixed(1)}
                </Text>
              </View>
            )}
            {metadata.priceRange > 0 && (
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                {renderPriceRange(metadata.priceRange)}
              </Text>
            )}
            {metadata.distance && (
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                {metadata.distance}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Status / Action buttons */}
      {isResolved ? (
        <View style={styles.statusRow}>
          <Text style={[styles.statusText, {
            color: inviteStatus === 'accepted' ? BrandColors.loopBlue : themeColors.textSecondary,
          }]}>
            {inviteStatus === 'accepted' ? 'Added to Loop \u2713' : 'Declined'}
          </Text>
        </View>
      ) : !isSentByMe ? (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.viewButton, { borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onViewDetails?.();
            }}
          >
            <Text style={[styles.actionText, { color: colors.text }]}>View Details</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.addButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              (onAddToLoop ?? onAcceptInvite)?.();
            }}
          >
            <Text style={styles.addButtonText}>Add to Loop</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.statusRow}>
          <Text style={[styles.sentLabel, { color: themeColors.textSecondary }]}>
            Shared
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    maxWidth: 280,
  },
  topRow: {
    flexDirection: 'row',
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.sm,
  },
  thumbnailFallback: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  category: {
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  metaText: {
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  viewButton: {
    borderWidth: 1,
  },
  addButton: {
    backgroundColor: BrandColors.loopBlue,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  statusRow: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sentLabel: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
