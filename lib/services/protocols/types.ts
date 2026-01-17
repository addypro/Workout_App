/**
 * Protocol Engine Types
 *
 * Atomic, composable types for the research-driven progression engine.
 * These types model the "Codified Workout Programs" specification.
 *
 * @module protocols/types
 */

// ============================================
// EVIDENCE & RESEARCH BACKING
// ============================================

/**
 * Evidence grade based on study type and quality.
 * A = Meta-analysis/Systematic Review with large sample
 * B = RCT or high-quality review
 * C = Observational study or small RCT
 * D = Expert opinion or anecdotal
 */
export type EvidenceGrade = 'A' | 'B' | 'C' | 'D';

/** Type of research source */
export type SourceType =
    | 'META_ANALYSIS'
    | 'SYSTEMATIC_REVIEW'
    | 'RCT'
    | 'OBSERVATIONAL'
    | 'EXPERT_OPINION';

/** Research source with citation and relevance */
export interface Source {
    id: string;
    type: SourceType;
    citation: string; // APA format
    doi?: string;
    pubmedId?: string;
    year: number;
    sampleSize?: number;
    effectSize?: number; // Cohen's d
    confidenceInterval?: [number, number];
    relevance: number; // 0-1, how applicable to this rule
}

/** Evidence score combining multiple sources */
export interface EvidenceScore {
    grade: EvidenceGrade;
    confidence: number; // 0-1
    sources: Source[];
    reasoning?: string;
    lastUpdated: Date;
}

// ============================================
// ATOMIC BUILDING BLOCKS
// ============================================

/** Weight increment type */
export type IncrementType = 'ABSOLUTE' | 'PERCENTAGE' | 'VARIATION';

/** Standard weight increment configuration */
export interface Increment {
    type: IncrementType;
    upperBody: number; // 2.5-5 lb typically
    lowerBody: number; // 5-10 lb typically
    roundTo?: number; // Plate increment (2.5 lb)
}

/** Rep scheme for a set/exercise */
export interface RepScheme {
    sets: number;
    reps: number | 'AMRAP';
    percentage?: number; // Of training max
    rpe?: number; // Target RPE
    rir?: number; // Reps in reserve
}

/** Lift type for increment determination */
export type LiftType = 'UPPER' | 'LOWER' | 'COMPOUND' | 'ISOLATION' | 'ACCESSORY';

/** Movement pattern for exercise categorization */
export type MovementPattern =
    | 'HORIZONTAL_PUSH'
    | 'HORIZONTAL_PULL'
    | 'VERTICAL_PUSH'
    | 'VERTICAL_PULL'
    | 'SQUAT'
    | 'HIP_HINGE'
    | 'LUNGE'
    | 'CARRY'
    | 'ROTATION'
    | 'ISOMETRIC';

// ============================================
// PROGRESSION PATTERNS
// ============================================

/**
 * High-level progression pattern types.
 * Each maps to a family of rules.
 */
export type ProgressionPattern =
    | 'LINEAR' // StrongLifts: +5lb/session
    | 'DOUBLE' // Reps first, then weight
    | 'TWO_FOR_TWO' // 2 extra reps for 2 sessions
    | 'AMRAP_BASED' // Greyskull/nSuns: AMRAP determines increment
    | 'PERCENTAGE_CYCLE' // 5/3/1: TM + cycle percentages
    | 'TIERED' // GZCLP: T1/T2/T3 with stage transitions
    | 'VARIATION' // Bodyweight: progress to harder exercise
    | 'TIME_BASED' // Calisthenics skills: hold duration
    | 'VOLUME_WAVE'; // RP Hypertrophy: MEV → MAV → MRV → deload

// ============================================
// CONDITION TYPES (Atomic Evaluators)
// ============================================

/**
 * Condition type identifiers.
 * Each has a corresponding evaluator function.
 */
