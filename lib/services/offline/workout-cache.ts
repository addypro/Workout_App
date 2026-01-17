/**
 * Offline Workout Cache
 *
 * Caches assigned workouts to AsyncStorage for offline access.
 * Queues workout completions when offline and syncs when back online.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import type { AssignedWorkout } from '../coach/types';

// ============================================
// STORAGE KEYS
// ============================================

const CACHE_KEYS = {
    WORKOUTS: 'offline_assigned_workouts',
    PENDING_COMPLETIONS: 'offline_pending_completions',
    LAST_SYNC: 'offline_last_sync',
} as const;

// ============================================
// TYPES
// ============================================

interface PendingCompletion {
    workoutId: string;
    results: Record<string, unknown>;
    feedback?: string;
    rating?: number;
    completedAt: string;
}

interface CacheMetadata {
    cachedAt: string;
    expiresAt: string;
}

interface CachedWorkouts {
    metadata: CacheMetadata;
    workouts: AssignedWorkout[];
}

// Cache duration: 30 days (1 month)
const CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// ============================================
// WORKOUT CACHING
// ============================================

/**
 * Cache assigned workouts for offline access
 */
export async function cacheAssignedWorkouts(workouts: AssignedWorkout[]): Promise<void> {
    try {
        const now = new Date();
        const cached: CachedWorkouts = {
            metadata: {
                cachedAt: now.toISOString(),
                expiresAt: new Date(now.getTime() + CACHE_DURATION_MS).toISOString(),
            },
            workouts,
        };

        await AsyncStorage.setItem(CACHE_KEYS.WORKOUTS, JSON.stringify(cached));
        await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, now.toISOString());

        console.log(`[OfflineCache] Cached ${workouts.length} workouts`);
    } catch (error) {
        console.error('[OfflineCache] Error caching workouts:', error);
    }
}

/**
 * Get cached workouts (for offline use)
 */
export async function getCachedWorkouts(): Promise<AssignedWorkout[]> {
    try {
        const data = await AsyncStorage.getItem(CACHE_KEYS.WORKOUTS);
        if (!data) return [];

        const cached: CachedWorkouts = JSON.parse(data);

        // Check if cache has expired
        if (new Date(cached.metadata.expiresAt) < new Date()) {
            console.log('[OfflineCache] Cache expired, clearing');
            await AsyncStorage.removeItem(CACHE_KEYS.WORKOUTS);
            return [];
        }

        // Convert date strings back to Date objects
        return cached.workouts.map(w => ({
            ...w,
            scheduledDate: new Date(w.scheduledDate),
            scheduledAt: w.scheduledAt ? new Date(w.scheduledAt) : undefined,
            startedAt: w.startedAt ? new Date(w.startedAt) : undefined,
            completedAt: w.completedAt ? new Date(w.completedAt) : undefined,
            skippedAt: w.skippedAt ? new Date(w.skippedAt) : undefined,
            createdAt: new Date(w.createdAt),
            updatedAt: new Date(w.updatedAt),
        }));
    } catch (error) {
        console.error('[OfflineCache] Error reading cache:', error);
        return [];
    }
}

/**
 * Get a cached assigned workout by id
 */
export async function getCachedWorkoutById(workoutId: string): Promise<AssignedWorkout | null> {
    const workouts = await getCachedWorkouts();
    return workouts.find(w => w.id === workoutId) ?? null;
}

/**
 * Upsert a cached assigned workout by id
 */
export async function upsertCachedWorkout(workout: AssignedWorkout): Promise<void> {
    const workouts = await getCachedWorkouts();
    const next = workouts.filter(w => w.id !== workout.id);
    next.unshift(workout);
    await cacheAssignedWorkouts(next);
}

/**
 * Get last sync timestamp
 */
export async function getLastSyncTime(): Promise<Date | null> {
    try {
        const data = await AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC);
        return data ? new Date(data) : null;
    } catch {
        return null;
    }
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<void> {
    try {
        await AsyncStorage.multiRemove([
            CACHE_KEYS.WORKOUTS,
            CACHE_KEYS.PENDING_COMPLETIONS,
            CACHE_KEYS.LAST_SYNC,
        ]);
        console.log('[OfflineCache] Cache cleared');
    } catch (error) {
        console.error('[OfflineCache] Error clearing cache:', error);
    }
}

