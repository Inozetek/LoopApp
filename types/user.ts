/**
 * User Types
 *
 * Extended user interface with OAuth data and referral fields
 */

export interface FacebookLikedPlace {
  name: string;           // Exact place name (e.g., "Blue Bottle Coffee Oakland")
  category: string;       // Mapped category (e.g., "coffee", "restaurant")
  place_id?: string;      // Facebook place ID
  liked_at?: string;      // When user liked this place
}

export interface FacebookData {
  liked_places: FacebookLikedPlace[];
  events: any[];
  location: {
    city?: string;
    state?: string;
    country?: string;
  } | null;
  last_synced?: string;
}

export interface GoogleTimelinePlace {
  place_name: string;     // Place name from Timeline
  category: string;       // Inferred category
  visit_count: number;    // How many times visited
  last_visit: string;     // Most recent visit date
  lat: number;
  lng: number;
}

export interface GoogleTimelineData {
  visited_places: GoogleTimelinePlace[];
  last_synced: string | null;
}

export interface CalendarPattern {
  day?: string;           // Day of week (e.g., "friday")
  days?: string[];        // Multiple days (e.g., ["monday", "wednesday", "friday"])
  time: string;           // Time of day (e.g., "19:00")
  category: string;       // Activity category (e.g., "restaurant", "gym")
  frequency: number;      // How often (e.g., 4 times/month)
}

export interface AIProfile {
  preferred_distance_miles: number;
  budget_level: number;   // 1-4 ($, $$, $$$, $$$$)
  favorite_categories: string[];
  disliked_categories: string[];
  price_sensitivity: 'low' | 'medium' | 'high';
  time_preferences: string[];
  distance_tolerance: 'low' | 'medium' | 'high';
  calendar_patterns?: CalendarPattern[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  profile_picture_url?: string;

  // Location
  home_location?: {
    latitude: number;
    longitude: number;
  };
  home_address?: string;
  work_location?: {
    latitude: number;
    longitude: number;
  };
  work_address?: string;
  current_location?: {
    latitude: number;
    longitude: number;
  };

  // Preferences
  interests: string[];
  preferences: {
    budget: number;
    max_distance_miles: number;
    preferred_times: string[];
    notification_enabled: boolean;
    calendar_provider?: 'google' | 'apple';
  };

  // AI Learning
  ai_profile: AIProfile;

  // OAuth Data
  facebook_data?: FacebookData;
  google_timeline?: GoogleTimelineData;

  // Referral System
  referral_code?: string;
  referred_by_user_id?: string;
  referral_count: number;

  // Subscription
  subscription_tier: 'free' | 'plus' | 'premium';
  subscription_status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  stripe_customer_id?: string;
  subscription_end_date?: string;

  // Gamification
  loop_score: number;
  streak_days: number;
  last_active_date?: string;

  // Privacy
  privacy_settings: {
    share_loop_with: 'nobody' | 'friends' | 'everyone';
    discoverable: boolean;
    share_location: boolean;
  };

  // Metadata
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface Referral {
  id: string;
  referrer_user_id: string;
  referred_user_id?: string;
  referral_code: string;
  status: 'pending' | 'completed' | 'rewarded' | 'expired';
  referred_email?: string;
  referred_phone?: string;
  invite_method?: 'sms' | 'email' | 'link' | 'contact_sync';
  created_at: string;
  completed_at?: string;
  rewarded_at?: string;
  expires_at: string;
}

export interface Contact {
  id: string;
  name: string;
  phone_number?: string;
  email?: string;
  is_loop_user: boolean;
  loop_user_id?: string;
}
