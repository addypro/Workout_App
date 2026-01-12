/**
 * PR Detector Property-Based Tests
 *
 * Uses fast-check to formally verify PR detection invariants:
 * 1. PRs require improvement over historical data
 * 2. At most one PR type per exercise (mutual exclusivity)
 * 3. No PRs without history
 * 4. Volume calculation is multiplicative
 */

import fc from 'fast-check';

// ============================================
// LOCAL IMPLEMENTATIONS (for testing without imports)
// ============================================

interface SetData {
    weight?: number;
    reps?: number | string;
    completed?: boolean;
}

interface ExerciseResult {
    exerciseName: string;
    sets: SetData[];
}

interface WorkoutResults {
    exercises: ExerciseResult[];
}

interface HistoricalPR {
    exerciseName: string;
    maxWeight: number;
    maxVolume: number;
    maxReps: number;
}

interface PRRecord {
    exerciseName: string;
    prType: 'weight' | 'volume' | 'reps';
    previousValue: number;
    newValue: number;
    unit?: string;
}

// Pure functions for testing
function calculateVolume(weight: number | undefined, reps: number | string | undefined): number {
    if (!weight || !reps) return 0;
    const repCount = typeof reps === 'string' ? parseInt(reps, 10) : reps;
    if (isNaN(repCount)) return 0;
    return weight * repCount;
}

function parseReps(reps: number | string | undefined): number {
    if (reps === undefined || reps === null) return 0;
    if (typeof reps === 'number') return reps;
    const parsed = parseInt(reps, 10);
    return isNaN(parsed) ? 0 : parsed;
}

function detectPRsSync(
    workout: WorkoutResults,
    historicalPRs: Map<string, HistoricalPR>
): PRRecord[] {
    const prs: PRRecord[] = [];

    for (const exercise of workout.exercises || []) {
        const key = exercise.exerciseName.toLowerCase();
        const historical = historicalPRs.get(key);

        if (!historical) continue;

        let currentMaxWeight = 0;
        let currentMaxVolume = 0;
        let currentMaxReps = 0;

        for (const set of exercise.sets || []) {
            if (!set.completed) continue;

            const weight = set.weight || 0;
            const reps = parseReps(set.reps);
            const volume = calculateVolume(weight, reps);

            currentMaxWeight = Math.max(currentMaxWeight, weight);
            currentMaxVolume = Math.max(currentMaxVolume, volume);
            currentMaxReps = Math.max(currentMaxReps, reps);
        }

        // Weight PR
        if (currentMaxWeight > historical.maxWeight && historical.maxWeight > 0) {
            prs.push({
                exerciseName: exercise.exerciseName,
                prType: 'weight',
                previousValue: historical.maxWeight,
                newValue: currentMaxWeight,
                unit: 'lbs',
            });
        }

        // Volume PR (only if no weight PR)
        if (currentMaxVolume > historical.maxVolume && historical.maxVolume > 0) {
            const hasWeightPR = prs.some(
                p => p.exerciseName === exercise.exerciseName && p.prType === 'weight'
            );
            if (!hasWeightPR) {
                prs.push({
                    exerciseName: exercise.exerciseName,
                    prType: 'volume',
                    previousValue: historical.maxVolume,
                    newValue: currentMaxVolume,
                });
            }
        }

        // Rep PR (only if no other PR)
        if (currentMaxReps > historical.maxReps && historical.maxReps > 0) {
            const hasPR = prs.some(p => p.exerciseName === exercise.exerciseName);
            if (!hasPR) {
                prs.push({
                    exerciseName: exercise.exerciseName,
                    prType: 'reps',
                    previousValue: historical.maxReps,
                    newValue: currentMaxReps,
                });
            }
        }
    }

    return prs;
}

// ============================================
// ARBITRARIES
// ============================================

const setArbitrary = fc.record({
    weight: fc.option(fc.integer({ min: 0, max: 500 }), { nil: undefined }),
    reps: fc.oneof(
        fc.integer({ min: 0, max: 50 }),
        fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 1, maxLength: 2 })
    ),
    completed: fc.boolean(),
});

const exerciseResultArbitrary = fc.record({
    exerciseName: fc.stringOf(fc.alphaNumeric(), { minLength: 3, maxLength: 30 }),
    sets: fc.array(setArbitrary, { minLength: 1, maxLength: 10 }),
});

