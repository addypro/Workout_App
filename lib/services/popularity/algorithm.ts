/**
 * Popularity Algorithm
 *
 * Implements Bayesian smoothing for exercise popularity scores.
 * Merges dynamic (user-generated) data with static taxonomy scores.
 */

import type { PopularityCache } from '@/lib/services/sync/types';
import { createCanonicalKey } from './normalizer';

// Algorithm constants
const PRIOR_STRENGTH = 100;      // Number of "virtual" users to assume
const PRIOR_SCORE = 50;          // Neutral starting point (0-100 scale)
const DYNAMIC_WEIGHT = 0.7;      // Weight for dynamic scores
const STATIC_WEIGHT = 0.3;       // Weight for static taxonomy scores

// Thresholds for applying dynamic adjustments
const MIN_TOTAL_WORKOUTS = 1000;
const MIN_UNIQUE_USERS = 100;
const MIN_EXERCISE_APPEARANCES = 100;
const MIN_EXERCISE_USERS = 50;

interface ExerciseUsageStats {
  exerciseName: string;
  totalAppearances: number;
  uniqueUsers: number;
  rawScore?: number;
}

interface PopularityConfig {
  totalWorkouts: number;
  uniqueUsers: number;
  exerciseStats: ExerciseUsageStats[];
}

/**
 * Calculate Bayesian-smoothed popularity score for an exercise
 *
 * Formula: (n × observed + prior_strength × prior) / (n + prior_strength)
 *
 * Where:
 * - n = unique users who used this exercise
 * - observed = raw popularity score (0-100)
 * - prior_strength = 100 (virtual users)
 * - prior = 50 (neutral starting point)
 */
export function calculateBayesianScore(
  uniqueUsers: number,
  rawScore: number
): number {
  const numerator = (uniqueUsers * rawScore) + (PRIOR_STRENGTH * PRIOR_SCORE);
  const denominator = uniqueUsers + PRIOR_STRENGTH;
  return numerator / denominator;
}

/**
 * Calculate raw popularity score from usage data
 * Score = (appearances / total_appearances) × 100, normalized
 */
export function calculateRawScore(
  appearances: number,
  totalAppearances: number
): number {
  if (totalAppearances === 0) return PRIOR_SCORE;

  // Calculate relative frequency
  const frequency = appearances / totalAppearances;

  // Scale to 0-100 (assuming max ~5% for most popular exercises)
  // Cap at 100
  const scaled = Math.min(100, frequency * 2000);

  return scaled;
}

/**
 * Check if global thresholds are met for applying dynamic adjustments
 */
export function meetsGlobalThreshold(config: PopularityConfig): boolean {
  return (
    config.totalWorkouts >= MIN_TOTAL_WORKOUTS &&
    config.uniqueUsers >= MIN_UNIQUE_USERS
  );
}

/**
 * Check if an individual exercise meets threshold for dynamic scoring
 */
export function meetsExerciseThreshold(stats: ExerciseUsageStats): boolean {
  return (
    stats.totalAppearances >= MIN_EXERCISE_APPEARANCES &&
    stats.uniqueUsers >= MIN_EXERCISE_USERS
  );
}

/**
 * Merge dynamic scores with static taxonomy scores
 *
 * Final = (dynamic_weight × dynamic) + (static_weight × static)
 * Default: 70% dynamic, 30% static
 */
export function mergeScores(
  dynamicScore: number,
  staticScore: number,
  meetsThreshold: boolean
): number {
  if (!meetsThreshold) {
    // Exercise doesn't have enough data - use static only
    return staticScore;
  }

  return (DYNAMIC_WEIGHT * dynamicScore) + (STATIC_WEIGHT * staticScore);
}

/**
 * Build merged popularity scores from dynamic cache and static taxonomy
 */
export function buildMergedPopularityScores(
  dynamicCache: PopularityCache | null,
  staticScores: Record<string, number>,
  config?: PopularityConfig
): Record<string, number> {
  const result: Record<string, number> = { ...staticScores };

  // If no dynamic data or global thresholds not met, return static only
  if (!dynamicCache || !config || !meetsGlobalThreshold(config)) {
    return result;
  }

  // Merge dynamic scores where thresholds are met
  for (const [exerciseName, dynamicScore] of Object.entries(dynamicCache.scores)) {
    const canonicalKey = createCanonicalKey(exerciseName);

    // Find matching static score
    const staticScore = findStaticScore(canonicalKey, staticScores);

    // Find exercise stats to check threshold
    const stats = config.exerciseStats.find(
      s => createCanonicalKey(s.exerciseName) === canonicalKey
    );

    const meetsThreshold = stats ? meetsExerciseThreshold(stats) : false;

    // Calculate merged score
    result[exerciseName] = mergeScores(dynamicScore, staticScore, meetsThreshold);
  }

  return result;
}

