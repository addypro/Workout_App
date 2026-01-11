/**
 * Exercise Progression DAG (Directed Acyclic Graph)
 *
 * Implements Calistree-style progression relationships for exercises.
 * Enables traversing from beginner exercises to advanced goals and vice versa.
 *
 * Features:
 * - Build progression tree from any exercise
 * - Find all paths from regression to progression
 * - Get recommended next/previous exercises
 * - Skill tree visualization data
 */

import { getExerciseDatabase, type ExerciseDatabaseEntry } from './database';

// ============================================
// TYPES
// ============================================

export interface ProgressionRelation {
  /** The exercise this relates to */
  exercise: ExerciseDatabaseEntry;
  /** Type of relationship */
  type: 'progression' | 'regression' | 'sibling';
  /** How much harder/easier (positive = harder) */
  difficultyDelta: number;
  /** Reason for the relationship */
  reason?: string;
}

export interface ProgressionNode {
  exercise: ExerciseDatabaseEntry;
  /** Difficulty level (1-10) */
  level: number;
  /** Parent exercises (regressions) */
  parents: ProgressionNode[];
  /** Child exercises (progressions) */
  children: ProgressionNode[];
  /** Whether this is the "current" exercise being viewed */
  isCurrent: boolean;
  /** Whether this exercise is unlocked (based on user progress) */
  isUnlocked: boolean;
}

export interface ProgressionTree {
  /** The exercise being viewed */
  rootExercise: ExerciseDatabaseEntry;
  /** All nodes in the tree */
  nodes: Map<string, ProgressionNode>;
  /** Starting exercises (no regressions) */
  entryPoints: ProgressionNode[];
  /** Goal exercises (no progressions) */
  goalExercises: ProgressionNode[];
  /** Maximum depth of the tree */
  maxDepth: number;
}

export interface ExercisePath {
  exercises: ExerciseDatabaseEntry[];
  totalLevelGain: number;
  estimatedWeeks: number;
}

// ============================================
// PROGRESSION INDEX
// ============================================

interface ProgressionIndex {
  /** Map of exercise name (lowercase) -> progressions */
  progressions: Map<string, string[]>;
  /** Map of exercise name (lowercase) -> regressions */
  regressions: Map<string, string[]>;
  /** Map of exercise name (lowercase) -> exercise data */
  exercises: Map<string, ExerciseDatabaseEntry>;
  /** Built timestamp */
  builtAt: number;
}

let progressionIndex: ProgressionIndex | null = null;
let indexBuildPromise: Promise<ProgressionIndex> | null = null;

/**
 * Build the progression index from the exercise database
 */
