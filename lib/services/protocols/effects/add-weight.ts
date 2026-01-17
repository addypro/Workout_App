/**
 * Add Weight Effect Executor
 *
 * Increases weight by a fixed amount.
 * The core progression effect for most programs.
 *
 * From the codified programs:
 * "upper‑body lifts increase by 2.5–5 lb and lower‑body lifts by 5–10 lb"
 *
 * @module protocols/effects/add-weight
 */

import type {
    AddWeightEffect,
    RuleEvaluationContext,
} from '../types';
import type { EffectResult } from './index';
import { resolveIncrement, roundToPlate } from './index';

/**
 * Execute ADD_WEIGHT effect
 *
 * @example
 * // Add 5 lb to upper body lift
 * { type: 'ADD_WEIGHT', params: { amount: 5, liftType: 'UPPER' } }
 *
 * @example
 * // Add using defaults
 * { type: 'ADD_WEIGHT', params: { amount: '$defaults.increment.upperBody' } }
 */
export function executeAddWeight(
    effect: AddWeightEffect,
    context: RuleEvaluationContext
): EffectResult {
    const { amount, liftType, roundTo } = effect.params;

    const previousWeight = context.currentWeight;
    const increment = resolveIncrement(
        amount,
        liftType ?? context.liftType,
        context.protocolDefaults
    );

    let newWeight = previousWeight + increment;

    // Round to plate increment if specified
    if (roundTo) {
        newWeight = roundToPlate(newWeight, roundTo);
    } else if (context.protocolDefaults.increment.roundTo) {
        newWeight = roundToPlate(newWeight, context.protocolDefaults.increment.roundTo);
    }

    return {
        success: true,
        previousValue: previousWeight,
        newValue: newWeight,
        message: `Weight increased from ${previousWeight} to ${newWeight} (+${increment})`,
        sideEffects: {
            stateChanges: {
                currentWeight: newWeight,
                consecutiveSuccesses: 0, // Reset on progression
                consecutiveFailures: 0,
                sessionsAtCurrentWeight: 0,
            },
        },
    };
}
