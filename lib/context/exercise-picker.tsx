/**
 * Exercise Picker Context
 * Manages the state for selecting exercises from the database
 * Used when adding exercises to workouts/programs
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ExerciseDatabaseEntry } from '@/lib/services/exercise/database';

export type ExercisePickerCallback = (exercise: ExerciseDatabaseEntry) => void;

interface ExercisePickerState {
  isActive: boolean;
  callback: ExercisePickerCallback | null;
  context?: {
    workoutIndex?: number;
    exerciseIndex?: number;
    source?: string;
  };
}

interface ExercisePickerContextValue {
  state: ExercisePickerState;
  openPicker: (callback: ExercisePickerCallback, context?: ExercisePickerState['context']) => void;
  selectExercise: (exercise: ExerciseDatabaseEntry) => void;
  closePicker: () => void;
}

const ExercisePickerContext = createContext<ExercisePickerContextValue | null>(null);

export function ExercisePickerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ExercisePickerState>({
    isActive: false,
    callback: null,
  });

  const openPicker = useCallback((callback: ExercisePickerCallback, context?: ExercisePickerState['context']) => {
    setState({
      isActive: true,
      callback,
      context,
    });
  }, []);

  const selectExercise = useCallback((exercise: ExerciseDatabaseEntry) => {
    if (state.callback) {
      state.callback(exercise);
    }
    setState({
      isActive: false,
      callback: null,
    });
  }, [state.callback]);

  const closePicker = useCallback(() => {
    setState({
      isActive: false,
      callback: null,
    });
  }, []);

  return (
    <ExercisePickerContext.Provider value={{ state, openPicker, selectExercise, closePicker }}>
      {children}
    </ExercisePickerContext.Provider>
  );
}

export function useExercisePicker() {
  const context = useContext(ExercisePickerContext);
  if (!context) {
    throw new Error('useExercisePicker must be used within ExercisePickerProvider');
  }
  return context;
}

