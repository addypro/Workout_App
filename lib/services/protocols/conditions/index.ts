/**
 * Condition Evaluators Index
 *
 * Re-exports all atomic condition evaluators.
 * Each evaluator is a pure function: (condition, context) → boolean
 *
 * @module protocols/conditions
 */

export { evaluateRepsAchieved } from './reps-achieved';
export { evaluateConsecutiveSuccess } from './consecutive-success';
export { evaluateConsecutiveFailure } from './consecutive-failure';
export { evaluateSetsCompleted } from './sets-completed';
export { evaluateRpeThreshold } from './rpe-threshold';
export { evaluateCompound } from './compound';

import type {
    Condition,
    RuleEvaluationContext,
} from '../types';

import { evaluateRepsAchieved } from './reps-achieved';
import { evaluateConsecutiveSuccess } from './consecutive-success';
import { evaluateConsecutiveFailure } from './consecutive-failure';
import { evaluateSetsCompleted } from './sets-completed';
import { evaluateRpeThreshold } from './rpe-threshold';
import { evaluateCompound } from './compound';

/**
 * Result of evaluating a condition
 */
export interface ConditionResult {
    met: boolean;
    actualValue: unknown;
    expectedValue: unknown;
    reason?: string;
}

/**
 * Main dispatcher: evaluates any condition type
 */
export function evaluateCondition(
    condition: Condition,
    context: RuleEvaluationContext
): ConditionResult {
    switch (condition.type) {
        case 'REPS_ACHIEVED':
            return evaluateRepsAchieved(condition, context);

        case 'SETS_COMPLETED':
            return evaluateSetsCompleted(condition, context);

        case 'CONSECUTIVE_SUCCESS':
            return evaluateConsecutiveSuccess(condition, context);

        case 'CONSECUTIVE_FAILURE':
            return evaluateConsecutiveFailure(condition, context);

        case 'RPE_BELOW':
        case 'RPE_ABOVE':
            return evaluateRpeThreshold(condition, context);

        case 'COMPOUND':
            return evaluateCompound(condition, context);

        // Conditions that need historical data - return false for now
        case 'REPS_EXCEEDED':
        case 'VOLUME_AT':
        case 'WEEK_COMPLETED':
        case 'CYCLE_COMPLETED':
        case 'HOLD_ACHIEVED':
        case 'STAGE_FAILED':
        case 'WEIGHT_STALLED':
            return {
                met: false,
                actualValue: null,
                expectedValue: null,
                reason: `Condition type ${condition.type} not yet implemented`,
            };

        default:
            return {
                met: false,
                actualValue: null,
                expectedValue: null,
                reason: `Unknown condition type: ${(condition as Condition).type}`,
            };
    }
}

/**
 * Evaluate multiple conditions with AND logic
 */
export function evaluateAllConditions(
    conditions: Condition[],
    context: RuleEvaluationContext
): { allMet: boolean; results: ConditionResult[] } {
    const results = conditions.map((c) => evaluateCondition(c, context));
    const allMet = results.every((r) => r.met);
    return { allMet, results };
}
