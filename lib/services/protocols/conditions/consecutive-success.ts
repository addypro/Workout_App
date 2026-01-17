/**
 * Consecutive Success Condition Evaluator
 *
 * Checks if the user has achieved success for N consecutive sessions.
 * Implements the "2-for-2 rule" and similar patterns.
 *
 * @module protocols/conditions/consecutive-success
 */

import type {
    ConsecutiveSuccessCondition,
    RuleEvaluationContext,
} from '../types';
import type { ConditionResult } from './index';

/**
 * Evaluate CONSECUTIVE_SUCCESS condition
 *
 * The "2-for-2 rule": increase weight when the athlete can perform
 * two more reps for the last set of a given weight in two consecutive workouts.
 *
 * @example
 * // Achieved 3×8 for 2 consecutive sessions
 * {
 *   type: 'CONSECUTIVE_SUCCESS',
 *   params: {
 *     count: 2,
 *     criteria: [
 *       { type: 'SETS_COMPLETED', params: { target: 3 } },
 *       { type: 'REPS_ACHIEVED', params: { target: 8, onSet: 'ALL' } }
 *     ]
 *   }
 * }
 */
export function evaluateConsecutiveSuccess(
    condition: ConsecutiveSuccessCondition,
    context: RuleEvaluationContext
): ConditionResult {
    const { count } = condition.params;
    const actual = context.consecutiveSuccesses;

    const met = actual >= count;

    return {
        met,
        actualValue: actual,
        expectedValue: count,
        reason: met
            ? `Achieved success for ${actual} consecutive sessions (required: ${count})`
            : `Only ${actual}/${count} consecutive successes`,
    };
}
