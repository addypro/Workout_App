/**
 * Pathfinder Types
 *
 * Defines the data structures for the visual progress system.
 * Inspired by Brilliant.org's node-based learning paths.
 */

// ============================================
// NODE TYPES
// ============================================

export type NodeStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export type NodeType =
  | 'workout' // A single workout session
  | 'milestone' // Achievement milestone (e.g., first week complete)
  | 'checkpoint' // Weekly/monthly checkpoint
  | 'boss' // Challenge workout (PR attempt, AMRAP, etc.)
  | 'rest'; // Rest day node

export interface PathNode {
  id: string;
  type: NodeType;
  status: NodeStatus;
  /** Display title */
  title: string;
  /** Optional subtitle (e.g., "Week 1, Day 1") */
  subtitle?: string;
  /** Reference to workout/program data */
  referenceId?: string;
  /** Position in the path (0-indexed) */
  position: number;
  /** X position for rendering (0-1 normalized) */
  x: number;
  /** Y position for rendering (0-1 normalized, 0 = top) */
  y: number;
  /** Connections to other nodes (node IDs) */
  connections: string[];
  /** Completion date if completed */
  completedAt?: string;
  /** Progress within this node (0-1) */
  progress?: number;
  /** Metadata for rendering (icon, color, etc.) */
  meta?: {
    icon?: string;
    color?: string;
    isOptional?: boolean;
    xpReward?: number;
  };
}

// ============================================
// PATH TYPES
// ============================================

export type PathType =
  | 'program' // A full program path
  | 'weekly' // A week's worth of workouts
  | 'challenge'; // A special challenge path

export interface Path {
  id: string;
  type: PathType;
  /** Display name */
  name: string;
  /** Description */
  description?: string;
  /** All nodes in this path */
  nodes: PathNode[];
  /** Current active node ID */
  activeNodeId?: string;
  /** Overall progress (0-1) */
  progress: number;
  /** Total XP earned from this path */
  totalXp: number;
  /** Reference to program/challenge */
  referenceId?: string;
  /** Created timestamp */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
}

// ============================================
// USER PATH PROGRESS
// ============================================

export interface UserPathProgress {
  userId: string;
  pathId: string;
  /** Map of node ID -> completion status */
  nodeProgress: Record<string, NodeStatus>;
  /** Current streak (consecutive days) */
  currentStreak: number;
  /** Longest streak */
  longestStreak: number;
  /** Total XP earned */
  xpEarned: number;
  /** Last activity date */
  lastActivityAt: string;
}

// ============================================
// PATH GENERATION OPTIONS
// ============================================

export interface PathGenerationOptions {
  /** Program ID to generate path from */
  programId: string;
  /** User ID for personalization */
  userId: string;
  /** Include rest day nodes */
  includeRestDays?: boolean;
  /** Include milestone nodes (weekly, monthly) */
  includeMilestones?: boolean;
  /** Include checkpoint nodes at intervals */
  includeCheckpoints?: boolean;
  /** Layout style */
  layout?: 'linear' | 'branching' | 'spiral';
}

// ============================================
// PATH STATE (for context/hooks)
// ============================================

export interface PathState {
  /** Currently active path */
  activePath: Path | null;
  /** All user paths */
  paths: Path[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
}

// ============================================
// EXERCISE NORMALIZATION
// ============================================

/**
 * Normalize exercise name to a consistent key.
 * Matches existing canonicalName pattern in sync/types.ts.
 */
export function normalizeExerciseKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}

// ============================================
// WORKOUT COMPLETED EVENT (Unified from both flows)
// ============================================

export type WorkoutSource = 'assigned' | 'self';

export interface NormalizedSet {
  weight?: number;
  reps?: number;
  isCompleted: boolean;
  rpe?: number;
  rir?: number;
}

export interface NormalizedExercise {
  exerciseKey: string;   // normalized name (db key)
  exerciseName: string;  // display name
  sets: NormalizedSet[];
}

export interface WorkoutCompletedEvent {
  userId: string;
  workoutId: string;
  source: WorkoutSource;
  originTable: 'assigned_workouts' | 'workout_logs';
  completedAt: Date;
  exercises: NormalizedExercise[];
}

// ============================================
// LIFT STATS (Strength tracking)
// ============================================

export interface UserLiftStats {
  exerciseKey: string;
  e1rmKg: number | null;
  trainingMaxKg: number | null;
  ewmaE1rmKg: number | null;
  volatility: number | null;
  updatedAt: Date;
}

// ============================================
// PLAN DELTA (Adaptation recommendations)
// ============================================

