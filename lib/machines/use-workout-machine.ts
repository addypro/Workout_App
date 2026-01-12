/**
 * useWorkoutMachine Hook
 *
 * React hook that wraps the XState workout session machine.
 * Provides adapter pattern to maintain API compatibility with existing UI.
 */

import { useMachine } from '@xstate/react';
import { useCallback, useEffect, useRef } from 'react';
import type {
    WorkoutExercise,
    WorkoutSession,
    WorkoutSet,
} from '../types/workout-session';
import {
    getWorkoutStatus,
    workoutSessionMachine,
    type WorkoutMachineEvent,
    type WorkoutMachineStatus
} from './workout-session.machine';

// ============================================
// HOOK TYPES
// ============================================

export interface UseWorkoutMachineReturn {
    // State (compatible with existing UI expectations)
    session: WorkoutSession | null;
    status: WorkoutMachineStatus;
    isActive: boolean;
    isResting: boolean;
    isPaused: boolean;
    isFinished: boolean;
    restTimeRemaining: number;
    restExerciseIndex: number | null;
    restAfterSetIndex: number | null;

    // Derived state
    currentExercise: WorkoutExercise | null;
    currentSet: WorkoutSet | null;
    progress: {
        totalSets: number;
        completedSets: number;
        percentage: number;
    };

    // Actions
    startWorkout: (session: WorkoutSession) => void;
    completeSet: (
        exerciseIndex: number,
        setIndex: number,
        data?: { actualReps?: number; actualWeight?: number; rpe?: number }
    ) => void;
    startRest: (duration: number, exerciseIndex: number, setIndex: number) => void;
    skipRest: () => void;
    pause: () => void;
    resume: () => void;
    finish: () => void;
    cancel: () => void;

    // Exercise/Set management
    addExercise: (exercise: WorkoutExercise) => void;
    removeExercise: (exerciseIndex: number) => void;
    updateSet: (
        exerciseIndex: number,
        setIndex: number,
        updates: Partial<WorkoutSet>
    ) => void;
    addSet: (exerciseIndex: number) => void;
    removeSet: (exerciseIndex: number, setIndex: number) => void;

