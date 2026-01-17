/**
 * Paths Storage Service
 *
 * Supabase CRUD for paths progression tables.
 * Follows ServiceResult pattern from coach services.
 */

import { supabase } from '@/lib/supabase/client';

import type {
    PathInstance,
    PlanDelta,
    UserLiftStats,
    WorkoutSource,
} from '../paths/types';

// ============================================
// SERVICE RESULT TYPE
// ============================================

export interface ServiceResult<T> {
    data: T | null;
    error: string | null;
}

// ============================================
// SNAKE_CASE / CAMELCASE MAPPERS
// ============================================

function liftStatsToDb(stats: UserLiftStats, userId: string) {
    return {
        user_id: userId,
        exercise_key: stats.exerciseKey,
        e1rm_kg: stats.e1rmKg,
        training_max_kg: stats.trainingMaxKg,
        ewma_e1rm_kg: stats.ewmaE1rmKg,
        volatility: stats.volatility,
        updated_at: stats.updatedAt.toISOString(),
    };
}

function liftStatsFromDb(row: any): UserLiftStats {
    return {
        exerciseKey: row.exercise_key,
        e1rmKg: row.e1rm_kg,
        trainingMaxKg: row.training_max_kg,
        ewmaE1rmKg: row.ewma_e1rm_kg,
        volatility: row.volatility,
        updatedAt: new Date(row.updated_at),
    };
}

function pathInstanceFromDb(row: any): PathInstance {
    return {
        id: row.id,
        userId: row.user_id,
        pathId: row.path_id,
        challengeId: row.challenge_id,
        tier: row.tier,
        status: row.status,
        startedAt: new Date(row.started_at),
        updatedAt: new Date(row.updated_at),
        configJson: row.config_json ?? {},
    };
}

// ============================================
// PROCESSED WORKOUTS (Idempotency)
// ============================================

/**
 * Attempt to insert into processed_workouts.
 * Returns { inserted: true } if new, { inserted: false } if already exists.
 */
export async function insertProcessedWorkout(
    userId: string,
    workoutId: string,
    source: WorkoutSource
): Promise<ServiceResult<{ inserted: boolean }>> {
    try {
        const { error } = await supabase
            .from('processed_workouts')
            .insert({
                user_id: userId,
                workout_id: workoutId,
                source,
                xp_awarded: 0,
            });

        if (error) {
            // Check for unique constraint violation
            if (error.code === '23505') {
                return { data: { inserted: false }, error: null };
            }
            return { data: null, error: error.message };
        }

        return { data: { inserted: true }, error: null };
    } catch (err: any) {
        return { data: null, error: err.message };
    }
}

/**
 * Update XP awarded after successful processing.
 */
export async function updateProcessedWorkoutXP(
    userId: string,
    workoutId: string,
    source: WorkoutSource,
    xpAwarded: number
): Promise<ServiceResult<void>> {
    try {
        const { error } = await supabase
            .from('processed_workouts')
            .update({ xp_awarded: xpAwarded })
            .eq('user_id', userId)
            .eq('workout_id', workoutId)
            .eq('source', source);

        if (error) {
            return { data: null, error: error.message };
        }

        return { data: undefined, error: null };
    } catch (err: any) {
        return { data: null, error: err.message };
    }
}

// ============================================
// LIFT STATS
// ============================================

/**
 * Get all lift stats for a user.
 */
export async function getLiftStats(userId: string): Promise<ServiceResult<Map<string, UserLiftStats>>> {
    try {
        const { data, error } = await supabase
            .from('lift_stats')
            .select('*')
            .eq('user_id', userId);

        if (error) {
            return { data: null, error: error.message };
        }

        const stats = new Map<string, UserLiftStats>();
        for (const row of data ?? []) {
            const stat = liftStatsFromDb(row);
            stats.set(stat.exerciseKey, stat);
        }

        return { data: stats, error: null };
    } catch (err: any) {
        return { data: null, error: err.message };
    }
}

/**
 * Upsert lift stats for multiple exercises.
 */
