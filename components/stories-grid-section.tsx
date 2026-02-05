/**
 * Stories Grid Section Component
 *
 * Instagram-style 2-column grid of friend stories for the Friends tab.
 *
 * Features:
 * - 2-column grid layout with 72px avatars
 * - Gradient ring for unseen stories (Loop brand colors)
 * - Gray ring for already viewed stories
 * - "Add Story" button as first item
 * - Timestamps showing when story was posted
 * - Collapsible with "See all" link
 * - Tap to view friend's stories
 */

import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BrandColors, Spacing, BorderRadius, Typography } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { FriendWithMoments } from '@/types/moment';

const AVATAR_SIZE = 72;
const RING_WIDTH = 3;
const AVATAR_INNER_SIZE = AVATAR_SIZE - RING_WIDTH * 2;
const GRID_COLUMNS = 2;
const INITIAL_VISIBLE_COUNT = 4; // Show 2 rows initially (2x2)

// Loop brand gradient for unseen stories
const UNSEEN_GRADIENT: [string, string, ...string[]] = [
  BrandColors.loopBlue,
  BrandColors.loopGreen,
  BrandColors.loopOrange,
];
// Gray for viewed stories
const VIEWED_RING_COLOR = '#9CA3AF';

interface StoriesGridSectionProps {
  friends: FriendWithMoments[];
  onAddStory: () => void;
  onViewStory: (friendId: string) => void;
  currentUserProfilePicture?: string;
}

interface StoryAvatarProps {
  friend: FriendWithMoments;
  onPress: () => void;
}

interface AddStoryAvatarProps {
  onPress: () => void;
  profilePictureUrl?: string;
}

/**
 * Format timestamp to relative time (e.g., "2h ago")
 */
