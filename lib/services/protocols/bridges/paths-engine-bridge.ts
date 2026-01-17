/**
 * Paths Engine Bridge
 *
 * Integrates the protocol engine with the paths system to inject
 * protocol-aware metadata into path nodes.
 *
 * @module protocols/bridges/paths-engine-bridge
 */

import { isFeatureEnabled } from '@/lib/config/feature-flags';
import { protocolRegistry } from '../registry';
import { getProgressionRecommendation } from '../engine';
import type { Protocol, RuleEvaluationContext, ProgressionRecommendation, LiftType, Phase, Stage } from '../types';

// ============================================
// TYPES
// ============================================

export interface PathNodeProtocolMetadata {
    /** Whether protocol engine is active for this node */
    protocolActive: boolean;

    /** Protocol ID if active */
    protocolId?: string;

    /** Evidence grade (A/B/C/D) */
    evidenceGrade?: string;

    /** Current stage (for tiered programs like GZCLP) */
    currentStage?: string;

    /** Recommended progression action */
    progressionRecommendation?: ProgressionRecommendation;

    /** Rep scheme details */
    repScheme?: {
        sets: number;
        reps: number | 'AMRAP';
        percentage?: number;
    };

    /** Increment configuration */
    increment?: {
        type: string;
        upperBody: number;
        lowerBody: number;
    };
}

export interface EnrichedPathNode {
    nodeId: string;
    exerciseKey: string;
    protocol?: PathNodeProtocolMetadata;
}

export interface ProtocolDisplayInfo {
    name: string;
    description: string;
    evidenceBadge: string;
    progressionPattern: string;
    expectedWeight?: number;
    nextWeight?: number;
    failureAction?: string;
}

/** Partial context for bridge functions */
interface BridgeContext {
    exerciseKey?: string;
    exerciseName?: string;
    liftType?: LiftType;
    currentWeight?: number;
    currentReps?: number[];
    rpe?: number;
    setsCompleted?: number;
    targetSets?: number;
    targetReps?: number;
    sessionsAtCurrentWeight?: number;
    consecutiveSuccesses?: number;
    consecutiveFailures?: number;
    previousE1rmKg?: number;
    currentE1rmKg?: number;
    ewmaE1rmKg?: number;
    currentWeek?: number;
    currentCycle?: number;
    currentStage?: string;
    currentTier?: 'T1' | 'T2' | 'T3';
    userId?: string;
    programId?: string;
    workoutId?: string;
}

// ============================================
// PROTOCOL METADATA INJECTION
// ============================================

/**
 * Enrich a path node with protocol metadata
 */
export function enrichPathNodeWithProtocol(
    _nodeId: string,
    exerciseKey: string,
    programId: string,
    context?: BridgeContext
): PathNodeProtocolMetadata {
    if (!isFeatureEnabled('protocol_engine')) {
        return { protocolActive: false };
    }

    const protocol = protocolRegistry.getForProgram(programId);
    if (!protocol) {
        return { protocolActive: false };
    }

    const metadata: PathNodeProtocolMetadata = {
        protocolActive: true,
        protocolId: protocol.id,
        evidenceGrade: protocol.evidence?.grade,
        increment: {
            type: protocol.defaults.increment.type,
            upperBody: protocol.defaults.increment.upperBody,
            lowerBody: protocol.defaults.increment.lowerBody,
        },
    };

    // Add stage info for tiered programs (GZCLP)
    if (protocol.stages && protocol.stages.length > 0) {
        metadata.currentStage = context?.currentStage ?? protocol.stages[0].id;
    }

    // Add periodization info for cycling programs (5/3/1)
    if (protocol.periodization?.type === 'PERCENTAGE_CYCLE' && protocol.periodization.phases) {
        const currentWeek = context?.currentWeek ?? 1;
        const phase = protocol.periodization.phases.find((p: Phase) => p.week === currentWeek);
        if (phase?.scheme) {
            const firstRep = phase.scheme.reps[0];
            metadata.repScheme = {
                sets: phase.scheme.sets,
                reps: typeof firstRep === 'string' && firstRep.includes('+') ? 'AMRAP' : Number(firstRep),
                percentage: phase.scheme.percentages?.[0],
            };
        }
    }

    // Get progression recommendation if context is provided
    if (context?.exerciseKey) {
        try {
            const fullContext = buildContextForNode(context, protocol);
            const recommendation = getProgressionRecommendation(protocol, fullContext);
            metadata.progressionRecommendation = recommendation;
        } catch (error) {
            console.warn('[PathsBridge] Failed to get recommendation:', error);
        }
    }

    return metadata;
}

/**
 * Build full context for a path node
 */
function buildContextForNode(
    partial: BridgeContext,
    protocol: Protocol
): RuleEvaluationContext {
    return {
        exerciseKey: partial.exerciseKey ?? '',
        exerciseName: partial.exerciseName ?? partial.exerciseKey ?? '',
        liftType: partial.liftType ?? 'UPPER',
        movementPattern: undefined,

        currentWeight: partial.currentWeight ?? 0,
        currentReps: partial.currentReps ?? [],
        setsCompleted: partial.setsCompleted ?? 0,
        targetSets: partial.targetSets ?? 0,
        targetReps: partial.targetReps ?? 0,
        rpe: partial.rpe,

        sessionsAtCurrentWeight: partial.sessionsAtCurrentWeight ?? 0,
        consecutiveSuccesses: partial.consecutiveSuccesses ?? 0,
        consecutiveFailures: partial.consecutiveFailures ?? 0,
        previousE1rmKg: partial.previousE1rmKg,
        currentE1rmKg: partial.currentE1rmKg,
        ewmaE1rmKg: partial.ewmaE1rmKg,

        protocolDefaults: protocol.defaults,
        defaults: protocol.defaults,

        currentWeek: partial.currentWeek ?? 1,
        currentCycle: partial.currentCycle ?? 1,
        currentStage: partial.currentStage,
        currentTier: partial.currentTier ?? 'T1',

        userId: partial.userId ?? '',
        programId: partial.programId ?? '',
        workoutId: partial.workoutId ?? '',
    };
}

