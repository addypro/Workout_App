/**
 * Weight Suggestion Engine Tests
 *
 * Tests for lib/services/paths/weight-suggestion.ts
 */

import {
    adjustForRpe,
    applyProgression,
    isLowerBody,
    suggestLoad,
} from '../../lib/services/paths/weight-suggestion';

import type {
    WeightSuggestionContext
} from '../../lib/services/paths/types';

// ============================================
// isLowerBody Tests
// ============================================

describe('isLowerBody', () => {
    it('should identify squat as lower body', () => {
        expect(isLowerBody('Back Squat')).toBe(true);
        expect(isLowerBody('Goblet Squat')).toBe(true);
        expect(isLowerBody('Front Squat')).toBe(true);
    });

    it('should identify deadlift as lower body', () => {
        expect(isLowerBody('Deadlift')).toBe(true);
        expect(isLowerBody('Romanian Deadlift')).toBe(true);
        expect(isLowerBody('Sumo Deadlift')).toBe(true);
    });

    it('should identify leg exercises as lower body', () => {
        expect(isLowerBody('Leg Press')).toBe(true);
        expect(isLowerBody('Leg Extension')).toBe(true);
        expect(isLowerBody('Leg Curl')).toBe(true);
    });

    it('should identify lunges and hip exercises as lower body', () => {
        expect(isLowerBody('Walking Lunge')).toBe(true);
        expect(isLowerBody('Hip Thrust')).toBe(true);
        expect(isLowerBody('Glute Bridge')).toBe(true);
    });

    it('should NOT identify upper body exercises', () => {
        expect(isLowerBody('Bench Press')).toBe(false);
        expect(isLowerBody('Overhead Press')).toBe(false);
        expect(isLowerBody('Bicep Curl')).toBe(false);
        expect(isLowerBody('Lat Pulldown')).toBe(false);
    });
});

// ============================================
// adjustForRpe Tests
// ============================================

describe('adjustForRpe', () => {
    it('should not adjust for RPE 10 (0 RIR)', () => {
        const result = adjustForRpe(100, 10);
        expect(result).toBe(100);
    });

    it('should reduce by ~3% per RIR', () => {
        // RPE 9 = 1 RIR = 3% reduction
        const result = adjustForRpe(100, 9);
        expect(result).toBeCloseTo(97, 1);
    });

    it('should reduce by ~15% for RPE 5 (5 RIR)', () => {
        const result = adjustForRpe(100, 5);
        expect(result).toBeCloseTo(85, 1);
    });

    it('should clamp RIR at 5 for very low RPE', () => {
        // RPE 3 would be 7 RIR but clamped to 5
        const result = adjustForRpe(100, 3);
        expect(result).toBeCloseTo(85, 1); // Same as RPE 5
    });
});

// ============================================
// suggestLoad Tests
// ============================================