export type ConditionType =
    | 'REPS_ACHIEVED' // Hit target reps on specified sets
    | 'REPS_EXCEEDED' // AMRAP exceeded threshold
    | 'SETS_COMPLETED' // All prescribed sets completed
    | 'CONSECUTIVE_SUCCESS' // N consecutive successful sessions (2-for-2)
    | 'CONSECUTIVE_FAILURE' // N consecutive failures at same weight
    | 'RPE_BELOW' // RPE < target (too easy)
    | 'RPE_ABOVE' // RPE > target (too hard)
    | 'VOLUME_AT' // Volume at MEV/MAV/MRV landmark
    | 'WEEK_COMPLETED' // End of training week
    | 'CYCLE_COMPLETED' // End of mesocycle/macrocycle
    | 'HOLD_ACHIEVED' // Isometric hold time met
    | 'STAGE_FAILED' // GZCLP-style stage failure
    | 'WEIGHT_STALLED' // Same weight for N sessions
    | 'COMPOUND'; // AND/OR/NOT of other conditions

/** Set selector for conditions */
export type SetSelector = 'ALL' | 'ANY' | 'LAST' | 'FIRST' | 'AMRAP';

/** Base condition interface */
export interface BaseCondition {
    type: ConditionType;
}

/** Reps achieved condition */
export interface RepsAchievedCondition extends BaseCondition {
    type: 'REPS_ACHIEVED';
    params: {
        target: number;
        onSet: SetSelector;
        met?: boolean; // Default true, set false to check NOT achieved
    };
}

/** Reps exceeded condition (for AMRAP) */
export interface RepsExceededCondition extends BaseCondition {
    type: 'REPS_EXCEEDED';
    params: {
        threshold: number;
        onSet: SetSelector;
    };
}

/** Sets completed condition */
export interface SetsCompletedCondition extends BaseCondition {
    type: 'SETS_COMPLETED';
    params: {
        target: number;
    };
}

/** Consecutive success condition (2-for-2 rule) */
export interface ConsecutiveSuccessCondition extends BaseCondition {
    type: 'CONSECUTIVE_SUCCESS';
    params: {
        count: number; // Number of consecutive sessions
        criteria: Condition[]; // What counts as "success"
    };
}

/** Consecutive failure condition (triggers deload) */
export interface ConsecutiveFailureCondition extends BaseCondition {
    type: 'CONSECUTIVE_FAILURE';
    params: {
        count: number; // Default 3 for most programs
        sameWeight?: boolean; // Must be at same weight
        exercise?: string; // Specific exercise (optional)
        criteria?: Condition[]; // What counts as "failure"
    };
}

/** RPE below target (too easy) */
export interface RpeBelowCondition extends BaseCondition {
    type: 'RPE_BELOW';
    params: {
        target: number; // e.g., 6 means RPE < 6
        onSet?: SetSelector;
    };
}

/** RPE above target (too hard) */
export interface RpeAboveCondition extends BaseCondition {
    type: 'RPE_ABOVE';
    params: {
        target: number; // e.g., 9 means RPE > 9
        onSet?: SetSelector;
    };
}

/** Volume landmark condition (MEV/MAV/MRV) */
export type VolumeLandmark = 'MEV' | 'MAV' | 'MRV';

export interface VolumeAtCondition extends BaseCondition {
    type: 'VOLUME_AT';
    params: {
        landmark: VolumeLandmark;
        muscleGroup: string;
        comparison: 'BELOW' | 'AT' | 'APPROACHING' | 'EXCEEDING';
        tolerance?: number; // Percentage buffer
    };
}

/** Week completed condition */
export interface WeekCompletedCondition extends BaseCondition {
    type: 'WEEK_COMPLETED';
    params: {
        weekNumber?: number; // Specific week, or any if omitted
    };
}

/** Cycle completed condition */
export interface CycleCompletedCondition extends BaseCondition {
    type: 'CYCLE_COMPLETED';
    params: {
        cycleName?: string; // e.g., "accumulation", "deload"
    };
}

/** Hold achieved condition (for isometrics) */
export interface HoldAchievedCondition extends BaseCondition {
    type: 'HOLD_ACHIEVED';
    params: {
        durationSec: number;
        onSet: SetSelector;
    };
}

/** Stage failed condition (GZCLP) */
export interface StageFailedCondition extends BaseCondition {
    type: 'STAGE_FAILED';
    params: {
        tier?: 'T1' | 'T2' | 'T3';
        stage?: string; // e.g., "stage1", "stage2", "stage3"
    };
}

/** Weight stalled condition */
export interface WeightStalledCondition extends BaseCondition {
    type: 'WEIGHT_STALLED';
    params: {
        sessions: number; // Number of sessions at same weight
    };
}

