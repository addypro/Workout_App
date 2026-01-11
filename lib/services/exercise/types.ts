/**
 * Exercise Hierarchy Types
 *
 * Implements a Calistree-style DAG (Directed Acyclic Graph) structure
 * for exercise progressions and regressions.
 *
 * Key Features:
 * - UUID-based relationships for data integrity
 * - Progression/Regression paths for skill development
 * - Muscle Hub categorization (Primary/Secondary Agonists)
 * - Mechanical Function classification
 * - Professional metadata (Tempo, Force, Mechanic)
 */

// ============================================
// CORE IDENTIFIERS
// ============================================

/**
 * Unique identifier for exercises (UUID v4 format)
 * Used for all relationships to prevent broken links
 */
export type ExerciseUUID = string;

/**
 * Canonical slug for human-readable references
 * e.g., "bb_bench_press", "bw_pull_up"
 */
export type CanonicalSlug = string;

// ============================================
// MECHANICAL CLASSIFICATION
// ============================================

/**
 * Force type classification
 */
export type ForceType = 'push' | 'pull' | 'static' | 'dynamic';

/**
 * Movement mechanic classification
 */
export type MechanicType = 'compound' | 'isolation' | 'accessory';

/**
 * Mechanical function categories (movement patterns)
 */
export type MechanicalFunction =
  | 'vertical_push'    // Overhead press, handstand push-up
  | 'vertical_pull'    // Pull-up, lat pulldown
  | 'horizontal_push'  // Bench press, push-up
  | 'horizontal_pull'  // Row variations
  | 'hip_hinge'        // Deadlift, RDL, good morning
  | 'squat'            // Squat variations
  | 'lunge'            // Lunge, split squat, step-up
  | 'carry'            // Farmer's walk, suitcase carry
  | 'rotation'         // Russian twist, woodchop
  | 'anti_rotation'    // Pallof press, plank
  | 'anti_extension'   // Ab wheel, dead bug
  | 'anti_lateral'     // Side plank, suitcase carry
  | 'knee_flexion'     // Leg curl
  | 'knee_extension'   // Leg extension
  | 'hip_extension'    // Hip thrust, glute bridge
  | 'hip_abduction'    // Side leg raise, band walks
  | 'hip_adduction'    // Adductor machine
  | 'ankle_flexion'    // Calf raise
  | 'elbow_flexion'    // Bicep curl
  | 'elbow_extension'  // Tricep extension
  | 'shoulder_flexion' // Front raise
  | 'shoulder_abduction' // Lateral raise
  | 'shoulder_external_rotation' // Face pull, external rotation
  | 'wrist_flexion'    // Wrist curl
  | 'grip'             // Grip training
  | 'plyometric'       // Box jump, depth jump
  | 'ballistic';       // Kettlebell swing, clean

/**
 * Difficulty tier for progression tracking
 */
export type DifficultyTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// ============================================
// MUSCLE HUB CLASSIFICATION
// ============================================

/**
 * Primary muscle groups (Muscle Hubs)
 */
export type MuscleHub =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'hip_flexors'
  | 'adductors'
  | 'abductors';

/**
 * Muscle activation data
 */
export interface MuscleActivation {
  /** Primary muscle hub being trained */
  primary: MuscleHub;
  /** Secondary muscle hubs with significant activation */
  secondary: MuscleHub[];
  /** Stabilizer muscles engaged */
  stabilizers: MuscleHub[];
  /** Specific muscle names within the hubs */
  specifics?: {
    primeMover: string;
    synergists: string[];
    stabilizers: string[];
  };
}

// ============================================
// TEMPO & EXECUTION
// ============================================

/**
 * Tempo notation (4-digit format: ECCENTRIC-PAUSE-CONCENTRIC-PAUSE)
 * e.g., "3010" = 3 sec eccentric, 0 pause, 1 sec concentric, 0 pause
 */
export type TempoNotation = string;

/**
 * Standard tempo presets
 */
export const TEMPO_PRESETS = {
  controlled: '3010',    // Standard controlled rep
  explosive: '1010',     // Fast/explosive
  slow_eccentric: '4010', // Emphasize negative
  paused: '2110',        // Pause at bottom
  tut_focus: '4020',     // Time under tension
  isometric: '0X00',     // Hold at position
} as const;

/**
 * Execution parameters for an exercise
 */
export interface ExecutionParams {
  /** Recommended tempo (4-digit notation) */
  tempo: TempoNotation;
  /** Recommended rep ranges by goal */
  repRanges: {
    strength: { min: number; max: number };
    hypertrophy: { min: number; max: number };
    endurance: { min: number; max: number };
  };
  /** Rest period in seconds by intensity */
  restPeriods: {
    light: number;
    moderate: number;
    heavy: number;
  };
  /** Common form cues */
  cues: string[];
  /** Common mistakes to avoid */
  commonMistakes: string[];
}

// ============================================
// PROGRESSION SYSTEM (DAG)
// ============================================

/**
 * Progression relationship type
 */
export type ProgressionRelationType =
  | 'progression'      // More difficult variant
  | 'regression'       // Easier variant
  | 'sibling'          // Same difficulty, different variation
  | 'alternative'      // Equipment alternative
  | 'unilateral';      // Single-limb version

/**
 * A link in the progression DAG
 */
