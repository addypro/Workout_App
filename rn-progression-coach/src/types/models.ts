export type UnitSystem = 'lb' | 'kg';

export type ProgramId = string;

export interface ProgramJson {
  [programId: string]: {
    kaggleName: string;
    workouts: WorkoutJson[];
  };
}

export interface WorkoutJson {
  week: number;
  day: number;
  name: string;
  exercises: ExerciseJson[];
}

export interface ExerciseJson {
  name: string;
  sets: number;
  reps: string; // can be "10" or "180s" etc.
  weight: number | null;
  restTime: number; // minutes (as stored in source dataset)
}

export type ExerciseKind = 'strength' | 'hypertrophy' | 'bodyweight' | 'conditioning' | 'mobility';

export interface RepSpec {
  kind: 'reps' | 'time';
  value: number;
  unit?: 's' | 'min';
}

export interface SetPrescription {
  setIndex: number;
  repSpec: RepSpec;
  targetRpe?: number; // 6-10 typical
  suggestedLoad?: number; // in user's unit system
  minLoad?: number;
  maxLoad?: number;
}

export interface ExercisePrescription {
  rawName: string;
  canonicalName: string;
  kind: ExerciseKind;
  sets: SetPrescription[];
  defaultRestSeconds: number;
}

export interface WorkoutPlan {
  workoutId: string; // stable hash
  programId: ProgramId;
  week: number;
  day: number;
  name: string;
  exercises: ExercisePrescription[];
}

export interface ActiveProgramPlan {
  planId: string;
  programId: ProgramId;
  startedAt: string;
  currentWorkoutIndex: number;
  unitSystem: UnitSystem;
  // Default increments
  defaultUpperIncrement: number;
  defaultLowerIncrement: number;
  // Profiles used by progression engine
  progressionProfile: ProgressionProfile;
}

export type ProgressionProfile =
  | 'LINEAR_LP'
  | 'PERCENT_TM'
  | 'DOUBLE_PROGRESSION'
  | 'BODYWEIGHT_STEP'
  | 'CONDITIONING_PROGRESS'
  | 'MOBILITY_MAINTAIN';

export interface ExerciseContext {
  canonicalName: string;
  kind: ExerciseKind;
  // Load context (for weighted lifts)
  est1rm?: number; // in unit system
  lastWorkingWeight?: number;
  preferredIncrement?: number;
  // Effort context
  lastAvgRpe?: number;
  // Bodyweight / skill context
  difficultyLevel?: number;
  // Conditioning context
  lastDurationSeconds?: number;
  lastDistanceMeters?: number;
  updatedAt: string;
}

export interface SetLog {
  setIndex: number;
  targetReps?: number;
  targetSeconds?: number;
  suggestedLoad?: number;
  actualReps?: number;
  actualSeconds?: number;
  actualLoad?: number;
  rpe?: number;
  isCompleted: boolean;
}

export interface ExerciseLog {
  canonicalName: string;
  rawName: string;
  kind: ExerciseKind;
  notes?: string;
  sets: SetLog[];
}

export interface WorkoutLog {
  workoutLogId: string;
  planId: string;
  programId: ProgramId;
  workoutId: string;
  startedAt: string;
  finishedAt?: string;
  exercises: ExerciseLog[];
}
