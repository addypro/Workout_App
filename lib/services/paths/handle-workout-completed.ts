/**
 * Handle Workout Completed
 *
 * Shared handler called from both completion flows.
 * Implements offline-first with DB-level idempotency.
 *
 * Flow:
 * 1. Try INSERT processed_workouts (idempotency check)
 * 2. If conflict: return cached last result
 * 3. If new: compute progress, cache FIRST, then Supabase
 * 4. On Supabase failure: enqueue for later sync
 */

import { isFeatureEnabled } from '@/lib/config/feature-flags';
import {
    addProcessedWorkoutCache,
    getLastResultCache,
    getLiftStatsCache,
    getPathProgressCache,
    getProcessedWorkoutsCache,
    mergeLiftStatsCache,
    setLastResultCache,
    updatePathProgressCache,
    type CachedLastResult,
} from '../offline/paths-cache';
import { enqueuePathsSync } from '../sync/paths-sync';
import { STARTER_PATH } from './catalog';
import { processWorkoutCompleted } from './progress-controller';
import {
    createPathInstance,
    getActivePathInstance,
    getLiftStats,
    getNodeProgress,
    insertPlanDelta,
    insertProcessedWorkout,
    updateProcessedWorkoutXP,
    upsertLiftStats,
    upsertNodeProgress,
} from './storage';
import type {
    NormalizedExercise,
    PathInstance,
    PlanDelta,
    ProgressResult,
    UserLiftStats,
    WorkoutCompletedEvent,
    WorkoutSource,
} from './types';
import { normalizeExerciseKey } from './types';
import { applyProgression, type ProgressionUpdateInput } from './weight-suggestion';

// ============================================
// RESULT TYPE
// ============================================

export interface HandleWorkoutResult {
    success: boolean;
    alreadyProcessed: boolean;
    xpGained: number;
    nodesCompleted: string[];
    planDelta: PlanDelta | null;
    error?: string;
}

// ============================================
// MAIN HANDLER
// ============================================

/**
 * Handle a workout completion event.
 *
 * Called from:
 * - lib/services/coach/programs.ts (completeWorkout)
 * - lib/services/sync/workout-sync.ts (syncWorkoutToServer)
 */
