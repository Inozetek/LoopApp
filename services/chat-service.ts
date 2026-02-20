/**
 * Chat Service — Supabase CRUD for conversations and messages
 *
 * Handles 1:1 direct messages with activity sharing, invite status,
 * and real-time subscription helpers.
 */

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageType = 'text' | 'activity_share' | 'invite' | 'system';
export type InviteStatus = 'pending' | 'accepted' | 'declined';

export interface ActivityShareMetadata {
  placeId: string;
  title: string;
  category: string;
  imageUrl: string;
  rating: number;
  priceRange: number;
  distance: string;
  aiExplanation?: string;
  address?: string;
  inviteStatus?: InviteStatus | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: MessageType;
  content: string | null;
  metadata: ActivityShareMetadata | Record<string, any>;
  status: 'sent' | 'delivered' | 'read';
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  // Joined fields
  sender_name?: string;
  sender_avatar?: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  title: string | null;
  created_at: string;
  updated_at: string;
  // Derived fields
  other_user_id?: string;
  other_user_name?: string;
  other_user_avatar?: string;
  last_message?: ChatMessage | null;
  unread_count?: number;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
}

// ---------------------------------------------------------------------------
// Demo / Fallback
// ---------------------------------------------------------------------------

const DEMO_USER_ID = 'demo-user-123';

function isDemoUser(userId: string): boolean {
  return userId === DEMO_USER_ID || userId === '00000000-0000-0000-0000-000000000001';
}

// ---------------------------------------------------------------------------
// Conversation CRUD
// ---------------------------------------------------------------------------

/**
 * Find an existing 1:1 conversation between two users, or create one.
 */
export async function getOrCreateDirectConversation(
  userId: string,
  friendId: string
): Promise<Conversation | null> {
  if (isDemoUser(userId)) return null;

  try {
    // Find existing direct conversation where both users are participants
    const { data: myConvos, error: myErr } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);

    if (myErr) throw myErr;

    if (myConvos && myConvos.length > 0) {
      const myConvoIds = myConvos.map((c: any) => c.conversation_id);

      const { data: shared, error: sharedErr } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', friendId)
        .in('conversation_id', myConvoIds);

      if (sharedErr) throw sharedErr;

      if (shared && shared.length > 0) {
        // Verify it's a direct conversation
        const { data: conv, error: convErr } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', shared[0].conversation_id)
          .eq('type', 'direct')
          .maybeSingle();

        if (!convErr && conv) {
          return conv as Conversation;
        }
      }
    }

    // Create new conversation
    const { data: newConv, error: createErr } = await supabase
      .from('conversations')
      .insert({ type: 'direct' })
      .select()
      .single();

    if (createErr) throw createErr;

    // Add both participants
    const { error: partErr } = await supabase
      .from('conversation_participants')
      .insert([
        { conversation_id: newConv.id, user_id: userId },
        { conversation_id: newConv.id, user_id: friendId },
      ]);

    if (partErr) throw partErr;

    return newConv as Conversation;
  } catch (error: any) {
    if (error?.code === 'PGRST204' || error?.code === '42P01') {
      console.warn('⚠️ Chat tables not found — migration 034 may not be run');
      return null;
    }
    console.error('❌ getOrCreateDirectConversation error:', error);
    return null;
  }
}

/**
 * Get all conversations for a user, with last message preview and unread count.
 */
