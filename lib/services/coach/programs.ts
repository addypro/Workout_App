/**
 * Coach Programs Service
 *
 * Handles program creation, management, and assignment to athletes.
 * Includes workout generation and tracking.
 */

import { supabase } from '../../supabase/client';
import type { PRRecord } from '../notifications/types';
import { calculateDuration, countTotalSets, detectPRs } from '../workout/pr-detector';
import {
  AssignedWorkout,
  AssignmentStatus,
  AssignProgramInput,
  CoachProgram,
  CreateProgramInput,
  PaginatedResult,
  ProgramAssignment,
  ProgramWorkout,
  ServiceResult,
  WorkoutStatus,
} from './types';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function getLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function getLocalDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// ============================================
// PROGRAM MANAGEMENT
// ============================================

/**
 * Create a new program
 */
export async function createProgram(
  input: CreateProgramInput
): Promise<ServiceResult<CoachProgram>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const { data: coachProfile } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!coachProfile) {
      return { data: null, error: 'Coach profile not found', success: false };
    }

    const { data, error } = await supabase
      .from('coach_programs')
      .insert({
        coach_id: coachProfile.id,
        name: input.name,
        description: input.description,
        category: input.category,
        sport: input.sport,
        difficulty: input.difficulty,
        duration_weeks: input.durationWeeks,
        days_per_week: input.daysPerWeek,
        workouts: JSON.stringify(input.workouts || []),
        is_template: input.isTemplate || false,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      data: mapToCoachProgram(data),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachPrograms] createProgram error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to create program',
      success: false,
    };
  }
}

/**
 * Get all programs for the current coach
 */
export async function getMyPrograms(
  page: number = 1,
  pageSize: number = 20
): Promise<ServiceResult<PaginatedResult<CoachProgram>>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const { data: coachProfile } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!coachProfile) {
      return { data: null, error: 'Coach profile not found', success: false };
    }

    const offset = (page - 1) * pageSize;

    const { count } = await supabase
      .from('coach_programs')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', coachProfile.id);

    const { data, error } = await supabase
      .from('coach_programs')
      .select('*')
      .eq('coach_id', coachProfile.id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    return {
      data: {
        data: (data || []).map(mapToCoachProgram),
        total: count || 0,
        page,
        pageSize,
        hasMore: (count || 0) > offset + pageSize,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachPrograms] getMyPrograms error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get programs',
      success: false,
    };
  }
}

/**
 * Get a single program by ID
 */
export async function getProgram(programId: string): Promise<ServiceResult<CoachProgram>> {
  try {
    const { data, error } = await supabase
      .from('coach_programs')
      .select('*')
      .eq('id', programId)
      .single();

    if (error) throw error;

    return {
      data: mapToCoachProgram(data),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachPrograms] getProgram error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get program',
      success: false,
    };
  }
}

/**
 * Update a program
 */
export async function updateProgram(
  programId: string,
  input: Partial<CreateProgramInput>
): Promise<ServiceResult<CoachProgram>> {
  try {
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.sport !== undefined) updateData.sport = input.sport;
    if (input.difficulty !== undefined) updateData.difficulty = input.difficulty;
    if (input.durationWeeks !== undefined) updateData.duration_weeks = input.durationWeeks;
    if (input.daysPerWeek !== undefined) updateData.days_per_week = input.daysPerWeek;
    if (input.workouts !== undefined) updateData.workouts = JSON.stringify(input.workouts);
    if (input.isTemplate !== undefined) updateData.is_template = input.isTemplate;

    const { data, error } = await supabase
      .from('coach_programs')
      .update(updateData)
      .eq('id', programId)
      .select()
      .single();

    if (error) throw error;

    return {
      data: mapToCoachProgram(data),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachPrograms] updateProgram error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to update program',
      success: false,
    };
  }
}

/**
 * Delete a program
 */
export async function deleteProgram(programId: string): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('coach_programs')
      .delete()
      .eq('id', programId);

    if (error) throw error;

    return { data: undefined, error: null, success: true };
  } catch (error) {
    console.error('[CoachPrograms] deleteProgram error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to delete program',
      success: false,
    };
  }
}

// ============================================
// PROGRAM ASSIGNMENT
// ============================================

