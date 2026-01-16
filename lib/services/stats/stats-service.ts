/**
 * Stats Service
 *
 * Calculates workout analytics from unified history:
 * - Exercise progress over time
 * - Personal records tracking
 * - Volume and frequency metrics
 * - Streak calculations
 */

import { getUnifiedHistory, type UnifiedWorkoutRecord } from '@/lib/db/storage';
import { buildHistoricalPRs, detectExercisePRs } from './pr-detector';
import {
  TIME_RANGES,
  type ExerciseProgressPoint,
  type ExerciseStats,
  type PersonalRecord,
  type StatsSnapshot,
  type TimeRange,
} from './types';

// Cache for expensive calculations
let _statsCache: StatsSnapshot | null = null;
let _lastCacheTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Calculate comprehensive stats from workout history
 */
export async function calculateStats(
  userId: string = 'local',
  forceRefresh = false
): Promise<StatsSnapshot> {
  const now = Date.now();

  // Return cached if fresh
  if (!forceRefresh && _statsCache && now - _lastCacheTime < CACHE_TTL_MS) {
    return _statsCache;
  }

  const history = await getUnifiedHistory(userId);

  const stats: StatsSnapshot = {
    totalWorkouts: history.length,
    totalExercises: 0,
    currentStreak: calculateCurrentStreak(history),
    longestStreak: calculateLongestStreak(history),
    prsThisMonth: 0,
    prsAllTime: 0,
    exerciseStats: new Map(),
    muscleGroupFrequency: new Map(),
    lastWorkoutDate: history.length > 0 ? history[0].completedAt : null,
    lastUpdated: new Date().toISOString(),
  };

  // Build exercise stats
  const exerciseNames = new Set<string>();
  for (const workout of history) {
    for (const exercise of workout.exercises) {
      exerciseNames.add(exercise.name.toLowerCase().trim());
    }
  }

  stats.totalExercises = exerciseNames.size;

  // Calculate stats for each exercise
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  for (const exerciseName of exerciseNames) {
    const exerciseStats = calculateExerciseStats(exerciseName, history);
    stats.exerciseStats.set(exerciseName, exerciseStats);

    // Count PRs
    stats.prsAllTime += exerciseStats.prHistory.length;
    stats.prsThisMonth += exerciseStats.prHistory.filter(
      pr => new Date(pr.achievedAt) >= monthAgo
    ).length;
  }

  // Cache results
  _statsCache = stats;
  _lastCacheTime = now;

  return stats;
}

/**
 * Calculate stats for a single exercise
 */
export function calculateExerciseStats(
  exerciseName: string,
  history: UnifiedWorkoutRecord[]
): ExerciseStats {
  const normalizedName = exerciseName.toLowerCase().trim();

  // Build PRs from history
  const { oneRepMax, repPRs, volumePR, allPRs } = buildHistoricalPRs(
    exerciseName,
    history
  );

  // Build progress data points
  const progressData: ExerciseProgressPoint[] = [];
  let totalSets = 0;
  let totalVolume = 0;
  let lastPerformed = '';

  // Process from oldest to newest for proper timeline
  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  );

  for (const workout of sortedHistory) {
    for (const exercise of workout.exercises) {
      if (exercise.name.toLowerCase().trim() !== normalizedName) continue;

      lastPerformed = workout.completedAt;
      totalSets += exercise.setsCompleted;

      // Calculate session metrics
      let sessionMaxWeight = 0;
      let sessionVolume = 0;
      let sessionSets = 0;

      if (exercise.sets) {
        for (const set of exercise.sets) {
          if (set.isCompleted === false) continue;
          const weight = set.weight || 0;
          sessionMaxWeight = Math.max(sessionMaxWeight, weight);
          sessionVolume += weight * set.reps;
          sessionSets++;
        }
      } else if (exercise.bestSet) {
        sessionMaxWeight = exercise.bestSet.weight || 0;
        sessionVolume = sessionMaxWeight * exercise.bestSet.reps * exercise.setsCompleted;
        sessionSets = exercise.setsCompleted;
      }

      totalVolume += sessionVolume;

      if (sessionMaxWeight > 0) {
        progressData.push({
          date: workout.completedAt,
          maxWeight: sessionMaxWeight,
          totalVolume: sessionVolume,
          totalSets: sessionSets,
        });
      }
    }
  }

  // Find display name (use most recent capitalization)
  let displayName = exerciseName;
  for (const workout of history) {
    for (const exercise of workout.exercises) {
      if (exercise.name.toLowerCase().trim() === normalizedName) {
        displayName = exercise.name;
        break;
      }
    }
  }

  return {
    exerciseName: displayName,
    totalSets,
    totalVolume,
    lastPerformed,
    currentPRs: {
      oneRepMax,
      repPRs,
      volumePR,
    },
    prHistory: allPRs,
    progressData,
  };
}

