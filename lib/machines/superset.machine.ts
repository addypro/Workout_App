/**
 * Superset Phase XState Machine
 *
 * Formalizes the superset execution flow with explicit phase transitions.
 * Handles 2-4 exercise supersets with proper rest periods.
 *
 * Flow for 2 exercises:
 * exercise_1 → rest_12 → exercise_2 → rest_round → (next round or complete)
 *
 * Flow for 3 exercises:
 * exercise_1 → rest_12 → exercise_2 → rest_23 → exercise_3 → rest_round → (loop)
 */

import { assign, setup } from 'xstate';
import type { SupersetGroupId, WorkoutExerciseId } from '../types/brands';

// ============================================
// CONTEXT
// ============================================

export interface SupersetMachineContext {
    groupId: SupersetGroupId;
    exerciseIds: WorkoutExerciseId[];
    currentExerciseIndex: number;
    currentRound: number;
    maxRounds: number;
    restBetweenExercises: number; // seconds
    restAfterRound: number; // seconds
    restTimeRemaining: number;
}

// ============================================
// EVENTS
// ============================================

export type SupersetEvent =
    | { type: 'START_SUPERSET'; groupId: SupersetGroupId; exerciseIds: WorkoutExerciseId[]; maxRounds: number; restBetween?: number; restAfterRound?: number }
    | { type: 'COMPLETE_SET' }
    | { type: 'START_REST'; duration: number }
    | { type: 'REST_TICK' }
    | { type: 'REST_COMPLETE' }
    | { type: 'SKIP_REST' }
    | { type: 'CANCEL' };

// ============================================
// MACHINE
// ============================================

export const supersetMachine = setup({
    types: {
        context: {} as SupersetMachineContext,
        events: {} as SupersetEvent,
    },
    guards: {
        hasMoreExercisesInRound: ({ context }) => {
            return context.currentExerciseIndex < context.exerciseIds.length - 1;
        },
        hasMoreRounds: ({ context }) => {
            return context.currentRound < context.maxRounds;
        },
        isLastExercise: ({ context }) => {
            return context.currentExerciseIndex === context.exerciseIds.length - 1;
        },
        isLastRound: ({ context }) => {
            return context.currentRound >= context.maxRounds;
        },
        restComplete: ({ context }) => {
            return context.restTimeRemaining <= 0;
        },
    },
    actions: {
        initializeSuperset: assign(({ event }) => {
            if (event.type !== 'START_SUPERSET') return {};
            return {
                groupId: event.groupId,
                exerciseIds: event.exerciseIds,
                currentExerciseIndex: 0,
                currentRound: 1,
                maxRounds: event.maxRounds,
                restBetweenExercises: event.restBetween ?? 45,
                restAfterRound: event.restAfterRound ?? 90,
                restTimeRemaining: 0,
            };
        }),

        moveToNextExercise: assign(({ context }) => ({
            currentExerciseIndex: context.currentExerciseIndex + 1,
        })),

        startNextRound: assign(({ context }) => ({
            currentRound: context.currentRound + 1,
            currentExerciseIndex: 0,
        })),

        startBetweenRest: assign(({ context }) => ({
            restTimeRemaining: context.restBetweenExercises,
        })),

        startRoundRest: assign(({ context }) => ({
            restTimeRemaining: context.restAfterRound,
        })),

        tickRest: assign(({ context }) => ({
            restTimeRemaining: Math.max(0, context.restTimeRemaining - 1),
        })),

        clearRest: assign({
            restTimeRemaining: 0,
        }),

        resetContext: assign({
            currentExerciseIndex: 0,
            currentRound: 1,
            restTimeRemaining: 0,
        }),
    },
}).createMachine({
    id: 'superset',
    initial: 'idle',
    context: {
        groupId: '' as SupersetGroupId,
        exerciseIds: [],
        currentExerciseIndex: 0,
        currentRound: 1,
        maxRounds: 3,
        restBetweenExercises: 45,
        restAfterRound: 90,
        restTimeRemaining: 0,
    },
    states: {
        idle: {
            on: {
                START_SUPERSET: {
                    target: 'active.exercising',
                    actions: 'initializeSuperset',
                },
            },
        },

        active: {
            initial: 'exercising',
            states: {
                exercising: {
                    on: {
                        COMPLETE_SET: [
                            // More exercises in this round? → rest between exercises
                            {
                                guard: 'hasMoreExercisesInRound',
                                target: 'resting_between',
                                actions: 'startBetweenRest',
                            },
                            // Last exercise but more rounds? → rest after round
                            {
                                guard: 'hasMoreRounds',
                                target: 'resting_round',
                                actions: 'startRoundRest',
                            },
                            // All done!
                            {
                                target: '#superset.completed',
                            },
                        ],
                    },
                },

                resting_between: {
                    description: 'Short rest between exercises (30-60s typically)',
                    on: {
                        REST_TICK: [
                            {
                                guard: 'restComplete',
                                target: 'exercising',
                                actions: ['clearRest', 'moveToNextExercise'],
                            },
                            {
                                actions: 'tickRest',
                            },
                        ],
                        SKIP_REST: {
                            target: 'exercising',
                            actions: ['clearRest', 'moveToNextExercise'],
                        },
                        REST_COMPLETE: {
                            target: 'exercising',
                            actions: ['clearRest', 'moveToNextExercise'],
                        },
                    },
                },

                resting_round: {
                    description: 'Full rest after completing all exercises (90-120s typically)',
                    on: {
                        REST_TICK: [
                            {
                                guard: 'restComplete',
                                target: 'exercising',
                                actions: ['clearRest', 'startNextRound'],
                            },
                            {
                                actions: 'tickRest',
                            },
                        ],
                        SKIP_REST: {
                            target: 'exercising',
                            actions: ['clearRest', 'startNextRound'],
                        },
                        REST_COMPLETE: {
                            target: 'exercising',
                            actions: ['clearRest', 'startNextRound'],
                        },
                    },
                },
            },
            on: {
                CANCEL: {
                    target: 'idle',
                    actions: 'resetContext',
                },
            },
        },

        completed: {
            type: 'final',
        },
    },
});

// ============================================
// TYPE EXPORTS
// ============================================

export type SupersetMachine = typeof supersetMachine;

export type SupersetPhaseStatus =
    | 'idle'
    | 'exercising'
    | 'resting_between'
    | 'resting_round'
    | 'completed';

export function getSupersetStatus(state: { matches: (value: any) => boolean }): SupersetPhaseStatus {
    if (state.matches('idle')) return 'idle';
    if (state.matches({ active: 'exercising' })) return 'exercising';
    if (state.matches({ active: 'resting_between' })) return 'resting_between';
    if (state.matches({ active: 'resting_round' })) return 'resting_round';
    if (state.matches('completed')) return 'completed';
    return 'idle';
}

/**
 * Get the current exercise ID being performed
 */
export function getCurrentSupersetExercise(context: SupersetMachineContext): WorkoutExerciseId | null {
    return context.exerciseIds[context.currentExerciseIndex] ?? null;
}

/**
 * Get progress through the superset (0-1)
 */
export function getSupersetProgress(context: SupersetMachineContext): number {
    const totalSets = context.exerciseIds.length * context.maxRounds;
    const completedSets =
        ((context.currentRound - 1) * context.exerciseIds.length) + context.currentExerciseIndex;
    return totalSets > 0 ? completedSets / totalSets : 0;
}