// ============================================
// PENDING COMPLETIONS
// ============================================

/**
 * Queue a workout completion for later sync
 */
export async function queueWorkoutCompletion(
    workoutId: string,
    results: Record<string, unknown>,
    feedback?: string,
    rating?: number
): Promise<void> {
    try {
        const pending = await getPendingCompletions();

        pending.push({
            workoutId,
            results,
            feedback,
            rating,
            completedAt: new Date().toISOString(),
        });

        await AsyncStorage.setItem(CACHE_KEYS.PENDING_COMPLETIONS, JSON.stringify(pending));
        console.log(`[OfflineCache] Queued completion for workout ${workoutId}`);
    } catch (error) {
        console.error('[OfflineCache] Error queueing completion:', error);
        throw error;
    }
}

/**
 * Get all pending completions
 */
export async function getPendingCompletions(): Promise<PendingCompletion[]> {
    try {
        const data = await AsyncStorage.getItem(CACHE_KEYS.PENDING_COMPLETIONS);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

/**
 * Remove a pending completion after successful sync
 */
export async function removePendingCompletion(workoutId: string): Promise<void> {
    try {
        const pending = await getPendingCompletions();
        const filtered = pending.filter(p => p.workoutId !== workoutId);
        await AsyncStorage.setItem(CACHE_KEYS.PENDING_COMPLETIONS, JSON.stringify(filtered));
    } catch (error) {
        console.error('[OfflineCache] Error removing pending:', error);
    }
}

/**
 * Check if there are pending completions to sync
 */
export async function hasPendingCompletions(): Promise<boolean> {
    const pending = await getPendingCompletions();
    return pending.length > 0;
}

// ============================================
// SYNC LOGIC
// ============================================

/**
 * Sync pending completions with the server
 * Call this when network becomes available
 */
export async function syncPendingWorkouts(
    completeWorkoutFn: (
        workoutId: string,
        results: Record<string, unknown>,
        feedback?: string,
        rating?: number
    ) => Promise<{ success: boolean }>
): Promise<{ synced: number; failed: number }> {
    const pending = await getPendingCompletions();
    if (pending.length === 0) {
        return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (const item of pending) {
        try {
            const result = await completeWorkoutFn(
                item.workoutId,
                item.results,
                item.feedback,
                item.rating
            );

            if (result.success) {
                await removePendingCompletion(item.workoutId);
                synced++;
            } else {
                failed++;
            }
        } catch (error) {
            console.error(`[OfflineCache] Sync failed for ${item.workoutId}:`, error);
            failed++;
        }
    }

    console.log(`[OfflineCache] Sync complete: ${synced} synced, ${failed} failed`);
    return { synced, failed };
}

// ============================================
// NETWORK MONITORING
// ============================================

let unsubscribeNetInfo: (() => void) | null = null;

/**
 * Start listening for network changes
 * Automatically syncs pending workouts when coming back online
 */
export function startNetworkMonitoring(
    completeWorkoutFn: (
        workoutId: string,
        results: Record<string, unknown>,
        feedback?: string,
        rating?: number
    ) => Promise<{ success: boolean }>
): void {
    if (unsubscribeNetInfo) return; // Already monitoring

    unsubscribeNetInfo = NetInfo.addEventListener(async state => {
        if (state.isConnected && state.isInternetReachable) {
            const hasPending = await hasPendingCompletions();
            if (hasPending) {
                console.log('[OfflineCache] Network available, syncing pending workouts');
                await syncPendingWorkouts(completeWorkoutFn);
            }
        }
    });

    console.log('[OfflineCache] Network monitoring started');
}

/**
 * Stop network monitoring
 */
export function stopNetworkMonitoring(): void {
    if (unsubscribeNetInfo) {
        unsubscribeNetInfo();
        unsubscribeNetInfo = null;
        console.log('[OfflineCache] Network monitoring stopped');
    }
}

/**
 * Check if currently online
 */
export async function isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return !!(state.isConnected && state.isInternetReachable);
}
