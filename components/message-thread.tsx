/**
 * Message Thread Component
 *
 * Full-screen chat view for a single conversation.
 * Features:
 * - Inverted FlatList for message display
 * - Bubble-style messages (sent = right/blue, received = left/gray)
 * - Activity share cards inline
 * - System messages centered
 * - Date group headers
 * - Text input with send button
 * - Keyboard-aware layout
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { BrandColors, ThemeColors, Spacing, BorderRadius } from '@/constants/brand';
import {
  getMessages,
  sendMessage,
  markConversationRead,
  subscribeToMessages,
  type ChatMessage,
  type Conversation,
  type ActivityShareMetadata,
} from '@/services/chat-service';
import { ChatActivityCard } from '@/components/chat-activity-card';

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Group messages by date, returning section headers to insert into the list.
 * Since the FlatList is inverted, dates should be inserted after the group.
 */
export interface MessageListItem {
  type: 'message' | 'date_header';
  id: string;
  message?: ChatMessage;
  dateLabel?: string;
}

/**
 * Format a date object into a human-readable day label.
 */
export function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'long' });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Format a message timestamp into a short time string (e.g., "2:30 PM").
 */
export function formatMessageTime(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Build a list of message items with date headers inserted between day boundaries.
 * Messages should already be sorted newest-first (descending created_at).
 * Since the FlatList is inverted, visual order is bottom-to-top, so we insert
 * date headers AFTER each group (which renders above them visually).
 */
export function buildMessageList(messages: ChatMessage[]): MessageListItem[] {
  if (messages.length === 0) return [];

  const items: MessageListItem[] = [];
  let currentDateKey = '';

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgDate = new Date(msg.created_at);
    const dateKey = `${msgDate.getFullYear()}-${msgDate.getMonth()}-${msgDate.getDate()}`;

    items.push({
      type: 'message',
      id: msg.id,
      message: msg,
    });

    // If the next message is in a different day group (or this is the last message),
    // insert a date header after the current message.
    // In inverted FlatList, "after" in data = "above" on screen.
    const nextMsg = messages[i + 1];
    const nextDateKey = nextMsg
      ? (() => {
          const d = new Date(nextMsg.created_at);
          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        })()
      : null;

    if (dateKey !== currentDateKey) {
      currentDateKey = dateKey;
    }

    if (!nextMsg || dateKey !== nextDateKey) {
      items.push({
        type: 'date_header',
        id: `date-${dateKey}`,
        dateLabel: formatDateLabel(msgDate),
      });
    }
  }

  return items;
}

/**
 * Determine if a message is from the current user.
 */
