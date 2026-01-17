/**
 * Reps Achieved Condition Evaluator
 *
 * Checks if target reps were achieved on specified sets.
 * Used by most programs: StrongLifts (5×5), Greyskull (AMRAP), etc.
 *
 * @module protocols/conditions/reps-achieved
 */

import type {
    RepsAchievedCondition,
    RuleEvaluationContext,
    SetSelector,
} from '../types';
import type { ConditionResult } from './index';

/**
 * Evaluate REPS_ACHIEVED condition
 *
 * @example
 * // All sets hit 5 reps
 * { type: 'REPS_ACHIEVED', params: { target: 5, onSet: 'ALL' } }
 *
 * @example
 * // Last set hit at least 8 reps (AMRAP)
 * { type: 'REPS_ACHIEVED', params: { target: 8, onSet: 'LAST' } }
 */
export function evaluateRepsAchieved(
    condition: RepsAchievedCondition,
    context: RuleEvaluationContext
): ConditionResult {
    const { target, onSet, met = true } = condition.params;
    const reps = context.currentReps;

    if (!reps || reps.length === 0) {
        return {
            met: !met, // If expecting NOT achieved, empty = met
            actualValue: [],
            expectedValue: { target, onSet },
            reason: 'No rep data available',
        };
    }

    const achieved = checkRepsOnSelector(reps, target, onSet);

    // XOR with `met` param: if met=false, we want achieved=false to be true
    const conditionMet = met ? achieved : !achieved;

    return {
        met: conditionMet,
        actualValue: reps,
        expectedValue: { target, onSet, met },
        reason: conditionMet
            ? `Reps ${met ? 'achieved' : 'not achieved'} as expected`
            : `Expected ${met ? 'to achieve' : 'NOT to achieve'} ${target} reps on ${onSet}, got ${JSON.stringify(reps)}`,
    };
}

/**
 * Check if reps meet target based on set selector
 */
function checkRepsOnSelector(
    reps: number[],
    target: number,
    selector: SetSelector
): boolean {
    switch (selector) {
        case 'ALL':
            return reps.every((r) => r >= target);

        case 'ANY':
            return reps.some((r) => r >= target);

        case 'LAST':
            return reps.length > 0 && reps[reps.length - 1] >= target;

        case 'FIRST':
            return reps.length > 0 && reps[0] >= target;

        case 'AMRAP':
            // AMRAP is typically the last set
            return reps.length > 0 && reps[reps.length - 1] >= target;

        default:
            return false;
    }
}
