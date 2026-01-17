/**
 * Weight Suggestion Engine
 *
 * Ported from rn-progression-coach/src/domain/progression
 * Provides intelligent weight suggestions based on user history and progression profiles.
 *
 * KEY DESIGN PRINCIPLES:
 * 1. EWMA e1rm is ALWAYS preferred over simple Epley estimates
 * 2. All calculations are in kg internally, converted to user's preferred unit at output
 * 3. Error handling wraps all operations - returns null on failure (zero-impact guarantee)
 */

import {
    ExerciseKind,
    NormalizedSet,
    ProgressionProfile,
    UserLiftStats,
    WeightSuggestionContext,
    WeightSuggestionResult,
} from './types';

import {
    STANDARD_INCREMENTS,
    WeightUnit,
    calculateE1RM,
    clamp,
    weight as createWeight,
    suggestWorkingWeight,
    toWeightLbs
} from '@/lib/utils/weight';

// ============================================
// CONSTANTS
// ============================================

/** Default conservative weight when no history available (in kg) */
const DEFAULT_WEIGHT_KG = 20;

/** Standard increment for upper body (kg) */
const UPPER_BODY_INCREMENT_KG = 2.5;

/** Standard increment for lower body (kg) */
const LOWER_BODY_INCREMENT_KG = 2.5;

/** RPE adjustment factor: each RIR ~ 3% reduction */
const RIR_ADJUSTMENT_FACTOR = 0.03;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Determines if an exercise is a lower body movement.
 * Used for selecting appropriate increments.
 */
export function isLowerBody(exerciseName: string): boolean {
    const n = exerciseName.toLowerCase();
    return (
        n.includes('squat') ||
        n.includes('deadlift') ||
        n.includes('leg') ||
        n.includes('lunge') ||
        n.includes('hip') ||
        n.includes('glute') ||
        n.includes('calf')
    );
}

/**
 * Picks the appropriate increment based on exercise type.
 */
export function pickIncrement(
    exerciseName: string,
    unit: WeightUnit,
    customIncrement?: number
): number {
    if (customIncrement && customIncrement > 0) return customIncrement;

    // Use standard increments for the unit system
    return STANDARD_INCREMENTS[unit];
}

/**
 * Adjusts estimated 1RM for target RPE (Reps In Reserve consideration).
 * RPE 10 = 0 RIR, RPE 9 = 1 RIR, etc.
 * Each RIR reduces usable % by ~3%.
 */
export function adjustForRpe(estimated1rm: number, rpe: number): number {
    const rir = clamp(10 - rpe, 0, 5);
    const factor = 1 - rir * RIR_ADJUSTMENT_FACTOR;
    return estimated1rm * factor;
}

/**
 * Converts kg to user's preferred unit.
 */
function toPreferredUnit(valueKg: number, unit: WeightUnit): number {
    if (unit === 'kg') return valueKg;
    return toWeightLbs(createWeight(valueKg, 'kg'));
}

/**
 * Gets the rep percentage factor for E1RM calculation.
 * Maps target reps to approximate percentage of 1RM.
 */
function getRepPercentage(targetReps: number): number {
    if (targetReps <= 1) return 1.0;
    if (targetReps <= 3) return 0.9;
    if (targetReps <= 5) return 0.85;
    if (targetReps <= 8) return 0.75;
    if (targetReps <= 10) return 0.7;
    if (targetReps <= 12) return 0.65;
    return 0.6;
}

// ============================================
// MAIN SUGGESTION FUNCTION
// ============================================

/**
 * Suggests a weight for an exercise based on user history and progression profile.
 *
 * EWMA Preference (as mandated by Prometheus Council):
 * - Always uses ewmaE1rmKg when available
 * - Falls back to e1rmKg if EWMA not available
 * - Uses last session weight as tertiary fallback
 * - Returns conservative default if no history
 *
 * @param context - The exercise context including history and preferences
 * @returns Weight suggestion with confidence and rationale, or null on error
 */
