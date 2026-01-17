/**
 * Curated Programs Preloader
 *
 * SIMPLIFIED ARCHITECTURE:
 * 1. Load pre-extracted curated program data (build-time generated)
 * 2. Store to SQLite for instant runtime access
 * 3. NO runtime Kaggle matching - data is pre-baked
 *
 * The 37 curated programs are matched at BUILD TIME, not runtime.
 * This file just loads the pre-extracted data and caches to SQLite.
 */

import { ensureCuratedProgramsTable, getDatabase } from '@/lib/db/sqlite';
import { getAllPrograms } from '@/lib/services/programs';
import type { Workout } from '@/lib/services/programs/types';
import { Platform } from 'react-native';


// Version to track when we need to re-preload
const PRELOAD_VERSION = '3.0.0';

// Pre-extracted data type
type PreExtractedProgram = {
    kaggleName: string;
    workouts: Array<{
        week: number;
        day: number;
        name?: string;
        exercises?: Array<{
            name: string;
            sets?: number;
            reps?: string;
            weight?: string | null;
            restTime?: number;
            notes?: string;
        }>;
    }>;
};

export type CachedProgramMeta = {
    coverageWeeks: number;
    programDuration: number;
    isFullPlan: boolean;
    source: 'kaggle' | 'embedded';
};

export type CachedProgramWorkouts = {
    workouts: Workout[];
    meta: CachedProgramMeta;
};

type CuratedReadyResult = {
    ready: boolean;
    missingIds: string[];
};

function getMaxWeek(workouts: Workout[]): number {
    if (!workouts.length) return 0;
    return Math.max(...workouts.map(w => w.week || 1), 1);
}

/**
 * Get cached workouts for a curated program from SQLite.
 */
export async function getCachedProgramWorkouts(
    programId: string,
    programDuration?: number
): Promise<CachedProgramWorkouts | null> {
    if (Platform.OS === 'web') return null;

    const db = await getDatabase();
    if (!db) return null;

    try {
        const result = await db.getFirstAsync<{
            workouts_json: string;
            coverage_weeks: number | null;
            program_duration: number | null;
            is_full_plan: number | null;
            data_source: string | null;
        }>(
            `SELECT workouts_json, coverage_weeks, program_duration, is_full_plan, data_source
             FROM curated_program_workouts WHERE program_id = ?`,
            [programId]
        );

        if (result?.workouts_json) {
            const workouts = JSON.parse(result.workouts_json) as Workout[];
            const maxWeek = getMaxWeek(workouts);
            const duration = result.program_duration ?? programDuration ?? maxWeek;
            const coverageWeeks = Math.max(result.coverage_weeks ?? 0, maxWeek);
            const isFullPlan = duration > 0 && coverageWeeks >= duration;

            return {
                workouts,
                meta: {
                    coverageWeeks,
                    programDuration: duration,
                    isFullPlan,
                    source: result.data_source === 'kaggle' ? 'kaggle' : 'embedded',
                },
            };
        }
    } catch (error) {
        console.warn('[CuratedPreload] Failed to get cached workouts:', error);
    }

    return null;
}

/**
 * Check if preload is needed.
 */
async function isPreloadNeeded(): Promise<boolean> {
    const db = await getDatabase();
    if (!db) return false;

    try {
        const result = await db.getFirstAsync<{ value: string }>(
            'SELECT value FROM curated_programs_meta WHERE key = ?',
            ['preload_version']
        );
        return result?.value !== PRELOAD_VERSION;
    } catch {
        return true;
    }
}

/**
 * Transform pre-extracted workout to standard format.
 */
function transformWorkout(workout: PreExtractedProgram['workouts'][0]): Workout {
    return {
        week: workout.week || 1,
        day: workout.day || 1,
        name: workout.name || `Week ${workout.week}, Day ${workout.day}`,
        exercises: (workout.exercises || []).map(ex => ({
            name: ex.name || 'Exercise',
            sets: ex.sets || 3,
            reps: String(ex.reps || '10'),
            restTime: ex.restTime || 90,
            ...(ex.notes ? { notes: ex.notes } : {}),
        })),
    };
}

/**
 * Preload curated programs to SQLite.
 * Uses PRE-EXTRACTED data - no runtime Kaggle matching!
 */