export async function getConversations(userId: string): Promise<Conversation[]> {
  if (isDemoUser(userId)) return [];

  try {
    // Get user's conversation IDs
    const { data: participations, error: partErr } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId);

    if (partErr) throw partErr;
    if (!participations || participations.length === 0) return [];

    const convoIds = participations.map((p: any) => p.conversation_id);
    const readTimes = new Map(
      participations.map((p: any) => [p.conversation_id, p.last_read_at])
    );

    // Get conversations
    const { data: conversations, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .in('id', convoIds)
      .order('updated_at', { ascending: false });

    if (convErr) throw convErr;
    if (!conversations) return [];

    // For each conversation, get other participant + last message + unread count
    const result: Conversation[] = [];

    for (const conv of conversations) {
      // Get other participant
      const { data: otherParts, error: otherErr } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conv.id)
        .neq('user_id', userId);

      let otherUser: any = null;
      if (!otherErr && otherParts && otherParts.length > 0) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, name, profile_picture_url')
          .eq('id', otherParts[0].user_id)
          .maybeSingle();
        otherUser = userData;
      }

      // Get last message
      const { data: lastMsg } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Count unread messages
      const lastReadAt = readTimes.get(conv.id) || conv.created_at;
      const { count: unreadCount } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .neq('sender_id', userId)
        .gt('created_at', lastReadAt)
        .is('deleted_at', null);

      result.push({
        ...conv,
        other_user_id: otherUser?.id ?? null,
        other_user_name: otherUser?.name ?? 'Unknown',
        other_user_avatar: otherUser?.profile_picture_url ?? null,
        last_message: lastMsg ?? null,
        unread_count: unreadCount ?? 0,
      });
    }

    return result;
  } catch (error: any) {
    if (error?.code === 'PGRST204' || error?.code === '42P01') {
      console.warn('⚠️ Chat tables not found');
      return [];
    }
    console.error('❌ getConversations error:', error);
    return [];
  }
}

/**
 * Get paginated messages for a conversation.
 */
export async function getMessages(
  conversationId: string,
  limit = 50,
  before?: string
): Promise<ChatMessage[]> {
  try {
    let query = supabase
      .from('chat_messages')
      .select(`
        id, conversation_id, sender_id, message_type, content, metadata, status,
        created_at, edited_at, deleted_at
      `)
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data ?? []) as ChatMessage[];
  } catch (error: any) {
    if (error?.code === 'PGRST204' || error?.code === '42P01') return [];
    console.error('❌ getMessages error:', error);
    return [];
  }
}

/**
 * Send a text message to a conversation.
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  type: MessageType = 'text',
  metadata: Record<string, any> = {}
): Promise<ChatMessage | null> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        message_type: type,
        content,
        metadata,
      })
      .select()
      .single();

    if (error) throw error;

    // Update conversation updated_at
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data as ChatMessage;
  } catch (error) {
    console.error('❌ sendMessage error:', error);
    return null;
  }
}

/**
 * Share an activity with one or more friends.
 * Creates conversations as needed and sends activity_share messages.
 */
export async function sendActivityShare(
  senderId: string,
  recipientIds: string[],
  activityData: ActivityShareMetadata
): Promise<{ success: boolean; conversationIds: string[] }> {
  if (isDemoUser(senderId)) return { success: false, conversationIds: [] };

  const conversationIds: string[] = [];

  try {
    for (const recipientId of recipientIds) {
      const conv = await getOrCreateDirectConversation(senderId, recipientId);
      if (!conv) continue;

      const msg = await sendMessage(
        conv.id,
        senderId,
        `Shared ${activityData.title}`,
        'activity_share',
        { ...activityData, inviteStatus: 'pending' }
      );

      if (msg) {
        conversationIds.push(conv.id);

        // Create a notification for the recipient
        try {
          await supabase.from('dashboard_notifications').insert({
            user_id: recipientId,
            notification_type: 'activity_share',
            priority: 'normal',
            title: 'Activity shared with you',
            message: `Someone shared ${activityData.title} with you`,
            data: {
              conversation_id: conv.id,
              message_id: msg.id,
              place_id: activityData.placeId,
              activity_title: activityData.title,
            },
            action_button_text: 'Open Chat',
            action_deep_link: `/chat/${conv.id}`,
            is_read: false,
            is_dismissed: false,
            is_actioned: false,
          });
        } catch {
          // Notification table may not have the new type yet — non-critical
        }
      }
    }

    return { success: conversationIds.length > 0, conversationIds };
  } catch (error) {
    console.error('❌ sendActivityShare error:', error);
    return { success: false, conversationIds };
  }
}

/**
 * Mark a conversation as read up to now.
 */
export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<void> {
  try {
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
  } catch (error) {
    console.error('❌ markConversationRead error:', error);
  }
}

