/**
 * PR Detector Service
 *
 * Detects Personal Records (PRs) by comparing current workout results
 * with historical data. Tracks weight PRs, volume PRs, and rep PRs.
 */

import { supabase } from '@/lib/supabase/client';
import type { PRRecord } from '../notifications/types';

// ============================================
// TYPES
// ============================================

interface ExerciseResult {
    exerciseName: string;
    sets: Array<{
        weight?: number;
        reps?: number | string;
        completed?: boolean;
    }>;
}

interface WorkoutResults {
    exercises: ExerciseResult[];
}

interface HistoricalPR {
    exerciseName: string;
    maxWeight: number;
    maxVolume: number;
    maxReps: number;
}

// ============================================
// PR DETECTION
// ============================================

/**
 * Calculate volume for a set (weight × reps)
 */
function calculateVolume(weight: number | undefined, reps: number | string | undefined): number {
    if (!weight || !reps) return 0;
    const repCount = typeof reps === 'string' ? parseInt(reps, 10) : reps;
    if (isNaN(repCount)) return 0;
    return weight * repCount;
}

/**
 * Parse reps to number
 */
function parseReps(reps: number | string | undefined): number {
    if (reps === undefined || reps === null) return 0;
    if (typeof reps === 'number') return reps;
    const parsed = parseInt(reps, 10);
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Get historical PRs for an athlete's exercises
 */
async function getHistoricalPRs(
    athleteUserId: string,
    exerciseNames: string[]
): Promise<Map<string, HistoricalPR>> {
    const prMap = new Map<string, HistoricalPR>();

    if (exerciseNames.length === 0) return prMap;

    try {
        // Query workout history for this athlete
        // Look at completed assigned workouts
        const { data: workouts, error } = await supabase
            .from('assigned_workouts')
            .select('actual_results')
            .eq('athlete_user_id', athleteUserId)
            .eq('status', 'completed')
            .not('actual_results', 'is', null);

        if (error || !workouts) {
            console.error('[PRDetector] Error fetching history:', error);
            return prMap;
        }

        // Initialize PRs for all exercises
        for (const name of exerciseNames) {
            prMap.set(name.toLowerCase(), {
                exerciseName: name,
                maxWeight: 0,
                maxVolume: 0,
                maxReps: 0,
            });
        }

        // Process historical workouts
        for (const workout of workouts) {
            const results = workout.actual_results as WorkoutResults;
            if (!results?.exercises) continue;

            for (const exercise of results.exercises) {
                const key = exercise.exerciseName.toLowerCase();
                const pr = prMap.get(key);
                if (!pr) continue;

                for (const set of exercise.sets || []) {
                    if (!set.completed) continue;

                    const weight = set.weight || 0;
                    const reps = parseReps(set.reps);
                    const volume = calculateVolume(weight, reps);

                    pr.maxWeight = Math.max(pr.maxWeight, weight);
                    pr.maxVolume = Math.max(pr.maxVolume, volume);
                    pr.maxReps = Math.max(pr.maxReps, reps);
                }
            }
        }

        return prMap;
    } catch (error) {
        console.error('[PRDetector] Error:', error);
        return prMap;
    }
}

/**
 * Detect PRs in a completed workout
 */
export async function detectPRs(
    athleteUserId: string,
    workoutResults: WorkoutResults
): Promise<PRRecord[]> {
    const prs: PRRecord[] = [];

    if (!workoutResults?.exercises?.length) return prs;

    // Get exercise names
    const exerciseNames = workoutResults.exercises.map(e => e.exerciseName);

    // Get historical PRs
    const historicalPRs = await getHistoricalPRs(athleteUserId, exerciseNames);

    // Check each exercise for PRs
    for (const exercise of workoutResults.exercises) {
        const key = exercise.exerciseName.toLowerCase();
        const historical = historicalPRs.get(key);

        if (!historical) continue;

        let currentMaxWeight = 0;
        let currentMaxVolume = 0;
        let currentMaxReps = 0;

        // Calculate current maxes
        for (const set of exercise.sets || []) {
            if (!set.completed) continue;

            const weight = set.weight || 0;
            const reps = parseReps(set.reps);
            const volume = calculateVolume(weight, reps);

            currentMaxWeight = Math.max(currentMaxWeight, weight);
            currentMaxVolume = Math.max(currentMaxVolume, volume);
            currentMaxReps = Math.max(currentMaxReps, reps);
        }

        // Check for weight PR
        if (currentMaxWeight > historical.maxWeight && historical.maxWeight > 0) {
            prs.push({
                exerciseName: exercise.exerciseName,
                prType: 'weight',
                previousValue: historical.maxWeight,
                newValue: currentMaxWeight,
                unit: 'lbs',
            });
        }

        // Check for volume PR (only if weight PR wasn't already detected)
        if (currentMaxVolume > historical.maxVolume && historical.maxVolume > 0) {
            const alreadyHasWeightPR = prs.some(
                p => p.exerciseName === exercise.exerciseName && p.prType === 'weight'
            );
            if (!alreadyHasWeightPR) {
                prs.push({
                    exerciseName: exercise.exerciseName,
                    prType: 'volume',
                    previousValue: historical.maxVolume,
                    newValue: currentMaxVolume,
                });
            }
        }

        // Check for rep PR at same weight
        if (currentMaxReps > historical.maxReps && historical.maxReps > 0) {
            const alreadyHasPR = prs.some(
                p => p.exerciseName === exercise.exerciseName
            );
            if (!alreadyHasPR) {
                prs.push({
                    exerciseName: exercise.exerciseName,
                    prType: 'reps',
                    previousValue: historical.maxReps,
                    newValue: currentMaxReps,
                });
            }
        }
    }

    console.log(`[PRDetector] Found ${prs.length} PRs`);
    return prs;
}

/**
 * Calculate total workout duration in minutes
 */
export function calculateDuration(startedAt: Date, completedAt: Date): number {
    const durationMs = completedAt.getTime() - startedAt.getTime();
    return Math.round(durationMs / 60000);
}

/**
 * Count total sets in workout
 */
export function countTotalSets(results: WorkoutResults): number {
    return results.exercises?.reduce(
        (total, ex) => total + (ex.sets?.filter(s => s.completed)?.length || 0),
        0
    ) || 0;
}
