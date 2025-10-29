/**
 * Task Optimization Algorithm
 *
 * Intelligently reorders tasks for maximum efficiency while respecting constraints:
 * - Mandatory tasks (work, school) stay locked at their scheduled times
 * - "Nice to have" tasks get reordered for optimal geographic routing
 * - Considers travel time between locations
 * - Factors in current user location
 * - Minimizes total travel distance
 *
 * Goal: "This coffee shop is 2 min from your route home!"
 */

import { supabase } from '@/lib/supabase';

export interface CalendarTask {
  id: string;
  title: string;
  description?: string;
  category: string;
  location: {
    latitude: number;
    longitude: number;
  };
  address: string;
  start_time: string;
  end_time: string;
  status: string;
  is_mandatory?: boolean; // Work, school, appointments
  is_flexible?: boolean; // Can be moved
  priority?: number; // 1 (low) to 5 (high)
}

export interface OptimizedSchedule {
  original_tasks: CalendarTask[];
  optimized_tasks: CalendarTask[];
  time_saved_minutes: number;
  distance_saved_miles: number;
  route_efficiency_score: number; // 0-100
  suggestions: OptimizationSuggestion[];
}

export interface OptimizationSuggestion {
  type: 'reorder' | 'combine' | 'skip' | 'add';
  task_id: string;
  old_time?: string;
  new_time: string;
  reason: string;
  time_saved?: number;
  distance_saved?: number;
}

/**
 * Main optimization function
 * Takes a day's tasks and returns optimized schedule
 */
export async function optimizeTasksForDay(
  userId: string,
  date: string, // YYYY-MM-DD
  userLocation?: { latitude: number; longitude: number }
): Promise<OptimizedSchedule> {
  // Fetch all tasks for the day
  const tasks = await fetchTasksForDay(userId, date);

  if (tasks.length === 0) {
    return {
      original_tasks: [],
      optimized_tasks: [],
      time_saved_minutes: 0,
      distance_saved_miles: 0,
      route_efficiency_score: 100,
      suggestions: [],
    };
  }

  // Separate mandatory vs flexible tasks
  const mandatory = tasks.filter((t) => isMandatoryTask(t));
  const flexible = tasks.filter((t) => !isMandatoryTask(t));

  // If no flexible tasks, nothing to optimize
  if (flexible.length === 0) {
    return {
      original_tasks: tasks,
      optimized_tasks: tasks,
      time_saved_minutes: 0,
      distance_saved_miles: 0,
      route_efficiency_score: 100,
      suggestions: [],
    };
  }

  // Calculate original route metrics
  const originalMetrics = calculateRouteMetrics(tasks, userLocation);

  // Optimize flexible tasks around mandatory anchors
  const optimizedTasks = optimizeFlexibleTasks(
    mandatory,
    flexible,
    userLocation
  );

  // Calculate optimized route metrics
  const optimizedMetrics = calculateRouteMetrics(
    optimizedTasks,
    userLocation
  );

  // Generate suggestions for user
  const suggestions = generateSuggestions(tasks, optimizedTasks);

  return {
    original_tasks: tasks,
    optimized_tasks: optimizedTasks,
    time_saved_minutes:
      originalMetrics.total_time_minutes - optimizedMetrics.total_time_minutes,
    distance_saved_miles:
      originalMetrics.total_distance_miles - optimizedMetrics.total_distance_miles,
    route_efficiency_score: optimizedMetrics.efficiency_score,
    suggestions,
  };
}

/**
 * Fetch tasks for a specific day from database
 */