export function isSentByUser(message: ChatMessage, currentUserId: string): boolean {
  return message.sender_id === currentUserId;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MessageThreadProps {
  conversation: Conversation;
  currentUserId: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageThread({ conversation, currentUserId, onClose }: MessageThreadProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const themeColors = ThemeColors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  const loadMessages = useCallback(async () => {
    try {
      const msgs = await getMessages(conversation.id);
      setMessages(msgs);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, [conversation.id]);

  useEffect(() => {
    loadMessages().finally(() => setLoading(false));
  }, [loadMessages]);

  // Mark as read on mount
  useEffect(() => {
    markConversationRead(conversation.id, currentUserId);
  }, [conversation.id, currentUserId]);

  // Real-time subscription
  useEffect(() => {
    const unsubscribe = subscribeToMessages(conversation.id, (newMessage) => {
      setMessages((prev) => {
        // Don't add duplicate messages
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return [newMessage, ...prev];
      });
      // Mark as read if we receive a message from someone else
      if (newMessage.sender_id !== currentUserId) {
        markConversationRead(conversation.id, currentUserId);
      }
    });

    return unsubscribe;
  }, [conversation.id, currentUserId]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setInputText('');

    try {
      const msg = await sendMessage(conversation.id, currentUserId, text);
      if (msg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [msg, ...prev];
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Restore text on failure
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const listItems = buildMessageList(messages);

  const renderItem = ({ item }: { item: MessageListItem }) => {
    if (item.type === 'date_header') {
      return (
        <View style={styles.dateHeaderContainer}>
          <Text style={[styles.dateHeaderText, { color: themeColors.textSecondary }]}>
            {item.dateLabel}
          </Text>
        </View>
      );
    }

    const msg = item.message!;
    const isMine = isSentByUser(msg, currentUserId);

    // System messages
    if (msg.message_type === 'system') {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={[styles.systemMessageText, { color: themeColors.textSecondary }]}>
            {msg.content}
          </Text>
        </View>
      );
    }

    // Activity share messages
    if (msg.message_type === 'activity_share' || msg.message_type === 'invite') {
      return (
        <View style={[styles.bubbleRow, isMine ? styles.bubbleRowSent : styles.bubbleRowReceived]}>
          <View style={styles.activityShareContainer}>
            <ChatActivityCard
              metadata={msg.metadata as ActivityShareMetadata}
              isSentByMe={isMine}
            />
            <Text style={[styles.messageTimestamp, { color: themeColors.textSecondary }, isMine && styles.timestampRight]}>
              {formatMessageTime(msg.created_at)}
            </Text>
          </View>
        </View>
      );
    }

    // Text messages
    return (
      <View style={[styles.bubbleRow, isMine ? styles.bubbleRowSent : styles.bubbleRowReceived]}>
        <View
          style={[
            styles.bubble,
            isMine
              ? [styles.bubbleSent, { backgroundColor: BrandColors.loopBlue }]
              : [styles.bubbleReceived, { backgroundColor: isDark ? themeColors.cardElevated : colors.card, borderColor: colors.border }],
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              { color: isMine ? '#FFFFFF' : colors.text },
            ]}
          >
            {msg.content}
          </Text>
        </View>
        <Text style={[styles.messageTimestamp, { color: themeColors.textSecondary }, isMine && styles.timestampRight]}>
          {formatMessageTime(msg.created_at)}
        </Text>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyThread}>
        <Text style={[styles.emptyThreadText, { color: themeColors.textSecondary }]}>
          No messages yet. Say hello!
        </Text>
      </View>
    );
  };

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  const friendName = conversation.other_user_name || 'Unknown';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.threadHeader, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.xs, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.threadHeaderInfo}>
          {conversation.other_user_avatar ? (
            <Image source={{ uri: conversation.other_user_avatar }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatarFallback, { backgroundColor: BrandColors.loopBlue + '20' }]}>
              <Text style={[styles.headerAvatarInitials, { color: BrandColors.loopBlue }]}>
                {friendName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={[styles.threadHeaderName, { color: colors.text }]} numberOfLines={1}>
            {friendName}
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={listItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        inverted
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={[
          styles.messageList,
          listItems.length === 0 && styles.emptyMessageList,
        ]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />

      {/* Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: isDark ? themeColors.cardElevated : '#F0F0F0',
              color: colors.text,
            },
          ]}
          placeholder="Message..."
          placeholderTextColor={themeColors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={2000}
          returnKeyType="default"
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          style={[
            styles.sendButton,
            {
              backgroundColor: inputText.trim() ? BrandColors.loopBlue : (isDark ? themeColors.cardElevated : '#E0E0E0'),
            },
          ]}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Ionicons
            name="arrow-up"
            size={20}
            color={inputText.trim() ? '#FFFFFF' : themeColors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Thread header
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  threadHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
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
  headerAvatarInitials: {
    fontSize: 14,
    fontWeight: '600',
  },
  threadHeaderName: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  headerSpacer: {
    width: 36,
  },

  // Message list
  messageList: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  emptyMessageList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Date headers
  dateHeaderContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  dateHeaderText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // System messages
  systemMessageContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  systemMessageText: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Message bubbles
  bubbleRow: {
    marginVertical: 2,
    maxWidth: '80%',
  },
  bubbleRowSent: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleRowReceived: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: Spacing.md - 2,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg + 2,
  },
  bubbleSent: {
    borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTimestamp: {
    fontSize: 11,
    marginTop: 2,
    marginHorizontal: 4,
  },
  timestampRight: {
    textAlign: 'right',
  },

  // Activity share
  activityShareContainer: {
    maxWidth: 280,
  },

  // Empty thread
  emptyThread: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyThreadText: {
    fontSize: 15,
    fontStyle: 'italic',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 36,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 1 : 0,
  },
});
