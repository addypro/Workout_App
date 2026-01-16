/**
 * Workout Machine Provider
 * 
 * React context that provides the XState workout machine to components.
 * Uses parallel run strategy - machine runs alongside existing useState
 * for gradual migration.
 */

import { useWorkoutMachine, type UseWorkoutMachineReturn } from '@/lib/machines';
import React, { createContext, useContext, useMemo, type ReactNode } from 'react';

// ============================================
// CONTEXT
// ============================================

const WorkoutMachineContext = createContext<UseWorkoutMachineReturn | null>(null);

// ============================================
// PROVIDER
// ============================================

interface WorkoutMachineProviderProps {
    children: ReactNode;
}

export function WorkoutMachineProvider({ children }: WorkoutMachineProviderProps) {
    const machine = useWorkoutMachine();

    return (
        <WorkoutMachineContext.Provider value={machine}>
            {children}
        </WorkoutMachineContext.Provider>
    );
}

// ============================================
// HOOK
// ============================================

/**
 * Hook to access the workout machine from any component.
 * Throws if used outside of WorkoutMachineProvider.
 */
export function useWorkoutMachineContext(): UseWorkoutMachineReturn {
    const context = useContext(WorkoutMachineContext);
    if (!context) {
        throw new Error('useWorkoutMachineContext must be used within a WorkoutMachineProvider');
    }
    return context;
}

/**
 * Optional hook - returns null if not inside provider.
 * Use this for components that may or may not have machine access.
 */
export function useOptionalWorkoutMachine(): UseWorkoutMachineReturn | null {
    return useContext(WorkoutMachineContext);
}
