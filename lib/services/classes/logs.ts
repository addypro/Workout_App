/**
 * Class Workout Logs Service
 *
 * Operations for managing workout logs after class completion.
 * Handles auto-log creation, athlete review, and auto-complete.
 */

import { isFeatureEnabled } from '../../config/feature-flags';
import { supabase } from '../../supabase/client';
import type {
    ClassExercise,
    ClassParticipantPlan,
    ClassPlanSource,
    ClassWorkoutLog,
    ClassWorkoutLogStatus,
    ServiceResult,
} from './types';

// ============================================
// WORKOUT LOGS
// ============================================

/**
 * Create workout logs for all checked-in athletes (called when class ends)
 */
export async function createLogsForCheckedInAthletes(
    sessionId: string,
    exercisesJson: ClassExercise[]
): Promise<ServiceResult<ClassWorkoutLog[]>> {
    try {
        // Get all checked-in athletes
        const { data: checkins, error: checkinError } = await supabase
            .from('class_checkins')
            .select('athlete_user_id')
            .eq('session_id', sessionId);

        if (checkinError) {
            console.error('[ClassLogs] Get checkins error:', checkinError);
            return { data: null, error: checkinError.message };
        }

        if (!checkins || checkins.length === 0) {
            return { data: [], error: null };
        }

        // Create logs for each athlete
        const logsToInsert = checkins.map((c) => ({
            session_id: sessionId,
            athlete_user_id: c.athlete_user_id,
            exercises_json: exercisesJson,
            status: 'pending_review',
        }));

        const { data, error } = await supabase
            .from('class_workout_logs')
            .insert(logsToInsert)
            .select();

        if (error) {
            console.error('[ClassLogs] Create logs error:', error);
            return { data: null, error: error.message };
        }

        return { data: (data ?? []).map(mapDbToLog), error: null };
    } catch (e: any) {
        console.error('[ClassLogs] Create logs exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Get pending review logs for an athlete
 */
export async function getMyPendingReviewLogs(): Promise<ServiceResult<ClassWorkoutLog[]>> {
    // Graceful degradation when feature is disabled
    if (!isFeatureEnabled('workout_classes')) {
        return { data: [], error: null };
    }

    try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user?.id) {
            return { data: [], error: null }; // Return empty for guest users
        }

        const { data, error } = await supabase
            .from('class_workout_logs')
            .select('*')
            .eq('athlete_user_id', user.user.id)
            .eq('status', 'pending_review')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[ClassLogs] Get pending error:', error);
            return { data: null, error: error.message };
        }

        return { data: (data ?? []).map(mapDbToLog), error: null };
    } catch (e: any) {
        console.error('[ClassLogs] Get pending exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Get a workout log by ID
 */
export async function getClassWorkoutLog(
    logId: string
): Promise<ServiceResult<ClassWorkoutLog>> {
    try {
        const { data, error } = await supabase
            .from('class_workout_logs')
            .select('*')
            .eq('id', logId)
            .single();

        if (error) {
            console.error('[ClassLogs] Get log error:', error);
            return { data: null, error: error.message };
        }

        return { data: mapDbToLog(data), error: null };
    } catch (e: any) {
        console.error('[ClassLogs] Get log exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Review and complete a workout log (athlete)
 */
export async function reviewWorkoutLog(
    logId: string,
    exercisesJson: ClassExercise[],
    feedback?: string,
    rating?: number
): Promise<ServiceResult<ClassWorkoutLog>> {
    try {
        const { data, error } = await supabase
            .from('class_workout_logs')
            .update({
                exercises_json: exercisesJson,
                status: 'reviewed',
                reviewed_at: new Date().toISOString(),
                athlete_feedback: feedback,
                athlete_rating: rating,
            })
            .eq('id', logId)
            .select()
            .single();

        if (error) {
            console.error('[ClassLogs] Review error:', error);
            return { data: null, error: error.message };
        }

        return { data: mapDbToLog(data), error: null };
    } catch (e: any) {
        console.error('[ClassLogs] Review exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Auto-complete logs that weren't reviewed (called by cron after 24h)
 */
export async function autoCompleteLogs(
    sessionId: string
): Promise<ServiceResult<number>> {
    try {
        const { data, error } = await supabase
            .from('class_workout_logs')
            .update({
                status: 'auto_completed',
                auto_completed_at: new Date().toISOString(),
            })
            .eq('session_id', sessionId)
            .eq('status', 'pending_review')
            .select('id');

        if (error) {
            console.error('[ClassLogs] Auto-complete error:', error);
            return { data: null, error: error.message };
        }

        return { data: data?.length ?? 0, error: null };
    } catch (e: any) {
        console.error('[ClassLogs] Auto-complete exception:', e);
        return { data: null, error: e.message };
    }
}

// ============================================
// PARTICIPANT PLANS (Prefill)
// ============================================

/**
 * Get or create a participant plan (prefill logic)
 */
export async function getOrCreateParticipantPlan(
    sessionId: string,
    athleteUserId: string
): Promise<ServiceResult<ClassParticipantPlan>> {
    try {
        // Check if plan already exists
        const { data: existing } = await supabase
            .from('class_participant_plans')
            .select('*')
            .eq('session_id', sessionId)
            .eq('athlete_user_id', athleteUserId)
            .maybeSingle();

        if (existing) {
            return { data: mapDbToPlan(existing), error: null };
        }

        // Get session exercises as default
        const { data: session } = await supabase
            .from('class_sessions')
            .select('exercises_json, template_id')
            .eq('id', sessionId)
            .single();

        if (!session) {
            return { data: null, error: 'Session not found' };
        }

        // TODO: Implement full prefill logic:
        // 1. Check for coach override
        // 2. Check previous class plan for same template
        // 3. Check athlete history
        // 4. Fall back to session default

        const { data, error } = await supabase
            .from('class_participant_plans')
            .insert({
                session_id: sessionId,
                athlete_user_id: athleteUserId,
                planned_exercises_json: session.exercises_json,
                source: 'default',
            })
            .select()
            .single();

        if (error) {
            console.error('[ClassLogs] Create plan error:', error);
            return { data: null, error: error.message };
        }

        return { data: mapDbToPlan(data), error: null };
    } catch (e: any) {
        console.error('[ClassLogs] Create plan exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Update participant plan (coach override)
 */
export async function updateParticipantPlan(
    sessionId: string,
    athleteUserId: string,
    exercisesJson: ClassExercise[],
    coachNotes?: string
): Promise<ServiceResult<ClassParticipantPlan>> {
    try {
        // Get current plan
        const { data: existing } = await supabase
            .from('class_participant_plans')
            .select('plan_version')
            .eq('session_id', sessionId)
            .eq('athlete_user_id', athleteUserId)
            .maybeSingle();

        const { data, error } = await supabase
            .from('class_participant_plans')
            .upsert({
                session_id: sessionId,
                athlete_user_id: athleteUserId,
                planned_exercises_json: exercisesJson,
                source: 'coach_override',
                coach_notes: coachNotes,
                plan_version: (existing?.plan_version ?? 0) + 1,
            })
            .select()
            .single();

        if (error) {
            console.error('[ClassLogs] Update plan error:', error);
            return { data: null, error: error.message };
        }

        return { data: mapDbToPlan(data), error: null };
    } catch (e: any) {
        console.error('[ClassLogs] Update plan exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Get all plans for a session (coach view)
 */
export async function getSessionPlans(
    sessionId: string
): Promise<ServiceResult<ClassParticipantPlan[]>> {
    try {
        const { data, error } = await supabase
            .from('class_participant_plans')
            .select('*')
            .eq('session_id', sessionId);

        if (error) {
            console.error('[ClassLogs] Get plans error:', error);
            return { data: null, error: error.message };
        }

        return { data: (data ?? []).map(mapDbToPlan), error: null };
    } catch (e: any) {
        console.error('[ClassLogs] Get plans exception:', e);
        return { data: null, error: e.message };
    }
}

// ============================================
// HELPERS
// ============================================

function mapDbToLog(row: any): ClassWorkoutLog {
    return {
        id: row.id,
        sessionId: row.session_id,
        athleteUserId: row.athlete_user_id,
        exercisesJson: row.exercises_json as ClassExercise[],
        status: row.status as ClassWorkoutLogStatus,
        reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
        autoCompletedAt: row.auto_completed_at ? new Date(row.auto_completed_at) : undefined,
        athleteFeedback: row.athlete_feedback,
        athleteRating: row.athlete_rating,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}

function mapDbToPlan(row: any): ClassParticipantPlan {
    return {
        id: row.id,
        sessionId: row.session_id,
        athleteUserId: row.athlete_user_id,
        plannedExercisesJson: row.planned_exercises_json as ClassExercise[],
        source: row.source as ClassPlanSource,
        planVersion: row.plan_version ?? 1,
        coachNotes: row.coach_notes,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}
