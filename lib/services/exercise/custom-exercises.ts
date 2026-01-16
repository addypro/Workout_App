/**
 * Custom Exercises Service
 *
 * Allows users to create custom exercises not in the main database.
 * Features:
 * - Local storage for offline-first experience
 * - Sync to Supabase for pattern detection
 * - Automatic promotion to main database when many users add same exercise
 */

import { supabase } from '@/lib/supabase/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureCustomExerciseTables, getDatabase } from '@/lib/db/sqlite';

// ============================================
// Types
// ============================================

export interface CustomExercise {
  id: string;
  name: string;
  normalizedName: string; // For matching/deduplication
  userId: string;

  // Exercise metadata
  equipment?: string[];
  muscleGroups?: string[];
  movementPattern?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  notes?: string;

  // Tracking
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;

  // Sync status
  syncStatus: 'pending' | 'synced' | 'failed';
  lastSyncedAt?: Date;

  // Visibility
  isPromoted: boolean; // True if promoted to global database
}

export interface CustomExerciseInput {
  name: string;
  equipment?: string[];
  muscleGroups?: string[];
  movementPattern?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  notes?: string;
}

// Pattern detection for promotion
export interface ExercisePattern {
  normalizedName: string;
  uniqueUserCount: number;
  totalUsageCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  meetsPromotionThreshold: boolean;
}

// ============================================
// Constants
// ============================================

const STORAGE_KEYS = {
  CUSTOM_EXERCISES: '@custom_exercises',
  SYNC_QUEUE: '@custom_exercises_sync_queue',
  USER_ID: '@user_id',
};

// Promotion thresholds
const PROMOTION_THRESHOLDS = {
  MIN_UNIQUE_USERS: 10,    // At least 10 unique users
  MIN_TOTAL_USAGE: 50,     // At least 50 total uses
  MIN_DAYS_EXISTED: 7,      // Existed for at least 7 days
};

type CustomExerciseRow = {
  id: string;
  user_id: string;
  name: string;
  normalized_name: string;
  equipment_json: string | null;
  muscle_groups_json: string | null;
  movement_pattern: string | null;
  difficulty: CustomExercise['difficulty'] | null;
  notes: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
  sync_status: CustomExercise['syncStatus'];
  last_synced_at: string | null;
  is_promoted: number;
};

type SyncQueueRow = {
  id: string;
  type: SyncQueueItem['type'];
  exercise_json: string | null;
  exercise_id: string | null;
  timestamp: number;
};

async function getCustomExerciseDb() {
  const db = await getDatabase();
  if (!db) {
    return null;
  }

  const ready = await ensureCustomExerciseTables();
  if (!ready) {
    return null;
  }

  return db;
}

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ensureDate(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value : new Date(value);
}

function serializeCustomExercise(exercise: CustomExercise) {
  return {
    ...exercise,
    createdAt: exercise.createdAt.toISOString(),
    updatedAt: exercise.updatedAt.toISOString(),
    lastSyncedAt: exercise.lastSyncedAt ? exercise.lastSyncedAt.toISOString() : undefined,
  };
}

function deserializeCustomExercise(raw: any): CustomExercise {
  return {
    ...raw,
    createdAt: ensureDate(raw.createdAt) || new Date(),
    updatedAt: ensureDate(raw.updatedAt) || new Date(),
    lastSyncedAt: ensureDate(raw.lastSyncedAt),
    equipment: Array.isArray(raw.equipment) ? raw.equipment : [],
    muscleGroups: Array.isArray(raw.muscleGroups) ? raw.muscleGroups : [],
    usageCount: typeof raw.usageCount === 'number' ? raw.usageCount : 0,
    syncStatus: raw.syncStatus || 'pending',
    isPromoted: !!raw.isPromoted,
  };
}

