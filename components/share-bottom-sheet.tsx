/**
 * Share Bottom Sheet — Instagram-style share experience
 *
 * Sections:
 * 1. Friends row — horizontal avatars, tap to select, blue check overlay
 * 2. Send button — animated pill, shows "Send to N"
 * 3. Action row — Copy Link, Share, Save Image
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Share,
  Animated,
  Dimensions,
  ActivityIndicator,
  Platform,
 Image } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { BrandColors, ThemeColors, Spacing, BorderRadius, Typography } from '@/constants/brand';
import { Colors } from '@/constants/theme';
import { getFriends } from '@/services/friends-service';
import { sendActivityShare, type ActivityShareMetadata } from '@/services/chat-service';
import type { Recommendation } from '@/types/activity';
import type { Friend } from '@/types/friend';

const SCREEN_WIDTH = Dimensions.get('window').width;
const AVATAR_SIZE = 56;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ShareBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  recommendation: Recommendation | null;
  onShareSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShareBottomSheet({
  visible,
  onClose,
  recommendation,
  onShareSuccess,
}: ShareBottomSheetProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const themeColors = ThemeColors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [copiedFlash, setCopiedFlash] = useState(false);

  // Slide animation
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      loadFriends();
      setSelectedIds(new Set());
      setSearchQuery('');
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible]);

  const loadFriends = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await getFriends(user.id);
      setFriends(data);
    } catch {
      // Silently fall back to empty
    } finally {
      setLoading(false);
    }
  };

  const toggleFriend = useCallback((friendId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) {
        next.delete(friendId);
      } else {
        next.add(friendId);
      }
      return next;
    });
  }, []);

  const filteredFriends = searchQuery
    ? friends.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : friends;

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const handleSend = async () => {
    if (!recommendation || !user?.id || selectedIds.size === 0) return;
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const metadata: ActivityShareMetadata = {
      placeId: recommendation.id,
      title: recommendation.title,
      category: recommendation.category,
      imageUrl: recommendation.imageUrl,
      rating: recommendation.rating,
      priceRange: recommendation.priceRange,
      distance: recommendation.distance,
      aiExplanation: recommendation.aiExplanation,
      address: recommendation.location,
    };

    const result = await sendActivityShare(
      user.id,
      Array.from(selectedIds),
      metadata
    );

    setSending(false);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onShareSuccess?.();
      onClose();
    }
  };

  const handleCopyLink = async () => {
    if (!recommendation) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const link = `loopapp://activity/${recommendation.id}`;
    // Use native share sheet to copy — expo-clipboard needs a dev build
    await Share.share({ message: link });
    setCopiedFlash(true);
    setTimeout(() => setCopiedFlash(false), 2000);
  };

  const handleNativeShare = async () => {
    if (!recommendation) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Check out ${recommendation.title} on Loop! ${recommendation.aiExplanation ?? ''}`.trim(),
      });
    } catch {
      // User cancelled
    }
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const renderFriend = ({ item }: { item: Friend }) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <TouchableOpacity
        style={styles.friendItem}
        onPress={() => toggleFriend(item.id)}
        activeOpacity={0.7}
        testID={`friend-${item.id}`}
      >
        <View style={styles.avatarWrapper}>
          {item.profilePictureUrl ? (
            <Image source={{ uri: item.profilePictureUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: BrandColors.loopBlue + '20' }]}>
              <Text style={styles.avatarInitial}>
                {item.name?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
          {isSelected && (
            <View style={styles.checkOverlay}>
              <Ionicons name="checkmark-circle" size={22} color={BrandColors.loopBlue} />
            </View>
          )}
        </View>
        <Text
          style={[styles.friendName, { color: colors.text }]}
          numberOfLines={1}
        >
          {item.name?.split(' ')[0] ?? 'Friend'}
        </Text>
      </TouchableOpacity>
    );
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        testID="share-backdrop"
      />

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.card,
            paddingBottom: insets.bottom + Spacing.md,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.dragHandle} />

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]}>Share</Text>

        {/* Search bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
          <Ionicons name="search-outline" size={18} color={themeColors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search friends..."
            placeholderTextColor={themeColors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="share-search-input"
          />
        </View>

        {/* Friends row */}
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={BrandColors.loopBlue} />
          </View>
        ) : filteredFriends.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              {searchQuery ? 'No friends match your search' : 'Add friends to share activities'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredFriends}
            renderItem={renderFriend}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.friendsList}
            testID="friends-list"
          />
        )}

        {/* Send button */}
        {selectedIds.size > 0 && (
          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={sending}
            activeOpacity={0.8}
            testID="send-button"
          >
            {sending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.sendButtonText}>
                Send to {selectedIds.size}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Action row */}
        <View style={styles.actionRow}>
          {/* Copy Link */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCopyLink}
            testID="copy-link-button"
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.background }]}>
              <Ionicons name="copy-outline" size={22} color={colors.text} />
            </View>
            <Text style={[styles.actionLabel, { color: themeColors.textSecondary }]}>
              {copiedFlash ? 'Copied!' : 'Copy Link'}
            </Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleNativeShare}
            testID="native-share-button"
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.background }]}>
              <Ionicons name="share-outline" size={22} color={colors.text} />
            </View>
            <Text style={[styles.actionLabel, { color: themeColors.textSecondary }]}>
              Share
            </Text>
          </TouchableOpacity>

          {/* Save Image (placeholder — requires react-native-view-shot + permissions) */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // Future: capture branded card + save via MediaLibrary
            }}
            testID="save-image-button"
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.background }]}>
              <Ionicons name="download-outline" size={22} color={colors.text} />
            </View>
            <Text style={[styles.actionLabel, { color: themeColors.textSecondary }]}>
              Save Image
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    minHeight: 320,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginBottom: Spacing.md,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  loadingRow: {
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRow: {
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  friendsList: {
    paddingVertical: Spacing.xs,
    gap: 12,
  },
  friendItem: {
    alignItems: 'center',
    width: 68,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: BrandColors.loopBlue,
  },
  checkOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFF',
    borderRadius: 12,
  },
  friendName: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    width: 64,
  },
  sendButton: {
    backgroundColor: BrandColors.loopBlue,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    marginHorizontal: Spacing.lg,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.sm,
  },
  actionButton: {
    alignItems: 'center',
    gap: 6,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 12,
  },
});