function formatTimestamp(timestamp: string | undefined): string {
  if (!timestamp) return '';

  const now = new Date();
  const momentDate = new Date(timestamp);
  const diffMs = now.getTime() - momentDate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

/**
 * Individual friend story avatar with gradient ring
 */
function StoryAvatar({ friend, onPress }: StoryAvatarProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const timestamp = formatTimestamp(friend.latestMomentAt);

  return (
    <TouchableOpacity
      style={styles.avatarContainer}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Ring container */}
      {friend.hasUnseenMoments ? (
        <LinearGradient
          colors={UNSEEN_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarRing}
        >
          <View style={[styles.avatarInner, { backgroundColor: colors.background }]}>
            {friend.profilePictureUrl ? (
              <Image
                source={{ uri: friend.profilePictureUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
                <Text style={[styles.avatarInitial, { color: colors.icon }]}>
                  {friend.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>
      ) : (
        <View style={[styles.avatarRing, styles.viewedRing]}>
          <View style={[styles.avatarInnerViewed, { backgroundColor: colors.background }]}>
            {friend.profilePictureUrl ? (
              <Image
                source={{ uri: friend.profilePictureUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
                <Text style={[styles.avatarInitial, { color: colors.icon }]}>
                  {friend.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Name and timestamp */}
      <View style={styles.nameContainer}>
        <Text
          style={[styles.avatarName, { color: colors.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {friend.name.split(' ')[0]}
        </Text>
        {timestamp && (
          <Text style={[styles.timestamp, { color: colors.icon }]}>
            {timestamp}
          </Text>
        )}
      </View>

      {/* Unseen indicator dot */}
      {friend.hasUnseenMoments && (
        <View style={styles.unseenDot} />
      )}
    </TouchableOpacity>
  );
}

/**
 * "Add Story" avatar (first item in grid)
 */
function AddStoryAvatar({ onPress, profilePictureUrl }: AddStoryAvatarProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  }, [onPress]);

  return (
    <TouchableOpacity
      style={styles.avatarContainer}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={[styles.addAvatarRing, { borderColor: colors.border }]}>
        {profilePictureUrl ? (
          <Image
            source={{ uri: profilePictureUrl }}
            style={styles.avatarImage}
          />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.card }]}>
            <Ionicons name="add" size={28} color={BrandColors.loopBlue} />
          </View>
        )}
        {/* Plus badge overlay */}
        <View style={styles.addBadge}>
          <LinearGradient
            colors={UNSEEN_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addBadgeGradient}
          >
            <Ionicons name="add" size={14} color="white" />
          </LinearGradient>
        </View>
      </View>

      <View style={styles.nameContainer}>
        <Text
          style={[styles.avatarName, { color: colors.text }]}
          numberOfLines={1}
        >
          Your Story
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Main StoriesGridSection component
 */
export function StoriesGridSection({
  friends,
  onAddStory,
  onViewStory,
  currentUserProfilePicture,
}: StoriesGridSectionProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [isExpanded, setIsExpanded] = useState(false);

  // Sort friends: unseen first, then by latest moment
  const sortedFriends = useMemo(() => {
    return [...friends].sort((a, b) => {
      if (a.hasUnseenMoments !== b.hasUnseenMoments) {
        return a.hasUnseenMoments ? -1 : 1;
      }
      return (
        new Date(b.latestMomentAt || 0).getTime() -
        new Date(a.latestMomentAt || 0).getTime()
      );
    });
  }, [friends]);

  // Determine visible friends based on expanded state
  const visibleFriends = isExpanded
    ? sortedFriends
    : sortedFriends.slice(0, INITIAL_VISIBLE_COUNT - 1); // -1 to account for "Add Story"

  const hasMoreFriends = sortedFriends.length > INITIAL_VISIBLE_COUNT - 1;
  const unseenCount = friends.filter((f) => f.hasUnseenMoments).length;

  const toggleExpanded = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded((prev) => !prev);
  }, []);

  // If no friends with moments, just show Add Story
  if (friends.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[Typography.titleMedium, { color: colors.text }]}>Stories</Text>
        </View>
        <View style={styles.grid}>
          <AddStoryAvatar
            onPress={onAddStory}
            profilePictureUrl={currentUserProfilePicture}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with unseen count and expand/collapse */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[Typography.titleMedium, { color: colors.text }]}>Stories</Text>
          {unseenCount > 0 && (
            <View style={[styles.badge, { backgroundColor: BrandColors.loopBlue }]}>
              <Text style={styles.badgeText}>{unseenCount}</Text>
            </View>
          )}
        </View>
        {hasMoreFriends && (
          <TouchableOpacity onPress={toggleExpanded} style={styles.seeAllButton}>
            <Text style={[styles.seeAllText, { color: BrandColors.loopBlue }]}>
              {isExpanded ? 'Show less' : 'See all'}
            </Text>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={BrandColors.loopBlue}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Grid of stories */}
      <View style={styles.grid}>
        {/* Add Story is always first */}
        <AddStoryAvatar
          onPress={onAddStory}
          profilePictureUrl={currentUserProfilePicture}
        />

        {/* Friend stories */}
        {visibleFriends.map((friend) => (
          <StoryAvatar
            key={friend.userId}
            friend={friend}
            onPress={() => onViewStory(friend.userId)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  avatarContainer: {
    alignItems: 'center',
    width: (100 / GRID_COLUMNS) + '%' as any,
    minWidth: 80,
    maxWidth: 100,
    paddingHorizontal: Spacing.xs,
  },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewedRing: {
    borderWidth: RING_WIDTH,
    borderColor: VIEWED_RING_COLOR,
  },
  avatarInner: {
    width: AVATAR_INNER_SIZE,
    height: AVATAR_INNER_SIZE,
    borderRadius: AVATAR_INNER_SIZE / 2,
    overflow: 'hidden',
  },
  avatarInnerViewed: {
    width: AVATAR_SIZE - RING_WIDTH * 2 - 4,
    height: AVATAR_SIZE - RING_WIDTH * 2 - 4,
    borderRadius: (AVATAR_SIZE - RING_WIDTH * 2 - 4) / 2,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: '600',
  },
  nameContainer: {
    alignItems: 'center',
    marginTop: Spacing.xs,
    width: '100%',
  },
  avatarName: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  timestamp: {
    fontSize: 10,
    marginTop: 2,
  },
  unseenDot: {
    position: 'absolute',
    top: 0,
    right: 10,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BrandColors.loopBlue,
    borderWidth: 2,
    borderColor: 'white',
  },
  addAvatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  addBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'white',
  },
  addBadgeGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
