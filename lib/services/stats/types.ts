/**
 * Stats Service Types
 *
 * Data models for workout analytics and PR tracking.
 */

export type PRType = 'ONE_REP_MAX' | 'REP_PR' | 'VOLUME_PR';

export interface PersonalRecord {
  id: string;
  exerciseName: string;
  recordType: PRType;
  value: number;          // weight for 1RM/rep PR, total volume for volume PR
  reps?: number;          // for rep PRs (e.g., 5RM)
  achievedAt: string;     // ISO date
  workoutId: string;      // reference to workout where achieved
}

export interface ExerciseProgressPoint {
  date: string;
  maxWeight: number;
  totalVolume: number;
  totalSets: number;
}

export interface ExerciseStats {
  exerciseName: string;
  totalSets: number;
  totalVolume: number;    // sum of (weight * reps) all time
  lastPerformed: string;
  currentPRs: {
    oneRepMax: PersonalRecord | null;
    repPRs: Map<number, PersonalRecord>; // reps -> best weight at that rep count
    volumePR: PersonalRecord | null;
  };
  prHistory: PersonalRecord[];
  progressData: ExerciseProgressPoint[];
}

export interface StatsSnapshot {
  totalWorkouts: number;
  totalExercises: number;
  currentStreak: number;  // consecutive workout days/weeks
  longestStreak: number;
  prsThisMonth: number;
  prsAllTime: number;
  exerciseStats: Map<string, ExerciseStats>;
  muscleGroupFrequency: Map<string, number>;
  lastWorkoutDate: string | null;
  lastUpdated: string;
}

export interface WorkoutSummaryStats {
  totalVolume: number;
  exerciseCount: number;
  setCount: number;
  prsHit: PersonalRecord[];
  comparedToPrevious: {
    volumeChange: number; // percentage
    weightChanges: Map<string, number>; // exercise -> weight difference
  };
}

export interface TimeRange {
  label: string;
  value: '1M' | '3M' | '6M' | '1Y' | 'ALL';
  days: number | null; // null for ALL
}

export const TIME_RANGES: TimeRange[] = [
  { label: '1 Month', value: '1M', days: 30 },
  { label: '3 Months', value: '3M', days: 90 },
  { label: '6 Months', value: '6M', days: 180 },
  { label: '1 Year', value: '1Y', days: 365 },
  { label: 'All Time', value: 'ALL', days: null },
];
