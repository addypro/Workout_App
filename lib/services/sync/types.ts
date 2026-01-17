/**
 * Sync Service Types
 *
 * Defines interfaces for sync operations and queue management.
 */

export interface SyncableWorkout {
  id: string;
  localId: string;
  workoutName: string;
  workoutType: 'program' | 'quick';
  completedAt: string;
  durationSeconds: number;
  exercises: SyncableExercise[];
}

export interface SyncableExercise {
  exerciseName: string;
  canonicalName: string;
  sets: SyncableSet[];
}

export interface SyncableSet {
  setNumber: number;
  weight?: number;
  reps?: number;
  time?: number;
  completed: boolean;
}

export interface PathsSyncPayload {
  userId: string;
  workoutId: string;
  source: 'assigned' | 'self';
  xpAwarded: number;
  updatedStats: Record<string, any>;  // exerciseKey -> UserLiftStats
  nodesCompleted: string[];
  pathInstanceId: string | null;
  planDelta: any | null;
}

export type QueuedItemData =
  | { type: 'workout'; data: SyncableWorkout }
  | { type: 'paths_progress'; data: PathsSyncPayload };

export interface QueuedItem {
  id: string;
  type: 'workout' | 'paths_progress';
  data: SyncableWorkout | PathsSyncPayload;
  createdAt: string;
  retryCount: number;
  lastAttempt?: string;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  itemId: string;
  error?: string;
  serverResponse?: any;
}

export interface PopularityCache {
  scores: Record<string, number>;
  generatedAt: string;
  version: number;
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncAt?: string;
  lastError?: string;
}
