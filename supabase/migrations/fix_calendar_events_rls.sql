-- Fix Row Level Security (RLS) for calendar_events table
-- Error: code 42501 - new row violates row-level security policy

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Users can insert their own calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Users can update their own calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Users can delete their own calendar events" ON calendar_events;

-- Enable RLS on calendar_events
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own calendar events
CREATE POLICY "Users can view their own calendar events"
ON calendar_events
FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to insert their own calendar events
CREATE POLICY "Users can insert their own calendar events"
ON calendar_events
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own calendar events
CREATE POLICY "Users can update their own calendar events"
ON calendar_events
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own calendar events
CREATE POLICY "Users can delete their own calendar events"
ON calendar_events
FOR DELETE
USING (auth.uid() = user_id);
