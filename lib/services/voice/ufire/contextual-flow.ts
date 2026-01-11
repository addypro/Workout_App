/**
 * Contextual Flow Analyzer
 *
 * Analyzes the current workout context to influence exercise recommendations.
 * Considers muscle fatigue, workout patterns, and exercise sequencing.
 *
 * Weight in UFIRE: ω₄ = 0.10 (Contextual Flow)
 *
 * Key insights:
 * - If user just did squats, a "press" request weights toward leg press
 * - Antagonist supersets are common (chest + back)
 * - Progressive overload patterns
 * - Rest between same muscle groups
 */

import type { ExerciseCandidate } from './scoring-engine';

// Muscle group relationships
const MUSCLE_GROUPS = {
  // Primary muscle groups
  chest: ['chest', 'pecs', 'pectoral'],
  back: ['back', 'lats', 'latissimus', 'rhomboids', 'traps', 'trapezius'],
  shoulders: ['shoulders', 'delts', 'deltoids', 'front delt', 'rear delt', 'side delt'],
  biceps: ['biceps', 'bicep', 'arms'],
  triceps: ['triceps', 'tricep', 'arms'],
  forearms: ['forearms', 'forearm', 'wrists', 'grip'],
  quads: ['quads', 'quadriceps', 'front thigh'],
  hamstrings: ['hamstrings', 'hamstring', 'rear thigh'],
  glutes: ['glutes', 'glute', 'butt', 'hips'],
  calves: ['calves', 'calf'],
  abs: ['abs', 'core', 'abdominals', 'obliques'],
  lower_back: ['lower back', 'erectors', 'spinal'],
} as const;

// Synergistic muscle pairs (often trained together)
const SYNERGISTS: Record<string, string[]> = {
  chest: ['triceps', 'shoulders'],
  back: ['biceps', 'rear delts'],
  shoulders: ['triceps', 'chest'],
  quads: ['glutes', 'calves'],
  hamstrings: ['glutes', 'lower_back'],
};

// Antagonist pairs (good for supersets)
const ANTAGONISTS: Record<string, string[]> = {
  chest: ['back'],
  back: ['chest'],
  biceps: ['triceps'],
  triceps: ['biceps'],
  quads: ['hamstrings'],
  hamstrings: ['quads'],
  abs: ['lower_back'],
  lower_back: ['abs'],
};

// Common exercise sequences (based on workout patterns)
const COMMON_SEQUENCES: Record<string, string[]> = {
  'barbell back squat': ['leg press', 'walking lunges', 'leg extension', 'leg curl'],
  'bench press': ['incline bench press', 'dumbbell press', 'chest fly', 'tricep pushdown'],
  'deadlift': ['barbell row', 'romanian deadlift', 'lat pulldown', 'cable row'],
  'overhead press': ['lateral raise', 'front raise', 'face pull', 'tricep extension'],
  'lat pulldown': ['cable row', 'dumbbell row', 'bicep curl', 'face pull'],
  'barbell row': ['lat pulldown', 'dumbbell row', 'bicep curl', 'cable row'],
};

export interface WorkoutContext {
  // Exercises already in the workout (in order)
  completedExercises: Array<{
    name: string;
    muscleGroups: string[];
    setsCompleted: number;
    totalSets: number;
  }>;
  // Current workout type/focus
  workoutType?: 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body' | 'custom';
  // Time into workout (affects fatigue)
  elapsedMinutes?: number;
  // User's typical workout pattern
  typicalWorkoutLength?: number; // in exercises
}

/**
 * Get the primary muscle group for an exercise
 */
function getPrimaryMuscleGroup(muscleGroups: string[] | undefined): string | null {
  if (!muscleGroups || muscleGroups.length === 0) return null;

  const firstMuscle = muscleGroups[0].toLowerCase();

  for (const [group, aliases] of Object.entries(MUSCLE_GROUPS)) {
    if (aliases.some(alias => firstMuscle.includes(alias))) {
      return group;
    }
  }

  return firstMuscle;
}

/**
 * Check if two muscle groups are related (synergists or same group)
 */
function areMusclesRelated(group1: string, group2: string): boolean {
  if (group1 === group2) return true;

  const synergists = SYNERGISTS[group1] || [];
  return synergists.includes(group2);
}

/**
 * Check if two muscle groups are antagonists
 */
function areMusclesAntagonist(group1: string, group2: string): boolean {
  const antagonists = ANTAGONISTS[group1] || [];
  return antagonists.includes(group2);
}

/**
 * Calculate contextual flow score for an exercise candidate
 *
 * Returns 0-1 where:
 * - 1.0: Perfect fit for current workout flow
 * - 0.5: Neutral (no strong context)
 * - 0.0: Conflicts with current workout
 */
