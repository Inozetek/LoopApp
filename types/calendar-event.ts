/**
 * Calendar Event Types
 *
 * Extended calendar event interface with Loop routing
 */

export interface LoopRouting {
  is_chained: boolean;                    // Is this event chained with the next?
  chain_with_event_id: string | null;     // UUID of next event in chain
  recommended_departure_time: string | null;  // When to leave
  estimated_travel_minutes: number | null;    // Travel time from starting point
  starting_location: {
    latitude: number;
    longitude: number;
  } | null;                               // Where this event starts from (home or previous event)
  route_type: 'single' | 'chained';       // Single round trip or multi-stop chain
}

export interface CalendarEvent {
  id: string;
  user_id: string;

  // Basic info
  title: string;
  description?: string;
  category: 'work' | 'personal' | 'social' | 'dining' | 'fitness' | 'entertainment' | 'travel' | 'other';

  // Location (required)
  location: {
    latitude: number;
    longitude: number;
  };
  address: string;

  // Timing
  start_time: string;
  end_time: string;
  all_day: boolean;

  // Source
  source: 'manual' | 'recommendation' | 'google_calendar' | 'apple_calendar' | 'group_plan';
  activity_id?: string;
  external_calendar_id?: string;
  external_event_id?: string;

  // Status
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  completed_at?: string;

  // Loop Routing (NEW)
  loop_routing: LoopRouting;

  // Notifications
  notifications_scheduled: boolean;
  departure_notification_id?: string;
  warning_notification_id?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}

export interface FreeTimeSlot {
  start: string;
  end: string;
  duration_minutes: number;
  date: string;  // YYYY-MM-DD
}

export interface DayLoop {
  date: string;  // YYYY-MM-DD
  events: CalendarEvent[];
  chains: EventChain[];
  total_distance_miles: number;
  total_travel_time_minutes: number;
}

export interface EventChain {
  events: CalendarEvent[];
  start_location: {
    latitude: number;
    longitude: number;
    label: string;  // "Home", "Work", or address
  };
  end_location: {
    latitude: number;
    longitude: number;
    label: string;
  };
  total_distance_miles: number;
  total_travel_time_minutes: number;
  recommended_departure_time: string;
}