/**
 * Get exercise progress filtered by time range
 */
export function getProgressInRange(
  stats: ExerciseStats,
  range: TimeRange['value']
): ExerciseProgressPoint[] {
  const rangeConfig = TIME_RANGES.find(r => r.value === range);
  if (!rangeConfig || rangeConfig.days === null) {
    return stats.progressData;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - rangeConfig.days);

  return stats.progressData.filter(
    point => new Date(point.date) >= cutoffDate
  );
}

/**
 * Calculate current workout streak
 * Counts consecutive days with at least one workout
 */
function calculateCurrentStreak(history: UnifiedWorkoutRecord[]): number {
  if (history.length === 0) return 0;

  // Get unique workout days
  const workoutDays = new Set<string>();
  for (const workout of history) {
    const date = new Date(workout.completedAt);
    workoutDays.add(date.toISOString().split('T')[0]);
  }

  const sortedDays = [...workoutDays].sort().reverse();
  if (sortedDays.length === 0) return 0;

  // Check if most recent workout was today or yesterday
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (sortedDays[0] !== todayStr && sortedDays[0] !== yesterdayStr) {
    return 0; // Streak broken
  }

  // Count consecutive days
  let streak = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const current = new Date(sortedDays[i - 1]);
    const previous = new Date(sortedDays[i]);
    const diffDays = Math.round(
      (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculate longest streak ever
 */
function calculateLongestStreak(history: UnifiedWorkoutRecord[]): number {
  if (history.length === 0) return 0;

  // Get unique workout days
  const workoutDays = new Set<string>();
  for (const workout of history) {
    const date = new Date(workout.completedAt);
    workoutDays.add(date.toISOString().split('T')[0]);
  }

  const sortedDays = [...workoutDays].sort();
  if (sortedDays.length === 0) return 0;

  let longestStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sortedDays.length; i++) {
    const previous = new Date(sortedDays[i - 1]);
    const current = new Date(sortedDays[i]);
    const diffDays = Math.round(
      (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return longestStreak;
}

/**
 * Get top exercises by frequency
 */
export async function getTopExercises(
  userId: string = 'local',
  limit = 10
): Promise<ExerciseStats[]> {
  const stats = await calculateStats(userId);

  return [...stats.exerciseStats.values()]
    .sort((a, b) => b.totalSets - a.totalSets)
    .slice(0, limit);
}

/**
 * Get recent PRs
 */
export async function getRecentPRs(
  userId: string = 'local',
  days = 30
): Promise<PersonalRecord[]> {
  const stats = await calculateStats(userId);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const allPRs: PersonalRecord[] = [];
  for (const exerciseStats of stats.exerciseStats.values()) {
    allPRs.push(...exerciseStats.prHistory);
  }

  return allPRs
    .filter(pr => new Date(pr.achievedAt) >= cutoffDate)
    .sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime());
}

/**
 * Invalidate stats cache (call after saving a workout)
 */
export function invalidateStatsCache(): void {
  _statsCache = null;
  _lastCacheTime = 0;
}

/**
 * Check for new PRs in a completed workout
 * Returns PRs that were just set
 */
export async function checkWorkoutForPRs(
  workout: UnifiedWorkoutRecord,
  userId: string = 'local'
): Promise<PersonalRecord[]> {
  const history = await getUnifiedHistory(userId);

  // Filter out the current workout from history for comparison
  const historicalWorkouts = history.filter(w => w.id !== workout.id);

  const newPRs: PersonalRecord[] = [];

  for (const exercise of workout.exercises) {
    if (!exercise.sets || exercise.sets.length === 0) continue;

    // Get historical PRs for this exercise
    const { oneRepMax, repPRs, volumePR } = buildHistoricalPRs(
      exercise.name,
      historicalWorkouts
    );

    // Detect new PRs
    const prs = detectExercisePRs(
      exercise.name,
      exercise.sets,
      workout.id,
      workout.completedAt,
      { oneRepMax, repPRs, volumePR }
    );

    newPRs.push(...prs);
  }

  // Invalidate cache since we have new data
  invalidateStatsCache();

  return newPRs;
}