export function getContextualFlowScore(
  candidate: ExerciseCandidate,
  context: WorkoutContext
): number {
  if (!context.completedExercises || context.completedExercises.length === 0) {
    return 0.5; // Neutral if no exercises yet
  }

  let score = 0.5; // Start neutral
  const candidateMuscle = getPrimaryMuscleGroup(candidate.muscleGroups);
  const lastExercise = context.completedExercises[context.completedExercises.length - 1];
  const lastMuscle = getPrimaryMuscleGroup(lastExercise.muscleGroups);

  // Factor 1: Muscle group sequencing
  if (candidateMuscle && lastMuscle) {
    // Same muscle group - slight penalty (avoid fatigue stacking)
    if (candidateMuscle === lastMuscle) {
      score -= 0.15;
    }
    // Synergistic muscle - bonus (common pairing)
    else if (areMusclesRelated(lastMuscle, candidateMuscle)) {
      score += 0.2;
    }
    // Antagonist muscle - good for supersets
    else if (areMusclesAntagonist(lastMuscle, candidateMuscle)) {
      score += 0.15;
    }
  }

  // Factor 2: Common sequence patterns
  const normalizedLastName = lastExercise.name.toLowerCase();
  const commonNextExercises = Object.entries(COMMON_SEQUENCES)
    .find(([key]) => normalizedLastName.includes(key))?.[1] || [];

  const normalizedCandidateName = candidate.name.toLowerCase();
  if (commonNextExercises.some(ex => normalizedCandidateName.includes(ex))) {
    score += 0.25; // Big bonus for common sequences
  }

  // Factor 3: Workout type consistency
  if (context.workoutType && candidateMuscle) {
    const workoutMuscles = getWorkoutTypeMuscles(context.workoutType);
    if (workoutMuscles.includes(candidateMuscle)) {
      score += 0.1;
    } else {
      score -= 0.1;
    }
  }

  // Factor 4: Variety - penalize if already did this exercise
  const alreadyDone = context.completedExercises.some(
    ex => ex.name.toLowerCase() === candidate.name.toLowerCase()
  );
  if (alreadyDone) {
    score -= 0.3;
  }

  // Factor 5: Fatigue management - later in workout, prefer isolation
  if (context.elapsedMinutes && context.elapsedMinutes > 45) {
    const isCompound = isCompoundExercise(candidate.name);
    if (isCompound) {
      score -= 0.1; // Slight penalty for heavy compounds late in workout
    }
  }

  // Clamp to 0-1
  return Math.max(0, Math.min(1, score));
}

/**
 * Get muscle groups for a workout type
 */
function getWorkoutTypeMuscles(workoutType: string): string[] {
  switch (workoutType) {
    case 'push':
      return ['chest', 'shoulders', 'triceps'];
    case 'pull':
      return ['back', 'biceps', 'forearms'];
    case 'legs':
      return ['quads', 'hamstrings', 'glutes', 'calves'];
    case 'upper':
      return ['chest', 'back', 'shoulders', 'biceps', 'triceps'];
    case 'lower':
      return ['quads', 'hamstrings', 'glutes', 'calves'];
    case 'full_body':
      return Object.keys(MUSCLE_GROUPS);
    default:
      return [];
  }
}

/**
 * Check if an exercise is a compound movement
 */
function isCompoundExercise(exerciseName: string): boolean {
  const compounds = [
    'squat', 'deadlift', 'bench press', 'overhead press', 'barbell row',
    'pull up', 'chin up', 'dip', 'lunge', 'clean', 'snatch', 'jerk',
  ];
  const normalized = exerciseName.toLowerCase();
  return compounds.some(c => normalized.includes(c));
}

/**
 * Predict next likely exercise based on current workout flow
 */
export function predictNextExercise(
  context: WorkoutContext
): string[] {
  if (!context.completedExercises || context.completedExercises.length === 0) {
    return [];
  }

  const lastExercise = context.completedExercises[context.completedExercises.length - 1];
  const normalizedName = lastExercise.name.toLowerCase();

  // Check common sequences
  for (const [key, nextExercises] of Object.entries(COMMON_SEQUENCES)) {
    if (normalizedName.includes(key)) {
      return nextExercises;
    }
  }

  return [];
}

/**
 * Infer workout type from completed exercises
 */
export function inferWorkoutType(
  completedExercises: WorkoutContext['completedExercises']
): WorkoutContext['workoutType'] {
  if (completedExercises.length < 2) return 'custom';

  const muscleCount: Record<string, number> = {};

  for (const ex of completedExercises) {
    const muscle = getPrimaryMuscleGroup(ex.muscleGroups);
    if (muscle) {
      muscleCount[muscle] = (muscleCount[muscle] || 0) + 1;
    }
  }

  const muscles = Object.keys(muscleCount);

  // Check for push muscles
  const pushMuscles = ['chest', 'shoulders', 'triceps'];
  const isPush = muscles.every(m => pushMuscles.includes(m));
  if (isPush && muscles.length >= 2) return 'push';

  // Check for pull muscles
  const pullMuscles = ['back', 'biceps', 'forearms'];
  const isPull = muscles.every(m => pullMuscles.includes(m));
  if (isPull && muscles.length >= 2) return 'pull';

  // Check for leg muscles
  const legMuscles = ['quads', 'hamstrings', 'glutes', 'calves'];
  const isLegs = muscles.every(m => legMuscles.includes(m));
  if (isLegs && muscles.length >= 2) return 'legs';

  // Check for upper body
  const upperMuscles = [...pushMuscles, ...pullMuscles];
  const isUpper = muscles.every(m => upperMuscles.includes(m));
  if (isUpper && muscles.length >= 3) return 'upper';

  // Check for lower body
  const isLower = muscles.every(m => legMuscles.includes(m) || m === 'lower_back');
  if (isLower) return 'lower';

  return 'custom';
}
