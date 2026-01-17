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
import { evaluateProtocol } from '../engine';
import type { PlanDelta, PlanDeltaType, NormalizedExercise, UserLiftStats } from '@/lib/services/paths/types';
import type { Protocol, RuleEvaluationContext, AppliedEffect, LiftType, MovementPattern } from '../types';

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

        if (!oldStat) {
            continue;
        }

        const oldE1rm = oldStat.e1rmKg ?? 0;
        const newE1rm = newStat.e1rmKg ?? 0;

        if (newE1rm > oldE1rm * 1.05) {
            deltas.push({
                type: 'increase_weight',
                exerciseKey: key,
                reason: `E1RM improved from ${oldE1rm.toFixed(1)} to ${newE1rm.toFixed(1)}`,
                suggestedValue: Math.ceil((newStat.trainingMaxKg ?? 0) / 2.5) * 2.5,
            });
        } else if (newE1rm < oldE1rm * 0.9) {
            deltas.push({
                type: 'decrease_weight',
                exerciseKey: key,
                reason: `E1RM dropped from ${oldE1rm.toFixed(1)} to ${newE1rm.toFixed(1)}`,
                suggestedValue: Math.floor((newStat.trainingMaxKg ?? 0) * 0.9 / 2.5) * 2.5,
            });
        }
    }

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
    const reason = effect.message ?? effect.description ?? `Effect: ${effect.effectType}`;
    const newValue = typeof effect.newValue === 'number' ? effect.newValue : undefined;
    const prevValue = typeof effect.previousValue === 'number' ? effect.previousValue : undefined;

    switch (effect.effectType) {
        case 'ADD_WEIGHT':
            return {
                type: 'increase_weight',
                exerciseKey,
                reason,
                suggestedValue: newValue,
            };

        case 'MULTIPLY_WEIGHT':
            if (newValue !== undefined && prevValue !== undefined && newValue < prevValue) {
                return {
                    type: 'decrease_weight',
                    exerciseKey,
                    reason,
                    suggestedValue: newValue,
                };
            }
            return {
                type: 'increase_weight',
                exerciseKey,
                reason,
                suggestedValue: newValue,
            };

        case 'HOLD':
            return {
                type: 'none',
                exerciseKey,
                reason,
            };

        case 'ADD_SETS':
            return {
                type: 'add_set',
                exerciseKey,
                reason,
                suggestedValue: newValue,
            };

        case 'TRIGGER_DELOAD':
            return {
                type: 'rest_day',
                exerciseKey,
                reason,
            };

        default:
            return {
                type: 'none',
                exerciseKey,
                reason,
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

    const historicalSessions = bridgeContext.sessionHistory?.filter(
        s => s.exerciseKey === exerciseKey
    ) ?? [];

    let consecutiveFailures = 0;
    let consecutiveSuccesses = 0;
    const lastWeight = newStat?.trainingMaxKg ?? 0;

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

    // Convert null to undefined for compatibility
    const previousE1rm = oldStat?.e1rmKg ?? undefined;
    const currentE1rm = newStat?.e1rmKg ?? undefined;
    const ewmaE1rm = newStat?.ewmaE1rmKg ?? undefined;

    // Filter out undefined reps
    const reps = (exercise?.sets?.map(s => s.reps) ?? []).filter((r): r is number => r !== undefined);

    return {
        exerciseKey,
        exerciseName: exercise?.exerciseName ?? exerciseKey,
        liftType: determineLiftType(exerciseKey),
        movementPattern: determineMovementPattern(exerciseKey),

        currentWeight: newStat?.trainingMaxKg ?? 0,
        currentReps: reps,
        setsCompleted: exercise?.sets?.length ?? 0,
        targetSets: 5,
        targetReps: 5,
        rpe: exercise?.sets?.[exercise.sets.length - 1]?.rpe ?? undefined,

        sessionsAtCurrentWeight: consecutiveFailures + consecutiveSuccesses,
        consecutiveSuccesses,
        consecutiveFailures,
        previousE1rmKg: previousE1rm,
        currentE1rmKg: currentE1rm,
        ewmaE1rmKg: ewmaE1rm,

        protocolDefaults: protocol.defaults,
        defaults: protocol.defaults,

        currentWeek: 1,
        currentCycle: 1,
        currentStage: undefined,
        currentTier: 'T1',

        userId: bridgeContext.userId,
        programId: bridgeContext.programId,
        workoutId: bridgeContext.workoutId,
    };
}

/**
 * Determine lift type from exercise key
 */
function determineLiftType(exerciseKey: string): LiftType {
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
function determineMovementPattern(exerciseKey: string): MovementPattern | undefined {
    const key = exerciseKey.toLowerCase();

    if (key.includes('squat')) return 'SQUAT';
    if (key.includes('deadlift')) return 'HIP_HINGE';
    if (key.includes('bench') || (key.includes('press') && !key.includes('leg'))) return 'HORIZONTAL_PUSH';
    if (key.includes('row')) return 'HORIZONTAL_PULL';
    if (key.includes('pullup') || key.includes('pull-up') || key.includes('chinup')) return 'VERTICAL_PULL';
    if (key.includes('overhead') || key.includes('ohp') || key.includes('military')) return 'VERTICAL_PUSH';

    return undefined;
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
        const context = buildContextFromBridge(bridgeContext, protocol, key);
        const result = evaluateProtocol(protocol, context);

        allAppliedEffects.push(...result.appliedEffects);

        for (const effect of result.appliedEffects) {
            planDeltas.push(effectToPlanDelta(effect, key));
        }

        if (result.appliedEffects.length === 0 && result.recommendation) {
            planDeltas.push({
                type: mapRecommendationAction(result.recommendation.action),
                exerciseKey: key,
                reason: result.recommendation.message,
                suggestedValue: result.recommendation.newWeight,
            });
        }
    }

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
 */
export async function generatePlanDeltasWithProtocol(
    bridgeContext: BridgeContext
): Promise<BridgeResult> {
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

    const protocol = protocolRegistry.getForProgram(bridgeContext.programId);

    if (!protocol) {
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
