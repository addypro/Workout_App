/**
 * Rest Timer Actor
 *
 * XState actor for managing rest timer with proper integration into workout machine.
 * Spawned as a child actor during resting state for clean lifecycle management.
 */

import { fromCallback } from 'xstate';

// ============================================
// TYPES
// ============================================

export interface RestTimerInput {
    duration: number; // seconds
    onTick?: (remaining: number) => void;
    onComplete?: () => void;
}

export type RestTimerEvent =
    | { type: 'TICK'; remaining: number }
    | { type: 'PAUSE' }
    | { type: 'RESUME' }
    | { type: 'SKIP' }
    | { type: 'COMPLETE' };

// ============================================
// REST TIMER ACTOR (Callback-based)
// ============================================

/**
 * Creates a rest timer actor that emits TICK events every second.
 * 
 * Usage in XState machine:
 * ```typescript
 * resting: {
 *   invoke: {
 *     src: restTimerActor,
 *     input: ({ context }) => ({
 *       duration: context.restTimeRemaining
 *     }),
 *   },
 *   on: {
 *     TICK: { actions: 'updateRestTime' },
 *     COMPLETE: { target: 'exercising' },
 *   }
 * }
 * ```
 */
export const restTimerActor = fromCallback<RestTimerEvent, RestTimerInput>(
    ({ sendBack, input, receive }) => {
        let remaining = input.duration;
        let isPaused = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const tick = () => {
            if (isPaused) return;

            remaining -= 1;
            sendBack({ type: 'TICK', remaining });
            input.onTick?.(remaining);

            if (remaining <= 0) {
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
                sendBack({ type: 'COMPLETE' });
                input.onComplete?.();
            }
        };

        // Start the timer
        intervalId = setInterval(tick, 1000);

        // Initial tick immediately (so UI shows correct starting value)
        sendBack({ type: 'TICK', remaining });

        // Handle incoming events
        receive((event) => {
            switch (event.type) {
                case 'PAUSE':
                    isPaused = true;
                    break;
                case 'RESUME':
                    isPaused = false;
                    break;
                case 'SKIP':
                    remaining = 0;
                    if (intervalId) {
                        clearInterval(intervalId);
                        intervalId = null;
                    }
                    sendBack({ type: 'COMPLETE' });
                    input.onComplete?.();
                    break;
            }
        });

        // Cleanup function
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };
    }
);

// ============================================
// COUNTDOWN ACTOR (Promise-based)
// ============================================

/**
 * Simple countdown that resolves after duration.
 * Good for non-interactive countdowns.
 */
export const countdownActor = fromCallback<{ type: 'DONE' }, { duration: number }>(
    ({ sendBack, input }) => {
        const timeout = setTimeout(() => {
            sendBack({ type: 'DONE' });
        }, input.duration * 1000);

        return () => clearTimeout(timeout);
    }
);

// ============================================
// FORMATTERS
// ============================================

/**
 * Format seconds as MM:SS
 */
export function formatRestTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format seconds as descriptive text
 */
export function formatRestTimeVerbose(seconds: number): string {
    if (seconds < 60) {
        return `${seconds} seconds`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (secs === 0) {
        return `${mins} minute${mins > 1 ? 's' : ''}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// REST TIME PRESETS
// ============================================

export const REST_PRESETS = {
    short: 30,
    medium: 60,
    long: 90,
    extended: 120,
    strength: 180,
} as const;

export type RestPreset = keyof typeof REST_PRESETS;

/**
 * Get recommended rest time based on exercise type
 */
export function getRecommendedRest(exerciseType: string): number {
    const type = exerciseType.toLowerCase();

    if (type.includes('deadlift') || type.includes('squat') || type.includes('bench')) {
        return REST_PRESETS.strength; // 3 min for compound movements
    }
    if (type.includes('row') || type.includes('press') || type.includes('pull')) {
        return REST_PRESETS.long; // 90s for major compound
    }
    if (type.includes('curl') || type.includes('extension') || type.includes('fly')) {
        return REST_PRESETS.medium; // 60s for isolation
    }
    if (type.includes('crunch') || type.includes('plank') || type.includes('ab')) {
        return REST_PRESETS.short; // 30s for abs
    }

    return REST_PRESETS.medium; // Default 60s
}
