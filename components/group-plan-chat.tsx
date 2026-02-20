/**
 * Group Plan Chat
 *
 * Lightweight in-plan chat section that shows recent messages and
 * provides an input field for sending new messages.
 *
 * - Shows the last 5 messages from the group plan conversation
 * - Displays sender initials + text + relative timestamp
 * - Uses chat-service.ts for fetching/sending
 * - Subscribes to real-time updates
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BrandColors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/brand';
import {
  getOrCreateGroupConversation,
  getMessages,
  sendMessage,
  subscribeToMessages,
  type ChatMessage,
} from '@/services/chat-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GroupPlanChatProps {
  planId: string;
  planTitle: string;
  creatorId: string;
  participantUserIds: string[];
  currentUserId: string;
  /** Optional map of userId -> display name for showing sender names */
  participantNames?: Record<string, string>;
  /** Max messages to show at a time (default: 5) */
  maxMessages?: number;
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Get 1-2 letter initials from a name string. */
export function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Format a timestamp into a human-readable relative string. */
export function formatMessageTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/** Truncate message text for display. */
export function truncateMessage(text: string, maxLen = 200): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '...';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GroupPlanChat({
  planId,
  planTitle,
  creatorId,
  participantUserIds,
  currentUserId,
  participantNames = {},
  maxMessages = 5,
}: GroupPlanChatProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const unsubRef = useRef<(() => void) | null>(null);

  // -----------------------------------------------------------------------
  // Load conversation + messages
  // -----------------------------------------------------------------------
  const loadChat = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const conv = await getOrCreateGroupConversation(
        planId,
        creatorId,
        participantUserIds,
        planTitle
      );

      if (!conv) {
        // Chat tables not available or demo user
        setLoading(false);
        return;
      }

      setConversationId(conv.id);

      const msgs = await getMessages(conv.id, maxMessages);
      // Messages come newest-first; reverse for chronological display
      setMessages(msgs.reverse());

      // Subscribe to real-time
      if (unsubRef.current) unsubRef.current();
      unsubRef.current = subscribeToMessages(conv.id, (newMsg) => {
        setMessages((prev) => {
          // Dedupe -- the message may already exist from optimistic insert
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          const updated = [...prev, newMsg];
          // Keep only the latest maxMessages
          return updated.slice(-maxMessages);
        });
      });
    } catch (err) {
      console.error('[GroupPlanChat] loadChat error:', err);
      setError('Could not load chat');
    } finally {
      setLoading(false);
    }
  }, [planId, creatorId, participantUserIds, planTitle, maxMessages]);

  useEffect(() => {
    loadChat();
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [loadChat]);

  // -----------------------------------------------------------------------
  // Send message
  // -----------------------------------------------------------------------
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !conversationId || sending) return;

    setSending(true);
    setInputText('');

    // Optimistic insert
    const optimisticMsg: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: currentUserId,
      message_type: 'text',
      content: text,
      metadata: {},
      status: 'sent',
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
    };
    setMessages((prev) => [...prev, optimisticMsg].slice(-maxMessages));

    try {
      const sent = await sendMessage(conversationId, currentUserId, text);
      if (sent) {
        // Replace optimistic message with real one
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticMsg.id ? sent : m))
        );
      }
    } catch (err) {
      console.error('[GroupPlanChat] sendMessage error:', err);
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // -----------------------------------------------------------------------
  // Resolve sender display name
  // -----------------------------------------------------------------------
  const getSenderName = (senderId: string): string => {
    if (senderId === currentUserId) return 'You';
    return participantNames[senderId] || 'Friend';
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={BrandColors.loopBlue} />
        <Text style={[Typography.bodySmall, { color: colors.icon, marginLeft: Spacing.sm }]}>
          Loading chat...
        </Text>
      </View>
    );
  }

  // If chat tables are not available, don't render
  if (!conversationId && !error) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1a1b1d' : '#f8f9fa' }]}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="chatbubbles-outline" size={18} color={BrandColors.loopBlue} />
        <Text style={[Typography.labelMedium, { color: colors.text, marginLeft: Spacing.xs }]}>
          Group Chat
        </Text>
        <Text style={[Typography.bodySmall, { color: colors.icon, marginLeft: Spacing.xs }]}>
          ({messages.length} message{messages.length !== 1 ? 's' : ''})
        </Text>
      </View>

      {/* Messages */}
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[Typography.bodySmall, { color: colors.icon, textAlign: 'center' }]}>
            No messages yet. Start the conversation!
          </Text>
        </View>
      ) : (
        <View style={styles.messagesList}>
          {messages.map((msg) => {
            const isCurrentUser = msg.sender_id === currentUserId;
            const senderName = getSenderName(msg.sender_id);
            const initials = getInitials(senderName === 'You' ? undefined : senderName);

            return (
              <View
                key={msg.id}
                style={[
                  styles.messageRow,
                  isCurrentUser && styles.messageRowSelf,
                ]}
              >
                {!isCurrentUser && (
                  <View style={[styles.avatar, { backgroundColor: BrandColors.loopBlue }]}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.messageBubble,
                    isCurrentUser
                      ? { backgroundColor: BrandColors.loopBlue }
                      : { backgroundColor: isDark ? '#2f3133' : '#e8e9eb' },
                  ]}
                >
                  {!isCurrentUser && (
                    <Text
                      style={[
                        Typography.labelSmall,
                        {
                          color: isDark ? BrandColors.loopBlueLight : BrandColors.loopBlueDark,
                          marginBottom: 2,
                        },
                      ]}
                    >
                      {senderName}
                    </Text>
                  )}
                  <Text
                    style={[
                      Typography.bodySmall,
                      {
                        color: isCurrentUser ? '#ffffff' : colors.text,
                      },
                    ]}
                  >
                    {truncateMessage(msg.content || '')}
                  </Text>
                  <Text
                    style={[
                      styles.timestamp,
                      {
                        color: isCurrentUser ? 'rgba(255,255,255,0.6)' : colors.icon,
                      },
                    ]}
                  >
                    {formatMessageTime(msg.created_at)}
                  </Text>
                </View>
                {isCurrentUser && (
                  <View style={[styles.avatar, { backgroundColor: BrandColors.loopGreen }]}>
                    <Text style={styles.avatarText}>You</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Error */}
      {error && (
        <Text style={[Typography.bodySmall, { color: BrandColors.error, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.xs }]}>
          {error}
        </Text>
      )}

      {/* Input */}
      {conversationId && (
        <View style={[styles.inputRow, { borderTopColor: isDark ? '#2f3133' : '#e0e0e0' }]}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark ? '#2f3133' : '#ffffff',
                borderColor: isDark ? '#3a3a3c' : '#e0e0e0',
                color: colors.text,
              },
            ]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message the group..."
            placeholderTextColor={colors.icon}
            maxLength={500}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            editable={!sending}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor: inputText.trim()
                  ? BrandColors.loopBlue
                  : isDark
                  ? '#2f3133'
                  : '#e0e0e0',
              },
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color={inputText.trim() ? '#ffffff' : colors.icon}
              />
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  emptyState: {
    padding: Spacing.md,
  },
  messagesList: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.xs,
  },
  messageRowSelf: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  messageBubble: {
    maxWidth: '70%',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'right',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    marginRight: Spacing.xs,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
