/**
 * Multiply Weight Effect Executor
 *
 * Multiplies weight by a factor (typically for deloads).
 *
 * From the codified programs:
 * "after three consecutive failures at the same weight, reduce the weight by 10%"
 * "multiply weight by 0.9"
 *
 * @module protocols/effects/multiply-weight
 */

import type {
    MultiplyWeightEffect,
    RuleEvaluationContext,
} from '../types';
import type { EffectResult } from './index';
import { roundToPlate } from './index';

/**
 * Execute MULTIPLY_WEIGHT effect
 *
 * @example
 * // Deload by 10%
 * { type: 'MULTIPLY_WEIGHT', params: { factor: 0.9, roundTo: 2.5 } }
 */
export function executeMultiplyWeight(
    effect: MultiplyWeightEffect,
    context: RuleEvaluationContext
): EffectResult {
    const { factor, roundTo } = effect.params;

    const previousWeight = context.currentWeight;
    let newWeight = previousWeight * factor;

    // Round to plate increment
    const plateIncrement = roundTo ?? context.protocolDefaults.increment.roundTo ?? 2.5;
    newWeight = roundToPlate(newWeight, plateIncrement);

    // Ensure we don't go below a minimum (e.g., empty bar)
    const minWeight = 20; // 20 kg / ~45 lb empty bar
    newWeight = Math.max(newWeight, minWeight);

    const percentChange = Math.round((1 - factor) * 100);

    return {
        success: true,
        previousValue: previousWeight,
        newValue: newWeight,
        message: `Weight reduced by ${percentChange}% from ${previousWeight} to ${newWeight}`,
        sideEffects: {
            stateChanges: {
                currentWeight: newWeight,
                consecutiveFailures: 0, // Reset after deload
                sessionsAtCurrentWeight: 0,
            },
            notify: {
                message: `Deload applied: ${previousWeight} → ${newWeight} (-${percentChange}%)`,
                level: 'INFO',
            },
        },
    };
}
