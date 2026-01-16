// Exercise Database Service
// Using Hevy-based exercise database for optimal latency
// Format: "Exercise Name (Equipment)" - matches Hevy/Strong app conventions

import exercisesData from '@/data/hevy-primary-database.json';
import {
  BODY_REGIONS,
  DIFFICULTY_LEVELS,
  EQUIPMENT_CATEGORIES,
  getBodyRegionForMuscle,
  getDifficultyLevel,
  getEquipmentCategory,
  getMovementCategory,
  MOVEMENT_PATTERNS,
  normalizeCategory,
} from './categories';

export interface ExerciseDatabaseEntry {
  id: string;
  name: string;
  aliases: string[];
  category?: string;
  equipment: string[];
  videoUrl?: string;
  difficulty?: string | null;
  muscles?: {
    targetGroup?: string | null;
    primeMover?: string | null;
    secondary?: string | null;
    tertiary?: string | null;
  };
  movementPatterns?: string[];
  planesOfMotion?: string[];
  // Computed fields for navigation
  bodyRegion?: string;
  equipmentCategory?: string;
  movementCategory?: string;
  difficultyLevel?: number;
}

// Re-export categories for convenience
export {
  BODY_REGIONS, DIFFICULTY_LEVELS, EQUIPMENT_CATEGORIES, getBodyRegionForMuscle, getDifficultyLevel, getEquipmentCategory,
  getMovementCategory, MOVEMENT_PATTERNS
};

// Cache for exercise database
let exerciseDatabaseCache: ExerciseDatabaseEntry[] | null = null;

// ============================================
// O(1) LOOKUP INDEXES (HashMaps)
// ============================================

/**
 * Lazy-initialized HashMaps for O(1) exercise lookup.
 * Built once on first access after database load.
 */
let _exerciseByIdIndex: Map<string, ExerciseDatabaseEntry> | null = null;
let _exerciseByNameIndex: Map<string, ExerciseDatabaseEntry> | null = null;

function buildExerciseIndexes(database: ExerciseDatabaseEntry[]): void {
  _exerciseByIdIndex = new Map();
  _exerciseByNameIndex = new Map();

  for (const exercise of database) {
    _exerciseByIdIndex.set(exercise.id, exercise);
    _exerciseByNameIndex.set(exercise.name.toLowerCase(), exercise);

    // Also index by aliases for fast lookup
    for (const alias of exercise.aliases) {
      _exerciseByNameIndex.set(alias.toLowerCase(), exercise);
    }
  }
}

/**
 * Get exercise by ID - O(1) lookup using HashMap
 * @complexity Time: O(1), Space: O(1) per lookup
 */
export async function getExerciseById(id: string): Promise<ExerciseDatabaseEntry | null> {
  const database = await getExerciseDatabase();
  if (!_exerciseByIdIndex) {
    buildExerciseIndexes(database);
  }
  return _exerciseByIdIndex!.get(id) ?? null;
}

/**
 * Get exercise by name (case-insensitive) - O(1) lookup using HashMap
 * Also checks aliases.
 * @complexity Time: O(1), Space: O(1) per lookup
 */
export async function getExerciseByName(name: string): Promise<ExerciseDatabaseEntry | null> {
  const database = await getExerciseDatabase();
  if (!_exerciseByNameIndex) {
    buildExerciseIndexes(database);
  }
  return _exerciseByNameIndex!.get(name.toLowerCase()) ?? null;
}

export async function getExerciseDatabase(): Promise<ExerciseDatabaseEntry[]> {
  if (exerciseDatabaseCache) {
    return exerciseDatabaseCache;
  }

  const result: ExerciseDatabaseEntry[] = exercisesData.map((ex: any, index) => {
    const bodyRegionObj = getBodyRegionForMuscle(ex.muscles?.targetGroup);
    const equipCat = ex.equipment?.[0] ? getEquipmentCategory(ex.equipment[0]) : null;
    const moveCat = getMovementCategory(ex.movementPatterns || []);
    const diffLevel = getDifficultyLevel(ex.difficulty);

    return {
      id: `ex-${index + 1}`,
      name: ex.name,
      aliases: ex.aliases || [],
      category: normalizeCategory(ex.category),
      equipment: ex.equipment || [],
      videoUrl: ex.videoUrl,
      difficulty: ex.difficulty,
      muscles: ex.muscles,
      movementPatterns: ex.movementPatterns || [],
      planesOfMotion: ex.planesOfMotion || [],
      // Computed navigation fields
      bodyRegion: bodyRegionObj?.id,
      equipmentCategory: equipCat?.id,
      movementCategory: moveCat?.id,
      difficultyLevel: diffLevel?.level || 3,
    };
  });

  exerciseDatabaseCache = result;
  return result;
}

export function clearExerciseDatabaseCache(): void {
  exerciseDatabaseCache = null;
  _exerciseByIdIndex = null;
  _exerciseByNameIndex = null;
}

/**
 * Preload the exercise database to warm the cache before navigation.
 * Call this on screen mount to reduce latency when opening exercise picker.
 */
export function preloadExerciseDatabase(): void {
  // Fire and forget - warm the cache in the background
  if (!exerciseDatabaseCache) {
    getExerciseDatabase().catch(() => {
      // Silently ignore errors during preload
    });
  }
}

// ============================================
// FILTERING FUNCTIONS
// ============================================