/** Compound condition (AND/OR/NOT) */
export interface CompoundCondition extends BaseCondition {
    type: 'COMPOUND';
    params: {
        operator: 'AND' | 'OR' | 'NOT';
        conditions: Condition[];
    };
}

/** Union of all condition types */
export type Condition =
    | RepsAchievedCondition
    | RepsExceededCondition
    | SetsCompletedCondition
    | ConsecutiveSuccessCondition
    | ConsecutiveFailureCondition
    | RpeBelowCondition
    | RpeAboveCondition
    | VolumeAtCondition
    | WeekCompletedCondition
    | CycleCompletedCondition
    | HoldAchievedCondition
    | StageFailedCondition
    | WeightStalledCondition
    | CompoundCondition;

// ============================================
// EFFECT TYPES (Atomic Executors)
// ============================================

/**
 * Effect type identifiers.
 * Each has a corresponding executor function.
 */
export type EffectType =
    | 'ADD_WEIGHT' // +5lb, +10lb
    | 'MULTIPLY_WEIGHT' // 0.9x for deload
    | 'SET_WEIGHT' // Set to specific value
    | 'ADD_REPS' // +1 rep
    | 'ADD_SETS' // +1 set
    | 'CHANGE_STAGE' // GZCLP: Stage 1→2→3
    | 'CHANGE_SCHEME' // 5×3 → 6×2 → 10×1
    | 'CHANGE_VARIATION' // Knee pushup → Standard
    | 'TRIGGER_DELOAD' // Start deload week
    | 'RESET_TO_BASELINE' // Reset after test
    | 'HOLD' // Keep current weight (no change)
    | 'NOTIFY' // Alert user
    | 'COMPOUND'; // Multiple effects

/** Base effect interface */
export interface BaseEffect {
    type: EffectType;
}

/** Add weight effect */
export interface AddWeightEffect extends BaseEffect {
    type: 'ADD_WEIGHT';
    params: {
        amount: number | string; // Number or "$defaults.increment.upperBody"
        liftType?: LiftType;
        roundTo?: number;
        override?: boolean; // Override default increment
    };
}

/** Multiply weight effect (for deloads) */
export interface MultiplyWeightEffect extends BaseEffect {
    type: 'MULTIPLY_WEIGHT';
    params: {
        factor: number; // 0.9 = 10% reduction
        roundTo?: number;
    };
}

/** Set weight to specific value */
export interface SetWeightEffect extends BaseEffect {
    type: 'SET_WEIGHT';
    params: {
        value: number | string; // Number or expression
        roundTo?: number;
    };
}

/** Add reps effect */
export interface AddRepsEffect extends BaseEffect {
    type: 'ADD_REPS';
    params: {
        amount: number;
        maxReps?: number;
    };
}

/** Add sets effect */
export interface AddSetsEffect extends BaseEffect {
    type: 'ADD_SETS';
    params: {
        amount: number;
        maxSets?: number;
    };
}

/** Change stage effect (GZCLP) */
export interface ChangeStageEffect extends BaseEffect {
    type: 'CHANGE_STAGE';
    params: {
        direction: 'NEXT' | 'PREVIOUS' | 'RESET';
        target?: string; // Specific stage ID
        onFinalStage?: 'TEST_5RM' | 'TEST_1RM' | 'DELOAD';
    };
}

/** Change rep scheme effect */
export interface ChangeSchemeEffect extends BaseEffect {
    type: 'CHANGE_SCHEME';
    params: {
        newScheme: RepScheme;
    };
}

/** Change variation effect (bodyweight) */
export interface ChangeVariationEffect extends BaseEffect {
    type: 'CHANGE_VARIATION';
    params: {
        direction: 'NEXT' | 'PREVIOUS';
        series: string; // e.g., "push", "pull", "squat"
    };
}

/** Trigger deload effect */
export interface TriggerDeloadEffect extends BaseEffect {
    type: 'TRIGGER_DELOAD';
    params: {
        durationWeeks?: number;
        intensityReduction?: number; // 0-1
        volumeReduction?: number; // 0-1
        reason: string;
    };
}

/** Reset to baseline effect */
export interface ResetToBaselineEffect extends BaseEffect {
    type: 'RESET_TO_BASELINE';
    params: {
        test: '5RM' | '3RM' | '1RM' | 'AMRAP';
        newWeightFactor: number; // e.g., 0.85 for 85% of test result
    };
}

