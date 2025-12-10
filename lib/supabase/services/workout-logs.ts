import { supabase } from '../client';
import type {
  DbWorkoutLog,
  DbWorkoutLogExercise,
  CreateWorkoutLogInput,
  WorkoutLogWithExercises,
} from '../types';

// Get all workout logs for a user
export async function getUserWorkoutLogs(
  userId: string,
  limit: number = 50
): Promise<WorkoutLogWithExercises[]> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select(`
      *,
      exercises:workout_log_exercises(*),
      program:programs(*)
    `)
    .eq('userId', userId)
    .order('completedAt', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// Get workout logs for a specific program
export async function getProgramWorkoutLogs(
  programId: string
): Promise<WorkoutLogWithExercises[]> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select(`
      *,
      exercises:workout_log_exercises(*)
    `)
    .eq('programId', programId)
    .order('completedAt', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Get a single workout log by ID
export async function getWorkoutLogById(
  logId: string
): Promise<WorkoutLogWithExercises | null> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select(`
      *,
      exercises:workout_log_exercises(*),
      program:programs(*)
    `)
    .eq('id', logId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// Create a new workout log with exercises
export async function createWorkoutLog(
  input: CreateWorkoutLogInput
): Promise<WorkoutLogWithExercises> {
  // Start a transaction-like operation
  // First, create the workout log
  const { data: log, error: logError } = await supabase
    .from('workout_logs')
    .insert({
      userId: input.userId,
      programId: input.programId ?? null,
      workoutId: input.workoutId ?? null,
      week: input.week ?? null,
      day: input.day ?? null,
      duration: input.duration ?? null,
      notes: input.notes ?? null,
      rating: input.rating ?? null,
    })
    .select()
    .single();

  if (logError) throw logError;

  // Then, create the exercise logs
  if (input.exercises.length > 0) {
    const exerciseLogs = input.exercises.map(ex => ({
      workoutLogId: log.id,
      exerciseName: ex.exerciseName,
      sets: ex.sets,
      reps: ex.reps ?? null,
      weight: ex.weight ?? null,
      completed: ex.completed ?? false,
      notes: ex.notes ?? null,
      rpe: ex.rpe ?? null,
      order: ex.order,
    }));

    const { error: exerciseError } = await supabase
      .from('workout_log_exercises')
      .insert(exerciseLogs);

    if (exerciseError) throw exerciseError;
  }

  // Fetch and return the complete workout log
  return getWorkoutLogById(log.id) as Promise<WorkoutLogWithExercises>;
}

// Update workout log
export async function updateWorkoutLog(
  logId: string,
  updates: Partial<Omit<DbWorkoutLog, 'id' | 'userId' | 'completedAt'>>
): Promise<DbWorkoutLog> {
  const { data, error } = await supabase
    .from('workout_logs')
    .update(updates)
    .eq('id', logId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete workout log (cascades to exercises)
export async function deleteWorkoutLog(logId: string): Promise<void> {
  const { error } = await supabase
    .from('workout_logs')
    .delete()
    .eq('id', logId);

  if (error) throw error;
}

// Update a specific exercise in a workout log
export async function updateWorkoutLogExercise(
  exerciseId: string,
  updates: Partial<Omit<DbWorkoutLogExercise, 'id' | 'workoutLogId'>>
): Promise<DbWorkoutLogExercise> {
  const { data, error } = await supabase
    .from('workout_log_exercises')
    .update(updates)
    .eq('id', exerciseId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get workout statistics for a user
export async function getWorkoutStats(userId: string): Promise<{
  totalWorkouts: number;
  totalDuration: number;
  workoutsThisWeek: number;
  averageRating: number;
}> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('id, duration, rating, completedAt')
    .eq('userId', userId);

  if (error) throw error;

  const logs = data ?? [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const totalWorkouts = logs.length;
  const totalDuration = logs.reduce((sum, log) => sum + (log.duration ?? 0), 0);
  const workoutsThisWeek = logs.filter(
    log => new Date(log.completedAt) >= weekAgo
  ).length;
  const ratingsWithValue = logs.filter(log => log.rating !== null);
  const averageRating = ratingsWithValue.length > 0
    ? ratingsWithValue.reduce((sum, log) => sum + (log.rating ?? 0), 0) / ratingsWithValue.length
    : 0;

  return {
    totalWorkouts,
    totalDuration,
    workoutsThisWeek,
    averageRating: Math.round(averageRating * 10) / 10,
  };
}

// Get exercise history (all times a specific exercise was logged)
export async function getExerciseHistory(
  userId: string,
  exerciseName: string,
  limit: number = 20
): Promise<DbWorkoutLogExercise[]> {
  const { data, error } = await supabase
    .from('workout_log_exercises')
    .select(`
      *,
      workoutLog:workout_logs!inner(userId, completedAt)
    `)
    .eq('workoutLog.userId', userId)
    .ilike('exerciseName', exerciseName)
    .order('workoutLog(completedAt)', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
