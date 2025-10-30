// Types for activities and recommendations

export interface Location {
  latitude: number;
  longitude: number;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface Activity {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  description?: string;
  location: Location;
  distance?: number; // Distance from user in miles
  rating?: number; // 0-5
  reviewsCount?: number;
  priceRange: number; // 0-3 ($, $$, $$$, $$$$)
  photoUrl?: string;
  phone?: string;
  website?: string;
  hours?: Record<string, string>; // { "monday": "9:00 AM - 5:00 PM", ... }
  tags?: string[];
  isSponsored?: boolean;
  sponsorTier?: 'organic' | 'boosted' | 'premium';
  googlePlaceId?: string;
}

export interface RecommendationScore {
  baseScore: number; // 0-40
  locationScore: number; // 0-20
  timeScore: number; // 0-15
  feedbackScore: number; // 0-15
  collaborativeScore: number; // 0-10
  sponsorBoost: number; // 0-30% boost
  finalScore: number; // Total with sponsor boost
}

export interface Recommendation {
  id: string;
  title: string;
  category: string;
  location: string;
  distance: string;
  priceRange: number;
  rating: number;
  imageUrl: string;
  photos?: string[]; // Array of photo URLs for Instagram-style carousel
  aiExplanation: string;
  description?: string; // Editorial summary from Google Places
  reviewSummary?: string; // AI-generated summary of reviews
  openNow?: boolean;
  isSponsored: boolean;
  score?: number;
  scoreBreakdown?: RecommendationScore;
  // Legacy fields for backward compatibility
  activity?: Activity;
  reason?: string;
  recommendedFor?: Date;
  confidence?: number;
  status?: 'pending' | 'viewed' | 'accepted' | 'declined' | 'expired';
  viewedAt?: Date;
  respondedAt?: Date;
  createdAt?: Date;
  expiresAt?: Date;
}

export interface GooglePlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number; // 0-4
  types: string[];
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  opening_hours?: {
    open_now: boolean;
    weekday_text: string[];
  };
}

export interface GooglePlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  editorial_summary?: string; // Editorial description from Google
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  opening_hours?: {
    open_now: boolean;
    weekday_text: string[];
    periods?: Array<{
      open: { day: number; time: string };
      close: { day: number; time: string };
    }>;
  };
  types: string[];
  reviews?: Array<{
    author_name: string;
    rating: number;
    text: string;
    time: number;
  }>;
}

export type InterestCategory =
  | 'dining'
  | 'coffee'
  | 'bars'
  | 'live_music'
  | 'fitness'
  | 'outdoor'
  | 'arts'
  | 'entertainment'
  | 'shopping'
  | 'wellness'
  | 'sports'
  | 'nightlife'
  | 'culture'
  | 'events'
  | 'family'
  | 'education'
  | 'travel'
  | 'other';
