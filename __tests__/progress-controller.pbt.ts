/**
 * Progress Controller Property-Based Tests
 *
 * Uses fast-check to verify invariants of the progression engine.
 * Pattern follows existing pr-detector.pbt.ts.
 */

import fc from 'fast-check';

// Import pure functions from progress controller
import {
    calculateE1RM,
    calculateEWMA,
    calculateXP,
    processWorkoutCompleted,
    updateExerciseStats
} from '../lib/services/paths/progress-controller';
import {
    normalizeExerciseKey,
    type NormalizedExercise,
    type NormalizedSet,
    type UserLiftStats,
    type WorkoutCompletedEvent
} from '../lib/services/paths/types';

// ============================================
// ARBITRARIES
// ============================================

const setArbitrary: fc.Arbitrary<NormalizedSet> = fc.record({
    weight: fc.option(fc.integer({ min: 0, max: 500 }), { nil: undefined }),
    reps: fc.option(fc.integer({ min: 0, max: 50 }), { nil: undefined }),
    isCompleted: fc.boolean(),
    rpe: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
    rir: fc.option(fc.integer({ min: 0, max: 5 }), { nil: undefined }),
});

const exerciseArbitrary: fc.Arbitrary<NormalizedExercise> = fc.record({
    exerciseKey: fc.string({ minLength: 3, maxLength: 30 })
        .filter(s => /^[a-z0-9_]+$/.test(s)),
    exerciseName: fc.string({ minLength: 3, maxLength: 50 })
        .filter(s => /^[a-zA-Z0-9 ]+$/.test(s)),
    sets: fc.array(setArbitrary, { minLength: 1, maxLength: 10 }),
});

const workoutEventArbitrary: fc.Arbitrary<WorkoutCompletedEvent> = fc.record({
    userId: fc.uuid(),
    workoutId: fc.uuid(),
    source: fc.constantFrom('assigned' as const, 'self' as const),
    originTable: fc.constantFrom('assigned_workouts' as const, 'workout_logs' as const),
    completedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    exercises: fc.array(exerciseArbitrary, { minLength: 1, maxLength: 8 }),
});

const liftStatsArbitrary: fc.Arbitrary<UserLiftStats> = fc.record({
    exerciseKey: fc.string({ minLength: 3, maxLength: 30 }).filter(s => /^[a-z0-9_]+$/.test(s)),
    e1rmKg: fc.option(fc.float({ min: 0, max: 500, noNaN: true }), { nil: null }),
    trainingMaxKg: fc.option(fc.float({ min: 0, max: 450, noNaN: true }), { nil: null }),
    ewmaE1rmKg: fc.option(fc.float({ min: 0, max: 500, noNaN: true }), { nil: null }),
    volatility: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: null }),
    updatedAt: fc.date(),
});

// ============================================
// PROPERTIES
// ============================================

