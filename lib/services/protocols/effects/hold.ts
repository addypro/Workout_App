/**
 * Hold Effect Executor
 *
 * Keeps the current weight (no change).
 * Used when the user partially completed the workout.
 *
 * From the codified programs:
 * "If the user fails to complete all sets, they repeat the weight"
 *
 * @module protocols/effects/hold
 */

import type {
    HoldEffect,
    RuleEvaluationContext,
} from '../types';
import type { EffectResult } from './index';

/**
 * Execute HOLD effect
 *
 * @example
 * // Keep current weight
 * { type: 'HOLD', params: {} }
 */
export function executeHold(
    _effect: HoldEffect,
    context: RuleEvaluationContext
): EffectResult {
    const currentWeight = context.currentWeight;

    return {
        success: true,
        previousValue: currentWeight,
        newValue: currentWeight,
        message: `Weight held at ${currentWeight}. Retry next session.`,
        sideEffects: {
            stateChanges: {
                sessionsAtCurrentWeight: context.sessionsAtCurrentWeight + 1,
            },
        },
    };
}
