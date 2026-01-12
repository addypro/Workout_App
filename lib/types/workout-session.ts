/**
 * Workout Session Types
 * Data models for live workout execution and tracking
 */

import type {
  ProgramId,
  SetId,
  SupersetGroupId,
  WorkoutExerciseId,
  WorkoutSessionId
} from './brands';
import {
  createSetId,
  createSupersetGroupId,
  createWorkoutExerciseId,
} from './brands';

/**
 * Set types based on "The Invisible Spotter" framework:
 * - warmup: Light preparation sets (no RPE tracking needed)
 * - working: Standard working sets (RPE optional)
 * - top: Top/heavy sets targeting RPE 9-10
 * - drop: Child sets following a main set at reduced weight
 * - failure: Sets taken to muscular failure
 */
export type SetType = 'warmup' | 'working' | 'top' | 'drop' | 'failure';

/**
 * Superset phase for staggered rest flow (supports up to 4 exercises)
 * - exercise_1 through exercise_4: Performing exercises in superset order
 * - rest_12, rest_23, rest_34: Short rest between exercises (~30-60s)
 * - rest_round: Full rest after completing all exercises (standard rest ~90-120s)
 */
export type SupersetPhase =
  | 'exercise_1' | 'rest_12'
  | 'exercise_2' | 'rest_23'
  | 'exercise_3' | 'rest_34'
  | 'exercise_4' | 'rest_round'
  // Legacy support for 2-exercise supersets
  | 'exercise_a' | 'rest_ab' | 'exercise_b' | 'rest_ba';

/**
 * Superset group links 2+ exercises together
 */
export interface SupersetGroup {
  id: SupersetGroupId;
  exerciseIds: WorkoutExerciseId[]; // Ordered list of exercise IDs in the superset
  restBetween: number; // Short rest between exercises (default 30-60s)
  restAfterRound: number; // Full rest after completing all exercises (default 90-120s)
  currentPhase: SupersetPhase;
  currentRound: number; // Which round of the superset we're on
}

export interface WorkoutSet {
  id: SetId;
  reps: number | string; // Can be "8-10" or just "10"
  weight?: number; // in lbs or kg
  isCompleted: boolean;
  completedAt?: Date;
  actualReps?: number; // What user actually completed
  actualWeight?: number;
  actualRestTime?: number; // Actual rest time taken before this set (in seconds)
  rpe?: number; // Rate of Perceived Exertion (1-10)
  setType?: SetType; // Type of set for visual hierarchy and RPE context
  parentSetId?: SetId; // For drop sets, references the parent set
}

export interface WorkoutExercise {
  id: WorkoutExerciseId;
  name: string;
  sets: WorkoutSet[];
  restTime: number; // seconds between sets
  notes?: string;
  videoUrl?: string;
  muscleGroups?: string[];
  equipment?: string[];
  currentSetIndex: number;
  // Superset linking
  supersetGroupId?: SupersetGroupId; // ID of the superset group this exercise belongs to
  supersetOrder?: number; // Position within the superset (1, 2, 3...)
}

export interface WorkoutSession {
  id: WorkoutSessionId;
  programId?: ProgramId;
  workoutName: string;
  exercises: WorkoutExercise[];
  startTime: Date;
  endTime?: Date;
  currentExerciseIndex: number;
  isResting: boolean;
  restTimeRemaining: number;
  /**
   * When resting between sets, these identify which set triggered the rest.
   * Used to render the inline rest panel in the correct place.
   */
  restExerciseIndex?: number;
  restAfterSetIndex?: number;
  status: 'in_progress' | 'paused' | 'completed' | 'cancelled';
  // Superset state
  supersetGroups?: SupersetGroup[];
  activeSupersetId?: SupersetGroupId; // Currently executing superset group
}

