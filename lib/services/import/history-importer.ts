/**
 * History Importer Service
 * 
 * Imports workout sessions into the app's history and triggers PR detection.
 */

import { saveWorkoutToHistory, type UnifiedWorkoutRecord } from '@/lib/db/storage';
import type { PRRecord } from '@/lib/services/notifications/types';
import { detectPRs } from '@/lib/services/workout/pr-detector';

// ============================================
// TYPES
// ============================================

export interface ImportResult {
    success: boolean;
    importedCount: number;
    skippedCount: number;
    errors: Array<{ sessionName: string; error: string }>;
    prsDetected: PRRecord[];
    totalDuration: number; // ms
}

export interface ImportProgress {
    current: number;
    total: number;
    currentWorkout: string;
    phase: 'importing' | 'detecting_prs' | 'complete';
}

export type ProgressCallback = (progress: ImportProgress) => void;

// ============================================
// IMPORT FUNCTION
// ============================================

/**
 * Import workout sessions into the app's history
 * 
 * @param sessions - Array of workout records to import (without IDs)
 * @param userId - User ID for the imports
 * @param onProgress - Optional callback for progress updates
 */
export async function importWorkouts(
    sessions: Omit<UnifiedWorkoutRecord, 'id'>[],
    userId: string,
    onProgress?: ProgressCallback
): Promise<ImportResult> {
    const startTime = Date.now();
    const result: ImportResult = {
        success: true,
        importedCount: 0,
        skippedCount: 0,
        errors: [],
        prsDetected: [],
        totalDuration: 0,
    };

    if (!sessions || sessions.length === 0) {
        result.totalDuration = Date.now() - startTime;
        return result;
    }

    const total = sessions.length;

    // Phase 1: Import sessions
    for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];

        onProgress?.({
            current: i + 1,
            total,
            currentWorkout: session.workoutName,
            phase: 'importing',
        });

        try {
            // Ensure userId is set
            const sessionWithUser = {
                ...session,
                userId,
            };

            // Save to history
            await saveWorkoutToHistory(sessionWithUser);
            result.importedCount++;
        } catch (error) {
            result.errors.push({
                sessionName: session.workoutName,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            result.skippedCount++;
        }
    }

    // Phase 2: Detect PRs for all imported workouts
    // We batch this to avoid spamming PR notifications
    onProgress?.({
        current: total,
        total,
        currentWorkout: 'Detecting PRs...',
        phase: 'detecting_prs',
    });

    try {
        // Detect PRs for each session's exercises
        for (const session of sessions) {
            const workoutResults = {
                exercises: session.exercises.map(ex => ({
                    exerciseName: ex.name,
                    sets: (ex.sets ?? []).map(s => ({
                        weight: s.weight,
                        reps: s.reps,
                        completed: s.isCompleted,
                    })),
                })),
            };

            const prs = await detectPRs(userId, workoutResults);
            result.prsDetected.push(...prs);
        }
    } catch (error) {
        console.error('[HistoryImporter] PR detection error:', error);
        // Don't fail the import for PR detection errors
    }

    // Complete
    onProgress?.({
        current: total,
        total,
        currentWorkout: 'Complete',
        phase: 'complete',
    });

    result.success = result.errors.length === 0;
    result.totalDuration = Date.now() - startTime;

    console.log(
        `[HistoryImporter] Imported ${result.importedCount} workouts, ` +
        `${result.skippedCount} skipped, ${result.prsDetected.length} PRs detected`
    );

    return result;
}

/**
 * Validate sessions before import
 */
export function validateSessions(
    sessions: Omit<UnifiedWorkoutRecord, 'id'>[]
): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!sessions || sessions.length === 0) {
        issues.push('No sessions to import');
        return { valid: false, issues };
    }

    for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];

        if (!session.workoutName) {
            issues.push(`Session ${i + 1}: Missing workout name`);
        }

        if (!session.exercises || session.exercises.length === 0) {
            issues.push(`Session ${i + 1} (${session.workoutName}): No exercises`);
        }

        if (!session.completedAt) {
            issues.push(`Session ${i + 1} (${session.workoutName}): Missing completion date`);
        }
    }

    return {
        valid: issues.length === 0,
        issues,
    };
}
