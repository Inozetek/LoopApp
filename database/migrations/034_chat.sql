-- Migration 034: Chat / Direct Messaging System
-- Supports 1:1 DMs (extensible to group chats later)
-- Real-time via Supabase Realtime publication

-- Conversations (1:1 DMs, extensible to group later)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  title VARCHAR(255),              -- NULL for direct, name for group
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation participants
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Chat messages (supports text, activity shares, invites, system)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text'
    CHECK (message_type IN ('text', 'activity_share', 'invite', 'system')),
  content TEXT,                    -- Text content for text messages
  metadata JSONB DEFAULT '{}'::jsonb,  -- Activity data for shares/invites
  status VARCHAR(20) DEFAULT 'sent'
    CHECK (status IN ('sent', 'delivered', 'read')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conv ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id, created_at DESC);

-- RLS policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can see conversations they participate in
CREATE POLICY "Users see own conversations" ON conversations FOR SELECT
  USING (id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()));

-- Users can create conversations
CREATE POLICY "Users create conversations" ON conversations FOR INSERT
  WITH CHECK (true);

-- Users can update conversations they participate in
CREATE POLICY "Users update own conversations" ON conversations FOR UPDATE
  USING (id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()));

-- Users can see participants in their conversations
CREATE POLICY "Users see own participants" ON conversation_participants FOR SELECT
  USING (conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()));

-- Users can add participants (to create conversations)
CREATE POLICY "Users add participants" ON conversation_participants FOR INSERT
  WITH CHECK (true);

-- Participants can update last_read_at
CREATE POLICY "Users update read status" ON conversation_participants FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Users can read messages in their conversations
CREATE POLICY "Users read own messages" ON chat_messages FOR SELECT
  USING (conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()));

-- Users can send messages to their conversations
CREATE POLICY "Users send messages" ON chat_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND conversation_id IN (
    SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()));

-- Users can update their own messages (edit/delete)
CREATE POLICY "Users update own messages" ON chat_messages FOR UPDATE
  USING (sender_id = auth.uid());

-- Enable Realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
