/**
 * Compound Condition Evaluator
 *
 * Combines multiple conditions with AND/OR/NOT logic.
 * Enables complex rule triggers.
 *
 * @module protocols/conditions/compound
 */

import type {
    CompoundCondition,
    Condition,
    RuleEvaluationContext,
} from '../types';
import type { ConditionResult } from './index';

// Forward declaration to avoid circular dependency
// The actual evaluateCondition is imported at runtime
let evaluateCondition: (condition: Condition, context: RuleEvaluationContext) => ConditionResult;

/**
 * Set the condition evaluator function (called from index.ts to avoid circular dep)
 */
export function setConditionEvaluator(
    fn: (condition: Condition, context: RuleEvaluationContext) => ConditionResult
): void {
    evaluateCondition = fn;
}

/**
 * Evaluate COMPOUND condition (AND/OR/NOT)
 *
 * @example
 * // NOT (achieved 5 reps on all sets)
 * {
 *   type: 'COMPOUND',
 *   params: {
 *     operator: 'NOT',
 *     conditions: [
 *       { type: 'REPS_ACHIEVED', params: { target: 5, onSet: 'ALL' } }
 *     ]
 *   }
 * }
 *
 * @example
 * // Failed AND at same weight for 3 sessions
 * {
 *   type: 'COMPOUND',
 *   params: {
 *     operator: 'AND',
 *     conditions: [
 *       { type: 'CONSECUTIVE_FAILURE', params: { count: 3 } },
 *       { type: 'WEIGHT_STALLED', params: { sessions: 3 } }
 *     ]
 *   }
 * }
 */
export function evaluateCompound(
    condition: CompoundCondition,
    context: RuleEvaluationContext
): ConditionResult {
    const { operator, conditions } = condition.params;

    if (!evaluateCondition) {
        return {
            met: false,
            actualValue: null,
            expectedValue: { operator, conditions: conditions.length },
            reason: 'Compound evaluator not initialized',
        };
    }

    if (conditions.length === 0) {
        return {
            met: true, // Empty AND is vacuously true
            actualValue: [],
            expectedValue: { operator },
            reason: 'No conditions to evaluate',
        };
    }

    const results = conditions.map((c) => evaluateCondition(c, context));

    switch (operator) {
        case 'AND': {
            const met = results.every((r) => r.met);
            return {
                met,
                actualValue: results.map((r) => r.met),
                expectedValue: { operator: 'AND', count: conditions.length },
                reason: met
                    ? `All ${conditions.length} conditions met`
                    : `Not all conditions met: ${results.filter((r) => !r.met).length} failed`,
            };
        }

        case 'OR': {
            const met = results.some((r) => r.met);
            return {
                met,
                actualValue: results.map((r) => r.met),
                expectedValue: { operator: 'OR', count: conditions.length },
                reason: met
                    ? `At least one condition met`
                    : `No conditions met out of ${conditions.length}`,
            };
        }

        case 'NOT': {
            // NOT applies to the first condition only
            const firstResult = results[0];
            const met = !firstResult.met;
            return {
                met,
                actualValue: !firstResult.met,
                expectedValue: { operator: 'NOT', original: firstResult.met },
                reason: met
                    ? `Condition NOT met (inverted: true)`
                    : `Condition WAS met (inverted: false)`,
            };
        }

        default:
            return {
                met: false,
                actualValue: null,
                expectedValue: operator,
                reason: `Unknown operator: ${operator}`,
            };
    }
}
