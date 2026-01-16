/**
 * Workout Utility Functions
 *
 * Pure utility functions for workout analysis and type inference.
 */

import type { WorkoutExercise } from '@/lib/types/workout-session';

// ============================================
// WORKOUT TYPE INFERENCE
// ============================================

/**
 * Infer the workout type from the exercises' muscle groups.
 * Used for UFIRE scoring context and workout categorization.
 */
export function inferWorkoutTypeFromExercises(
    exercises: WorkoutExercise[]
): 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body' | 'custom' | undefined {
    const muscles = exercises
        .flatMap((e) => e.muscleGroups || [])
        .filter((m): m is string => typeof m === 'string' && m.length > 0)
        .map((m) => m.toLowerCase());

    if (muscles.length === 0) return undefined;

    if (muscles.some((m) => m.includes('chest') || m.includes('shoulder') || m.includes('tricep'))) {
        return 'push';
    }
    if (muscles.some((m) => m.includes('back') || m.includes('bicep'))) {
        return 'pull';
    }
    if (muscles.some((m) => m.includes('quad') || m.includes('hamstring') || m.includes('glute'))) {
        return 'legs';
    }

    return undefined;
}

// ============================================
// REST TIME FORMATTING
// ============================================

/**
 * Format rest time in seconds to display string (M:SS or S)
 */
export function formatRestTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}`;
}
