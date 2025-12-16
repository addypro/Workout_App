/**
 * Program Service
 * 
 * Single entry point for all program-related functionality.
 * Loads 2,598 programs from the Kaggle fitness dataset.
 */

import { getKaggleProgramCount, getKagglePrograms } from './kaggle-loader';
import {
  CATEGORY_INFO,
  DIFFICULTY_COLORS,
  DifficultyLevel,
  ProgramCategory,
  ProgramDisplayItem,
  ProgramType,
  TYPE_COLORS,
  WorkoutProgram,
} from './types';

// Re-export types for convenience
export * from './types';

// ============================================
// PROGRAM ACCESS
// ============================================

/**
 * Get all programs (2,598 from Kaggle dataset)
 */
export function getAllPrograms(): WorkoutProgram[] {
  return getKagglePrograms();
}

/**
 * Get total program count
 */
export function getProgramCount(): number {
  return getKaggleProgramCount();
}

/**
 * Get a program by ID
 */
export function getProgramById(id: string): WorkoutProgram | undefined {
  return getAllPrograms().find(p => p.id === id);
}

/**
 * Get programs by category
 */
export function getProgramsByCategory(category: ProgramCategory): WorkoutProgram[] {
  return getAllPrograms().filter(p => p.category === category);
}

/**
 * Get programs by type
 */
export function getProgramsByType(type: ProgramType): WorkoutProgram[] {
  return getAllPrograms().filter(p => p.type === type);
}

/**
 * Get programs by difficulty
 */
export function getProgramsByDifficulty(difficulty: DifficultyLevel): WorkoutProgram[] {
  return getAllPrograms().filter(p => p.difficulty === difficulty);
}

/**
 * Search programs by name or description
 */
export function searchPrograms(query: string): WorkoutProgram[] {
  if (!query.trim()) return getAllPrograms();
  
  const q = query.toLowerCase();
  return getAllPrograms().filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    p.tags?.some(t => t.toLowerCase().includes(q)) ||
    p.muscleGroups.some(m => m.toLowerCase().includes(q)) ||
    p.type.toLowerCase().includes(q)
  );
}

/**
 * Get popular programs
 */
export function getPopularPrograms(): WorkoutProgram[] {
  return getAllPrograms().filter(p => p.category === ProgramCategory.POPULAR).slice(0, 50);
}

/**
 * Get beginner-friendly programs
 */
export function getBeginnerPrograms(): WorkoutProgram[] {
  return getAllPrograms().filter(p => 
    p.difficulty === DifficultyLevel.BEGINNER ||
    p.category === ProgramCategory.BEGINNER
  );
}

// ============================================
// TRANSFORM FUNCTIONS
// ============================================

/**
 * Convert a WorkoutProgram to a display-friendly format
 */
export function toProgramDisplayItem(
  program: WorkoutProgram,
  source: 'builtin' | 'uploaded' | 'saved' = 'builtin'
): ProgramDisplayItem {
  return {
    id: program.id,
    name: program.name,
    description: program.description,
    type: program.type,
    difficulty: program.difficulty,
    category: program.category,
    duration: program.duration,
    daysPerWeek: program.daysPerWeek,
    workoutCount: program.workouts.length,
    muscleGroups: program.muscleGroups,
    equipment: program.equipment,
    tags: program.tags || [],
    source,
  };
}

/**
 * Convert a program to storage format (for saving to My Programs)
 */
export function toStorageFormat(program: WorkoutProgram) {
  // If program has workouts, use them; otherwise create placeholder workouts
  let workouts = program.workouts;
  
  if (!workouts || workouts.length === 0) {
    // Create placeholder workouts based on program info
    workouts = [];
    const totalDays = program.daysPerWeek * Math.max(1, program.duration);
    for (let i = 0; i < Math.min(totalDays, 7); i++) {
      const week = Math.floor(i / program.daysPerWeek) + 1;
      const day = (i % program.daysPerWeek) + 1;
      workouts.push({
        week,
        day,
        name: `Week ${week}, Day ${day}`,
        exercises: [
          { name: 'Exercise 1', sets: 3, reps: '10', restTime: 60 },
          { name: 'Exercise 2', sets: 3, reps: '10', restTime: 60 },
          { name: 'Exercise 3', sets: 3, reps: '10', restTime: 60 },
        ],
      });
    }
  }

  return {
    name: program.name,
    description: program.description,
    userId: 'local',
    sourceType: 'BUILTIN' as const,
    sourceFileUri: null,
    status: 'READY' as const,
    parsedData: {
      // Helps join "installed" state back to the catalog without brittle name matching
      sourceProgramId: program.id,
      type: program.type,
      duration: program.duration,
      difficulty: program.difficulty,
      muscleGroups: program.muscleGroups,
      equipment: program.equipment,
      workouts,
    },
  };
}

// ============================================
// COLOR HELPERS
// ============================================

/**
 * Get the color for a program type
 */
export function getTypeColor(type: ProgramType | string): string {
  return TYPE_COLORS[type as ProgramType] || '#8E8E93';
}

/**
 * Get the color for a difficulty level
 */
export function getDifficultyColor(difficulty: DifficultyLevel | string): string {
  return DIFFICULTY_COLORS[difficulty as DifficultyLevel] || '#8E8E93';
}

/**
 * Get category info (name, icon, color)
 */
export function getCategoryInfo(category: ProgramCategory) {
  return CATEGORY_INFO[category] || { name: 'Other', icon: 'folder', color: '#8E8E93' };
}

// ============================================
// GROUPING FUNCTIONS
// ============================================

/**
 * Group programs by category
 */
export function groupByCategory(): Record<ProgramCategory, WorkoutProgram[]> {
  const groups: Record<string, WorkoutProgram[]> = {};
  
  Object.values(ProgramCategory).forEach(cat => {
    groups[cat] = [];
  });
  
  getAllPrograms().forEach(program => {
    if (groups[program.category]) {
      groups[program.category].push(program);
    }
  });
  
  return groups as Record<ProgramCategory, WorkoutProgram[]>;
}

/**
 * Group programs by difficulty
 */
export function groupByDifficulty(): Record<DifficultyLevel, WorkoutProgram[]> {
  const groups: Record<string, WorkoutProgram[]> = {};
  
  Object.values(DifficultyLevel).forEach(diff => {
    groups[diff] = [];
  });
  
  getAllPrograms().forEach(program => {
    if (groups[program.difficulty]) {
      groups[program.difficulty].push(program);
    }
  });
  
  return groups as Record<DifficultyLevel, WorkoutProgram[]>;
}

/**
 * Get program count summary
 */
export function getProgramCounts() {
  const all = getAllPrograms();
  return {
    total: all.length,
    byDifficulty: {
      beginner: all.filter(p => p.difficulty === DifficultyLevel.BEGINNER).length,
      intermediate: all.filter(p => p.difficulty === DifficultyLevel.INTERMEDIATE).length,
      advanced: all.filter(p => p.difficulty === DifficultyLevel.ADVANCED).length,
    },
    byType: Object.values(ProgramType).reduce((acc, type) => {
      acc[type] = all.filter(p => p.type === type).length;
      return acc;
    }, {} as Record<string, number>),
  };
}