function mapCustomExerciseRow(row: CustomExerciseRow): CustomExercise {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    normalizedName: row.normalized_name,
    equipment: parseJsonArray(row.equipment_json),
    muscleGroups: parseJsonArray(row.muscle_groups_json),
    movementPattern: row.movement_pattern ?? undefined,
    difficulty: row.difficulty ?? undefined,
    notes: row.notes ?? undefined,
    usageCount: row.usage_count,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    syncStatus: row.sync_status,
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at) : undefined,
    isPromoted: row.is_promoted === 1,
  };
}

async function loadCustomExercisesFromAsyncStorage(): Promise<CustomExercise[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_EXERCISES);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(deserializeCustomExercise);
  } catch (error) {
    console.error('Error loading custom exercises:', error);
    return [];
  }
}

function deserializeSyncQueueItem(raw: any): SyncQueueItem {
  const parsedTimestamp = typeof raw.timestamp === 'number' ? raw.timestamp : Date.parse(raw.timestamp);
  return {
    type: raw.type,
    exercise: raw.exercise ? deserializeCustomExercise(raw.exercise) : undefined,
    exerciseId: raw.exerciseId,
    timestamp: Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now(),
  };
}

async function loadSyncQueueFromAsyncStorage(): Promise<SyncQueueItem[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(deserializeSyncQueueItem);
  } catch {
    return [];
  }
}

// ============================================
// Local Storage Functions
// ============================================

/**
 * Get user ID (anonymous or authenticated)
 */
async function getUserId(): Promise<string> {
  let userId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);

  if (!userId) {
    // Check if logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      userId = session.user.id;
    } else {
      // Generate anonymous ID
      userId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, userId);
  }

  return userId;
}

/**
 * Normalize exercise name for matching
 */
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')     // Collapse whitespace
    .trim();
}

/**
 * Get all custom exercises for current user
 */
