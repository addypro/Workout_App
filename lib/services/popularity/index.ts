/**
 * Popularity Service
 *
 * Main entry point for exercise popularity scoring.
 * Combines dynamic user data with static taxonomy scores.
 */

export {
  getPopularityScores,
  getExercisePopularity,
  refreshPopularityScores,
  invalidateMemoryCache,
  isDynamicPopularityActive,
  clearPopularityCache,
  saveLocalStats,
} from './cache';

export {
  calculateBayesianScore,
  calculateRawScore,
  meetsGlobalThreshold,
  meetsExerciseThreshold,
  mergeScores,
  buildMergedPopularityScores,
  getAlgorithmInfo,
  getStaticPopularityScores,
} from './algorithm';

export {
  normalizeExerciseName,
  createCanonicalKey,
  exerciseNamesMatch,
  extractBaseExercise,
} from './normalizer';