export function suggestLoad(
    context: WeightSuggestionContext
): WeightSuggestionResult | null {
    try {
        const {
            exerciseKind,
            ewmaE1rmKg,
            e1rmKg,
            trainingMaxKg,
            targetReps,
            targetRpe = 8,
            progressionProfile,
            preferredUnit,
            lastSessionWeightKg,
        } = context;

        // Non-weighted exercise types
        if (exerciseKind === 'mobility') {
            return {
                suggestedWeight: 0,
                unit: preferredUnit,
                confidence: 1.0,
                reason: 'Mobility: focus on quality movement and range of motion.',
                source: 'default',
            };
        }

        if (exerciseKind === 'conditioning') {
            return {
                suggestedWeight: 0,
                unit: preferredUnit,
                confidence: 1.0,
                reason: 'Conditioning: track completion; progress time/distance slowly.',
                source: 'default',
            };
        }

        if (exerciseKind === 'bodyweight') {
            return {
                suggestedWeight: 0,
                unit: preferredUnit,
                confidence: 0.8,
                reason: 'Bodyweight: progress by difficulty level when sets feel easy.',
                source: 'default',
            };
        }

        // ─────────────────────────────────────────────
        // WEIGHTED EXERCISES (strength/hypertrophy)
        // ─────────────────────────────────────────────

        let baseWeightKg: number;
        let source: WeightSuggestionResult['source'];
        let confidence: number;
        let reason: string;

        // Priority 1: EWMA E1RM (most reliable)
        if (ewmaE1rmKg && ewmaE1rmKg > 0) {
            const repPercent = getRepPercentage(targetReps);
            baseWeightKg = ewmaE1rmKg * repPercent;
            baseWeightKg = adjustForRpe(baseWeightKg, targetRpe);
            source = 'ewma_e1rm';
            confidence = 0.9;
            reason = `Based on your EWMA trend (${Math.round(toPreferredUnit(ewmaE1rmKg, preferredUnit))} ${preferredUnit} E1RM).`;
        }
        // Priority 2: Simple E1RM
        else if (e1rmKg && e1rmKg > 0) {
            const repPercent = getRepPercentage(targetReps);
            baseWeightKg = e1rmKg * repPercent;
            baseWeightKg = adjustForRpe(baseWeightKg, targetRpe);
            source = 'epley_e1rm';
            confidence = 0.75;
            reason = `Estimated from recent performance (${Math.round(toPreferredUnit(e1rmKg, preferredUnit))} ${preferredUnit} E1RM).`;
        }
        // Priority 3: Training Max (if set)
        else if (trainingMaxKg && trainingMaxKg > 0) {
            const repPercent = getRepPercentage(targetReps);
            baseWeightKg = trainingMaxKg * repPercent;
            source = 'training_max';
            confidence = 0.7;
            reason = `Based on your training max (${Math.round(toPreferredUnit(trainingMaxKg, preferredUnit))} ${preferredUnit}).`;
        }
        // Priority 4: Last session weight
        else if (lastSessionWeightKg && lastSessionWeightKg > 0) {
            baseWeightKg = lastSessionWeightKg;
            source = 'last_session';
            confidence = 0.6;
            reason = 'Using your last session weight.';
        }
        // Priority 5: Conservative default
        else {
            baseWeightKg = DEFAULT_WEIGHT_KG;
            source = 'default';
            confidence = 0.3;
            reason = 'No history available. Start light and adjust as needed.';
        }

        // Apply progression profile context
        reason += getProgressionProfileRationale(progressionProfile);

        // Convert to user's preferred unit and round
        const suggestedWeight = suggestWorkingWeight(
            toPreferredUnit(baseWeightKg, preferredUnit),
            preferredUnit
        );

        return {
            suggestedWeight,
            unit: preferredUnit,
            confidence,
            reason,
            source,
        };
    } catch (error) {
        // Zero-impact guarantee: never crash, just return null
        console.warn('[WeightSuggestion] Error in suggestLoad:', error);
        return null;
    }
}

/**
 * Gets additional rationale text based on progression profile.
 */
function getProgressionProfileRationale(profile: ProgressionProfile): string {
    switch (profile) {
        case 'LINEAR_LP':
            return ' Linear progression: add weight each session if you hit targets.';
        case 'DOUBLE_PROGRESSION':
            return ' Double progression: add reps first, then increase weight.';
        case 'PERCENT_TM':
            return ' Percent TM: follow prescribed percentages.';
        case 'BODYWEIGHT_STEP':
            return ' Progress to harder variations when ready.';
        case 'CONDITIONING_PROGRESS':
            return ' Progress time or distance gradually.';
        case 'MOBILITY_MAINTAIN':
            return ' Maintain consistency and range of motion.';
        default:
            return '';
    }
}

// ============================================
// PROGRESSION UPDATE (Post-Workout)
// ============================================

export interface ProgressionUpdateInput {
    exerciseKey: string;
    exerciseName: string;
    exerciseKind: ExerciseKind;
    progressionProfile: ProgressionProfile;
    completedSets: NormalizedSet[];
    previousStats: UserLiftStats | null;
    preferredUnit: WeightUnit;
}

export interface ProgressionUpdateResult {
    /** Updated lift stats to persist */
    newE1rmKg: number | null;
    /** Suggested weight for next session (in user's unit) */
    nextSuggestedWeight: number | null;
    /** Human-readable note about the progression */
    note: string;
}

