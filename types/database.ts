// TypeScript types for Supabase database tables
// Generated from database schema in database/migrations/001_initial_schema.sql

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          phone: string | null
          profile_picture_url: string | null
          home_location: unknown | null // PostGIS GEOGRAPHY type
          home_address: string | null
          work_location: unknown | null
          work_address: string | null
          current_location: unknown | null
          commute_route: unknown | null
          interests: Json
          preferences: Json
          ai_profile: Json
          subscription_tier: 'free' | 'plus' | 'premium'
          subscription_status: 'active' | 'cancelled' | 'past_due' | 'trialing'
          stripe_customer_id: string | null
          subscription_end_date: string | null
          loop_score: number
          streak_days: number
          last_active_date: string | null
          created_at: string
          updated_at: string
          last_login_at: string | null
          privacy_settings: Json
          // Phase 2: Referral system
          referral_code: string | null
          referred_by_user_id: string | null
          referral_count: number
          referral_credits_cents: number
          // Phase 2: Refresh tracking
          last_refresh_at: string | null
        }
        Insert: {
          id?: string
          email: string
          name: string
          phone?: string | null
          profile_picture_url?: string | null
          home_location?: unknown | null
          home_address?: string | null
          work_location?: unknown | null
          work_address?: string | null
          current_location?: unknown | null
          commute_route?: unknown | null
          interests?: Json
          preferences?: Json
          ai_profile?: Json
          subscription_tier?: 'free' | 'plus' | 'premium'
          subscription_status?: 'active' | 'cancelled' | 'past_due' | 'trialing'
          stripe_customer_id?: string | null
          subscription_end_date?: string | null
          loop_score?: number
          streak_days?: number
          last_active_date?: string | null
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
          privacy_settings?: Json
          referral_code?: string | null
          referred_by_user_id?: string | null
          referral_count?: number
          referral_credits_cents?: number
          last_refresh_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          name?: string
          phone?: string | null
          profile_picture_url?: string | null
          home_location?: unknown | null
          home_address?: string | null
          work_location?: unknown | null
          work_address?: string | null
          current_location?: unknown | null
          commute_route?: unknown | null
          interests?: Json
          preferences?: Json
          ai_profile?: Json
          subscription_tier?: 'free' | 'plus' | 'premium'
          subscription_status?: 'active' | 'cancelled' | 'past_due' | 'trialing'
          stripe_customer_id?: string | null
          subscription_end_date?: string | null
          loop_score?: number
          streak_days?: number
          last_active_date?: string | null
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
          privacy_settings?: Json
          referral_code?: string | null
          referred_by_user_id?: string | null
          referral_count?: number
          referral_credits_cents?: number
          last_refresh_at?: string | null
        }
      }
      calendar_events: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          category: 'work' | 'personal' | 'social' | 'dining' | 'fitness' | 'entertainment' | 'travel' | 'other' | null
          location: unknown
          address: string
          start_time: string
          end_time: string
          all_day: boolean
          source: 'manual' | 'recommendation' | 'google_calendar' | 'apple_calendar' | 'group_plan'
          activity_id: string | null
          external_calendar_id: string | null
          external_event_id: string | null
          status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          category?: 'work' | 'personal' | 'social' | 'dining' | 'fitness' | 'entertainment' | 'travel' | 'other' | null
          location: unknown
          address: string
          start_time: string
          end_time: string
          all_day?: boolean
          source?: 'manual' | 'recommendation' | 'google_calendar' | 'apple_calendar' | 'group_plan'
          activity_id?: string | null
          external_calendar_id?: string | null
          external_event_id?: string | null
          status?: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          category?: 'work' | 'personal' | 'social' | 'dining' | 'fitness' | 'entertainment' | 'travel' | 'other' | null
          location?: unknown
          address?: string
          start_time?: string
          end_time?: string
          all_day?: boolean
          source?: 'manual' | 'recommendation' | 'google_calendar' | 'apple_calendar' | 'group_plan'
          activity_id?: string | null
          external_calendar_id?: string | null
          external_event_id?: string | null
          status?: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // Phase 2: Referral System
      referrals: {
        Row: {
          id: string
          referrer_user_id: string
          referred_user_id: string
          referral_code: string
          status: 'pending' | 'completed' | 'expired' | 'invalid'
          completed_at: string | null
          source: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          referrer_user_id: string
          referred_user_id: string
          referral_code: string
          status?: 'pending' | 'completed' | 'expired' | 'invalid'
          completed_at?: string | null
          source?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'pending' | 'completed' | 'expired' | 'invalid'
          completed_at?: string | null
          updated_at?: string
        }
      }
      referral_rewards: {
        Row: {
          id: string
          user_id: string
          referral_id: string | null
          reward_type: 'inviter_bonus' | 'invitee_welcome' | 'milestone_3' | 'milestone_10' | 'milestone_25' | 'milestone_100'
          reward_description: string
          reward_value_cents: number | null
          reward_plus_days: number | null
          status: 'pending' | 'granted' | 'revoked' | 'expired'
          granted_at: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          referral_id?: string | null
          reward_type: 'inviter_bonus' | 'invitee_welcome' | 'milestone_3' | 'milestone_10' | 'milestone_25' | 'milestone_100'
          reward_description: string
          reward_value_cents?: number | null
          reward_plus_days?: number | null
          status?: 'pending' | 'granted' | 'revoked' | 'expired'
          granted_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          status?: 'pending' | 'granted' | 'revoked' | 'expired'
          granted_at?: string | null
          expires_at?: string | null
        }
      }
      // Phase 2: Refresh Tracking
      refresh_history: {
        Row: {
          id: string
          user_id: string
          tier: string
          recommendations_count: number
          data_source: string
          refresh_time: string
          google_api_calls: number
          estimated_cost_cents: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tier: string
          recommendations_count: number
          data_source: string
          refresh_time?: string
          google_api_calls?: number
          estimated_cost_cents?: number
          created_at?: string
        }
        Update: {
          [key: string]: never
        }
      }
      // Add more tables as needed (activities, recommendations, etc.)
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types for common use cases
export type User = Database['public']['Tables']['users']['Row']
export type UserProfile = Database['public']['Tables']['users']['Row'] // Alias for User
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']

export type CalendarEvent = Database['public']['Tables']['calendar_events']['Row']
export type CalendarEventInsert = Database['public']['Tables']['calendar_events']['Insert']
export type CalendarEventUpdate = Database['public']['Tables']['calendar_events']['Update']

// User preferences type
export interface UserPreferences {
  budget: number
  max_distance_miles: number
  preferred_times: string[]
  notification_enabled: boolean
}

// User interests type
export type UserInterests = string[]

// Privacy settings type
export interface PrivacySettings {
  share_loop_with: 'friends' | 'close_friends' | 'no_one'
  discoverable: boolean
  share_location: boolean
  group_invite_settings: {
    who_can_invite: 'everyone' | 'friends' | 'close_friends' | 'no_one'
    require_mutual_friends: boolean
    blocked_from_invites: string[]
    auto_decline_from_strangers: boolean
    notification_preferences: {
      group_invites: boolean
      new_friend_in_group: boolean
    }
  }
}
