/**
 * Program Service
 *
 * Single entry point for all program-related functionality.
 * Loads curated, trainer-designed workout programs.
 */

import { BODYWEIGHT_PROGRAMS } from './data/bodyweight-programs';
import { HYPERTROPHY_PROGRAMS } from './data/hypertrophy-programs';
import { MORE_PROGRAMS } from './data/more-programs';
import { SPECIALIZED_PROGRAMS } from './data/specialized-programs';
import { STRENGTH_PROGRAMS } from './data/strength-programs';
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
// CURATED PROGRAMS COLLECTION
// ============================================

/**
 * All curated workout programs - trainer-designed, high-quality
 * Covers: beginner/intermediate/advanced, strength/hypertrophy/bodyweight
 */
const ALL_CURATED_PROGRAMS: WorkoutProgram[] = [
  ...STRENGTH_PROGRAMS,
  ...HYPERTROPHY_PROGRAMS,
  ...BODYWEIGHT_PROGRAMS,
  ...SPECIALIZED_PROGRAMS,
  ...MORE_PROGRAMS,
];

// ============================================
// PROGRAM ACCESS
// ============================================

/**
 * Get all curated programs
 */
export function getAllPrograms(): WorkoutProgram[] {
  return ALL_CURATED_PROGRAMS;
}

/**
 * Get total program count
 */
export function getProgramCount(): number {
  return ALL_CURATED_PROGRAMS.length;
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
  // Use metadata duration as base, then check if workouts array has more weeks
  // This handles cases where workouts array only has week 1 samples
  const workoutsMaxWeek = program.workouts.length > 0
    ? Math.max(...program.workouts.map(w => w.week || 1), 1)
    : 1;

  // Use the larger of program.duration or calculated max week
  // This ensures we show correct duration even if workouts array is incomplete
  const actualDuration = Math.max(program.duration || 1, workoutsMaxWeek);

  return {
    id: program.id,
    name: program.name,
    description: program.description,
    type: program.type,
    difficulty: program.difficulty,
    category: program.category,
    duration: actualDuration,
    daysPerWeek: program.daysPerWeek,
    workoutCount: program.workouts.length,
    muscleGroups: program.muscleGroups,
    equipment: program.equipment,
    tags: program.tags || [],
    source,
  };
}

// ============================================
// WORKOUT TEMPLATES BY PROGRAM TYPE
// ============================================

type WorkoutTemplate = {
  name: string;
  exercises: { name: string; sets: number; reps: string; restTime?: number }[];
};

/**
 * Generate appropriate workout templates based on program type and frequency.
 * Uses intelligent splits: PPL for 6 days, Upper/Lower for 4 days, Full Body for 3 days.
 */