async function buildProgressionIndex(): Promise<ProgressionIndex> {
  if (progressionIndex && Date.now() - progressionIndex.builtAt < 5 * 60 * 1000) {
    return progressionIndex;
  }

  if (indexBuildPromise) {
    return indexBuildPromise;
  }

  indexBuildPromise = (async () => {
    const database = await getExerciseDatabase();

    const index: ProgressionIndex = {
      progressions: new Map(),
      regressions: new Map(),
      exercises: new Map(),
      builtAt: Date.now(),
    };

    // First pass: index all exercises
    for (const exercise of database) {
      const nameLower = exercise.name.toLowerCase();
      index.exercises.set(nameLower, exercise);
    }

    // Second pass: build progression relationships
    for (const exercise of database) {
      const nameLower = exercise.name.toLowerCase();
      const exerciseWithProgression = exercise as ExerciseDatabaseEntry & {
        progressesTo?: string[];
        regressesFrom?: string[];
        progressionLevel?: number;
      };

      // Extract progressions from enhanced exercises
      if (exerciseWithProgression.progressesTo) {
        const validProgressions = exerciseWithProgression.progressesTo.filter(
          p => index.exercises.has(p.toLowerCase())
        );
        if (validProgressions.length > 0) {
          index.progressions.set(nameLower, validProgressions.map(p => p.toLowerCase()));
        }
      }

      // Extract regressions from enhanced exercises
      if (exerciseWithProgression.regressesFrom) {
        const validRegressions = exerciseWithProgression.regressesFrom.filter(
          r => index.exercises.has(r.toLowerCase())
        );
        if (validRegressions.length > 0) {
          index.regressions.set(nameLower, validRegressions.map(r => r.toLowerCase()));
        }
      }
    }

    // Third pass: infer reverse relationships
    Array.from(index.progressions.entries()).forEach(([exercise, progressions]) => {
      progressions.forEach((progression) => {
        // Add reverse regression relationship
        const existing = index.regressions.get(progression) || [];
        if (!existing.includes(exercise)) {
          index.regressions.set(progression, [...existing, exercise]);
        }
      });
    });

    progressionIndex = index;
    indexBuildPromise = null;
    return index;
  })();

  return indexBuildPromise;
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Get direct progressions (harder exercises) for an exercise
 */
export async function getProgressions(exerciseName: string): Promise<ProgressionRelation[]> {
  const index = await buildProgressionIndex();
  const nameLower = exerciseName.toLowerCase();
  const progressionNames = index.progressions.get(nameLower) || [];

  return progressionNames
    .map((name): ProgressionRelation | null => {
      const exercise = index.exercises.get(name);
      if (!exercise) return null;
      return {
        exercise,
        type: 'progression',
        difficultyDelta: 1,
        reason: 'Direct progression',
      };
    })
    .filter((p): p is ProgressionRelation => p !== null);
}

/**
 * Get direct regressions (easier exercises) for an exercise
 */
export async function getRegressions(exerciseName: string): Promise<ProgressionRelation[]> {
  const index = await buildProgressionIndex();
  const nameLower = exerciseName.toLowerCase();
  const regressionNames = index.regressions.get(nameLower) || [];

  return regressionNames
    .map((name): ProgressionRelation | null => {
      const exercise = index.exercises.get(name);
      if (!exercise) return null;
      return {
        exercise,
        type: 'regression',
        difficultyDelta: -1,
        reason: 'Direct regression',
      };
    })
    .filter((r): r is ProgressionRelation => r !== null);
}

/**
 * Get sibling exercises (same difficulty level, same movement pattern)
 */
export async function getSiblings(exerciseName: string): Promise<ProgressionRelation[]> {
  const index = await buildProgressionIndex();
  const nameLower = exerciseName.toLowerCase();
  const exercise = index.exercises.get(nameLower);

  if (!exercise) return [];

  const exerciseWithLevel = exercise as ExerciseDatabaseEntry & { progressionLevel?: number };
  const level = exerciseWithLevel.progressionLevel || 5;
  const siblings: ProgressionRelation[] = [];

  Array.from(index.exercises.entries()).forEach(([name, ex]) => {
    if (name === nameLower) return;

    const exWithLevel = ex as ExerciseDatabaseEntry & { progressionLevel?: number };
    const exLevel = exWithLevel.progressionLevel || 5;

    // Same level, same target muscle group
    if (
      Math.abs(exLevel - level) <= 1 &&
      ex.muscles?.targetGroup === exercise.muscles?.targetGroup &&
      ex.category === exercise.category
    ) {
      siblings.push({
        exercise: ex,
        type: 'sibling',
        difficultyDelta: exLevel - level,
        reason: 'Same difficulty level and muscle group',
      });
    }
  });

  return siblings.slice(0, 5); // Limit to 5 siblings
}

/**
 * Build a full progression tree for an exercise
 */
export async function buildProgressionTree(
  exerciseName: string,
  maxDepth: number = 5
): Promise<ProgressionTree> {
  const index = await buildProgressionIndex();
  const nameLower = exerciseName.toLowerCase();
  const rootExercise = index.exercises.get(nameLower);

  if (!rootExercise) {
    throw new Error(`Exercise not found: ${exerciseName}`);
  }

  const nodes = new Map<string, ProgressionNode>();
  const visited = new Set<string>();

  // Create the root node
  const rootWithLevel = rootExercise as ExerciseDatabaseEntry & { progressionLevel?: number };
  const rootNode: ProgressionNode = {
    exercise: rootExercise,
    level: rootWithLevel.progressionLevel || 5,
    parents: [],
    children: [],
    isCurrent: true,
    isUnlocked: true,
  };
  nodes.set(nameLower, rootNode);

  // Build tree upward (regressions)
  async function buildUpward(node: ProgressionNode, depth: number): Promise<void> {
    if (depth > maxDepth || visited.has(node.exercise.name.toLowerCase())) return;
    visited.add(node.exercise.name.toLowerCase());

    const regressions = await getRegressions(node.exercise.name);
    for (const reg of regressions) {
      const regNameLower = reg.exercise.name.toLowerCase();
      if (visited.has(regNameLower)) continue;

      let regNode = nodes.get(regNameLower);
      if (!regNode) {
        const regWithLevel = reg.exercise as ExerciseDatabaseEntry & { progressionLevel?: number };
        regNode = {
          exercise: reg.exercise,
          level: regWithLevel.progressionLevel || node.level - 1,
          parents: [],
          children: [],
          isCurrent: false,
          isUnlocked: true,
        };
        nodes.set(regNameLower, regNode);
      }

      regNode.children.push(node);
      node.parents.push(regNode);

      await buildUpward(regNode, depth + 1);
    }
  }

  // Build tree downward (progressions)
  async function buildDownward(node: ProgressionNode, depth: number): Promise<void> {
    if (depth > maxDepth || visited.has(node.exercise.name.toLowerCase())) return;
    visited.add(node.exercise.name.toLowerCase());

    const progressions = await getProgressions(node.exercise.name);
    for (const prog of progressions) {
      const progNameLower = prog.exercise.name.toLowerCase();
      if (visited.has(progNameLower)) continue;

      let progNode = nodes.get(progNameLower);
      if (!progNode) {
        const progWithLevel = prog.exercise as ExerciseDatabaseEntry & { progressionLevel?: number };
        progNode = {
          exercise: prog.exercise,
          level: progWithLevel.progressionLevel || node.level + 1,
          parents: [],
          children: [],
          isCurrent: false,
          isUnlocked: false, // Progressions are locked by default
        };
        nodes.set(progNameLower, progNode);
      }

      progNode.parents.push(node);
      node.children.push(progNode);

      await buildDownward(progNode, depth + 1);
    }
  }

  // Build both directions
  visited.clear();
  await buildUpward(rootNode, 0);
  visited.clear();
  visited.add(nameLower); // Keep root as visited
  await buildDownward(rootNode, 0);

  // Find entry points (no parents) and goals (no children)
  const entryPoints: ProgressionNode[] = [];
  const goalExercises: ProgressionNode[] = [];
  let maxLevelDepth = 0;

  Array.from(nodes.values()).forEach((node) => {
    if (node.parents.length === 0) {
      entryPoints.push(node);
    }
    if (node.children.length === 0) {
      goalExercises.push(node);
    }
    maxLevelDepth = Math.max(maxLevelDepth, node.level);
  });

  return {
    rootExercise,
    nodes,
    entryPoints,
    goalExercises,
    maxDepth: maxLevelDepth,
  };
}

/**
 * Find the shortest path between two exercises
 */
export async function findPath(
  fromExercise: string,
  toExercise: string
): Promise<ExercisePath | null> {
  const index = await buildProgressionIndex();
  const fromLower = fromExercise.toLowerCase();
  const toLower = toExercise.toLowerCase();

  if (!index.exercises.has(fromLower) || !index.exercises.has(toLower)) {
    return null;
  }

  // BFS to find shortest path
  const queue: Array<{ name: string; path: string[] }> = [{ name: fromLower, path: [fromLower] }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { name, path } = queue.shift()!;

    if (name === toLower) {
      // Found the path
      const exercises = path
        .map(n => index.exercises.get(n))
        .filter((e): e is ExerciseDatabaseEntry => e !== undefined);

      return {
        exercises,
        totalLevelGain: exercises.length - 1,
        estimatedWeeks: (exercises.length - 1) * 4, // ~4 weeks per progression
      };
    }

    if (visited.has(name)) continue;
    visited.add(name);

    // Check progressions
    const progressions = index.progressions.get(name) || [];
    for (const prog of progressions) {
      if (!visited.has(prog)) {
        queue.push({ name: prog, path: [...path, prog] });
      }
    }
  }

  return null;
}

/**
 * Get all exercises in a progression category
 */
export async function getProgressionCategory(category: string): Promise<ExerciseDatabaseEntry[]> {
  const index = await buildProgressionIndex();
  const exercises: ExerciseDatabaseEntry[] = [];

  Array.from(index.exercises.values()).forEach((exercise) => {
    if (exercise.category?.toLowerCase() === category.toLowerCase()) {
      exercises.push(exercise);
    }
  });

  // Sort by progression level
  exercises.sort((a, b) => {
    const aLevel = (a as ExerciseDatabaseEntry & { progressionLevel?: number }).progressionLevel || 5;
    const bLevel = (b as ExerciseDatabaseEntry & { progressionLevel?: number }).progressionLevel || 5;
    return aLevel - bLevel;
  });

  return exercises;
}

/**
 * Get recommended next exercise based on current progress
 */
export async function getRecommendedNext(
  currentExercise: string,
  userCanDoReps: number = 10
): Promise<ProgressionRelation | null> {
  // If user can do 10+ reps with good form, recommend progression
  if (userCanDoReps >= 10) {
    const progressions = await getProgressions(currentExercise);
    if (progressions.length > 0) {
      return progressions[0];
    }
  }

  // If struggling, recommend regression
  if (userCanDoReps < 5) {
    const regressions = await getRegressions(currentExercise);
    if (regressions.length > 0) {
      return regressions[0];
    }
  }

  return null;
}

/**
 * Get skill tree data for a movement category
 * Returns exercises organized by level for visualization
 */
export async function getSkillTree(movementPattern: string): Promise<Map<number, ExerciseDatabaseEntry[]>> {
  const index = await buildProgressionIndex();
  const skillTree = new Map<number, ExerciseDatabaseEntry[]>();

  Array.from(index.exercises.values()).forEach((exercise) => {
    const patterns = exercise.movementPatterns || [];
    const hasPattern = patterns.some(
      p => p.toLowerCase().includes(movementPattern.toLowerCase())
    );

    if (hasPattern) {
      const level = (exercise as ExerciseDatabaseEntry & { progressionLevel?: number }).progressionLevel || 5;
      const existing = skillTree.get(level) || [];
      skillTree.set(level, [...existing, exercise]);
    }
  });

  return skillTree;
}

/**
 * Invalidate the progression index (call when database changes)
 */
export function invalidateProgressionIndex(): void {
  progressionIndex = null;
}

// ============================================
// EXPORTS
// ============================================

export { buildProgressionIndex };
