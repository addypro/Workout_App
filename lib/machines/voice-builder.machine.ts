/**
 * Voice Workout Builder State Machine
 * 
 * Manages real-time voice recording, exercise extraction, and UI state
 * for the streaming voice workout builder.
 */

import { assign, createMachine } from 'xstate';

// ============================================
// TYPES
// ============================================

export type ExerciseStatus =
    | 'pending'      // Being extracted
    | 'resolved'     // Matched, awaiting confirmation
    | 'confirmed'    // User confirmed
    | 'edited';      // User edited

export interface StreamingExercise {
    id: string;
    rawName: string;
    resolvedName: string;
    confidence: number;
    status: ExerciseStatus;
    sets: number;
    reps: string;
    weight: number | null;
    weightUnit: 'lbs' | 'kg';
    alternatives: Array<{ name: string; score: number }>;
}

export interface VoiceBuilderContext {
    exercises: StreamingExercise[];
    currentTranscription: string;
    fullTranscription: string;
    pendingChunks: string[];
    editingExerciseId: string | null;
    error: string | null;
}

export type VoiceBuilderEvent =
    | { type: 'START_RECORDING' }
    | { type: 'PAUSE_RECORDING' }
    | { type: 'RESUME_RECORDING' }
    | { type: 'STOP_RECORDING' }
    | { type: 'TRANSCRIPTION_UPDATE'; text: string }
    | { type: 'CHUNK_READY'; chunk: string }
    | { type: 'EXERCISE_EXTRACTED'; exercises: StreamingExercise[] }
    | { type: 'EXERCISE_RESOLVED'; exerciseId: string; resolvedName: string; confidence: number; alternatives: Array<{ name: string; score: number }> }
    | { type: 'CONFIRM_EXERCISE'; exerciseId: string }
    | { type: 'EDIT_EXERCISE'; exerciseId: string }
    | { type: 'UPDATE_EXERCISE'; exerciseId: string; updates: Partial<StreamingExercise> }
    | { type: 'DELETE_EXERCISE'; exerciseId: string }
    | { type: 'CLOSE_EDIT' }
    | { type: 'FINISH_WORKOUT' }
    | { type: 'ERROR'; message: string }
    | { type: 'CLEAR_ERROR' };

// ============================================
// INITIAL CONTEXT
// ============================================

const initialContext: VoiceBuilderContext = {
    exercises: [],
    currentTranscription: '',
    fullTranscription: '',
    pendingChunks: [],
    editingExerciseId: null,
    error: null,
};

// ============================================
// STATE MACHINE
// ============================================

