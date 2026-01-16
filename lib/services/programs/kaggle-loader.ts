/**
 * Kaggle Dataset Loader
 *
 * Loads workout programs from programs_detailed_boostcamp_kaggle.csv via the full JSON.
 * Contains complete workout data (all weeks, days, exercises) for each program.
 *
 * STATE-OF-THE-ART PATTERN: Uses lazy dynamic import for the 21MB JSON file
 * to avoid blocking the JS thread during initial bundle parse. The JSON is
 * loaded on-demand when first needed, eliminating first-interaction lag.
 */

import { DifficultyLevel, ProgramCategory, ProgramType, Workout, WorkoutProgram } from './types';

// Lazy-loaded full data (21MB JSON - loaded on-demand)
let _fullData: { programs: any[] } | null = null;
let _loadPromise: Promise<{ programs: any[] }> | null = null;

/**
 * Lazy load the full programs JSON (21MB) on-demand.
 * Uses singleton pattern to prevent multiple concurrent loads.
 */
async function loadFullData(): Promise<{ programs: any[] }> {
  // Fast path: already loaded
  if (_fullData) return _fullData;

  // If load is in progress, wait for it
  if (_loadPromise) return _loadPromise;

  // Start loading
  _loadPromise = (async () => {
    try {
      // Dynamic import - loads JSON on-demand, not at bundle parse time
      const data = await import('@/data/programs-full.json');
      _fullData = data.default || data;
      console.log('[KaggleLoader] Loaded programs-full.json on demand');
      return _fullData;
    } catch (error) {
      console.error('[KaggleLoader] Failed to load programs-full.json:', error);
      _loadPromise = null; // Allow retry on failure
      throw error;
    }
  })();

  return _loadPromise;
}

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
// CACHE + O(1) INDICES
// ============================================

let _cachedPrograms: WorkoutProgram[] | null = null;
let _programByIdIndex: Map<string, WorkoutProgram> | null = null;
let _programByNameIndex: Map<string, WorkoutProgram> | null = null;
let _indicesPromise: Promise<void> | null = null;

/**
 * Ensure indices are built (async version).
 * Uses singleton pattern to prevent multiple concurrent builds.
 */
async function ensureIndicesAsync(): Promise<void> {
  // Fast path: already built
  if (_cachedPrograms && _programByIdIndex) return;

  // If build is in progress, wait for it
  if (_indicesPromise) return _indicesPromise;

  // Start building
  _indicesPromise = (async () => {
    const fullData = await loadFullData();
    const rawPrograms = fullData.programs || [];
    const programs: WorkoutProgram[] = rawPrograms.map(transformFullProgram);
    _cachedPrograms = programs;

    // Build O(1) lookup indices
    _programByIdIndex = new Map();
    _programByNameIndex = new Map();

    for (const program of programs) {
      _programByIdIndex.set(program.id, program);
      _programByNameIndex.set(program.name.toLowerCase(), program);
    }

    console.log(`[KaggleLoader] Built indices for ${programs.length} programs`);
  })();

  return _indicesPromise;
}

/**
 * Preload Kaggle indices in background to eliminate cold start latency.
 * Call this on app startup for instant detail modal opens.
 */
export async function preloadKaggleIndex(): Promise<void> {
  // Load data and build indices in background
  await ensureIndicesAsync();
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Get all programs from the Kaggle dataset (with full workout data)
 * Now async to support lazy loading of the 21MB JSON
 */
export async function getKagglePrograms(): Promise<WorkoutProgram[]> {
  await ensureIndicesAsync();
  return _cachedPrograms!;
}

/**
 * Get program count (sync if already loaded, otherwise loads)
 */
export async function getKaggleProgramCount(): Promise<number> {
  const fullData = await loadFullData();
  return (fullData.programs || []).length;
}

/**
 * Get a program by ID with full workout details - O(1) lookup
 * Now async to support lazy loading
 * @complexity Time: O(1), Space: O(1) per lookup
 */
export async function getProgramById(programId: string): Promise<WorkoutProgram | null> {
  await ensureIndicesAsync();
  return _programByIdIndex!.get(programId) || null;
}

/**
 * Get a program by name (case-insensitive) - O(1) lookup
 * Now async to support lazy loading
 * @complexity Time: O(1), Space: O(1) per lookup
 */
export async function getKaggleProgramByName(name: string): Promise<WorkoutProgram | null> {
  await ensureIndicesAsync();
  return _programByNameIndex!.get(name.toLowerCase()) || null;
}

/**
 * Load full program details
 */
export async function loadFullProgramDetails(programId: string): Promise<WorkoutProgram | null> {
  return getProgramById(programId);
}
