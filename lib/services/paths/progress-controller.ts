/**
 * Progress Controller
 *
 * Pure, deterministic functions for paths progression.
 * No side effects - all I/O is handled by the handler layer.
 */

import type {
    NormalizedExercise,
    PathInstance,
    PlanDelta,
    ProgressResult,
    UserLiftStats,
    WorkoutCompletedEvent,
} from './types';
import { normalizeExerciseKey } from './types';

// ============================================
// E1RM CALCULATION
// ============================================

/**
 * Calculate estimated 1RM using Epley formula.
 * e1rm = weight × (1 + reps/30)
 */
export function calculateE1RM(weight: number, reps: number): number {
    if (weight <= 0 || reps <= 0) return 0;
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
}

/**
 * Calculate EWMA (Exponential Weighted Moving Average).
 * newEwma = alpha * newValue + (1 - alpha) * oldEwma
 */
export function calculateEWMA(
    newValue: number,
    oldEwma: number | null,
    alpha: number = 0.3
): number {
    if (oldEwma === null || oldEwma === 0) {
        return newValue;
    }
    return alpha * newValue + (1 - alpha) * oldEwma;
}

/**
 * Calculate volatility (standard deviation proxy).
 * Uses exponential moving deviation.
 */
export function calculateVolatility(
    newValue: number,
    ewma: number,
    oldVolatility: number | null,
    alpha: number = 0.3
): number {
    const deviation = Math.abs(newValue - ewma);
    if (oldVolatility === null || oldVolatility === 0) {
        return deviation;
    }
    return alpha * deviation + (1 - alpha) * oldVolatility;
}

// ============================================
// XP CALCULATION
// ============================================

const XP_PER_EXERCISE = 10;
const XP_PER_SET = 2;
const XP_COMPLETION_BONUS = 25;
const XP_PR_BONUS = 50;

/**
 * Calculate XP for a workout.
 */
export function calculateXP(exercises: NormalizedExercise[]): number {
    let xp = XP_COMPLETION_BONUS; // Base completion XP

    for (const exercise of exercises) {
        const completedSets = exercise.sets.filter(s => s.isCompleted).length;
        if (completedSets > 0) {
            xp += XP_PER_EXERCISE;
            xp += completedSets * XP_PER_SET;
        }
    }

    return xp;
}

// ============================================
// LIFT STATS UPDATE
// ============================================

/**
 * Update lift stats for a single exercise based on workout data.
 * Returns new stats or null if no valid sets.
 */
export function updateExerciseStats(
    exercise: NormalizedExercise,
    existingStats: UserLiftStats | null
): UserLiftStats | null {
    // Find best completed set (highest e1rm)
    let bestE1rm = 0;
    let bestWeight = 0;

    for (const set of exercise.sets) {
        if (!set.isCompleted || !set.weight || !set.reps) continue;

        const e1rm = calculateE1RM(set.weight, set.reps);
        if (e1rm > bestE1rm) {
            bestE1rm = e1rm;
            bestWeight = set.weight;
        }
    }

    // No valid sets found
    if (bestE1rm === 0) return null;

    const now = new Date();
    const oldE1rm = existingStats?.e1rmKg ?? null;
    const oldEwma = existingStats?.ewmaE1rmKg ?? null;
    const oldVolatility = existingStats?.volatility ?? null;

    const newEwma = calculateEWMA(bestE1rm, oldEwma);
    const newVolatility = calculateVolatility(bestE1rm, newEwma, oldVolatility);

    // Training max is typically 90% of e1rm
    const trainingMax = bestE1rm * 0.9;

    return {
        exerciseKey: exercise.exerciseKey,
        e1rmKg: bestE1rm,
        trainingMaxKg: trainingMax,
        ewmaE1rmKg: newEwma,
        volatility: newVolatility,
        updatedAt: now,
    };
}

// ============================================
// PLAN DELTA GENERATION
// ============================================

/**
 * Generate plan adaptation recommendations based on performance.
 */
