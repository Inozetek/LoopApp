/**
 * Tests for chat-service
 *
 * Tests the conversation/messaging system with Supabase mocks.
 */

// Mock chain fns
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockNeq = jest.fn();
const mockIn = jest.fn();
const mockGt = jest.fn();
const mockLt = jest.fn();
const mockIs = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();
const mockChannel = jest.fn();
const mockRemoveChannel = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    })),
    rpc: jest.fn(),
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}));

import {
  getOrCreateDirectConversation,
  getConversations,
  getMessages,
  sendMessage,
  sendActivityShare,
  markConversationRead,
  getUnreadCount,
  updateInviteStatus,
  subscribeToMessages,
  type ActivityShareMetadata,
  type ChatMessage,
  type Conversation,
} from '@/services/chat-service';

// Build a chainable mock that supports all methods used by the service
function buildChain(terminal: Record<string, any> = {}) {
  const chain: any = {};
  const methods = ['select', 'insert', 'update', 'eq', 'neq', 'in', 'gt', 'lt', 'is', 'order', 'limit'];
  for (const m of methods) {
    chain[m] = jest.fn(() => chain);
  }
  // Terminal resolvers
  chain.single = jest.fn(() => Promise.resolve(terminal));
  chain.maybeSingle = jest.fn(() => Promise.resolve(terminal));
  // Default: the chain itself resolves like a promise (for queries without .single())
  chain.then = (resolve: any) => resolve(terminal);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();

  // Default chains
  const defaultChain = buildChain({ data: null, error: null });
  mockSelect.mockReturnValue(defaultChain);
  mockInsert.mockReturnValue({ select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null, error: null })) })) });
  mockUpdate.mockReturnValue(defaultChain);
  mockEq.mockReturnValue(defaultChain);
});

