/**
 * Program Import Context
 *
 * Manages the multi-step import flow state:
 * 1. File Selection
 * 2. Extracting (AI parsing)
 * 3. Review (human-in-the-loop verification)
 * 4. Saving
 */

import React, { createContext, useCallback, useContext, useReducer } from 'react';
import type { ParsedProgram, ParsedExercise, ExerciseMatch } from '@/lib/types/program';

// ============================================
// TYPES
// ============================================

export type ImportStep = 'idle' | 'extracting' | 'review' | 'saving' | 'complete' | 'error';

export interface UnmatchedExercise {
  /** Original name from the source file */
  originalName: string;
  /** Week/Day location for context */
  location: { week: number; day: number };
  /** Suggested matches from database */
  suggestions: ExerciseMatch[];
  /** User's selected match (null if pending) */
  selectedMatch: string | null;
  /** Flag to create as custom exercise */
  createAsCustom: boolean;
}

export interface ImportProgress {
  stage: string;
  percent: number;
  message?: string;
}

export interface ImportState {
  step: ImportStep;

  // File info
  sourceFile: {
    name: string;
    uri: string;
    type: 'csv' | 'excel' | 'pdf' | 'image';
    size?: number;
  } | null;

  // Extraction result
  extractedProgram: ParsedProgram | null;

  // Exercise matching
  unmatchedExercises: UnmatchedExercise[];
  matchStats: {
    total: number;
    matched: number;
    unmatched: number;
    pending: number;
  };

  // Progress tracking
  progress: ImportProgress;

  // User-editable fields
  programName: string;
  programDescription: string;

  // Error state
  error: string | null;
  warnings: string[];
}

