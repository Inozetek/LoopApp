/**
 * Event Validation Utilities
 * Prevents impossible event scenarios (e.g., same team playing multiple games same day)
 */

import { UnifiedActivity } from '@/types/activity';

/**
 * Extract team name from event title
 * Handles common patterns: "Dallas Mavericks vs Lakers", "Mavericks at Celtics"
 */
export function extractTeamName(eventTitle: string): string | null {
  // Common patterns in sports event titles
  const patterns = [
    /^([^vs]+) vs /i,        // "Dallas Mavericks vs Lakers"
    /^([^at]+) at /i,        // "Mavericks at Celtics"
    /^([^-]+) - /,           // "FC Dallas - Houston Dynamo"
    /^([^v\.]+) v\. /i,      // "Team A v. Team B"
  ];

  for (const pattern of patterns) {
    const match = eventTitle.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Check if two events involve the same team
 */
export function areTeamsPlaying(event1: string, event2: string): boolean {
  const team1 = extractTeamName(event1);
  const team2 = extractTeamName(event2);

  if (!team1 || !team2) return false;

  // Check if either team appears in both events
  const event1Lower = event1.toLowerCase();
  const event2Lower = event2.toLowerCase();
  const team1Lower = team1.toLowerCase();
  const team2Lower = team2.toLowerCase();

  return event1Lower.includes(team2Lower) || event2Lower.includes(team1Lower);
}

/**
 * Validate event scheduling to prevent impossible scenarios
 * - Same team can't play multiple games same day
 * - Same venue can't host multiple events at same time
 */
export function validateEventScheduling(events: UnifiedActivity[]): UnifiedActivity[] {
  const validEvents: UnifiedActivity[] = [];
  const eventsByDate = new Map<string, UnifiedActivity[]>();

  // Group events by date
  for (const event of events) {
    if (!event.event_metadata?.start_time) continue;

    const date = new Date(event.event_metadata.start_time).toISOString().split('T')[0];

    if (!eventsByDate.has(date)) {
      eventsByDate.set(date, []);
    }
    eventsByDate.get(date)!.push(event);
  }

  // Check each date for conflicts
  for (const [date, dateEvents] of eventsByDate) {
    const teamsPlayingToday = new Set<string>();

    for (const event of dateEvents) {
      const teamName = extractTeamName(event.name);

      // Check if this team is already playing today
      if (teamName && teamsPlayingToday.has(teamName.toLowerCase())) {
        console.warn(`⚠️ Impossible event: ${teamName} playing multiple games on ${date}`);
        continue; // Skip this duplicate event
      }

      // Check for conflicting events at same venue/time
      const conflictExists = validEvents.some(existing => {
        if (!existing.event_metadata?.start_time) return false;

        const existingDate = new Date(existing.event_metadata.start_time).toISOString().split('T')[0];
        if (existingDate !== date) return false;

        // Same venue check
        const sameVenue = existing.formatted_address === event.formatted_address;
        if (!sameVenue) return false;

        // Same time check (within 1 hour)
        const timeDiff = Math.abs(
          new Date(existing.event_metadata.start_time).getTime() -
          new Date(event.event_metadata!.start_time).getTime()
        );
        const withinOneHour = timeDiff < 3600000; // 1 hour in milliseconds

        if (withinOneHour) {
          console.warn(`⚠️ Venue conflict: ${existing.name} and ${event.name} at ${event.formatted_address} on ${date}`);
          return true;
        }

        return false;
      });

      if (!conflictExists) {
        validEvents.push(event);
        if (teamName) {
          teamsPlayingToday.add(teamName.toLowerCase());
        }
      }
    }
  }

  if (validEvents.length < events.length) {
    console.log(`✅ Event validation: ${events.length} → ${validEvents.length} (removed ${events.length - validEvents.length} impossible events)`);
  }

  return validEvents;
}
