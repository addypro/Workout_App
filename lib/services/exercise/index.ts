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
// ============================================
export {
  getExerciseDatabase,
  type ExerciseDatabaseEntry,
} from './database';

// ============================================
// SEARCH
// ============================================
export {
  getExerciseById,
  type SearchFilters,
  type SearchResult,
} from './search';

// ============================================
// SEMANTIC SEARCH (CASP)
// ============================================
export {
  findExerciseByAnyName,
  getTopSuggestions,
  semanticSearch,
  generateCanonicalSlug,
  getExerciseBySlug,
  invalidateSearchIndex,
  type SemanticSearchResult,
  type SearchSuggestion,
} from './semantic-search';

// ============================================
// PROGRESSION DAG (Calistree-style)
// ============================================
export {
  getProgressions,
  getRegressions,
  getSiblings,
  buildProgressionTree,
  findPath,
  getProgressionCategory,
  getRecommendedNext,
  getSkillTree,
  invalidateProgressionIndex,
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