/**
 * Find the static score for an exercise, with fuzzy matching
 */
function findStaticScore(
  canonicalKey: string,
  staticScores: Record<string, number>
): number {
  // Direct match
  if (staticScores[canonicalKey] !== undefined) {
    return staticScores[canonicalKey];
  }

  // Try to find a matching key
  for (const [key, score] of Object.entries(staticScores)) {
    if (createCanonicalKey(key) === canonicalKey) {
      return score;
    }
  }

  // Default to neutral
  return PRIOR_SCORE;
}

/**
 * Get algorithm info for debugging/display
 */
export function getAlgorithmInfo() {
  return {
    priorStrength: PRIOR_STRENGTH,
    priorScore: PRIOR_SCORE,
    dynamicWeight: DYNAMIC_WEIGHT,
    staticWeight: STATIC_WEIGHT,
    minTotalWorkouts: MIN_TOTAL_WORKOUTS,
    minUniqueUsers: MIN_UNIQUE_USERS,
    minExerciseAppearances: MIN_EXERCISE_APPEARANCES,
    minExerciseUsers: MIN_EXERCISE_USERS,
  };
}

// Cache for static scores
let staticScoresCache: Record<string, number> | null = null;

/**
 * Get static popularity scores from global rankings and exercise taxonomy
 * These are the baseline scores before dynamic user data is applied
 *
 * Priority:
 * 1. Global rankings (Top 250 most logged exercises with voice aliases)
 * 2. Exercise taxonomy data
 * 3. Hardcoded defaults (fallback)
 */
export function getStaticPopularityScores(): Record<string, number> {
  if (staticScoresCache) {
    return staticScoresCache;
  }

  const scores: Record<string, number> = {};

  // 1. Load global popularity rankings (most accurate, with voice aliases)
  try {
    const { buildPopularityMap } = require('./global-rankings');
    const globalScores = buildPopularityMap();
    Object.assign(scores, globalScores);
  } catch (error) {
    console.warn('Failed to load global rankings:', error);
  }

  // 2. Load taxonomy data (supplement with additional exercises)
  try {
    const taxonomy = require('@/data/exercise-taxonomy.json');

    if (taxonomy.movement_patterns) {
      for (const pattern of taxonomy.movement_patterns) {
        if (pattern.exercises) {
          for (const exercise of pattern.exercises) {
            if (exercise.canonical_name && exercise.popularity_score !== undefined) {
              const name = exercise.canonical_name.toLowerCase();
              // Only add if not already in global rankings (global takes priority)
              if (scores[name] === undefined) {
                scores[name] = exercise.popularity_score;
              }

              // Also add aliases
              if (exercise.nlp_metadata?.aliases) {
                for (const alias of exercise.nlp_metadata.aliases) {
                  const aliasLower = alias.toLowerCase();
                  if (scores[aliasLower] === undefined) {
                    scores[aliasLower] = exercise.popularity_score;
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('Failed to load exercise taxonomy for static scores:', error);
  }

  // 3. Hardcoded defaults (fallback for common exercises)
  const defaults: Record<string, number> = {
    'bench press': 100,
    'squat': 99,
    'deadlift': 98,
    'overhead press': 96,
    'barbell row': 95,
    'pull up': 84,
    'chin up': 61,
    'dumbbell curl': 78,
    'tricep pushdown': 85,
    'leg curl': 19,
    'leg extension': 93,
    'lat pulldown': 97,
    'cable row': 88,
    'dumbbell press': 89,
    'incline bench press': 80,
    'romanian deadlift': 86,
    'hip thrust': 25,
    'lunges': 40,
    'calf raise': 10,
    'face pull': 81,
    'lateral raise': 94,
    'plank': 75,
    'crunch': 65,
  };

  for (const [name, score] of Object.entries(defaults)) {
    if (scores[name] === undefined) {
      scores[name] = score;
    }
  }

  staticScoresCache = scores;
  return scores;
}
