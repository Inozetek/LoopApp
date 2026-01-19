/**
 * Migration: Add Loop Routing to Calendar Events
 *
 * Adds smart routing logic to calendar events:
 * - is_chained: Whether this event is chained with the next
 * - chain_with_event_id: UUID of next event in chain
 * - recommended_departure_time: When to leave (accounting for travel + buffers)
 * - estimated_travel_minutes: Travel time from previous location
 */

-- Add loop_routing JSONB column to calendar_events
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS loop_routing JSONB DEFAULT '{
  "is_chained": false,
  "chain_with_event_id": null,
  "recommended_departure_time": null,
  "estimated_travel_minutes": null,
  "starting_location": null,
  "route_type": "single"
}'::jsonb;

-- Add fields for notification tracking
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS notifications_scheduled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS departure_notification_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS warning_notification_id VARCHAR(255);

-- Create index for JSONB queries on loop_routing
CREATE INDEX IF NOT EXISTS idx_calendar_events_loop_routing ON calendar_events USING GIN(loop_routing);

-- Create index for notification queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_notifications ON calendar_events(user_id, notifications_scheduled, start_time);

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS should_chain_events(UUID, UUID);
DROP FUNCTION IF EXISTS calculate_departure_time(UUID);
DROP FUNCTION IF EXISTS update_loop_routing_for_user(UUID);

-- Function to calculate if two events should be chained
CREATE FUNCTION should_chain_events(
  p_event_a_id UUID,
  p_event_b_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  event_a RECORD;
  event_b RECORD;
  home_location GEOGRAPHY;
  travel_time_a_to_home INTEGER;
  travel_time_home_to_b INTEGER;
  round_trip_time INTEGER;
  time_gap_minutes INTEGER;
BEGIN
  -- Get both events
  SELECT * INTO event_a FROM calendar_events WHERE id = p_event_a_id;
  SELECT * INTO event_b FROM calendar_events WHERE id = p_event_b_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Get user's home location
  SELECT home_location INTO home_location
  FROM users
  WHERE id = event_a.user_id;

  IF home_location IS NULL THEN
    RETURN FALSE;  -- Can't calculate without home location
  END IF;

  -- Calculate travel times (distance in meters / (25 mph = 11.176 m/s)) → seconds → minutes
  -- Urban travel: 25 mph average
  travel_time_a_to_home := CEIL(ST_Distance(event_a.location, home_location) / 11.176 / 60);
  travel_time_home_to_b := CEIL(ST_Distance(home_location, event_b.location) / 11.176 / 60);
  round_trip_time := travel_time_a_to_home + travel_time_home_to_b;

  -- Calculate time gap between events
  time_gap_minutes := EXTRACT(EPOCH FROM (event_b.start_time - event_a.end_time)) / 60;

  -- Chain if round trip time > time gap (not enough time to go home)
  RETURN round_trip_time > time_gap_minutes;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate departure time for an event
CREATE FUNCTION calculate_departure_time(p_event_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  event RECORD;
  starting_location GEOGRAPHY;
  travel_minutes INTEGER;
  buffer_minutes INTEGER := 10;  -- Parking + walking buffer
BEGIN
  -- Get event
  SELECT * INTO event FROM calendar_events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Determine starting location
  IF event.loop_routing->>'is_chained' = 'true' AND event.loop_routing->>'starting_location' IS NOT NULL THEN
    -- Chained event: start from previous event location
    starting_location := ST_GeogFromText(event.loop_routing->>'starting_location');
  ELSE
    -- First event of day: start from home
    SELECT home_location INTO starting_location FROM users WHERE id = event.user_id;
  END IF;

  IF starting_location IS NULL THEN
    RETURN NULL;
  END IF;

  -- Calculate travel time (distance / 25 mph)
  travel_minutes := CEIL(ST_Distance(starting_location, event.location) / 11.176 / 60);

  -- Add chain buffer if chained
  IF event.loop_routing->>'is_chained' = 'true' THEN
    buffer_minutes := buffer_minutes + 5;  -- Extra 5 min buffer between chained tasks
  END IF;

  -- Departure time = start_time - travel - buffers
  RETURN event.start_time - (travel_minutes + buffer_minutes) * INTERVAL '1 minute';
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update loop routing for a user's events
CREATE FUNCTION update_loop_routing_for_user(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  event_count INTEGER := 0;
  current_event RECORD;
  next_event RECORD;
  should_chain BOOLEAN;
  departure_time TIMESTAMPTZ;
BEGIN
  -- Get all future events for user, ordered by start time
  FOR current_event IN
    SELECT * FROM calendar_events
    WHERE user_id = p_user_id
      AND start_time >= NOW()
      AND location IS NOT NULL
    ORDER BY start_time ASC
  LOOP
    -- Get next event on same day
    SELECT * INTO next_event
    FROM calendar_events
    WHERE user_id = p_user_id
      AND id != current_event.id
      AND DATE(start_time) = DATE(current_event.start_time)
      AND start_time > current_event.end_time
      AND location IS NOT NULL
    ORDER BY start_time ASC
    LIMIT 1;

    IF FOUND THEN
      -- Check if should chain
      should_chain := should_chain_events(current_event.id, next_event.id);

      -- Update current event's routing
      UPDATE calendar_events
      SET loop_routing = jsonb_set(
        jsonb_set(
          loop_routing,
          '{is_chained}',
          to_jsonb(should_chain)
        ),
        '{chain_with_event_id}',
        to_jsonb(CASE WHEN should_chain THEN next_event.id::text ELSE NULL END)
      )
      WHERE id = current_event.id;
    ELSE
      -- Last event of day: not chained
      UPDATE calendar_events
      SET loop_routing = jsonb_set(
        jsonb_set(
          loop_routing,
          '{is_chained}',
          'false'::jsonb
        ),
        '{chain_with_event_id}',
        'null'::jsonb
      )
      WHERE id = current_event.id;
    END IF;

    -- Calculate and update departure time
    departure_time := calculate_departure_time(current_event.id);
    UPDATE calendar_events
    SET loop_routing = jsonb_set(
      loop_routing,
      '{recommended_departure_time}',
      to_jsonb(departure_time::text)
    )
    WHERE id = current_event.id;

    event_count := event_count + 1;
  END LOOP;

  RETURN event_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN calendar_events.loop_routing IS 'Smart routing data: is_chained, chain_with_event_id, departure_time, travel_minutes';
COMMENT ON FUNCTION should_chain_events IS 'Determines if two events should be chained based on travel time vs time gap';
COMMENT ON FUNCTION calculate_departure_time IS 'Calculates when user should leave for an event (accounting for travel + buffers)';
COMMENT ON FUNCTION update_loop_routing_for_user IS 'Auto-updates loop routing for all of a user''s future events';