/**
 * Assign a program to an athlete
 */
export async function assignProgram(
  input: AssignProgramInput
): Promise<ServiceResult<ProgramAssignment>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const { data: coachProfile } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!coachProfile) {
      return { data: null, error: 'Coach profile not found', success: false };
    }

    // Get the program to calculate end date
    const { data: program } = await supabase
      .from('coach_programs')
      .select('duration_weeks, workouts')
      .eq('id', input.programId)
      .single();

    const endDate = program?.duration_weeks
      ? new Date(input.startDate.getTime() + program.duration_weeks * 7 * 24 * 60 * 60 * 1000)
      : null;

    // Create assignment
    const { data, error } = await supabase
      .from('program_assignments')
      .insert({
        program_id: input.programId,
        coach_id: coachProfile.id,
        athlete_user_id: input.athleteUserId,
        start_date: input.startDate.toISOString().split('T')[0],
        end_date: endDate?.toISOString().split('T')[0],
        modifications: input.modifications || {},
        coach_notes: input.coachNotes,
        status: AssignmentStatus.ACTIVE,
      })
      .select()
      .single();

    if (error) throw error;

    // Generate assigned workouts
    if (program?.workouts) {
      const workouts = typeof program.workouts === 'string'
        ? JSON.parse(program.workouts)
        : program.workouts;

      await generateAssignedWorkouts(
        data.id,
        input.athleteUserId,
        workouts as ProgramWorkout[],
        input.startDate
      );
    }

    // Update program assignment count
    await supabase
      .from('coach_programs')
      .update({ times_assigned: (program?.workouts as unknown as number || 0) + 1 })
      .eq('id', input.programId);

    return {
      data: mapToProgramAssignment(data),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachPrograms] assignProgram error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to assign program',
      success: false,
    };
  }
}

/**
 * Generate individual workout entries for an assignment
 */
async function generateAssignedWorkouts(
  assignmentId: string,
  athleteUserId: string,
  workouts: ProgramWorkout[],
  startDate: Date
): Promise<void> {
  const assignedWorkouts = workouts.map((workout) => {
    // Defensive bounds check for week/day - cap at reasonable values
    const week = Math.max(1, Math.min(workout.week || 1, 52)); // Max 52 weeks
    const day = Math.max(1, Math.min(workout.day || 1, 7));     // Max 7 days per week

    // Calculate scheduled date based on week and day
    const daysFromStart = (week - 1) * 7 + (day - 1);
    const scheduledDate = new Date(startDate);
    scheduledDate.setDate(scheduledDate.getDate() + daysFromStart);

    return {
      assignment_id: assignmentId,
      athlete_user_id: athleteUserId,
      scheduled_date: getLocalDateString(scheduledDate),
      scheduled_at: scheduledDate.toISOString(),
      week_number: week,
      day_number: day,
      workout_name: workout.name,
      exercises: JSON.stringify(workout.exercises),
      status: WorkoutStatus.PENDING,
    };
  });

  if (assignedWorkouts.length > 0) {
    await supabase
      .from('assigned_workouts')
      .insert(assignedWorkouts);
  }
}

/**
 * Get assignments for the current coach
 */
export async function getMyAssignments(
  status?: AssignmentStatus,
  page: number = 1,
  pageSize: number = 20
): Promise<ServiceResult<PaginatedResult<ProgramAssignment>>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const { data: coachProfile } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!coachProfile) {
      return { data: null, error: 'Coach profile not found', success: false };
    }

    const offset = (page - 1) * pageSize;

    let query = supabase
      .from('program_assignments')
      .select(`
        *,
        coach_programs (name)
      `, { count: 'exact' })
      .eq('coach_id', coachProfile.id);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query
      .order('start_date', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    return {
      data: {
        data: (data || []).map((d) => ({
          ...mapToProgramAssignment(d),
          programName: (d.coach_programs as Record<string, unknown>)?.name as string,
        })),
        total: count || 0,
        page,
        pageSize,
        hasMore: (count || 0) > offset + pageSize,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachPrograms] getMyAssignments error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get assignments',
      success: false,
    };
  }
}

/**
 * Get assignments for the current athlete
 */
