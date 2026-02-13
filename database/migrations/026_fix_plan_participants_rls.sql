-- Migration: Fix infinite recursion in plan_participants RLS policy
-- Issue: The policy references plan_participants within its own check, causing infinite recursion
-- Fix: Simplify the policy to directly check user_id or creator_id without self-referencing

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view plan participants" ON plan_participants;
DROP POLICY IF EXISTS "Users can update own participation" ON plan_participants;
DROP POLICY IF EXISTS "Plan creators can invite participants" ON plan_participants;

-- Create new non-recursive policy for SELECT
-- Users can view participants if:
-- 1. They are the participant themselves, OR
-- 2. They are the creator of the plan
CREATE POLICY "Users can view plan participants" ON plan_participants
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM group_plans
      WHERE id = plan_participants.plan_id AND creator_id = auth.uid()
    )
  );

-- Users can update their own participation (RSVP)
CREATE POLICY "Users can update own participation" ON plan_participants
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Plan creators can invite participants (INSERT)
CREATE POLICY "Plan creators can invite participants" ON plan_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_plans
      WHERE id = plan_id AND creator_id = auth.uid()
    )
  );

-- Plan creators can remove participants (DELETE)
CREATE POLICY "Plan creators can remove participants" ON plan_participants
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM group_plans
      WHERE id = plan_participants.plan_id AND creator_id = auth.uid()
    )
  );

-- Also fix the group_plans policy that has the same issue
DROP POLICY IF EXISTS "Users can view group plans they're part of" ON group_plans;

-- Simpler policy: Users can view plans they created or are invited to
CREATE POLICY "Users can view group plans they're part of" ON group_plans
  FOR SELECT USING (
    creator_id = auth.uid() OR
    id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
  );

-- Fix messages policies too (they also reference plan_participants)
DROP POLICY IF EXISTS "Users can view messages in their plans" ON messages;
DROP POLICY IF EXISTS "Users can send messages in their plans" ON messages;

CREATE POLICY "Users can view messages in their plans" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_plans
      WHERE id = messages.plan_id AND creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM plan_participants
      WHERE plan_id = messages.plan_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages in their plans" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (
        SELECT 1 FROM group_plans
        WHERE id = plan_id AND creator_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM plan_participants
        WHERE plan_id = messages.plan_id AND user_id = auth.uid()
      )
    )
  );
