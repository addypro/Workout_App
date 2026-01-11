/**
 * Custom Exercises Service
 *
 * Allows users to create custom exercises not in the main database.
 * Features:
 * - Local storage for offline-first experience
 * - Sync to Supabase for pattern detection
 * - Automatic promotion to main database when many users add same exercise
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase/client';

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
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_EXERCISES);
    if (!data) return [];

    const exercises: CustomExercise[] = JSON.parse(data);
    return exercises.map((e) => ({
      ...e,
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt),
      lastSyncedAt: e.lastSyncedAt ? new Date(e.lastSyncedAt) : undefined,
    }));
  } catch (error) {
    console.error('Error loading custom exercises:', error);
    return [];
  }
}

/**
 * Create a new custom exercise
 */
export async function createCustomExercise(
  input: CustomExerciseInput
): Promise<CustomExercise> {
  const userId = await getUserId();
  const now = new Date();

  const exercise: CustomExercise = {
    id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: input.name.trim(),
    normalizedName: normalizeExerciseName(input.name),
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

  // Save locally
  const exercises = await getCustomExercises();

  // Check for duplicate
  const existingIndex = exercises.findIndex(
    (e) => e.normalizedName === exercise.normalizedName
  );

  if (existingIndex >= 0) {
    // Update existing
    exercises[existingIndex] = {
      ...exercises[existingIndex],
      ...exercise,
      id: exercises[existingIndex].id, // Keep original ID
      usageCount: exercises[existingIndex].usageCount,
      createdAt: exercises[existingIndex].createdAt,
    };
  } else {
    exercises.push(exercise);
  }

  await AsyncStorage.setItem(
    STORAGE_KEYS.CUSTOM_EXERCISES,
    JSON.stringify(exercises)
  );

  // Queue for sync
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
  type: 'upsert' | 'delete';
  exercise?: CustomExercise;
  exerciseId?: string;
  timestamp: number;
}

/**
 * Queue exercise for sync
 */
async function queueForSync(exercise: CustomExercise): Promise<void> {
  const queue = await getSyncQueue();
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
  const queue = await getSyncQueue();
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
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Sync custom exercises to Supabase
 */
export async function syncCustomExercises(): Promise<{
  synced: number;
  failed: number;
}> {
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
      } else if (item.type === 'delete' && item.exerciseId) {
        const { error } = await supabase
          .from('custom_exercises')
          .delete()
          .eq('id', item.exerciseId);

        if (error) throw error;
        synced++;
      }
    } catch (error) {
      console.warn('Sync failed for item:', error);
      remainingQueue.push(item);
      failed++;
    }
  }

  // Update queue with failed items
  await AsyncStorage.setItem(
    STORAGE_KEYS.SYNC_QUEUE,
    JSON.stringify(remainingQueue)
  );

  return { synced, failed };
}

/**
 * Update local sync status
 */
async function updateLocalSyncStatus(
  id: string,
  status: CustomExercise['syncStatus']
): Promise<void> {
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