export type PlanDeltaType = 'increase_weight' | 'decrease_weight' | 'add_set' | 'remove_set' | 'rest_day' | 'none';

export interface PlanDelta {
  type: PlanDeltaType;
  exerciseKey?: string;
  reason: string;
  suggestedValue?: number;
}

// ============================================
// PROGRESS RESULT (Output of pure function)
// ============================================

export interface ProgressResult {
  /** Updated lift stats (only for exercises in this workout) */
  updatedStats: Map<string, UserLiftStats>;
  /** Nodes that were completed by this workout */
  nodesCompleted: string[];
  /** Plan adaptation recommendations */
  planDeltas: PlanDelta[];
  /** XP awarded for this workout */
  xpGained: number;
  /** Whether this workout was already processed (idempotency) */
  alreadyProcessed: boolean;
}

// ============================================
// PATH INSTANCE STATUS
// ============================================

export type PathInstanceStatus = 'active' | 'paused' | 'completed' | 'failed';
export type PathTier = 'base' | 'silver' | 'gold' | 'diamond';

// ============================================
// PROGRESSION PROFILES (Weight Suggestion)
// ============================================

/**
 * Progression profile determines how weights are adjusted between sessions.
 * Ported from rn-progression-coach for weight suggestion integration.
 */
export type ProgressionProfile =
  | 'LINEAR_LP'            // Linear progression: add weight each session
  | 'PERCENT_TM'           // Percentage of training max
  | 'DOUBLE_PROGRESSION'   // Increase reps first, then weight
  | 'BODYWEIGHT_STEP'      // Bodyweight exercises (difficulty progressions)
  | 'CONDITIONING_PROGRESS' // Cardio/conditioning (time/distance based)
  | 'MOBILITY_MAINTAIN';    // Mobility/flexibility (maintain, no progression)

/**
 * Exercise kind determines which progression rules apply.
 * Matches prototype definition.
 */
export type ExerciseKind = 'strength' | 'hypertrophy' | 'bodyweight' | 'conditioning' | 'mobility';

// ============================================
// WEIGHT SUGGESTION CONTEXT
// ============================================

/**
 * Context required to generate a weight suggestion for an exercise.
 * This is the input interface for the weight suggestion engine (Phase 2).
 */
export interface WeightSuggestionContext {
  /** Normalized exercise identifier (lowercase, underscores) */
  exerciseKey: string;

  /** Display name for the exercise */
  exerciseName: string;

  /** Type of exercise (determines progression rules) */
  exerciseKind: ExerciseKind;

  /** User's current E1RM for this exercise (from lift_stats.ewma_e1rm_kg) */
  e1rmKg: number | null;

  /** EWMA E1RM if available (preferred over simple Epley) */
  ewmaE1rmKg: number | null;

  /** User's training max if set (from lift_stats) */
  trainingMaxKg: number | null;

  /** Target reps for the set */
  targetReps: number;

  /** Target RPE if specified */
  targetRpe?: number;

  /** What set number this is (1-indexed) */
  setNumber: number;

  /** Progression profile (from program or default) */
  progressionProfile: ProgressionProfile;

  /** User's preferred weight unit */
  preferredUnit: 'lbs' | 'kg';

  /** Last session's weight for this exercise (if any) */
  lastSessionWeightKg?: number;

  /** Last session's reps for this exercise (if any) */
  lastSessionReps?: number;

  /** Last session's RPE for this exercise (if any) */
  lastSessionRpe?: number;
}

/**
 * Output from the weight suggestion engine.
 */
export interface WeightSuggestionResult {
  /** Suggested weight in user's preferred unit */
  suggestedWeight: number;

  /** The unit of the suggested weight */
  unit: 'lbs' | 'kg';

  /** Confidence level (0-1, where 1 = high confidence) */
  confidence: number;

  /** Human-readable reason for the suggestion */
  reason: string;

  /** Source of the suggestion (for debugging/analytics) */
  source: 'ewma_e1rm' | 'epley_e1rm' | 'training_max' | 'last_session' | 'default';
}

export interface PathInstance {
  id: string;
  userId: string;
  pathId: string;
  challengeId: string | null;
  tier: PathTier;
  status: PathInstanceStatus;
  startedAt: Date;
  updatedAt: Date;
  configJson: Record<string, unknown>;
}

// ============================================
// CACHE KEYS
// ============================================

export const CACHE_KEYS = {
  PATHS_PROGRESS: '@paths_progress_v1',
  LIFT_STATS: '@lift_stats_v1',
  PROCESSED_WORKOUTS: '@paths_processed_v1',
} as const;