describe('chat-service', () => {
  // -----------------------------------------------------------------------
  // getOrCreateDirectConversation
  // -----------------------------------------------------------------------
  describe('getOrCreateDirectConversation', () => {
    it('should return null for demo user', async () => {
      const result = await getOrCreateDirectConversation('demo-user-123', 'friend-1');
      expect(result).toBeNull();
    });

    it('should create new conversation when none exists', async () => {
      const { supabase } = require('@/lib/supabase');
      const callIndex = { current: 0 };

      // We need to control what .from() returns for each call
      supabase.from.mockImplementation((table: string) => {
        if (table === 'conversation_participants' && callIndex.current === 0) {
          callIndex.current++;
          // First call: get user's conversations → empty
          return buildChain({ data: [], error: null });
        }
        if (table === 'conversations') {
          // Create new conversation
          const chain = buildChain({ data: { id: 'conv-new', type: 'direct', created_at: '2024-01-01', updated_at: '2024-01-01' }, error: null });
          chain.insert = jest.fn(() => chain);
          chain.select = jest.fn(() => chain);
          return chain;
        }
        if (table === 'conversation_participants') {
          // Add participants
          return buildChain({ data: null, error: null });
        }
        return buildChain({ data: null, error: null });
      });

      const result = await getOrCreateDirectConversation('user-1', 'friend-1');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('conv-new');
    });

    it('should return existing conversation when found', async () => {
      const { supabase } = require('@/lib/supabase');
      const callIndex = { current: 0 };

      supabase.from.mockImplementation((table: string) => {
        if (table === 'conversation_participants' && callIndex.current === 0) {
          callIndex.current++;
          return buildChain({ data: [{ conversation_id: 'conv-existing' }], error: null });
        }
        if (table === 'conversation_participants' && callIndex.current === 1) {
          callIndex.current++;
          return buildChain({ data: [{ conversation_id: 'conv-existing' }], error: null });
        }
        if (table === 'conversations') {
          const chain = buildChain({
            data: { id: 'conv-existing', type: 'direct', created_at: '2024-01-01', updated_at: '2024-01-01' },
            error: null,
          });
          return chain;
        }
        return buildChain({ data: null, error: null });
      });

      const result = await getOrCreateDirectConversation('user-1', 'friend-1');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('conv-existing');
    });

    it('should handle table-not-found gracefully', async () => {
      const { supabase } = require('@/lib/supabase');
      supabase.from.mockImplementation(() => {
        return buildChain({ data: null, error: { code: '42P01', message: 'table not found' } });
      });

      const result = await getOrCreateDirectConversation('user-1', 'friend-1');
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // getConversations
  // -----------------------------------------------------------------------
  describe('getConversations', () => {
    it('should return empty array for demo user', async () => {
      const result = await getConversations('demo-user-123');
      expect(result).toEqual([]);
    });

    it('should return empty array when no participations exist', async () => {
      const { supabase } = require('@/lib/supabase');
      supabase.from.mockImplementation(() => buildChain({ data: [], error: null }));

      const result = await getConversations('user-1');
      expect(result).toEqual([]);
    });

    it('should handle table-not-found gracefully', async () => {
      const { supabase } = require('@/lib/supabase');
      supabase.from.mockImplementation(() =>
        buildChain({ data: null, error: { code: 'PGRST204', message: 'not found' } })
      );

      const result = await getConversations('user-1');
      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // getMessages
  // -----------------------------------------------------------------------
  describe('getMessages', () => {
    it('should return messages for a conversation', async () => {
      const { supabase } = require('@/lib/supabase');
      const mockMessages = [
        { id: 'msg-1', conversation_id: 'conv-1', sender_id: 'u1', message_type: 'text', content: 'Hello', metadata: {}, status: 'sent', created_at: '2024-01-01T10:00:00Z', edited_at: null, deleted_at: null },
        { id: 'msg-2', conversation_id: 'conv-1', sender_id: 'u2', message_type: 'text', content: 'Hi there', metadata: {}, status: 'sent', created_at: '2024-01-01T10:01:00Z', edited_at: null, deleted_at: null },
      ];

      supabase.from.mockImplementation(() => buildChain({ data: mockMessages, error: null }));

      const result = await getMessages('conv-1');
      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Hello');
    });

    it('should return empty array on error', async () => {
      const { supabase } = require('@/lib/supabase');
      supabase.from.mockImplementation(() =>
        buildChain({ data: null, error: { code: '42P01', message: 'not found' } })
      );

      const result = await getMessages('conv-1');
      expect(result).toEqual([]);
    });

    it('should support pagination with before cursor', async () => {
      const { supabase } = require('@/lib/supabase');
      const chain = buildChain({ data: [], error: null });
      supabase.from.mockImplementation(() => chain);

      await getMessages('conv-1', 20, '2024-01-01T10:00:00Z');
      // Verify lt was called for cursor pagination
      expect(chain.lt).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // sendMessage
  // -----------------------------------------------------------------------
  describe('sendMessage', () => {
    it('should insert a message and update conversation', async () => {
      const { supabase } = require('@/lib/supabase');
      const insertedMsg = {
        id: 'msg-new',
        conversation_id: 'conv-1',
        sender_id: 'user-1',
        message_type: 'text',
        content: 'Test message',
        metadata: {},
        status: 'sent',
        created_at: '2024-01-01',
      };

      const callIndex = { current: 0 };
      supabase.from.mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          const chain = buildChain({ data: insertedMsg, error: null });
          chain.insert = jest.fn(() => chain);
          chain.select = jest.fn(() => chain);
          return chain;
        }
        if (table === 'conversations') {
          return buildChain({ data: null, error: null });
        }
        return buildChain({ data: null, error: null });
      });

      const result = await sendMessage('conv-1', 'user-1', 'Test message');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('msg-new');
      expect(result?.content).toBe('Test message');
    });

    it('should return null on error', async () => {
      const { supabase } = require('@/lib/supabase');
      const chain = buildChain({ data: null, error: { message: 'insert failed' } });
      chain.insert = jest.fn(() => chain);
      chain.select = jest.fn(() => chain);
      supabase.from.mockImplementation(() => chain);

      const result = await sendMessage('conv-1', 'user-1', 'fail');
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // sendActivityShare
  // -----------------------------------------------------------------------
  describe('sendActivityShare', () => {
    const mockActivity: ActivityShareMetadata = {
      placeId: 'ChIJ_test',
      title: 'Café Bella',
      category: 'Coffee & Tea',
      imageUrl: 'https://example.com/photo.jpg',
      rating: 4.5,
      priceRange: 2,
      distance: '2.7 mi',
      aiExplanation: 'Perfect for your coffee craving',
      address: '123 Main St',
    };

    it('should return failure for demo user', async () => {
      const result = await sendActivityShare('demo-user-123', ['friend-1'], mockActivity);
      expect(result.success).toBe(false);
      expect(result.conversationIds).toEqual([]);
    });

    it('should create conversations and send messages for each recipient', async () => {
      const { supabase } = require('@/lib/supabase');
      const callIndex = { current: 0 };

      supabase.from.mockImplementation((table: string) => {
        if (table === 'conversation_participants' && callIndex.current < 2) {
          callIndex.current++;
          if (callIndex.current === 1) return buildChain({ data: [], error: null }); // no existing convos
          return buildChain({ data: null, error: null }); // add participants
        }
        if (table === 'conversations') {
          const chain = buildChain({ data: { id: 'conv-new', type: 'direct' }, error: null });
          chain.insert = jest.fn(() => chain);
          chain.select = jest.fn(() => chain);
          return chain;
        }
        if (table === 'chat_messages') {
          const chain = buildChain({
            data: { id: 'msg-share', conversation_id: 'conv-new', sender_id: 'user-1', message_type: 'activity_share', content: 'Shared Café Bella', metadata: mockActivity },
            error: null,
          });
          chain.insert = jest.fn(() => chain);
          chain.select = jest.fn(() => chain);
          return chain;
        }
        if (table === 'dashboard_notifications') {
          const chain = buildChain({ data: null, error: null });
          chain.insert = jest.fn(() => chain);
          return chain;
        }
        return buildChain({ data: null, error: null });
      });

      const result = await sendActivityShare('user-1', ['friend-1'], mockActivity);
      expect(result.success).toBe(true);
      expect(result.conversationIds.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // markConversationRead
  // -----------------------------------------------------------------------
  describe('markConversationRead', () => {
    it('should update last_read_at on participant row', async () => {
      const { supabase } = require('@/lib/supabase');
      const chain = buildChain({ data: null, error: null });
      supabase.from.mockImplementation(() => chain);

      await markConversationRead('conv-1', 'user-1');
      expect(supabase.from).toHaveBeenCalledWith('conversation_participants');
      expect(chain.update).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('conversation_id', 'conv-1');
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });
  });

  // -----------------------------------------------------------------------
  // getUnreadCount
  // -----------------------------------------------------------------------
  describe('getUnreadCount', () => {
    it('should return 0 for demo user', async () => {
      const result = await getUnreadCount('demo-user-123');
      expect(result).toBe(0);
    });

    it('should return 0 when no conversations', async () => {
      const { supabase } = require('@/lib/supabase');
      supabase.from.mockImplementation(() => buildChain({ data: [], error: null }));

      const result = await getUnreadCount('user-1');
      expect(result).toBe(0);
    });

    it('should sum unread counts across conversations', async () => {
      const { supabase } = require('@/lib/supabase');
      const callIndex = { current: 0 };

      supabase.from.mockImplementation((table: string) => {
        if (table === 'conversation_participants') {
          return buildChain({
            data: [
              { conversation_id: 'conv-1', last_read_at: '2024-01-01T00:00:00Z' },
              { conversation_id: 'conv-2', last_read_at: '2024-01-01T00:00:00Z' },
            ],
            error: null,
          });
        }
        if (table === 'chat_messages') {
          callIndex.current++;
          // First call: 3 unread, second call: 2 unread
          return buildChain({ data: null, error: null, count: callIndex.current === 1 ? 3 : 2 });
        }
        return buildChain({ data: null, error: null });
      });

      const result = await getUnreadCount('user-1');
      expect(result).toBe(5);
    });

    it('should handle table-not-found gracefully', async () => {
      const { supabase } = require('@/lib/supabase');
      supabase.from.mockImplementation(() =>
        buildChain({ data: null, error: { code: 'PGRST204', message: 'not found' } })
      );

      const result = await getUnreadCount('user-1');
      expect(result).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // updateInviteStatus
  // -----------------------------------------------------------------------
  describe('updateInviteStatus', () => {
    it('should update metadata.inviteStatus on the message', async () => {
      const { supabase } = require('@/lib/supabase');
      const callIndex = { current: 0 };

      supabase.from.mockImplementation(() => {
        callIndex.current++;
        if (callIndex.current === 1) {
          // Get message
          return buildChain({
            data: { metadata: { placeId: 'ChIJ_test', title: 'Café', inviteStatus: 'pending' } },
            error: null,
          });
        }
        // Update message
        return buildChain({ data: null, error: null });
      });

      const result = await updateInviteStatus('msg-1', 'accepted');
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const { supabase } = require('@/lib/supabase');
      supabase.from.mockImplementation(() =>
        buildChain({ data: null, error: { message: 'not found' } })
      );

      const result = await updateInviteStatus('msg-bad', 'declined');
      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // subscribeToMessages
  // -----------------------------------------------------------------------
  describe('subscribeToMessages', () => {
    it('should create a realtime channel and return unsubscribe function', () => {
      const { supabase } = require('@/lib/supabase');
      const mockChannelObj = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
      };
      supabase.channel.mockReturnValue(mockChannelObj);

      const onMessage = jest.fn();
      const unsubscribe = subscribeToMessages('conv-1', onMessage);

      expect(supabase.channel).toHaveBeenCalledWith('chat:conv-1');
      expect(mockChannelObj.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: 'conversation_id=eq.conv-1',
        }),
        expect.any(Function)
      );
      expect(mockChannelObj.subscribe).toHaveBeenCalled();

      // Call unsubscribe
      unsubscribe();
      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannelObj);
    });
  });
});
