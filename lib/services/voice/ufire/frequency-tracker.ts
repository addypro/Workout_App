/**
 * User Exercise Frequency Tracker
 *
 * Tracks how often each user performs each exercise over time.
 * Used by the UFIRE Weighted Heuristic Scorer (WHS) for personalized ranking.
 *
 * Weight in UFIRE: ω₂ = 0.30 (User Frequency)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const FREQUENCY_KEY = '@ufire_exercise_frequency';
const FREQUENCY_WINDOW_DAYS = 90; // Track last 90 days

export interface ExerciseFrequencyData {
  exerciseName: string;
  normalizedName: string;
  totalCount: number;
  last90DaysCount: number;
  lastPerformed: string; // ISO date
  timestamps: string[]; // ISO dates of each occurrence
}

export interface FrequencyStore {
  userId: string;
  exercises: Record<string, ExerciseFrequencyData>;
  lastUpdated: string;
}

/**
 * Normalize exercise name for consistent tracking
 */
function normalizeExerciseName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Get the frequency store for a user
 */
async function getFrequencyStore(userId: string = 'local'): Promise<FrequencyStore> {
  try {
    const key = `${FREQUENCY_KEY}_${userId}`;
    const data = await AsyncStorage.getItem(key);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading frequency store:', error);
  }

  return {
    userId,
    exercises: {},
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Save the frequency store
 */
async function saveFrequencyStore(store: FrequencyStore): Promise<void> {
  try {
    const key = `${FREQUENCY_KEY}_${store.userId}`;
    store.lastUpdated = new Date().toISOString();
    await AsyncStorage.setItem(key, JSON.stringify(store));
  } catch (error) {
    console.error('Error saving frequency store:', error);
  }
}

/**
 * Record that an exercise was performed
 */
export async function recordExercisePerformed(
  exerciseName: string,
  userId: string = 'local'
): Promise<void> {
  const store = await getFrequencyStore(userId);
  const normalized = normalizeExerciseName(exerciseName);
  const now = new Date().toISOString();

  if (!store.exercises[normalized]) {
    store.exercises[normalized] = {
      exerciseName,
      normalizedName: normalized,
      totalCount: 0,
      last90DaysCount: 0,
      lastPerformed: now,
      timestamps: [],
    };
  }

  const entry = store.exercises[normalized];
  entry.totalCount++;
  entry.lastPerformed = now;
  entry.timestamps.push(now);

  // Prune old timestamps (keep only last 90 days)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - FREQUENCY_WINDOW_DAYS);
  entry.timestamps = entry.timestamps.filter(ts => new Date(ts) >= cutoffDate);
  entry.last90DaysCount = entry.timestamps.length;

  await saveFrequencyStore(store);
}

/**
 * Record multiple exercises from a completed workout
 */
export async function recordWorkoutExercises(
  exerciseNames: string[],
  userId: string = 'local'
): Promise<void> {
  const store = await getFrequencyStore(userId);
  const now = new Date().toISOString();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - FREQUENCY_WINDOW_DAYS);

  for (const exerciseName of exerciseNames) {
    const normalized = normalizeExerciseName(exerciseName);

    if (!store.exercises[normalized]) {
      store.exercises[normalized] = {
        exerciseName,
        normalizedName: normalized,
        totalCount: 0,
        last90DaysCount: 0,
        lastPerformed: now,
        timestamps: [],
      };
    }

    const entry = store.exercises[normalized];
    entry.totalCount++;
    entry.lastPerformed = now;
    entry.timestamps.push(now);

    // Prune old timestamps
    entry.timestamps = entry.timestamps.filter(ts => new Date(ts) >= cutoffDate);
    entry.last90DaysCount = entry.timestamps.length;
  }

  await saveFrequencyStore(store);
}

/**
 * Get frequency score for an exercise (0-1 normalized)
 * Higher score = more frequently performed
 */
export async function getExerciseFrequencyScore(
  exerciseName: string,
  userId: string = 'local'
): Promise<number> {
  const store = await getFrequencyStore(userId);
  const normalized = normalizeExerciseName(exerciseName);
  const entry = store.exercises[normalized];

  if (!entry) return 0;

  // Get max frequency for normalization
  let maxFrequency = 1;
  for (const ex of Object.values(store.exercises)) {
    if (ex.last90DaysCount > maxFrequency) {
      maxFrequency = ex.last90DaysCount;
    }
  }

  // Normalize to 0-1 range
  return entry.last90DaysCount / maxFrequency;
}

/**
 * Get frequency scores for multiple exercises at once (more efficient)
 */
export async function getExerciseFrequencyScores(
  exerciseNames: string[],
  userId: string = 'local'
): Promise<Record<string, number>> {
  const store = await getFrequencyStore(userId);

  // Get max frequency for normalization
  let maxFrequency = 1;
  for (const ex of Object.values(store.exercises)) {
    if (ex.last90DaysCount > maxFrequency) {
      maxFrequency = ex.last90DaysCount;
    }
  }

  const scores: Record<string, number> = {};

  for (const exerciseName of exerciseNames) {
    const normalized = normalizeExerciseName(exerciseName);
    const entry = store.exercises[normalized];
    scores[exerciseName] = entry ? entry.last90DaysCount / maxFrequency : 0;
  }

  return scores;
}

/**
 * Get top N most frequently performed exercises
 */
export async function getTopExercises(
  userId: string = 'local',
  limit: number = 20
): Promise<ExerciseFrequencyData[]> {
  const store = await getFrequencyStore(userId);

  return Object.values(store.exercises)
    .sort((a, b) => b.last90DaysCount - a.last90DaysCount)
    .slice(0, limit);
}

/**
 * Get recency score (0-1) based on when exercise was last performed
 * More recent = higher score
 */
export async function getRecencyScore(
  exerciseName: string,
  userId: string = 'local'
): Promise<number> {
  const store = await getFrequencyStore(userId);
  const normalized = normalizeExerciseName(exerciseName);
  const entry = store.exercises[normalized];

  if (!entry) return 0;

  const lastPerformed = new Date(entry.lastPerformed);
  const now = new Date();
  const daysSincePerformed = (now.getTime() - lastPerformed.getTime()) / (1000 * 60 * 60 * 24);

  // Decay function: score = e^(-λ * days)
  // λ = 0.05 means ~50% at 14 days, ~25% at 28 days
  const lambda = 0.05;
  return Math.exp(-lambda * daysSincePerformed);
}

/**
 * Clear all frequency data for a user
 */
export async function clearFrequencyData(userId: string = 'local'): Promise<void> {
  try {
    const key = `${FREQUENCY_KEY}_${userId}`;
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing frequency data:', error);
  }
}