export async function getAthleteAssignments(
  status?: AssignmentStatus
): Promise<ServiceResult<ProgramAssignment[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    let query = supabase
      .from('program_assignments')
      .select(`
        *,
        coach_programs (name)
      `)
      .eq('athlete_user_id', user.id);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('start_date', { ascending: false });

    if (error) throw error;

    return {
      data: (data || []).map((d) => ({
        ...mapToProgramAssignment(d),
        programName: (d.coach_programs as Record<string, unknown>)?.name as string,
      })),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachPrograms] getAthleteAssignments error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get assignments',
      success: false,
    };
  }
}

/**
 * Update assignment status
 */
export async function updateAssignmentStatus(
  assignmentId: string,
  status: AssignmentStatus
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('program_assignments')
      .update({ status })
      .eq('id', assignmentId);

    if (error) throw error;

    return { data: undefined, error: null, success: true };
  } catch (error) {
    console.error('[CoachPrograms] updateAssignmentStatus error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to update status',
      success: false,
    };
  }
}

// ============================================
// ASSIGNED WORKOUTS
// ============================================

/**
 * Get workouts for an assignment
 */
export async function getAssignedWorkouts(
  assignmentId: string
): Promise<ServiceResult<AssignedWorkout[]>> {
  try {
    const { data, error } = await supabase
      .from('assigned_workouts')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('scheduled_date', { ascending: true });

    if (error) throw error;

    return {
      data: (data || []).map(mapToAssignedWorkout),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachPrograms] getAssignedWorkouts error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get workouts',
      success: false,
    };
  }
}

/**
 * Get athlete's upcoming workouts
 */
export async function getUpcomingWorkouts(
  daysAhead: number = 7
): Promise<ServiceResult<AssignedWorkout[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const startDate = getLocalDateString(today);
    const endDate = getLocalDateString(futureDate);
    const { start } = getLocalDayBounds(today);
    const { end } = getLocalDayBounds(futureDate);

    const { data, error } = await supabase
      .from('assigned_workouts')
      .select('*')
      .eq('athlete_user_id', user.id)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .in('status', [WorkoutStatus.PENDING, WorkoutStatus.IN_PROGRESS])
      .order('scheduled_date', { ascending: true });

    if (error) throw error;

    const filtered = (data || []).filter((row) => {
      const scheduledAt = row.scheduled_at ? new Date(row.scheduled_at as string) : null;
      if (scheduledAt) {
        return scheduledAt >= start && scheduledAt < end;
      }
      return true;
    });

    return {
      data: filtered.map(mapToAssignedWorkout),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachPrograms] getUpcomingWorkouts error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get workouts',
      success: false,
    };
  }
}

/**
 * Get today's workouts for the athlete
 */
export async function getTodaysWorkouts(): Promise<ServiceResult<AssignedWorkout[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const today = new Date();
    const todayKey = getLocalDateString(today);
    const { start, end } = getLocalDayBounds(today);

    const { data, error } = await supabase
      .from('assigned_workouts')
      .select('*')
      .eq('athlete_user_id', user.id)
      .eq('scheduled_date', todayKey)
      .in('status', [WorkoutStatus.PENDING, WorkoutStatus.IN_PROGRESS])
      .order('scheduled_date', { ascending: true });

    if (error) throw error;

    const filtered = (data || []).filter((row) => {
      const scheduledAt = row.scheduled_at ? new Date(row.scheduled_at as string) : null;
      if (scheduledAt) {
        return scheduledAt >= start && scheduledAt < end;
      }
      return true;
    });

    return {
      data: filtered.map(mapToAssignedWorkout),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachPrograms] getTodaysWorkouts error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get workouts',
      success: false,
    };
  }
}

/**
 * Get overdue workouts for the athlete
 */
