// Type definitions for workout programs

import type { SetType } from './workout-session';

export interface ParsedExercise {
  name: string;
  originalName?: string;
  sets: number;
  reps?: string;
  weight?: string;
  restSeconds?: number;
  notes?: string;
  setType?: SetType | string;
  order?: number;
}

export interface ParsedWorkout {
  week: number;
  day: number;
  name?: string;
  exercises: ParsedExercise[];
  order?: number;
}

export interface ParsedProgram {
  name: string;
  description?: string;
  workouts: ParsedWorkout[];
}

export interface ExerciseMatch {
  originalName: string;
  suggestedName: string;
  confidence: number; // 0-1
  databaseId?: string;
  requiresReview: boolean;
}

export interface MappingResult {
  matches: ExerciseMatch[];
  unmatchedCount: number;
  totalCount: number;
}

export interface ExportFormat {
  type: 'hevy' | 'strong' | 'csv';
  data: string; // CSV or JSON string
}