export function generatePlanDeltas(
    exercises: NormalizedExercise[],
    oldStats: Map<string, UserLiftStats>,
    newStats: Map<string, UserLiftStats>
): PlanDelta[] {
    const deltas: PlanDelta[] = [];

    for (const exercise of exercises) {
        const key = exercise.exerciseKey;
        const oldStat = oldStats.get(key);
        const newStat = newStats.get(key);

        if (!newStat) continue;

        // No previous data - no recommendation
        if (!oldStat) {
            continue;
        }

        const oldE1rm = oldStat.e1rmKg ?? 0;
        const newE1rm = newStat.e1rmKg ?? 0;

        // Significant improvement (>5%) - suggest weight increase
        if (newE1rm > oldE1rm * 1.05) {
            deltas.push({
                type: 'increase_weight',
                exerciseKey: key,
                reason: `E1RM improved from ${oldE1rm.toFixed(1)} to ${newE1rm.toFixed(1)}`,
                suggestedValue: Math.ceil((newStat.trainingMaxKg ?? 0) / 2.5) * 2.5, // Round to 2.5
            });
        }
        // Significant regression (>10%) - suggest weight decrease
        else if (newE1rm < oldE1rm * 0.9) {
            deltas.push({
                type: 'decrease_weight',
                exerciseKey: key,
                reason: `E1RM dropped from ${oldE1rm.toFixed(1)} to ${newE1rm.toFixed(1)}`,
                suggestedValue: Math.floor((newStat.trainingMaxKg ?? 0) * 0.9 / 2.5) * 2.5,
            });
        }
    }

    // If no specific recommendations, add a "none" delta
    if (deltas.length === 0) {
        deltas.push({
            type: 'none',
            reason: 'Training on track, no adjustments needed',
        });
    }

    return deltas;
}

// ============================================
// NODE COMPLETION CHECK
// ============================================

/**
 * Check if a node should be unlocked based on completed prerequisites.
 */
export function shouldUnlockNode(
    nodeId: string,
    prerequisiteNodeIds: string[],
    completedNodes: Set<string>
): boolean {
    return prerequisiteNodeIds.every(prereq => completedNodes.has(prereq));
}

/**
 * Determine which nodes are completed by this workout.
 * For now, simple: complete one workout = complete current available node.
 */
export function findCompletedNodes(
    pathInstance: PathInstance | null,
    currentNodeProgress: Map<string, string>, // nodeId -> status
): string[] {
    if (!pathInstance) return [];

    const completedNodes: string[] = [];

    // Find the first 'available' node and mark it completed
    for (const [nodeId, status] of currentNodeProgress) {
        if (status === 'available') {
            completedNodes.push(nodeId);
            break; // Only complete one node per workout
        }
    }

    return completedNodes;
}

// ============================================
// MAIN PURE FUNCTION
// ============================================

/**
 * Process a workout completion event.
 * Pure function - no side effects.
 *
 * @param event - The normalized workout event
 * @param existingLiftStats - Current lift stats for the user
 * @param activePathInstance - User's active path instance (if any)
 * @param currentNodeProgress - Current node progress map
 * @param processedWorkoutIds - Set of already processed workout IDs
 */
export function processWorkoutCompleted(
    event: WorkoutCompletedEvent,
    existingLiftStats: Map<string, UserLiftStats>,
    activePathInstance: PathInstance | null,
    currentNodeProgress: Map<string, string>,
    processedWorkoutIds: Set<string>
): ProgressResult {
    // Build idempotency key
    const idempotencyKey = `${event.userId}_${event.workoutId}_${event.source}`;

    // Check if already processed
    if (processedWorkoutIds.has(idempotencyKey)) {
        return {
            updatedStats: new Map(),
            nodesCompleted: [],
            planDeltas: [],
            xpGained: 0,
            alreadyProcessed: true,
        };
    }

    // 1. Calculate XP
    const xpGained = calculateXP(event.exercises);

    // 2. Update lift stats for each exercise
    const updatedStats = new Map<string, UserLiftStats>();
    for (const exercise of event.exercises) {
        const key = normalizeExerciseKey(exercise.exerciseName);
        const existingStat = existingLiftStats.get(key) ?? null;

        // Ensure exerciseKey is set
        const normalizedExercise = {
            ...exercise,
            exerciseKey: key,
        };

        const newStat = updateExerciseStats(normalizedExercise, existingStat);
        if (newStat) {
            updatedStats.set(key, newStat);
        }
    }

    // 3. Generate plan deltas
    const planDeltas = generatePlanDeltas(
        event.exercises,
        existingLiftStats,
        updatedStats
    );

    // 4. Find completed nodes
    const nodesCompleted = findCompletedNodes(activePathInstance, currentNodeProgress);

    return {
        updatedStats,
        nodesCompleted,
        planDeltas,
        xpGained,
        alreadyProcessed: false,
    };
}

// ============================================
// EXPORTS FOR TESTING
// ============================================

export {
    calculateE1RM as _calculateE1RM,
    calculateEWMA as _calculateEWMA,
    calculateVolatility as _calculateVolatility,
    calculateXP as _calculateXP
};