// ============================================
// DISPLAY INFO GENERATION
// ============================================

/**
 * Get human-readable protocol info for UI display
 */
export function getProtocolDisplayInfo(
    programId: string,
    exerciseKey: string,
    currentWeightKg: number,
    _context?: BridgeContext
): ProtocolDisplayInfo | null {
    if (!isFeatureEnabled('protocol_engine')) {
        return null;
    }

    const protocol = protocolRegistry.getForProgram(programId);
    if (!protocol) {
        return null;
    }

    const liftType = determineLiftType(exerciseKey);
    const increment = liftType === 'LOWER'
        ? protocol.defaults.increment.lowerBody
        : protocol.defaults.increment.upperBody;

    const nextWeight = currentWeightKg + increment;

    let failureAction = 'Repeat same weight';
    if (protocol.defaults.deloadTrigger > 0) {
        failureAction = `After ${protocol.defaults.deloadTrigger} failures: ${Math.round((1 - protocol.defaults.deloadFactor) * 100)}% deload`;
    }

    let progressionPattern = 'Linear Progression';
    if (protocol.stages && protocol.stages.length > 0) {
        progressionPattern = 'Tiered Progression (Stage System)';
    } else if (protocol.periodization?.type === 'PERCENTAGE_CYCLE') {
        progressionPattern = 'Percentage-Based Cycling';
    }

    return {
        name: protocol.name,
        description: protocol.description.split('.')[0] + '.',
        evidenceBadge: `Grade ${protocol.evidence?.grade ?? '?'}`,
        progressionPattern,
        expectedWeight: currentWeightKg,
        nextWeight,
        failureAction,
    };
}

function determineLiftType(exerciseKey: string): 'UPPER' | 'LOWER' {
    const lowerPatterns = ['squat', 'deadlift', 'leg', 'hamstring', 'calf', 'glute', 'lunge'];
    const key = exerciseKey.toLowerCase();

    for (const pattern of lowerPatterns) {
        if (key.includes(pattern)) return 'LOWER';
    }

    return 'UPPER';
}

// ============================================
// WEIGHT CALCULATION
// ============================================

/**
 * Calculate target weight for a path node exercise
 */
export function calculateTargetWeight(
    programId: string,
    _exerciseKey: string,
    baseWeight: number,
    context?: BridgeContext
): { weight: number; percentage?: number; source: 'protocol' | 'base' } {
    if (!isFeatureEnabled('protocol_engine')) {
        return { weight: baseWeight, source: 'base' };
    }

    const protocol = protocolRegistry.getForProgram(programId);
    if (!protocol) {
        return { weight: baseWeight, source: 'base' };
    }

    // For percentage-based protocols (5/3/1)
    if (protocol.periodization?.type === 'PERCENTAGE_CYCLE' && context?.currentWeek && protocol.periodization.phases) {
        const phase = protocol.periodization.phases.find((p: Phase) => p.week === context.currentWeek);
        if (phase?.scheme?.percentages) {
            const maxPercentage = Math.max(...phase.scheme.percentages);
            const weight = Math.round((baseWeight * maxPercentage / 100) / 2.5) * 2.5;
            return {
                weight,
                percentage: maxPercentage,
                source: 'protocol',
            };
        }
    }

    // For stage-based protocols (GZCLP)
    if (protocol.stages && protocol.stages.length > 0) {
        return {
            weight: baseWeight,
            source: 'protocol',
        };
    }

    return { weight: baseWeight, source: 'base' };
}

// ============================================
// SCHEME CALCULATION
// ============================================

/**
 * Get rep scheme for a path node exercise
 */
export function getRepScheme(
    programId: string,
    _exerciseKey: string,
    context?: BridgeContext
): { sets: number; reps: number | 'AMRAP'; amrapLastSet: boolean } | null {
    if (!isFeatureEnabled('protocol_engine')) {
        return null;
    }

    const protocol = protocolRegistry.getForProgram(programId);
    if (!protocol) {
        return null;
    }

    // For percentage-based protocols (5/3/1)
    if (protocol.periodization?.type === 'PERCENTAGE_CYCLE' && context?.currentWeek && protocol.periodization.phases) {
        const phase = protocol.periodization.phases.find((p: Phase) => p.week === context.currentWeek);
        if (phase?.scheme) {
            const reps = phase.scheme.reps;
            const lastRep = reps[reps.length - 1];
            const isAmrap = typeof lastRep === 'string' && lastRep.includes('+');

            return {
                sets: phase.scheme.sets,
                reps: isAmrap ? 'AMRAP' : Number(reps[0]),
                amrapLastSet: isAmrap,
            };
        }
    }

    // For stage-based protocols (GZCLP)
    if (protocol.stages && context?.currentTier && context?.currentStage) {
        const stage = protocol.stages.find((s: Stage) => s.id === context.currentStage);
        if (stage) {
            const tierScheme = context.currentTier === 'T1' ? stage.t1
                            : context.currentTier === 'T2' ? stage.t2
                            : stage.t3;
            if (tierScheme) {
                return {
                    sets: tierScheme.sets,
                    reps: tierScheme.reps,
                    amrapLastSet: false,
                };
            }
        }
    }

    return null;
}
