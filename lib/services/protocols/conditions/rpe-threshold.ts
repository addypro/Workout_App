/**
 * RPE Threshold Condition Evaluator
 *
 * Checks if RPE is below or above a target threshold.
 * Enables autoregulation as described in the codified programs:
 *
 * "If RPE is lower than target (e.g., RPE 6 instead of RPE 8),
 * allow the user to voluntarily increase weight by a small increment.
 * If RPE is higher than target (e.g., 9–10), suggest reducing load."
 *
 * @module protocols/conditions/rpe-threshold
 */

import type {
    RpeBelowCondition,
    RpeAboveCondition,
    RuleEvaluationContext,
    SetSelector,
} from '../types';
import type { ConditionResult } from './index';

type RpeCondition = RpeBelowCondition | RpeAboveCondition;

/**
 * Evaluate RPE_BELOW or RPE_ABOVE condition
 *
 * @example
 * // RPE was too easy (below 6) → can add weight
 * { type: 'RPE_BELOW', params: { target: 6 } }
 *
 * @example
 * // RPE was too hard (above 9) → should reduce
 * { type: 'RPE_ABOVE', params: { target: 9 } }
 */
export function evaluateRpeThreshold(
    condition: RpeCondition,
    context: RuleEvaluationContext
): ConditionResult {
    const { target, onSet = 'ALL' } = condition.params;
    const rpeValues = context.currentRpe;

    if (!rpeValues || rpeValues.length === 0) {
        return {
            met: false,
            actualValue: null,
            expectedValue: { target, type: condition.type },
            reason: 'No RPE data available',
        };
    }

    const relevantRpe = getRelevantRpe(rpeValues, onSet);
    const isBelow = condition.type === 'RPE_BELOW';

    const met = isBelow
        ? relevantRpe.every((rpe) => rpe < target)
        : relevantRpe.every((rpe) => rpe > target);

    const comparison = isBelow ? '<' : '>';

    return {
        met,
        actualValue: relevantRpe,
        expectedValue: { target, comparison },
        reason: met
            ? `RPE ${isBelow ? 'below' : 'above'} ${target} on ${onSet} sets`
            : `RPE not ${isBelow ? 'below' : 'above'} ${target}: got ${JSON.stringify(relevantRpe)}`,
    };
}

/**
 * Get relevant RPE values based on set selector
 */
function getRelevantRpe(rpeValues: number[], selector: SetSelector): number[] {
    switch (selector) {
        case 'ALL':
            return rpeValues;

        case 'ANY':
            return rpeValues; // Check any, but return all for logging

        case 'LAST':
            return rpeValues.length > 0 ? [rpeValues[rpeValues.length - 1]] : [];

        case 'FIRST':
            return rpeValues.length > 0 ? [rpeValues[0]] : [];

        case 'AMRAP':
            return rpeValues.length > 0 ? [rpeValues[rpeValues.length - 1]] : [];

        default:
            return rpeValues;
    }
}
