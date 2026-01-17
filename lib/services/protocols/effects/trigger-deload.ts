/**
 * Trigger Deload Effect Executor
 *
 * Initiates a deload week/period.
 *
 * From the codified programs:
 * "Deload after hitting a plateau for two weeks"
 * "A deload week every 6 weeks helps recovery"
 *
 * @module protocols/effects/trigger-deload
 */

import type {
    TriggerDeloadEffect,
    RuleEvaluationContext,
} from '../types';
import type { EffectResult } from './index';

/**
 * Execute TRIGGER_DELOAD effect
 *
 * @example
 * // Standard deload
 * {
 *   type: 'TRIGGER_DELOAD',
 *   params: {
 *     durationWeeks: 1,
 *     intensityReduction: 0.4,
 *     volumeReduction: 0.5,
 *     reason: 'Scheduled deload week'
 *   }
 * }
 */
export function executeTriggerDeload(
    effect: TriggerDeloadEffect,
    context: RuleEvaluationContext
): EffectResult {
    const {
        durationWeeks = 1,
        intensityReduction = 0.4,
        volumeReduction = 0.5,
        reason,
    } = effect.params;

    const currentWeight = context.currentWeight;
    const deloadWeight = currentWeight * (1 - intensityReduction);

    return {
        success: true,
        previousValue: {
            weight: currentWeight,
            inDeload: false,
        },
        newValue: {
            weight: deloadWeight,
            inDeload: true,
            deloadDuration: durationWeeks,
            deloadReason: reason,
        },
        message: `Deload triggered: ${reason}. Duration: ${durationWeeks} week(s), intensity -${Math.round(intensityReduction * 100)}%, volume -${Math.round(volumeReduction * 100)}%`,
        sideEffects: {
            stateChanges: {
                inDeload: true,
                deloadWeeksRemaining: durationWeeks,
                deloadIntensityFactor: 1 - intensityReduction,
                deloadVolumeFactor: 1 - volumeReduction,
                consecutiveFailures: 0,
            },
            notify: {
                message: `Deload week activated: ${reason}`,
                level: 'INFO',
            },
        },
    };
}
