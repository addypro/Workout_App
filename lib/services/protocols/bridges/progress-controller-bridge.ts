/**
 * Progress Controller Bridge
 *
 * Integrates the protocol engine with the existing progress-controller.
 * Falls back to legacy behavior when protocol engine is disabled or
 * no protocol is configured.
 *
 * @module protocols/bridges/progress-controller-bridge
 */

import { isFeatureEnabled } from '@/lib/config/feature-flags';
import { protocolRegistry } from '../registry';
import { evaluateProtocol, buildEvaluationContext } from '../engine';
import type { PlanDelta, PlanDeltaType, NormalizedExercise, UserLiftStats } from '@/lib/services/paths/types';
import type { Protocol, RuleEvaluationContext, ProtocolEvaluationResult, AppliedEffect } from '../types';

// ============================================
// TYPES
// ============================================

export interface BridgeContext {
    userId: string;
    programId: string;
    workoutId: string;
    exercises: NormalizedExercise[];
    oldStats: Map<string, UserLiftStats>;
    newStats: Map<string, UserLiftStats>;
    sessionHistory?: SessionHistoryEntry[];
}

export interface SessionHistoryEntry {
    workoutId: string;
    date: string;
    exerciseKey: string;
    sets: number;
    reps: number[];
    weight: number;
    rpe?: number;
    success: boolean;
}

export interface BridgeResult {
    planDeltas: PlanDelta[];
    protocolUsed: boolean;
    protocolId?: string;
    appliedEffects: AppliedEffect[];
}

// ============================================
// LEGACY IMPLEMENTATION (copied from progress-controller)
// ============================================

/**
 * Legacy plan delta generation - 5%/10% threshold based
 */
function legacyGeneratePlanDeltas(
    exercises: NormalizedExercise[],
    oldStats: Map<string, UserLiftStats>,
    newStats: Map<string, UserLiftStats>
): PlanDelta[] {
    const deltas: PlanDelta[] = [];

    for (const exercise of exercises) {
        const key = exercise.exerciseKey;
        const oldStat = oldStats.get(key);
        const newStat = newStats.get(key);

        if (!newStat) continue;

        // No previous data - no recommendation
        if (!oldStat) {
            continue;
        }

        const oldE1rm = oldStat.e1rmKg ?? 0;
        const newE1rm = newStat.e1rmKg ?? 0;

        // Significant improvement (>5%) - suggest weight increase
        if (newE1rm > oldE1rm * 1.05) {
            deltas.push({
                type: 'increase_weight',
                exerciseKey: key,
                reason: `E1RM improved from ${oldE1rm.toFixed(1)} to ${newE1rm.toFixed(1)}`,
                suggestedValue: Math.ceil((newStat.trainingMaxKg ?? 0) / 2.5) * 2.5,
            });
        }
        // Significant regression (>10%) - suggest weight decrease
        else if (newE1rm < oldE1rm * 0.9) {
            deltas.push({
                type: 'decrease_weight',
                exerciseKey: key,
                reason: `E1RM dropped from ${oldE1rm.toFixed(1)} to ${newE1rm.toFixed(1)}`,
                suggestedValue: Math.floor((newStat.trainingMaxKg ?? 0) * 0.9 / 2.5) * 2.5,
            });
        }
    }

    // If no specific recommendations, add a "none" delta
    if (deltas.length === 0) {
        deltas.push({
            type: 'none',
            reason: 'Training on track, no adjustments needed',
        });
    }

    return deltas;
}

// ============================================
// PROTOCOL-BASED IMPLEMENTATION
// ============================================

/**
 * Convert protocol effect to PlanDelta
 */