export async function preloadCuratedPrograms(): Promise<void> {
    if (Platform.OS === 'web') return;

    const tableReady = await ensureCuratedProgramsTable();
    if (!tableReady) {
        console.warn('[CuratedPreload] Failed to ensure table');
        return;
    }

    const needed = await isPreloadNeeded();
    if (!needed) {
        console.log('[CuratedPreload] Already preloaded (v' + PRELOAD_VERSION + ')');
        return;
    }

    console.log('[CuratedPreload] Starting preload...');
    const startTime = Date.now();

    try {
        // Get curated programs (the 37 in Browse UI)
        const curatedPrograms = getAllPrograms();
        console.log(`[CuratedPreload] ${curatedPrograms.length} curated programs`);

        // Load PRE-EXTRACTED data (2.2MB vs 118MB runtime matching)
        console.log('[CuratedPreload] Loading pre-extracted data...');
        const preExtractedModule = await import('@/data/curated-programs-data.json');
        const extractedData: Record<string, PreExtractedProgram> =
            (preExtractedModule as { default?: Record<string, PreExtractedProgram> }).default ||
            (preExtractedModule as unknown as Record<string, PreExtractedProgram>);
        console.log(`[CuratedPreload] ${Object.keys(extractedData).length} pre-extracted programs loaded`);

        const db = await getDatabase();
        if (!db) return;

        let fromKaggle = 0;
        let fromEmbedded = 0;

        for (const curated of curatedPrograms) {
            const extracted = extractedData[curated.id];

            let workouts: Workout[];
            let dataSource: 'kaggle' | 'embedded';

            if (extracted && extracted.workouts?.length > 0) {
                // Use pre-extracted Kaggle data
                workouts = extracted.workouts.map(transformWorkout);
                dataSource = 'kaggle';
                fromKaggle++;
                console.log(`[CuratedPreload] ✓ "${curated.name}" (${workouts.length} workouts)`);
            } else {
                // Fallback to embedded TypeScript data
                workouts = curated.workouts || [];
                dataSource = 'embedded';
                fromEmbedded++;
                console.log(`[CuratedPreload] ○ "${curated.name}" → embedded (${workouts.length} workouts)`);
            }

            const coverageWeeks = getMaxWeek(workouts);
            const programDuration = curated.duration || coverageWeeks;
            const isFullPlan = programDuration > 0 && coverageWeeks >= programDuration;

            await db.runAsync(
                `INSERT OR REPLACE INTO curated_program_workouts
                 (program_id, program_name, workouts_json, kaggle_source_id, data_source, coverage_weeks, program_duration, is_full_plan, preloaded_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    curated.id,
                    curated.name,
                    JSON.stringify(workouts),
                    null,
                    dataSource,
                    coverageWeeks,
                    programDuration,
                    isFullPlan ? 1 : 0,
                    new Date().toISOString(),
                ]
            );
        }

        // Update version
        await db.runAsync(
            `INSERT OR REPLACE INTO curated_programs_meta (key, value) VALUES (?, ?)`,
            ['preload_version', PRELOAD_VERSION]
        );

        const elapsed = Date.now() - startTime;
        console.log(`[CuratedPreload] Complete: ${fromKaggle} from Kaggle, ${fromEmbedded} embedded, ${elapsed}ms`);
    } catch (error) {
        console.error('[CuratedPreload] Failed:', error);
    }
}

async function getCachedProgramIds(): Promise<Set<string>> {
    const db = await getDatabase();
    if (!db) return new Set();

    try {
        const rows = await db.getAllAsync<{ program_id: string }>(
            'SELECT program_id FROM curated_program_workouts'
        );
        return new Set(rows.map((row) => row.program_id));
    } catch (error) {
        console.warn('[CuratedPreload] Failed to read cached program IDs:', error);
        return new Set();
    }
}

export async function ensureCuratedProgramsReady(): Promise<CuratedReadyResult> {
    if (Platform.OS === 'web') {
        return { ready: true, missingIds: [] };
    }

    const tableReady = await ensureCuratedProgramsTable();
    if (!tableReady) {
        return { ready: false, missingIds: [] };
    }

    await preloadCuratedPrograms();

    const expected = getAllPrograms().map((program) => program.id);
    const cached = await getCachedProgramIds();
    const missingIds = expected.filter((id) => !cached.has(id));

    return { ready: missingIds.length === 0, missingIds };
}
