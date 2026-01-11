/**
 * Program Service Types
 * 
 * Following Clean Code principles:
 * - Single Responsibility: Types only define structure
 * - Open/Closed: Easy to extend with new program types
 * - Meaningful Names: Clear, self-documenting types
 */

// ============================================
// ENUMS - Constrain valid values
// ============================================

export const ProgramType = {
  STRENGTH: 'STRENGTH',
  HYPERTROPHY: 'HYPERTROPHY',
  ENDURANCE: 'ENDURANCE',
  ATHLETIC: 'ATHLETIC',
  BODYWEIGHT: 'BODYWEIGHT',
  FULL_BODY: 'FULL_BODY',
  POWERLIFTING: 'POWERLIFTING',
  WEIGHT_LOSS: 'WEIGHT_LOSS',
  MOBILITY: 'MOBILITY',
  SPORT_SPECIFIC: 'SPORT_SPECIFIC',
} as const;

export type ProgramType = typeof ProgramType[keyof typeof ProgramType];

export const DifficultyLevel = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED',
  ELITE: 'ELITE',
} as const;

export type DifficultyLevel = typeof DifficultyLevel[keyof typeof DifficultyLevel];

export const ProgramCategory = {
  POPULAR: 'popular',
  STRENGTH: 'strength',
  MUSCLE_BUILDING: 'muscle_building',
  BODYWEIGHT: 'bodyweight',
  BEGINNER: 'beginner',
  ADVANCED: 'advanced',
  SPORT: 'sport',
  SPECIALIZED: 'specialized',
} as const;

export type ProgramCategory = typeof ProgramCategory[keyof typeof ProgramCategory];

// ============================================
// CORE INTERFACES
// ============================================

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  weight?: string;
  restTime?: number;
  notes?: string;
  tempo?: string;
  rpe?: number;
}

export interface Workout {
  week: number;
  day: number;
  name: string;
  exercises: Exercise[];
  notes?: string;
  duration?: number; // minutes
}

export interface WorkoutProgram {
  id: string;
  name: string;
  description: string;
  type: ProgramType;
  difficulty: DifficultyLevel;
  category: ProgramCategory;
  duration: number; // weeks
  daysPerWeek: number;
  muscleGroups: string[];
  equipment: string[];
  workouts: Workout[];
  tags?: string[];
  author?: string;
  source?: string;
}

// ============================================
// DISPLAY TYPES
// ============================================

export interface ProgramDisplayItem {
  id: string;
  name: string;
  description: string;
  type: ProgramType;
  difficulty: DifficultyLevel;
  category: ProgramCategory;
  duration: number;
  daysPerWeek: number;
  workoutCount: number;
  muscleGroups: string[];
  equipment: string[];
  tags: string[];
  source: 'builtin' | 'uploaded' | 'saved';
}

// ============================================
// COLOR MAPPINGS
// ============================================

export const TYPE_COLORS: Record<ProgramType, string> = {
  STRENGTH: '#FF453A',
  HYPERTROPHY: '#0A84FF',
  ENDURANCE: '#30D158',
  ATHLETIC: '#FF9F0A',
  BODYWEIGHT: '#BF5AF2',
  FULL_BODY: '#64D2FF',
  POWERLIFTING: '#FF6482',
  WEIGHT_LOSS: '#32D74B',
  MOBILITY: '#5E5CE6',
  SPORT_SPECIFIC: '#FFD60A',
};

export const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  BEGINNER: '#30D158',
  INTERMEDIATE: '#FF9F0A',
  ADVANCED: '#FF453A',
  ELITE: '#BF5AF2',
};

export const CATEGORY_INFO: Record<ProgramCategory, { name: string; icon: string; color: string }> = {
  popular: { name: 'Popular', icon: 'star.fill', color: '#FF9F0A' },
  strength: { name: 'Strength', icon: 'dumbbell', color: '#FF453A' },
  muscle_building: { name: 'Muscle Building', icon: 'figure.strengthtraining.traditional', color: '#0A84FF' },
  bodyweight: { name: 'Bodyweight', icon: 'figure.walk', color: '#BF5AF2' },
  beginner: { name: 'Beginner Friendly', icon: 'sparkles', color: '#30D158' },
  advanced: { name: 'Advanced', icon: 'bolt.fill', color: '#FF453A' },
  sport: { name: 'Sport Specific', icon: 'sportscourt.fill', color: '#FFD60A' },
  specialized: { name: 'Specialized', icon: 'gearshape.fill', color: '#5E5CE6' },
};

// ============================================
// PARSER TYPES (re-exported from canonical source)
// ============================================

export type { ParsedExercise, ParsedWorkout, ParsedProgram } from '@/lib/types/program';

