/**
 * Workout Session Types
 * Data models for live workout execution and tracking
 */

export interface WorkoutSet {
  id: string;
  reps: number | string; // Can be "8-10" or just "10"
  weight?: number; // in lbs or kg
  isCompleted: boolean;
  completedAt?: Date;
  actualReps?: number; // What user actually completed
  actualWeight?: number;
  rpe?: number; // Rate of Perceived Exertion (1-10)
}

export interface WorkoutExercise {
  id: string;
  name: string;
  sets: WorkoutSet[];
  restTime: number; // seconds between sets
  notes?: string;
  videoUrl?: string;
  muscleGroups?: string[];
  equipment?: string[];
  currentSetIndex: number;
}

export interface WorkoutSession {
  id: string;
  programId?: string;
  workoutName: string;
  exercises: WorkoutExercise[];
  startTime: Date;
  endTime?: Date;
  currentExerciseIndex: number;
  isResting: boolean;
  restTimeRemaining: number;
  status: 'in_progress' | 'paused' | 'completed' | 'cancelled';
}

export interface WorkoutSummary {
  sessionId: string;
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
    id: `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
    id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