function getWorkoutTemplates(type: ProgramType, daysPerWeek: number): WorkoutTemplate[] {
  // Push/Pull/Legs split (for 6 days)
  const PPL_TEMPLATES: WorkoutTemplate[] = [
    {
      name: 'Push Day',
      exercises: [
        { name: 'Bench Press', sets: 4, reps: '8-10', restTime: 120 },
        { name: 'Overhead Press', sets: 3, reps: '8-10', restTime: 90 },
        { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', restTime: 90 },
        { name: 'Lateral Raises', sets: 3, reps: '12-15', restTime: 60 },
        { name: 'Tricep Pushdowns', sets: 3, reps: '12-15', restTime: 60 },
        { name: 'Overhead Tricep Extension', sets: 3, reps: '12-15', restTime: 60 },
      ],
    },
    {
      name: 'Pull Day',
      exercises: [
        { name: 'Barbell Rows', sets: 4, reps: '8-10', restTime: 120 },
        { name: 'Pull-ups', sets: 3, reps: '8-12', restTime: 90 },
        { name: 'Seated Cable Rows', sets: 3, reps: '10-12', restTime: 90 },
        { name: 'Face Pulls', sets: 3, reps: '15-20', restTime: 60 },
        { name: 'Barbell Curls', sets: 3, reps: '10-12', restTime: 60 },
        { name: 'Hammer Curls', sets: 3, reps: '12-15', restTime: 60 },
      ],
    },
    {
      name: 'Legs Day',
      exercises: [
        { name: 'Squats', sets: 4, reps: '8-10', restTime: 180 },
        { name: 'Romanian Deadlifts', sets: 3, reps: '10-12', restTime: 120 },
        { name: 'Leg Press', sets: 3, reps: '12-15', restTime: 90 },
        { name: 'Leg Curls', sets: 3, reps: '12-15', restTime: 60 },
        { name: 'Leg Extensions', sets: 3, reps: '12-15', restTime: 60 },
        { name: 'Calf Raises', sets: 4, reps: '15-20', restTime: 60 },
      ],
    },
  ];

  // Upper/Lower split (for 4 days)
  const UPPER_LOWER_TEMPLATES: WorkoutTemplate[] = [
    {
      name: 'Upper Body A',
      exercises: [
        { name: 'Bench Press', sets: 4, reps: '6-8', restTime: 120 },
        { name: 'Barbell Rows', sets: 4, reps: '6-8', restTime: 120 },
        { name: 'Overhead Press', sets: 3, reps: '8-10', restTime: 90 },
        { name: 'Pull-ups', sets: 3, reps: '8-12', restTime: 90 },
        { name: 'Tricep Dips', sets: 3, reps: '10-12', restTime: 60 },
        { name: 'Barbell Curls', sets: 3, reps: '10-12', restTime: 60 },
      ],
    },
    {
      name: 'Lower Body A',
      exercises: [
        { name: 'Squats', sets: 4, reps: '6-8', restTime: 180 },
        { name: 'Romanian Deadlifts', sets: 4, reps: '8-10', restTime: 120 },
        { name: 'Leg Press', sets: 3, reps: '10-12', restTime: 90 },
        { name: 'Leg Curls', sets: 3, reps: '12-15', restTime: 60 },
        { name: 'Calf Raises', sets: 4, reps: '15-20', restTime: 60 },
        { name: 'Planks', sets: 3, reps: '60 sec', restTime: 60 },
      ],
    },
    {
      name: 'Upper Body B',
      exercises: [
        { name: 'Incline Dumbbell Press', sets: 4, reps: '8-10', restTime: 90 },
        { name: 'Seated Cable Rows', sets: 4, reps: '8-10', restTime: 90 },
        { name: 'Dumbbell Shoulder Press', sets: 3, reps: '10-12', restTime: 90 },
        { name: 'Lat Pulldowns', sets: 3, reps: '10-12', restTime: 90 },
        { name: 'Lateral Raises', sets: 3, reps: '12-15', restTime: 60 },
        { name: 'Hammer Curls', sets: 3, reps: '12-15', restTime: 60 },
      ],
    },
    {
      name: 'Lower Body B',
      exercises: [
        { name: 'Deadlifts', sets: 4, reps: '5-6', restTime: 180 },
        { name: 'Front Squats', sets: 3, reps: '8-10', restTime: 120 },
        { name: 'Walking Lunges', sets: 3, reps: '12 each', restTime: 90 },
        { name: 'Leg Extensions', sets: 3, reps: '12-15', restTime: 60 },
        { name: 'Seated Calf Raises', sets: 4, reps: '15-20', restTime: 60 },
        { name: 'Hanging Leg Raises', sets: 3, reps: '12-15', restTime: 60 },
      ],
    },
  ];

  // Full Body (for 3 days)
  const FULL_BODY_TEMPLATES: WorkoutTemplate[] = [
    {
      name: 'Full Body A',
      exercises: [
        { name: 'Squats', sets: 4, reps: '8-10', restTime: 150 },
        { name: 'Bench Press', sets: 4, reps: '8-10', restTime: 120 },
        { name: 'Barbell Rows', sets: 4, reps: '8-10', restTime: 120 },
        { name: 'Overhead Press', sets: 3, reps: '10-12', restTime: 90 },
        { name: 'Barbell Curls', sets: 2, reps: '12-15', restTime: 60 },
        { name: 'Tricep Pushdowns', sets: 2, reps: '12-15', restTime: 60 },
      ],
    },
    {
      name: 'Full Body B',
      exercises: [
        { name: 'Deadlifts', sets: 4, reps: '6-8', restTime: 180 },
        { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', restTime: 90 },
        { name: 'Pull-ups', sets: 3, reps: '8-12', restTime: 90 },
        { name: 'Dumbbell Lunges', sets: 3, reps: '10 each', restTime: 90 },
        { name: 'Lateral Raises', sets: 3, reps: '12-15', restTime: 60 },
        { name: 'Face Pulls', sets: 3, reps: '15-20', restTime: 60 },
      ],
    },
    {
      name: 'Full Body C',
      exercises: [
        { name: 'Front Squats', sets: 4, reps: '8-10', restTime: 150 },
        { name: 'Dumbbell Shoulder Press', sets: 3, reps: '10-12', restTime: 90 },
        { name: 'Seated Cable Rows', sets: 4, reps: '10-12', restTime: 90 },
        { name: 'Romanian Deadlifts', sets: 3, reps: '10-12', restTime: 120 },
        { name: 'Dips', sets: 3, reps: '10-12', restTime: 60 },
        { name: 'Hammer Curls', sets: 2, reps: '12-15', restTime: 60 },
      ],
    },
  ];

  // Bodyweight templates
  const BODYWEIGHT_TEMPLATES: WorkoutTemplate[] = [
    {
      name: 'Push & Core',
      exercises: [
        { name: 'Push-ups', sets: 4, reps: '15-20', restTime: 60 },
        { name: 'Diamond Push-ups', sets: 3, reps: '10-15', restTime: 60 },
        { name: 'Pike Push-ups', sets: 3, reps: '10-12', restTime: 60 },
        { name: 'Dips', sets: 3, reps: '10-15', restTime: 60 },
        { name: 'Plank', sets: 3, reps: '60 sec', restTime: 45 },
        { name: 'Mountain Climbers', sets: 3, reps: '30 sec', restTime: 45 },
      ],
    },
    {
      name: 'Pull & Core',
      exercises: [
        { name: 'Pull-ups', sets: 4, reps: '8-12', restTime: 90 },
        { name: 'Inverted Rows', sets: 3, reps: '12-15', restTime: 60 },
        { name: 'Chin-ups', sets: 3, reps: '8-10', restTime: 90 },
        { name: 'Superman Holds', sets: 3, reps: '30 sec', restTime: 45 },
        { name: 'Hanging Leg Raises', sets: 3, reps: '10-15', restTime: 60 },
        { name: 'Dead Hangs', sets: 3, reps: '30 sec', restTime: 45 },
      ],
    },
    {
      name: 'Legs & Cardio',
      exercises: [
        { name: 'Bodyweight Squats', sets: 4, reps: '20-25', restTime: 60 },
        { name: 'Jump Squats', sets: 3, reps: '12-15', restTime: 60 },
        { name: 'Walking Lunges', sets: 3, reps: '12 each', restTime: 60 },
        { name: 'Bulgarian Split Squats', sets: 3, reps: '10 each', restTime: 60 },
        { name: 'Calf Raises', sets: 4, reps: '20-25', restTime: 45 },
        { name: 'Burpees', sets: 3, reps: '10-12', restTime: 90 },
      ],
    },
  ];

  // Powerlifting templates
  const POWERLIFTING_TEMPLATES: WorkoutTemplate[] = [
    {
      name: 'Squat Day',
      exercises: [
        { name: 'Back Squat', sets: 5, reps: '5', restTime: 180 },
        { name: 'Pause Squats', sets: 3, reps: '3', restTime: 150 },
        { name: 'Leg Press', sets: 3, reps: '10-12', restTime: 120 },
        { name: 'Good Mornings', sets: 3, reps: '8-10', restTime: 90 },
        { name: 'Leg Curls', sets: 3, reps: '12-15', restTime: 60 },
        { name: 'Ab Wheel Rollouts', sets: 3, reps: '10-12', restTime: 60 },
      ],
    },
    {
      name: 'Bench Day',
      exercises: [
        { name: 'Bench Press', sets: 5, reps: '5', restTime: 180 },
        { name: 'Pause Bench Press', sets: 3, reps: '3', restTime: 150 },
        { name: 'Close-Grip Bench', sets: 3, reps: '8-10', restTime: 120 },
        { name: 'Dumbbell Rows', sets: 4, reps: '10-12', restTime: 90 },
        { name: 'Tricep Extensions', sets: 3, reps: '12-15', restTime: 60 },
        { name: 'Face Pulls', sets: 3, reps: '15-20', restTime: 60 },
      ],
    },
    {
      name: 'Deadlift Day',
      exercises: [
        { name: 'Deadlift', sets: 5, reps: '5', restTime: 180 },
        { name: 'Deficit Deadlifts', sets: 3, reps: '3', restTime: 150 },
        { name: 'Barbell Rows', sets: 4, reps: '8-10', restTime: 120 },
        { name: 'Romanian Deadlifts', sets: 3, reps: '10-12', restTime: 90 },
        { name: 'Pull-ups', sets: 3, reps: '8-12', restTime: 90 },
        { name: "Farmer's Walks", sets: 3, reps: '40m', restTime: 90 },
      ],
    },
    {
      name: 'Accessory Day',
      exercises: [
        { name: 'Overhead Press', sets: 4, reps: '6-8', restTime: 120 },
        { name: 'Front Squats', sets: 3, reps: '6-8', restTime: 120 },
        { name: 'Lat Pulldowns', sets: 4, reps: '10-12', restTime: 90 },
        { name: 'Lunges', sets: 3, reps: '10 each', restTime: 90 },
        { name: 'Barbell Curls', sets: 3, reps: '10-12', restTime: 60 },
        { name: 'Hanging Leg Raises', sets: 3, reps: '12-15', restTime: 60 },
      ],
    },
  ];

  // Select templates based on program type
  let baseTemplates: WorkoutTemplate[];

  switch (type) {
    case ProgramType.BODYWEIGHT:
      baseTemplates = BODYWEIGHT_TEMPLATES;
      break;
    case ProgramType.POWERLIFTING:
      baseTemplates = POWERLIFTING_TEMPLATES;
      break;
    case ProgramType.STRENGTH:
      // Use Upper/Lower or Powerlifting for strength
      baseTemplates = daysPerWeek >= 4 ? UPPER_LOWER_TEMPLATES : POWERLIFTING_TEMPLATES.slice(0, 3);
      break;
    case ProgramType.HYPERTROPHY:
      // PPL for hypertrophy is ideal
      baseTemplates = daysPerWeek >= 5 ? PPL_TEMPLATES : UPPER_LOWER_TEMPLATES;
      break;
    default:
      // Default split based on days per week
      if (daysPerWeek >= 6) {
        baseTemplates = PPL_TEMPLATES;
      } else if (daysPerWeek >= 4) {
        baseTemplates = UPPER_LOWER_TEMPLATES;
      } else {
        baseTemplates = FULL_BODY_TEMPLATES;
      }
  }

  // Return enough templates for the days per week
  const result: WorkoutTemplate[] = [];
  for (let i = 0; i < daysPerWeek; i++) {
    result.push(baseTemplates[i % baseTemplates.length]);
  }
  return result;
}

/**
 * Convert a program to storage format (for saving to My Programs)
 *
 * Attempts to load full workout data from Kaggle dataset (real multi-week data).
 * Falls back to expanding week 1 template if Kaggle data not available.
 */
export function toStorageFormat(program: WorkoutProgram) {
  // Try to get full workouts from Kaggle data (has real week-by-week progression)
  let fullWorkouts: any[] | null = null;

  try {
    // Dynamically import to avoid circular dependency
    const { getKagglePrograms } = require('./kaggle-loader');
    const kagglePrograms = getKagglePrograms() as WorkoutProgram[];

    // Try to match by ID first, then by name
    const kaggleProgram = kagglePrograms.find(
      p => p.id === program.id || p.name.toLowerCase() === program.name.toLowerCase()
    );

    if (kaggleProgram && kaggleProgram.workouts.length > 0) {
      // Check if Kaggle version has multi-week data
      const kaggleMaxWeek = Math.max(...kaggleProgram.workouts.map(w => w.week || 1), 1);
      if (kaggleMaxWeek > 1) {
        fullWorkouts = kaggleProgram.workouts.map(workout => ({
          week: workout.week,
          day: workout.day,
          name: workout.name,
          exercises: workout.exercises.map(ex => ({
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            restTime: ex.restTime || 60,
            notes: ex.notes,
          })),
        }));
      }
    }
  } catch (e) {
    // Kaggle loader not available or error - continue with fallback
  }

  // If no Kaggle data, use original workouts with expansion
  if (!fullWorkouts) {
    const originalWorkouts = program.workouts;

    // Check if we need to expand (only has week 1 but duration > 1)
    const maxWeek = Math.max(...originalWorkouts.map(w => w.week || 1), 1);
    const needsExpansion = maxWeek === 1 && program.duration > 1;

    if (needsExpansion) {
      // Expand week 1 template across all weeks
      fullWorkouts = [];
      for (let week = 1; week <= program.duration; week++) {
        for (const workout of originalWorkouts) {
          fullWorkouts.push({
            week,
            day: workout.day,
            name: workout.name,
            exercises: workout.exercises.map(ex => ({
              name: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              restTime: ex.restTime || 60,
              notes: ex.notes,
            })),
          });
        }
      }
    } else {
      // Keep original multi-week structure
      fullWorkouts = originalWorkouts.map(workout => ({
        week: workout.week,
        day: workout.day,
        name: workout.name,
        exercises: workout.exercises.map(ex => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          restTime: ex.restTime || 60,
          notes: ex.notes,
        })),
      }));
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
      workouts: fullWorkouts,
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