export const voiceBuilderMachine = createMachine({
    id: 'voiceBuilder',
    initial: 'idle',
    context: initialContext,

    states: {
        idle: {
            on: {
                START_RECORDING: {
                    target: 'recording',
                },
            },
        },

        recording: {
            on: {
                TRANSCRIPTION_UPDATE: {
                    actions: assign({
                        currentTranscription: ({ event }) => event.text,
                    }),
                },

                CHUNK_READY: {
                    actions: assign({
                        pendingChunks: ({ context, event }) => [...context.pendingChunks, event.chunk],
                        fullTranscription: ({ context, event }) =>
                            context.fullTranscription + (context.fullTranscription ? ' ' : '') + event.chunk,
                    }),
                },

                EXERCISE_EXTRACTED: {
                    actions: assign({
                        exercises: ({ context, event }) => [...context.exercises, ...event.exercises],
                        pendingChunks: () => [],
                    }),
                },

                EXERCISE_RESOLVED: {
                    actions: assign({
                        exercises: ({ context, event }) =>
                            context.exercises.map(ex =>
                                ex.id === event.exerciseId
                                    ? {
                                        ...ex,
                                        resolvedName: event.resolvedName,
                                        confidence: event.confidence,
                                        alternatives: event.alternatives,
                                        status: 'resolved' as ExerciseStatus,
                                    }
                                    : ex
                            ),
                    }),
                },

                PAUSE_RECORDING: {
                    target: 'paused',
                },

                STOP_RECORDING: {
                    target: 'reviewing',
                },

                // Allow editing while recording
                EDIT_EXERCISE: {
                    actions: assign({
                        editingExerciseId: ({ event }) => event.exerciseId,
                    }),
                },

                CLOSE_EDIT: {
                    actions: assign({
                        editingExerciseId: () => null,
                    }),
                },

                CONFIRM_EXERCISE: {
                    actions: assign({
                        exercises: ({ context, event }) =>
                            context.exercises.map(ex =>
                                ex.id === event.exerciseId
                                    ? { ...ex, status: 'confirmed' as ExerciseStatus }
                                    : ex
                            ),
                    }),
                },

                UPDATE_EXERCISE: {
                    actions: assign({
                        exercises: ({ context, event }) =>
                            context.exercises.map(ex =>
                                ex.id === event.exerciseId
                                    ? { ...ex, ...event.updates, status: 'edited' as ExerciseStatus }
                                    : ex
                            ),
                    }),
                },

                DELETE_EXERCISE: {
                    actions: assign({
                        exercises: ({ context, event }) =>
                            context.exercises.filter(ex => ex.id !== event.exerciseId),
                    }),
                },

                ERROR: {
                    actions: assign({
                        error: ({ event }) => event.message,
                    }),
                },
            },
        },

        paused: {
            on: {
                RESUME_RECORDING: {
                    target: 'recording',
                },

                STOP_RECORDING: {
                    target: 'reviewing',
                },

                // All editing actions available in paused state
                EDIT_EXERCISE: {
                    actions: assign({
                        editingExerciseId: ({ event }) => event.exerciseId,
                    }),
                },

                CLOSE_EDIT: {
                    actions: assign({
                        editingExerciseId: () => null,
                    }),
                },

                CONFIRM_EXERCISE: {
                    actions: assign({
                        exercises: ({ context, event }) =>
                            context.exercises.map(ex =>
                                ex.id === event.exerciseId
                                    ? { ...ex, status: 'confirmed' as ExerciseStatus }
                                    : ex
                            ),
                    }),
                },

                UPDATE_EXERCISE: {
                    actions: assign({
                        exercises: ({ context, event }) =>
                            context.exercises.map(ex =>
                                ex.id === event.exerciseId
                                    ? { ...ex, ...event.updates, status: 'edited' as ExerciseStatus }
                                    : ex
                            ),
                    }),
                },

                DELETE_EXERCISE: {
                    actions: assign({
                        exercises: ({ context, event }) =>
                            context.exercises.filter(ex => ex.id !== event.exerciseId),
                    }),
                },
            },
        },

        reviewing: {
            on: {
                EDIT_EXERCISE: {
                    actions: assign({
                        editingExerciseId: ({ event }) => event.exerciseId,
                    }),
                },

                CLOSE_EDIT: {
                    actions: assign({
                        editingExerciseId: () => null,
                    }),
                },

                CONFIRM_EXERCISE: {
                    actions: assign({
                        exercises: ({ context, event }) =>
                            context.exercises.map(ex =>
                                ex.id === event.exerciseId
                                    ? { ...ex, status: 'confirmed' as ExerciseStatus }
                                    : ex
                            ),
                    }),
                },

                UPDATE_EXERCISE: {
                    actions: assign({
                        exercises: ({ context, event }) =>
                            context.exercises.map(ex =>
                                ex.id === event.exerciseId
                                    ? { ...ex, ...event.updates, status: 'edited' as ExerciseStatus }
                                    : ex
                            ),
                    }),
                },

                DELETE_EXERCISE: {
                    actions: assign({
                        exercises: ({ context, event }) =>
                            context.exercises.filter(ex => ex.id !== event.exerciseId),
                    }),
                },

                START_RECORDING: {
                    target: 'recording',
                },

                FINISH_WORKOUT: {
                    target: 'finished',
                },
            },
        },

        finished: {
            type: 'final',
        },
    },

    on: {
        CLEAR_ERROR: {
            actions: assign({
                error: () => null,
            }),
        },
    },
});

// ============================================
// HELPER FUNCTIONS
// ============================================

export function createStreamingExercise(
    rawName: string,
    sets: number = 3,
    reps: string = '10',
    weight: number | null = null,
): StreamingExercise {
    return {
        id: `ex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        rawName,
        resolvedName: rawName,
        confidence: 0,
        status: 'pending',
        sets,
        reps,
        weight,
        weightUnit: 'lbs',
        alternatives: [],
    };
}

export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 90) return 'high';
    if (confidence >= 70) return 'medium';
    return 'low';
}

export function isExerciseConfirmed(exercise: StreamingExercise): boolean {
    return exercise.status === 'confirmed' || exercise.status === 'edited';
}
