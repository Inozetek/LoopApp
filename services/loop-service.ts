/**
 * Loop Service
 *
 * Core loop workflow functionality:
 * - Save/reuse loop configurations
 * - Task completion detection with geofencing
 * - Loop progress tracking
 * - Group planning helpers
 *
 * Part of Workstream 8: Loop Workflow Completion
 */

import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface SavedLoop {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  tasks: SavedLoopTask[];
  created_at: string;
  updated_at: string;
  times_used: number;
  last_used_at?: string;
}

export interface SavedLoopTask {
  title: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  duration_minutes: number;
  order_index: number;
  google_place_id?: string;
}

export interface LoopProgress {
  total_tasks: number;
  completed_tasks: number;
  current_task_index: number;
  progress_percentage: number;
  estimated_completion_time?: string;
  is_on_schedule: boolean;
}

export interface TaskCompletionResult {
  task_id: string;
  completed: boolean;
  completed_at?: string;
  detected_via: 'geofence' | 'manual' | 'time_based';
}

// ============================================================================
// SAVE/REUSE LOOPS
// ============================================================================

/**
 * Save current day's loop as a reusable template
 */
export async function saveLoopAsTemplate(
  userId: string,
  name: string,
  description: string,
  tasks: SavedLoopTask[]
): Promise<SavedLoop | null> {
  try {
    const loopData = {
      user_id: userId,
      name,
      description,
      tasks,
      times_used: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save to saved_loops table (create if doesn't exist)
    const { data, error } = await supabase
      .from('saved_loops')
      .insert(loopData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving loop template:', error);
      // If table doesn't exist, log and return null gracefully
      if (error.code === '42P01') {
        console.log('💡 saved_loops table not yet created - feature coming soon');
        return null;
      }
      throw error;
    }

    console.log('✅ Loop template saved:', data.id);
    return data as SavedLoop;
  } catch (error) {
    console.error('❌ Error in saveLoopAsTemplate:', error);
    return null;
  }
}

/**
 * Fetch user's saved loop templates
 */
export async function getSavedLoops(userId: string): Promise<SavedLoop[]> {
  try {
    const { data, error } = await supabase
      .from('saved_loops')
      .select('*')
      .eq('user_id', userId)
      .order('last_used_at', { ascending: false, nullsFirst: false });

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01') {
        console.log('💡 saved_loops table not yet created');
        return [];
      }
      throw error;
    }

    return (data as SavedLoop[]) || [];
  } catch (error) {
    console.error('❌ Error fetching saved loops:', error);
    return [];
  }
}

/**
 * Apply a saved loop to a specific date
 */
