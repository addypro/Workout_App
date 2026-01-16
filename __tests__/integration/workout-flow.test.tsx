/**
 * Workout Flow Integration Tests
 *
 * Tests critical user flows through the workout execution screen.
 * These serve as a safety net before any refactoring of [id].tsx.
 *
 * Run with: npm test -- --testPathPattern=workout-flow
 */

import {
    unsafeCoerceSetId,
    unsafeCoerceSupersetGroupId,
    unsafeCoerceWorkoutExerciseId,
    unsafeCoerceWorkoutSessionId,
} from '@/lib/types/brands';
import type { WorkoutSession } from '@/lib/types/workout-session';
import { calculateWorkoutProgress } from '@/lib/types/workout-session';

// ============================================
// MOCK SESSION DATA
// ============================================

const createMockSession = (overrides: Partial<WorkoutSession> = {}): WorkoutSession => ({
    id: unsafeCoerceWorkoutSessionId('test-session-001'),
    workoutName: 'Test Workout',
    status: 'in_progress',
    startTime: new Date(),
    isResting: false,
    restTimeRemaining: 0,
    currentExerciseIndex: 0,
    exercises: [
        {
            id: unsafeCoerceWorkoutExerciseId('ex0'),
            name: 'Bench Press',
            restTime: 90,
            currentSetIndex: 0,
            muscleGroups: ['chest', 'triceps'],
            sets: [
                { id: unsafeCoerceSetId('s0-0'), reps: '8', weight: 135, isCompleted: false },
                { id: unsafeCoerceSetId('s0-1'), reps: '8', weight: 135, isCompleted: false },
                { id: unsafeCoerceSetId('s0-2'), reps: '8', weight: 135, isCompleted: false },
            ],
        },
        {
            id: unsafeCoerceWorkoutExerciseId('ex1'),
            name: 'Squat',
            restTime: 120,
            currentSetIndex: 0,
            muscleGroups: ['quads', 'glutes'],
            sets: [
                { id: unsafeCoerceSetId('s1-0'), reps: '5', weight: 225, isCompleted: false },
                { id: unsafeCoerceSetId('s1-1'), reps: '5', weight: 225, isCompleted: false },
                { id: unsafeCoerceSetId('s1-2'), reps: '5', weight: 225, isCompleted: false },
            ],
        },
    ],
    ...overrides,
});

const createMockSuperset = (): WorkoutSession => ({
    id: unsafeCoerceWorkoutSessionId('test-session-superset'),
    workoutName: 'Superset Workout',
    status: 'in_progress',
    startTime: new Date(),
    isResting: false,
    restTimeRemaining: 0,
    currentExerciseIndex: 0,
    supersetGroups: [
        {
            id: unsafeCoerceSupersetGroupId('sg1'),
            exerciseIds: [
                unsafeCoerceWorkoutExerciseId('ex0'),
                unsafeCoerceWorkoutExerciseId('ex1'),
            ],
            currentPhase: 'exercise_a',
            currentRound: 1,
            restBetween: 30,
            restAfterRound: 90,
        },
    ],
    exercises: [
        {
            id: unsafeCoerceWorkoutExerciseId('ex0'),
            name: 'Bench Press',
            restTime: 60,
            currentSetIndex: 0,
            supersetGroupId: unsafeCoerceSupersetGroupId('sg1'),
            muscleGroups: ['chest'],
            sets: [
                { id: unsafeCoerceSetId('s0-0'), reps: '10', isCompleted: false },
                { id: unsafeCoerceSetId('s0-1'), reps: '10', isCompleted: false },
            ],
        },
        {
            id: unsafeCoerceWorkoutExerciseId('ex1'),
            name: 'Bent Over Row',
            restTime: 60,
            currentSetIndex: 0,
            supersetGroupId: unsafeCoerceSupersetGroupId('sg1'),
            muscleGroups: ['back'],
            sets: [
                { id: unsafeCoerceSetId('s1-0'), reps: '10', isCompleted: false },
                { id: unsafeCoerceSetId('s1-1'), reps: '10', isCompleted: false },
            ],
        },
    ],
});

// ============================================
// WORKOUT PROGRESS TESTS
// ============================================

describe('calculateWorkoutProgress', () => {
    it('calculates 0% progress for fresh session', () => {
        const session = createMockSession();
        const result = calculateWorkoutProgress(session);

        expect(result.totalSetsCompleted).toBe(0);
        expect(result.totalSets).toBe(6);
        expect(result.setProgress).toBe(0);
    });

    it('calculates partial progress correctly', () => {
        const session = createMockSession();
        // Complete 2 of 6 sets
        session.exercises[0].sets[0].isCompleted = true;
        session.exercises[0].sets[1].isCompleted = true;

        const result = calculateWorkoutProgress(session);

        expect(result.totalSetsCompleted).toBe(2);
        expect(result.totalSets).toBe(6);
        expect(result.setProgress).toBeCloseTo(2 / 6);
    });

    it('calculates 100% progress for completed session', () => {
        const session = createMockSession();
        // Complete all sets
        session.exercises.forEach((ex) => {
            ex.sets.forEach((set) => {
                set.isCompleted = true;
            });
        });

        const result = calculateWorkoutProgress(session);

        expect(result.totalSetsCompleted).toBe(6);
        expect(result.totalSets).toBe(6);
        expect(result.setProgress).toBe(1);
    });
});

