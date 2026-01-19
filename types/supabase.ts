/**
 * Supabase Database Types
 *
 * Minimal type stub for testing. In production, generate with:
 * npx supabase gen types typescript --project-id <your-project-id>
 */

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          phone: string | null;
          profile_picture_url: string | null;
          home_location: unknown;
          home_address: string | null;
          work_location: unknown;
          work_address: string | null;
          current_location: unknown;
          commute_route: unknown;
          interests: string[] | null;
          preferences: Record<string, unknown> | null;
          ai_profile: Record<string, unknown> | null;
          subscription_tier: string;
          subscription_status: string;
          stripe_customer_id: string | null;
          subscription_end_date: string | null;
          loop_score: number;
          streak_days: number;
          last_active_date: string | null;
          referral_code: string | null;
          referral_count: number;
          privacy_settings: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
          last_login_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['users']['Row']>;
        Update: Partial<Database['public']['Tables']['users']['Row']>;
      };
      calendar_events: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          category: string;
          location: unknown;
          address: string;
          start_time: string;
          end_time: string;
          all_day: boolean;
          source: string;
          activity_id: string | null;
          external_calendar_id: string | null;
          external_event_id: string | null;
          status: string;
          completed_at: string | null;
          loop_routing: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['calendar_events']['Row']>;
        Update: Partial<Database['public']['Tables']['calendar_events']['Row']>;
      };
      activities: {
        Row: {
          id: string;
          business_id: string | null;
          google_place_id: string | null;
          name: string;
          category: string;
          subcategory: string | null;
          description: string | null;
          location: unknown;
          address: string;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          phone: string | null;
          website: string | null;
          price_range: number | null;
          rating: number | null;
          reviews_count: number;
          hours: Record<string, unknown> | null;
          photos: unknown[] | null;
          cover_photo_url: string | null;
          tags: string[] | null;
          sponsored_tier: string;
          sponsor_active: boolean;
          sponsor_start_date: string | null;
          sponsor_end_date: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          last_synced_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['activities']['Row']>;
        Update: Partial<Database['public']['Tables']['activities']['Row']>;
      };
      feedback: {
        Row: {
          id: string;
          user_id: string;
          activity_id: string | null;
          recommendation_id: string | null;
          rating: string;
          feedback_tags: string[] | null;
          feedback_notes: string | null;
          completed_at: string;
          weather_at_time: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['feedback']['Row']>;
        Update: Partial<Database['public']['Tables']['feedback']['Row']>;
      };
      recommendations: {
        Row: {
          id: string;
          user_id: string;
          activity_id: string;
          recommended_for: string;
          reason: string | null;
          confidence_score: number | null;
          algorithm_version: string | null;
          score_breakdown: Record<string, unknown> | null;
          is_sponsored: boolean;
          business_id: string | null;
          status: string;
          viewed_at: string | null;
          responded_at: string | null;
          created_at: string;
          expires_at: string;
        };
        Insert: Partial<Database['public']['Tables']['recommendations']['Row']>;
        Update: Partial<Database['public']['Tables']['recommendations']['Row']>;
      };
      referrals: {
        Row: {
          id: string;
          referrer_user_id: string;
          referred_user_id: string | null;
          referral_code: string;
          referred_email: string | null;
          referred_phone: string | null;
          invite_method: string;
          status: string;
          rewarded_at: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['referrals']['Row']>;
        Update: Partial<Database['public']['Tables']['referrals']['Row']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
