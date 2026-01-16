/**
 * PR Detection Service
 *
 * Detects personal records from workout data:
 * - 1RM (One Rep Max): Heaviest single rep ever
 * - Rep PRs: Best weight at specific rep counts (5RM, 10RM, etc.)
 * - Volume PRs: Most total volume in a single session for an exercise
 */

import type { UnifiedWorkoutRecord } from '@/lib/db/storage';
import type { PersonalRecord, PRType } from './types';

// Counter for unique PR IDs within a session
let _prIdCounter = 0;

/**
 * Calculate estimated 1RM using Epley formula
 * 1RM = weight × (1 + reps/30)
 */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps === 1) return weight;
  if (reps === 0 || weight === 0) return 0;
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Detect all PRs for a single exercise from a workout session
 * Compares against historical bests
 */
export function detectExercisePRs(
  exerciseName: string,
  sets: { reps: number; weight?: number; isCompleted?: boolean }[],
  workoutId: string,
  workoutDate: string,
  historicalPRs: {
    oneRepMax: PersonalRecord | null;
    repPRs: Map<number, PersonalRecord>;
    volumePR: PersonalRecord | null;
  }
): PersonalRecord[] {
  const newPRs: PersonalRecord[] = [];

  // Filter to completed sets with valid data
  const completedSets = sets.filter(
    s => s.isCompleted !== false && s.weight && s.weight > 0 && s.reps > 0
  );

  if (completedSets.length === 0) return newPRs;

  // Check for 1RM PR (actual or estimated)
  let best1RM = 0;
  let best1RMSet: { reps: number; weight: number } | null = null;

  for (const set of completedSets) {
    const estimated = estimateOneRepMax(set.weight!, set.reps);
    if (estimated > best1RM) {
      best1RM = estimated;
      best1RMSet = { reps: set.reps, weight: set.weight! };
    }
  }

  const current1RM = historicalPRs.oneRepMax?.value || 0;
  if (best1RM > current1RM && best1RMSet) {
    newPRs.push({
      id: `${workoutId}-${exerciseName.toLowerCase().replace(/\s+/g, '-')}-1rm-${++_prIdCounter}`,
      exerciseName,
      recordType: 'ONE_REP_MAX',
      value: best1RM,
      reps: best1RMSet.reps,
      achievedAt: workoutDate,
      workoutId,
    });
  }

  // Check for rep PRs (best weight at each rep count)
  const repMaxes = new Map<number, number>();
  for (const set of completedSets) {
    const current = repMaxes.get(set.reps) || 0;
    if (set.weight! > current) {
      repMaxes.set(set.reps, set.weight!);
    }
  }

  for (const [reps, weight] of repMaxes) {
    const historicalBest = historicalPRs.repPRs.get(reps)?.value || 0;
    if (weight > historicalBest) {
      newPRs.push({
        id: `${workoutId}-${exerciseName.toLowerCase().replace(/\s+/g, '-')}-${reps}rm-${++_prIdCounter}`,
        exerciseName,
        recordType: 'REP_PR',
        value: weight,
        reps,
        achievedAt: workoutDate,
        workoutId,
      });
    }
  }

  // Check for volume PR (total weight moved for this exercise in session)
  const totalVolume = completedSets.reduce(
    (sum, set) => sum + (set.weight || 0) * set.reps,
    0
  );

  const historicalVolumeMax = historicalPRs.volumePR?.value || 0;
  if (totalVolume > historicalVolumeMax) {
    newPRs.push({
      id: `${workoutId}-${exerciseName.toLowerCase().replace(/\s+/g, '-')}-volume-${++_prIdCounter}`,
      exerciseName,
      recordType: 'VOLUME_PR',
      value: totalVolume,
      achievedAt: workoutDate,
      workoutId,
    });
  }

  return newPRs;
}

/**
 * Build historical PR records from workout history
 */