/** Hold (no change) effect */
export interface HoldEffect extends BaseEffect {
    type: 'HOLD';
    params: Record<string, never>; // Empty params
}

/** Notify user effect */
export interface NotifyEffect extends BaseEffect {
    type: 'NOTIFY';
    params: {
        message: string;
        level?: 'INFO' | 'WARNING' | 'SUCCESS';
        actionable?: boolean;
    };
}

/** Compound effect (multiple effects) */
export interface CompoundEffect extends BaseEffect {
    type: 'COMPOUND';
    params: {
        effects: Effect[];
        mode: 'SEQUENTIAL' | 'PARALLEL';
    };
}

/** Union of all effect types */
export type Effect =
    | AddWeightEffect
    | MultiplyWeightEffect
    | SetWeightEffect
    | AddRepsEffect
    | AddSetsEffect
    | ChangeStageEffect
    | ChangeSchemeEffect
    | ChangeVariationEffect
    | TriggerDeloadEffect
    | ResetToBaselineEffect
    | HoldEffect
    | NotifyEffect
    | CompoundEffect;

// ============================================
// TRIGGER EVENTS
// ============================================

/** Events that can trigger rule evaluation */
export type TriggerEvent =
    | 'WORKOUT_COMPLETED'
    | 'SET_COMPLETED'
    | 'EXERCISE_COMPLETED'
    | 'WEEK_END'
    | 'CYCLE_END'
    | 'DELOAD_DUE'
    | 'STALL_DETECTED'
    | 'MANUAL';

// ============================================
// PROGRESSION RULE
// ============================================

/**
 * A progression rule: Condition(s) → Effect(s)
 * Core unit of the protocol engine.
 */
export interface ProgressionRule {
    id: string;
    name: string;
    description: string;
    priority: number; // Higher = evaluated first (0-100)
    enabled: boolean;

    trigger: {
        event: TriggerEvent;
        conditions: Condition[]; // All must be true (AND)
    };

    effect: Effect | Effect[]; // Single or compound

    evidence: {
        grade: EvidenceGrade;
        sources: string[]; // Source IDs
        notes?: string;
    };

    // Rule behavior modifiers
    cooldown?: number; // Minimum sessions between applications
    conflictGroup?: string; // Rules in same group are mutually exclusive
}

// ============================================
// STAGE (for tiered programs like GZCLP)
// ============================================

export interface Stage {
    id: string;
    t1: RepScheme;
    t2: RepScheme;
    t3: RepScheme;
}

// ============================================
// PERIODIZATION
// ============================================

export type PeriodizationType = 'LINEAR' | 'UNDULATING' | 'BLOCK' | 'CONJUGATE' | 'PERCENTAGE_CYCLE';

export interface Phase {
    id?: string;
    name: string;
    week?: number; // Week number in cycle (for 5/3/1-style programs)
    durationWeeks?: number;
    focus?: 'VOLUME' | 'INTENSITY' | 'PEAKING' | 'DELOAD';
    volumeMultiplier?: number;
    intensityMultiplier?: number;
    activeRules?: string[]; // Rule IDs active in this phase
    scheme?: {
        sets: number;
        reps: (number | string)[];
        percentages: number[];
    };
}

export interface PeriodizationConfig {
    type: PeriodizationType;
    phases: Phase[];
    deloadStrategy?: {
        trigger: 'SCHEDULED' | 'FATIGUE_BASED' | 'STALL_BASED' | 'HYBRID';
        scheduledInterval?: number; // Weeks
        fatigueThreshold?: number;
    };
}

// ============================================
// VARIATION PROGRESSION (Bodyweight)
// ============================================

export interface VariationProgression {
    movement: string; // e.g., "push", "pull", "squat"
    variations: string[]; // Ordered from easiest to hardest
}

// ============================================
// PROTOCOL (Program-Level Container)
// ============================================

export type ProtocolCategory = 'LINEAR' | 'SPLIT' | 'BODYWEIGHT' | 'FULLBODY' | 'CONDITIONING';

/**
 * A protocol encapsulates all progression logic for a program.
 * This is the top-level type that gets loaded from YAML.
 */
export interface Protocol {
    id: string;
    name: string;
    version: string;
    description: string;
    category: ProtocolCategory;
    authors?: string[];