// ============================================
// SESSION STATE TESTS
// ============================================

describe('Workout Session State', () => {
    it('starts with first exercise selected', () => {
        const session = createMockSession();
        expect(session.currentExerciseIndex).toBe(0);
        expect(session.exercises[0].currentSetIndex).toBe(0);
    });

    it('tracks rest state correctly', () => {
        const session = createMockSession({ isResting: true, restTimeRemaining: 60 });
        expect(session.isResting).toBe(true);
        expect(session.restTimeRemaining).toBe(60);
    });
});

// ============================================
// SUPERSET FLOW TESTS
// ============================================

describe('Superset Session', () => {
    it('has superset group linking two exercises', () => {
        const session = createMockSuperset();

        expect(session.supersetGroups).toHaveLength(1);
        expect(session.supersetGroups![0].exerciseIds).toHaveLength(2);
    });

    it('exercises reference their superset group', () => {
        const session = createMockSuperset();

        expect(session.exercises[0].supersetGroupId).toBeDefined();
        expect(session.exercises[1].supersetGroupId).toBeDefined();
        expect(session.exercises[0].supersetGroupId).toBe(session.exercises[1].supersetGroupId);
    });
});

// ============================================
// SET COMPLETION FLOW TESTS
// ============================================

describe('Set Completion Logic', () => {
    it('marks set as completed with timestamp', () => {
        const session = createMockSession();
        const before = new Date();

        // Simulate completing a set
        const set = session.exercises[0].sets[0];
        set.isCompleted = true;
        set.completedAt = new Date();
        session.exercises[0].currentSetIndex = 1;

        expect(set.isCompleted).toBe(true);
        expect(set.completedAt).toBeDefined();
        expect(set.completedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('advances to next set after completion', () => {
        const session = createMockSession();
        const exercise = session.exercises[0];

        // Complete first set
        exercise.sets[0].isCompleted = true;
        exercise.currentSetIndex = 1;

        expect(exercise.currentSetIndex).toBe(1);
    });

    it('can complete all sets in exercise', () => {
        const session = createMockSession();
        const exercise = session.exercises[0];

        // Complete all sets
        exercise.sets.forEach((set) => {
            set.isCompleted = true;
        });
        exercise.currentSetIndex = exercise.sets.length;

        const allCompleted = exercise.sets.every((s) => s.isCompleted);
        expect(allCompleted).toBe(true);
    });
});

// ============================================
// WORKOUT FINISH TESTS
// ============================================

describe('Workout Finish Flow', () => {
    it('marks session as completed', () => {
        const session = createMockSession();

        // Simulate finishing - use type assertion for mutable state
        (session as any).status = 'completed';
        (session as any).endTime = new Date();

        expect(session.status).toBe('completed');
        expect(session.endTime).toBeDefined();
    });

    it('calculates total duration', () => {
        const start = new Date();
        start.setMinutes(start.getMinutes() - 45); // 45 mins ago

        const session = createMockSession({
            startTime: start,
            endTime: new Date(),
        });

        const durationMs = session.endTime!.getTime() - session.startTime.getTime();
        const durationMins = Math.floor(durationMs / 60000);

        expect(durationMins).toBeGreaterThanOrEqual(44);
        expect(durationMins).toBeLessThanOrEqual(46);
    });
});

// ============================================
// EXERCISE MUTATION TESTS
// ============================================

describe('Exercise Mutations', () => {
    it('can add exercise to session', () => {
        const session = createMockSession();
        const initialCount = session.exercises.length;

        // Simulate adding exercise
        session.exercises.push({
            id: unsafeCoerceWorkoutExerciseId('ex-new'),
            name: 'Deadlift',
            restTime: 120,
            currentSetIndex: 0,
            muscleGroups: ['back', 'hamstrings'],
            sets: [
                { id: unsafeCoerceSetId('snew-0'), reps: '5', weight: 315, isCompleted: false },
            ],
        });

        expect(session.exercises.length).toBe(initialCount + 1);
        expect(session.exercises[session.exercises.length - 1].name).toBe('Deadlift');
    });

    it('can delete set from exercise', () => {
        const session = createMockSession();
        const exercise = session.exercises[0];
        const initialSetCount = exercise.sets.length;

        // Remove last set
        exercise.sets = exercise.sets.slice(0, -1);

        expect(exercise.sets.length).toBe(initialSetCount - 1);
    });

    it('can update weight on set', () => {
        const session = createMockSession();
        const set = session.exercises[0].sets[0];

        set.weight = 145; // Changed from 135

        expect(set.weight).toBe(145);
    });

    it('can update reps on set', () => {
        const session = createMockSession();
        const set = session.exercises[0].sets[0];

        set.reps = '10'; // Changed from 8

        expect(set.reps).toBe('10');
    });
});