/**
 * Analyzes completed sets and determines progression for next session.
 *
 * @param input - Completed workout data
 * @returns Progression update with new stats and next session suggestion
 */
export function applyProgression(
    input: ProgressionUpdateInput
): ProgressionUpdateResult | null {
    try {
        const {
            exerciseKind,
            progressionProfile,
            completedSets,
            previousStats,
            preferredUnit,
        } = input;

        // Non-weighted types: just acknowledge
        if (exerciseKind === 'mobility') {
            return { newE1rmKg: null, nextSuggestedWeight: null, note: 'Mobility logged.' };
        }
        if (exerciseKind === 'conditioning') {
            return { newE1rmKg: null, nextSuggestedWeight: null, note: 'Conditioning logged.' };
        }
        if (exerciseKind === 'bodyweight') {
            return { newE1rmKg: null, nextSuggestedWeight: null, note: 'Bodyweight exercise logged.' };
        }

        // Summarize the completed sets
        const summary = summarizeSets(completedSets);

        // Calculate best E1RM from this session
        let newE1rmKg: number | null = null;
        if (summary.bestE1rmKg && summary.bestE1rmKg > 0) {
            newE1rmKg = summary.bestE1rmKg;
        }

        // Determine next suggested weight based on progression profile
        const lastWeightKg = summary.lastWeightKg ?? previousStats?.trainingMaxKg ?? null;
        const increment = STANDARD_INCREMENTS[preferredUnit];
        const incrementKg = preferredUnit === 'kg' ? increment : increment * 0.453592;

        let nextWeightKg: number | null = lastWeightKg;
        let note = '';

        const hitAll = summary.completedCount === summary.totalCount;
        const avgRpe = summary.avgRpe ?? 8;

        if (progressionProfile === 'LINEAR_LP') {
            if (hitAll && avgRpe <= 9) {
                nextWeightKg = (lastWeightKg ?? 0) + incrementKg;
                note = `Linear LP: hit targets (RPE ${avgRpe.toFixed(1)}). +${increment} ${preferredUnit} next time.`;
            } else if (!hitAll) {
                nextWeightKg = Math.max(0, (lastWeightKg ?? 0) - 2 * incrementKg);
                note = `Linear LP: missed targets. Deload -${2 * increment} ${preferredUnit}.`;
            } else {
                note = `Linear LP: keep weight (RPE ${avgRpe.toFixed(1)}).`;
            }
        } else if (progressionProfile === 'DOUBLE_PROGRESSION') {
            if (hitAll && avgRpe <= 8) {
                nextWeightKg = (lastWeightKg ?? 0) + incrementKg;
                note = `Double Progression: easy completion (RPE ${avgRpe.toFixed(1)}). +${increment} ${preferredUnit} next time.`;
            } else {
                note = `Double Progression: aim for more reps at same weight (RPE ${avgRpe.toFixed(1)}).`;
            }
        } else {
            // Default progression
            if (hitAll && avgRpe <= 8.5) {
                nextWeightKg = (lastWeightKg ?? 0) + incrementKg;
                note = `Progress: +${increment} ${preferredUnit} next time.`;
            } else {
                note = 'Keep current weight for next session.';
            }
        }

        // Convert to user's unit
        const nextSuggestedWeight = nextWeightKg
            ? suggestWorkingWeight(toPreferredUnit(nextWeightKg, preferredUnit), preferredUnit)
            : null;

        return {
            newE1rmKg,
            nextSuggestedWeight,
            note,
        };
    } catch (error) {
        console.warn('[WeightSuggestion] Error in applyProgression:', error);
        return null;
    }
}

/**
 * Summarizes completed sets for progression analysis.
 */
function summarizeSets(sets: NormalizedSet[]): {
    completedCount: number;
    totalCount: number;
    avgRpe?: number;
    bestE1rmKg?: number;
    lastWeightKg?: number;
} {
    let completedCount = 0;
    let rpeSum = 0;
    let rpeCount = 0;
    let bestE1rmKg = 0;
    let lastWeightKg: number | undefined;

    for (const set of sets) {
        if (set.isCompleted) completedCount++;

        if (typeof set.rpe === 'number') {
            rpeSum += set.rpe;
            rpeCount++;
        }

        if (typeof set.weight === 'number') {
            lastWeightKg = set.weight;

            if (typeof set.reps === 'number' && set.reps > 0) {
                const e1rm = calculateE1RM(set.weight, set.reps);
                bestE1rmKg = Math.max(bestE1rmKg, e1rm);
            }
        }
    }

    return {
        completedCount,
        totalCount: sets.length,
        avgRpe: rpeCount > 0 ? rpeSum / rpeCount : undefined,
        bestE1rmKg: bestE1rmKg > 0 ? bestE1rmKg : undefined,
        lastWeightKg,
    };
}