export async function getOverdueWorkouts(): Promise<ServiceResult<AssignedWorkout[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const today = new Date();
    const todayKey = getLocalDateString(today);
    const { start } = getLocalDayBounds(today);

    const { data, error } = await supabase
      .from('assigned_workouts')
      .select('*')
      .eq('athlete_user_id', user.id)
      .lt('scheduled_date', todayKey)
      .in('status', [WorkoutStatus.PENDING, WorkoutStatus.IN_PROGRESS])
      .order('scheduled_date', { ascending: false });

    if (error) throw error;

    const filtered = (data || []).filter((row) => {
      const scheduledAt = row.scheduled_at ? new Date(row.scheduled_at as string) : null;
      if (scheduledAt) {
        return scheduledAt < start;
      }
      return true;
    });

    return {
      data: filtered.map(mapToAssignedWorkout),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachPrograms] getOverdueWorkouts error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get overdue workouts',
      success: false,
    };
  }
}

/**
 * Start a workout (athlete)
 */
export async function startWorkout(workoutId: string): Promise<ServiceResult<AssignedWorkout>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('assigned_workouts')
      .update({
        status: WorkoutStatus.IN_PROGRESS,
        started_at: new Date().toISOString(),
      })
      .eq('id', workoutId)
      .is('started_at', null)
      .in('status', [WorkoutStatus.PENDING, WorkoutStatus.IN_PROGRESS])
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        const { data: existing, error: fetchError } = await supabase
          .from('assigned_workouts')
          .select('*')
          .eq('id', workoutId)
          .single();
        if (fetchError) throw fetchError;
        return {
          data: mapToAssignedWorkout(existing),
          error: null,
          success: true,
        };
      }
      throw error;
    }

    const workout = mapToAssignedWorkout(data);

    // Send notification to coach (fire and forget)
    if (user) {
      sendCoachNotification({
        type: 'workout_started',
        athleteUserId: user.id,
        athleteName: user.user_metadata?.full_name || 'Athlete',
        workoutId,
        workoutName: workout.workoutName,
      }).catch(err => console.error('[CoachPrograms] Notification error:', err));
    }

    return {
      data: workout,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachPrograms] startWorkout error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to start workout',
      success: false,
    };
  }
}

/**
 * Complete a workout with results (athlete)
 */
export async function completeWorkout(
  workoutId: string,
  results: Record<string, unknown>,
  feedback?: string,
  rating?: number
): Promise<ServiceResult<AssignedWorkout>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const completedAt = new Date();

    const { data, error } = await supabase
      .from('assigned_workouts')
      .update({
        status: WorkoutStatus.COMPLETED,
        completed_at: completedAt.toISOString(),
        actual_results: results,
        athlete_feedback: feedback,
        athlete_rating: rating,
      })
      .eq('id', workoutId)
      .select()
      .single();

    if (error) throw error;

    const workout = mapToAssignedWorkout(data);

    // Send notification to coach with PR summary (fire and forget)
    if (user && workout.startedAt) {
      (async () => {
        try {
          // Detect PRs from workout results
          const prs = await detectPRs(user.id, results as { exercises: Array<{ exerciseName: string; sets: Array<{ weight?: number; reps?: number; completed?: boolean }> }> });

          await sendCoachNotification({
            type: 'workout_completed',
            athleteUserId: user.id,
            athleteName: user.user_metadata?.full_name || 'Athlete',
            workoutId,
            workoutName: workout.workoutName,
            durationMinutes: calculateDuration(workout.startedAt!, completedAt),
            exerciseCount: (results as { exercises?: unknown[] }).exercises?.length || 0,
            totalSets: countTotalSets(results as any),
            prs,
            athleteRating: rating,
          });
        } catch (err) {
          console.error('[CoachPrograms] Notification error:', err);
        }
      })();
    }

    // Fire paths progression handler (fire and forget).
    // SAFETY: This is the ONLY call site for 'assigned' source. Idempotency is guaranteed
    // by processed_workouts unique constraint (user_id, workout_id, source). If called
    // multiple times, subsequent calls return { alreadyProcessed: true } with no side effects.
    if (user) {
      (async () => {
        try {
          const { buildWorkoutCompletedEvent, handleWorkoutCompleted } = await import('../paths/handle-workout-completed');

          // Build normalized event from results
          const resultsData = results as { exercises?: Array<{ exerciseName: string; sets: Array<{ weight?: number; reps?: number; completed?: boolean }> }> };
          const exercises = (resultsData.exercises ?? []).map(ex => ({
            name: ex.exerciseName,
            sets: ex.sets.map(s => ({
              weight: s.weight,
              reps: s.reps,
              isCompleted: s.completed ?? false,
            })),
          }));

          const event = buildWorkoutCompletedEvent({
            userId: user.id,
            workoutId, // assigned_workouts.id (UUID)
            source: 'assigned',
            originTable: 'assigned_workouts',
            completedAt,
            exercises,
          });

          const pathsResult = await handleWorkoutCompleted(event);
          if (pathsResult.xpGained > 0) {
            console.log(`[CoachPrograms] Paths: +${pathsResult.xpGained} XP, ${pathsResult.nodesCompleted.length} nodes completed`);
          }
        } catch (err) {
          console.error('[CoachPrograms] Paths progression error:', err);
        }
      })();
    }

    return {
      data: workout,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachPrograms] completeWorkout error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to complete workout',
      success: false,
    };
  }
}