/**
 * Get total unread message count across all conversations.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  if (isDemoUser(userId)) return 0;

  try {
    const { data: participations, error: partErr } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId);

    if (partErr) throw partErr;
    if (!participations || participations.length === 0) return 0;

    let total = 0;
    for (const p of participations) {
      const { count } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', p.conversation_id)
        .neq('sender_id', userId)
        .gt('created_at', p.last_read_at)
        .is('deleted_at', null);

      total += count ?? 0;
    }

    return total;
  } catch (error: any) {
    if (error?.code === 'PGRST204' || error?.code === 'PGRST205' || error?.code === '42P01') return 0;
    console.error('❌ getUnreadCount error:', error);
    return 0;
  }
}

/**
 * Update the invite status on an activity_share or invite message.
 */
export async function updateInviteStatus(
  messageId: string,
  status: 'accepted' | 'declined'
): Promise<boolean> {
  try {
    // First get the current message
    const { data: msg, error: getErr } = await supabase
      .from('chat_messages')
      .select('metadata')
      .eq('id', messageId)
      .single();

    if (getErr) throw getErr;

    const updatedMetadata = { ...(msg.metadata as Record<string, any>), inviteStatus: status };

    const { error: updateErr } = await supabase
      .from('chat_messages')
      .update({ metadata: updatedMetadata })
      .eq('id', messageId);

    if (updateErr) throw updateErr;
    return true;
  } catch (error) {
    console.error('❌ updateInviteStatus error:', error);
    return false;
  }
}

/**
 * Find or create a group conversation linked to a group plan.
 * Uses the plan's title as the conversation title.
 * All plan participants + the creator become conversation participants.
 */
export async function getOrCreateGroupConversation(
  planId: string,
  creatorId: string,
  participantUserIds: string[],
  title?: string
): Promise<Conversation | null> {
  if (isDemoUser(creatorId)) return null;

  try {
    // Check if a group conversation already exists for this plan
    // We store planId in the conversation title with a prefix for lookup
    const planTag = `plan:${planId}`;

    const { data: existingConvos, error: lookupErr } = await supabase
      .from('conversations')
      .select('*')
      .eq('type', 'group')
      .like('title', `%${planTag}%`);

    if (!lookupErr && existingConvos && existingConvos.length > 0) {
      return existingConvos[0] as Conversation;
    }

    // Create new group conversation
    const convTitle = title ? `${title} [${planTag}]` : planTag;
    const { data: newConv, error: createErr } = await supabase
      .from('conversations')
      .insert({ type: 'group', title: convTitle })
      .select()
      .single();

    if (createErr) throw createErr;

    // Add all participants (creator + invited friends)
    const allUserIds = [creatorId, ...participantUserIds.filter((id) => id !== creatorId)];
    const participantRows = allUserIds.map((uid) => ({
      conversation_id: newConv.id,
      user_id: uid,
    }));

    const { error: partErr } = await supabase
      .from('conversation_participants')
      .insert(participantRows);

    if (partErr) throw partErr;

    return newConv as Conversation;
  } catch (error: any) {
    if (error?.code === 'PGRST204' || error?.code === '42P01') {
      console.warn('Chat tables not found -- migration 034 may not be run');
      return null;
    }
    console.error('getOrCreateGroupConversation error:', error);
    return null;
  }
}

/**
 * Get messages for a group plan conversation.
 * Convenience wrapper around getMessages.
 */
export async function getGroupPlanMessages(
  planId: string,
  creatorId: string,
  participantUserIds: string[],
  title?: string,
  limit = 50
): Promise<{ conversationId: string | null; messages: ChatMessage[] }> {
  const conv = await getOrCreateGroupConversation(planId, creatorId, participantUserIds, title);
  if (!conv) return { conversationId: null, messages: [] };

  const messages = await getMessages(conv.id, limit);
  return { conversationId: conv.id, messages };
}

/**
 * Subscribe to real-time messages in a conversation.
 * Returns an unsubscribe function.
 */
export function subscribeToMessages(
  conversationId: string,
  onNewMessage: (message: ChatMessage) => void
): () => void {
  const channel = supabase
    .channel(`chat:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: any) => {
        onNewMessage(payload.new as ChatMessage);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
