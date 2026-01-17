/**
 * Notify Effect Executor
 *
 * Sends a notification to the user.
 * Used for recommendations, warnings, and achievements.
 *
 * @module protocols/effects/notify
 */

import type {
    NotifyEffect,
    RuleEvaluationContext,
} from '../types';
import type { EffectResult } from './index';

/**
 * Execute NOTIFY effect
 *
 * @example
 * // Suggest adding negatives for bodyweight
 * {
 *   type: 'NOTIFY',
 *   params: {
 *     message: 'Consider adding negatives or assisted reps',
 *     level: 'INFO',
 *     actionable: true
 *   }
 * }
 */
export function executeNotify(
    effect: NotifyEffect,
    context: RuleEvaluationContext
): EffectResult {
    const { message, level = 'INFO', actionable = false } = effect.params;

    // Interpolate variables in message
    const interpolatedMessage = interpolateMessage(message, context);

    return {
        success: true,
        previousValue: null,
        newValue: null,
        message: `Notification: ${interpolatedMessage}`,
        sideEffects: {
            notify: {
                message: interpolatedMessage,
                level,
            },
        },
    };
}

/**
 * Interpolate ${variable} placeholders in message
 */
function interpolateMessage(template: string, context: RuleEvaluationContext): string {
    return template
        .replace(/\$\{exercise\}/g, context.exerciseName)
        .replace(/\$\{exerciseKey\}/g, context.exerciseKey)
        .replace(/\$\{weight\}/g, String(context.currentWeight))
        .replace(/\$\{reps\}/g, JSON.stringify(context.currentReps))
        .replace(/\$\{consecutiveFailures\}/g, String(context.consecutiveFailures))
        .replace(/\$\{consecutiveSuccesses\}/g, String(context.consecutiveSuccesses))
        .replace(/\$\{currentVariation\}/g, context.currentVariation ?? 'N/A')
        .replace(/\$\{currentStage\}/g, context.currentStage ?? 'N/A');
}
