/**
 * Sets Completed Condition Evaluator
 *
 * Checks if the user completed the target number of sets.
 * Simple but essential for most progression logic.
 *
 * @module protocols/conditions/sets-completed
 */

import type {
    SetsCompletedCondition,
    RuleEvaluationContext,
} from '../types';
import type { ConditionResult } from './index';

/**
 * Evaluate SETS_COMPLETED condition
 *
 * @example
 * // User completed all 5 sets
 * { type: 'SETS_COMPLETED', params: { target: 5 } }
 */
export function evaluateSetsCompleted(
    condition: SetsCompletedCondition,
    context: RuleEvaluationContext
): ConditionResult {
    const { target } = condition.params;
    const completed = context.setsCompleted;

    const met = completed >= target;

    return {
        met,
        actualValue: completed,
        expectedValue: target,
        reason: met
            ? `Completed ${completed}/${target} sets`
            : `Only completed ${completed}/${target} sets`,
    };
}
