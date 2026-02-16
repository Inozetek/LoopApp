/**
 * Chat — Conversation List Screen
 *
 * Shows all 1:1 direct message conversations with last message preview,
 * unread indicators, and relative timestamps.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { BrandColors, ThemeColors, Spacing, BorderRadius } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { getConversations, type Conversation } from '@/services/chat-service';

export default function ChatListScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const themeColors = ThemeColors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await getConversations(user.id);
      setConversations(data);
    } catch {
      // Silent fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadConversations();
  }, [loadConversations]);

  const filteredConversations = searchQuery
    ? conversations.filter((c) =>
        c.other_user_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  // Relative time formatting
  const formatRelativeTime = (dateStr: string): string => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Now';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHr < 24) return `${diffHr}h`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getLastMessagePreview = (conv: Conversation): string => {
    if (!conv.last_message) return 'No messages yet';
    if (conv.last_message.message_type === 'activity_share') {
      const title = (conv.last_message.metadata as any)?.title ?? 'an activity';
      return `Shared ${title}`;
    }
    return conv.last_message.content || '';
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const hasUnread = (item.unread_count ?? 0) > 0;
    const initial = item.other_user_name?.[0]?.toUpperCase() ?? '?';

    return (
      <TouchableOpacity
        style={[styles.convRow, { borderBottomColor: colors.border }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/chat/${item.id}` as any);
        }}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        {item.other_user_avatar ? (
          <Image source={{ uri: item.other_user_avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: BrandColors.loopBlue + '20' }]}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}

        {/* Content */}
        <View style={styles.convContent}>
          <View style={styles.convTopRow}>
            <Text
              style={[
                styles.convName,
                { color: colors.text },
                hasUnread && styles.convNameBold,
              ]}
              numberOfLines={1}
            >
              {item.other_user_name ?? 'Unknown'}
            </Text>
            <Text style={[styles.convTime, { color: themeColors.textSecondary }]}>
              {item.last_message ? formatRelativeTime(item.last_message.created_at) : ''}
            </Text>
          </View>
          <View style={styles.convBottomRow}>
            <Text
              style={[
                styles.convPreview,
                { color: themeColors.textSecondary },
                hasUnread && { color: colors.text, fontWeight: '500' },
              ]}
              numberOfLines={1}
            >
              {getLastMessagePreview(item)}
            </Text>
            {hasUnread && <View style={styles.unreadDot} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Chat</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <Ionicons name="search-outline" size={18} color={themeColors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search conversations..."
          placeholderTextColor={themeColors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator color={BrandColors.loopBlue} size="large" />
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="chatbubbles-outline" size={48} color={themeColors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No messages yet</Text>
          <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
            Share an activity to start a conversation!
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={BrandColors.loopBlue} />
          }
        />
      )}
    </View>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: {
    width: 32,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: BrandColors.loopBlue,
  },
  convContent: {
    flex: 1,
    gap: 3,
  },
  convTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  convName: {
    fontSize: 16,
    fontWeight: '400',
    flex: 1,
  },
  convNameBold: {
    fontWeight: '700',
  },
  convTime: {
    fontSize: 12,
    marginLeft: 8,
  },
  convBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  convPreview: {
    fontSize: 14,
    flex: 1,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BrandColors.loopBlue,
    marginLeft: 8,
  },
});
