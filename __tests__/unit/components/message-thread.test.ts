/**
 * Tests for MessageThread component and Messages screen logic
 *
 * Pure helper functions are mirrored here to avoid importing React Native
 * components (same pattern as calendar-day-cell.test.ts, recommendations.test.ts).
 *
 * Tests cover:
 * - Message formatting (time, date labels)
 * - Message list building with date headers
 * - Sent vs received detection
 * - Conversation time formatting
 * - Message preview extraction
 * - Initials generation
 * - Empty state handling
 * - Activity share display logic
 * - Unread badge logic
 */

// ---------------------------------------------------------------------------
// Mirrored types (from chat-service.ts, avoids RN import chain)
// ---------------------------------------------------------------------------

type MessageType = 'text' | 'activity_share' | 'invite' | 'system';
type InviteStatus = 'pending' | 'accepted' | 'declined';

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: MessageType;
  content: string | null;
  metadata: Record<string, any>;
  status: 'sent' | 'delivered' | 'read';
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  sender_name?: string;
  sender_avatar?: string;
}

interface Conversation {
  id: string;
  type: 'direct' | 'group';
  title: string | null;
  created_at: string;
  updated_at: string;
  other_user_id?: string;
  other_user_name?: string;
  other_user_avatar?: string;
  last_message?: ChatMessage | null;
  unread_count?: number;
}

// ---------------------------------------------------------------------------
// Mirrored pure functions from message-thread.tsx
// ---------------------------------------------------------------------------

interface MessageListItem {
  type: 'message' | 'date_header';
  id: string;
  message?: ChatMessage;
  dateLabel?: string;
}