export async function handleWorkoutCompleted(
    event: WorkoutCompletedEvent
): Promise<HandleWorkoutResult> {
    const { userId, workoutId, source } = event;

    try {
        // ============================================
        // 1. DB-LEVEL IDEMPOTENCY CHECK
        // ============================================
        const insertResult = await insertProcessedWorkout(userId, workoutId, source);

        if (insertResult.error) {
            // Network error - check local cache
            const cachedResult = await getLastResultCache(workoutId, source);
            if (cachedResult) {
                return {
                    success: true,
                    alreadyProcessed: true,
                    xpGained: cachedResult.xpGained,
                    nodesCompleted: cachedResult.nodesCompleted,
                    planDelta: cachedResult.planDelta,
                };
            }
            // No cache, still process locally
            console.warn('[HandleWorkout] DB check failed, processing locally:', insertResult.error);
        } else if (!insertResult.data?.inserted) {
            // Already processed in DB - return cached result
            const cachedResult = await getLastResultCache(workoutId, source);
            if (cachedResult) {
                return {
                    success: true,
                    alreadyProcessed: true,
                    xpGained: cachedResult.xpGained,
                    nodesCompleted: cachedResult.nodesCompleted,
                    planDelta: cachedResult.planDelta,
                };
            }
            // No cache but DB says processed
            return {
                success: true,
                alreadyProcessed: true,
                xpGained: 0,
                nodesCompleted: [],
                planDelta: null,
            };
        }

        // ============================================
        // 2. LOAD EXISTING STATE
        // ============================================

        // Get existing lift stats (try cache first, fallback to DB)
        let existingStats = new Map<string, UserLiftStats>();
        const cachedStats = await getLiftStatsCache(userId);
        if (cachedStats) {
            for (const [key, val] of Object.entries(cachedStats.stats)) {
                existingStats.set(key, {
                    ...val,
                    updatedAt: new Date(val.updatedAt as any),
                });
            }
        } else {
            const dbStats = await getLiftStats(userId);
            if (dbStats.data) {
                existingStats = dbStats.data;
            }
        }

        // Get active path instance (auto-create if none)
        let activePathInstance: PathInstance | null = null;
        let nodeProgress = new Map<string, string>();

        const cachedProgress = await getPathProgressCache(userId);
        if (cachedProgress?.pathInstance) {
            activePathInstance = cachedProgress.pathInstance;
            nodeProgress = new Map(Object.entries(cachedProgress.nodeProgress));
        } else {
            const dbPath = await getActivePathInstance(userId);
            if (dbPath.data) {
                activePathInstance = dbPath.data;
                const dbNodeProgress = await getNodeProgress(activePathInstance.id);
                if (dbNodeProgress.data) {
                    nodeProgress = dbNodeProgress.data;
                }
            } else {
                // Auto-create default path
                const createResult = await createPathInstance(userId, STARTER_PATH.id);
                if (createResult.data) {
                    activePathInstance = createResult.data;
                    // Initialize node progress with first node available
                    if (STARTER_PATH.nodes.length > 0) {
                        nodeProgress.set(STARTER_PATH.nodes[0].id, 'available');
                    }
                }
            }
        }

        // Get processed workout IDs from cache
        const processedIds = await getProcessedWorkoutsCache(userId);

        // ============================================
        // 3. COMPUTE PROGRESS (Pure function)
        // ============================================

        const result = processWorkoutCompleted(
            event,
            existingStats,
            activePathInstance,
            nodeProgress,
            processedIds
        );

        // Extract first plan delta (if any)
        const planDelta = result.planDeltas.length > 0 ? result.planDeltas[0] : null;

        // ============================================
        // 4. CACHE FIRST (Offline-first)
        // ============================================

        // Add to processed set
        await addProcessedWorkoutCache(userId, workoutId, source);

        // Merge lift stats
        await mergeLiftStatsCache(userId, result.updatedStats);

        // Update path progress
        await updatePathProgressCache(
            userId,
            result.xpGained,
            result.nodesCompleted,
            activePathInstance ?? undefined
        );

        // Cache last result for idempotent returns
        const lastResult: CachedLastResult = {
            xpGained: result.xpGained,
            nodesCompleted: result.nodesCompleted,
            planDelta,
            processedAt: new Date().toISOString(),
        };
        await setLastResultCache(workoutId, source, lastResult);

        // ============================================
        // 4.5. WEIGHT SUGGESTION UPDATES (Feature Gated)
        // ============================================
        if (isFeatureEnabled('weight_suggestions')) {
            try {
                // Process each exercise through the weight suggestion engine
                for (const exercise of event.exercises) {
                    const input: ProgressionUpdateInput = {
                        exerciseKey: exercise.exerciseKey,
                        exerciseName: exercise.exerciseName,
                        exerciseKind: 'strength', // Default, could be enhanced with exercise metadata
                        progressionProfile: 'LINEAR_LP', // Default, could come from program
                        completedSets: exercise.sets,
                        previousStats: existingStats.get(exercise.exerciseKey) ?? null,
                        preferredUnit: 'lbs', // TODO: Get from user preferences
                    };
                    const progressionResult = applyProgression(input);
                    if (progressionResult) {
                        console.log(`[WeightSuggestion] ${exercise.exerciseName}: ${progressionResult.note}`);
                    }
                }
            } catch (e) {
                // Zero-impact: log warning and continue
                console.warn('[WeightSuggestion] Failed to process progression updates:', e);
            }
        }

        // ============================================
        // 5. SUPABASE WRITES (with queue fallback)
        // ============================================

        const supabaseSuccess = await writeToSupabase(
            userId,
            workoutId,
            source,
            result,
            activePathInstance,
            planDelta
        );

        if (!supabaseSuccess) {
            // Enqueue for later retry
            await enqueuePathsSync({
                userId,
                workoutId,
                source,
                xpAwarded: result.xpGained,
                updatedStats: Object.fromEntries(
                    [...result.updatedStats.entries()].map(([k, v]) => [k, { ...v, updatedAt: v.updatedAt.toISOString() }])
                ),
                nodesCompleted: result.nodesCompleted,
                pathInstanceId: activePathInstance?.id ?? null,
                planDelta,
            });
        }

        return {
            success: true,
            alreadyProcessed: false,
            xpGained: result.xpGained,
            nodesCompleted: result.nodesCompleted,
            planDelta,
        };
    } catch (error: any) {
        console.error('[HandleWorkout] Error:', error);
        return {
            success: false,
            alreadyProcessed: false,
            xpGained: 0,
            nodesCompleted: [],
            planDelta: null,
            error: error.message,
        };
    }
}