export interface ExerciseFilters {
  search?: string;
  bodyRegion?: string;
  equipmentCategory?: string;
  movementCategory?: string;
  muscleGroup?: string;
  difficulty?: string;
}

/**
 * Filter exercises with the 3-pathway system
 */
export async function filterExercises(filters: ExerciseFilters): Promise<ExerciseDatabaseEntry[]> {
  const database = await getExerciseDatabase();
  let results = [...database];

  // Apply body region filter
  if (filters.bodyRegion && filters.bodyRegion !== 'all') {
    const region = Object.values(BODY_REGIONS).find(r => r.id === filters.bodyRegion);
    if (region) {
      results = results.filter(ex => {
        const targetGroup = ex.muscles?.targetGroup?.toLowerCase() || '';
        return region.muscleGroups.some(m => targetGroup.includes(m.toLowerCase()));
      });
    }
  }

  // Apply equipment category filter
  if (filters.equipmentCategory && filters.equipmentCategory !== 'all') {
    const category = Object.values(EQUIPMENT_CATEGORIES).find(c => c.id === filters.equipmentCategory);
    if (category) {
      results = results.filter(ex => {
        return ex.equipment.some(equip =>
          category.items.some(item =>
            equip.toLowerCase().includes(item.toLowerCase()) ||
            item.toLowerCase().includes(equip.toLowerCase())
          )
        );
      });
    }
  }

  // Apply movement pattern filter
  if (filters.movementCategory && filters.movementCategory !== 'all') {
    const category = Object.values(MOVEMENT_PATTERNS).find(c => c.id === filters.movementCategory);
    if (category) {
      results = results.filter(ex => {
        const patterns = ex.movementPatterns || [];
        return patterns.some(p =>
          category.patterns.some(cp =>
            p.toLowerCase().includes(cp.toLowerCase())
          )
        );
      });
    }
  }

  // Apply muscle group filter
  if (filters.muscleGroup && filters.muscleGroup !== 'all') {
    const normalized = filters.muscleGroup.toLowerCase();
    results = results.filter(ex => {
      const targetGroup = ex.muscles?.targetGroup?.toLowerCase() || '';
      const primeMover = ex.muscles?.primeMover?.toLowerCase() || '';
      return targetGroup.includes(normalized) || primeMover.includes(normalized);
    });
  }

  // Apply difficulty filter
  if (filters.difficulty && filters.difficulty !== 'all') {
    const normalized = filters.difficulty.toLowerCase();
    results = results.filter(ex => {
      const exDiff = (ex.difficulty || '').toLowerCase();
      return exDiff.includes(normalized);
    });
  }

  // Apply search filter
  if (filters.search && filters.search.trim()) {
    const query = filters.search.toLowerCase().trim();
    results = results.filter(ex => {
      const searchFields = [
        ex.name,
        ...(ex.aliases || []),
        ex.category,
        ...(ex.equipment || []),
        ex.muscles?.targetGroup,
        ex.muscles?.primeMover,
        ...(ex.movementPatterns || []),
      ].filter(Boolean).map(s => String(s).toLowerCase());

      return searchFields.some(field => field.includes(query));
    });
  }

  // Sort by difficulty level (easiest first) then alphabetically
  results.sort((a, b) => {
    const diffA = a.difficultyLevel || 3;
    const diffB = b.difficultyLevel || 3;
    if (diffA !== diffB) return diffA - diffB;
    return a.name.localeCompare(b.name);
  });

  return results;
}

/**
 * Get exercise counts by category for the navigation UI
 */
export async function getExerciseCounts(): Promise<{
  byBodyRegion: Record<string, number>;
  byEquipment: Record<string, number>;
  byMovement: Record<string, number>;
  byDifficulty: Record<string, number>;
  total: number;
}> {
  const database = await getExerciseDatabase();

  const counts = {
    byBodyRegion: {} as Record<string, number>,
    byEquipment: {} as Record<string, number>,
    byMovement: {} as Record<string, number>,
    byDifficulty: {} as Record<string, number>,
    total: database.length,
  };

  // Initialize all categories
  Object.values(BODY_REGIONS).forEach(r => counts.byBodyRegion[r.id] = 0);
  Object.values(EQUIPMENT_CATEGORIES).forEach(c => counts.byEquipment[c.id] = 0);
  Object.values(MOVEMENT_PATTERNS).forEach(p => counts.byMovement[p.id] = 0);
  DIFFICULTY_LEVELS.forEach(d => counts.byDifficulty[d.id] = 0);

  // Count exercises
  for (const ex of database) {
    // Body region
    if (ex.bodyRegion) {
      counts.byBodyRegion[ex.bodyRegion] = (counts.byBodyRegion[ex.bodyRegion] || 0) + 1;
    }

    // Equipment
    if (ex.equipmentCategory) {
      counts.byEquipment[ex.equipmentCategory] = (counts.byEquipment[ex.equipmentCategory] || 0) + 1;
    }

    // Movement
    if (ex.movementCategory) {
      counts.byMovement[ex.movementCategory] = (counts.byMovement[ex.movementCategory] || 0) + 1;
    }

    // Difficulty
    const diffLevel = getDifficultyLevel(ex.difficulty);
    if (diffLevel) {
      counts.byDifficulty[diffLevel.id] = (counts.byDifficulty[diffLevel.id] || 0) + 1;
    }
  }

  return counts;
}

// Legacy search function for compatibility
export async function searchExercises(query: string): Promise<ExerciseDatabaseEntry[]> {
  return filterExercises({ search: query });
}