    // Low-level send for advanced use
    send: (event: WorkoutMachineEvent) => void;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useWorkoutMachine(): UseWorkoutMachineReturn {
    const [state, send] = useMachine(workoutSessionMachine);
    const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Manage rest timer ticks
    useEffect(() => {
        const isResting = state.matches({ active: 'resting' });

        if (isResting && !restTimerRef.current) {
            restTimerRef.current = setInterval(() => {
                send({ type: 'REST_TICK' });
            }, 1000);
        } else if (!isResting && restTimerRef.current) {
            clearInterval(restTimerRef.current);
            restTimerRef.current = null;
        }

        return () => {
            if (restTimerRef.current) {
                clearInterval(restTimerRef.current);
                restTimerRef.current = null;
            }
        };
    }, [state.value, send]);

    // Check for rest complete
    useEffect(() => {
        if (state.context.restTimeRemaining <= 0 && state.matches({ active: 'resting' })) {
            send({ type: 'REST_COMPLETE' });
        }
    }, [state.context.restTimeRemaining, state.value, send]);

    // Derived values
    const context = state.context;
    const session = context.session;
    const status = getWorkoutStatus(state);

    const currentExercise = session
        ? session.exercises[session.currentExerciseIndex] ?? null
        : null;

    const currentSet = currentExercise
        ? currentExercise.sets[currentExercise.currentSetIndex] ?? null
        : null;

    const progress = {
        totalSets: session
            ? session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
            : 0,
        completedSets: session
            ? session.exercises.reduce(
                (sum, ex) => sum + ex.sets.filter((s) => s.isCompleted).length,
                0
            )
            : 0,
        percentage: 0,
    };
    progress.percentage = progress.totalSets > 0
        ? (progress.completedSets / progress.totalSets) * 100
        : 0;

    // Actions
    const startWorkout = useCallback(
        (newSession: WorkoutSession) => {
            send({ type: 'START_WORKOUT', session: newSession });
        },
        [send]
    );

    const completeSet = useCallback(
        (
            exerciseIndex: number,
            setIndex: number,
            data?: { actualReps?: number; actualWeight?: number; rpe?: number }
        ) => {
            send({
                type: 'COMPLETE_SET',
                exerciseIndex,
                setIndex,
                ...data,
            });
        },
        [send]
    );

    const startRest = useCallback(
        (duration: number, exerciseIndex: number, setIndex: number) => {
            send({
                type: 'START_REST',
                duration,
                exerciseIndex,
                setIndex,
            });
        },
        [send]
    );

    const skipRest = useCallback(() => {
        send({ type: 'SKIP_REST' });
    }, [send]);

    const pause = useCallback(() => {
        send({ type: 'PAUSE' });
    }, [send]);

    const resume = useCallback(() => {
        send({ type: 'RESUME' });
    }, [send]);

    const finish = useCallback(() => {
        send({ type: 'FINISH_WORKOUT' });
    }, [send]);

    const cancel = useCallback(() => {
        send({ type: 'CANCEL_WORKOUT' });
    }, [send]);

    const addExercise = useCallback(
        (exercise: WorkoutExercise) => {
            send({ type: 'ADD_EXERCISE', exercise });
        },
        [send]
    );

    const removeExercise = useCallback(
        (exerciseIndex: number) => {
            send({ type: 'REMOVE_EXERCISE', exerciseIndex });
        },
        [send]
    );

    const updateSet = useCallback(
        (exerciseIndex: number, setIndex: number, updates: Partial<WorkoutSet>) => {
            send({ type: 'UPDATE_SET', exerciseIndex, setIndex, updates });
        },
        [send]
    );

    const addSet = useCallback(
        (exerciseIndex: number) => {
            send({ type: 'ADD_SET', exerciseIndex });
        },
        [send]
    );

    const removeSet = useCallback(
        (exerciseIndex: number, setIndex: number) => {
            send({ type: 'REMOVE_SET', exerciseIndex, setIndex });
        },
        [send]
    );

    return {
        // State
        session,
        status,
        isActive: state.matches('active'),
        isResting: state.matches({ active: 'resting' }),
        isPaused: state.matches('paused'),
        isFinished: state.matches('finished'),
        restTimeRemaining: context.restTimeRemaining,
        restExerciseIndex: context.restExerciseIndex,
        restAfterSetIndex: context.restAfterSetIndex,

        // Derived
        currentExercise,
        currentSet,
        progress,

        // Actions
        startWorkout,
        completeSet,
        startRest,
        skipRest,
        pause,
        resume,
        finish,
        cancel,

        // Exercise/Set management
        addExercise,
        removeExercise,
        updateSet,
        addSet,
        removeSet,

        // Low-level
        send,
    };
}

// ============================================
// ADAPTER HOOK
// ============================================

/**
 * Adapter hook that matches the existing session management pattern
 * used by the ActiveWorkoutScreen component.
 *
 * This provides drop-in compatibility with the existing API.
 */
export function useWorkoutSessionAdapter(): {
    session: WorkoutSession | null;
    setSession: (session: WorkoutSession | ((prev: WorkoutSession | null) => WorkoutSession)) => void;
    isResting: boolean;
    restTimeRemaining: number;
    startRest: (duration: number, exerciseIndex: number, setIndex: number) => void;
    skipRest: () => void;
} {
    const machine = useWorkoutMachine();

    // Create a setSession that matches React's setState pattern
    const setSession = useCallback(
        (
            update: WorkoutSession | ((prev: WorkoutSession | null) => WorkoutSession)
        ) => {
            const newSession =
                typeof update === 'function' ? update(machine.session) : update;

            if (!machine.session) {
                // Starting new workout
                machine.startWorkout(newSession);
            } else {
                // For complex updates, we need to sync the machine
                // This is a simplified adapter - full implementation would
                // map all state changes to appropriate events
                machine.send({ type: 'START_WORKOUT', session: newSession });
            }
        },
        [machine]
    );

    return {
        session: machine.session,
        setSession,
        isResting: machine.isResting,
        restTimeRemaining: machine.restTimeRemaining,
        startRest: machine.startRest,
        skipRest: machine.skipRest,
    };
}
