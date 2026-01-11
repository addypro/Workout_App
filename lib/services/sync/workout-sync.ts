/**
 * Workout Sync Service
 *
 * Handles syncing workout records to Supabase.
 * Uses NORMALIZED schema with separate workout_logs and workout_log_exercises tables.
 */

import { supabase } from '@/lib/supabase/client';
import type { SyncableWorkout, SyncResult } from './types';

/**
 * Sync a single workout to Supabase using normalized schema
 *
 * This inserts:
 * 1. A row into workout_logs
 * 2. Multiple rows into workout_log_exercises (one per exercise)
 */
export async function syncWorkoutToServer(
  workout: SyncableWorkout,
  userId: string
): Promise<SyncResult> {
  try {
    // First, insert/upsert the workout log (WITHOUT embedded exercises)
    const workoutRecord = {
      userId: userId,
      workoutName: workout.workoutName,
      workoutType: workout.workoutType,
      completedAt: workout.completedAt,
      durationSeconds: workout.durationSeconds,
      localId: workout.localId,
      // Note: NOT including exercises JSONB - using normalized table instead
    };

    // Upsert workout log - check if it exists first
    const { data: existingWorkout } = await supabase
      .from('workout_logs')
      .select('id')
      .eq('userId', userId)
      .eq('localId', workout.localId)
      .single();

    let workoutLogId: string;

    if (existingWorkout) {
      // Update existing
      workoutLogId = existingWorkout.id;
      const { error: updateError } = await supabase
        .from('workout_logs')
        .update(workoutRecord)
        .eq('id', workoutLogId);

      if (updateError) {
        return {
          success: false,
          itemId: workout.localId,
          error: `Failed to update workout: ${updateError.message}`,
        };
      }
    } else {
      // Insert new
      const { data: newWorkout, error: insertError } = await supabase
        .from('workout_logs')
        .insert(workoutRecord)
        .select('id')
        .single();

      if (insertError || !newWorkout) {
        return {
          success: false,
          itemId: workout.localId,
          error: `Failed to insert workout: ${insertError?.message || 'Unknown error'}`,
        };
      }
      workoutLogId = newWorkout.id;
    }

    // Now insert exercises into the normalized table
    if (workout.exercises.length > 0) {
      // Delete existing exercises for this workout (to handle updates)
      await supabase
        .from('workout_log_exercises')
        .delete()
        .eq('workoutLogId', workoutLogId);

      // Insert new exercises
      const exerciseRecords = workout.exercises.map((ex, index) => ({
        workoutLogId: workoutLogId,
        exerciseName: ex.exerciseName,
        exerciseOrder: index,
        setsCompleted: ex.sets.filter(s => s.completed).length,
        totalSets: ex.sets.length,
        // Best set info (optional - adapt to your schema)
        bestWeight: ex.sets.reduce((best, set) => {
          if (!set.completed) return best;
          return Math.max(best, set.weight ?? 0);
        }, 0) || null,
        bestReps: ex.sets.reduce((best, set) => {
          if (!set.completed) return best;
          if ((set.weight ?? 0) > 0) {
            return set.reps ?? best;
          }
          return Math.max(best, set.reps ?? 0);
        }, 0) || null,
      }));

      const { error: exerciseError } = await supabase
        .from('workout_log_exercises')
        .insert(exerciseRecords);

      if (exerciseError) {
        console.warn('Failed to insert exercises:', exerciseError.message);
        // Don't fail the whole sync for exercise insert failure
        // The workout itself was saved successfully
      }
    }

    return {
      success: true,
      itemId: workout.localId,
      serverResponse: { workoutLogId },
    };
  } catch (error: any) {
    return {
      success: false,
      itemId: workout.localId,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Batch sync multiple workouts
 */
export async function syncWorkoutBatch(
  workouts: SyncableWorkout[],
  userId: string
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  // Sync sequentially to handle rate limits gracefully
  for (const workout of workouts) {
    const result = await syncWorkoutToServer(workout, userId);
    results.push(result);

    // Small delay between requests
    if (workouts.length > 5) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Get user's workout count from server (for stats)
 */
export async function getServerWorkoutCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('workout_logs')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId);

    if (error) {
      console.error('Failed to get workout count:', error);
      return 0;
    }

    return count ?? 0;
  } catch (error) {
    console.error('Failed to get workout count:', error);
    return 0;
  }
}

/**
 * Fetch workouts from server for a user
 * Used for syncing down to local storage
 */
export async function fetchWorkoutsFromServer(
  userId: string,
  limit = 50
): Promise<SyncableWorkout[]> {
  try {
    // Fetch workouts with their exercises
    const { data: workouts, error } = await supabase
      .from('workout_logs')
      .select(`
        id,
        workoutName,
        workoutType,
        completedAt,
        durationSeconds,
        localId,
        workout_log_exercises (
          exerciseName,
          exerciseOrder,
          setsCompleted,
          totalSets,
          bestWeight,
          bestReps
        )
      `)
      .eq('userId', userId)
      .order('completedAt', { ascending: false })
      .limit(limit);

    if (error || !workouts) {
      console.error('Failed to fetch workouts:', error);
      return [];
    }

    // Transform to SyncableWorkout format
    return workouts.map(w => ({
      id: w.id,
      localId: w.localId,
      workoutName: w.workoutName,
      workoutType: w.workoutType as 'program' | 'quick',
      completedAt: w.completedAt,
      durationSeconds: w.durationSeconds,
      exercises: (w.workout_log_exercises || [])
        .sort((a: any, b: any) => (a.exerciseOrder ?? 0) - (b.exerciseOrder ?? 0))
        .map((ex: any) => ({
          exerciseName: ex.exerciseName,
          canonicalName: ex.exerciseName.toLowerCase().replace(/\s+/g, '_'),
          sets: Array.from({ length: ex.totalSets || 1 }, (_, i) => ({
            setNumber: i + 1,
            weight: ex.bestWeight ?? undefined,
            reps: i < (ex.setsCompleted || 0) ? (ex.bestReps ?? 0) : 0,
            completed: i < (ex.setsCompleted || 0),
          })),
        })),
    }));
  } catch (error) {
    console.error('Failed to fetch workouts:', error);
    return [];
  }
}
