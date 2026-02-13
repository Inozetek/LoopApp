-- Migration 029: Friend Groups
-- User-created friend group collections with per-group privacy controls

-- friend_groups: user-created collections
CREATE TABLE IF NOT EXISTS friend_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  emoji VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_friend_groups_user ON friend_groups(user_id);

-- friend_group_members: which friends are in which groups
CREATE TABLE IF NOT EXISTS friend_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES friend_groups(id) ON DELETE CASCADE,
  friend_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, friend_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_group_members_group ON friend_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_friend_group_members_friend ON friend_group_members(friend_user_id);

-- friend_group_privacy: per-group visibility controls
CREATE TABLE IF NOT EXISTS friend_group_privacy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES friend_groups(id) ON DELETE CASCADE,
  can_see_my_loop BOOLEAN DEFAULT true,
  i_can_see_their_loop BOOLEAN DEFAULT true,
  include_in_group_recs BOOLEAN DEFAULT true,
  include_in_one_on_one_recs BOOLEAN DEFAULT true,
  auto_share_calendar BOOLEAN DEFAULT false,
  UNIQUE(group_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_group_privacy_group ON friend_group_privacy(group_id);

-- RLS policies: owner-only access
-- Uses direct user_id check to avoid friendships table recursion (see migrations 026/027)
ALTER TABLE friend_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_group_privacy ENABLE ROW LEVEL SECURITY;

-- friend_groups: owner can CRUD
CREATE POLICY friend_groups_owner_policy ON friend_groups
  FOR ALL USING (auth.uid() = user_id);

-- friend_group_members: owner of the parent group can CRUD
CREATE POLICY friend_group_members_owner_policy ON friend_group_members
  FOR ALL USING (
    group_id IN (SELECT id FROM friend_groups WHERE user_id = auth.uid())
  );

-- friend_group_privacy: owner of the parent group can CRUD
CREATE POLICY friend_group_privacy_owner_policy ON friend_group_privacy
  FOR ALL USING (
    group_id IN (SELECT id FROM friend_groups WHERE user_id = auth.uid())
  );