export async function getCustomExercises(): Promise<CustomExercise[]> {
  const userId = await getUserId();
  const db = await getCustomExerciseDb();

  if (db) {
    try {
      const rows = await db.getAllAsync<CustomExerciseRow>(
        `SELECT id, user_id, name, normalized_name, equipment_json, muscle_groups_json,
            movement_pattern, difficulty, notes, usage_count, created_at, updated_at,
            sync_status, last_synced_at, is_promoted
         FROM custom_exercises
         WHERE user_id = ?
         ORDER BY updated_at DESC`,
        [userId]
      );

      if (rows.length > 0) {
        return rows.map(mapCustomExerciseRow);
      }

      const legacy = await loadCustomExercisesFromAsyncStorage();
      if (legacy.length > 0) {
        await db.withTransactionAsync(async () => {
          for (const exercise of legacy) {
            await db.runAsync(
              `INSERT OR REPLACE INTO custom_exercises (
                id, user_id, name, normalized_name, equipment_json, muscle_groups_json,
                movement_pattern, difficulty, notes, usage_count, created_at, updated_at,
                sync_status, last_synced_at, is_promoted
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                exercise.id,
                exercise.userId,
                exercise.name,
                exercise.normalizedName,
                JSON.stringify(exercise.equipment || []),
                JSON.stringify(exercise.muscleGroups || []),
                exercise.movementPattern ?? null,
                exercise.difficulty ?? null,
                exercise.notes ?? null,
                exercise.usageCount,
                exercise.createdAt.toISOString(),
                exercise.updatedAt.toISOString(),
                exercise.syncStatus,
                exercise.lastSyncedAt ? exercise.lastSyncedAt.toISOString() : null,
                exercise.isPromoted ? 1 : 0,
              ]
            );
          }
        });
      }

      return legacy.filter(exercise => exercise.userId === userId);
    } catch (error) {
      console.error('Error loading custom exercises:', error);
    }
  }

  const exercises = await loadCustomExercisesFromAsyncStorage();
  return exercises.filter(e => e.userId === userId);
}

/**
 * Create a new custom exercise
 */
export async function createCustomExercise(
  input: CustomExerciseInput
): Promise<CustomExercise> {
  const userId = await getUserId();
  const now = new Date();
  const normalizedName = normalizeExerciseName(input.name);
  const db = await getCustomExerciseDb();

  if (db) {
    try {
      const existingRow = await db.getFirstAsync<CustomExerciseRow>(
        `SELECT id, user_id, name, normalized_name, equipment_json, muscle_groups_json,
            movement_pattern, difficulty, notes, usage_count, created_at, updated_at,
            sync_status, last_synced_at, is_promoted
         FROM custom_exercises
         WHERE user_id = ? AND normalized_name = ?`,
        [userId, normalizedName]
      );

      const exercise: CustomExercise = existingRow
        ? {
            ...mapCustomExerciseRow(existingRow),
            name: input.name.trim(),
            normalizedName,
            equipment: input.equipment || [],
            muscleGroups: input.muscleGroups || [],
            movementPattern: input.movementPattern,
            difficulty: input.difficulty,
            notes: input.notes,
            updatedAt: now,
            syncStatus: 'pending',
          }
        : {
            id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: input.name.trim(),
            normalizedName,
            userId,
            equipment: input.equipment || [],
            muscleGroups: input.muscleGroups || [],
            movementPattern: input.movementPattern,
            difficulty: input.difficulty,
            notes: input.notes,
            usageCount: 0,
            createdAt: now,
            updatedAt: now,
            syncStatus: 'pending',
            isPromoted: false,
          };

      await db.runAsync(
        `INSERT OR REPLACE INTO custom_exercises (
          id, user_id, name, normalized_name, equipment_json, muscle_groups_json,
          movement_pattern, difficulty, notes, usage_count, created_at, updated_at,
          sync_status, last_synced_at, is_promoted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          exercise.id,
          exercise.userId,
          exercise.name,
          exercise.normalizedName,
          JSON.stringify(exercise.equipment || []),
          JSON.stringify(exercise.muscleGroups || []),
          exercise.movementPattern ?? null,
          exercise.difficulty ?? null,
          exercise.notes ?? null,
          exercise.usageCount,
          exercise.createdAt.toISOString(),
          exercise.updatedAt.toISOString(),
          exercise.syncStatus,
          exercise.lastSyncedAt ? exercise.lastSyncedAt.toISOString() : null,
          exercise.isPromoted ? 1 : 0,
        ]
      );

      await queueForSync(exercise);
      return exercise;
    } catch (error) {
      console.error('Error saving custom exercise:', error);
    }
  }

  const exercise: CustomExercise = {
    id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: input.name.trim(),
    normalizedName,
    userId,
    equipment: input.equipment || [],
    muscleGroups: input.muscleGroups || [],
    movementPattern: input.movementPattern,
    difficulty: input.difficulty,
    notes: input.notes,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    isPromoted: false,
  };

  const exercises = await getCustomExercises();
  const existingIndex = exercises.findIndex(
    (e) => e.normalizedName === exercise.normalizedName
  );

  if (existingIndex >= 0) {
    exercises[existingIndex] = {
      ...exercises[existingIndex],
      ...exercise,
      id: exercises[existingIndex].id,
      usageCount: exercises[existingIndex].usageCount,
      createdAt: exercises[existingIndex].createdAt,
    };
  } else {
    exercises.push(exercise);
  }

  await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_EXERCISES, JSON.stringify(exercises));
  await queueForSync(exercise);
  return exercise;
}

/**
 * Update custom exercise
 */
export async function updateCustomExercise(
  id: string,
  updates: Partial<CustomExerciseInput>
): Promise<CustomExercise | null> {
  const db = await getCustomExerciseDb();

  if (db) {
    try {
      const existingRow = await db.getFirstAsync<CustomExerciseRow>(
        `SELECT id, user_id, name, normalized_name, equipment_json, muscle_groups_json,
            movement_pattern, difficulty, notes, usage_count, created_at, updated_at,
            sync_status, last_synced_at, is_promoted
         FROM custom_exercises
         WHERE id = ?`,
        [id]
      );

      if (!existingRow) return null;

      const existing = mapCustomExerciseRow(existingRow);
      const updated: CustomExercise = {
        ...existing,
        ...updates,
        normalizedName: updates.name
          ? normalizeExerciseName(updates.name)
          : existing.normalizedName,
        updatedAt: new Date(),
        syncStatus: 'pending',
      };

      await db.runAsync(
        `INSERT OR REPLACE INTO custom_exercises (
          id, user_id, name, normalized_name, equipment_json, muscle_groups_json,
          movement_pattern, difficulty, notes, usage_count, created_at, updated_at,
          sync_status, last_synced_at, is_promoted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          updated.id,
          updated.userId,
          updated.name,
          updated.normalizedName,
          JSON.stringify(updated.equipment || []),
          JSON.stringify(updated.muscleGroups || []),
          updated.movementPattern ?? null,
          updated.difficulty ?? null,
          updated.notes ?? null,
          updated.usageCount,
          updated.createdAt.toISOString(),
          updated.updatedAt.toISOString(),
          updated.syncStatus,
          updated.lastSyncedAt ? updated.lastSyncedAt.toISOString() : null,
          updated.isPromoted ? 1 : 0,
        ]
      );

      await queueForSync(updated);
      return updated;
    } catch (error) {
      console.error('Error updating custom exercise:', error);
    }
  }

  const exercises = await getCustomExercises();
  const index = exercises.findIndex((e) => e.id === id);

  if (index < 0) return null;

  const updated: CustomExercise = {
    ...exercises[index],
    ...updates,
    normalizedName: updates.name
      ? normalizeExerciseName(updates.name)
      : exercises[index].normalizedName,
    updatedAt: new Date(),
    syncStatus: 'pending',
  };

  exercises[index] = updated;
  await AsyncStorage.setItem(
    STORAGE_KEYS.CUSTOM_EXERCISES,
    JSON.stringify(exercises)
  );

  await queueForSync(updated);
  return updated;
}

/**
 * Delete custom exercise
 */
export async function deleteCustomExercise(id: string): Promise<boolean> {
  const db = await getCustomExerciseDb();
  if (db) {
    try {
      const userId = await getUserId();
      const existing = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM custom_exercises WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (!existing) return false;

      await db.runAsync('DELETE FROM custom_exercises WHERE id = ? AND user_id = ?', [id, userId]);
      await queueDeletionForSync(id);
      return true;
    } catch (error) {
      console.error('Error deleting custom exercise:', error);
    }
  }

  const exercises = await getCustomExercises();
  const filtered = exercises.filter((e) => e.id !== id);

  if (filtered.length === exercises.length) return false;

  await AsyncStorage.setItem(
    STORAGE_KEYS.CUSTOM_EXERCISES,
    JSON.stringify(filtered)
  );

  // Queue deletion for sync
  await queueDeletionForSync(id);
  return true;
}

/**
 * Increment usage count for a custom exercise
 */
export async function incrementUsageCount(id: string): Promise<void> {
  const db = await getCustomExerciseDb();
  if (db) {
    try {
      const existingRow = await db.getFirstAsync<CustomExerciseRow>(
        `SELECT id, user_id, name, normalized_name, equipment_json, muscle_groups_json,
            movement_pattern, difficulty, notes, usage_count, created_at, updated_at,
            sync_status, last_synced_at, is_promoted
         FROM custom_exercises
         WHERE id = ?`,
        [id]
      );

      if (!existingRow) return;

      const existing = mapCustomExerciseRow(existingRow);
      const updated: CustomExercise = {
        ...existing,
        usageCount: existing.usageCount + 1,
        updatedAt: new Date(),
        syncStatus: 'pending',
      };

      await db.runAsync(
        `INSERT OR REPLACE INTO custom_exercises (
          id, user_id, name, normalized_name, equipment_json, muscle_groups_json,
          movement_pattern, difficulty, notes, usage_count, created_at, updated_at,
          sync_status, last_synced_at, is_promoted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          updated.id,
          updated.userId,
          updated.name,
          updated.normalizedName,
          JSON.stringify(updated.equipment || []),
          JSON.stringify(updated.muscleGroups || []),
          updated.movementPattern ?? null,
          updated.difficulty ?? null,
          updated.notes ?? null,
          updated.usageCount,
          updated.createdAt.toISOString(),
          updated.updatedAt.toISOString(),
          updated.syncStatus,
          updated.lastSyncedAt ? updated.lastSyncedAt.toISOString() : null,
          updated.isPromoted ? 1 : 0,
        ]
      );

      await queueForSync(updated);
      return;
    } catch (error) {
      console.error('Error incrementing usage count:', error);
    }
  }

  const exercises = await getCustomExercises();
  const index = exercises.findIndex((e) => e.id === id);

  if (index < 0) return;

  exercises[index].usageCount++;
  exercises[index].updatedAt = new Date();
  exercises[index].syncStatus = 'pending';

  await AsyncStorage.setItem(
    STORAGE_KEYS.CUSTOM_EXERCISES,
    JSON.stringify(exercises)
  );

  await queueForSync(exercises[index]);
}

/**
 * Search custom exercises
 */
export async function searchCustomExercises(
  query: string
): Promise<CustomExercise[]> {
  const exercises = await getCustomExercises();
  const normalizedQuery = normalizeExerciseName(query);

  return exercises
    .filter((e) => {
      const nameMatch = e.normalizedName.includes(normalizedQuery);
      const equipmentMatch = e.equipment?.some((eq) =>
        eq.toLowerCase().includes(normalizedQuery)
      );
      const muscleMatch = e.muscleGroups?.some((mg) =>
        mg.toLowerCase().includes(normalizedQuery)
      );
      return nameMatch || equipmentMatch || muscleMatch;
    })
    .sort((a, b) => b.usageCount - a.usageCount); // Sort by popularity
}

/**
 * Check if exercise with name already exists
 */
export async function customExerciseExists(name: string): Promise<boolean> {
  const exercises = await getCustomExercises();
  const normalized = normalizeExerciseName(name);
  return exercises.some((e) => e.normalizedName === normalized);
}

// ============================================
// Sync Functions
// ============================================

interface SyncQueueItem {
  queueId?: string;
  type: 'upsert' | 'delete';
  exercise?: CustomExercise;
  exerciseId?: string;
  timestamp: number;
}

/**
 * Queue exercise for sync
 */
async function queueForSync(exercise: CustomExercise): Promise<void> {
  const db = await getCustomExerciseDb();
  if (db) {
    try {
      await db.runAsync(
        `INSERT INTO custom_exercise_sync_queue (
          id, type, exercise_json, exercise_id, timestamp
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          `ceq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          'upsert',
          JSON.stringify(serializeCustomExercise(exercise)),
          exercise.id,
          Date.now(),
        ]
      );
      return;
    } catch (error) {
      console.error('Error queueing custom exercise:', error);
    }
  }

  const queue = await loadSyncQueueFromAsyncStorage();
  queue.push({
    type: 'upsert',
    exercise,
    timestamp: Date.now(),
  });
  await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
}

/**
 * Queue deletion for sync
 */
async function queueDeletionForSync(exerciseId: string): Promise<void> {
  const db = await getCustomExerciseDb();
  if (db) {
    try {
      await db.runAsync(
        `INSERT INTO custom_exercise_sync_queue (
          id, type, exercise_json, exercise_id, timestamp
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          `ceq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          'delete',
          null,
          exerciseId,
          Date.now(),
        ]
      );
      return;
    } catch (error) {
      console.error('Error queueing custom exercise deletion:', error);
    }
  }

  const queue = await loadSyncQueueFromAsyncStorage();
  queue.push({
    type: 'delete',
    exerciseId,
    timestamp: Date.now(),
  });
  await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
}

/**
 * Get sync queue
 */
async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getCustomExerciseDb();
  if (db) {
    try {
      const rows = await db.getAllAsync<SyncQueueRow>(
        `SELECT id, type, exercise_json, exercise_id, timestamp
         FROM custom_exercise_sync_queue
         ORDER BY timestamp ASC`
      );

      if (rows.length > 0) {
        return rows.map(row => ({
          queueId: row.id,
          type: row.type,
          exercise: row.exercise_json ? deserializeCustomExercise(JSON.parse(row.exercise_json)) : undefined,
          exerciseId: row.exercise_id ?? undefined,
          timestamp: row.timestamp,
        }));
      }

      const legacy = await loadSyncQueueFromAsyncStorage();
      if (legacy.length > 0) {
        const migrated: SyncQueueItem[] = [];
        await db.withTransactionAsync(async () => {
          for (const item of legacy) {
            const queueId = `ceq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            await db.runAsync(
              `INSERT INTO custom_exercise_sync_queue (
                id, type, exercise_json, exercise_id, timestamp
              ) VALUES (?, ?, ?, ?, ?)`,
              [
                queueId,
                item.type,
                item.exercise ? JSON.stringify(serializeCustomExercise(item.exercise)) : null,
                item.exerciseId ?? item.exercise?.id ?? null,
                item.timestamp,
              ]
            );
            migrated.push({ ...item, queueId });
          }
        });
        return migrated;
      }

      return legacy;
    } catch (error) {
      console.error('Error loading sync queue:', error);
    }
  }

  return loadSyncQueueFromAsyncStorage();
}

/**
 * Sync custom exercises to Supabase
 */
export async function syncCustomExercises(): Promise<{
  synced: number;
  failed: number;
}> {
  const db = await getCustomExerciseDb();
  const queue = await getSyncQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remainingQueue: SyncQueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'upsert' && item.exercise) {
        const { error } = await supabase.from('custom_exercises').upsert({
          id: item.exercise.id,
          user_id: item.exercise.userId,
          name: item.exercise.name,
          normalized_name: item.exercise.normalizedName,
          equipment: item.exercise.equipment,
          muscle_groups: item.exercise.muscleGroups,
          movement_pattern: item.exercise.movementPattern,
          difficulty: item.exercise.difficulty,
          notes: item.exercise.notes,
          usage_count: item.exercise.usageCount,
          created_at: item.exercise.createdAt.toISOString(),
          updated_at: item.exercise.updatedAt.toISOString(),
        });

        if (error) throw error;

        // Update local sync status
        await updateLocalSyncStatus(item.exercise.id, 'synced');
        synced++;
        if (db && item.queueId) {
          await db.runAsync('DELETE FROM custom_exercise_sync_queue WHERE id = ?', [item.queueId]);
        }
      } else if (item.type === 'delete' && item.exerciseId) {
        const { error } = await supabase
          .from('custom_exercises')
          .delete()
          .eq('id', item.exerciseId);

        if (error) throw error;
        synced++;
        if (db && item.queueId) {
          await db.runAsync('DELETE FROM custom_exercise_sync_queue WHERE id = ?', [item.queueId]);
        }
      }
    } catch (error) {
      console.warn('Sync failed for item:', error);
      if (!db) {
        remainingQueue.push(item);
      }
      failed++;
    }
  }

  if (!db) {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SYNC_QUEUE,
      JSON.stringify(remainingQueue)
    );
  }

  return { synced, failed };
}

/**
 * Update local sync status
 */
async function updateLocalSyncStatus(
  id: string,
  status: CustomExercise['syncStatus']
): Promise<void> {
  const db = await getCustomExerciseDb();
  if (db) {
    try {
      const existingRow = await db.getFirstAsync<CustomExerciseRow>(
        `SELECT id, user_id, name, normalized_name, equipment_json, muscle_groups_json,
            movement_pattern, difficulty, notes, usage_count, created_at, updated_at,
            sync_status, last_synced_at, is_promoted
         FROM custom_exercises
         WHERE id = ?`,
        [id]
      );

      if (!existingRow) return;

      const existing = mapCustomExerciseRow(existingRow);
      const updated: CustomExercise = {
        ...existing,
        syncStatus: status,
        lastSyncedAt: new Date(),
      };

      await db.runAsync(
        `INSERT OR REPLACE INTO custom_exercises (
          id, user_id, name, normalized_name, equipment_json, muscle_groups_json,
          movement_pattern, difficulty, notes, usage_count, created_at, updated_at,
          sync_status, last_synced_at, is_promoted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          updated.id,
          updated.userId,
          updated.name,
          updated.normalizedName,
          JSON.stringify(updated.equipment || []),
          JSON.stringify(updated.muscleGroups || []),
          updated.movementPattern ?? null,
          updated.difficulty ?? null,
          updated.notes ?? null,
          updated.usageCount,
          updated.createdAt.toISOString(),
          updated.updatedAt.toISOString(),
          updated.syncStatus,
          updated.lastSyncedAt ? updated.lastSyncedAt.toISOString() : null,
          updated.isPromoted ? 1 : 0,
        ]
      );
      return;
    } catch (error) {
      console.error('Error updating sync status:', error);
    }
  }

  const exercises = await getCustomExercises();
  const index = exercises.findIndex((e) => e.id === id);

  if (index >= 0) {
    exercises[index].syncStatus = status;
    exercises[index].lastSyncedAt = new Date();
    await AsyncStorage.setItem(
      STORAGE_KEYS.CUSTOM_EXERCISES,
      JSON.stringify(exercises)
    );
  }
}

/**
 * Fetch promoted exercises from server
 * These are custom exercises that were promoted to global visibility
 */
export async function fetchPromotedExercises(): Promise<CustomExercise[]> {
  try {
    const { data, error } = await supabase
      .from('promoted_exercises')
      .select('*')
      .order('usage_count', { ascending: false })
      .limit(100);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      normalizedName: row.normalized_name,
      userId: 'global',
      equipment: row.equipment || [],
      muscleGroups: row.muscle_groups || [],
      movementPattern: row.movement_pattern,
      difficulty: row.difficulty,
      notes: row.notes,
      usageCount: row.usage_count || 0,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      syncStatus: 'synced' as const,
      isPromoted: true,
    }));
  } catch (error) {
    console.warn('Failed to fetch promoted exercises:', error);
    return [];
  }
}

// ============================================
// Integration with Exercise Search
// ============================================

/**
 * Get all exercises for search (custom + promoted)
 */
export async function getAllUserExercises(): Promise<CustomExercise[]> {
  const [custom, promoted] = await Promise.all([
    getCustomExercises(),
    fetchPromotedExercises(),
  ]);

  // Deduplicate - prefer custom over promoted
  const normalizedNames = new Set(custom.map((e) => e.normalizedName));
  const uniquePromoted = promoted.filter(
    (e) => !normalizedNames.has(e.normalizedName)
  );

  return [...custom, ...uniquePromoted];
}

/**
 * Convert custom exercise to search result format
 */
export function customExerciseToSearchResult(
  exercise: CustomExercise
): {
  id: string;
  name: string;
  score: number;
  source: 'custom' | 'promoted';
} {
  return {
    id: exercise.id,
    name: exercise.name,
    score: 50 + Math.min(50, exercise.usageCount), // Base 50 + usage bonus
    source: exercise.isPromoted ? 'promoted' : 'custom',
  };
}