export async function applyLoopToDate(
  userId: string,
  loopId: string,
  targetDate: Date
): Promise<boolean> {
  try {
    // Fetch the saved loop
    const { data: loop, error: fetchError } = await supabase
      .from('saved_loops')
      .select('*')
      .eq('id', loopId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !loop) {
      console.error('❌ Loop not found:', loopId);
      return false;
    }

    // Create calendar events for each task
    const tasks = (loop.tasks as SavedLoopTask[]) || [];
    const baseTime = new Date(targetDate);
    baseTime.setHours(9, 0, 0, 0); // Start at 9 AM by default

    let currentTime = baseTime;

    for (const task of tasks) {
      const startTime = new Date(currentTime);
      const endTime = new Date(currentTime);
      endTime.setMinutes(endTime.getMinutes() + (task.duration_minutes || 60));

      const eventData = {
        user_id: userId,
        title: task.title,
        category: task.category || 'other',
        location: `POINT(${task.longitude} ${task.latitude})`,
        address: task.address,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'scheduled',
        source: 'saved_loop',
      };

      const { error: insertError } = await supabase
        .from('calendar_events')
        .insert(eventData);

      if (insertError) {
        console.error('❌ Error creating event from loop:', insertError);
        continue;
      }

      // Move to next time slot (add 30 min buffer between tasks)
      currentTime = new Date(endTime);
      currentTime.setMinutes(currentTime.getMinutes() + 30);
    }

    // Update loop usage stats
    await supabase
      .from('saved_loops')
      .update({
        times_used: (loop.times_used || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', loopId);

    console.log('✅ Loop applied to date:', targetDate.toDateString());
    return true;
  } catch (error) {
    console.error('❌ Error applying loop to date:', error);
    return false;
  }
}

/**
 * Delete a saved loop
 */
export async function deleteSavedLoop(
  userId: string,
  loopId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('saved_loops')
      .delete()
      .eq('id', loopId)
      .eq('user_id', userId);

    if (error) throw error;

    console.log('✅ Loop deleted:', loopId);
    return true;
  } catch (error) {
    console.error('❌ Error deleting loop:', error);
    return false;
  }
}

// ============================================================================
// TASK COMPLETION DETECTION
// ============================================================================

/**
 * Check if user has arrived at a task location (geofencing)
 * Uses a 100-meter radius for detection
 */
export function isUserAtTaskLocation(
  userLat: number,
  userLng: number,
  taskLat: number,
  taskLng: number,
  radiusMeters: number = 100
): boolean {
  // Haversine formula for distance calculation
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (userLat * Math.PI) / 180;
  const φ2 = (taskLat * Math.PI) / 180;
  const Δφ = ((taskLat - userLat) * Math.PI) / 180;
  const Δλ = ((taskLng - userLng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;

  return distance <= radiusMeters;
}

/**
 * Mark a task as completed
 */
export async function markTaskCompleted(
  taskId: string,
  detectedVia: 'geofence' | 'manual' | 'time_based' = 'manual'
): Promise<TaskCompletionResult> {
  try {
    const completedAt = new Date().toISOString();

    const { error } = await supabase
      .from('calendar_events')
      .update({
        status: 'completed',
        completed_at: completedAt,
      })
      .eq('id', taskId);

    if (error) throw error;

    console.log(`✅ Task completed (${detectedVia}):`, taskId);

    return {
      task_id: taskId,
      completed: true,
      completed_at: completedAt,
      detected_via: detectedVia,
    };
  } catch (error) {
    console.error('❌ Error marking task completed:', error);
    return {
      task_id: taskId,
      completed: false,
      detected_via: detectedVia,
    };
  }
}

// ============================================================================
// LOOP PROGRESS TRACKING
// ============================================================================

/**
 * Calculate loop progress for a given day
 */
export async function getLoopProgress(
  userId: string,
  date: Date
): Promise<LoopProgress> {
  try {
    // Get date range for the day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch all tasks for the day
    const { data: tasks, error } = await supabase
      .from('calendar_events')
      .select('id, status, start_time, end_time')
      .eq('user_id', userId)
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .order('start_time', { ascending: true });

    if (error) throw error;

    const allTasks = (tasks || []) as { id: string; status: string; start_time: string; end_time: string }[];
    const completedTasks = allTasks.filter((t: { status: string }) => t.status === 'completed');

    // Find current task (first non-completed task)
    const now = new Date();
    let currentTaskIndex = 0;
    for (let i = 0; i < allTasks.length; i++) {
      if (allTasks[i].status !== 'completed') {
        currentTaskIndex = i;
        break;
      }
    }

    // Check if on schedule
    const isOnSchedule = allTasks.every((task: { status: string; start_time: string }) => {
      if (task.status === 'completed') return true;
      const startTime = new Date(task.start_time);
      return startTime > now; // Future tasks are fine
    });

    // Estimate completion time
    let estimatedCompletionTime: string | undefined;
    if (allTasks.length > 0) {
      const lastTask = allTasks[allTasks.length - 1];
      estimatedCompletionTime = lastTask.end_time;
    }

    return {
      total_tasks: allTasks.length,
      completed_tasks: completedTasks.length,
      current_task_index: currentTaskIndex,
      progress_percentage: allTasks.length > 0
        ? Math.round((completedTasks.length / allTasks.length) * 100)
        : 0,
      estimated_completion_time: estimatedCompletionTime,
      is_on_schedule: isOnSchedule,
    };
  } catch (error) {
    console.error('❌ Error getting loop progress:', error);
    return {
      total_tasks: 0,
      completed_tasks: 0,
      current_task_index: 0,
      progress_percentage: 0,
      is_on_schedule: true,
    };
  }
}

/**
 * Get time until next task
 */
export function getTimeUntilNextTask(
  nextTaskStartTime: string
): { minutes: number; formatted: string } {
  const now = new Date();
  const taskTime = new Date(nextTaskStartTime);
  const diffMs = taskTime.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);

  let formatted: string;
  if (diffMins < 0) {
    formatted = 'Now';
  } else if (diffMins < 60) {
    formatted = `${diffMins}m`;
  } else {
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    formatted = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  return { minutes: diffMins, formatted };
}

// ============================================================================
// GROUP PLANNING HELPERS
// ============================================================================

/**
 * Calculate geographic midpoint for group meetup
 */
export function calculateGroupMidpoint(
  locations: { latitude: number; longitude: number }[]
): { latitude: number; longitude: number } {
  if (locations.length === 0) {
    return { latitude: 0, longitude: 0 };
  }

  // Simple average for close locations (within same city)
  const sumLat = locations.reduce((sum, loc) => sum + loc.latitude, 0);
  const sumLng = locations.reduce((sum, loc) => sum + loc.longitude, 0);

  return {
    latitude: sumLat / locations.length,
    longitude: sumLng / locations.length,
  };
}

/**
 * Find overlapping free time between friends
 */
export function findOverlappingFreeTime(
  userFreeSlots: { start: Date; end: Date }[],
  friendFreeSlots: { start: Date; end: Date }[]
): { start: Date; end: Date }[] {
  const overlaps: { start: Date; end: Date }[] = [];

  for (const userSlot of userFreeSlots) {
    for (const friendSlot of friendFreeSlots) {
      const overlapStart = new Date(
        Math.max(userSlot.start.getTime(), friendSlot.start.getTime())
      );
      const overlapEnd = new Date(
        Math.min(userSlot.end.getTime(), friendSlot.end.getTime())
      );

      // Check if overlap is at least 1 hour
      const overlapMinutes = (overlapEnd.getTime() - overlapStart.getTime()) / 60000;
      if (overlapMinutes >= 60) {
        overlaps.push({ start: overlapStart, end: overlapEnd });
      }
    }
  }

  // Sort by start time
  overlaps.sort((a, b) => a.start.getTime() - b.start.getTime());

  return overlaps;
}