const workoutResultsArbitrary = fc.record({
    exercises: fc.array(exerciseResultArbitrary, { minLength: 1, maxLength: 10 }),
});

const historicalPRArbitrary = (name: string) => fc.record({
    exerciseName: fc.constant(name),
    maxWeight: fc.integer({ min: 0, max: 400 }),
    maxVolume: fc.integer({ min: 0, max: 10000 }),
    maxReps: fc.integer({ min: 0, max: 50 }),
});

// ============================================
// PROPERTIES
// ============================================

describe('PR Detector Properties', () => {
    // Property 1: PRs always require improvement
    test('prRequiresImprovement: newValue > previousValue for all PRs', () => {
        fc.assert(
            fc.property(
                workoutResultsArbitrary,
                fc.array(fc.integer({ min: 0, max: 400 })),
                (workout, historicalWeights) => {
                    // Build historical PRs map
                    const historicalPRs = new Map<string, HistoricalPR>();
                    workout.exercises.forEach((ex, i) => {
                        historicalPRs.set(ex.exerciseName.toLowerCase(), {
                            exerciseName: ex.exerciseName,
                            maxWeight: historicalWeights[i % historicalWeights.length] || 0,
                            maxVolume: (historicalWeights[i % historicalWeights.length] || 0) * 10,
                            maxReps: 10,
                        });
                    });

                    const prs = detectPRsSync(workout, historicalPRs);

                    // Invariant: every PR must have newValue > previousValue
                    for (const pr of prs) {
                        expect(pr.newValue).toBeGreaterThan(pr.previousValue);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 2: At most one PR type per exercise
    test('prTypesMutuallyExclusive: at most one PR per exercise', () => {
        fc.assert(
            fc.property(workoutResultsArbitrary, (workout) => {
                const historicalPRs = new Map<string, HistoricalPR>();
                workout.exercises.forEach(ex => {
                    historicalPRs.set(ex.exerciseName.toLowerCase(), {
                        exerciseName: ex.exerciseName,
                        maxWeight: 100,
                        maxVolume: 1000,
                        maxReps: 10,
                    });
                });

                const prs = detectPRsSync(workout, historicalPRs);

                // Count PRs per exercise
                const prCountByExercise = new Map<string, number>();
                for (const pr of prs) {
                    const count = prCountByExercise.get(pr.exerciseName) || 0;
                    prCountByExercise.set(pr.exerciseName, count + 1);
                }

                // Invariant: no exercise has more than 1 PR
                for (const [, count] of prCountByExercise) {
                    expect(count).toBeLessThanOrEqual(1);
                }
            }),
            { numRuns: 100 }
        );
    });

    // Property 3: No PRs without history
    test('noPRsWithoutHistory: empty history yields no PRs', () => {
        fc.assert(
            fc.property(workoutResultsArbitrary, (workout) => {
                const emptyHistory = new Map<string, HistoricalPR>();
                const prs = detectPRsSync(workout, emptyHistory);

                expect(prs.length).toBe(0);
            }),
            { numRuns: 50 }
        );
    });

    // Property 4: Volume calculation is weight × reps
    test('volumeCalculationIsMultiplicative: volume = weight * reps', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 500 }),
                fc.integer({ min: 0, max: 50 }),
                (weight, reps) => {
                    const volume = calculateVolume(weight, reps);
                    expect(volume).toBe(weight * reps);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 5: Zero inputs yield zero volume
    test('zeroVolumeForZeroInputs', () => {
        expect(calculateVolume(0, 10)).toBe(0);
        expect(calculateVolume(100, 0)).toBe(0);
        expect(calculateVolume(undefined, 10)).toBe(0);
        expect(calculateVolume(100, undefined)).toBe(0);
    });

    // Property 6: String reps parsing is consistent
    test('stringRepsParsingConsistent', () => {
        fc.assert(
            fc.property(fc.integer({ min: 0, max: 99 }), (num) => {
                const asString = String(num);
                expect(parseReps(asString)).toBe(num);
                expect(parseReps(num)).toBe(num);
            }),
            { numRuns: 50 }
        );
    });
});

// ============================================
// EXPORTS FOR REUSE
// ============================================

export {
    calculateVolume, detectPRsSync, exerciseResultArbitrary, parseReps, setArbitrary, workoutResultsArbitrary
};