export interface WorkoutSummary {
  sessionId: WorkoutSessionId;
  workoutName: string;
  duration: number; // seconds
  totalSets: number;
  completedSets: number;
  totalExercises: number;
  completedExercises: number;
  startTime: Date;
  endTime: Date;
  notes?: string;
  difficulty?: 'easy' | 'moderate' | 'challenging' | 'very_hard';
}

export interface CompletedSet {
  exerciseName: string;
  setNumber: number;
  reps: number;
  weight?: number;
  completedAt: Date;
  rpe?: number;
}

// Helper functions
export function createWorkoutSet(
  reps: number | string,
  weight?: number
): WorkoutSet {
  return {
    id: createSetId(),
    reps,
    weight,
    isCompleted: false,
  };
}

export function createWorkoutExercise(
  name: string,
  sets: number,
  reps: number | string,
  restTime: number = 60
): WorkoutExercise {
  return {
    id: createWorkoutExerciseId(),
    name,
    sets: Array.from({ length: sets }, () => createWorkoutSet(reps)),
    restTime,
    currentSetIndex: 0,
  };
}

export function calculateWorkoutProgress(session: WorkoutSession): {
  exerciseProgress: number; // 0-1
  setProgress: number; // 0-1
  totalSetsCompleted: number;
  totalSets: number;
} {
  const totalSets = session.exercises.reduce(
    (sum, ex) => sum + ex.sets.length,
    0
  );
  const completedSets = session.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.isCompleted).length,
    0
  );

  const completedExercises = session.exercises.filter((ex) =>
    ex.sets.every((s) => s.isCompleted)
  ).length;

  return {
    exerciseProgress: session.exercises.length > 0
      ? completedExercises / session.exercises.length
      : 0,
    setProgress: totalSets > 0 ? completedSets / totalSets : 0,
    totalSetsCompleted: completedSets,
    totalSets,
  };
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getCurrentExercise(
  session: WorkoutSession
): WorkoutExercise | null {
  return session.exercises[session.currentExerciseIndex] || null;
}

export function getCurrentSet(session: WorkoutSession): WorkoutSet | null {
  const exercise = getCurrentExercise(session);
  if (!exercise) return null;
  return exercise.sets[exercise.currentSetIndex] || null;
}

export function getNextExercise(
  session: WorkoutSession
): WorkoutExercise | null {
  return session.exercises[session.currentExerciseIndex + 1] || null;
}

export function isWorkoutComplete(session: WorkoutSession): boolean {
  return session.exercises.every((ex) =>
    ex.sets.every((set) => set.isCompleted)
  );
}

// ============ Superset Helpers ============

/**
 * Sky Blue color palette for superset UI
 */
export const SUPERSET_COLORS = {
  primary: '#5AC8FA', // Sky Blue - main accent
  primaryLight: '#5AC8FA20', // Background tint
  primaryMuted: '#5AC8FA40', // Connector lines
  text: '#5AC8FA',
  border: '#5AC8FA60',
};

/**
 * Create a new superset group linking exercises
 */
export function createSupersetGroup(
  exerciseIds: WorkoutExerciseId[],
  restBetween: number = 45,
  restAfterRound: number = 90
): SupersetGroup {
  return {
    id: createSupersetGroupId(),
    exerciseIds,
    restBetween,
    restAfterRound,
    currentPhase: 'exercise_a',
    currentRound: 1,
  };
}

/**
 * Get the superset group an exercise belongs to
 */
export function getSupersetGroup(
  session: WorkoutSession,
  exerciseId: string
): SupersetGroup | null {
  const exercise = session.exercises.find(e => e.id === exerciseId);
  if (!exercise?.supersetGroupId) return null;
  return session.supersetGroups?.find(g => g.id === exercise.supersetGroupId) || null;
}

/**
 * Get all exercises in a superset group, ordered
 */
export function getSupersetExercises(
  session: WorkoutSession,
  groupId: string
): WorkoutExercise[] {
  return session.exercises
    .filter(e => e.supersetGroupId === groupId)
    .sort((a, b) => (a.supersetOrder || 0) - (b.supersetOrder || 0));
}