function effectToPlanDelta(effect: AppliedEffect, exerciseKey?: string): PlanDelta {
    switch (effect.effectType) {
        case 'ADD_WEIGHT':
            return {
                type: 'increase_weight',
                exerciseKey,
                reason: effect.description ?? 'Weight increased per protocol',
                suggestedValue: effect.newValue,
            };

        case 'MULTIPLY_WEIGHT':
            // If factor < 1, it's a decrease (deload)
            if (effect.newValue && effect.oldValue && effect.newValue < effect.oldValue) {
                return {
                    type: 'decrease_weight',
                    exerciseKey,
                    reason: effect.description ?? 'Deload triggered per protocol',
                    suggestedValue: effect.newValue,
                };
            }
            return {
                type: 'increase_weight',
                exerciseKey,
                reason: effect.description ?? 'Weight adjusted per protocol',
                suggestedValue: effect.newValue,
            };

        case 'HOLD':
            return {
                type: 'none',
                exerciseKey,
                reason: effect.description ?? 'Weight maintained per protocol',
            };

        case 'ADD_SETS':
            return {
                type: 'add_set',
                exerciseKey,
                reason: effect.description ?? 'Volume increased per protocol',
                suggestedValue: effect.newValue,
            };

        case 'TRIGGER_DELOAD':
            return {
                type: 'rest_day',
                exerciseKey,
                reason: effect.description ?? 'Deload week triggered',
            };

        default:
            return {
                type: 'none',
                exerciseKey,
                reason: effect.description ?? `Protocol effect: ${effect.effectType}`,
            };
    }
}

/**
 * Build evaluation context from bridge context
 */
function buildContextFromBridge(
    bridgeContext: BridgeContext,
    protocol: Protocol,
    exerciseKey: string
): RuleEvaluationContext {
    const exercise = bridgeContext.exercises.find(e => e.exerciseKey === exerciseKey);
    const newStat = bridgeContext.newStats.get(exerciseKey);
    const oldStat = bridgeContext.oldStats.get(exerciseKey);

    // Get historical sessions for this exercise
    const historicalSessions = bridgeContext.sessionHistory?.filter(
        s => s.exerciseKey === exerciseKey
    ) ?? [];

    // Count consecutive failures at same weight
    let consecutiveFailures = 0;
    let consecutiveSuccesses = 0;
    let lastWeight = newStat?.trainingMaxKg ?? 0;

    for (let i = historicalSessions.length - 1; i >= 0; i--) {
        const session = historicalSessions[i];
        if (Math.abs(session.weight - lastWeight) < 0.1) {
            if (session.success) {
                if (consecutiveFailures === 0) {
                    consecutiveSuccesses++;
                } else {
                    break;
                }
            } else {
                if (consecutiveSuccesses === 0) {
                    consecutiveFailures++;
                } else {
                    break;
                }
            }
        } else {
            break;
        }
    }

    return {
        // Exercise data
        exerciseKey,
        exerciseName: exercise?.exerciseName ?? exerciseKey,
        liftType: determineLiftType(exerciseKey),
        movementPattern: determineMovementPattern(exerciseKey),

        // Current workout
        setsCompleted: exercise?.sets?.length ?? 0,
        repsPerSet: exercise?.sets?.map(s => s.reps) ?? [],
        weightKg: newStat?.trainingMaxKg ?? 0,
        rpe: exercise?.sets?.[exercise.sets.length - 1]?.rpe ?? undefined,

        // Historical context
        sessionsAtCurrentWeight: consecutiveFailures + consecutiveSuccesses,
        consecutiveSuccesses,
        consecutiveFailures,
        previousE1rmKg: oldStat?.e1rmKg,
        currentE1rmKg: newStat?.e1rmKg,
        ewmaE1rmKg: newStat?.ewmaE1rmKg,

        // Protocol defaults
        defaults: protocol.defaults,

        // Periodization state
        currentWeek: 1,
        currentCycle: 1,
        currentStage: undefined,
        currentTier: 'T1',

        // User state
        userId: bridgeContext.userId,
        programId: bridgeContext.programId,
        workoutId: bridgeContext.workoutId,
    };
}

/**
 * Determine lift type from exercise key
 */
function determineLiftType(exerciseKey: string): 'UPPER' | 'LOWER' | 'FULL' {
    const lowerPatterns = ['squat', 'deadlift', 'leg', 'hamstring', 'calf', 'glute', 'lunge'];
    const key = exerciseKey.toLowerCase();

    for (const pattern of lowerPatterns) {
        if (key.includes(pattern)) return 'LOWER';
    }

    return 'UPPER';
}

/**
 * Determine movement pattern from exercise key
 */
function determineMovementPattern(exerciseKey: string): string {
    const key = exerciseKey.toLowerCase();

    if (key.includes('squat')) return 'SQUAT';
    if (key.includes('deadlift')) return 'HINGE';
    if (key.includes('bench') || key.includes('press') && !key.includes('leg')) return 'HORIZONTAL_PUSH';
    if (key.includes('row')) return 'HORIZONTAL_PULL';
    if (key.includes('pullup') || key.includes('pull-up') || key.includes('chinup')) return 'VERTICAL_PULL';
    if (key.includes('overhead') || key.includes('ohp') || key.includes('military')) return 'VERTICAL_PUSH';

    return 'ACCESSORY';
}