async function fetchTasksForDay(
  userId: string,
  date: string
): Promise<CalendarTask[]> {
  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59`;

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId)
    .gte('start_time', startOfDay)
    .lte('start_time', endOfDay)
    .eq('status', 'scheduled')
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }

  return (data || []).map((event: any) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    category: event.category,
    location: parseLocationFromPostGIS(event.location),
    address: event.address,
    start_time: event.start_time,
    end_time: event.end_time,
    status: event.status,
    is_mandatory: isMandatoryCategory(event.category),
    is_flexible: !isMandatoryCategory(event.category),
  }));
}

/**
 * Determine if a task is mandatory (can't be moved)
 */
function isMandatoryTask(task: CalendarTask): boolean {
  if (task.is_mandatory !== undefined) {
    return task.is_mandatory;
  }

  return isMandatoryCategory(task.category);
}

/**
 * Check if category is typically mandatory
 */
function isMandatoryCategory(category: string): boolean {
  const mandatoryCategories = ['work', 'school', 'medical', 'appointment'];
  return mandatoryCategories.includes(category.toLowerCase());
}

/**
 * Optimize flexible tasks around mandatory anchors
 * Uses greedy nearest-neighbor algorithm with time windows
 */
function optimizeFlexibleTasks(
  mandatory: CalendarTask[],
  flexible: CalendarTask[],
  userLocation?: { latitude: number; longitude: number }
): CalendarTask[] {
  const result: CalendarTask[] = [...mandatory];
  const unscheduled = [...flexible];

  // Create time windows between mandatory tasks
  const windows = createTimeWindows(mandatory);

  // For each time window, fit in flexible tasks optimally
  for (const window of windows) {
    let currentLocation = window.start_location || userLocation;

    while (unscheduled.length > 0) {
      // Find closest task that fits in this window
      const best = findBestTaskForWindow(
        unscheduled,
        window,
        currentLocation
      );

      if (!best) break; // No more tasks fit in this window

      // Schedule task at optimal time
      const optimizedTask = scheduleTaskInWindow(best.task, window, currentLocation);
      result.push(optimizedTask);

      // Remove from unscheduled
      const index = unscheduled.indexOf(best.task);
      unscheduled.splice(index, 1);

      // Update current location
      currentLocation = best.task.location;

      // Reduce window available time
      const taskDuration = getTaskDuration(best.task);
      window.end_time = new Date(
        new Date(optimizedTask.start_time).getTime() + taskDuration * 60000
      ).toISOString();
    }
  }

  // If tasks remain unscheduled, append at end of day
  for (const task of unscheduled) {
    result.push(task);
  }

  // Sort by start time
  result.sort(
    (a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  return result;
}

/**
 * Create time windows between mandatory tasks
 */
interface TimeWindow {
  start_time: string;
  end_time: string;
  start_location?: { latitude: number; longitude: number };
  end_location?: { latitude: number; longitude: number };
}

function createTimeWindows(mandatory: CalendarTask[]): TimeWindow[] {
  const windows: TimeWindow[] = [];

  if (mandatory.length === 0) {
    // Entire day is free
    const today = new Date();
    today.setHours(8, 0, 0, 0); // Default start 8am
    const endDay = new Date();
    endDay.setHours(22, 0, 0, 0); // Default end 10pm

    windows.push({
      start_time: today.toISOString(),
      end_time: endDay.toISOString(),
    });

    return windows;
  }

  // Sort mandatory tasks by time
  const sorted = [...mandatory].sort(
    (a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  // Create windows between each mandatory task
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    const windowStart = current.end_time;
    const windowEnd = next.start_time;

    // Only create window if there's at least 30 min gap
    const gapMinutes =
      (new Date(windowEnd).getTime() - new Date(windowStart).getTime()) /
      60000;

    if (gapMinutes >= 30) {
      windows.push({
        start_time: windowStart,
        end_time: windowEnd,
        start_location: current.location,
        end_location: next.location,
      });
    }
  }

  // Window before first mandatory task
  const firstTask = sorted[0];
  const morningStart = new Date(firstTask.start_time);
  morningStart.setHours(8, 0, 0, 0);

  if (new Date(firstTask.start_time).getTime() > morningStart.getTime()) {
    windows.unshift({
      start_time: morningStart.toISOString(),
      end_time: firstTask.start_time,
      end_location: firstTask.location,
    });
  }

  // Window after last mandatory task
  const lastTask = sorted[sorted.length - 1];
  const eveningEnd = new Date(lastTask.end_time);
  eveningEnd.setHours(22, 0, 0, 0);

  if (new Date(lastTask.end_time).getTime() < eveningEnd.getTime()) {
    windows.push({
      start_time: lastTask.end_time,
      end_time: eveningEnd.toISOString(),
      start_location: lastTask.location,
    });
  }

  return windows;
}

/**
 * Find best task to fit in time window using nearest-neighbor heuristic
 */
function findBestTaskForWindow(
  tasks: CalendarTask[],
  window: TimeWindow,
  currentLocation?: { latitude: number; longitude: number }
): { task: CalendarTask; distance: number } | null {
  let bestTask: CalendarTask | null = null;
  let shortestDistance = Infinity;

  for (const task of tasks) {
    const duration = getTaskDuration(task);

    // Check if task fits in window
    const windowDuration =
      (new Date(window.end_time).getTime() -
        new Date(window.start_time).getTime()) /
      60000;

    if (duration > windowDuration - 15) continue; // Need 15 min buffer for travel

    // Calculate distance from current location
    const distance = currentLocation
      ? calculateDistance(currentLocation, task.location)
      : 0;

    if (distance < shortestDistance) {
      shortestDistance = distance;
      bestTask = task;
    }
  }

  return bestTask ? { task: bestTask, distance: shortestDistance } : null;
}

/**
 * Schedule task at optimal time within window
 */
function scheduleTaskInWindow(
  task: CalendarTask,
  window: TimeWindow,
  fromLocation?: { latitude: number; longitude: number }
): CalendarTask {
  let travelTime = 0;

  if (fromLocation) {
    const distance = calculateDistance(fromLocation, task.location);
    travelTime = estimateTravelTime(distance);
  }

  // Schedule task after travel time from window start
  const scheduledStart = new Date(
    new Date(window.start_time).getTime() + travelTime * 60000
  );

  const duration = getTaskDuration(task);
  const scheduledEnd = new Date(scheduledStart.getTime() + duration * 60000);

  return {
    ...task,
    start_time: scheduledStart.toISOString(),
    end_time: scheduledEnd.toISOString(),
  };
}

/**
 * Calculate distance between two points (Haversine formula)
 * Returns distance in miles
 */
function calculateDistance(
  loc1: { latitude: number; longitude: number },
  loc2: { latitude: number; longitude: number }
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
  const dLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((loc1.latitude * Math.PI) / 180) *
      Math.cos((loc2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Estimate travel time in minutes based on distance
 * Assumes average city driving: 25 mph
 */
function estimateTravelTime(distanceMiles: number): number {
  const avgSpeedMph = 25;
  return Math.ceil((distanceMiles / avgSpeedMph) * 60);
}

/**
 * Get task duration in minutes
 */
function getTaskDuration(task: CalendarTask): number {
  const start = new Date(task.start_time).getTime();
  const end = new Date(task.end_time).getTime();
  return (end - start) / 60000;
}

/**
 * Calculate route metrics for a set of tasks
 */
interface RouteMetrics {
  total_distance_miles: number;
  total_time_minutes: number;
  efficiency_score: number; // 0-100
  travel_segments: number;
}

function calculateRouteMetrics(
  tasks: CalendarTask[],
  startLocation?: { latitude: number; longitude: number }
): RouteMetrics {
  if (tasks.length === 0) {
    return {
      total_distance_miles: 0,
      total_time_minutes: 0,
      efficiency_score: 100,
      travel_segments: 0,
    };
  }

  let totalDistance = 0;
  let totalTime = 0;
  let currentLocation = startLocation || tasks[0].location;

  for (const task of tasks) {
    // Travel to task location
    const distance = calculateDistance(currentLocation, task.location);
    const travelTime = estimateTravelTime(distance);

    totalDistance += distance;
    totalTime += travelTime;

    // Time spent at task
    const taskDuration = getTaskDuration(task);
    totalTime += taskDuration;

    currentLocation = task.location;
  }

  // Efficiency score: Lower distance + fewer backtrack = higher score
  const avgDistancePerTask = tasks.length > 1 ? totalDistance / (tasks.length - 1) : 0;
  const idealDistance = avgDistancePerTask * (tasks.length - 1);
  const efficiencyScore = Math.max(
    0,
    Math.min(100, 100 - (totalDistance - idealDistance) * 10)
  );

  return {
    total_distance_miles: totalDistance,
    total_time_minutes: totalTime,
    efficiency_score: efficiencyScore,
    travel_segments: tasks.length - 1,
  };
}

/**
 * Generate user-friendly suggestions
 */
function generateSuggestions(
  original: CalendarTask[],
  optimized: CalendarTask[]
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  for (const optTask of optimized) {
    const origTask = original.find((t) => t.id === optTask.id);

    if (!origTask) continue;

    // Check if time changed
    const origTime = new Date(origTask.start_time).getTime();
    const optTime = new Date(optTask.start_time).getTime();

    if (Math.abs(origTime - optTime) > 5 * 60000) {
      // More than 5 min difference
      suggestions.push({
        type: 'reorder',
        task_id: optTask.id,
        old_time: origTask.start_time,
        new_time: optTask.start_time,
        reason: generateReorderReason(origTask, optTask, original),
        time_saved: Math.abs(origTime - optTime) / 60000,
      });
    }
  }

  return suggestions;
}

/**
 * Generate human-readable reason for reordering
 */
function generateReorderReason(
  original: CalendarTask,
  optimized: CalendarTask,
  allTasks: CalendarTask[]
): string {
  // Find adjacent task in optimized schedule
  const optIndex = allTasks.findIndex((t) => t.id === optimized.id);

  if (optIndex > 0) {
    const previousTask = allTasks[optIndex - 1];
    const distance = calculateDistance(
      previousTask.location,
      optimized.location
    );

    if (distance < 1) {
      return `Just ${distance.toFixed(1)} miles from ${previousTask.title}`;
    } else {
      return `More efficient route between your activities`;
    }
  }

  return 'Optimized for better time management';
}

/**
 * Parse PostGIS POINT format to coordinates
 */
function parseLocationFromPostGIS(postgisString: string): {
  latitude: number;
  longitude: number;
} {
  // PostGIS format: "POINT(longitude latitude)"
  const match = postgisString.match(/POINT\(([^ ]+) ([^ ]+)\)/);

  if (match) {
    return {
      longitude: parseFloat(match[1]),
      latitude: parseFloat(match[2]),
    };
  }

  // Fallback default location
  return {
    latitude: 32.7767,
    longitude: -96.797,
  };
}

/**
 * Apply optimized schedule to database
 * Updates start/end times for flexible tasks
 */
export async function applyOptimizedSchedule(
  userId: string,
  optimizedTasks: CalendarTask[]
): Promise<{ success: boolean; updated_count: number }> {
  let updatedCount = 0;

  for (const task of optimizedTasks) {
    // Only update flexible tasks
    if (task.is_mandatory) continue;

    try {
      const { error } = await (supabase
        .from('calendar_events') as any)
        .update({
          start_time: task.start_time,
          end_time: task.end_time,
        })
        .eq('id', task.id)
        .eq('user_id', userId); // Security: ensure user owns the task

      if (error) {
        console.error('Error updating task:', error);
        continue;
      }

      updatedCount++;
    } catch (error) {
      console.error('Error applying optimization:', error);
    }
  }

  return {
    success: updatedCount > 0,
    updated_count: updatedCount,
  };
}
