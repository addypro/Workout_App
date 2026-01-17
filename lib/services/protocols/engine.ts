/**
 * Protocol Engine
 *
 * Core rule evaluation engine that processes workout data
 * and returns progression recommendations based on protocol rules.
 *
 * @module protocols/engine
 */

import type {
    Protocol,
    ProgressionRule,
    Condition,
    Effect,
    RuleEvaluationContext,
    RuleEvaluationResult,
    AppliedEffect,
} from './types';

import {
    evaluateCondition,
    evaluateAllConditions,
    type ConditionResult,
} from './conditions';

import {
    executeEffect,
    type EffectResult,
} from './effects';

// Initialize compound condition evaluator to avoid circular dependency
import { setConditionEvaluator } from './conditions/compound';
setConditionEvaluator(evaluateCondition);

/**
 * Result of evaluating all rules in a protocol
 */
export interface ProtocolEvaluationResult {
    protocolId: string;
    protocolName: string;
    exerciseKey: string;
    timestamp: Date;

    // All rules evaluated
    ruleResults: RuleEvaluationResult[];

    // The winning rule (highest priority that triggered)
    winningRule: RuleEvaluationResult | null;

    // Applied effects (if any)
    appliedEffects: AppliedEffect[];

    // Summary
    recommendation: {
        action: 'PROGRESS' | 'HOLD' | 'DELOAD' | 'CHANGE_VARIATION' | 'NOTIFY' | 'NONE';
        message: string;
        newWeight?: number;
        newVariation?: string;
    };
}

/**
 * Evaluate a single rule against the context
 */
export function evaluateRule(
    rule: ProgressionRule,
    context: RuleEvaluationContext
): RuleEvaluationResult {
    // Check if rule is enabled
    if (!rule.enabled) {
        return {
            ruleId: rule.id,
            triggered: false,
            conditionResults: [],
            confidence: 0,
            reasoning: 'Rule is disabled',
        };
    }

    // Evaluate all conditions (AND logic)
    const { allMet, results } = evaluateAllConditions(rule.trigger.conditions, context);

    const conditionResults = results.map((r, i) => ({
        conditionType: rule.trigger.conditions[i].type,
        met: r.met,
        actualValue: r.actualValue,
        expectedValue: r.expectedValue,
    }));

    if (!allMet) {
        return {
            ruleId: rule.id,
            triggered: false,
            conditionResults,
            confidence: 0,
            reasoning: `Conditions not met: ${results.filter((r) => !r.met).map((_, i) => rule.trigger.conditions[i].type).join(', ')}`,
        };
    }

    // Rule triggered - calculate confidence based on evidence
    const confidence = calculateConfidence(rule.evidence.grade);

    return {
        ruleId: rule.id,
        triggered: true,
        conditionResults,
        suggestedEffect: Array.isArray(rule.effect) ? rule.effect[0] : rule.effect,
        confidence,
        reasoning: `Rule "${rule.name}" triggered with ${confidence * 100}% confidence`,
    };
}

/**
 * Evaluate all rules in a protocol and return the winning rule
 */
export function evaluateProtocol(
    protocol: Protocol,
    context: RuleEvaluationContext
): ProtocolEvaluationResult {
    const timestamp = new Date();

    // Sort rules by priority (highest first)
    const sortedRules = [...protocol.rules].sort((a, b) => b.priority - a.priority);

    // Evaluate all rules
    const ruleResults: RuleEvaluationResult[] = sortedRules.map((rule) =>
        evaluateRule(rule, context)
    );

    // Find the first (highest priority) triggered rule
    const winningRule = ruleResults.find((r) => r.triggered) ?? null;

    // Apply effects if we have a winning rule
    const appliedEffects: AppliedEffect[] = [];
    let recommendation: ProtocolEvaluationResult['recommendation'] = {
        action: 'NONE',
        message: 'No rules triggered. Continue with current weight.',
    };

    if (winningRule && winningRule.suggestedEffect) {
        const effectResult = executeEffect(winningRule.suggestedEffect, context);

        appliedEffects.push({
            ruleId: winningRule.ruleId,
            effectType: winningRule.suggestedEffect.type,
            appliedAt: timestamp,
            previousValue: effectResult.previousValue,
            newValue: effectResult.newValue,
            success: effectResult.success,
            message: effectResult.message,
        });

        recommendation = mapEffectToRecommendation(
            winningRule.suggestedEffect,
            effectResult,
            winningRule
        );
    }

    return {
        protocolId: protocol.id,
        protocolName: protocol.name,
        exerciseKey: context.exerciseKey,
        timestamp,
        ruleResults,
        winningRule,
        appliedEffects,
        recommendation,
    };
}