function formatDateLabel(date: Date): string {
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

function formatMessageTime(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function buildMessageList(messages: ChatMessage[]): MessageListItem[] {
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

function isSentByUser(message: ChatMessage, currentUserId: string): boolean {
  return message.sender_id === currentUserId;
}

// ---------------------------------------------------------------------------
// Mirrored pure functions from messages.tsx (Messages screen)
// ---------------------------------------------------------------------------

function formatConversationTime(isoString: string | null | undefined): string {
  if (!isoString) return '';

  const date = new Date(isoString);
  const now = new Date();

  if (isNaN(date.getTime())) return '';

  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

function getMessagePreview(conversation: Conversation): string {
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

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-' + Math.random().toString(36).slice(2, 8),
    conversation_id: 'conv-1',
    sender_id: 'user-1',
    message_type: 'text',
    content: 'Hello there',
    metadata: {},
    status: 'sent',
    created_at: '2026-02-20T14:30:00.000Z',
    edited_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    type: 'direct',
    title: null,
    created_at: '2026-02-18T10:00:00.000Z',
    updated_at: '2026-02-20T14:30:00.000Z',
    other_user_id: 'user-2',
    other_user_name: 'Alice Smith',
    other_user_avatar: undefined,
    last_message: null,
    unread_count: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: formatDateLabel
// ---------------------------------------------------------------------------

describe('formatDateLabel', () => {
  it('should return "Today" for today\'s date', () => {
    const now = new Date();
    expect(formatDateLabel(now)).toBe('Today');
  });

  it('should return "Yesterday" for yesterday\'s date', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatDateLabel(yesterday)).toBe('Yesterday');
  });

  it('should return day name for dates within the last 7 days', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const result = formatDateLabel(threeDaysAgo);
    const validDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    expect(validDays).toContain(result);
  });

  it('should return month and day for older dates in same year', () => {
    const date = new Date();
    date.setMonth(0, 5); // January 5
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 7 && date.getFullYear() === now.getFullYear()) {
      const result = formatDateLabel(date);
      expect(result).toMatch(/January 5/);
    }
  });

  it('should include year for dates in a different year', () => {
    const date = new Date(2024, 5, 15); // June 15, 2024
    const result = formatDateLabel(date);
    expect(result).toMatch(/June 15/);
    expect(result).toMatch(/2024/);
  });
});

// ---------------------------------------------------------------------------
// Tests: formatMessageTime
// ---------------------------------------------------------------------------

describe('formatMessageTime', () => {
  it('should return a formatted time string', () => {
    const result = formatMessageTime('2026-02-20T14:30:00.000Z');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should return empty string for invalid date', () => {
    expect(formatMessageTime('not-a-date')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tests: buildMessageList
// ---------------------------------------------------------------------------

describe('buildMessageList', () => {
  it('should return empty array for no messages', () => {
    expect(buildMessageList([])).toEqual([]);
  });

  it('should wrap single message with a date header', () => {
    const msg = makeMessage({ id: 'msg-1', created_at: '2026-02-20T14:30:00.000Z' });
    const items = buildMessageList([msg]);

    expect(items).toHaveLength(2);
    expect(items[0].type).toBe('message');
    expect(items[0].id).toBe('msg-1');
    expect(items[1].type).toBe('date_header');
  });

  it('should group messages from same day under one date header', () => {
    const msg1 = makeMessage({ id: 'msg-1', created_at: '2026-02-20T16:00:00.000Z' });
    const msg2 = makeMessage({ id: 'msg-2', created_at: '2026-02-20T14:00:00.000Z' });
    const items = buildMessageList([msg1, msg2]);

    const dateHeaders = items.filter((i) => i.type === 'date_header');
    const messages = items.filter((i) => i.type === 'message');

    expect(dateHeaders).toHaveLength(1);
    expect(messages).toHaveLength(2);
  });

  it('should create separate date headers for different days', () => {
    const msg1 = makeMessage({ id: 'msg-1', created_at: '2026-02-20T16:00:00.000Z' });
    const msg2 = makeMessage({ id: 'msg-2', created_at: '2026-02-19T10:00:00.000Z' });
    const items = buildMessageList([msg1, msg2]);

    const dateHeaders = items.filter((i) => i.type === 'date_header');
    expect(dateHeaders).toHaveLength(2);
  });

  it('should have unique IDs for all items', () => {
    const msg1 = makeMessage({ id: 'msg-1', created_at: '2026-02-20T16:00:00.000Z' });
    const msg2 = makeMessage({ id: 'msg-2', created_at: '2026-02-19T10:00:00.000Z' });
    const items = buildMessageList([msg1, msg2]);

    const ids = items.map((i) => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should preserve message objects in items', () => {
    const msg = makeMessage({ id: 'msg-1', content: 'test content' });
    const items = buildMessageList([msg]);

    const messageItem = items.find((i) => i.type === 'message');
    expect(messageItem?.message?.content).toBe('test content');
    expect(messageItem?.message?.id).toBe('msg-1');
  });

  it('should handle three days of messages correctly', () => {
    const msgs = [
      makeMessage({ id: 'msg-1', created_at: '2026-02-20T16:00:00.000Z' }),
      makeMessage({ id: 'msg-2', created_at: '2026-02-20T14:00:00.000Z' }),
      makeMessage({ id: 'msg-3', created_at: '2026-02-19T12:00:00.000Z' }),
      makeMessage({ id: 'msg-4', created_at: '2026-02-18T08:00:00.000Z' }),
    ];
    const items = buildMessageList(msgs);

    const dateHeaders = items.filter((i) => i.type === 'date_header');
    const messages = items.filter((i) => i.type === 'message');

    expect(dateHeaders).toHaveLength(3); // 3 different days
    expect(messages).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Tests: isSentByUser
// ---------------------------------------------------------------------------

describe('isSentByUser', () => {
  it('should return true when sender matches current user', () => {
    const msg = makeMessage({ sender_id: 'user-1' });
    expect(isSentByUser(msg, 'user-1')).toBe(true);
  });

  it('should return false when sender does not match', () => {
    const msg = makeMessage({ sender_id: 'user-2' });
    expect(isSentByUser(msg, 'user-1')).toBe(false);
  });

  it('should handle empty strings', () => {
    const msg = makeMessage({ sender_id: '' });
    expect(isSentByUser(msg, '')).toBe(true);
    expect(isSentByUser(msg, 'someone')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: formatConversationTime
// ---------------------------------------------------------------------------

describe('formatConversationTime', () => {
  it('should return empty string for null input', () => {
    expect(formatConversationTime(null)).toBe('');
  });

  it('should return empty string for undefined input', () => {
    expect(formatConversationTime(undefined)).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(formatConversationTime('')).toBe('');
  });

  it('should return "Now" for very recent timestamps', () => {
    const now = new Date().toISOString();
    expect(formatConversationTime(now)).toBe('Now');
  });

  it('should return minutes for timestamps within the last hour', () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const result = formatConversationTime(thirtyMinsAgo);
    expect(result).toMatch(/^\d+m$/);
  });

  it('should return hours for timestamps within the last day', () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    const result = formatConversationTime(fiveHoursAgo);
    expect(result).toMatch(/^\d+h$/);
  });

  it('should return days for timestamps within the last week', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatConversationTime(threeDaysAgo);
    expect(result).toBe('3d');
  });

  it('should return formatted date for older timestamps', () => {
    const oldDate = new Date(2026, 0, 5).toISOString(); // Jan 5, 2026
    const result = formatConversationTime(oldDate);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('should return empty string for invalid date string', () => {
    expect(formatConversationTime('invalid-date')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tests: getMessagePreview
// ---------------------------------------------------------------------------

describe('getMessagePreview', () => {
  it('should return "No messages yet" when no last message', () => {
    const conv = makeConversation({ last_message: null });
    expect(getMessagePreview(conv)).toBe('No messages yet');
  });

  it('should return "No messages yet" when last_message is undefined', () => {
    const conv = makeConversation({ last_message: undefined });
    expect(getMessagePreview(conv)).toBe('No messages yet');
  });

  it('should return message content for text messages', () => {
    const conv = makeConversation({
      last_message: makeMessage({ message_type: 'text', content: 'Hey, how are you?' }),
    });
    expect(getMessagePreview(conv)).toBe('Hey, how are you?');
  });

  it('should return activity title for activity_share messages', () => {
    const conv = makeConversation({
      last_message: makeMessage({
        message_type: 'activity_share',
        content: 'Shared Coffee Lab',
        metadata: { title: 'Coffee Lab', placeId: 'p1', category: 'coffee', imageUrl: '', rating: 4.5, priceRange: 2, distance: '1.2 mi' },
      }),
    });
    expect(getMessagePreview(conv)).toBe('Shared Coffee Lab');
  });

  it('should handle activity_share with missing title in metadata', () => {
    const conv = makeConversation({
      last_message: makeMessage({
        message_type: 'activity_share',
        content: 'Shared something',
        metadata: {},
      }),
    });
    expect(getMessagePreview(conv)).toBe('Shared an activity');
  });

  it('should return "Sent an invite" for invite messages', () => {
    const conv = makeConversation({
      last_message: makeMessage({ message_type: 'invite', content: 'Join me!' }),
    });
    expect(getMessagePreview(conv)).toBe('Sent an invite');
  });

  it('should return content for system messages', () => {
    const conv = makeConversation({
      last_message: makeMessage({ message_type: 'system', content: 'Alice joined the chat' }),
    });
    expect(getMessagePreview(conv)).toBe('Alice joined the chat');
  });

  it('should return "System message" for system messages with no content', () => {
    const conv = makeConversation({
      last_message: makeMessage({ message_type: 'system', content: null }),
    });
    expect(getMessagePreview(conv)).toBe('System message');
  });

  it('should return empty string for text messages with null content', () => {
    const conv = makeConversation({
      last_message: makeMessage({ message_type: 'text', content: null }),
    });
    expect(getMessagePreview(conv)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tests: getInitials
// ---------------------------------------------------------------------------

describe('getInitials', () => {
  it('should return first and last initials for full name', () => {
    expect(getInitials('Alice Smith')).toBe('AS');
  });

  it('should return single initial for single name', () => {
    expect(getInitials('Alice')).toBe('A');
  });

  it('should handle three-word names', () => {
    expect(getInitials('John Paul Jones')).toBe('JJ');
  });

  it('should return uppercase initials', () => {
    expect(getInitials('alice smith')).toBe('AS');
  });

  it('should return "?" for null input', () => {
    expect(getInitials(null)).toBe('?');
  });

  it('should return "?" for undefined input', () => {
    expect(getInitials(undefined)).toBe('?');
  });

  it('should handle extra whitespace', () => {
    expect(getInitials('  Alice   Smith  ')).toBe('AS');
  });

  it('should return "?" for empty string', () => {
    expect(getInitials('')).toBe('?');
  });
});

// ---------------------------------------------------------------------------
// Tests: Activity share display logic
// ---------------------------------------------------------------------------

describe('activity share display logic', () => {
  it('should identify activity share messages correctly', () => {
    const msg = makeMessage({ message_type: 'activity_share' });
    expect(msg.message_type).toBe('activity_share');
  });

  it('should identify invite messages correctly', () => {
    const msg = makeMessage({ message_type: 'invite' });
    expect(msg.message_type).toBe('invite');
  });

  it('should identify system messages correctly', () => {
    const msg = makeMessage({ message_type: 'system' });
    expect(msg.message_type).toBe('system');
  });

  it('should identify text messages correctly', () => {
    const msg = makeMessage({ message_type: 'text' });
    expect(msg.message_type).toBe('text');
  });

  it('should have metadata on activity share messages', () => {
    const metadata = {
      placeId: 'place-1',
      title: 'Cool Coffee Shop',
      category: 'coffee',
      imageUrl: 'https://example.com/img.jpg',
      rating: 4.7,
      priceRange: 2,
      distance: '0.5 mi',
      inviteStatus: 'pending' as const,
    };
    const msg = makeMessage({ message_type: 'activity_share', metadata });
    expect((msg.metadata as any).title).toBe('Cool Coffee Shop');
    expect((msg.metadata as any).inviteStatus).toBe('pending');
  });

  it('should detect resolved invite status', () => {
    const accepted = { inviteStatus: 'accepted' };
    const declined = { inviteStatus: 'declined' };
    const pending = { inviteStatus: 'pending' };

    expect(accepted.inviteStatus === 'accepted' || accepted.inviteStatus === 'declined').toBe(true);
    expect(declined.inviteStatus === 'accepted' || declined.inviteStatus === 'declined').toBe(true);
    expect(pending.inviteStatus === 'accepted' || pending.inviteStatus === 'declined').toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: Edge cases and message ordering
// ---------------------------------------------------------------------------

describe('message list edge cases', () => {
  it('should handle all messages from the same timestamp', () => {
    const timestamp = '2026-02-20T14:00:00.000Z';
    const msgs = [
      makeMessage({ id: 'msg-1', created_at: timestamp }),
      makeMessage({ id: 'msg-2', created_at: timestamp }),
      makeMessage({ id: 'msg-3', created_at: timestamp }),
    ];
    const items = buildMessageList(msgs);

    const dateHeaders = items.filter((i) => i.type === 'date_header');
    expect(dateHeaders).toHaveLength(1); // Same day = 1 header
  });

  it('should handle messages spanning midnight (local time)', () => {
    // Use local dates to avoid timezone issues:
    // today at 00:05 and yesterday at 23:55 in local time
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 5, 0, 0);
    const yesterdayLate = new Date();
    yesterdayLate.setDate(yesterdayLate.getDate() - 1);
    yesterdayLate.setHours(23, 55, 0, 0);

    const msgs = [
      makeMessage({ id: 'msg-1', created_at: todayMidnight.toISOString() }),
      makeMessage({ id: 'msg-2', created_at: yesterdayLate.toISOString() }),
    ];
    const items = buildMessageList(msgs);

    const dateHeaders = items.filter((i) => i.type === 'date_header');
    expect(dateHeaders).toHaveLength(2); // Different days
  });

  it('should correctly mark sent vs received in a mixed conversation', () => {
    const myId = 'user-me';
    const friendId = 'user-friend';

    const msgs = [
      makeMessage({ id: 'msg-1', sender_id: myId }),
      makeMessage({ id: 'msg-2', sender_id: friendId }),
      makeMessage({ id: 'msg-3', sender_id: myId }),
    ];

    expect(isSentByUser(msgs[0], myId)).toBe(true);
    expect(isSentByUser(msgs[1], myId)).toBe(false);
    expect(isSentByUser(msgs[2], myId)).toBe(true);
  });

  it('should handle a conversation with only system messages', () => {
    const msgs = [
      makeMessage({ id: 'msg-1', message_type: 'system', content: 'Chat started' }),
    ];
    const items = buildMessageList(msgs);

    expect(items).toHaveLength(2); // 1 message + 1 date header
    expect(items[0].message?.message_type).toBe('system');
  });

  it('should handle conversation with mixed message types', () => {
    const msgs = [
      makeMessage({ id: 'msg-1', message_type: 'text', content: 'Check this out!' }),
      makeMessage({ id: 'msg-2', message_type: 'activity_share', metadata: { title: 'Tacos', placeId: 'p1', category: 'dining', imageUrl: '', rating: 4, priceRange: 1, distance: '2 mi' } }),
      makeMessage({ id: 'msg-3', message_type: 'system', content: 'Alice joined' }),
    ];
    const items = buildMessageList(msgs);

    const messages = items.filter((i) => i.type === 'message');
    expect(messages).toHaveLength(3);
    expect(messages[0].message?.message_type).toBe('text');
    expect(messages[1].message?.message_type).toBe('activity_share');
    expect(messages[2].message?.message_type).toBe('system');
  });

  it('should handle very large message lists', () => {
    const msgs: ChatMessage[] = [];
    for (let i = 0; i < 100; i++) {
      const dayOffset = Math.floor(i / 10); // 10 messages per day, 10 days
      const date = new Date(2026, 1, 20 - dayOffset, 10 + (i % 10));
      msgs.push(makeMessage({ id: `msg-${i}`, created_at: date.toISOString() }));
    }
    const items = buildMessageList(msgs);

    const dateHeaders = items.filter((i) => i.type === 'date_header');
    const messages = items.filter((i) => i.type === 'message');

    expect(messages).toHaveLength(100);
    expect(dateHeaders).toHaveLength(10); // 10 different days
  });
});

// ---------------------------------------------------------------------------
// Tests: Unread/badge display logic
// ---------------------------------------------------------------------------

describe('unread and badge display logic', () => {
  it('should treat 0 unread as no badge', () => {
    const conv = makeConversation({ unread_count: 0 });
    expect((conv.unread_count ?? 0) > 0).toBe(false);
  });

  it('should show badge for unread count > 0', () => {
    const conv = makeConversation({ unread_count: 3 });
    expect((conv.unread_count ?? 0) > 0).toBe(true);
  });

  it('should cap display at 99+', () => {
    const conv = makeConversation({ unread_count: 150 });
    const display = (conv.unread_count ?? 0) > 99 ? '99+' : String(conv.unread_count);
    expect(display).toBe('99+');
  });

  it('should show exact count for <= 99', () => {
    const conv = makeConversation({ unread_count: 42 });
    const display = (conv.unread_count ?? 0) > 99 ? '99+' : String(conv.unread_count);
    expect(display).toBe('42');
  });

  it('should handle undefined unread count as 0', () => {
    const conv = makeConversation({ unread_count: undefined });
    expect((conv.unread_count ?? 0) > 0).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: Conversation list sorting
// ---------------------------------------------------------------------------

describe('conversation sorting logic', () => {
  it('should sort conversations by updated_at descending', () => {
    const convos = [
      makeConversation({ id: 'c1', updated_at: '2026-02-18T10:00:00.000Z' }),
      makeConversation({ id: 'c3', updated_at: '2026-02-20T10:00:00.000Z' }),
      makeConversation({ id: 'c2', updated_at: '2026-02-19T10:00:00.000Z' }),
    ];

    const sorted = [...convos].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    expect(sorted[0].id).toBe('c3');
    expect(sorted[1].id).toBe('c2');
    expect(sorted[2].id).toBe('c1');
  });
});

// ---------------------------------------------------------------------------
// Tests: getInitials edge cases
// ---------------------------------------------------------------------------

describe('getInitials edge cases', () => {
  it('should handle single character name', () => {
    expect(getInitials('A')).toBe('A');
  });

  it('should handle name with numbers', () => {
    // Should still extract first character
    expect(getInitials('3rd Floor Cafe')).toBe('3C');
  });

  it('should handle name with special characters', () => {
    expect(getInitials('@Alice')).toBe('@');
  });
});
