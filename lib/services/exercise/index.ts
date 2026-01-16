/**
 * Exercise Service
 *
 * Unified exports for all exercise-related functionality.
 * Includes search, progressions, categories, and custom exercises.
 */

// ============================================
// TYPES
// ============================================
export * from './types';

// ============================================
// DATABASE
// O(1) lookup functions available for performance-critical code
// ============================================
export {
  getExerciseDatabase,
  getExerciseById,
  getExerciseByName,
  type ExerciseDatabaseEntry,
} from './database';

// ============================================
// SEARCH
// ============================================
export {
  type SearchFilters,
  type SearchResult,
} from './search';

// ============================================
// SEMANTIC SEARCH (CASP)
// Note: Functions exported for direct import only (not via barrel)
// Use: import { semanticSearch } from '@/lib/services/exercise/semantic-search'
// ============================================
export {
  type SemanticSearchResult,
  type SearchSuggestion,
} from './semantic-search';

// ============================================
// PROGRESSION DAG (Calistree-style)
// Note: Functions exported for direct import only (not via barrel)
// Use: import { getProgressions } from '@/lib/services/exercise/progression-dag'
// ============================================
export {
  type ProgressionRelation,
  type ProgressionNode,
  type ProgressionTree,
  type ExercisePath,
} from './progression-dag';

// ============================================
// CATEGORIES
// ============================================
export {
  BODY_REGIONS,
  EQUIPMENT_CATEGORIES,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
} from './categories';

// ============================================
// CUSTOM EXERCISES
// ============================================
export {
  getCustomExercises,
  createCustomExercise,
  updateCustomExercise,
  deleteCustomExercise,
  syncCustomExercises,
} from './custom-exercises';
