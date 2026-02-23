/**
 * Shared types for Google Places integration
 *
 * Extracted from recommendations.ts to break the circular dependency:
 *   recommendations.ts → google-places-service.ts → recommendations.ts
 */

/** Location coordinates */
export type PlaceLocation = { lat: number; lng: number };

/** Google Places API result shape used across services */
export interface PlaceResult {
  place_id: string;
  name: string;
  vicinity?: string;
  formatted_address?: string;
  description?: string; // Editorial summary from Google Places
  formatted_phone_number?: string;
  website?: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types: string[];
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  photos?: Array<{ photo_reference: string }>;
  opening_hours?: {
    open_now?: boolean;
    periods?: Array<{ open: { day: number; time: string }; close?: { day: number; time: string } }>;
  };
  ai_description?: string; // Gemini-generated description from cache
  source?: 'google_places' | 'ticketmaster' | 'yelp';
  event_metadata?: any;
  yelp_metadata?: any;
}
