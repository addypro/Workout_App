/**
 * Paths Sync Service
 *
 * Queue job for retrying failed Supabase writes.
 * Uses existing queue.ts infrastructure.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    insertPlanDelta,
    updateProcessedWorkoutXP,
    upsertLiftStats,
    upsertNodeProgress,
} from '../paths/storage';
import type { UserLiftStats } from '../paths/types';
import type { PathsSyncPayload } from './types';

// ============================================
// QUEUE KEY
// ============================================

const PATHS_SYNC_QUEUE_KEY = '@paths_sync_queue_v1';

// ============================================
// QUEUE OPERATIONS
// ============================================

interface QueuedPathsJob {
    id: string;
    payload: PathsSyncPayload;
    createdAt: string;
    retryCount: number;
    lastAttempt?: string;
    error?: string;
}

const MAX_RETRIES = 5;

async function loadQueue(): Promise<QueuedPathsJob[]> {
    try {
        const data = await AsyncStorage.getItem(PATHS_SYNC_QUEUE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

async function saveQueue(queue: QueuedPathsJob[]): Promise<void> {
    await AsyncStorage.setItem(PATHS_SYNC_QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Enqueue a paths sync job for later retry.
 */
export async function enqueuePathsSync(payload: PathsSyncPayload): Promise<void> {
    try {
        const queue = await loadQueue();

        // Check for existing job with same workout
        const existingIndex = queue.findIndex(
            j => j.payload.workoutId === payload.workoutId && j.payload.source === payload.source
        );

        if (existingIndex >= 0) {
            // Update existing job
            queue[existingIndex].payload = payload;
            queue[existingIndex].createdAt = new Date().toISOString();
        } else {
            // Add new job
            const job: QueuedPathsJob = {
                id: `paths_${payload.workoutId}_${payload.source}`,
                payload,
                createdAt: new Date().toISOString(),
                retryCount: 0,
            };
            queue.push(job);
        }

        await saveQueue(queue);
        console.log('[PathsSync] Enqueued job for', payload.workoutId);
    } catch (error) {
        console.error('[PathsSync] Failed to enqueue job:', error);
    }
}

/**
 * Get pending jobs count.
 */
export async function getPendingPathsSyncCount(): Promise<number> {
    const queue = await loadQueue();
    return queue.filter(j => j.retryCount < MAX_RETRIES).length;
}

/**
 * Flush pending jobs to Supabase.
 */
export async function flushPathsSyncQueue(): Promise<{ synced: number; failed: number }> {
    const queue = await loadQueue();
    const pending = queue.filter(j => j.retryCount < MAX_RETRIES);

    let synced = 0;
    let failed = 0;

    for (const job of pending) {
        const success = await syncPathsJob(job.payload);

        if (success) {
            // Remove from queue
            const index = queue.findIndex(j => j.id === job.id);
            if (index >= 0) queue.splice(index, 1);
            synced++;
        } else {
            // Increment retry count
            job.retryCount++;
            job.lastAttempt = new Date().toISOString();
            job.error = 'Supabase write failed';
            failed++;
        }
    }

    await saveQueue(queue);
    console.log(`[PathsSync] Flushed: ${synced} synced, ${failed} failed`);

    return { synced, failed };
}

/**
 * Attempt to sync a single job to Supabase.
 */
async function syncPathsJob(payload: PathsSyncPayload): Promise<boolean> {
    const {
        userId,
        workoutId,
        source,
        xpAwarded,
        updatedStats,
        nodesCompleted,
        pathInstanceId,
        planDelta,
    } = payload;

    try {
        // 1. Update processed_workouts XP
        const xpResult = await updateProcessedWorkoutXP(userId, workoutId, source, xpAwarded);
        if (xpResult.error) {
            console.error('[PathsSync] Failed to update XP:', xpResult.error);
            return false;
        }

        // 2. Upsert lift stats
        const statsMap = new Map<string, UserLiftStats>();
        for (const [key, val] of Object.entries(updatedStats)) {
            // Reconstruct Date objects
            statsMap.set(key, {
                ...val as UserLiftStats,
                updatedAt: new Date((val as any).updatedAt),
            });
        }
        const statsResult = await upsertLiftStats(userId, statsMap);
        if (statsResult.error) {
            console.error('[PathsSync] Failed to upsert lift stats:', statsResult.error);
            return false;
        }

        // 3. Upsert node progress
        if (pathInstanceId && nodesCompleted.length > 0) {
            const nodeResult = await upsertNodeProgress(userId, pathInstanceId, nodesCompleted);
            if (nodeResult.error) {
                console.error('[PathsSync] Failed to upsert node progress:', nodeResult.error);
                return false;
            }
        }

        // 4. Insert plan delta
        if (planDelta) {
            const deltaResult = await insertPlanDelta(userId, workoutId, source, planDelta);
            if (deltaResult.error) {
                console.error('[PathsSync] Failed to insert plan delta:', deltaResult.error);
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error('[PathsSync] Unexpected error:', error);
        return false;
    }
}

/**
 * Get failed jobs.
 */
export async function getFailedPathsSyncJobs(): Promise<QueuedPathsJob[]> {
    const queue = await loadQueue();
    return queue.filter(j => j.retryCount >= MAX_RETRIES);
}

/**
 * Clear failed jobs.
 */
export async function clearFailedPathsSyncJobs(): Promise<void> {
    const queue = await loadQueue();
    const active = queue.filter(j => j.retryCount < MAX_RETRIES);
    await saveQueue(active);
}

/**
 * Reset retry counts (for manual retry).
 */
export async function resetPathsSyncRetries(): Promise<void> {
    const queue = await loadQueue();
    for (const job of queue) {
        job.retryCount = 0;
        job.error = undefined;
    }
    await saveQueue(queue);
}
