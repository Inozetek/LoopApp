/**
 * Moments Row Component
 *
 * Instagram/Snapchat-style horizontal scroll of friend avatars
 * showing who has recent moments (stories).
 *
 * Features:
 * - Gradient ring for unseen moments (Loop blue)
 * - Gray ring for already viewed
 * - "+" avatar for adding own moment
 * - Tap to view friend's moments
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BrandColors, Spacing } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { FriendWithMoments } from '@/types/moment';

const AVATAR_SIZE = 64;
const RING_WIDTH = 3;
const AVATAR_INNER_SIZE = AVATAR_SIZE - RING_WIDTH * 2;
const ITEM_SPACING = 12;
const NAME_WIDTH = AVATAR_SIZE + 8;

// Loop brand gradient for unseen moments (Instagram-style gradient)
const UNSEEN_GRADIENT: [string, string, ...string[]] = [BrandColors.loopBlue, BrandColors.loopGreen, BrandColors.loopOrange];
// Gray for viewed moments
const VIEWED_RING_COLOR = '#9CA3AF';

interface MomentsRowProps {
  friends: FriendWithMoments[];
  onAddMoment: () => void;
  onViewMoments: (friendId: string) => void;
  currentUserMomentCount?: number;
  currentUserProfilePicture?: string;
}

interface MomentAvatarProps {
  friend: FriendWithMoments;
  onPress: () => void;
}

interface AddMomentAvatarProps {
  onPress: () => void;
  momentCount?: number;
  profilePictureUrl?: string;
}

/**
 * Individual friend avatar with moment ring
 */
function MomentAvatar({ friend, onPress }: MomentAvatarProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

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
        <View style={[styles.avatarRing, { borderColor: VIEWED_RING_COLOR, borderWidth: RING_WIDTH }]}>
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

      {/* Name */}
      <Text
        style={[styles.avatarName, { color: colors.text }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {friend.name.split(' ')[0]}
      </Text>

      {/* Unseen indicator dot */}
      {friend.hasUnseenMoments && (
        <View style={styles.unseenDot} />
      )}
    </TouchableOpacity>
  );
}

/**
 * "Add Moment" avatar (first item)
 */
function AddMomentAvatar({ onPress, momentCount = 0, profilePictureUrl }: AddMomentAvatarProps) {
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
            <Ionicons name="add" size={12} color="white" />
          </LinearGradient>
        </View>
      </View>

      <Text
        style={[styles.avatarName, { color: colors.text }]}
        numberOfLines={1}
      >
        Your Story
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Main MomentsRow component
 */
export function MomentsRow({
  friends,
  onAddMoment,
  onViewMoments,
  currentUserMomentCount = 0,
  currentUserProfilePicture,
}: MomentsRowProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const renderItem = useCallback(
    ({ item, index }: { item: FriendWithMoments | 'add'; index: number }) => {
      if (item === 'add') {
        return (
          <AddMomentAvatar
            onPress={onAddMoment}
            momentCount={currentUserMomentCount}
            profilePictureUrl={currentUserProfilePicture}
          />
        );
      }

      return (
        <MomentAvatar
          friend={item}
          onPress={() => onViewMoments(item.userId)}
        />
      );
    },
    [onAddMoment, onViewMoments, currentUserMomentCount, currentUserProfilePicture]
  );

  const keyExtractor = useCallback(
    (item: FriendWithMoments | 'add', index: number) => {
      if (item === 'add') return 'add-moment';
      return item.userId;
    },
    []
  );

  // Add "add" as first item
  const data: (FriendWithMoments | 'add')[] = ['add', ...friends];

  // Don't render if no friends with moments (except add button)
  if (friends.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <FlatList
          horizontal
          data={['add'] as ('add' | FriendWithMoments)[]}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        horizontal
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsHorizontalScrollIndicator={false}
        snapToInterval={AVATAR_SIZE + ITEM_SPACING}
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    gap: ITEM_SPACING,
  },
  avatarContainer: {
    alignItems: 'center',
    width: NAME_WIDTH,
  },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    width: AVATAR_INNER_SIZE,
    height: AVATAR_INNER_SIZE,
    borderRadius: AVATAR_INNER_SIZE / 2,
    overflow: 'hidden',
  },
  avatarInnerViewed: {
    width: AVATAR_SIZE - RING_WIDTH * 2 - 4, // Slightly smaller for gray ring
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
    fontSize: 24,
    fontWeight: '600',
  },
  avatarName: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
    width: NAME_WIDTH,
  },
  unseenDot: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
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
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
  addBadgeGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