/**
 * Protocol-based plan delta generation
 */
function protocolGeneratePlanDeltas(
    bridgeContext: BridgeContext,
    protocol: Protocol
): BridgeResult {
    const planDeltas: PlanDelta[] = [];
    const allAppliedEffects: AppliedEffect[] = [];

    for (const exercise of bridgeContext.exercises) {
        const key = exercise.exerciseKey;

        // Build context for this exercise
        const context = buildContextFromBridge(bridgeContext, protocol, key);

        // Evaluate protocol
        const result = evaluateProtocol(protocol, context);

        // Collect applied effects
        allAppliedEffects.push(...result.appliedEffects);

        // Convert each applied effect to a plan delta
        for (const effect of result.appliedEffects) {
            planDeltas.push(effectToPlanDelta(effect, key));
        }

        // If recommendation exists but no effects, use recommendation
        if (result.appliedEffects.length === 0 && result.recommendation) {
            planDeltas.push({
                type: mapRecommendationAction(result.recommendation.action),
                exerciseKey: key,
                reason: result.recommendation.message,
                suggestedValue: result.recommendation.newWeight,
            });
        }
    }

    // If no deltas generated, add a "none"
    if (planDeltas.length === 0) {
        planDeltas.push({
            type: 'none',
            reason: 'Protocol evaluated, no adjustments needed',
        });
    }

    return {
        planDeltas,
        protocolUsed: true,
        protocolId: protocol.id,
        appliedEffects: allAppliedEffects,
    };
}

/**
 * Map recommendation action to PlanDeltaType
 */
function mapRecommendationAction(action: string): PlanDeltaType {
    switch (action) {
        case 'PROGRESS':
            return 'increase_weight';
        case 'DELOAD':
            return 'decrease_weight';
        case 'HOLD':
            return 'none';
        default:
            return 'none';
    }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Generate plan deltas with protocol engine integration
 *
 * Falls back to legacy behavior when:
 * - Feature flag is disabled
 * - No protocol is configured for the program
 * - Protocol evaluation fails
 */
export async function generatePlanDeltasWithProtocol(
    bridgeContext: BridgeContext
): Promise<BridgeResult> {
    // Check feature flag
    if (!isFeatureEnabled('protocol_engine')) {
        return {
            planDeltas: legacyGeneratePlanDeltas(
                bridgeContext.exercises,
                bridgeContext.oldStats,
                bridgeContext.newStats
            ),
            protocolUsed: false,
            appliedEffects: [],
        };
    }

    // Try to get protocol for this program
    const protocol = protocolRegistry.getForProgram(bridgeContext.programId);

    if (!protocol) {
        // No protocol configured - fall back to legacy
        return {
            planDeltas: legacyGeneratePlanDeltas(
                bridgeContext.exercises,
                bridgeContext.oldStats,
                bridgeContext.newStats
            ),
            protocolUsed: false,
            appliedEffects: [],
        };
    }

    try {
        // Use protocol engine
        return protocolGeneratePlanDeltas(bridgeContext, protocol);
    } catch (error) {
        console.warn('[ProtocolBridge] Protocol evaluation failed, falling back to legacy:', error);
        return {
            planDeltas: legacyGeneratePlanDeltas(
                bridgeContext.exercises,
                bridgeContext.oldStats,
                bridgeContext.newStats
            ),
            protocolUsed: false,
            appliedEffects: [],
        };
    }
}

/**
 * Check if protocol engine is available for a program
 */
export function hasProtocolForProgram(programId: string): boolean {
    if (!isFeatureEnabled('protocol_engine')) {
        return false;
    }
    return protocolRegistry.has(programId);
}

/**
 * Get protocol information for display
 */
export function getProtocolInfo(programId: string): {
    available: boolean;
    protocolId?: string;
    protocolName?: string;
    evidenceGrade?: string;
} | null {
    if (!isFeatureEnabled('protocol_engine')) {
        return null;
    }

    const protocol = protocolRegistry.getForProgram(programId);
    if (!protocol) {
        return { available: false };
    }

    return {
        available: true,
        protocolId: protocol.id,
        protocolName: protocol.name,
        evidenceGrade: protocol.evidence?.grade,
    };
}
