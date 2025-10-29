-- Add demo user for testing/demo mode
-- This user has a valid UUID format and can be used for calendar events

INSERT INTO users (
  id,
  email,
  name,
  interests,
  preferences,
  ai_profile,
  subscription_tier,
  subscription_status,
  loop_score,
  streak_days,
  last_active_date,
  privacy_settings
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@loop.app',
  'Demo User',
  '["coffee", "live music", "hiking", "food", "art"]'::jsonb,
  '{
    "budget": 2,
    "max_distance_miles": 5,
    "preferred_times": ["evening"],
    "notification_enabled": true
  }'::jsonb,
  '{
    "preferred_distance_miles": 5.0,
    "budget_level": 2,
    "favorite_categories": ["coffee", "live music"],
    "disliked_categories": [],
    "price_sensitivity": "medium",
    "time_preferences": ["evening"],
    "distance_tolerance": "medium"
  }'::jsonb,
  'free',
  'active',
  150,
  5,
  CURRENT_DATE,
  '{
    "share_loop_with": "friends",
    "discoverable": true,
    "share_location": true
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  interests = EXCLUDED.interests,
  preferences = EXCLUDED.preferences,
  ai_profile = EXCLUDED.ai_profile,
  subscription_tier = EXCLUDED.subscription_tier,
  subscription_status = EXCLUDED.subscription_status,
  loop_score = EXCLUDED.loop_score,
  streak_days = EXCLUDED.streak_days,
  last_active_date = EXCLUDED.last_active_date,
  privacy_settings = EXCLUDED.privacy_settings,
  updated_at = NOW();