// ============================================
// COACH NOTIFICATIONS
// ============================================

interface CoachNotificationPayload {
  type: 'workout_started' | 'workout_completed';
  athleteUserId: string;
  athleteName: string;
  workoutId: string;
  workoutName: string;
  programName?: string;
  durationMinutes?: number;
  exerciseCount?: number;
  totalSets?: number;
  prs?: PRRecord[];
  athleteRating?: number;
}

/**
 * Send notification to coach via edge function
 */
async function sendCoachNotification(payload: CoachNotificationPayload): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('send-coach-notification', {
      body: payload,
    });

    if (error) {
      console.error('[CoachPrograms] sendCoachNotification error:', error);
    } else {
      console.log('[CoachPrograms] Coach notification sent:', payload.type);
    }
  } catch (err) {
    console.error('[CoachPrograms] sendCoachNotification error:', err);
  }
}

/**
 * Skip a workout (athlete)
 */
export async function skipWorkout(
  workoutId: string,
  reasonCode: string,
  reasonText?: string
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('assigned_workouts')
      .update({
        status: WorkoutStatus.SKIPPED,
        skipped_reason_code: reasonCode,
        skipped_reason_text: reasonText || null,
        skipped_at: new Date().toISOString(),
      })
      .eq('id', workoutId);

    if (error) throw error;

    return { data: undefined, error: null, success: true };
  } catch (error) {
    console.error('[CoachPrograms] skipWorkout error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to skip workout',
      success: false,
    };
  }
}

/**
 * Add coach feedback to a workout
 */
export async function addCoachFeedback(
  workoutId: string,
  feedback: string
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('assigned_workouts')
      .update({ coach_feedback: feedback })
      .eq('id', workoutId);

    if (error) throw error;

    return { data: undefined, error: null, success: true };
  } catch (error) {
    console.error('[CoachPrograms] addCoachFeedback error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to add feedback',
      success: false,
    };
  }
}

// ============================================
// HELPERS
// ============================================

