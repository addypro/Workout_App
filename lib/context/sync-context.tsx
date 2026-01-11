/**
 * Sync Context
 *
 * Provides sync state and methods throughout the app.
 * Initializes on mount and responds to auth state changes.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

import { syncService, SyncState, SyncableWorkout } from '@/lib/services/sync';
import { registerWorkoutSyncCallback, unregisterWorkoutSyncCallback } from '@/lib/db/storage';
import { useAuth, useUserId } from './auth-context';

interface SyncContextType {
  state: SyncState;
  queueWorkout: (workout: SyncableWorkout) => Promise<void>;
  forceSync: () => Promise<void>;
  isOnline: boolean;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user, isGuest } = useAuth();
  const userId = useUserId();
  const [state, setState] = useState<SyncState>({
    status: 'idle',
    pendingCount: 0,
  });

  // Initialize sync service and subscribe to state changes
  useEffect(() => {
    const effectiveUserId = isGuest || !user ? null : user.id;

    syncService.initialize(effectiveUserId);

    const unsubscribe = syncService.subscribe(setState);

    // Register callback so workouts are automatically queued when saved
    registerWorkoutSyncCallback(async (workout) => {
      await syncService.queueWorkout(workout);
    });

    return () => {
      unsubscribe();
      unregisterWorkoutSyncCallback();
      syncService.destroy();
    };
  }, []);

  // Update sync service when auth changes
  useEffect(() => {
    const effectiveUserId = isGuest || !user ? null : user.id;
    syncService.setUserId(effectiveUserId);
  }, [user, isGuest]);

  const queueWorkout = useCallback(async (workout: SyncableWorkout) => {
    await syncService.queueWorkout(workout);
  }, []);

  const forceSync = useCallback(async () => {
    await syncService.forceSync();
  }, []);

  const value: SyncContextType = {
    state,
    queueWorkout,
    forceSync,
    isOnline: state.status !== 'offline',
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

/**
 * Hook to get just the sync status
 */
export function useSyncStatus() {
  const { state, isOnline } = useSync();
  return {
    status: state.status,
    pendingCount: state.pendingCount,
    lastSyncAt: state.lastSyncAt,
    isOnline,
  };
}
