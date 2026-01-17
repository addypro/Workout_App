/**
 * Paths Offline Cache
 *
 * AsyncStorage cache for paths progression data.
 * Provides instant reads for offline-first UX.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
    PathInstance,
    PlanDelta,
    UserLiftStats,
    WorkoutSource
} from '../paths/types';
import { CACHE_KEYS } from '../paths/types';

// ============================================
// CACHE TYPES
// ============================================

export interface CachedPathProgress {
    version: 1;
    pathInstance: PathInstance | null;
    nodeProgress: Record<string, string>; // nodeId -> status
    totalXp: number;
    updatedAt: string;
}

export interface CachedLiftStats {
    version: 1;
    stats: Record<string, UserLiftStats>; // exerciseKey -> stats
    updatedAt: string;
}

export interface CachedLastResult {
    xpGained: number;
    nodesCompleted: string[];
    planDelta: PlanDelta | null;
    processedAt: string;
}

// ============================================
// CACHE KEYS
// ============================================

const LAST_RESULT_PREFIX = '@paths_last_result_v1';

function getLastResultKey(workoutId: string, source: WorkoutSource): string {
    return `${LAST_RESULT_PREFIX}::${workoutId}::${source}`;
}

// ============================================
// PATH PROGRESS CACHE
// ============================================

export async function getPathProgressCache(userId: string): Promise<CachedPathProgress | null> {
    try {
        const key = `${CACHE_KEYS.PATHS_PROGRESS}::${userId}`;
        const data = await AsyncStorage.getItem(key);
        if (!data) return null;
        return JSON.parse(data) as CachedPathProgress;
    } catch (error) {
        console.error('[PathsCache] Failed to get path progress:', error);
        return null;
    }
}

export async function setPathProgressCache(
    userId: string,
    progress: CachedPathProgress
): Promise<void> {
    try {
        const key = `${CACHE_KEYS.PATHS_PROGRESS}::${userId}`;
        await AsyncStorage.setItem(key, JSON.stringify(progress));
    } catch (error) {
        console.error('[PathsCache] Failed to set path progress:', error);
    }
}

// ============================================
// LIFT STATS CACHE
// ============================================

export async function getLiftStatsCache(userId: string): Promise<CachedLiftStats | null> {
    try {
        const key = `${CACHE_KEYS.LIFT_STATS}::${userId}`;
        const data = await AsyncStorage.getItem(key);
        if (!data) return null;
        return JSON.parse(data) as CachedLiftStats;
    } catch (error) {
        console.error('[PathsCache] Failed to get lift stats:', error);
        return null;
    }
}

export async function setLiftStatsCache(
    userId: string,
    stats: CachedLiftStats
): Promise<void> {
    try {
        const key = `${CACHE_KEYS.LIFT_STATS}::${userId}`;
        await AsyncStorage.setItem(key, JSON.stringify(stats));
    } catch (error) {
        console.error('[PathsCache] Failed to set lift stats:', error);
    }
}

// ============================================
// PROCESSED WORKOUTS CACHE
// ============================================

export async function getProcessedWorkoutsCache(userId: string): Promise<Set<string>> {
    try {
        const key = `${CACHE_KEYS.PROCESSED_WORKOUTS}::${userId}`;
        const data = await AsyncStorage.getItem(key);
        if (!data) return new Set();
        return new Set(JSON.parse(data) as string[]);
    } catch (error) {
        console.error('[PathsCache] Failed to get processed workouts:', error);
        return new Set();
    }
}

export async function addProcessedWorkoutCache(
    userId: string,
    workoutId: string,
    source: WorkoutSource
): Promise<void> {
    try {
        const processed = await getProcessedWorkoutsCache(userId);
        const key = `${userId}_${workoutId}_${source}`;
        processed.add(key);

        const cacheKey = `${CACHE_KEYS.PROCESSED_WORKOUTS}::${userId}`;
        await AsyncStorage.setItem(cacheKey, JSON.stringify([...processed]));
    } catch (error) {
        console.error('[PathsCache] Failed to add processed workout:', error);
    }
}

// ============================================
// LAST RESULT CACHE (for idempotent returns)
// ============================================

export async function getLastResultCache(
    workoutId: string,
    source: WorkoutSource
): Promise<CachedLastResult | null> {
    try {
        const key = getLastResultKey(workoutId, source);
        const data = await AsyncStorage.getItem(key);
        if (!data) return null;
        return JSON.parse(data) as CachedLastResult;
    } catch (error) {
        console.error('[PathsCache] Failed to get last result:', error);
        return null;
    }
}

export async function setLastResultCache(
    workoutId: string,
    source: WorkoutSource,
    result: CachedLastResult
): Promise<void> {
    try {
        const key = getLastResultKey(workoutId, source);
        await AsyncStorage.setItem(key, JSON.stringify(result));
    } catch (error) {
        console.error('[PathsCache] Failed to set last result:', error);
    }
}

/**
 * Try to get last result for a workout, checking both sources.
 * Used by UI when source is unknown.
 */
export async function getLastResultForWorkout(
    workoutId: string,
    source?: WorkoutSource
): Promise<CachedLastResult | null> {
    if (source) {
        return getLastResultCache(workoutId, source);
    }

    // Try 'self' first (more common), then 'assigned'
    const selfResult = await getLastResultCache(workoutId, 'self');
    if (selfResult) return selfResult;

    const assignedResult = await getLastResultCache(workoutId, 'assigned');
    return assignedResult;
}

// ============================================
// UPDATE HELPERS
// ============================================

/**
 * Merge updated lift stats into cache.
 */
export async function mergeLiftStatsCache(
    userId: string,
    updatedStats: Map<string, UserLiftStats>
): Promise<void> {
    const existing = await getLiftStatsCache(userId);
    const stats = existing?.stats ?? {};

    for (const [key, stat] of updatedStats) {
        stats[key] = stat;
    }

    await setLiftStatsCache(userId, {
        version: 1,
        stats,
        updatedAt: new Date().toISOString(),
    });
}

/**
 * Add XP and completed nodes to path progress cache.
 */
export async function updatePathProgressCache(
    userId: string,
    xpGained: number,
    nodesCompleted: string[],
    pathInstance?: PathInstance
): Promise<void> {
    const existing = await getPathProgressCache(userId);

    const nodeProgress = existing?.nodeProgress ?? {};
    for (const nodeId of nodesCompleted) {
        nodeProgress[nodeId] = 'completed';
    }

    await setPathProgressCache(userId, {
        version: 1,
        pathInstance: pathInstance ?? existing?.pathInstance ?? null,
        nodeProgress,
        totalXp: (existing?.totalXp ?? 0) + xpGained,
        updatedAt: new Date().toISOString(),
    });
}

// ============================================
// CLEAR CACHE
// ============================================

export async function clearPathsCaches(userId: string): Promise<void> {
    try {
        await AsyncStorage.multiRemove([
            `${CACHE_KEYS.PATHS_PROGRESS}::${userId}`,
            `${CACHE_KEYS.LIFT_STATS}::${userId}`,
            `${CACHE_KEYS.PROCESSED_WORKOUTS}::${userId}`,
        ]);
    } catch (error) {
        console.error('[PathsCache] Failed to clear caches:', error);
    }
}
