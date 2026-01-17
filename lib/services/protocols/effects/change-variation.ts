/**
 * Change Variation Effect Executor
 *
 * Progresses to the next (or previous) exercise variation.
 * Core effect for bodyweight programs.
 *
 * From the codified programs:
 * "once you can do at least 3×8 reps, move to the next harder variation"
 * "Wall Pushup → Incline → Knee → Standard → Diamond → Archer"
 *
 * @module protocols/effects/change-variation
 */

import type {
    ChangeVariationEffect,
    RuleEvaluationContext,
} from '../types';
import type { EffectResult } from './index';

/**
 * Execute CHANGE_VARIATION effect
 *
 * @example
 * // Progress to next push variation
 * {
 *   type: 'CHANGE_VARIATION',
 *   params: { direction: 'NEXT', series: 'push' }
 * }
 */
export function executeChangeVariation(
    effect: ChangeVariationEffect,
    context: RuleEvaluationContext
): EffectResult {
    const { direction, series } = effect.params;
    const currentVariation = context.currentVariation;

    if (!currentVariation) {
        return {
            success: false,
            previousValue: null,
            newValue: null,
            message: 'No current variation set for this exercise',
        };
    }

    // Note: In a real implementation, we'd look up the variation series
    // from the protocol's progressions config. For now, return a placeholder.
    const isProgression = direction === 'NEXT';

    return {
        success: true,
        previousValue: currentVariation,
        newValue: `${currentVariation}_${isProgression ? 'next' : 'prev'}`, // Placeholder
        message: `${isProgression ? 'Progressed' : 'Regressed'} from ${currentVariation} in ${series} series`,
        sideEffects: {
            stateChanges: {
                currentVariation: `${currentVariation}_${isProgression ? 'next' : 'prev'}`,
                consecutiveSuccesses: 0,
                consecutiveFailures: 0,
            },
            notify: {
                message: isProgression
                    ? `Great work! You've progressed to a harder ${series} variation!`
                    : `Stepping back to build a stronger foundation.`,
                level: isProgression ? 'SUCCESS' : 'INFO',
            },
        },
    };
}
