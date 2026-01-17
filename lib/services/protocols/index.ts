/**
 * Protocol Engine Module
 *
 * Research-driven progression engine that codifies workout protocols
 * from evidence-based sources.
 *
 * @module protocols
 *
 * @example
 * ```typescript
 * import {
 *   protocolRegistry,
 *   evaluateProtocol,
 *   buildEvaluationContext,
 * } from '@/lib/services/protocols';
 *
 * // Initialize on app start
 * await protocolRegistry.initialize();
 *
 * // Get protocol for a program
 * const protocol = protocolRegistry.get('stronglifts-5x5');
 *
 * // Build context from workout data
 * const context = buildEvaluationContext(
 *   userId,
 *   programId,
 *   exerciseData,
 *   historicalData,
 *   protocol.defaults
 * );
 *
 * // Evaluate and get recommendation
 * const result = evaluateProtocol(protocol, context);
 * console.log(result.recommendation);
 * // { action: 'PROGRESS', message: 'Weight increased...', newWeight: 105 }
 * ```
 */

// Types
export type {
    // Core types
    Protocol,
    ProtocolCategory,
    ProgressionRule,
    Condition,
    Effect,
    ConditionType,
    EffectType,
    TriggerEvent,

    // Evidence types
    EvidenceGrade,
    EvidenceScore,
    Source,
    SourceType,

    // Building blocks
    Increment,
    IncrementType,
    RepScheme,
    LiftType,
    MovementPattern,
    ProgressionPattern,
    SetSelector,
    VolumeLandmark,

    // Condition types
    RepsAchievedCondition,
    RepsExceededCondition,
    SetsCompletedCondition,
    ConsecutiveSuccessCondition,
    ConsecutiveFailureCondition,
    RpeBelowCondition,
    RpeAboveCondition,
    VolumeAtCondition,
    WeekCompletedCondition,
    CycleCompletedCondition,
    HoldAchievedCondition,
    StageFailedCondition,
    WeightStalledCondition,
    CompoundCondition,

    // Effect types
    AddWeightEffect,
    MultiplyWeightEffect,
    SetWeightEffect,
    AddRepsEffect,
    AddSetsEffect,
    ChangeStageEffect,
    ChangeSchemeEffect,
    ChangeVariationEffect,
    TriggerDeloadEffect,
    ResetToBaselineEffect,
    HoldEffect,
    NotifyEffect,
    CompoundEffect,

    // Runtime types
    RuleEvaluationContext,
    RuleEvaluationResult,
    AppliedEffect,
    UserProtocolState,
    ProtocolEntry,

    // Periodization
    Stage,
    Phase,
    PeriodizationType,
    PeriodizationConfig,
    VariationProgression,
} from './types';

// Engine
export {
    evaluateRule,
    evaluateProtocol,
    buildEvaluationContext,
    getProgressionRecommendation,
    type ProtocolEvaluationResult,
} from './engine';

// Registry
export { protocolRegistry, ProtocolRegistry } from './registry';

// Loader
export { parseProtocol, validateProtocol, loadProtocolFromJSON } from './loader';

// Conditions
export { evaluateCondition, evaluateAllConditions, type ConditionResult } from './conditions';

// Effects
export { executeEffect, resolveIncrement, roundToPlate, type EffectResult } from './effects';

// Bridges (integration with existing services)
export {
    // Progress Controller Bridge
    generatePlanDeltasWithProtocol,
    hasProtocolForProgram,
    getProtocolInfo,
    type BridgeContext,
    type BridgeResult,
    type SessionHistoryEntry,

    // Paths Engine Bridge
    enrichPathNodeWithProtocol,
    getProtocolDisplayInfo,
    calculateTargetWeight,
    getRepScheme,
    type PathNodeProtocolMetadata,
    type EnrichedPathNode,
    type ProtocolDisplayInfo,
} from './bridges';
