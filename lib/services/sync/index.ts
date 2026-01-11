/**
 * Sync Service
 *
 * Main entry point for all sync operations.
 * Coordinates workout sync, popularity updates, and offline queue.
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';

import { syncQueue } from './queue';
import { syncWorkoutToServer } from './workout-sync';
import { syncPopularity, hasNewerPopularityData } from './popularity-sync';
import type {
  SyncableWorkout,
  SyncResult,
  SyncState,
  SyncStatus,
  PopularityCache,
} from './types';

type SyncListener = (state: SyncState) => void;

class SyncService {
  private listeners: Set<SyncListener> = new Set();
  private state: SyncState = {
    status: 'idle',
    pendingCount: 0,
  };
  private isOnline = true;
  private userId: string | null = null;
  private networkUnsubscribe: (() => void) | null = null;
  private appStateSubscription: any = null;
  private isSyncing = false;

  /**
   * Initialize the sync service
   */
  async initialize(userId: string | null): Promise<void> {
    this.userId = userId;

    // Load pending count
    const pendingCount = await syncQueue.getPendingCount();
    this.updateState({ pendingCount });

    // Setup network listener
    this.networkUnsubscribe = NetInfo.addEventListener(this.handleNetworkChange);

    // Setup app state listener for foreground sync
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange
    );

    // Check initial network state
    const netState = await NetInfo.fetch();
    this.isOnline = netState.isConnected ?? false;

    // Initial sync if online and logged in
    if (this.isOnline && this.userId) {
      this.syncAllPending();
    }
  }

  /**
   * Cleanup listeners
   */
  destroy(): void {
    this.networkUnsubscribe?.();
    this.appStateSubscription?.remove();
    this.listeners.clear();
  }

  /**
   * Set the current user ID (call on auth state change)
   */
  setUserId(userId: string | null): void {
    this.userId = userId;
    if (userId && this.isOnline) {
      this.syncAllPending();
    }
  }

  /**
   * Handle network state changes
   */
  private handleNetworkChange = (state: NetInfoState): void => {
    const wasOffline = !this.isOnline;
    this.isOnline = state.isConnected ?? false;

    if (this.isOnline) {
      this.updateState({ status: 'idle' });

      // Came back online - sync pending items
      if (wasOffline && this.userId) {
        syncQueue.resetRetries().then(() => this.syncAllPending());
      }
    } else {
      this.updateState({ status: 'offline' });
    }
  };

  /**
   * Handle app state changes (background/foreground)
   */
  private handleAppStateChange = (state: AppStateStatus): void => {
    if (state === 'active' && this.isOnline && this.userId) {
      // App came to foreground - check for pending sync
      this.syncAllPending();
      // Also check for popularity updates
      this.checkPopularityUpdates();
    }
  };

  /**
   * Queue a workout for sync
   */
  async queueWorkout(workout: SyncableWorkout): Promise<void> {
    await syncQueue.addWorkout(workout);
    const pendingCount = await syncQueue.getPendingCount();
    this.updateState({ pendingCount });

    // Try immediate sync if online
    if (this.isOnline && this.userId) {
      this.syncAllPending();
    }
  }

  /**
   * Sync all pending items
   */
  async syncAllPending(): Promise<SyncResult[]> {
    if (!this.userId || this.isSyncing || !this.isOnline) {
      return [];
    }

    this.isSyncing = true;
    this.updateState({ status: 'syncing' });

    const results: SyncResult[] = [];

    try {
      const pending = await syncQueue.getPending();

      for (const item of pending) {
        if (item.type === 'workout') {
          const result = await syncWorkoutToServer(item.data, this.userId);
          results.push(result);

          if (result.success) {
            await syncQueue.markSynced(item.id);
          } else {
            await syncQueue.markFailed(item.id, result.error || 'Unknown error');
          }
        }
      }

      const newPendingCount = await syncQueue.getPendingCount();
      this.updateState({
        status: 'idle',
        pendingCount: newPendingCount,
        lastSyncAt: new Date().toISOString(),
      });
    } catch (error: any) {
      this.updateState({
        status: 'error',
        lastError: error.message,
      });
    } finally {
      this.isSyncing = false;
    }

    return results;
  }

  /**
   * Check and sync popularity updates
   */
  async checkPopularityUpdates(): Promise<PopularityCache | null> {
    if (!this.isOnline) return null;

    try {
      const hasNewer = await hasNewerPopularityData();
      if (hasNewer) {
        return await syncPopularity(true);
      }
      return await syncPopularity(false);
    } catch (error) {
      console.error('Failed to check popularity updates:', error);
      return null;
    }
  }

  /**
   * Force a full sync
   */
  async forceSync(): Promise<void> {
    if (!this.isOnline) {
      this.updateState({ status: 'offline' });
      return;
    }

    await syncQueue.resetRetries();
    await this.syncAllPending();
    await syncPopularity(true);
  }

  /**
   * Get current sync state
   */
  getState(): SyncState {
    return { ...this.state };
  }

  /**
   * Subscribe to sync state changes
   */
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /**
   * Update state and notify listeners
   */
  private updateState(partial: Partial<SyncState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(listener => listener(this.state));
  }
}

// Export singleton instance
export const syncService = new SyncService();

// Re-export types
export type { SyncableWorkout, SyncResult, SyncState, SyncStatus, PopularityCache };
export { syncQueue } from './queue';
export { syncPopularity } from './popularity-sync';