describe('suggestLoad', () => {
    const baseContext: WeightSuggestionContext = {
        exerciseKey: 'bench_press',
        exerciseName: 'Bench Press',
        exerciseKind: 'strength',
        e1rmKg: null,
        ewmaE1rmKg: null,
        trainingMaxKg: null,
        targetReps: 5,
        targetRpe: 8,
        setNumber: 1,
        progressionProfile: 'LINEAR_LP',
        preferredUnit: 'lbs',
    };

    it('should return conservative default with null stats', () => {
        const result = suggestLoad(baseContext);

        expect(result).not.toBeNull();
        expect(result!.source).toBe('default');
        expect(result!.confidence).toBeLessThan(0.5);
        expect(result!.suggestedWeight).toBeGreaterThan(0);
        expect(result!.reason).toContain('No history');
    });

    it('should prefer EWMA e1rm over simple e1rm', () => {
        const context: WeightSuggestionContext = {
            ...baseContext,
            ewmaE1rmKg: 100, // ~220 lbs
            e1rmKg: 90, // Should be ignored
        };

        const result = suggestLoad(context);

        expect(result).not.toBeNull();
        expect(result!.source).toBe('ewma_e1rm');
        expect(result!.confidence).toBeGreaterThan(0.8);
        expect(result!.reason).toContain('EWMA');
    });

    it('should fall back to simple e1rm when EWMA not available', () => {
        const context: WeightSuggestionContext = {
            ...baseContext,
            ewmaE1rmKg: null,
            e1rmKg: 100,
        };

        const result = suggestLoad(context);

        expect(result).not.toBeNull();
        expect(result!.source).toBe('epley_e1rm');
    });

    it('should use last session weight as fallback', () => {
        const context: WeightSuggestionContext = {
            ...baseContext,
            lastSessionWeightKg: 80,
        };

        const result = suggestLoad(context);

        expect(result).not.toBeNull();
        expect(result!.source).toBe('last_session');
        expect(result!.reason).toContain('last session');
    });

    it('should return zero weight for mobility exercises', () => {
        const context: WeightSuggestionContext = {
            ...baseContext,
            exerciseKind: 'mobility',
        };

        const result = suggestLoad(context);

        expect(result).not.toBeNull();
        expect(result!.suggestedWeight).toBe(0);
        expect(result!.reason).toContain('Mobility');
    });

    it('should return zero weight for conditioning exercises', () => {
        const context: WeightSuggestionContext = {
            ...baseContext,
            exerciseKind: 'conditioning',
        };

        const result = suggestLoad(context);

        expect(result).not.toBeNull();
        expect(result!.suggestedWeight).toBe(0);
        expect(result!.reason).toContain('Conditioning');
    });

    it('should include LINEAR_LP rationale in reason', () => {
        const context: WeightSuggestionContext = {
            ...baseContext,
            progressionProfile: 'LINEAR_LP',
            ewmaE1rmKg: 100,
        };

        const result = suggestLoad(context);

        expect(result!.reason).toContain('Linear progression');
    });

    it('should include DOUBLE_PROGRESSION rationale in reason', () => {
        const context: WeightSuggestionContext = {
            ...baseContext,
            progressionProfile: 'DOUBLE_PROGRESSION',
            ewmaE1rmKg: 100,
        };

        const result = suggestLoad(context);

        expect(result!.reason).toContain('Double progression');
    });

    it('should round to standard increments (lbs)', () => {
        const context: WeightSuggestionContext = {
            ...baseContext,
            ewmaE1rmKg: 102.3, // Would give weird decimal
            preferredUnit: 'lbs',
        };

        const result = suggestLoad(context);

        expect(result!.suggestedWeight % 5).toBe(0); // Should be rounded to 5lb increment
    });

    it('should round to standard increments (kg)', () => {
        const context: WeightSuggestionContext = {
            ...baseContext,
            ewmaE1rmKg: 102.3,
            preferredUnit: 'kg',
        };

        const result = suggestLoad(context);

        expect(result!.suggestedWeight % 2.5).toBe(0); // Should be rounded to 2.5kg increment
    });
});

// ============================================
// applyProgression Tests
// ============================================