    // Default configuration
    defaults: {
        increment: Increment;
        deloadTrigger: number; // Failures before deload (default: 3)
        deloadFactor: number; // Weight multiplier (default: 0.9)
        targetRpe?: number;
        targetRir?: number;
    };

    // The rules that drive progression
    rules: ProgressionRule[];

    // Evidence backing
    evidence: EvidenceScore;

    // Optional: stages for tiered programs (GZCLP)
    stages?: Stage[];

    // Optional: variation progressions (bodyweight)
    progressions?: VariationProgression[];

    // Optional: periodization structure
    periodization?: PeriodizationConfig;

    // Metadata
    createdAt?: Date;
    updatedAt?: Date;
    status?: 'DRAFT' | 'VALIDATED' | 'PUBLISHED' | 'DEPRECATED';
}

// ============================================
// RUNTIME CONTEXT
// ============================================

/** Context passed to rule evaluation */
export interface RuleEvaluationContext {
    userId: string;
    programId: string;
    workoutId?: string;
    exerciseKey: string;
    exerciseName: string;
    liftType: LiftType;
    movementPattern?: MovementPattern;

    // Current session data
    currentWeight: number;
    /** @alias currentWeight - for bridge compatibility */
    weightKg?: number;
    currentReps: number[];
    /** @alias currentReps - for bridge compatibility */
    repsPerSet?: number[];
    currentRpe?: number[];
    /** @alias currentRpe[0] - for bridge compatibility */
    rpe?: number;
    setsCompleted: number;
    targetSets: number;
    targetReps: number;

    // Historical data
    previousWeight?: number;
    previousReps?: number[];
    consecutiveSuccesses: number;
    consecutiveFailures: number;
    sessionsAtCurrentWeight: number;

    // E1RM tracking (for bridge compatibility)
    previousE1rmKg?: number;
    currentE1rmKg?: number;
    ewmaE1rmKg?: number;

    // Periodization state
    currentWeek?: number;
    currentCycle?: number;

    // For tiered programs
    currentStage?: string;
    currentTier?: 'T1' | 'T2' | 'T3';

    // For bodyweight programs
    currentVariation?: string;

    // Protocol configuration
    protocolDefaults: Protocol['defaults'];
    /** @alias protocolDefaults - for bridge compatibility */
    defaults?: Protocol['defaults'];
}

/** Result of evaluating a single rule */
export interface RuleEvaluationResult {
    ruleId: string;
    triggered: boolean;
    conditionResults: {
        conditionType: ConditionType;
        met: boolean;
        actualValue: unknown;
        expectedValue: unknown;
    }[];
    suggestedEffect?: Effect;
    confidence: number; // 0-1 based on evidence
    reasoning: string;
}

/** Result of applying an effect */
export interface AppliedEffect {
    ruleId: string;
    effectType: EffectType;
    appliedAt: Date;
    previousValue: unknown;
    newValue: unknown;
    /** @deprecated Use previousValue */
    oldValue?: unknown;
    success: boolean;
    message?: string;
    /** @deprecated Use message */
    description?: string;
}

/** Progression recommendation for display */
export interface ProgressionRecommendation {
    action: 'PROGRESS' | 'HOLD' | 'DELOAD' | 'RESET' | 'ADVANCE_STAGE' | 'REGRESS_STAGE' | 'CHANGE_VARIATION' | 'NOTIFY' | 'NONE';
    message: string;
    newWeight?: number;
    newReps?: number;
    newSets?: number;
    newStage?: string;
    newVariation?: string;
    confidence?: number;
    evidenceGrade?: EvidenceGrade;
}

// ============================================
// STORAGE TYPES
// ============================================

/** User's protocol state for an exercise */
export interface UserProtocolState {
    exerciseKey: string;
    currentWeight: number;
    currentStage?: string;
    currentVariation?: string;
    consecutiveSuccesses: number;
    consecutiveFailures: number;
    sessionsAtCurrentWeight: number;
    lastEvaluatedAt: Date;
    appliedEffects: AppliedEffect[];
}

/** Protocol registry entry */
export interface ProtocolEntry {
    protocol: Protocol;
    loadedAt: Date;
    source: 'BUNDLED' | 'REMOTE' | 'USER';
}