export async function upsertLiftStats(
    userId: string,
    stats: Map<string, UserLiftStats>
): Promise<ServiceResult<void>> {
    if (stats.size === 0) {
        return { data: undefined, error: null };
    }

    try {
        const rows = [...stats.values()].map(s => liftStatsToDb(s, userId));

        const { error } = await supabase
            .from('lift_stats')
            .upsert(rows, { onConflict: 'user_id,exercise_key' });

        if (error) {
            return { data: null, error: error.message };
        }

        return { data: undefined, error: null };
    } catch (err: any) {
        return { data: null, error: err.message };
    }
}

// ============================================
// PATH INSTANCES
// ============================================

/**
 * Get active path instance for a user.
 */
export async function getActivePathInstance(userId: string): Promise<ServiceResult<PathInstance | null>> {
    try {
        const { data, error } = await supabase
            .from('user_path_instances')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single();

        if (error) {
            // No active path is not an error
            if (error.code === 'PGRST116') {
                return { data: null, error: null };
            }
            return { data: null, error: error.message };
        }

        return { data: pathInstanceFromDb(data), error: null };
    } catch (err: any) {
        return { data: null, error: err.message };
    }
}

/**
 * Create a new path instance.
 */
export async function createPathInstance(
    userId: string,
    pathId: string,
    challengeId?: string
): Promise<ServiceResult<PathInstance>> {
    try {
        const { data, error } = await supabase
            .from('user_path_instances')
            .insert({
                user_id: userId,
                path_id: pathId,
                challenge_id: challengeId ?? null,
                tier: 'base',
                status: 'active',
            })
            .select()
            .single();

        if (error) {
            return { data: null, error: error.message };
        }

        return { data: pathInstanceFromDb(data), error: null };
    } catch (err: any) {
        return { data: null, error: err.message };
    }
}

// ============================================
// NODE PROGRESS
// ============================================

/**
 * Get node progress for a path instance.
 */
export async function getNodeProgress(
    pathInstanceId: string
): Promise<ServiceResult<Map<string, string>>> {
    try {
        const { data, error } = await supabase
            .from('user_path_node_progress')
            .select('node_id, status')
            .eq('path_instance_id', pathInstanceId);

        if (error) {
            return { data: null, error: error.message };
        }

        const progress = new Map<string, string>();
        for (const row of data ?? []) {
            progress.set(row.node_id, row.status);
        }

        return { data: progress, error: null };
    } catch (err: any) {
        return { data: null, error: err.message };
    }
}

/**
 * Upsert node progress for completed nodes.
 */
export async function upsertNodeProgress(
    userId: string,
    pathInstanceId: string,
    nodesCompleted: string[]
): Promise<ServiceResult<void>> {
    if (nodesCompleted.length === 0) {
        return { data: undefined, error: null };
    }

    try {
        const rows = nodesCompleted.map(nodeId => ({
            user_id: userId,
            path_instance_id: pathInstanceId,
            node_id: nodeId,
            status: 'completed',
            completed_at: new Date().toISOString(),
        }));

        const { error } = await supabase
            .from('user_path_node_progress')
            .upsert(rows, { onConflict: 'path_instance_id,node_id' });

        if (error) {
            return { data: null, error: error.message };
        }

        return { data: undefined, error: null };
    } catch (err: any) {
        return { data: null, error: err.message };
    }
}

// ============================================
// PLAN DELTAS
// ============================================

/**
 * Insert a plan delta.
 */
export async function insertPlanDelta(
    userId: string,
    workoutId: string,
    source: WorkoutSource,
    delta: PlanDelta
): Promise<ServiceResult<void>> {
    try {
        const { error } = await supabase
            .from('plan_deltas')
            .insert({
                user_id: userId,
                workout_id: workoutId,
                source,
                delta_json: delta,
            });

        if (error) {
            // Ignore unique constraint violation (idempotency)
            if (error.code === '23505') {
                return { data: undefined, error: null };
            }
            return { data: null, error: error.message };
        }

        return { data: undefined, error: null };
    } catch (err: any) {
        return { data: null, error: err.message };
    }
}
