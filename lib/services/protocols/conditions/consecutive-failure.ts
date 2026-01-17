/**
 * Consecutive Failure Condition Evaluator
 *
 * Checks if the user has failed for N consecutive sessions.
 * Triggers deload protocols in most programs.
 *
 * From the codified programs:
 * "after three consecutive failures at the same weight (or when performance drops),
 * reduce the weight by 10%"
 *
 * @module protocols/conditions/consecutive-failure
 */

import type {
    ConsecutiveFailureCondition,
    RuleEvaluationContext,
} from '../types';
import type { ConditionResult } from './index';

/**
 * Evaluate CONSECUTIVE_FAILURE condition
 *
 * @example
 * // Failed 3 times at same weight → deload
 * {
 *   type: 'CONSECUTIVE_FAILURE',
 *   params: { count: 3, sameWeight: true }
 * }
 *
 * @example
 * // Failed 2 times on OHP specifically → micro-load
 * {
 *   type: 'CONSECUTIVE_FAILURE',
 *   params: { count: 2, exercise: 'overhead_press' }
 * }
 */
export function evaluateConsecutiveFailure(
    condition: ConsecutiveFailureCondition,
    context: RuleEvaluationContext
): ConditionResult {
    const { count, sameWeight, exercise } = condition.params;

    // If exercise specified, check it matches
    if (exercise && !context.exerciseKey.toLowerCase().includes(exercise.toLowerCase())) {
        return {
            met: false,
            actualValue: context.exerciseKey,
            expectedValue: exercise,
            reason: `Exercise ${context.exerciseKey} doesn't match filter ${exercise}`,
        };
    }

    const failures = context.consecutiveFailures;

    // If sameWeight is required, also check sessionsAtCurrentWeight
    if (sameWeight) {
        const atSameWeight = context.sessionsAtCurrentWeight >= count;
        const met = failures >= count && atSameWeight;

        return {
            met,
            actualValue: { failures, sessionsAtCurrentWeight: context.sessionsAtCurrentWeight },
            expectedValue: { count, sameWeight },
            reason: met
                ? `Failed ${failures} times at same weight (${context.currentWeight})`
                : `Failures: ${failures}/${count}, sessions at weight: ${context.sessionsAtCurrentWeight}`,
        };
    }

    const met = failures >= count;

    return {
        met,
        actualValue: failures,
        expectedValue: count,
        reason: met
            ? `Failed ${failures} consecutive sessions (threshold: ${count})`
            : `Only ${failures}/${count} consecutive failures`,
    };
}