function mapToCoachProgram(data: Record<string, unknown>): CoachProgram {
  const workouts = data.workouts
    ? (typeof data.workouts === 'string' ? JSON.parse(data.workouts) : data.workouts)
    : [];

  return {
    id: data.id as string,
    coachId: data.coach_id as string,
    name: data.name as string,
    description: data.description as string | undefined,
    category: data.category as CoachProgram['category'],
    sport: data.sport as string | undefined,
    difficulty: data.difficulty as CoachProgram['difficulty'],
    durationWeeks: data.duration_weeks as number | undefined,
    daysPerWeek: data.days_per_week as number | undefined,
    workouts: workouts as ProgramWorkout[],
    isTemplate: data.is_template as boolean,
    isPublic: data.is_public as boolean,
    timesAssigned: data.times_assigned as number,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}

function mapToProgramAssignment(data: Record<string, unknown>): ProgramAssignment {
  return {
    id: data.id as string,
    programId: data.program_id as string,
    coachId: data.coach_id as string,
    athleteUserId: data.athlete_user_id as string,
    startDate: new Date(data.start_date as string),
    endDate: data.end_date ? new Date(data.end_date as string) : undefined,
    currentWeek: data.current_week as number,
    status: data.status as AssignmentStatus,
    modifications: (data.modifications as Record<string, unknown>) || {},
    coachNotes: data.coach_notes as string | undefined,
    athleteNotes: data.athlete_notes as string | undefined,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}

function mapToAssignedWorkout(data: Record<string, unknown>): AssignedWorkout {
  const exercises = data.exercises
    ? (typeof data.exercises === 'string' ? JSON.parse(data.exercises) : data.exercises)
    : [];

  return {
    id: data.id as string,
    assignmentId: data.assignment_id as string,
    athleteUserId: data.athlete_user_id as string,
    scheduledDate: new Date(data.scheduled_date as string),
    scheduledAt: data.scheduled_at ? new Date(data.scheduled_at as string) : undefined,
    scheduledTime: data.scheduled_time ? new Date(data.scheduled_time as string) : undefined,
    weekNumber: data.week_number as number,
    dayNumber: data.day_number as number,
    workoutName: data.workout_name as string,
    exercises,
    status: data.status as WorkoutStatus,
    startedAt: data.started_at ? new Date(data.started_at as string) : undefined,
    completedAt: data.completed_at ? new Date(data.completed_at as string) : undefined,
    skippedReasonCode: data.skipped_reason_code as string | undefined,
    skippedReasonText: data.skipped_reason_text as string | undefined,
    skippedAt: data.skipped_at ? new Date(data.skipped_at as string) : undefined,
    actualResults: (data.actual_results as Record<string, unknown>) || {},
    athleteFeedback: data.athlete_feedback as string | undefined,
    athleteRating: data.athlete_rating as number | undefined,
    coachFeedback: data.coach_feedback as string | undefined,
    reminderSent: data.reminder_sent as boolean | undefined,
    incompleteNotificationSent: data.incomplete_notification_sent as boolean | undefined,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}

// ============================================
// QUICK WORKOUTS
// ============================================

import type { ProgramExercise, QuickWorkout } from './types';

/**
 * Create a quick workout template
 */
export async function createQuickWorkout(
  name: string,
  exercises: ProgramExercise[],
  description?: string,
  estimatedDuration?: number
): Promise<ServiceResult<QuickWorkout>> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      return { success: false, error: 'Not authenticated', data: null };
    }

    // Get coach profile
    const { data: coachProfile, error: profileError } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('user_id', session.session.user.id)
      .single();

    if (profileError || !coachProfile) {
      return { success: false, error: 'Coach profile not found', data: null };
    }

    const { data, error } = await supabase
      .from('coach_quick_workouts')
      .insert({
        coach_id: coachProfile.id,
        name,
        description,
        exercises: JSON.stringify(exercises),
        estimated_duration: estimatedDuration,
        times_assigned: 0,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message, data: null };
    }

    return { success: true, data: mapToQuickWorkout(data), error: null };
  } catch (error) {
    return { success: false, error: 'Failed to create quick workout', data: null };
  }
}

/**
 * Get all quick workouts for the current coach
 */
export async function getMyQuickWorkouts(
  page: number = 1,
  pageSize: number = 20
): Promise<ServiceResult<PaginatedResult<QuickWorkout>>> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      return { success: false, error: 'Not authenticated', data: null };
    }

    // Get coach profile
    const { data: coachProfile, error: profileError } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('user_id', session.session.user.id)
      .single();

    if (profileError || !coachProfile) {
      return { success: false, error: 'Coach profile not found', data: null };
    }

    const offset = (page - 1) * pageSize;

    // Get count
    const { count } = await supabase
      .from('coach_quick_workouts')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', coachProfile.id);

    // Get data
    const { data, error } = await supabase
      .from('coach_quick_workouts')
      .select('*')
      .eq('coach_id', coachProfile.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return { success: false, error: error.message, data: null };
    }

    return {
      success: true,
      error: null,
      data: {
        data: (data || []).map(mapToQuickWorkout),
        total: count || 0,
        page,
        pageSize,
        hasMore: (count || 0) > offset + pageSize,
      },
    };
  } catch (error) {
    return { success: false, error: 'Failed to fetch quick workouts', data: null };
  }
}

/**
 * Assign a quick workout to one or more athletes
 */
