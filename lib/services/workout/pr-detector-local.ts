/**
 * Local PR Detector
 * 
 * Detects Personal Records by comparing current workout against
 * local workout history (AsyncStorage). Works offline, no network needed.
 */

import { getUnifiedHistory } from '@/lib/db/storage';

// ============================================
// TYPES
// ============================================

export type PRType = 'weight' | 'volume' | 'reps';

export interface DetectedPR {
    exerciseName: string;
    prType: PRType;
    previousValue: number;
    newValue: number;
    improvement: number;
    improvementPercent: number;
    unit?: string;
}

interface ExerciseMax {
    maxWeight: number;
    maxVolume: number;
    maxRepsAtWeight: Map<number, number>;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function normalizeExerciseName(name: string): string {
    return name.toLowerCase().trim();
}

function calculateVolume(weight: number, reps: number): number {
    return weight * reps;
}

function parseReps(reps: number | string | undefined): number {
    if (reps === undefined || reps === null) return 0;
    if (typeof reps === 'number') return reps;
    const parsed = parseInt(reps, 10);
    return isNaN(parsed) ? 0 : parsed;
}

// ============================================
// MAIN FUNCTIONS
// ============================================

async function getHistoricalMaxes(
    exerciseNames: string[],
    userId: string
): Promise<Map<string, ExerciseMax>> {
    const maxes = new Map<string, ExerciseMax>();

    for (const name of exerciseNames) {
        maxes.set(normalizeExerciseName(name), {
            maxWeight: 0,
            maxVolume: 0,
            maxRepsAtWeight: new Map(),
        });
    }

    const history = await getUnifiedHistory(userId);

    for (const workout of history) {
        for (const exercise of workout.exercises) {
            const key = normalizeExerciseName(exercise.name);
            const maxData = maxes.get(key);
            if (!maxData) continue;

            if (exercise.sets && Array.isArray(exercise.sets)) {
                for (const set of exercise.sets) {
                    if (!set.isCompleted) continue;

                    const weight = set.weight || 0;
                    const reps = set.reps || 0;
                    const volume = calculateVolume(weight, reps);

                    if (weight > maxData.maxWeight) maxData.maxWeight = weight;
                    if (volume > maxData.maxVolume) maxData.maxVolume = volume;

                    if (weight > 0) {
                        const currentMaxReps = maxData.maxRepsAtWeight.get(weight) || 0;
                        if (reps > currentMaxReps) maxData.maxRepsAtWeight.set(weight, reps);
                    }
                }
            }

            if (exercise.bestSet) {
                const weight = exercise.bestSet.weight || 0;
                const reps = exercise.bestSet.reps || 0;
                const volume = calculateVolume(weight, reps);

                if (weight > maxData.maxWeight) maxData.maxWeight = weight;
                if (volume > maxData.maxVolume) maxData.maxVolume = volume;

                if (weight > 0) {
                    const currentMaxReps = maxData.maxRepsAtWeight.get(weight) || 0;
                    if (reps > currentMaxReps) maxData.maxRepsAtWeight.set(weight, reps);
                }
            }
        }
    }

    return maxes;
}

export async function detectPRsLocal(
    currentWorkout: {
        exercises: {
            name: string;
            sets: { weight?: number; reps?: number | string; isCompleted?: boolean }[];
        }[];
    },
    userId: string = 'local'
): Promise<DetectedPR[]> {
    const detectedPRs: DetectedPR[] = [];

    if (!currentWorkout?.exercises?.length) return detectedPRs;

    const exerciseNames = currentWorkout.exercises.map(e => e.name);
    const historicalMaxes = await getHistoricalMaxes(exerciseNames, userId);

    for (const exercise of currentWorkout.exercises) {
        const key = normalizeExerciseName(exercise.name);
        const historical = historicalMaxes.get(key);

        if (!historical) continue;

        let currentMaxWeight = 0;
        let currentMaxVolume = 0;
        const currentRepsAtWeight = new Map<number, number>();

        for (const set of exercise.sets || []) {
            if (!set.isCompleted) continue;

            const weight = set.weight || 0;
            const reps = parseReps(set.reps);
            const volume = calculateVolume(weight, reps);

            if (weight > currentMaxWeight) currentMaxWeight = weight;
            if (volume > currentMaxVolume) currentMaxVolume = volume;

            if (weight > 0) {
                const currentMax = currentRepsAtWeight.get(weight) || 0;
                if (reps > currentMax) currentRepsAtWeight.set(weight, reps);
            }
        }

        // Weight PR (most exciting)
        if (currentMaxWeight > historical.maxWeight && historical.maxWeight > 0) {
            const improvement = currentMaxWeight - historical.maxWeight;
            detectedPRs.push({
                exerciseName: exercise.name,
                prType: 'weight',
                previousValue: historical.maxWeight,
                newValue: currentMaxWeight,
                improvement,
                improvementPercent: Math.round((improvement / historical.maxWeight) * 100),
                unit: 'lbs',
            });
            continue;
        }

        // Volume PR
        if (currentMaxVolume > historical.maxVolume && historical.maxVolume > 0) {
            const improvement = currentMaxVolume - historical.maxVolume;
            detectedPRs.push({
                exerciseName: exercise.name,
                prType: 'volume',
                previousValue: historical.maxVolume,
                newValue: currentMaxVolume,
                improvement,
                improvementPercent: Math.round((improvement / historical.maxVolume) * 100),
            });
            continue;
        }

        // Rep PR at same weight
        for (const [weight, reps] of currentRepsAtWeight) {
            const previousMaxReps = historical.maxRepsAtWeight.get(weight) || 0;
            if (reps > previousMaxReps && previousMaxReps > 0) {
                const improvement = reps - previousMaxReps;
                detectedPRs.push({
                    exerciseName: exercise.name,
                    prType: 'reps',
                    previousValue: previousMaxReps,
                    newValue: reps,
                    improvement,
                    improvementPercent: Math.round((improvement / previousMaxReps) * 100),
                    unit: `reps @ ${weight}lbs`,
                });
                break;
            }
        }
    }

    console.log(`[PR Detector] Found ${detectedPRs.length} PRs`);
    return detectedPRs;
}

export function getPRDescription(pr: DetectedPR): string {
    switch (pr.prType) {
        case 'weight':
            return `+${pr.improvement} ${pr.unit || 'lbs'}`;
        case 'volume':
            return `+${pr.improvement} lbs total`;
        case 'reps':
            return `+${pr.improvement} ${pr.unit || 'reps'}`;
        default:
            return `+${pr.improvement}`;
    }
}

export function getPREmoji(prType: PRType): string {
    switch (prType) {
        case 'weight':
            return '🏆';
        case 'volume':
            return '💪';
        case 'reps':
            return '🔥';
        default:
            return '⭐';
    }
}

export function getPRLabel(prType: PRType): string {
    switch (prType) {
        case 'weight':
            return 'WEIGHT PR!';
        case 'volume':
            return 'VOLUME PR!';
        case 'reps':
            return 'REP PR!';
        default:
            return 'NEW PR!';
    }
}
