-- Migration: Fix infinite recursion in RLS policies (v2)
-- Issue: group_plans and plan_participants policies reference each other, causing infinite recursion
-- Fix: Use SECURITY DEFINER functions to bypass RLS for cross-table checks

-- Step 1: Create helper functions that bypass RLS
-- These functions run with the definer's permissions, not the caller's

-- Function to check if user is creator of a plan (bypasses RLS)
CREATE OR REPLACE FUNCTION is_plan_creator(p_plan_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_plans
    WHERE id = p_plan_id AND creator_id = p_user_id
  );
$$;

-- Function to check if user is participant of a plan (bypasses RLS)
CREATE OR REPLACE FUNCTION is_plan_participant(p_plan_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM plan_participants
    WHERE plan_id = p_plan_id AND user_id = p_user_id
  );
$$;

-- Step 2: Drop all existing problematic policies
DROP POLICY IF EXISTS "Users can view plan participants" ON plan_participants;
DROP POLICY IF EXISTS "Users can update own participation" ON plan_participants;
DROP POLICY IF EXISTS "Plan creators can invite participants" ON plan_participants;
DROP POLICY IF EXISTS "Plan creators can remove participants" ON plan_participants;
DROP POLICY IF EXISTS "Users can view group plans they're part of" ON group_plans;
DROP POLICY IF EXISTS "Users can create group plans" ON group_plans;
DROP POLICY IF EXISTS "Plan creators can update their plans" ON group_plans;
DROP POLICY IF EXISTS "Users can view messages in their plans" ON messages;
DROP POLICY IF EXISTS "Users can send messages in their plans" ON messages;

-- Step 3: Create new non-recursive policies for plan_participants

-- SELECT: Users can view participants if they are the participant OR plan creator
CREATE POLICY "plan_participants_select" ON plan_participants
  FOR SELECT USING (
    user_id = auth.uid() OR
    is_plan_creator(plan_id, auth.uid())
  );

-- UPDATE: Users can update their own participation only
CREATE POLICY "plan_participants_update" ON plan_participants
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- INSERT: Plan creators can invite participants
CREATE POLICY "plan_participants_insert" ON plan_participants
  FOR INSERT WITH CHECK (
    is_plan_creator(plan_id, auth.uid())
  );

-- DELETE: Plan creators can remove participants
CREATE POLICY "plan_participants_delete" ON plan_participants
  FOR DELETE USING (
    is_plan_creator(plan_id, auth.uid())
  );

-- Step 4: Create new non-recursive policies for group_plans

-- SELECT: Users can view plans they created OR are participating in
CREATE POLICY "group_plans_select" ON group_plans
  FOR SELECT USING (
    creator_id = auth.uid() OR
    is_plan_participant(id, auth.uid())
  );

-- INSERT: Any authenticated user can create a plan
CREATE POLICY "group_plans_insert" ON group_plans
  FOR INSERT WITH CHECK (
    creator_id = auth.uid()
  );

-- UPDATE: Only creators can update their plans
CREATE POLICY "group_plans_update" ON group_plans
  FOR UPDATE USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- DELETE: Only creators can delete their plans
CREATE POLICY "group_plans_delete" ON group_plans
  FOR DELETE USING (creator_id = auth.uid());

-- Step 5: Create new non-recursive policies for messages

-- SELECT: Users can view messages if they're creator or participant
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    is_plan_creator(plan_id, auth.uid()) OR
    is_plan_participant(plan_id, auth.uid())
  );

-- INSERT: Users can send messages if they're creator or participant
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND (
      is_plan_creator(plan_id, auth.uid()) OR
      is_plan_participant(plan_id, auth.uid())
    )
  );

-- UPDATE: Users can edit their own messages
CREATE POLICY "messages_update" ON messages
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Users can delete their own messages
CREATE POLICY "messages_delete" ON messages
  FOR DELETE USING (user_id = auth.uid());

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION is_plan_creator TO authenticated;
GRANT EXECUTE ON FUNCTION is_plan_participant TO authenticated;
