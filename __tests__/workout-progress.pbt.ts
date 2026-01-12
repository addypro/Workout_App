/**
 * Workout Progress Property-Based Tests
 *
 * Uses fast-check to formally verify progress calculation invariants:
 * 1. Progress is always bounded [0, 1]
 * 2. Completed sets never exceed total sets
 * 3. Completing a set never decreases progress (monotonicity)
 * 4. Empty workout returns zero progress
 */

import fc from 'fast-check';

// ============================================
// LOCAL IMPLEMENTATIONS (for testing)
// ============================================

interface WorkoutSet {
    id: string;
    reps: number | string;
    weight?: number;
    isCompleted: boolean;
}

interface WorkoutExercise {
    id: string;
    name: string;
    sets: WorkoutSet[];
    currentSetIndex: number;
}

interface WorkoutSession {
    id: string;
    exercises: WorkoutExercise[];
    currentExerciseIndex: number;
}

interface ProgressResult {
    exerciseProgress: number;
    setProgress: number;
    totalSetsCompleted: number;
    totalSets: number;
}

function calculateWorkoutProgress(session: WorkoutSession): ProgressResult {
    const totalSets = session.exercises.reduce(
        (sum, ex) => sum + ex.sets.length,
        0
    );
    const completedSets = session.exercises.reduce(
        (sum, ex) => sum + ex.sets.filter((s) => s.isCompleted).length,
        0
    );

    const completedExercises = session.exercises.filter((ex) =>
        ex.sets.every((s) => s.isCompleted)
    ).length;

    return {
        exerciseProgress: session.exercises.length > 0
            ? completedExercises / session.exercises.length
            : 0,
        setProgress: totalSets > 0 ? completedSets / totalSets : 0,
        totalSetsCompleted: completedSets,
        totalSets,
    };
}

// ============================================
// ARBITRARIES
// ============================================

const setArbitrary = fc.record({
    id: fc.uuid(),
    reps: fc.integer({ min: 1, max: 20 }),
    weight: fc.option(fc.integer({ min: 0, max: 500 }), { nil: undefined }),
    isCompleted: fc.boolean(),
});

const exerciseArbitrary = fc.record({
    id: fc.uuid(),
    name: fc.stringOf(fc.alpha(), { minLength: 3, maxLength: 20 }),
    sets: fc.array(setArbitrary, { minLength: 1, maxLength: 10 }),
    currentSetIndex: fc.constant(0),
});

const sessionArbitrary = fc.record({
    id: fc.uuid(),
    exercises: fc.array(exerciseArbitrary, { minLength: 0, maxLength: 10 }),
    currentExerciseIndex: fc.constant(0),
});

// ============================================
// PROPERTIES
// ============================================

describe('Workout Progress Properties', () => {
    // Property 1: Exercise progress is bounded [0, 1]
    test('exerciseProgressBounded: 0 <= exerciseProgress <= 1', () => {
        fc.assert(
            fc.property(sessionArbitrary, (session) => {
                const progress = calculateWorkoutProgress(session);
                expect(progress.exerciseProgress).toBeGreaterThanOrEqual(0);
                expect(progress.exerciseProgress).toBeLessThanOrEqual(1);
            }),
            { numRuns: 100 }
        );
    });

    // Property 2: Set progress is bounded [0, 1]
    test('setProgressBounded: 0 <= setProgress <= 1', () => {
        fc.assert(
            fc.property(sessionArbitrary, (session) => {
                const progress = calculateWorkoutProgress(session);
                expect(progress.setProgress).toBeGreaterThanOrEqual(0);
                expect(progress.setProgress).toBeLessThanOrEqual(1);
            }),
            { numRuns: 100 }
        );
    });

    // Property 3: Completed sets never exceed total sets
    test('completedNeverExceedsTotal: completedSets <= totalSets', () => {
        fc.assert(
            fc.property(sessionArbitrary, (session) => {
                const progress = calculateWorkoutProgress(session);
                expect(progress.totalSetsCompleted).toBeLessThanOrEqual(progress.totalSets);
            }),
            { numRuns: 100 }
        );
    });

    // Property 4: Empty workout returns zero progress
    test('emptyWorkoutReturnsZero', () => {
        const emptySession: WorkoutSession = {
            id: 'empty',
            exercises: [],
            currentExerciseIndex: 0,
        };
        const progress = calculateWorkoutProgress(emptySession);

        expect(progress.exerciseProgress).toBe(0);
        expect(progress.setProgress).toBe(0);
        expect(progress.totalSets).toBe(0);
        expect(progress.totalSetsCompleted).toBe(0);
    });

    // Property 5: All sets completed = 100% progress
    test('allCompletedEquals100Percent', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        id: fc.uuid(),
                        name: fc.stringOf(fc.alpha(), { minLength: 3, maxLength: 10 }),
                        sets: fc.array(
                            fc.record({
                                id: fc.uuid(),
                                reps: fc.integer({ min: 1, max: 20 }),
                                isCompleted: fc.constant(true), // All sets completed
                            }),
                            { minLength: 1, maxLength: 5 }
                        ),
                        currentSetIndex: fc.constant(0),
                    }),
                    { minLength: 1, maxLength: 5 }
                ),
                (exercises) => {
                    const session: WorkoutSession = {
                        id: 'test',
                        exercises,
                        currentExerciseIndex: 0,
                    };
                    const progress = calculateWorkoutProgress(session);

                    expect(progress.exerciseProgress).toBe(1);
                    expect(progress.setProgress).toBe(1);
                }
            ),
            { numRuns: 50 }
        );
    });

    // Property 6: Monotonicity - completing a set never decreases progress
    test('monotonicity: completing a set never decreases progress', () => {
        fc.assert(
            fc.property(
                sessionArbitrary,
                fc.nat({ max: 9 }), // exercise index
                fc.nat({ max: 9 }), // set index
                (session, exIdx, setIdx) => {
                    // Skip if indices out of bounds
                    if (exIdx >= session.exercises.length) return;
                    const exercise = session.exercises[exIdx];
                    if (setIdx >= exercise.sets.length) return;

                    // Calculate progress before
                    const progressBefore = calculateWorkoutProgress(session);

                    // Complete the set
                    const modifiedSession = {
                        ...session,
                        exercises: session.exercises.map((ex, i) =>
                            i === exIdx
                                ? {
                                    ...ex,
                                    sets: ex.sets.map((set, j) =>
                                        j === setIdx ? { ...set, isCompleted: true } : set
                                    ),
                                }
                                : ex
                        ),
                    };

                    // Calculate progress after
                    const progressAfter = calculateWorkoutProgress(modifiedSession);

                    // Invariant: progress should never decrease
                    expect(progressAfter.setProgress).toBeGreaterThanOrEqual(progressBefore.setProgress);
                    expect(progressAfter.exerciseProgress).toBeGreaterThanOrEqual(progressBefore.exerciseProgress);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ============================================
// EXPORTS
// ============================================

export {
    calculateWorkoutProgress, exerciseArbitrary, sessionArbitrary, setArbitrary
};