/**
 * Check if an exercise is part of a superset
 */
export function isInSuperset(exercise: WorkoutExercise): boolean {
  return !!exercise.supersetGroupId;
}

/**
 * Get the next phase in superset flow
 */
export function getNextSupersetPhase(
  currentPhase: SupersetPhase,
  exerciseCount: number = 2
): SupersetPhase {
  // For 2-exercise supersets: A → rest_ab → B → rest_ba → A...
  switch (currentPhase) {
    case 'exercise_a': return 'rest_ab';
    case 'rest_ab': return 'exercise_b';
    case 'exercise_b': return 'rest_ba';
    case 'rest_ba': return 'exercise_a';
    default: return 'exercise_a';
  }
}

/**
 * Get rest duration for current superset phase
 */
export function getSupersetRestDuration(
  group: SupersetGroup,
  phase: SupersetPhase
): number {
  switch (phase) {
    case 'rest_ab': return group.restBetween; // Short rest between exercises
    case 'rest_ba': return group.restAfterRound; // Full rest after round
    default: return 0;
  }
}

/**
 * Check if we're in an active superset flow (performing an exercise)
 */
export function isActiveSupersetPhase(phase: SupersetPhase): boolean {
  return (
    phase === 'exercise_a' || phase === 'exercise_b' ||
    phase === 'exercise_1' || phase === 'exercise_2' ||
    phase === 'exercise_3' || phase === 'exercise_4'
  );
}

/**
 * Link multiple exercises into a superset (2-4 exercises)
 */
export function linkMultipleExercisesAsSuperset(
  session: WorkoutSession,
  exerciseIds: WorkoutExerciseId[],
  restBetween: number = 45,
  restAfterRound: number = 90
): WorkoutSession {
  // Validate: need 2-4 exercises
  if (exerciseIds.length < 2 || exerciseIds.length > 4) {
    console.warn('Superset requires 2-4 exercises');
    return session;
  }

  // Validate: all exercises exist and aren't already in a superset
  const exercises = exerciseIds.map(id => session.exercises.find(e => e.id === id));
  if (exercises.some(e => !e || e.supersetGroupId)) {
    console.warn('Invalid exercises for superset');
    return session;
  }

  // Create new superset group
  const group = createSupersetGroup(exerciseIds, restBetween, restAfterRound);

  // Update exercises with superset info
  const updatedExercises = session.exercises.map(ex => {
    const orderIndex = exerciseIds.indexOf(ex.id);
    if (orderIndex !== -1) {
      return { ...ex, supersetGroupId: group.id, supersetOrder: orderIndex + 1 };
    }
    return ex;
  });

  return {
    ...session,
    exercises: updatedExercises,
    supersetGroups: [...(session.supersetGroups || []), group],
  };
}

/**
 * Link two exercises into a superset (legacy function for backwards compatibility)
 */
export function linkExercisesAsSuperset(
  session: WorkoutSession,
  exerciseAId: WorkoutExerciseId,
  exerciseBId: WorkoutExerciseId,
  restBetween: number = 45,
  restAfterRound: number = 90
): WorkoutSession {
  return linkMultipleExercisesAsSuperset(session, [exerciseAId, exerciseBId], restBetween, restAfterRound);
}

/**
 * Unlink exercises from a superset
 */
export function unlinkSuperset(
  session: WorkoutSession,
  groupId: SupersetGroupId
): WorkoutSession {
  const updatedExercises = session.exercises.map(ex => {
    if (ex.supersetGroupId === groupId) {
      const { supersetGroupId, supersetOrder, ...rest } = ex;
      return rest as WorkoutExercise;
    }
    return ex;
  });

  return {
    ...session,
    exercises: updatedExercises,
    supersetGroups: session.supersetGroups?.filter(g => g.id !== groupId),
    activeSupersetId: session.activeSupersetId === groupId ? undefined : session.activeSupersetId,
  };
}
