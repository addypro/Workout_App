/**
 * Kaggle Dataset Loader
 *
 * Loads workout programs from programs_detailed_boostcamp_kaggle.csv via the full JSON.
 * Contains complete workout data (all weeks, days, exercises) for each program.
 */

import fullData from '@/data/programs-full.json';
import { WorkoutProgram, ProgramType, DifficultyLevel, ProgramCategory, Workout } from './types';

// ============================================
// TYPE MAPPING
// ============================================

const TYPE_MAP: Record<string, ProgramType> = {
  'STRENGTH': ProgramType.STRENGTH,
  'HYPERTROPHY': ProgramType.HYPERTROPHY,
  'GENERAL_FITNESS': ProgramType.FULL_BODY,
  'FULL_BODY': ProgramType.FULL_BODY,
  'ATHLETIC': ProgramType.ATHLETIC,
  'BODYWEIGHT': ProgramType.BODYWEIGHT,
  'ENDURANCE': ProgramType.ENDURANCE,
  'POWERLIFTING': ProgramType.POWERLIFTING,
  'WEIGHT_LOSS': ProgramType.WEIGHT_LOSS,
  'SPORT_SPECIFIC': ProgramType.SPORT_SPECIFIC,
  'MOBILITY': ProgramType.MOBILITY,
};

const DIFFICULTY_MAP: Record<string, DifficultyLevel> = {
  'BEGINNER': DifficultyLevel.BEGINNER,
  'INTERMEDIATE': DifficultyLevel.INTERMEDIATE,
  'ADVANCED': DifficultyLevel.ADVANCED,
  'ELITE': DifficultyLevel.ELITE,
};

// ============================================
// CATEGORY INFERENCE
// ============================================

function inferCategory(program: any): ProgramCategory {
  const name = (program.name || '').toLowerCase();
  const type = program.type || '';
  const difficulty = program.difficulty || '';

  if (name.includes('beginner') || difficulty === 'BEGINNER') {
    return ProgramCategory.BEGINNER;
  }
  if (name.includes('advanced') || difficulty === 'ADVANCED' || difficulty === 'ELITE') {
    return ProgramCategory.ADVANCED;
  }
  if (type === 'BODYWEIGHT' || name.includes('bodyweight') || name.includes('calisthenics')) {
    return ProgramCategory.BODYWEIGHT;
  }
  if (type === 'STRENGTH' || name.includes('strength') || name.includes('powerlifting')) {
    return ProgramCategory.STRENGTH;
  }
  if (type === 'HYPERTROPHY' || name.includes('hypertrophy') || name.includes('muscle')) {
    return ProgramCategory.MUSCLE_BUILDING;
  }
  if (type === 'ATHLETIC' || type === 'SPORT_SPECIFIC' || name.includes('sport') || name.includes('athletic')) {
    return ProgramCategory.SPORT;
  }

  return ProgramCategory.POPULAR;
}

// ============================================
// TRANSFORM FUNCTION
// ============================================

/**
 * Transform compressed workout format to full format
 * Compressed: { w, d, n, e: [{ n, s, r }] }
 * Full: { week, day, name, exercises: [{ name, sets, reps, restTime }] }
 */
function transformWorkout(compressed: any): Workout {
  return {
    week: compressed.w,
    day: compressed.d,
    name: compressed.n || `Week ${compressed.w}, Day ${compressed.d}`,
    exercises: (compressed.e || []).map((ex: any) => ({
      name: ex.n || 'Exercise',
      sets: ex.s || 3,
      reps: String(ex.r || '10'),
      restTime: 60,
    })),
  };
}

/**
 * Transform raw program data from JSON to WorkoutProgram type
 */
function transformFullProgram(raw: any): WorkoutProgram {
  // Transform all workouts from compressed format
  const workouts: Workout[] = (raw.workouts || []).map(transformWorkout);

  return {
    id: raw.id,
    name: raw.name || 'Unnamed Program',
    description: raw.description || `${raw.type || 'General'} workout program`,
    type: TYPE_MAP[raw.type] || ProgramType.FULL_BODY,
    difficulty: DIFFICULTY_MAP[raw.difficulty] || DifficultyLevel.INTERMEDIATE,
    category: inferCategory(raw),
    duration: raw.duration || 4,
    daysPerWeek: raw.daysPerWeek || 3,
    muscleGroups: [],
    equipment: raw.equipment ? [raw.equipment] : [],
    tags: [raw.type?.toLowerCase(), raw.difficulty?.toLowerCase()].filter(Boolean),
    workouts,
  };
}

// ============================================
// CACHE
// ============================================

let _cachedPrograms: WorkoutProgram[] | null = null;

// ============================================
// PUBLIC API
// ============================================

/**
 * Get all programs from the Kaggle dataset (with full workout data)
 */
export function getKagglePrograms(): WorkoutProgram[] {
  if (_cachedPrograms) {
    return _cachedPrograms;
  }

  const rawPrograms = (fullData as any).programs || [];
  const programs: WorkoutProgram[] = rawPrograms.map(transformFullProgram);
  _cachedPrograms = programs;

  return programs;
}

/**
 * Get program count
 */
export function getKaggleProgramCount(): number {
  return ((fullData as any).programs || []).length;
}

/**
 * Get a program by ID with full workout details
 */
export function getProgramById(programId: string): WorkoutProgram | null {
  const program = getKagglePrograms().find(p => p.id === programId);
  return program || null;
}

/**
 * Load full program details (legacy API - now returns immediately since all data is loaded)
 */
export async function loadFullProgramDetails(programId: string): Promise<WorkoutProgram | null> {
  return getProgramById(programId);
}
