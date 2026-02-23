/**
 * Messages Screen
 *
 * Displays a list of conversations sorted by most recent message.
 * Each row shows: friend avatar/initials, friend name, last message preview,
 * timestamp, and unread indicator.
 *
 * Tapping a conversation opens the MessageThread component as a modal.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { BrandColors, ThemeColors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/brand';
import {
  getConversations,
  getUnreadCount,
  type Conversation,
} from '@/services/chat-service';
import { MessageThread } from '@/components/message-thread';
import SwipeableLayout from '@/components/swipeable-layout';
import { ScreenErrorBoundary } from '@/components/error-boundary';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a timestamp into a short display string for conversation list. */
export function formatConversationTime(isoString: string | null | undefined): string {
  if (!isoString) return '';

  const date = new Date(isoString);
  const now = new Date();

  if (isNaN(date.getTime())) return '';

  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Less than 1 minute
  if (diffMins < 1) return 'Now';
  // Less than 60 minutes
  if (diffMins < 60) return `${diffMins}m`;
  // Less than 24 hours
  if (diffHours < 24) return `${diffHours}h`;
  // Less than 7 days
  if (diffDays < 7) return `${diffDays}d`;
  // Same year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  // Different year
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

/** Get a preview string for the last message in a conversation. */
export function getMessagePreview(conversation: Conversation): string {
  const msg = conversation.last_message;
  if (!msg) return 'No messages yet';

  switch (msg.message_type) {
    case 'activity_share': {
      const meta = msg.metadata as any;
      return `Shared ${meta?.title || 'an activity'}`;
    }
    case 'invite':
      return 'Sent an invite';
    case 'system':
      return msg.content || 'System message';
    case 'text':
    default:
      return msg.content || '';
  }
}

/** Get initials from a name string. */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MessagesScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const themeColors = ThemeColors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  // Thread modal state
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [threadVisible, setThreadVisible] = useState(false);

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [convos, unread] = await Promise.all([
        getConversations(user.id),
        getUnreadCount(user.id),
      ]);
      setConversations(convos);
      setTotalUnread(unread);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    loadConversations().finally(() => setLoading(false));
  }, [loadConversations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }, [loadConversations]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const openThread = (conversation: Conversation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedConversation(conversation);
    setThreadVisible(true);
  };

  const closeThread = () => {
    setThreadVisible(false);
    setSelectedConversation(null);
    // Refresh conversations to update unread counts after closing thread
    loadConversations();
  };

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const renderAvatar = (conversation: Conversation) => {
    if (conversation.other_user_avatar) {
      return (
        <Image
          source={{ uri: conversation.other_user_avatar }}
          style={styles.avatar}
        />
      );
    }
    return (
      <View style={[styles.avatarFallback, { backgroundColor: BrandColors.loopBlue + '20' }]}>
        <Text style={[styles.avatarInitials, { color: BrandColors.loopBlue }]}>
          {getInitials(conversation.other_user_name)}
        </Text>
      </View>
    );
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const hasUnread = (item.unread_count ?? 0) > 0;
    const preview = getMessagePreview(item);
    const time = formatConversationTime(item.last_message?.created_at || item.updated_at);

    return (
      <TouchableOpacity
        style={[styles.conversationRow, { borderBottomColor: colors.border }]}
        onPress={() => openThread(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Conversation with ${item.other_user_name || 'Unknown'}${hasUnread ? `, ${item.unread_count} unread` : ''}`}
        accessibilityHint="Opens message thread"
      >
        {/* Avatar */}
        {renderAvatar(item)}

        {/* Content */}
        <View style={styles.conversationContent}>
          <View style={styles.conversationTopRow}>
            <Text
              style={[
                styles.conversationName,
                { color: colors.text },
                hasUnread && styles.conversationNameUnread,
              ]}
              numberOfLines={1}
            >
              {item.other_user_name || 'Unknown'}
            </Text>
            <Text style={[styles.conversationTime, { color: themeColors.textSecondary }]}>
              {time}
            </Text>
          </View>
          <View style={styles.conversationBottomRow}>
            <Text
              style={[
                styles.conversationPreview,
                { color: themeColors.textSecondary },
                hasUnread && { color: colors.text, fontWeight: '500' },
              ]}
              numberOfLines={1}
            >
              {preview}
            </Text>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {(item.unread_count ?? 0) > 99 ? '99+' : item.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="chatbubbles-outline"
        size={64}
        color={themeColors.textSecondary}
        style={styles.emptyIcon}
      />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No messages yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
        Start a conversation from your friends list or share an activity with someone.
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.headerLeft} />
      <View style={styles.headerCenter}>
        <Text style={[styles.headerTitle, { color: colors.textSecondary || colors.text }]}>
          Messages
        </Text>
        {totalUnread > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              {totalUnread > 99 ? '99+' : totalUnread}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.headerRight} />
    </View>
  );

  // -------------------------------------------------------------------------
  // Loading skeleton
  // -------------------------------------------------------------------------

  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[styles.conversationRow, { borderBottomColor: colors.border }]}>
          <View style={[styles.skeletonAvatar, { backgroundColor: colors.border }]} />
          <View style={styles.conversationContent}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '50%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '80%', marginTop: 6 }]} />
          </View>
        </View>
      ))}
    </View>
  );

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <ScreenErrorBoundary screen="Messages">
    <SwipeableLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderHeader()}

        {loading ? (
          renderSkeleton()
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={renderConversation}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={BrandColors.loopBlue}
              />
            }
            contentContainerStyle={conversations.length === 0 ? styles.emptyList : undefined}
          />
        )}

        {/* Message Thread Modal */}
        <Modal
          visible={threadVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeThread}
        >
          {selectedConversation && user && (
            <MessageThread
              conversation={selectedConversation}
              currentUserId={user.id}
              onClose={closeThread}
            />
          )}
        </Modal>
      </View>
    </SwipeableLayout>
    </ScreenErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerLeft: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  headerBadge: {
    backgroundColor: BrandColors.loopBlue,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  headerRight: {
    width: 40,
  },

  // Conversation rows
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '600',
  },
  conversationContent: {
    flex: 1,
    marginLeft: Spacing.md - 4,
    justifyContent: 'center',
  },
  conversationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '400',
    flex: 1,
    marginRight: Spacing.sm,
  },
  conversationNameUnread: {
    fontWeight: '600',
  },
  conversationTime: {
    fontSize: 13,
  },
  conversationBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  conversationPreview: {
    fontSize: 14,
    flex: 1,
    marginRight: Spacing.sm,
  },
  unreadBadge: {
    backgroundColor: BrandColors.loopBlue,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Empty state
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    marginBottom: Spacing.md,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Skeleton
  skeletonContainer: {
    flex: 1,
  },
  skeletonAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
  },
});
