/**
 * Effect Executors Index
 *
 * Re-exports all atomic effect executors.
 * Each executor is a pure function: (effect, context) → EffectResult
 *
 * @module protocols/effects
 */

export { executeAddWeight } from './add-weight';
export { executeMultiplyWeight } from './multiply-weight';
export { executeHold } from './hold';
export { executeNotify } from './notify';
export { executeChangeVariation } from './change-variation';
export { executeTriggerDeload } from './trigger-deload';

import type {
    Effect,
    RuleEvaluationContext,
    LiftType,
} from '../types';

import { executeAddWeight } from './add-weight';
import { executeMultiplyWeight } from './multiply-weight';
import { executeHold } from './hold';
import { executeNotify } from './notify';
import { executeChangeVariation } from './change-variation';
import { executeTriggerDeload } from './trigger-deload';

/**
 * Result of executing an effect
 */
export interface EffectResult {
    success: boolean;
    previousValue: unknown;
    newValue: unknown;
    message: string;
    sideEffects?: {
        notify?: { message: string; level: string };
        stateChanges?: Record<string, unknown>;
    };
}

/**
 * Main dispatcher: executes any effect type
 */
export function executeEffect(
    effect: Effect,
    context: RuleEvaluationContext
): EffectResult {
    switch (effect.type) {
        case 'ADD_WEIGHT':
            return executeAddWeight(effect, context);

        case 'MULTIPLY_WEIGHT':
            return executeMultiplyWeight(effect, context);

        case 'HOLD':
            return executeHold(effect, context);

        case 'NOTIFY':
            return executeNotify(effect, context);

        case 'CHANGE_VARIATION':
            return executeChangeVariation(effect, context);

        case 'TRIGGER_DELOAD':
            return executeTriggerDeload(effect, context);

        // Effects that need more complex state - return placeholder
        case 'SET_WEIGHT':
        case 'ADD_REPS':
        case 'ADD_SETS':
        case 'CHANGE_STAGE':
        case 'CHANGE_SCHEME':
        case 'RESET_TO_BASELINE':
            return {
                success: false,
                previousValue: null,
                newValue: null,
                message: `Effect type ${effect.type} not yet implemented`,
            };

        case 'COMPOUND':
            return executeCompoundEffect(effect, context);

        default:
            return {
                success: false,
                previousValue: null,
                newValue: null,
                message: `Unknown effect type: ${(effect as Effect).type}`,
            };
    }
}

/**
 * Execute compound effect (multiple effects)
 */
function executeCompoundEffect(
    effect: Effect & { type: 'COMPOUND'; params: { effects: Effect[]; mode: string } },
    context: RuleEvaluationContext
): EffectResult {
    const { effects, mode } = effect.params;
    const results = effects.map((e) => executeEffect(e, context));

    const allSuccess = results.every((r) => r.success);

    return {
        success: allSuccess,
        previousValue: results.map((r) => r.previousValue),
        newValue: results.map((r) => r.newValue),
        message: `Compound effect (${mode}): ${results.filter((r) => r.success).length}/${results.length} succeeded`,
    };
}

/**
 * Resolve increment amount based on lift type
 */
export function resolveIncrement(
    amount: number | string,
    liftType: LiftType | undefined,
    defaults: RuleEvaluationContext['protocolDefaults']
): number {
    if (typeof amount === 'number') {
        return amount;
    }

    // Handle string references like "$defaults.increment.upperBody"
    if (amount === '$defaults.increment.upperBody') {
        return defaults.increment.upperBody;
    }
    if (amount === '$defaults.increment.lowerBody') {
        return defaults.increment.lowerBody;
    }
    if (amount === '$defaults.increment') {
        // Use lift type to determine
        return liftType === 'LOWER' || liftType === 'COMPOUND'
            ? defaults.increment.lowerBody
            : defaults.increment.upperBody;
    }

    // Try to parse as number
    const parsed = parseFloat(amount);
    return isNaN(parsed) ? defaults.increment.upperBody : parsed;
}

/**
 * Round weight to nearest plate increment
 */
export function roundToPlate(weight: number, roundTo: number = 2.5): number {
    return Math.round(weight / roundTo) * roundTo;
}
