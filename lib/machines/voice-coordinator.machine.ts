/**
 * Voice Coordinator XState Machine
 *
 * Formalizes the voice-to-workout pipeline with explicit state transitions.
 * Eliminates impossible states through type-safe statechart definition.
 *
 * States:
 * - idle: Ready to start recording
 * - recording
 *   - listening: Active recording with interim results
 *   - finalizing: Processing final audio
 * - processing
 *   - parsing: Running exercise parser
 *   - clarifying: Waiting for user clarification
 * - error: Recoverable error state
 */

import { assign, setup, type ActorRefFrom } from 'xstate';
import type { ClarificationRequest, VoiceParseResult } from '../services/voice/types';

// ============================================
// CONTEXT
// ============================================

export interface VoiceCoordinatorContext {
    interimTranscript: string;
    finalTranscript: string;
    parseResult: VoiceParseResult | null;
    clarificationRequest: ClarificationRequest | null;
    errorMessage: string | null;
    selectedEngine: 'native' | 'whisper';
}

// ============================================
// EVENTS
// ============================================

export type VoiceCoordinatorEvent =
    | { type: 'START_RECORDING' }
    | { type: 'INTERIM_RESULT'; text: string }
    | { type: 'FINAL_RESULT'; transcript: string; confidence: number }
    | { type: 'STOP_RECORDING' }
    | { type: 'CANCEL' }
    | { type: 'PARSE_COMPLETE'; result: VoiceParseResult }
    | { type: 'CLARIFICATION_NEEDED'; request: ClarificationRequest }
    | { type: 'CLARIFICATION_SELECTED'; optionId: string }
    | { type: 'DISMISS_CLARIFICATION' }
    | { type: 'ERROR'; message: string }
    | { type: 'RETRY' }
    | { type: 'RESET' };

// ============================================
// MACHINE
// ============================================

export const voiceCoordinatorMachine = setup({
    types: {
        context: {} as VoiceCoordinatorContext,
        events: {} as VoiceCoordinatorEvent,
    },
    actions: {
        updateInterimTranscript: assign(({ event }) => {
            if (event.type !== 'INTERIM_RESULT') return {};
            return { interimTranscript: event.text };
        }),

        setFinalTranscript: assign(({ event }) => {
            if (event.type !== 'FINAL_RESULT') return {};
            return {
                finalTranscript: event.transcript,
                interimTranscript: '', // Clear interim
            };
        }),

        setParseResult: assign(({ event }) => {
            if (event.type !== 'PARSE_COMPLETE') return {};
            return {
                parseResult: event.result,
                clarificationRequest: null,
            };
        }),

        setClarificationRequest: assign(({ event }) => {
            if (event.type !== 'CLARIFICATION_NEEDED') return {};
            return { clarificationRequest: event.request };
        }),

        clearClarification: assign({
            clarificationRequest: null,
        }),

        setError: assign(({ event }) => {
            if (event.type !== 'ERROR') return {};
            return { errorMessage: event.message };
        }),

        clearError: assign({
            errorMessage: null,
        }),

        resetContext: assign({
            interimTranscript: '',
            finalTranscript: '',
            parseResult: null,
            clarificationRequest: null,
            errorMessage: null,
        }),
    },
    guards: {
        hasTranscript: ({ context }) => context.finalTranscript.length > 0,
        parseSucceeded: ({ event }) => {
            if (event.type !== 'PARSE_COMPLETE') return false;
            return event.result.success === true;
        },
        needsClarification: ({ event }) => {
            if (event.type !== 'PARSE_COMPLETE') return false;
            return event.result.success === false;
        },
    },
}).createMachine({
    id: 'voiceCoordinator',
    initial: 'idle',
    context: {
        interimTranscript: '',
        finalTranscript: '',
        parseResult: null,
        clarificationRequest: null,
        errorMessage: null,
        selectedEngine: 'native',
    },
    states: {
        idle: {
            on: {
                START_RECORDING: {
                    target: 'recording.listening',
                    actions: 'resetContext',
                },
            },
        },

        recording: {
            initial: 'listening',
            states: {
                listening: {
                    on: {
                        INTERIM_RESULT: {
                            actions: 'updateInterimTranscript',
                        },
                        FINAL_RESULT: {
                            target: 'finalizing',
                            actions: 'setFinalTranscript',
                        },
                        STOP_RECORDING: 'finalizing',
                    },
                },
                finalizing: {
                    always: [
                        {
                            guard: 'hasTranscript',
                            target: '#voiceCoordinator.processing.parsing',
                        },
                        {
                            target: '#voiceCoordinator.idle',
                        },
                    ],
                },
            },
            on: {
                CANCEL: {
                    target: 'idle',
                    actions: 'resetContext',
                },
                ERROR: {
                    target: 'error',
                    actions: 'setError',
                },
            },
        },

        processing: {
            initial: 'parsing',
            states: {
                parsing: {
                    on: {
                        PARSE_COMPLETE: [
                            {
                                guard: 'parseSucceeded',
                                target: '#voiceCoordinator.idle',
                                actions: 'setParseResult',
                            },
                            {
                                target: 'clarifying',
                                actions: 'setParseResult',
                            },
                        ],
                        CLARIFICATION_NEEDED: {
                            target: 'clarifying',
                            actions: 'setClarificationRequest',
                        },
                    },
                },
                clarifying: {
                    on: {
                        CLARIFICATION_SELECTED: {
                            target: 'parsing',
                            actions: 'clearClarification',
                        },
                        DISMISS_CLARIFICATION: {
                            target: '#voiceCoordinator.idle',
                            actions: 'clearClarification',
                        },
                    },
                },
            },
            on: {
                CANCEL: {
                    target: 'idle',
                    actions: 'resetContext',
                },
                ERROR: {
                    target: 'error',
                    actions: 'setError',
                },
            },
        },

        error: {
            on: {
                RETRY: {
                    target: 'idle',
                    actions: 'clearError',
                },
                RESET: {
                    target: 'idle',
                    actions: 'resetContext',
                },
            },
        },
    },
});

// ============================================
// TYPE EXPORTS
// ============================================

export type VoiceCoordinatorMachine = typeof voiceCoordinatorMachine;
export type VoiceCoordinatorActor = ActorRefFrom<typeof voiceCoordinatorMachine>;

export type VoiceCoordinatorStatus =
    | 'idle'
    | 'recording.listening'
    | 'recording.finalizing'
    | 'processing.parsing'
    | 'processing.clarifying'
    | 'error';

export function getVoiceStatus(state: { matches: (value: any) => boolean }): VoiceCoordinatorStatus {
    if (state.matches('idle')) return 'idle';
    if (state.matches({ recording: 'listening' })) return 'recording.listening';
    if (state.matches({ recording: 'finalizing' })) return 'recording.finalizing';
    if (state.matches({ processing: 'parsing' })) return 'processing.parsing';
    if (state.matches({ processing: 'clarifying' })) return 'processing.clarifying';
    if (state.matches('error')) return 'error';
    return 'idle';
}
