/**
 * Chat — Individual Conversation Screen
 *
 * iMessage-style chat bubbles with real-time via Supabase Realtime.
 * Supports text messages and inline activity share cards.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { BrandColors, ThemeColors, Spacing, BorderRadius } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { ChatActivityCard } from '@/components/chat-activity-card';
import {
  getMessages,
  sendMessage,
  markConversationRead,
  subscribeToMessages,
  updateInviteStatus,
  type ChatMessage,
  type ActivityShareMetadata,
} from '@/services/chat-service';
import { supabase } from '@/lib/supabase';

export default function ConversationScreen() {
  const router = useRouter();
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const themeColors = ThemeColors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<{ name: string; avatar: string | null } | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Load messages + other user info
  const loadMessages = useCallback(async () => {
    if (!conversationId || !user?.id) return;
    try {
      const msgs = await getMessages(conversationId);
      setMessages(msgs);

      // Get other participant name
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id);

      if (participants && participants.length > 0) {
        const { data: userData } = await supabase
          .from('users')
          .select('name, profile_picture_url')
          .eq('id', participants[0].user_id)
          .maybeSingle();

        if (userData) {
          setOtherUser({ name: userData.name, avatar: userData.profile_picture_url });
        }
      }

      // Mark as read
      await markConversationRead(conversationId, user.id);
    } catch {
      // Silent fallback
    } finally {
      setLoading(false);
    }
  }, [conversationId, user?.id]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Real-time subscription
  useEffect(() => {
    if (!conversationId || !user?.id) return;

    const unsubscribe = subscribeToMessages(conversationId, (newMsg) => {
      setMessages((prev) => [newMsg, ...prev]);
      // Mark as read if we're viewing
      markConversationRead(conversationId, user.id);
    });

    return unsubscribe;
  }, [conversationId, user?.id]);

  // Send text message
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !conversationId || !user?.id) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const msg = await sendMessage(conversationId, user.id, text);
    if (msg) {
      setMessages((prev) => [msg, ...prev]);
    }
    setSending(false);
  }, [inputText, conversationId, user?.id]);

  // Accept invite
  const handleAcceptInvite = useCallback(async (messageId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const success = await updateInviteStatus(messageId, 'accepted');
    if (success) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, metadata: { ...m.metadata, inviteStatus: 'accepted' as const } }
            : m
        )
      );
    }
  }, []);

  // Decline invite
  const handleDeclineInvite = useCallback(async (messageId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const success = await updateInviteStatus(messageId, 'declined');
    if (success) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, metadata: { ...m.metadata, inviteStatus: 'declined' as const } }
            : m
        )
      );
    }
  }, []);

  // Time grouping helper
  const shouldShowTimestamp = (msg: ChatMessage, prevMsg?: ChatMessage): boolean => {
    if (!prevMsg) return true;
    const diff = new Date(prevMsg.created_at).getTime() - new Date(msg.created_at).getTime();
    return diff > 15 * 60 * 1000; // 15 minutes
  };

  const formatMessageTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDay = Math.floor((now.getTime() - date.getTime()) / 86400000);

    const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (diffDay === 0) return time;
    if (diffDay === 1) return `Yesterday ${time}`;
    return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`;
  };

  // Render a single message
  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isMine = item.sender_id === user?.id;
    const prevMsg = messages[index + 1]; // inverted list, so +1 is older
    const showTime = shouldShowTimestamp(item, prevMsg);

    // System message
    if (item.message_type === 'system') {
      return (
        <View style={styles.systemMsgContainer}>
          {showTime && (
            <Text style={[styles.timestamp, { color: themeColors.textSecondary }]}>
              {formatMessageTime(item.created_at)}
            </Text>
          )}
          <Text style={[styles.systemText, { color: themeColors.textSecondary }]}>
            {item.content}
          </Text>
        </View>
      );
    }

    // Activity share / invite
    if (item.message_type === 'activity_share' || item.message_type === 'invite') {
      return (
        <View style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}>
          {showTime && (
            <Text style={[styles.timestamp, { color: themeColors.textSecondary }, isMine ? styles.timestampRight : styles.timestampLeft]}>
              {formatMessageTime(item.created_at)}
            </Text>
          )}
          <ChatActivityCard
            metadata={item.metadata as ActivityShareMetadata}
            isSentByMe={isMine}
            onAcceptInvite={() => handleAcceptInvite(item.id)}
            onDeclineInvite={() => handleDeclineInvite(item.id)}
            onAddToLoop={() => handleAcceptInvite(item.id)}
          />
        </View>
      );
    }

    // Text message — chat bubble
    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}>
        {showTime && (
          <Text style={[styles.timestamp, { color: themeColors.textSecondary }, isMine ? styles.timestampRight : styles.timestampLeft]}>
            {formatMessageTime(item.created_at)}
          </Text>
        )}
        <View
          style={[
            styles.bubble,
            isMine
              ? [styles.bubbleMine, { backgroundColor: BrandColors.loopBlue }]
              : [styles.bubbleTheirs, { backgroundColor: colors.card, borderColor: colors.border }],
          ]}
        >
          <Text style={[styles.bubbleText, { color: isMine ? '#FFF' : colors.text }]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.xs, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          {otherUser?.avatar ? (
            <Image source={{ uri: otherUser.avatar }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatarFallback, { backgroundColor: BrandColors.loopBlue + '20' }]}>
              <Text style={styles.headerAvatarInitial}>
                {otherUser?.name?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
          <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
            {otherUser?.name ?? 'Chat'}
          </Text>
        </View>

        <View style={styles.headerRight} />
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={BrandColors.loopBlue} size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom || Spacing.sm }]}>
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.background, color: colors.text }]}
          placeholder="Message..."
          placeholderTextColor={themeColors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          style={[
            styles.sendButton,
            { backgroundColor: inputText.trim() ? BrandColors.loopBlue : themeColors.textSecondary + '40' },
          ]}
        >
          <Ionicons name="send" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: Spacing.sm,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: BrandColors.loopBlue,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  headerRight: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  msgRow: {
    marginVertical: 2,
    maxWidth: '80%',
  },
  msgRowLeft: {
    alignSelf: 'flex-start',
  },
  msgRowRight: {
    alignSelf: 'flex-end',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    maxWidth: '100%',
  },
  bubbleMine: {
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 21,
  },
  timestamp: {
    fontSize: 11,
    textAlign: 'center',
    marginVertical: 8,
  },
  timestampLeft: {
    textAlign: 'left',
  },
  timestampRight: {
    textAlign: 'right',
  },
  systemMsgContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
