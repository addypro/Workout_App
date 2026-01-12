/**
 * Workout Session XState Machine
 *
 * Models the workout lifecycle with proper state transitions:
 * - Eliminates impossible states (e.g., completed + resting)
 * - Strict transition guards prevent invalid actions
 * - Nested states for active phase (exercising, resting)
 *
 * States:
 * - idle: No active workout
 * - active: Workout in progress
 *   - exercising: Performing a set
 *   - resting: Between sets (rest timer active)
 * - paused: Workout temporarily paused
 * - finished: Workout completed
 */

import { assign, setup } from 'xstate';
import type {
    WorkoutExercise,
    WorkoutSession,
    WorkoutSet,
} from '../types/workout-session';

// ============================================
// CONTEXT
// ============================================

export interface WorkoutMachineContext {
    session: WorkoutSession | null;
    restTimeRemaining: number;
    restExerciseIndex: number | null;
    restAfterSetIndex: number | null;
    activeSupersetId: string | null;
    pausedAt: Date | null;
    totalPausedTime: number; // Accumulated pause time in ms
}

// ============================================
// EVENTS
// ============================================

export type WorkoutMachineEvent =
    | { type: 'START_WORKOUT'; session: WorkoutSession }
    | { type: 'COMPLETE_SET'; exerciseIndex: number; setIndex: number; actualReps?: number; actualWeight?: number; rpe?: number }
    | { type: 'START_REST'; duration: number; exerciseIndex: number; setIndex: number }
    | { type: 'SKIP_REST' }
    | { type: 'REST_TICK' }
    | { type: 'REST_COMPLETE' }
    | { type: 'PAUSE' }
    | { type: 'RESUME' }
    | { type: 'FINISH_WORKOUT' }
    | { type: 'CANCEL_WORKOUT' }
    | { type: 'ADD_EXERCISE'; exercise: WorkoutExercise }
    | { type: 'REMOVE_EXERCISE'; exerciseIndex: number }
    | { type: 'UPDATE_SET'; exerciseIndex: number; setIndex: number; updates: Partial<WorkoutSet> }
    | { type: 'ADD_SET'; exerciseIndex: number }
    | { type: 'REMOVE_SET'; exerciseIndex: number; setIndex: number }
    | { type: 'LINK_SUPERSET'; exerciseIds: string[]; restBetween?: number; restAfterRound?: number }
    | { type: 'UNLINK_SUPERSET'; groupId: string }
    | { type: 'NEXT_SUPERSET_PHASE'; groupId: string };

// ============================================
// MACHINE DEFINITION (XState v5)
// ============================================