describe('applyProgression', () => {
    it('should return null gracefully on empty sets', () => {
        const result = applyProgression({
            exerciseKey: 'bench_press',
            exerciseName: 'Bench Press',
            exerciseKind: 'strength',
            progressionProfile: 'LINEAR_LP',
            completedSets: [],
            previousStats: null,
            preferredUnit: 'lbs',
        });

        expect(result).not.toBeNull();
        // With empty sets, should still not crash
    });

    it('should recommend weight increase for LINEAR_LP on success', () => {
        const result = applyProgression({
            exerciseKey: 'bench_press',
            exerciseName: 'Bench Press',
            exerciseKind: 'strength',
            progressionProfile: 'LINEAR_LP',
            completedSets: [
                { weight: 100, reps: 5, isCompleted: true, rpe: 8 },
                { weight: 100, reps: 5, isCompleted: true, rpe: 8 },
                { weight: 100, reps: 5, isCompleted: true, rpe: 8 },
            ],
            previousStats: null,
            preferredUnit: 'lbs',
        });

        expect(result).not.toBeNull();
        expect(result!.note).toContain('hit targets');
        expect(result!.note).toContain('+');
    });

    it('should recommend deload for LINEAR_LP on missed targets', () => {
        const result = applyProgression({
            exerciseKey: 'bench_press',
            exerciseName: 'Bench Press',
            exerciseKind: 'strength',
            progressionProfile: 'LINEAR_LP',
            completedSets: [
                { weight: 100, reps: 5, isCompleted: true, rpe: 8 },
                { weight: 100, reps: 4, isCompleted: false, rpe: 10 }, // Failed
                { weight: 100, reps: 3, isCompleted: false, rpe: 10 }, // Failed
            ],
            previousStats: null,
            preferredUnit: 'lbs',
        });

        expect(result).not.toBeNull();
        expect(result!.note).toContain('missed targets');
        expect(result!.note.toLowerCase()).toContain('deload');
    });

    it('should only increase weight on DOUBLE_PROGRESSION when easy', () => {
        // Easy session (RPE 7)
        const easyResult = applyProgression({
            exerciseKey: 'bench_press',
            exerciseName: 'Bench Press',
            exerciseKind: 'strength',
            progressionProfile: 'DOUBLE_PROGRESSION',
            completedSets: [
                { weight: 100, reps: 8, isCompleted: true, rpe: 7 },
                { weight: 100, reps: 8, isCompleted: true, rpe: 7 },
                { weight: 100, reps: 8, isCompleted: true, rpe: 7 },
            ],
            previousStats: null,
            preferredUnit: 'lbs',
        });

        expect(easyResult!.note).toContain('easy');
        expect(easyResult!.note).toContain('+');

        // Hard session (RPE 9)
        const hardResult = applyProgression({
            exerciseKey: 'bench_press',
            exerciseName: 'Bench Press',
            exerciseKind: 'strength',
            progressionProfile: 'DOUBLE_PROGRESSION',
            completedSets: [
                { weight: 100, reps: 8, isCompleted: true, rpe: 9 },
                { weight: 100, reps: 8, isCompleted: true, rpe: 9 },
                { weight: 100, reps: 8, isCompleted: true, rpe: 9 },
            ],
            previousStats: null,
            preferredUnit: 'lbs',
        });

        expect(hardResult!.note).toContain('more reps');
        expect(hardResult!.note).not.toContain('+5');
    });

    it('should calculate E1RM from completed sets', () => {
        const result = applyProgression({
            exerciseKey: 'squat',
            exerciseName: 'Back Squat',
            exerciseKind: 'strength',
            progressionProfile: 'LINEAR_LP',
            completedSets: [
                { weight: 100, reps: 5, isCompleted: true, rpe: 8 },
            ],
            previousStats: null,
            preferredUnit: 'kg',
        });

        expect(result).not.toBeNull();
        expect(result!.newE1rmKg).not.toBeNull();
        // E1RM for 100kg x 5 = 100 * (1 + 5/30) = 116.67
        expect(result!.newE1rmKg).toBeCloseTo(116.67, 0);
    });

    it('should handle mobility exercises gracefully', () => {
        const result = applyProgression({
            exerciseKey: 'hip_stretch',
            exerciseName: 'Hip Stretch',
            exerciseKind: 'mobility',
            progressionProfile: 'MOBILITY_MAINTAIN',
            completedSets: [{ isCompleted: true }],
            previousStats: null,
            preferredUnit: 'lbs',
        });

        expect(result).not.toBeNull();
        expect(result!.newE1rmKg).toBeNull();
        expect(result!.note).toContain('Mobility');
    });
});