export async function assignQuickWorkout(
  quickWorkoutId: string,
  athleteUserIds: string[],
  scheduledDate: Date,
  scheduledTime?: Date,
  coachNotes?: string
): Promise<ServiceResult<{ assignedCount: number }>> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      return { success: false, error: 'Not authenticated', data: null };
    }

    // Get coach profile
    const { data: coachProfile, error: profileError } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('user_id', session.session.user.id)
      .single();

    if (profileError || !coachProfile) {
      return { success: false, error: 'Coach profile not found', data: null };
    }

    // Create assignments for each athlete
    const assignments = athleteUserIds.map(athleteUserId => ({
      quick_workout_id: quickWorkoutId,
      coach_id: coachProfile.id,
      athlete_user_id: athleteUserId,
      scheduled_date: getLocalDateString(scheduledDate),
      scheduled_time: scheduledTime?.toISOString(),
      status: 'pending',
      coach_notes: coachNotes,
    }));

    const { data, error } = await supabase
      .from('quick_workout_assignments')
      .insert(assignments)
      .select();

    if (error) {
      return { success: false, error: error.message, data: null };
    }

    // Update times_assigned counter
    await supabase.rpc('increment_quick_workout_assigned', {
      workout_id: quickWorkoutId,
      increment_by: athleteUserIds.length,
    });

    return { success: true, data: { assignedCount: data?.length || 0 }, error: null };
  } catch (error) {
    return { success: false, error: 'Failed to assign quick workout', data: null };
  }
}

/**
 * Assign exercises directly as a quick workout (without saving to library first)
 */
export async function assignExercisesAsWorkout(
  workoutName: string,
  exercises: ProgramExercise[],
  athleteUserIds: string[],
  scheduledDate: Date,
  scheduledTime?: Date
): Promise<ServiceResult<{ assignedCount: number }>> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      return { success: false, error: 'Not authenticated', data: null };
    }

    // Get coach profile
    const { data: coachProfile, error: profileError } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('user_id', session.session.user.id)
      .single();

    if (profileError || !coachProfile) {
      return { success: false, error: 'Coach profile not found', data: null };
    }

    // Create assignment entries directly in assigned_workouts
    const workoutEntries = athleteUserIds.map(athleteUserId => ({
      assignment_id: null, // No program assignment
      athlete_user_id: athleteUserId,
      scheduled_date: getLocalDateString(scheduledDate),
      scheduled_at: scheduledDate.toISOString(),
      scheduled_time: scheduledTime?.toISOString(),
      week_number: 1,
      day_number: 1,
      workout_name: workoutName,
      exercises: JSON.stringify(exercises),
      status: 'pending',
    }));

    const { data, error } = await supabase
      .from('assigned_workouts')
      .insert(workoutEntries)
      .select();

    if (error) {
      return { success: false, error: error.message, data: null };
    }

    return { success: true, data: { assignedCount: data?.length || 0 }, error: null };
  } catch (error) {
    return { success: false, error: 'Failed to assign workout', data: null };
  }
}

/**
 * Get athlete's workouts for a date range (for calendar view)
 */
export async function getAthleteCalendarWorkouts(
  athleteUserId: string,
  startDate: Date,
  endDate: Date
): Promise<ServiceResult<AssignedWorkout[]>> {
  try {
    const { data, error } = await supabase
      .from('assigned_workouts')
      .select('*')
      .eq('athlete_user_id', athleteUserId)
      .gte('scheduled_date', getLocalDateString(startDate))
      .lte('scheduled_date', getLocalDateString(endDate))
      .order('scheduled_date', { ascending: true });

    if (error) {
      return { success: false, error: error.message, data: null };
    }

    return { success: true, data: (data || []).map(mapToAssignedWorkout), error: null };
  } catch (error) {
    return { success: false, error: 'Failed to fetch calendar workouts', data: null };
  }
}

// Helper to map quick workout from DB
function mapToQuickWorkout(data: Record<string, unknown>): QuickWorkout {
  const exercises = data.exercises
    ? (typeof data.exercises === 'string' ? JSON.parse(data.exercises) : data.exercises)
    : [];

  return {
    id: data.id as string,
    coachId: data.coach_id as string,
    name: data.name as string,
    description: data.description as string | undefined,
    exercises,
    estimatedDuration: data.estimated_duration as number | undefined,
    timesAssigned: data.times_assigned as number,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}