export const workoutSessionMachine = setup({
    types: {
        context: {} as WorkoutMachineContext,
        events: {} as WorkoutMachineEvent,
    },
    guards: {
        hasMoreRest: ({ context }) => context.restTimeRemaining > 0,
        restComplete: ({ context }) => context.restTimeRemaining <= 0,
        hasSession: ({ context }) => context.session !== null,
    },
    actions: {
        assignSession: assign(({ event }) => {
            if (event.type !== 'START_WORKOUT') return {};
            return {
                session: {
                    ...event.session,
                    status: 'in_progress' as const,
                    startTime: new Date(),
                },
            };
        }),

        completeSet: assign(({ context, event }) => {
            if (event.type !== 'COMPLETE_SET' || !context.session) return {};

            const { exerciseIndex, setIndex, actualReps, actualWeight, rpe } = event;
            const exercises = [...context.session.exercises];
            const exercise = { ...exercises[exerciseIndex] };
            const sets = [...exercise.sets];

            sets[setIndex] = {
                ...sets[setIndex],
                isCompleted: true,
                completedAt: new Date(),
                actualReps: actualReps ?? sets[setIndex].actualReps,
                actualWeight: actualWeight ?? sets[setIndex].actualWeight,
                rpe: rpe ?? sets[setIndex].rpe,
            };

            exercise.sets = sets;
            exercise.currentSetIndex = Math.min(setIndex + 1, sets.length - 1);
            exercises[exerciseIndex] = exercise;

            return { session: { ...context.session, exercises } };
        }),

        startRest: assign(({ event }) => {
            if (event.type !== 'START_REST') return {};
            return {
                restTimeRemaining: event.duration,
                restExerciseIndex: event.exerciseIndex,
                restAfterSetIndex: event.setIndex,
            };
        }),

        tickRest: assign(({ context }) => ({
            restTimeRemaining: Math.max(0, context.restTimeRemaining - 1),
        })),

        clearRest: assign({
            restTimeRemaining: 0,
            restExerciseIndex: null,
            restAfterSetIndex: null,
        }),

        markPaused: assign(({ context }) => ({
            pausedAt: new Date(),
            session: context.session ? { ...context.session, status: 'paused' as const } : null,
        })),

        markResumed: assign(({ context }) => ({
            totalPausedTime: context.pausedAt
                ? context.totalPausedTime + (Date.now() - context.pausedAt.getTime())
                : context.totalPausedTime,
            pausedAt: null,
            session: context.session ? { ...context.session, status: 'in_progress' as const } : null,
        })),

        markFinished: assign(({ context }) => ({
            session: context.session
                ? { ...context.session, status: 'completed' as const, endTime: new Date() }
                : null,
        })),

        markCancelled: assign(({ context }) => ({
            session: context.session
                ? { ...context.session, status: 'cancelled' as const, endTime: new Date() }
                : null,
        })),

        addExercise: assign(({ context, event }) => {
            if (event.type !== 'ADD_EXERCISE' || !context.session) return {};
            return {
                session: {
                    ...context.session,
                    exercises: [...context.session.exercises, event.exercise],
                },
            };
        }),

        removeExercise: assign(({ context, event }) => {
            if (event.type !== 'REMOVE_EXERCISE' || !context.session) return {};
            const exercises = context.session.exercises.filter((_, i) => i !== event.exerciseIndex);
            return { session: { ...context.session, exercises } };
        }),

        updateSet: assign(({ context, event }) => {
            if (event.type !== 'UPDATE_SET' || !context.session) return {};
            const { exerciseIndex, setIndex, updates } = event;
            const exercises = [...context.session.exercises];
            const exercise = { ...exercises[exerciseIndex] };
            const sets = [...exercise.sets];
            sets[setIndex] = { ...sets[setIndex], ...updates };
            exercise.sets = sets;
            exercises[exerciseIndex] = exercise;
            return { session: { ...context.session, exercises } };
        }),

        addSet: assign(({ context, event }) => {
            if (event.type !== 'ADD_SET' || !context.session) return {};
            const exercises = [...context.session.exercises];
            const exercise = { ...exercises[event.exerciseIndex] };
            const lastSet = exercise.sets[exercise.sets.length - 1];
            const newSet: WorkoutSet = {
                id: `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                reps: lastSet?.reps ?? 10,
                weight: lastSet?.weight,
                isCompleted: false,
            };
            exercise.sets = [...exercise.sets, newSet];
            exercises[event.exerciseIndex] = exercise;
            return { session: { ...context.session, exercises } };
        }),

        removeSet: assign(({ context, event }) => {
            if (event.type !== 'REMOVE_SET' || !context.session) return {};
            const exercises = [...context.session.exercises];
            const exercise = { ...exercises[event.exerciseIndex] };
            exercise.sets = exercise.sets.filter((_, i) => i !== event.setIndex);
            exercises[event.exerciseIndex] = exercise;
            return { session: { ...context.session, exercises } };
        }),
    },
}).createMachine({
    id: 'workoutSession',
    initial: 'idle',
    context: {
        session: null,
        restTimeRemaining: 0,
        restExerciseIndex: null,
        restAfterSetIndex: null,
        activeSupersetId: null,
        pausedAt: null,
        totalPausedTime: 0,
    },
    states: {
        idle: {
            on: {
                START_WORKOUT: {
                    target: 'active',
                    actions: 'assignSession',
                },
            },
        },

        active: {
            initial: 'exercising',
            states: {
                exercising: {
                    on: {
                        COMPLETE_SET: {
                            actions: 'completeSet',
                        },
                        START_REST: {
                            target: 'resting',
                            actions: 'startRest',
                        },
                        ADD_EXERCISE: {
                            actions: 'addExercise',
                        },
                        REMOVE_EXERCISE: {
                            actions: 'removeExercise',
                        },
                        UPDATE_SET: {
                            actions: 'updateSet',
                        },
                        ADD_SET: {
                            actions: 'addSet',
                        },
                        REMOVE_SET: {
                            actions: 'removeSet',
                        },
                    },
                },
                resting: {
                    on: {
                        REST_TICK: [
                            {
                                guard: 'hasMoreRest',
                                actions: 'tickRest',
                            },
                            {
                                guard: 'restComplete',
                                target: 'exercising',
                                actions: 'clearRest',
                            },
                        ],
                        SKIP_REST: {
                            target: 'exercising',
                            actions: 'clearRest',
                        },
                        REST_COMPLETE: {
                            target: 'exercising',
                            actions: 'clearRest',
                        },
                    },
                },
            },
            on: {
                PAUSE: {
                    target: 'paused',
                    actions: 'markPaused',
                },
                FINISH_WORKOUT: {
                    target: 'finished',
                    actions: 'markFinished',
                },
                CANCEL_WORKOUT: {
                    target: 'idle',
                    actions: 'markCancelled',
                },
            },
        },

        paused: {
            on: {
                RESUME: {
                    target: 'active.exercising',
                    actions: 'markResumed',
                },
                CANCEL_WORKOUT: {
                    target: 'idle',
                    actions: 'markCancelled',
                },
            },
        },

        finished: {
            type: 'final',
        },
    },
});

// ============================================
// TYPE EXPORTS
// ============================================

export type WorkoutMachineActor = typeof workoutSessionMachine;

export type WorkoutMachineStatus =
    | 'idle'
    | 'active.exercising'
    | 'active.resting'
    | 'paused'
    | 'finished';

/**
 * Helper to get the flattened status string from machine state
 */
export function getWorkoutStatus(state: { matches: (value: any) => boolean }): WorkoutMachineStatus {
    if (state.matches('idle')) return 'idle';
    if (state.matches({ active: 'exercising' })) return 'active.exercising';
    if (state.matches({ active: 'resting' })) return 'active.resting';
    if (state.matches('paused')) return 'paused';
    if (state.matches('finished')) return 'finished';
    return 'idle';
}