// ============================================
// SUPABASE WRITES
// ============================================

async function writeToSupabase(
    userId: string,
    workoutId: string,
    source: WorkoutSource,
    result: ProgressResult,
    activePathInstance: PathInstance | null,
    planDelta: PlanDelta | null
): Promise<boolean> {
    try {
        // 1. Update XP awarded
        const xpResult = await updateProcessedWorkoutXP(userId, workoutId, source, result.xpGained);
        if (xpResult.error) {
            console.error('[HandleWorkout] Failed to update XP:', xpResult.error);
            return false;
        }

        // 2. Upsert lift stats
        const statsResult = await upsertLiftStats(userId, result.updatedStats);
        if (statsResult.error) {
            console.error('[HandleWorkout] Failed to upsert lift stats:', statsResult.error);
            return false;
        }

        // 3. Upsert node progress
        if (activePathInstance && result.nodesCompleted.length > 0) {
            const nodeResult = await upsertNodeProgress(userId, activePathInstance.id, result.nodesCompleted);
            if (nodeResult.error) {
                console.error('[HandleWorkout] Failed to upsert node progress:', nodeResult.error);
                return false;
            }
        }

        // 4. Insert plan delta (skip for local workouts - they get queued for PathsSync)
        // Local workouts have 'hist-*' IDs, but plan_deltas.workout_id expects UUID
        if (planDelta && planDelta.type !== 'none') {
            const isLocalWorkout = workoutId.startsWith('hist-');
            if (isLocalWorkout) {
                console.log('[HandleWorkout] Skipping plan delta insert for local workout (will sync later)');
            } else {
                const deltaResult = await insertPlanDelta(userId, workoutId, source, planDelta);
                if (deltaResult.error) {
                    console.error('[HandleWorkout] Failed to insert plan delta:', deltaResult.error);
                    return false;
                }
            }
        }

        return true;
    } catch (error) {
        console.error('[HandleWorkout] Supabase write error:', error);
        return false;
    }
}

// ============================================
// BUILDER HELPER
// ============================================

/**
 * Build a WorkoutCompletedEvent from raw workout data.
 * Normalizes exercise keys for consistency.
 */
export function buildWorkoutCompletedEvent(params: {
    userId: string;
    workoutId: string;
    source: WorkoutSource;
    originTable: 'assigned_workouts' | 'workout_logs';
    completedAt: Date;
    exercises: Array<{
        name: string;
        sets: Array<{
            weight?: number;
            reps?: number;
            isCompleted: boolean;
            rpe?: number;
            rir?: number;
        }>;
    }>;
}): WorkoutCompletedEvent {
    const normalizedExercises: NormalizedExercise[] = params.exercises.map(ex => ({
        exerciseKey: normalizeExerciseKey(ex.name),
        exerciseName: ex.name,
        sets: ex.sets,
    }));

    return {
        userId: params.userId,
        workoutId: params.workoutId,
        source: params.source,
        originTable: params.originTable,
        completedAt: params.completedAt,
        exercises: normalizedExercises,
    };
}