/**
 * Calculate confidence score from evidence grade
 */
function calculateConfidence(grade: string): number {
    switch (grade) {
        case 'A':
            return 0.95;
        case 'B':
            return 0.80;
        case 'C':
            return 0.65;
        case 'D':
            return 0.50;
        default:
            return 0.50;
    }
}

/**
 * Map effect result to user-facing recommendation
 */
function mapEffectToRecommendation(
    effect: Effect,
    result: EffectResult,
    rule: RuleEvaluationResult
): ProtocolEvaluationResult['recommendation'] {
    switch (effect.type) {
        case 'ADD_WEIGHT':
            return {
                action: 'PROGRESS',
                message: result.message,
                newWeight: result.newValue as number,
            };

        case 'MULTIPLY_WEIGHT':
            return {
                action: 'DELOAD',
                message: result.message,
                newWeight: result.newValue as number,
            };

        case 'HOLD':
            return {
                action: 'HOLD',
                message: result.message,
            };

        case 'CHANGE_VARIATION':
            return {
                action: 'CHANGE_VARIATION',
                message: result.message,
                newVariation: result.newValue as string,
            };

        case 'TRIGGER_DELOAD':
            return {
                action: 'DELOAD',
                message: result.message,
            };

        case 'NOTIFY':
            return {
                action: 'NOTIFY',
                message: result.message,
            };

        default:
            return {
                action: 'NONE',
                message: result.message,
            };
    }
}

/**
 * Build evaluation context from workout data
 */
export function buildEvaluationContext(
    userId: string,
    programId: string,
    exerciseData: {
        exerciseKey: string;
        exerciseName: string;
        liftType: string;
        currentWeight: number;
        currentReps: number[];
        currentRpe?: number[];
        setsCompleted: number;
        targetSets: number;
        targetReps: number;
    },
    historicalData: {
        previousWeight?: number;
        previousReps?: number[];
        consecutiveSuccesses: number;
        consecutiveFailures: number;
        sessionsAtCurrentWeight: number;
        currentStage?: string;
        currentVariation?: string;
    },
    protocolDefaults: Protocol['defaults']
): RuleEvaluationContext {
    return {
        userId,
        programId,
        exerciseKey: exerciseData.exerciseKey,
        exerciseName: exerciseData.exerciseName,
        liftType: exerciseData.liftType as RuleEvaluationContext['liftType'],
        currentWeight: exerciseData.currentWeight,
        currentReps: exerciseData.currentReps,
        currentRpe: exerciseData.currentRpe,
        setsCompleted: exerciseData.setsCompleted,
        targetSets: exerciseData.targetSets,
        targetReps: exerciseData.targetReps,
        previousWeight: historicalData.previousWeight,
        previousReps: historicalData.previousReps,
        consecutiveSuccesses: historicalData.consecutiveSuccesses,
        consecutiveFailures: historicalData.consecutiveFailures,
        sessionsAtCurrentWeight: historicalData.sessionsAtCurrentWeight,
        currentStage: historicalData.currentStage,
        currentVariation: historicalData.currentVariation,
        protocolDefaults,
    };
}

/**
 * Convenience function: evaluate and return just the recommendation
 */
export function getProgressionRecommendation(
    protocol: Protocol,
    context: RuleEvaluationContext
): ProtocolEvaluationResult['recommendation'] {
    const result = evaluateProtocol(protocol, context);
    return result.recommendation;
}