export function buildHistoricalPRs(
  exerciseName: string,
  workoutHistory: UnifiedWorkoutRecord[]
): {
  oneRepMax: PersonalRecord | null;
  repPRs: Map<number, PersonalRecord>;
  volumePR: PersonalRecord | null;
  allPRs: PersonalRecord[];
} {
  const normalizedName = exerciseName.toLowerCase().trim();
  let oneRepMax: PersonalRecord | null = null;
  const repPRs = new Map<number, PersonalRecord>();
  let volumePR: PersonalRecord | null = null;
  const allPRs: PersonalRecord[] = [];

  // Process workouts from oldest to newest to track PR progression
  const sortedHistory = [...workoutHistory].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  );

  for (const workout of sortedHistory) {
    for (const exercise of workout.exercises) {
      if (exercise.name.toLowerCase().trim() !== normalizedName) continue;
      if (!exercise.sets || exercise.sets.length === 0) continue;

      const completedSets = exercise.sets.filter(
        s => s.isCompleted !== false && s.weight && s.weight > 0 && s.reps > 0
      );

      if (completedSets.length === 0) continue;

      // Check 1RM
      for (const set of completedSets) {
        const estimated = estimateOneRepMax(set.weight!, set.reps);
        if (!oneRepMax || estimated > oneRepMax.value) {
          const pr: PersonalRecord = {
            id: `${workout.id}-${exerciseName.toLowerCase().replace(/\s+/g, '-')}-1rm-${++_prIdCounter}`,
            exerciseName: exercise.name,
            recordType: 'ONE_REP_MAX',
            value: estimated,
            reps: set.reps,
            achievedAt: workout.completedAt,
            workoutId: workout.id,
          };
          if (oneRepMax) allPRs.push(oneRepMax);
          oneRepMax = pr;
        }
      }

      // Check rep PRs
      for (const set of completedSets) {
        const existing = repPRs.get(set.reps);
        if (!existing || set.weight! > existing.value) {
          const pr: PersonalRecord = {
            id: `${workout.id}-${exerciseName.toLowerCase().replace(/\s+/g, '-')}-${set.reps}rm-${++_prIdCounter}`,
            exerciseName: exercise.name,
            recordType: 'REP_PR',
            value: set.weight!,
            reps: set.reps,
            achievedAt: workout.completedAt,
            workoutId: workout.id,
          };
          if (existing) allPRs.push(existing);
          repPRs.set(set.reps, pr);
        }
      }

      // Check volume PR
      const sessionVolume = completedSets.reduce(
        (sum, set) => sum + (set.weight || 0) * set.reps,
        0
      );
      if (!volumePR || sessionVolume > volumePR.value) {
        const pr: PersonalRecord = {
          id: `${workout.id}-${exerciseName.toLowerCase().replace(/\s+/g, '-')}-volume-${++_prIdCounter}`,
          exerciseName: exercise.name,
          recordType: 'VOLUME_PR',
          value: sessionVolume,
          achievedAt: workout.completedAt,
          workoutId: workout.id,
        };
        if (volumePR) allPRs.push(volumePR);
        volumePR = pr;
      }
    }
  }

  // Add current PRs to allPRs list
  if (oneRepMax) allPRs.push(oneRepMax);
  for (const pr of repPRs.values()) allPRs.push(pr);
  if (volumePR) allPRs.push(volumePR);

  return { oneRepMax, repPRs, volumePR, allPRs };
}

/**
 * Format PR for display
 */
export function formatPR(pr: PersonalRecord): string {
  switch (pr.recordType) {
    case 'ONE_REP_MAX':
      return `${pr.value} lb estimated 1RM`;
    case 'REP_PR':
      return `${pr.value} lb × ${pr.reps} reps`;
    case 'VOLUME_PR':
      return `${pr.value.toLocaleString()} lb total volume`;
    default:
      return `${pr.value}`;
  }
}

/**
 * Get PR type display name
 */
export function getPRTypeName(type: PRType): string {
  switch (type) {
    case 'ONE_REP_MAX':
      return '1RM';
    case 'REP_PR':
      return 'Rep PR';
    case 'VOLUME_PR':
      return 'Volume PR';
    default:
      return 'PR';
  }
}
