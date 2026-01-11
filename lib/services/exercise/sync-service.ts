/**
 * Custom Exercises Sync Service
 *
 * Handles background synchronization of custom exercises to Supabase.
 * - Periodic sync (every 5 minutes when app is active)
 * - Network reconnection sync
 * - Manual sync trigger
 */

import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { syncCustomExercises, getCustomExercises } from './custom-exercises';

// ============================================
// Types
// ============================================

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  pendingCount: number;
  lastError: string | null;
}

type SyncListener = (status: SyncStatus) => void;

// ============================================
// State
// ============================================

let syncStatus: SyncStatus = {
  isOnline: true,
  isSyncing: false,
  lastSyncAt: null,
  pendingCount: 0,
  lastError: null,
};

const listeners = new Set<SyncListener>();
let syncInterval: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let netInfoUnsubscribe: (() => void) | null = null;

// ============================================
// Sync Functions
// ============================================

/**
 * Perform sync operation
 */
export async function performSync(): Promise<{ synced: number; failed: number }> {
  if (syncStatus.isSyncing) {
    return { synced: 0, failed: 0 };
  }

  if (!syncStatus.isOnline) {
    return { synced: 0, failed: 0 };
  }

  updateStatus({ isSyncing: true, lastError: null });

  try {
    const result = await syncCustomExercises();

    // Update pending count
    const exercises = await getCustomExercises();
    const pending = exercises.filter((e) => e.syncStatus === 'pending').length;

    updateStatus({
      isSyncing: false,
      lastSyncAt: new Date(),
      pendingCount: pending,
      lastError: result.failed > 0 ? `${result.failed} items failed to sync` : null,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    updateStatus({
      isSyncing: false,
      lastError: message,
    });
    return { synced: 0, failed: 1 };
  }
}

/**
 * Update sync status and notify listeners
 */
function updateStatus(partial: Partial<SyncStatus>) {
  syncStatus = { ...syncStatus, ...partial };
  listeners.forEach((listener) => listener(syncStatus));
}

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

/**
 * Subscribe to sync status changes
 */
export function subscribeSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  // Immediately notify with current status
  listener(syncStatus);

  return () => {
    listeners.delete(listener);
  };
}

// ============================================
// Background Sync Management
// ============================================

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Start background sync service
 */
export function startSyncService(): void {
  if (syncInterval) {
    return; // Already running
  }

  // Set up periodic sync
  syncInterval = setInterval(() => {
    if (syncStatus.isOnline && !syncStatus.isSyncing) {
      performSync();
    }
  }, SYNC_INTERVAL_MS);

  // Set up app state listener
  appStateSubscription = AppState.addEventListener(
    'change',
    handleAppStateChange
  );

  // Set up network listener
  netInfoUnsubscribe = NetInfo.addEventListener(handleNetworkChange);

  // Initial sync
  performSync();
}

/**
 * Stop background sync service
 */
export function stopSyncService(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  if (netInfoUnsubscribe) {
    netInfoUnsubscribe();
    netInfoUnsubscribe = null;
  }
}

/**
 * Handle app state changes
 */
function handleAppStateChange(nextAppState: AppStateStatus) {
  if (nextAppState === 'active') {
    // Sync when app becomes active
    performSync();
  }
}

/**
 * Handle network connectivity changes
 */
function handleNetworkChange(state: { isConnected: boolean | null }) {
  const wasOffline = !syncStatus.isOnline;
  const isOnline = state.isConnected === true;

  updateStatus({ isOnline });

  // Sync when coming back online
  if (wasOffline && isOnline) {
    performSync();
  }
}

// ============================================
// React Hook
// ============================================

import { useEffect, useState } from 'react';

/**
 * React hook for sync status
 */
export function useSyncStatus(): SyncStatus & { triggerSync: () => Promise<void> } {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());

  useEffect(() => {
    return subscribeSyncStatus(setStatus);
  }, []);

  const triggerSync = async () => {
    await performSync();
  };

  return { ...status, triggerSync };
}

/**
 * Initialize sync on app start
 */
export async function initializeSyncService(): Promise<void> {
  // Check initial network state
  const netState = await NetInfo.fetch();
  updateStatus({ isOnline: netState.isConnected === true });

  // Count pending items
  const exercises = await getCustomExercises();
  const pending = exercises.filter((e) => e.syncStatus === 'pending').length;
  updateStatus({ pendingCount: pending });

  // Start background service
  startSyncService();
}