describe('Progress Controller Properties', () => {
    // Property 1: E1RM is always >= weight for reps >= 1
    test('e1rmAlwaysGteWeight: e1rm >= weight for positive reps', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 500 }),
                fc.integer({ min: 1, max: 50 }),
                (weight, reps) => {
                    const e1rm = calculateE1RM(weight, reps);
                    expect(e1rm).toBeGreaterThanOrEqual(weight);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 2: E1RM is monotonic in weight (higher weight with same reps = higher e1rm)
    test('e1rmMonotonicInWeight', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 250 }),
                fc.integer({ min: 1, max: 250 }),
                fc.integer({ min: 1, max: 50 }),
                (w1, w2, reps) => {
                    const higher = Math.max(w1, w2);
                    const lower = Math.min(w1, w2);
                    const e1rmHigher = calculateE1RM(higher, reps);
                    const e1rmLower = calculateE1RM(lower, reps);
                    expect(e1rmHigher).toBeGreaterThanOrEqual(e1rmLower);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 3: E1RM is monotonic in reps (more reps with same weight = higher e1rm)
    test('e1rmMonotonicInReps', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 500 }),
                fc.integer({ min: 1, max: 25 }),
                fc.integer({ min: 1, max: 25 }),
                (weight, r1, r2) => {
                    const moreReps = Math.max(r1, r2);
                    const fewerReps = Math.min(r1, r2);
                    const e1rmMore = calculateE1RM(weight, moreReps);
                    const e1rmFewer = calculateE1RM(weight, fewerReps);
                    expect(e1rmMore).toBeGreaterThanOrEqual(e1rmFewer);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 4: XP is always non-negative
    test('xpAlwaysNonNegative', () => {
        fc.assert(
            fc.property(
                fc.array(exerciseArbitrary, { minLength: 0, maxLength: 10 }),
                (exercises) => {
                    const xp = calculateXP(exercises);
                    expect(xp).toBeGreaterThanOrEqual(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 5: XP increases with more completed sets
    test('xpIncreasesWithMoreSets', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9_]+$/.test(s)),
                fc.integer({ min: 1, max: 10 }),
                fc.integer({ min: 1, max: 10 }),
                (key, n1, n2) => {
                    const moreSets = Math.max(n1, n2);
                    const fewerSets = Math.min(n1, n2);

                    const exerciseMore: NormalizedExercise = {
                        exerciseKey: key,
                        exerciseName: key,
                        sets: Array.from({ length: moreSets }, () => ({
                            weight: 100,
                            reps: 10,
                            isCompleted: true,
                        })),
                    };

                    const exerciseFewer: NormalizedExercise = {
                        exerciseKey: key,
                        exerciseName: key,
                        sets: Array.from({ length: fewerSets }, () => ({
                            weight: 100,
                            reps: 10,
                            isCompleted: true,
                        })),
                    };

                    const xpMore = calculateXP([exerciseMore]);
                    const xpFewer = calculateXP([exerciseFewer]);
                    expect(xpMore).toBeGreaterThanOrEqual(xpFewer);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 6: processWorkoutCompleted is idempotent
    test('processIsIdempotent', () => {
        fc.assert(
            fc.property(workoutEventArbitrary, (event) => {
                const emptyStats = new Map<string, UserLiftStats>();
                const emptyNodeProgress = new Map<string, string>();
                const processedIds = new Set<string>();

                // First call
                const result1 = processWorkoutCompleted(
                    event,
                    emptyStats,
                    null,
                    emptyNodeProgress,
                    processedIds
                );

                // Add to processed set
                const idempotencyKey = `${event.userId}_${event.workoutId}_${event.source}`;
                processedIds.add(idempotencyKey);

                // Second call with same event
                const result2 = processWorkoutCompleted(
                    event,
                    emptyStats,
                    null,
                    emptyNodeProgress,
                    processedIds
                );

                // Second call should be marked as already processed
                expect(result2.alreadyProcessed).toBe(true);
                expect(result2.xpGained).toBe(0);
            }),
            { numRuns: 50 }
        );
    });

    // Property 7: Exercise key normalization is deterministic
    test('normalizeExerciseKeyIsDeterministic', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 50 }),
                (name) => {
                    const key1 = normalizeExerciseKey(name);
                    const key2 = normalizeExerciseKey(name);
                    expect(key1).toBe(key2);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 8: Normalized key is always lowercase with underscores
    test('normalizedKeyFormat', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 50 }),
                (name) => {
                    const key = normalizeExerciseKey(name);
                    // Should be lowercase
                    expect(key).toBe(key.toLowerCase());
                    // Should not have consecutive spaces (replaced with single underscore)
                    expect(key).not.toMatch(/\s/);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 9: EWMA converges to stable value with repeated identical inputs
    test('ewmaConverges', () => {
        fc.assert(
            fc.property(
                fc.float({ min: 1, max: 500, noNaN: true }),
                (value) => {
                    let ewma = calculateEWMA(value, null);
                    // Apply same value 20 times
                    for (let i = 0; i < 20; i++) {
                        ewma = calculateEWMA(value, ewma);
                    }
                    // Should converge close to the value
                    expect(Math.abs(ewma - value)).toBeLessThan(1);
                }
            ),
            { numRuns: 50 }
        );
    });

    // Property 10: Zero/invalid inputs yield zero e1rm
    test('zeroInputsYieldZeroE1rm', () => {
        expect(calculateE1RM(0, 10)).toBe(0);
        expect(calculateE1RM(100, 0)).toBe(0);
        expect(calculateE1RM(-50, 10)).toBe(0);
        expect(calculateE1RM(100, -5)).toBe(0);
    });
});

// ============================================
// UNIT TESTS
// ============================================

describe('Progress Controller Unit Tests', () => {
    test('calculateE1RM with 1 rep returns weight', () => {
        expect(calculateE1RM(100, 1)).toBe(100);
    });

    test('calculateE1RM with 10 reps uses Epley formula', () => {
        // e1rm = 100 * (1 + 10/30) = 100 * 1.333... = 133.33...
        const result = calculateE1RM(100, 10);
        expect(result).toBeCloseTo(133.33, 1);
    });

    test('normalizeExerciseKey handles mixed case and spaces', () => {
        expect(normalizeExerciseKey('Bench Press')).toBe('bench_press');
        expect(normalizeExerciseKey('DEADLIFT')).toBe('deadlift');
        expect(normalizeExerciseKey('Incline Dumbbell Press')).toBe('incline_dumbbell_press');
        expect(normalizeExerciseKey('pull  ups')).toBe('pull_ups'); // multiple spaces become single underscore
    });

    test('calculateXP includes base completion bonus', () => {
        const exercises: NormalizedExercise[] = [];
        // Even with no exercises, there's a completion bonus
        expect(calculateXP(exercises)).toBeGreaterThan(0);
    });

    test('processWorkoutCompleted returns xpGained > 0 for valid workout', () => {
        const event: WorkoutCompletedEvent = {
            userId: 'test-user',
            workoutId: 'test-workout',
            source: 'self',
            originTable: 'workout_logs',
            completedAt: new Date(),
            exercises: [
                {
                    exerciseKey: 'bench_press',
                    exerciseName: 'Bench Press',
                    sets: [
                        { weight: 100, reps: 10, isCompleted: true },
                        { weight: 100, reps: 8, isCompleted: true },
                    ],
                },
            ],
        };

        const result = processWorkoutCompleted(
            event,
            new Map(),
            null,
            new Map(),
            new Set()
        );

        expect(result.xpGained).toBeGreaterThan(0);
        expect(result.alreadyProcessed).toBe(false);
        expect(result.updatedStats.size).toBeGreaterThan(0);
    });

    test('updateExerciseStats calculates e1rm correctly', () => {
        const exercise: NormalizedExercise = {
            exerciseKey: 'squat',
            exerciseName: 'Squat',
            sets: [
                { weight: 100, reps: 5, isCompleted: true },
                { weight: 120, reps: 3, isCompleted: true }, // Best e1rm
                { weight: 80, reps: 10, isCompleted: true },
            ],
        };

        const result = updateExerciseStats(exercise, null);

        expect(result).not.toBeNull();
        expect(result!.exerciseKey).toBe('squat');
        expect(result!.e1rmKg).toBeGreaterThan(120); // Should be > weight due to reps
    });
});
