/**
 * useInlineRestTimer Hook
 * 
 * React hook for managing inline rest timer state.
 * Designed for use between sets in workout screens.
 * 
 * Features:
 * - Start/pause/resume/skip timer
 * - Adjust duration by +/- 15 seconds
 * - Direct duration input
 * - Reset to full duration (for uncheck-resume flow)
 */

import { formatRestTime } from '@/lib/machines/rest-timer.actor';
import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================
// TYPES
// ============================================

export type InlineRestTimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface UseInlineRestTimerOptions {
    /** Initial duration in seconds */
    initialDuration: number;
    /** Callback when timer completes */
    onComplete?: () => void;
    /** Auto-start when mounted */
    autoStart?: boolean;
    /** Minimum allowed duration */
    minDuration?: number;
    /** Maximum allowed duration */
    maxDuration?: number;
}

export interface UseInlineRestTimerReturn {
    /** Current timer status */
    status: InlineRestTimerStatus;
    /** Remaining seconds */
    remaining: number;
    /** Formatted time string (MM:SS) */
    formatted: string;
    /** Current configured duration */
    duration: number;
    /** Progress (0-1, 1 = just started, 0 = complete) */
    progress: number;
    /** Start the timer from idle or resume from paused */
    start: () => void;
    /** Pause the running timer */
    pause: () => void;
    /** Resume from pause */
    resume: () => void;
    /** Skip remaining time and mark complete */
    skip: () => void;
    /** Adjust duration by delta (e.g., +15 or -15 seconds) */
    adjustDuration: (delta: number) => void;
    /** Set exact duration */
    setDuration: (value: number) => void;
    /** Reset timer to full duration (for uncheck-resume) */
    reset: () => void;
    /** Check if timer can be adjusted */
    canAdjust: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_MIN_DURATION = 5;   // 5 seconds minimum
const DEFAULT_MAX_DURATION = 600; // 10 minutes maximum
const ADJUSTMENT_STEP = 15;       // +/- 15 seconds

// ============================================
// HOOK
// ============================================

export function useInlineRestTimer(
    options: UseInlineRestTimerOptions
): UseInlineRestTimerReturn {
    const {
        initialDuration,
        onComplete,
        autoStart = false,
        minDuration = DEFAULT_MIN_DURATION,
        maxDuration = DEFAULT_MAX_DURATION,
    } = options;

    // State
    const [status, setStatus] = useState<InlineRestTimerStatus>(autoStart ? 'running' : 'idle');
    const [remaining, setRemaining] = useState(initialDuration);
    const [duration, setDurationState] = useState(initialDuration);

    // Refs for stable callbacks
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    // Timer tick logic
    useEffect(() => {
        if (status === 'running') {
            intervalRef.current = setInterval(() => {
                setRemaining((prev) => {
                    const next = prev - 1;
                    if (next <= 0) {
                        if (intervalRef.current) {
                            clearInterval(intervalRef.current);
                            intervalRef.current = null;
                        }
                        setStatus('completed');
                        onCompleteRef.current?.();
                        return 0;
                    }
                    return next;
                });
            }, 1000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [status]);

    // Actions
    const start = useCallback(() => {
        if (status === 'idle' || status === 'paused') {
            setStatus('running');
        }
    }, [status]);

    const pause = useCallback(() => {
        if (status === 'running') {
            setStatus('paused');
        }
    }, [status]);

    const resume = useCallback(() => {
        if (status === 'paused') {
            setStatus('running');
        }
    }, [status]);

    const skip = useCallback(() => {
        setRemaining(0);
        setStatus('completed');
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        onCompleteRef.current?.();
    }, []);

    const adjustDuration = useCallback((delta: number) => {
        setDurationState((prev) => {
            const next = Math.max(minDuration, Math.min(maxDuration, prev + delta));
            return next;
        });
        // Also adjust remaining if timer is running or paused
        setRemaining((prev) => {
            const next = Math.max(0, prev + delta);
            return next;
        });
    }, [minDuration, maxDuration]);

    const setDuration = useCallback((value: number) => {
        const clamped = Math.max(minDuration, Math.min(maxDuration, value));
        setDurationState(clamped);
        // Always reset remaining to the new duration
        setRemaining(clamped);
        // If completed, reset to idle so timer can be used again
        if (status === 'completed') {
            setStatus('idle');
        }
    }, [minDuration, maxDuration, status]);

    const reset = useCallback(() => {
        setRemaining(duration);
        setStatus('idle');
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, [duration]);

    // Computed values
    const formatted = formatRestTime(remaining);
    const progress = duration > 0 ? remaining / duration : 0;
    const canAdjust = status === 'idle' || status === 'running' || status === 'paused';

    return {
        status,
        remaining,
        formatted,
        duration,
        progress,
        start,
        pause,
        resume,
        skip,
        adjustDuration,
        setDuration,
        reset,
        canAdjust,
    };
}

// ============================================
// UTILITY
// ============================================

/**
 * Get default rest duration based on exercise type
 */
export function getDefaultRestDuration(exerciseType?: string): number {
    if (!exerciseType) return 60;

    const type = exerciseType.toLowerCase();

    // Compound movements get longer rest
    if (type.includes('squat') || type.includes('deadlift') || type.includes('bench')) {
        return 180; // 3 minutes
    }
    if (type.includes('row') || type.includes('press') || type.includes('pull')) {
        return 90; // 1.5 minutes
    }
    if (type.includes('curl') || type.includes('extension') || type.includes('fly')) {
        return 60; // 1 minute
    }
    if (type.includes('crunch') || type.includes('plank') || type.includes('ab')) {
        return 30; // 30 seconds
    }

    return 60; // Default 1 minute
}