export interface ProgressionLink {
  /** UUID of the related exercise */
  exerciseId: ExerciseUUID;
  /** Type of relationship */
  type: ProgressionRelationType;
  /** Difficulty delta (-3 to +3) */
  difficultyDelta: number;
  /** Why this is a progression/regression */
  reason?: string;
  /** Prerequisites before attempting this progression */
  prerequisites?: string[];
}

/**
 * Progression path metadata
 */
export interface ProgressionPath {
  /** Name of the progression path (e.g., "Push-up Mastery") */
  name: string;
  /** Description of the path */
  description: string;
  /** Starting exercise UUID */
  startExercise: ExerciseUUID;
  /** End goal exercise UUID */
  goalExercise: ExerciseUUID;
  /** Ordered list of exercises in the path */
  exercises: ExerciseUUID[];
  /** Estimated weeks to complete each step */
  estimatedWeeksPerStep: number;
}

// ============================================
// ENHANCED EXERCISE INTERFACE
// ============================================

/**
 * Full exercise entity with hierarchy support
 * This extends the base ExerciseDatabaseEntry with progression data
 */
export interface EnhancedExercise {
  // ======== Core Identity ========
  /** Unique identifier (UUID v4) */
  id: ExerciseUUID;
  /** Canonical slug for URLs and references */
  slug: CanonicalSlug;
  /** Display name */
  name: string;
  /** Alternative names (for search) */
  aliases: string[];

  // ======== Classification ========
  /** Category (Strength, Bodybuilding, Calisthenics, etc.) */
  category: string;
  /** Required equipment */
  equipment: string[];
  /** Difficulty tier (1-10) */
  difficultyTier: DifficultyTier;
  /** Force type (push/pull/static/dynamic) */
  force: ForceType;
  /** Movement mechanic (compound/isolation/accessory) */
  mechanic: MechanicType;
  /** Primary mechanical function */
  mechanicalFunction: MechanicalFunction;
  /** Secondary mechanical functions (if any) */
  secondaryFunctions?: MechanicalFunction[];

  // ======== Muscle Targeting ========
  /** Muscle activation data */
  muscles: MuscleActivation;

  // ======== Progression Hierarchy ========
  /** Direct progressions (harder variants) */
  progressions: ProgressionLink[];
  /** Direct regressions (easier variants) */
  regressions: ProgressionLink[];
  /** Sibling exercises (same level, different variation) */
  siblings: ProgressionLink[];
  /** Is this a "root" exercise (has no regressions) */
  isRootExercise: boolean;
  /** Is this a "goal" exercise (has no progressions) */
  isGoalExercise: boolean;

  // ======== Execution ========
  /** Execution parameters */
  execution?: ExecutionParams;

  // ======== Media ========
  /** Video URL (if available) */
  videoUrl?: string;
  /** Thumbnail image URL */
  thumbnailUrl?: string;

  // ======== Metadata ========
  /** Movement patterns (for search) */
  movementPatterns: string[];
  /** Planes of motion */
  planesOfMotion: string[];
  /** Search keywords */
  keywords: string[];
  /** Popularity score (0-100) */
  popularityScore: number;
}

// ============================================
// PROGRESSION TREE VISUALIZATION
// ============================================

/**
 * Node in a progression tree visualization
 */
export interface ProgressionTreeNode {
  exercise: EnhancedExercise;
  level: number; // 0 = current, -N = regressions, +N = progressions
  children: ProgressionTreeNode[];
  isCurrentExercise: boolean;
  isUnlocked: boolean; // Based on user's skill level
}

/**
 * Full progression tree for an exercise
 */
export interface ProgressionTree {
  /** The exercise being viewed */
  currentExercise: EnhancedExercise;
  /** Root exercises (no regressions) */
  roots: ProgressionTreeNode[];
  /** Goal exercises (no progressions) */
  goals: ProgressionTreeNode[];
  /** All exercises in the tree */
  allExercises: EnhancedExercise[];
  /** Total depth of the tree */
  maxDepth: number;
}

// ============================================
// SEARCH RESULT TYPES
// ============================================

/**
 * Enhanced search result with progression context
 */
export interface HierarchicalSearchResult {
  exercise: EnhancedExercise;
  score: number;
  matchType: 'exact' | 'alias' | 'mechanical' | 'muscle' | 'fuzzy';
  matchedTerm?: string;
  /** Related exercises from the same progression path */
  progressionContext?: {
    regressions: EnhancedExercise[];
    progressions: EnhancedExercise[];
    siblings: EnhancedExercise[];
  };
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Filter options for exercise browsing
 */
export interface ExerciseFilters {
  query?: string;
  muscleHub?: MuscleHub;
  mechanicalFunction?: MechanicalFunction;
  equipment?: string;
  difficultyRange?: { min: DifficultyTier; max: DifficultyTier };
  force?: ForceType;
  mechanic?: MechanicType;
  category?: string;
  hasProgressions?: boolean;
  hasRegressions?: boolean;
}

/**
 * User's progression status for an exercise
 */
export interface UserExerciseStatus {
  exerciseId: ExerciseUUID;
  isUnlocked: boolean;
  isMastered: boolean;
  bestPerformance?: {
    weight?: number;
    reps?: number;
    time?: number;
  };
  lastPerformed?: Date;
  timesPerformed: number;
}