type ImportAction =
  | { type: 'START_IMPORT'; payload: { file: ImportState['sourceFile'] } }
  | { type: 'SET_PROGRESS'; payload: ImportProgress }
  | { type: 'EXTRACTION_SUCCESS'; payload: { program: ParsedProgram; unmatched: UnmatchedExercise[]; warnings?: string[] } }
  | { type: 'EXTRACTION_FAILED'; payload: { error: string } }
  | { type: 'UPDATE_EXERCISE_MATCH'; payload: { originalName: string; selectedMatch: string | null; createAsCustom?: boolean } }
  | { type: 'UPDATE_PROGRAM_INFO'; payload: { name?: string; description?: string } }
  | { type: 'START_SAVE' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_FAILED'; payload: { error: string } }
  | { type: 'RESET' };

// ============================================
// INITIAL STATE
// ============================================

const initialState: ImportState = {
  step: 'idle',
  sourceFile: null,
  extractedProgram: null,
  unmatchedExercises: [],
  matchStats: { total: 0, matched: 0, unmatched: 0, pending: 0 },
  progress: { stage: '', percent: 0 },
  programName: '',
  programDescription: '',
  error: null,
  warnings: [],
};

// ============================================
// REDUCER
// ============================================

function importReducer(state: ImportState, action: ImportAction): ImportState {
  switch (action.type) {
    case 'START_IMPORT':
      return {
        ...initialState,
        step: 'extracting',
        sourceFile: action.payload.file,
        programName: action.payload.file?.name?.replace(/\.(csv|xlsx?|pdf|png|jpg|jpeg)$/i, '') || 'Imported Program',
        progress: { stage: 'Starting...', percent: 0 },
      };

    case 'SET_PROGRESS':
      return {
        ...state,
        progress: action.payload,
      };

    case 'EXTRACTION_SUCCESS': {
      const { program, unmatched, warnings } = action.payload;
      const pending = unmatched.filter(u => !u.selectedMatch && !u.createAsCustom).length;

      return {
        ...state,
        step: 'review',
        extractedProgram: program,
        unmatchedExercises: unmatched,
        matchStats: {
          total: countTotalExercises(program),
          matched: countTotalExercises(program) - unmatched.length,
          unmatched: unmatched.length,
          pending,
        },
        warnings: warnings || [],
        progress: { stage: 'Complete', percent: 100 },
      };
    }

    case 'EXTRACTION_FAILED':
      return {
        ...state,
        step: 'error',
        error: action.payload.error,
        progress: { stage: 'Failed', percent: 0 },
      };

    case 'UPDATE_EXERCISE_MATCH': {
      const { originalName, selectedMatch, createAsCustom } = action.payload;
      const updated = state.unmatchedExercises.map(ex =>
        ex.originalName === originalName
          ? { ...ex, selectedMatch, createAsCustom: createAsCustom ?? false }
          : ex
      );
      const pending = updated.filter(u => !u.selectedMatch && !u.createAsCustom).length;

      return {
        ...state,
        unmatchedExercises: updated,
        matchStats: {
          ...state.matchStats,
          pending,
        },
      };
    }

    case 'UPDATE_PROGRAM_INFO':
      return {
        ...state,
        programName: action.payload.name ?? state.programName,
        programDescription: action.payload.description ?? state.programDescription,
      };

    case 'START_SAVE':
      return {
        ...state,
        step: 'saving',
        progress: { stage: 'Saving program...', percent: 50 },
      };

    case 'SAVE_SUCCESS':
      return {
        ...state,
        step: 'complete',
        progress: { stage: 'Saved!', percent: 100 },
      };

    case 'SAVE_FAILED':
      return {
        ...state,
        step: 'error',
        error: action.payload.error,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ============================================
// HELPERS
// ============================================

function countTotalExercises(program: ParsedProgram): number {
  return program.workouts.reduce((sum, w) => sum + w.exercises.length, 0);
}

// ============================================
// CONTEXT
// ============================================

interface ImportContextValue {
  state: ImportState;

  // Actions
  startImport: (file: ImportState['sourceFile']) => void;
  setProgress: (progress: ImportProgress) => void;
  onExtractionSuccess: (program: ParsedProgram, unmatched: UnmatchedExercise[], warnings?: string[]) => void;
  onExtractionFailed: (error: string) => void;
  updateExerciseMatch: (originalName: string, selectedMatch: string | null, createAsCustom?: boolean) => void;
  updateProgramInfo: (info: { name?: string; description?: string }) => void;
  startSave: () => void;
  onSaveSuccess: () => void;
  onSaveFailed: (error: string) => void;
  reset: () => void;

  // Computed
  canProceedToSave: boolean;
  applyMatchesToProgram: () => ParsedProgram | null;
}

const ImportContext = createContext<ImportContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

export function ProgramImportProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(importReducer, initialState);

  const startImport = useCallback((file: ImportState['sourceFile']) => {
    dispatch({ type: 'START_IMPORT', payload: { file } });
  }, []);

  const setProgress = useCallback((progress: ImportProgress) => {
    dispatch({ type: 'SET_PROGRESS', payload: progress });
  }, []);

  const onExtractionSuccess = useCallback((
    program: ParsedProgram,
    unmatched: UnmatchedExercise[],
    warnings?: string[]
  ) => {
    dispatch({ type: 'EXTRACTION_SUCCESS', payload: { program, unmatched, warnings } });
  }, []);

  const onExtractionFailed = useCallback((error: string) => {
    dispatch({ type: 'EXTRACTION_FAILED', payload: { error } });
  }, []);

  const updateExerciseMatch = useCallback((
    originalName: string,
    selectedMatch: string | null,
    createAsCustom?: boolean
  ) => {
    dispatch({ type: 'UPDATE_EXERCISE_MATCH', payload: { originalName, selectedMatch, createAsCustom } });
  }, []);

  const updateProgramInfo = useCallback((info: { name?: string; description?: string }) => {
    dispatch({ type: 'UPDATE_PROGRAM_INFO', payload: info });
  }, []);

  const startSave = useCallback(() => {
    dispatch({ type: 'START_SAVE' });
  }, []);

  const onSaveSuccess = useCallback(() => {
    dispatch({ type: 'SAVE_SUCCESS' });
  }, []);

  const onSaveFailed = useCallback((error: string) => {
    dispatch({ type: 'SAVE_FAILED', payload: { error } });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Can proceed when all unmatched exercises have been resolved
  const canProceedToSave = state.matchStats.pending === 0 && state.step === 'review';

  // Apply user's match selections to the extracted program
  const applyMatchesToProgram = useCallback((): ParsedProgram | null => {
    if (!state.extractedProgram) return null;

    const matchMap = new Map<string, string>();
    for (const unmatched of state.unmatchedExercises) {
      if (unmatched.selectedMatch) {
        matchMap.set(unmatched.originalName.toLowerCase(), unmatched.selectedMatch);
      }
    }

    const updatedProgram: ParsedProgram = {
      ...state.extractedProgram,
      name: state.programName,
      description: state.programDescription || undefined,
      workouts: state.extractedProgram.workouts.map(workout => ({
        ...workout,
        exercises: workout.exercises.map(exercise => {
          const matchedName = matchMap.get(exercise.name.toLowerCase());
          if (matchedName) {
            return {
              ...exercise,
              originalName: exercise.name,
              name: matchedName,
            };
          }
          return exercise;
        }),
      })),
    };

    return updatedProgram;
  }, [state.extractedProgram, state.unmatchedExercises, state.programName, state.programDescription]);

  const value: ImportContextValue = {
    state,
    startImport,
    setProgress,
    onExtractionSuccess,
    onExtractionFailed,
    updateExerciseMatch,
    updateProgramInfo,
    startSave,
    onSaveSuccess,
    onSaveFailed,
    reset,
    canProceedToSave,
    applyMatchesToProgram,
  };

  return (
    <ImportContext.Provider value={value}>
      {children}
    </ImportContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useProgramImport() {
  const context = useContext(ImportContext);
  if (!context) {
    throw new Error('useProgramImport must be used within a ProgramImportProvider');
  }
  return context;
}
