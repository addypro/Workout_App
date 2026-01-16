/**
 * Advanced Exercise Search System
 *
 * Features:
 * - Popularity-based ranking (common exercises ranked higher)
 * - Fuzzy matching for typos
 * - Semantic/NLP search for natural language queries
 * - Hierarchical display with categories
 * - Taxonomy-based alias matching and slang dictionary
 * - Smart suggestions (progression/regression/siblings)
 */

import {
  getPopularityScores,
  isDynamicPopularityActive,
  refreshPopularityScores,
} from '@/lib/services/popularity';
import { ALL_GLOBAL_RANKINGS } from '@/lib/services/popularity/global-rankings';
import { levenshteinDistance } from '@/lib/utils/string-distance';
import {
  BODY_REGIONS,
  EQUIPMENT_CATEGORIES,
  MOVEMENT_PATTERNS
} from './categories';
import {
  customExerciseToSearchResult,
  searchCustomExercises,
} from './custom-exercises';
import { getExerciseDatabase, type ExerciseDatabaseEntry } from './database';
import { nlpIndexes } from './nlp-enrichment';
import { ensureExerciseSearchIndex, queryExerciseSearchIndex } from './search-index';

// ============================================
// TAXONOMY TYPES & HELPERS
// ============================================

export interface TaxonomyExercise {
  id: string;
  canonical_name: string;
  type: string;
  popularity_score: number;
  hierarchy?: {
    parent_id: string | null;
    is_default?: boolean;
    variations?: string[];
    variation_type?: string;
  };
  constraints?: {
    equipment?: string[];
    difficulty?: string;
    mechanics?: string;
    force?: string;
  };
  muscles?: {
    primary?: string[];
    secondary?: string[];
    stabilizers?: string[];
  };
  nlp_metadata?: {
    aliases?: string[];
    slang_terms?: string[];
    misspellings?: string[];
    intent_triggers?: string[];
  };
  smart_suggestions?: {
    progression_id?: string;
    regression_id?: string;
    siblings?: string[];
  };
  ui_prompts?: {
    clarification_question?: string;
    options?: Array<{ id: string; label: string; default?: boolean }>;
  };
}

// Use NLP-compatible MovementPattern with exercise names (string[])
// The actual TaxonomyExercise data is looked up via aliasToExerciseMap when needed
interface MovementPattern {
  pattern_id: string;
  canonical_name: string;
  description: string;
  icon: string;
  default_exercise_id: string;
  exercises: string[]; // Exercise names (lookup via aliasToExerciseMap)
}

interface SlangEntry {
  intent?: string;
  patterns?: string[];
  muscles?: string[];
  direct_match?: string;
  modifier?: string;
  note?: string;
  filter?: Record<string, any>;
}

// ============================================
// ACTION WORD PATTERN FILTERING
// ============================================
// This is the "100x expert" fix: Extract action words to filter to compatible
// movement patterns BEFORE fuzzy matching. This makes cross-body-part 
// mismatches IMPOSSIBLE by design.

const ACTION_WORD_PATTERNS: Record<string, string[]> = {
  // Horizontal Pull (Back) - rows and pulls
  'row': ['HORIZONTAL_PULL'],
  'rows': ['HORIZONTAL_PULL'],
  'rowing': ['HORIZONTAL_PULL'],

  // Vertical Pull (Back/Lats)
  'pulldown': ['VERTICAL_PULL'],
  'pulldowns': ['VERTICAL_PULL'],
  'pull-up': ['VERTICAL_PULL'],
  'pullup': ['VERTICAL_PULL'],
  'pullups': ['VERTICAL_PULL'],
  'pull-ups': ['VERTICAL_PULL'],
  'chin-up': ['VERTICAL_PULL'],
  'chinup': ['VERTICAL_PULL'],

  // Horizontal Push (Chest)
  'bench': ['HORIZONTAL_PUSH'],
  'fly': ['HORIZONTAL_PUSH', 'CHEST_ISOLATION'],
  'flys': ['HORIZONTAL_PUSH', 'CHEST_ISOLATION'],
  'flies': ['HORIZONTAL_PUSH', 'CHEST_ISOLATION'],
  'flye': ['HORIZONTAL_PUSH', 'CHEST_ISOLATION'],
  'crossover': ['CHEST_ISOLATION'],

  // Push (Chest + Shoulders)
  'press': ['HORIZONTAL_PUSH', 'VERTICAL_PUSH', 'ARM_TRICEPS'],
  'pushup': ['HORIZONTAL_PUSH'],
  'push-up': ['HORIZONTAL_PUSH'],
  'pushups': ['HORIZONTAL_PUSH'],
  'push-ups': ['HORIZONTAL_PUSH'],

  // Vertical Push (Shoulders)
  'overhead': ['VERTICAL_PUSH'],

  // Arms - Biceps
  'curl': ['ARM_BICEPS'],
  'curls': ['ARM_BICEPS'],
  'curling': ['ARM_BICEPS'],

  // Arms - Triceps
  'pushdown': ['ARM_TRICEPS'],
  'pushdowns': ['ARM_TRICEPS'],
  'extension': ['ARM_TRICEPS', 'LEG_MACHINE'], // tricep extension + leg extension
  'extensions': ['ARM_TRICEPS', 'LEG_MACHINE'],
  'kickback': ['ARM_TRICEPS', 'GLUTE_ISOLATION'],
  'skullcrusher': ['ARM_TRICEPS'],
  'skull': ['ARM_TRICEPS'], // skull crusher
  'dip': ['ARM_TRICEPS', 'HORIZONTAL_PUSH'],
  'dips': ['ARM_TRICEPS', 'HORIZONTAL_PUSH'],

  // Legs - Squat patterns
  'squat': ['SQUAT'],
  'squats': ['SQUAT'],
  'squatting': ['SQUAT'],
  'hack': ['SQUAT'], // hack squat

  // Legs - Lunge patterns
  'lunge': ['LUNGE'],
  'lunges': ['LUNGE'],
  'lunging': ['LUNGE'],
  'split': ['LUNGE'], // split squat
  'step': ['LUNGE'], // step up

  // Legs - Hinge (Posterior chain)
  'deadlift': ['HINGE'],
  'rdl': ['HINGE'],
  'hinge': ['HINGE'],
  'hip': ['HINGE', 'GLUTE_ISOLATION', 'LEG_MACHINE'],

  // Legs - Machine
  'leg': ['LEG_MACHINE', 'SQUAT', 'LUNGE', 'HINGE'],
  'calf': ['LEG_MACHINE'],
  'calves': ['LEG_MACHINE'],

  // Shoulders - Isolation
  'raise': ['SHOULDER_ISOLATION'],
  'raises': ['SHOULDER_ISOLATION'],
  'lateral': ['SHOULDER_ISOLATION'],
  'shrug': ['SHOULDER_ISOLATION'],
  'shrugs': ['SHOULDER_ISOLATION'],

  // Core
  'crunch': ['CORE_ISOLATION'],
  'crunches': ['CORE_ISOLATION'],
  'plank': ['CORE_ISOLATION'],
  'planks': ['CORE_ISOLATION'],
  'ab': ['CORE_ISOLATION'],
  'abs': ['CORE_ISOLATION'],
  'twist': ['CORE_ISOLATION'],

  // Glutes
  'thrust': ['GLUTE_ISOLATION'],
  'thrusts': ['GLUTE_ISOLATION'],
  'bridge': ['GLUTE_ISOLATION'],
  'bridges': ['GLUTE_ISOLATION'],
  'glute': ['GLUTE_ISOLATION'],
  'glutes': ['GLUTE_ISOLATION'],
};

/**
 * Extract action word from query and return compatible movement patterns.
 * Returns null if no action word is found (will skip pattern filtering).
 */
function extractActionWordPatterns(query: string): string[] | null {
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/);

  // Check each word against action word map
  for (const word of words) {
    if (ACTION_WORD_PATTERNS[word]) {
      return ACTION_WORD_PATTERNS[word];
    }
  }

  // Check for compound words (e.g., "pulldown" might be "pull down")
  for (const [actionWord, patterns] of Object.entries(ACTION_WORD_PATTERNS)) {
    if (queryLower.includes(actionWord) && actionWord.length >= 4) {
      return patterns;
    }
  }

  return null; // No action word found - don't filter by pattern
}

/**
 * Get all exercises in specified movement patterns
 * Note: Returns sync but relies on maps being pre-warmed by warmSearchIndex()
 */
function getExercisesInPatterns(patternIds: string[]): TaxonomyExercise[] {
  // Maps should already be initialized via warmSearchIndex() at app start
  // This is now a fast sync lookup
  const exercises: TaxonomyExercise[] = [];
  for (const pattern of nlpIndexes.movementPatterns) {
    if (patternIds.includes(pattern.pattern_id)) {
      // Look up each exercise by name
      for (const exerciseName of pattern.exercises) {
        const exercise = aliasToExerciseMap.get(exerciseName.toLowerCase());
        if (exercise) {
          exercises.push(exercise);
        }
      }
    }
  }
  return exercises;
}

// ============================================
// PRE-COMPUTED FILTER CACHE (INSTANT FILTER RESULTS)
// ============================================
// Maps filter key -> sorted exercises for O(1) filter lookup
// Key format: "bodyRegion:equipment" (e.g., "upper:dumbbells", "lower:", ":barbell")
const filterCache = new Map<string, TaxonomyExercise[]>();

function buildFilterCacheKey(bodyRegion?: string, equipment?: string): string {
  return `${bodyRegion || ''}:${equipment || ''}`;
}

// Pre-compute filter results at module load for instant filtering
async function initFilterCache(): Promise<void> {
  if (filterCache.size > 0) return; // Already initialized

  await initTaxonomyMaps(); // Ensure maps are ready
  const allExercises: TaxonomyExercise[] = [];
  for (const pattern of nlpIndexes.movementPatterns || []) {
    for (const exerciseName of pattern.exercises || []) {
      // Look up each exercise by name
      const exercise = aliasToExerciseMap.get(exerciseName.toLowerCase());
      if (exercise) {
        allExercises.push(exercise);
      }
    }
  }

  // Body regions from categories
  const bodyRegions = ['upper', 'lower', 'core', 'full', ''];
  const equipmentCategories = ['bodyweight', 'dumbbells', 'barbell', 'kettlebell', 'cables', 'bands', ''];

  // Build cache for each combination
  for (const bodyRegion of bodyRegions) {
    for (const equipment of equipmentCategories) {
      const key = buildFilterCacheKey(bodyRegion || undefined, equipment || undefined);

      // Skip empty key (no filters)
      if (key === ':') continue;

      const matched = allExercises.filter(ex =>
        taxonomyMatchesFilter(ex, {
          bodyRegion: bodyRegion || undefined,
          equipment: equipment || undefined
        })
      );

      // Sort by popularity
      matched.sort((a, b) => (b.popularity_score || 50) - (a.popularity_score || 50));

      filterCache.set(key, matched.slice(0, 40)); // Cache top 40
    }
  }

  console.log(`[FilterCache] Pre-computed ${filterCache.size} filter combinations`);
}

// Get cached filter results (O(1) lookup!)
function getCachedFilterResults(bodyRegion?: string, equipment?: string): TaxonomyExercise[] | null {
  const key = buildFilterCacheKey(bodyRegion, equipment);
  return filterCache.get(key) || null;
}

// Build lookup maps for fast access
const taxonomyExerciseMap = new Map<string, TaxonomyExercise>();
const aliasToExerciseMap = new Map<string, TaxonomyExercise>();
// Use NLP indexes for slang dictionary (O(1) lookup via pre-built hash map)
const slangDictionary: Record<string, SlangEntry> = nlpIndexes.slangDictionary as Record<string, SlangEntry>;

// Singleton promise for initialization (prevents race conditions)
let _initPromise: Promise<void> | null = null;
let _isInitialized = false;

/**
 * Initialize taxonomy maps with proper async handling.
 * Uses singleton pattern to prevent multiple concurrent initializations.
 *
 * STATE-OF-THE-ART PATTERN: This ensures first button press doesn't hang
 * by either returning immediately (if already initialized) or awaiting
 * the same Promise that's already in progress.
 */
async function initTaxonomyMaps(): Promise<void> {
  // Fast path: already initialized
  if (_isInitialized && taxonomyExerciseMap.size > 0) return;

  // If initialization is in progress, wait for it
  if (_initPromise) return _initPromise;

  // Start initialization
  _initPromise = (async () => {
    try {
      // PRIORITY 1: Add Hevy database exercises FIRST
      // This ensures all 429 Hevy exercises are searchable
      const hevyDb = await getExerciseDatabase();

      for (const exercise of hevyDb) {
        // Create a TaxonomyExercise-like entry for Hevy exercises
        const hevyEntry: TaxonomyExercise = {
          id: exercise.id,
          canonical_name: exercise.name,
          type: 'weighted',
          popularity_score: 80, // High priority
          constraints: {
            equipment: exercise.equipment,
          },
          muscles: exercise.muscles as any, // Hevy uses different muscle schema
          nlp_metadata: {
            aliases: exercise.aliases || [],
          },
        };

        // Map by name (Hevy format: "Bench Press (Barbell)")
        const nameLower = exercise.name.toLowerCase();
        if (!aliasToExerciseMap.has(nameLower)) {
          aliasToExerciseMap.set(nameLower, hevyEntry);
        }

        // Also map without equipment suffix for search
        // "Bench Press (Barbell)" → also searchable as "bench press"
        const withoutEquipMatch = exercise.name.match(/^(.+?)\s*\(([^)]+)\)$/);
        if (withoutEquipMatch) {
          const baseName = withoutEquipMatch[1].toLowerCase();
          if (!aliasToExerciseMap.has(baseName)) {
            aliasToExerciseMap.set(baseName, hevyEntry);
          }
        }

        // Map all aliases
        if (exercise.aliases) {
          for (const alias of exercise.aliases) {
            const aliasLower = alias.toLowerCase();
            if (!aliasToExerciseMap.has(aliasLower)) {
              aliasToExerciseMap.set(aliasLower, hevyEntry);
            }
          }
        }
      }
      console.log(`[Search] Added ${hevyDb.length} Hevy exercises to alias map`);

      // PRIORITY 2: Add NLP aliases (pre-built from taxonomy data)
      let nlpAliasesAdded = 0;
      for (const [alias, canonicalName] of Object.entries(nlpIndexes.aliasMap)) {
        const exercise = aliasToExerciseMap.get(canonicalName.toLowerCase());
        if (exercise && !aliasToExerciseMap.has(alias)) {
          aliasToExerciseMap.set(alias, exercise);
          nlpAliasesAdded++;
        }
      }
      console.log(`[Search] Added ${nlpAliasesAdded} NLP aliases`);

      // PRIORITY 3: Map slang dictionary direct_match entries
      for (const [slangTerm, entry] of Object.entries(slangDictionary)) {
        if (entry.direct_match) {
          const exercise = aliasToExerciseMap.get(entry.direct_match.toLowerCase());
          if (exercise && !aliasToExerciseMap.has(slangTerm.toLowerCase())) {
            aliasToExerciseMap.set(slangTerm.toLowerCase(), exercise);
          }
        }
      }

      // PRIORITY 4: Map aliases from global-rankings
      for (const ranking of ALL_GLOBAL_RANKINGS) {
        const exercise = aliasToExerciseMap.get(ranking.name.toLowerCase());
        if (exercise && ranking.aliases) {
          for (const alias of ranking.aliases) {
            if (!aliasToExerciseMap.has(alias.toLowerCase())) {
              aliasToExerciseMap.set(alias.toLowerCase(), exercise);
            }
          }
        }
      }

      _isInitialized = true;
      console.log(`[Search] Taxonomy maps initialized with ${aliasToExerciseMap.size} total entries`);
    } catch (error) {
      console.error('[Search] Failed to initialize taxonomy maps:', error);
      _initPromise = null; // Allow retry on failure
      throw error;
    }
  })();

  return _initPromise;
}

/**
 * Pre-warm the search index on app startup.
 * Call this early (e.g., in _layout.tsx useEffect) to ensure
 * first button press is instant.
 */
export async function warmSearchIndex(): Promise<void> {
  await initTaxonomyMaps();
  initFilterCache();
  await ensureExerciseSearchIndex();
}

// Lazy initialization - called on first search instead of module load

// ============================================
// TAXONOMY FILTER HELPER
// ============================================

/**
 * Filter taxonomy exercise by bodyRegion and/or equipment
 * Used to apply UI filters to taxonomy search results
 */
function taxonomyMatchesFilter(
  exercise: TaxonomyExercise,
  filters: { bodyRegion?: string; equipment?: string }
): boolean {
  // If no filters, match everything
  if (!filters.bodyRegion && !filters.equipment) return true;

  // Check body region filter
  if (filters.bodyRegion) {
    const region = Object.values(BODY_REGIONS).find(r => r.id === filters.bodyRegion);
    if (region) {
      const primaryMuscles = exercise.muscles?.primary || [];
      const hasMatchingMuscle = primaryMuscles.some(muscle =>
        region.muscleGroups.some(m => muscle.toLowerCase().includes(m.toLowerCase()))
      );
      if (!hasMatchingMuscle) return false;
    }
  }

  // Check equipment filter
  if (filters.equipment) {
    const category = Object.values(EQUIPMENT_CATEGORIES).find(c => c.id === filters.equipment);
    if (category) {
      const exerciseEquipment = exercise.constraints?.equipment || [];
      // If no equipment specified, check if bodyweight filter and exercise has no equipment
      if (exerciseEquipment.length === 0) {
        if (filters.equipment === 'bodyweight') return true;
        return false;
      }
      const hasMatchingEquipment = exerciseEquipment.some(equip =>
        category.items.some(item =>
          equip.toLowerCase().includes(item.toLowerCase()) ||
          item.toLowerCase().includes(equip.toLowerCase())
        )
      );
      if (!hasMatchingEquipment) return false;
    }
  }

  return true;
}

/**
 * Look up exercise by alias, slang term, or canonical name
 * Note: Sync lookup - relies on warmSearchIndex() being called at app start
 */
export function lookupExerciseByAlias(query: string): TaxonomyExercise | null {
  // Maps should be pre-warmed by warmSearchIndex() at app start
  const normalized = query.toLowerCase().trim();
  return aliasToExerciseMap.get(normalized) || null;
}

/**
 * Look up slang term and return matched exercises/patterns
 */
export function lookupSlang(term: string): {
  exercises: TaxonomyExercise[];
  patterns: string[];
  intent?: string;
} | null {
  const normalized = term.toLowerCase().trim();
  const entry = slangDictionary[normalized];

  if (!entry) return null;

  const result: {
    exercises: TaxonomyExercise[];
    patterns: string[];
    intent?: string;
  } = {
    exercises: [],
    patterns: entry.patterns || [],
    intent: entry.intent,
  };

  // If direct match, find the exercise
  if (entry.direct_match) {
    const exercise = aliasToExerciseMap.get(entry.direct_match.toLowerCase());
    if (exercise) result.exercises.push(exercise);
  }

  // Get exercises from patterns
  if (entry.patterns) {
    // Maps should be pre-warmed by warmSearchIndex() at app start
    for (const patternId of entry.patterns) {
      const pattern = nlpIndexes.movementPatterns.find(
        p => p.pattern_id === patternId
      );
      if (pattern) {
        // Look up each exercise by name
        for (const exerciseName of pattern.exercises) {
          const exercise = aliasToExerciseMap.get(exerciseName.toLowerCase());
          if (exercise) {
            result.exercises.push(exercise);
          }
        }
      }
    }
  }

  return result;
}

/**
 * Get smart suggestions for an exercise
 */
export function getSmartSuggestions(exerciseId: string): {
  progression: TaxonomyExercise | null;
  regression: TaxonomyExercise | null;
  siblings: TaxonomyExercise[];
} {
  const exercise = taxonomyExerciseMap.get(exerciseId);

  if (!exercise?.smart_suggestions) {
    return { progression: null, regression: null, siblings: [] };
  }

  return {
    progression: exercise.smart_suggestions.progression_id
      ? taxonomyExerciseMap.get(exercise.smart_suggestions.progression_id) || null
      : null,
    regression: exercise.smart_suggestions.regression_id
      ? taxonomyExerciseMap.get(exercise.smart_suggestions.regression_id) || null
      : null,
    siblings: (exercise.smart_suggestions.siblings || [])
      .map(id => taxonomyExerciseMap.get(id))
      .filter((ex): ex is TaxonomyExercise => ex !== undefined),
  };
}

/**
 * Get all exercises in a movement pattern
 * Converts exercise names from NLP index to TaxonomyExercise objects
 * Note: Sync lookup - relies on warmSearchIndex() being called at app start
 */
export function getExercisesByMovementPattern(patternId: string): TaxonomyExercise[] {
  // Maps should be pre-warmed by warmSearchIndex() at app start
  const pattern = nlpIndexes.movementPatterns.find(
    p => p.pattern_id === patternId
  );
  if (!pattern) return [];

  // Convert exercise names to TaxonomyExercise objects
  return pattern.exercises
    .map(name => aliasToExerciseMap.get(name.toLowerCase()))
    .filter((ex): ex is TaxonomyExercise => ex !== undefined);
}

/**
 * Get movement patterns for a muscle group
 * Uses NLP pattern index with exercise name lookups
 * Note: Sync lookup - relies on warmSearchIndex() being called at app start
 */
export function getPatternsForMuscle(muscle: string): typeof nlpIndexes.movementPatterns {
  // Maps should be pre-warmed by warmSearchIndex() at app start
  const normalizedMuscle = muscle.toLowerCase();

  return nlpIndexes.movementPatterns.filter(pattern => {
    return pattern.exercises.some(exerciseName => {
      // Look up the full exercise data by name
      const exercise = aliasToExerciseMap.get(exerciseName.toLowerCase());
      if (!exercise) return false;

      const allMuscles = [
        ...(exercise.muscles?.primary || []),
        ...(exercise.muscles?.secondary || []),
      ].map(m => m.toLowerCase());
      return allMuscles.some(m => m.includes(normalizedMuscle) || normalizedMuscle.includes(m));
    });
  });
}

/**
 * Match query against taxonomy using NLP metadata
 * NOW WITH ACTION-WORD PATTERN FILTERING: Extracts action words first
 * and filters to compatible movement patterns BEFORE fuzzy matching.
 * This makes cross-body-part mismatches IMPOSSIBLE.
 */
function matchTaxonomyExercises(query: string): TaxonomyExercise[] {
  const normalizedQuery = query.toLowerCase().trim();
  const matches: Array<{ exercise: TaxonomyExercise; score: number }> = [];

  // STEP 1: Extract action word and get compatible patterns
  const compatiblePatterns = extractActionWordPatterns(normalizedQuery);

  // STEP 2: Determine which patterns to search (use NLP patterns directly, no type cast)
  let patternsToSearch = nlpIndexes.movementPatterns;

  if (compatiblePatterns && compatiblePatterns.length > 0) {
    // Action word found - ONLY search compatible patterns
    patternsToSearch = nlpIndexes.movementPatterns
      .filter(p => compatiblePatterns.includes(p.pattern_id));
  }

  // STEP 3: Match within filtered patterns (look up exercise by name)
  // Maps should be pre-warmed by warmSearchIndex() at app start
  for (const pattern of patternsToSearch) {
    for (const exerciseName of pattern.exercises) {
      // Look up the full TaxonomyExercise object by name
      const exercise = aliasToExerciseMap.get(exerciseName.toLowerCase());
      if (!exercise) continue;

      let score = 0;

      // Exact canonical name match
      if (exercise.canonical_name.toLowerCase() === normalizedQuery) {
        score = 100;
      }
      // Partial canonical name match
      else if (exercise.canonical_name.toLowerCase().includes(normalizedQuery)) {
        score = 80;
      }
      // Alias match
      else if (exercise.nlp_metadata?.aliases?.some(a => a.toLowerCase().includes(normalizedQuery))) {
        score = 70;
      }
      // Check for word-boundary alias match (for multi-word queries)
      else if (normalizedQuery.includes(' ')) {
        const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);
        const allAliases = exercise.nlp_metadata?.aliases || [];
        for (const alias of allAliases) {
          const aliasLower = alias.toLowerCase();
          const aliasWords = aliasLower.split(/\s+/);
          const matchCount = queryWords.filter(qw =>
            aliasWords.some(aw => aw.includes(qw) || qw.includes(aw))
          ).length;
          if (matchCount >= Math.ceil(queryWords.length / 2)) {
            score = 60;
            break;
          }
        }
      }
      // Slang term match
      if (score === 0 && exercise.nlp_metadata?.slang_terms?.some(s => s.toLowerCase().includes(normalizedQuery))) {
        score = 65;
      }
      // Misspelling match
      else if (score === 0 && exercise.nlp_metadata?.misspellings?.some(m => m.toLowerCase().includes(normalizedQuery))) {
        score = 55;
      }
      // Intent trigger match
      else if (score === 0 && exercise.nlp_metadata?.intent_triggers?.some(i => normalizedQuery.includes(i.toLowerCase()))) {
        score = 45;
      }

      if (score > 0) {
        // Boost by popularity
        score += (exercise.popularity_score || 0) * 0.2;

        // Extra boost if this exercise is in a compatible pattern (action word match)
        if (compatiblePatterns && compatiblePatterns.includes(pattern.pattern_id)) {
          score += 15; // Pattern match bonus
        }

        matches.push({ exercise, score });
      }
    }
  }

  // Sort by score and return exercises
  return matches
    .sort((a, b) => b.score - a.score)
    .map(m => m.exercise);
}

// ============================================
// POPULARITY RANKINGS
// ============================================

/**
 * Static popularity scores (baseline before dynamic adjustments)
 * Scores are 1-100 scale based on exercise commonality
 */
const STATIC_EXERCISE_POPULARITY: Record<string, number> = {
  // Tier 1: Most Common (90-100)
  'bench press': 100,
  'squat': 99,
  'deadlift': 98,
  'pull up': 97,
  'push up': 96,
  'shoulder press': 95,
  'barbell row': 94,
  'lat pulldown': 93,
  'bicep curl': 92,
  'tricep extension': 91,
  'lunges': 90,

  // Tier 2: Very Popular (80-89)
  'incline bench press': 89,
  'dumbbell press': 88,
  'leg press': 87,
  'romanian deadlift': 86,
  'cable row': 85,
  'dips': 84,
  'plank': 83,
  'overhead press': 82,
  'chin up': 81,
  'hammer curl': 80,

  // Tier 3: Popular (70-79)
  'leg curl': 79,
  'leg extension': 78,
  'face pull': 77,
  'lateral raise': 76,
  'front raise': 75,
  'calf raise': 74,
  'hip thrust': 73,
  'cable fly': 72,
  'skull crusher': 71,
  'preacher curl': 70,

  // Tier 4: Common (60-69)
  'decline bench press': 69,
  'pendlay row': 68,
  'sumo deadlift': 67,
  'front squat': 66,
  'bulgarian split squat': 65,
  'good morning': 64,
  'shrug': 63,
  'upright row': 62,
  'concentration curl': 61,
  'tricep pushdown': 60,

  // Tier 5: Known (50-59)
  'cable crossover': 59,
  'machine fly': 58,
  't-bar row': 57,
  'seated row': 56,
  'hack squat': 55,
  'goblet squat': 54,
  'step up': 53,
  'glute bridge': 52,
  'reverse fly': 51,
  'arnold press': 50,
};

// Cached merged popularity scores (static + dynamic)
let cachedPopularityScores: Record<string, number> | null = null;
let popularityScoresPromise: Promise<Record<string, number>> | null = null;

/**
 * Get merged popularity scores (async, with caching)
 * Combines static baseline with dynamic user-generated scores
 */
async function getMergedPopularityScores(): Promise<Record<string, number>> {
  if (cachedPopularityScores) {
    return cachedPopularityScores;
  }

  // Avoid multiple concurrent fetches
  if (popularityScoresPromise) {
    return popularityScoresPromise;
  }

  popularityScoresPromise = getPopularityScores(STATIC_EXERCISE_POPULARITY)
    .then(scores => {
      cachedPopularityScores = scores;
      popularityScoresPromise = null;
      return scores;
    })
    .catch(() => {
      popularityScoresPromise = null;
      return STATIC_EXERCISE_POPULARITY;
    });

  return popularityScoresPromise;
}

/**
 * Force refresh popularity scores from server
 */
export async function refreshExercisePopularity(): Promise<void> {
  cachedPopularityScores = null;
  cachedPopularityScores = await refreshPopularityScores(STATIC_EXERCISE_POPULARITY);
}

/**
 * Check if dynamic popularity is currently active
 */
export async function isUsingDynamicPopularity(): Promise<boolean> {
  return isDynamicPopularityActive();
}

/**
 * Keyword synonyms for semantic search
 */
const SEMANTIC_SYNONYMS: Record<string, string[]> = {
  // Body parts
  'chest': ['pec', 'pecs', 'pectoral', 'chest'],
  'back': ['lats', 'latissimus', 'rhomboid', 'back', 'rear'],
  'shoulders': ['delts', 'deltoid', 'shoulder'],
  'biceps': ['bicep', 'guns', 'arms', 'curl'],
  'triceps': ['tricep', 'arms', 'pushdown'],
  'legs': ['quads', 'quadriceps', 'hamstrings', 'glutes', 'leg'],
  'core': ['abs', 'abdominal', 'obliques', 'stomach', 'six pack'],
  'glutes': ['butt', 'booty', 'hip', 'glute'],

  // Movement types
  'push': ['press', 'pushing', 'extension'],
  'pull': ['row', 'pulling', 'curl'],
  'compound': ['multi-joint', 'big', 'main', 'heavy'],
  'isolation': ['single-joint', 'accessory', 'finisher'],

  // Goals
  'strength': ['power', 'strong', 'heavy', 'max'],
  'hypertrophy': ['muscle', 'size', 'growth', 'bodybuilding', 'mass'],
  'endurance': ['stamina', 'conditioning', 'cardio'],
  'fat burning': ['weight loss', 'cardio', 'burn', 'hiit', 'lean'],
  'toning': ['define', 'shape', 'sculpt', 'tone'],

  // Difficulty
  'beginner': ['easy', 'simple', 'basic', 'starter', 'newbie'],
  'advanced': ['hard', 'difficult', 'challenging', 'expert'],

  // Equipment
  'no equipment': ['bodyweight', 'home', 'anywhere', 'no gym'],
  'dumbbell': ['db', 'dumbbells', 'free weight'],
  'barbell': ['bb', 'bar', 'olympic'],
  'machine': ['cable', 'pulley', 'machine'],
  'resistance band': ['band', 'bands', 'elastic'],
};

/**
 * Natural language intent patterns
 */
const INTENT_PATTERNS: Array<{
  pattern: RegExp;
  filters: Partial<SearchFilters>;
}> = [
    // Fat burning / weight loss
    { pattern: /fat\s*burn|weight\s*loss|lean|slim/i, filters: { goals: ['cardio', 'hiit'], difficulty: 'beginner' } },

    // Beginner-friendly
    { pattern: /beginner|start|new|easy|simple/i, filters: { difficulty: 'beginner' } },

    // Home workout
    { pattern: /home|no\s*equipment|bodyweight|anywhere/i, filters: { equipment: 'bodyweight' } },

    // Muscle building
    { pattern: /build\s*muscle|hypertrophy|mass|size|gain/i, filters: { goals: ['compound', 'strength'] } },

    // Specific body parts
    { pattern: /chest|pec/i, filters: { bodyRegion: 'upper', muscleGroup: 'chest' } },
    { pattern: /back|lats/i, filters: { bodyRegion: 'upper', muscleGroup: 'back' } },
    { pattern: /shoulder|delt/i, filters: { bodyRegion: 'upper', muscleGroup: 'shoulders' } },
    { pattern: /bicep|arm.*curl/i, filters: { bodyRegion: 'upper', muscleGroup: 'biceps' } },
    { pattern: /tricep/i, filters: { bodyRegion: 'upper', muscleGroup: 'triceps' } },
    { pattern: /leg|quad|hamstring/i, filters: { bodyRegion: 'lower' } },
    { pattern: /glute|butt|booty|hip/i, filters: { bodyRegion: 'lower', muscleGroup: 'glutes' } },
    { pattern: /core|abs|abdominal/i, filters: { bodyRegion: 'core' } },

    // Equipment specific
    { pattern: /dumbbell|db/i, filters: { equipment: 'dumbbells' } },
    { pattern: /barbell|bb/i, filters: { equipment: 'barbell' } },
    { pattern: /kettlebell|kb/i, filters: { equipment: 'kettlebell' } },
    { pattern: /cable|machine/i, filters: { equipment: 'cables' } },
    { pattern: /band|resistance\s*band/i, filters: { equipment: 'bands' } },
  ];

// ============================================
// TYPES
// ============================================

export interface SearchFilters {
  query?: string;
  bodyRegion?: string;
  equipment?: string;
  muscleGroup?: string;
  difficulty?: string;
  goals?: string[];
}

export interface SearchResult extends ExerciseDatabaseEntry {
  score: number;
  matchReason?: string;
}

export interface SearchResults {
  popular: SearchResult[];
  byCategory: {
    category: string;
    categoryName: string;
    icon: string;
    color: string;
    exercises: SearchResult[];
  }[];
  total: number;
  query: string;
  semanticIntent?: string;
}

// ============================================
// SEARCH FUNCTIONS
// ============================================

/**
 * Calculate popularity score for an exercise
 * Priority: 1) Taxonomy score, 2) Dynamic scores, 3) Static scores, 4) Default
 */
function getPopularityScore(exercise: ExerciseDatabaseEntry): number {
  const nameLower = exercise.name.toLowerCase();

  // 1. Check taxonomy first (most accurate - curated scores for core exercises)
  const taxonomyExercise = aliasToExerciseMap.get(nameLower);
  if (taxonomyExercise?.popularity_score) {
    return taxonomyExercise.popularity_score;
  }

  // 2. Check for partial taxonomy match
  for (const [alias, taxEx] of aliasToExerciseMap.entries()) {
    if (nameLower.includes(alias) || alias.includes(nameLower.split(' ')[0])) {
      if (taxEx.popularity_score) {
        return taxEx.popularity_score;
      }
    }
  }

  // 3. Use dynamic/static merged scores
  const popularityMap = cachedPopularityScores || STATIC_EXERCISE_POPULARITY;

  // Check exact matches
  for (const [key, score] of Object.entries(popularityMap)) {
    if (nameLower.includes(key) || key.includes(nameLower.split(' ')[0])) {
      return score;
    }
  }

  // Check partial matches
  const nameWords = nameLower.split(/\s+/);
  for (const [key, score] of Object.entries(popularityMap)) {
    const keyWords = key.split(/\s+/);
    const matchingWords = keyWords.filter(kw => nameWords.some(nw => nw.includes(kw) || kw.includes(nw)));
    if (matchingWords.length > 0) {
      return Math.round(score * (matchingWords.length / keyWords.length));
    }
  }

  return 30; // Default score for unknown/long-tail exercises
}


/**
 * Calculate relevance score for a search query
 * Enhanced with fuzzy matching and improved alias scoring
 */
function calculateRelevanceScore(
  exercise: ExerciseDatabaseEntry,
  query: string,
  filters: SearchFilters
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];
  const queryLower = query.toLowerCase().trim();
  const nameLower = exercise.name.toLowerCase();

  // Exact name match (highest priority)
  if (nameLower === queryLower) {
    score += 100;
    reasons.push('exact match');
  } else if (nameLower.includes(queryLower)) {
    score += 70;
    reasons.push('name contains query');
  } else if (nameLower.startsWith(queryLower.split(' ')[0])) {
    score += 60;
    reasons.push('name starts with query');
  } else {
    // Fuzzy match using Levenshtein distance (for typos)
    const distance = levenshteinDistance(queryLower, nameLower);
    const maxLen = Math.max(queryLower.length, nameLower.length);
    const similarity = 1 - distance / maxLen;
    if (similarity >= 0.7) {
      score += Math.round(similarity * 50);
      reasons.push('fuzzy match');
    }
  }

  // Check aliases - with improved word-boundary scoring
  if (exercise.aliases && exercise.aliases.length > 0) {
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);

    for (const alias of exercise.aliases) {
      const aliasLower = alias.toLowerCase();
      const aliasWords = aliasLower.split(/\s+/).filter(w => w.length > 1);

      if (aliasLower === queryLower) {
        // Exact alias match (highest score)
        score += 95;
        reasons.push(`exact alias: ${alias}`);
        break;
      }

      // Count how many query words appear in alias words (word boundary match)
      const matchingWords = queryWords.filter(qw =>
        aliasWords.some(aw => aw === qw || aw.startsWith(qw) || qw.startsWith(aw))
      );

      if (matchingWords.length === queryWords.length && queryWords.length > 0) {
        // All query words match alias words - strong match
        score += 85;
        reasons.push(`all words match alias: ${alias}`);
        break;
      } else if (aliasLower.includes(queryLower)) {
        // Alias contains full query string
        score += 70;
        reasons.push(`alias contains: ${alias}`);
        break;
      } else if (matchingWords.length > 0 && matchingWords.length >= queryWords.length / 2) {
        // At least half the query words match - partial match
        const matchRatio = matchingWords.length / queryWords.length;
        score += Math.round(45 * matchRatio);
        reasons.push(`partial word match: ${alias}`);
        break;
      } else if (queryLower.includes(aliasLower) && aliasLower.length >= 5) {
        // Query contains alias (for 5+ char partial names only)
        score += 40;
        reasons.push(`query contains alias: ${alias}`);
        break;
      } else {
        // Fuzzy alias match (lower threshold)
        const distance = levenshteinDistance(queryLower, aliasLower);
        const maxLen = Math.max(queryLower.length, aliasLower.length);
        const similarity = 1 - distance / maxLen;
        if (similarity >= 0.8) {
          score += Math.round(similarity * 35);
          reasons.push(`fuzzy alias: ${alias}`);
          break;
        }
      }
    }
  }

  // Semantic synonym matching
  for (const [term, synonyms] of Object.entries(SEMANTIC_SYNONYMS)) {
    if (synonyms.some(s => queryLower.includes(s))) {
      // Check if exercise matches the term
      const muscleTarget = exercise.muscles?.targetGroup?.toLowerCase() || '';
      const muscleSecondary = exercise.muscles?.secondary?.toLowerCase() || '';
      const equipment = exercise.equipment.join(' ').toLowerCase();
      const patterns = (exercise.movementPatterns || []).join(' ').toLowerCase();

      const searchFields = [nameLower, muscleTarget, muscleSecondary, equipment, patterns];
      if (searchFields.some(f => f.includes(term) || synonyms.some(s => f.includes(s)))) {
        score += 40;
        reasons.push(`semantic: ${term}`);
      }
    }
  }

  // Add popularity bonus
  const popularityScore = getPopularityScore(exercise);
  score += popularityScore * 0.3; // 30% weight for popularity

  // Difficulty matching
  if (filters.difficulty) {
    const exerciseDiff = (exercise.difficulty || '').toLowerCase();
    if (exerciseDiff.includes(filters.difficulty.toLowerCase())) {
      score += 20;
      reasons.push('difficulty match');
    }
  }

  // Equipment matching
  if (filters.equipment) {
    const hasEquipment = exercise.equipment.some(e =>
      e.toLowerCase().includes(filters.equipment!.toLowerCase())
    );
    if (hasEquipment) {
      score += 25;
      reasons.push('equipment match');
    }
  }

  return { score, reason: reasons.join(', ') };
}

/**
 * Parse natural language query for semantic intent
 */
function parseSemanticIntent(query: string): { filters: SearchFilters; intent: string } {
  const filters: SearchFilters = {};
  const intents: string[] = [];

  for (const { pattern, filters: patternFilters } of INTENT_PATTERNS) {
    if (pattern.test(query)) {
      Object.assign(filters, patternFilters);
      const match = query.match(pattern);
      if (match) intents.push(match[0]);
    }
  }

  return {
    filters,
    intent: intents.join(' + ') || 'general search',
  };
}

/**
 * Advanced hierarchical search with popularity ranking
 */
export async function searchExercisesAdvanced(
  query: string,
  userFilters: SearchFilters = {}
): Promise<SearchResults> {
  // Ensure maps are ready (properly awaited)
  await initTaxonomyMaps();

  const database = await getExerciseDatabase();
  const queryLower = query.toLowerCase().trim();
  let searchPool = database;

  if (queryLower) {
    const candidateIds = await queryExerciseSearchIndex(queryLower, 300);
    if (candidateIds.length > 0) {
      const idSet = new Set(candidateIds);
      searchPool = database.filter(exercise => idSet.has(exercise.id));
    }
  }

  // Parse semantic intent from query
  const { filters: semanticFilters, intent } = parseSemanticIntent(query);
  const combinedFilters = { ...semanticFilters, ...userFilters };

  // Score all exercises
  const scoredExercises: SearchResult[] = searchPool.map(exercise => {
    const { score, reason } = calculateRelevanceScore(exercise, queryLower, combinedFilters);
    return { ...exercise, score, matchReason: reason };
  });

  // Filter based on minimum score (if there's a query)
  let filtered = queryLower
    ? scoredExercises.filter(ex => ex.score > 20)
    : scoredExercises;

  // Apply additional filters
  if (combinedFilters.bodyRegion && combinedFilters.bodyRegion !== 'all') {
    const region = Object.values(BODY_REGIONS).find(r => r.id === combinedFilters.bodyRegion);
    if (region) {
      filtered = filtered.filter(ex => {
        const targetGroup = ex.muscles?.targetGroup?.toLowerCase() || '';
        return region.muscleGroups.some(m => targetGroup.includes(m.toLowerCase()));
      });
    }
  }

  if (combinedFilters.equipment && combinedFilters.equipment !== 'all') {
    const category = Object.values(EQUIPMENT_CATEGORIES).find(c => c.id === combinedFilters.equipment);
    if (category) {
      filtered = filtered.filter(ex =>
        ex.equipment.some(equip =>
          category.items.some(item =>
            equip.toLowerCase().includes(item.toLowerCase())
          )
        )
      );
    }
  }

  if (combinedFilters.muscleGroup && combinedFilters.muscleGroup !== 'all') {
    const normalized = combinedFilters.muscleGroup.toLowerCase();
    filtered = filtered.filter(ex => {
      const target = ex.muscles?.targetGroup?.toLowerCase() || '';
      const prime = ex.muscles?.primeMover?.toLowerCase() || '';
      return target.includes(normalized) || prime.includes(normalized);
    });
  }

  // Sort by score (descending)
  filtered.sort((a, b) => b.score - a.score);

  // Get top popular exercises (score > 60)
  const popular = filtered.filter(ex => ex.score > 60).slice(0, 8);

  // Group remaining by category (body region)
  const byCategory = Object.values(BODY_REGIONS).map(region => {
    const regionExercises = filtered.filter(ex => {
      const targetGroup = ex.muscles?.targetGroup?.toLowerCase() || '';
      return region.muscleGroups.some(m => targetGroup.includes(m.toLowerCase()));
    });

    return {
      category: region.id,
      categoryName: region.name,
      icon: region.icon,
      color: region.color,
      exercises: regionExercises.slice(0, 20), // Limit per category
    };
  }).filter(cat => cat.exercises.length > 0);

  return {
    popular,
    byCategory,
    total: filtered.length,
    query,
    semanticIntent: intent,
  };
}

/**
 * Get popular exercises personalized by user history
 * 
 * Scoring formula:
 * - Base: catalog/database popularity (0-100)
 * - Boost: user frequency * 5 (capped at 50)
 * 
 * New users see catalog-based popular exercises.
 * Active users see their frequently-used exercises ranked higher.
 */
export async function getPopularExercises(
  limit = 20,
  userId = 'local'
): Promise<SearchResult[]> {
  const database = await getExerciseDatabase();

  // Get user exercise frequency from workout history
  const { getUserExerciseFrequency } = await import('@/lib/db/storage');
  const userFrequency = await getUserExerciseFrequency(userId);

  const scored = database.map(exercise => {
    const basePop = getPopularityScore(exercise); // 0-100
    const exerciseNameLower = exercise.name.toLowerCase().trim();
    const userCount = userFrequency[exerciseNameLower] || 0;

    // User frequency boost: each workout adds 5 points, capped at 50
    const userBoost = Math.min(userCount * 5, 50);

    return {
      ...exercise,
      score: basePop + userBoost,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

/**
 * Get exercises by category with popularity sorting
 */
export async function getExercisesByCategory(
  categoryType: 'bodyRegion' | 'equipment' | 'movement',
  categoryId: string
): Promise<SearchResult[]> {
  const database = await getExerciseDatabase();

  let filtered: ExerciseDatabaseEntry[];

  switch (categoryType) {
    case 'bodyRegion': {
      const region = Object.values(BODY_REGIONS).find(r => r.id === categoryId);
      if (!region) return [];
      filtered = database.filter(ex => {
        const targetGroup = ex.muscles?.targetGroup?.toLowerCase() || '';
        return region.muscleGroups.some(m => targetGroup.includes(m.toLowerCase()));
      });
      break;
    }
    case 'equipment': {
      const category = Object.values(EQUIPMENT_CATEGORIES).find(c => c.id === categoryId);
      if (!category) return [];
      filtered = database.filter(ex =>
        ex.equipment.some(equip =>
          category.items.some(item =>
            equip.toLowerCase().includes(item.toLowerCase())
          )
        )
      );
      break;
    }
    case 'movement': {
      const category = Object.values(MOVEMENT_PATTERNS).find(c => c.id === categoryId);
      if (!category) return [];
      filtered = database.filter(ex =>
        (ex.movementPatterns || []).some(p =>
          category.patterns.some(cp =>
            p.toLowerCase().includes(cp.toLowerCase())
          )
        )
      );
      break;
    }
    default:
      filtered = [];
  }

  // Add scores and sort by popularity
  const scored = filtered.map(ex => ({
    ...ex,
    score: getPopularityScore(ex),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored;
}

// Note: levenshteinDistance is imported from @/lib/utils/string-distance


// ============================================
// ENHANCED SEARCH WITH TAXONOMY
// ============================================

export interface TaxonomySearchResult {
  taxonomyExercise: TaxonomyExercise;
  databaseMatch: ExerciseDatabaseEntry | null;
  score: number;
  matchType: 'exact' | 'alias' | 'slang' | 'intent' | 'fuzzy';
  suggestions?: {
    progression: TaxonomyExercise | null;
    regression: TaxonomyExercise | null;
    siblings: TaxonomyExercise[];
  };
}

export interface EnhancedSearchResults {
  // Primary results from taxonomy (smart matching)
  taxonomyMatches: TaxonomySearchResult[];
  // Additional results from database (broader search)
  databaseMatches: SearchResult[];
  // Custom user-created exercises
  customMatches: Array<{
    id: string;
    name: string;
    score: number;
    source: 'custom' | 'promoted';
    usageCount: number;
  }>;
  // Slang interpretation (if detected)
  slangInterpretation?: {
    term: string;
    intent: string;
    suggestedPatterns: string[];
  };
  // Movement pattern recommendations
  patternRecommendations: Array<{
    pattern_id: string;
    canonical_name: string;
    description: string;
    exercises: TaxonomyExercise[];
  }>;
  total: number;
  query: string;
}

/**
 * Enhanced search combining taxonomy intelligence with database breadth
 * This is the primary search function for the exercise picker
 */
export async function searchExercisesEnhanced(
  query: string,
  filters: SearchFilters = {}
): Promise<EnhancedSearchResults> {
  // Ensure maps are ready (properly awaited)
  await initTaxonomyMaps();

  const database = await getExerciseDatabase();
  const normalizedQuery = query.toLowerCase().trim();

  const result: EnhancedSearchResults = {
    taxonomyMatches: [],
    databaseMatches: [],
    customMatches: [],
    patternRecommendations: [],
    total: 0,
    query,
  };

  const hasFilters = !!(filters.bodyRegion || filters.equipment);
  const hasQuery = normalizedQuery.length > 0;

  // FILTER-ONLY MODE: No search query but filters are active
  // OPTIMIZED: Use pre-computed cache for INSTANT (O(1)) filter results
  if (!hasQuery && hasFilters) {
    // Initialize cache on first use (lazy initialization)
    await initFilterCache();

    // Try cache first (O(1) lookup!)
    const cachedExercises = getCachedFilterResults(filters.bodyRegion, filters.equipment);

    if (cachedExercises && cachedExercises.length > 0) {
      // Use cached results - instant!
      for (const exercise of cachedExercises.slice(0, 30)) {
        result.taxonomyMatches.push({
          taxonomyExercise: exercise,
          databaseMatch: null, // Skip expensive lookup
          score: exercise.popularity_score || 50,
          matchType: 'exact',
          suggestions: undefined, // Skip expensive suggestions
        });
      }
    } else {
      // Cache miss - fall back to computation (rare)
      // Maps already initialized above
      const seenIds = new Set<string>();
      const matched: TaxonomyExercise[] = [];

      for (const pattern of nlpIndexes.movementPatterns || []) {
        for (const exerciseName of pattern.exercises || []) {
          // Look up the full TaxonomyExercise object by name
          const exercise = aliasToExerciseMap.get(exerciseName.toLowerCase());
          if (!exercise) continue;

          if (seenIds.has(exercise.id)) continue;
          if (taxonomyMatchesFilter(exercise, { bodyRegion: filters.bodyRegion, equipment: filters.equipment })) {
            seenIds.add(exercise.id);
            matched.push(exercise);
          }
        }
      }

      matched.sort((a, b) => (b.popularity_score || 50) - (a.popularity_score || 50));
      for (const exercise of matched.slice(0, 30)) {
        result.taxonomyMatches.push({
          taxonomyExercise: exercise,
          databaseMatch: null,
          score: exercise.popularity_score || 50,
          matchType: 'exact',
          suggestions: undefined,
        });
      }
    }

    // Get database matches (already optimized with filters)
    const { popular, byCategory } = await searchExercisesAdvanced('', filters);
    const taxonomyNames = new Set(
      result.taxonomyMatches.map(m => m.taxonomyExercise.canonical_name.toLowerCase())
    );

    for (const dbExercise of [...popular, ...byCategory.flatMap(c => c.exercises)]) {
      if (!taxonomyNames.has(dbExercise.name.toLowerCase())) {
        result.databaseMatches.push(dbExercise);
      }
    }

    result.total = result.taxonomyMatches.length + result.databaseMatches.length;
    return result;
  }

  // 1. Check for slang terms first
  const slangResult = lookupSlang(normalizedQuery);
  if (slangResult) {
    result.slangInterpretation = {
      term: normalizedQuery,
      intent: slangResult.intent || 'general',
      suggestedPatterns: slangResult.patterns,
    };

    // Add taxonomy exercises from slang match (filtered by bodyRegion/equipment)
    for (const exercise of slangResult.exercises.slice(0, 20)) {
      // Apply filter - skip if doesn't match bodyRegion/equipment
      if (!taxonomyMatchesFilter(exercise, { bodyRegion: filters.bodyRegion, equipment: filters.equipment })) {
        continue;
      }
      const dbMatch = findDatabaseMatch(exercise, database);
      result.taxonomyMatches.push({
        taxonomyExercise: exercise,
        databaseMatch: dbMatch,
        score: exercise.popularity_score || 50,
        matchType: 'slang',
        suggestions: getSmartSuggestions(exercise.id),
      });
    }

    // Add pattern recommendations from slang
    for (const patternId of slangResult.patterns) {
      const pattern = nlpIndexes.movementPatterns.find(
        p => p.pattern_id === patternId
      );
      if (pattern) {
        // Exercise names are now strings, return as-is for pattern recommendations
        result.patternRecommendations.push({
          pattern_id: pattern.pattern_id,
          canonical_name: pattern.canonical_name,
          description: pattern.description,
          exercises: pattern.exercises.slice(0, 5) as any, // Names as strings
        });
      }
    }
  }

  // 2. Match against taxonomy using NLP metadata (filtered by bodyRegion/equipment)
  const taxonomyMatches = matchTaxonomyExercises(normalizedQuery);
  for (const exercise of taxonomyMatches) {
    // Skip if already added via slang
    if (result.taxonomyMatches.some(m => m.taxonomyExercise.id === exercise.id)) {
      continue;
    }

    // Apply filter - skip if doesn't match bodyRegion/equipment
    if (!taxonomyMatchesFilter(exercise, { bodyRegion: filters.bodyRegion, equipment: filters.equipment })) {
      continue;
    }

    const dbMatch = findDatabaseMatch(exercise, database);
    const matchType = determineMatchType(exercise, normalizedQuery);

    result.taxonomyMatches.push({
      taxonomyExercise: exercise,
      databaseMatch: dbMatch,
      score: exercise.popularity_score || 50,
      matchType,
      suggestions: getSmartSuggestions(exercise.id),
    });
  }

  // 3. Search database for additional matches not in taxonomy
  const { popular, byCategory, total } = await searchExercisesAdvanced(query, filters);

  // Add database matches that aren't already in taxonomy results
  const taxonomyNames = new Set(
    result.taxonomyMatches.map(m => m.taxonomyExercise.canonical_name.toLowerCase())
  );

  for (const dbExercise of [...popular, ...byCategory.flatMap(c => c.exercises)]) {
    if (!taxonomyNames.has(dbExercise.name.toLowerCase())) {
      result.databaseMatches.push(dbExercise);
    }
  }

  // Deduplicate database matches
  const seenNames = new Set<string>();
  result.databaseMatches = result.databaseMatches.filter(ex => {
    const nameLower = ex.name.toLowerCase();
    if (seenNames.has(nameLower)) return false;
    seenNames.add(nameLower);
    return true;
  });

  // 4. Search custom user-created exercises
  try {
    const customExercises = await searchCustomExercises(normalizedQuery);
    for (const customEx of customExercises) {
      // Skip if already in taxonomy or database results
      const customNameLower = customEx.name.toLowerCase();
      if (taxonomyNames.has(customNameLower) || seenNames.has(customNameLower)) {
        continue;
      }
      result.customMatches.push({
        ...customExerciseToSearchResult(customEx),
        usageCount: customEx.usageCount,
      });
    }
  } catch (error) {
    // Custom exercises are optional - don't fail the whole search
    console.warn('Failed to search custom exercises:', error);
  }

  // Limit results
  result.taxonomyMatches = result.taxonomyMatches.slice(0, 15);
  result.databaseMatches = result.databaseMatches.slice(0, 20);
  result.customMatches = result.customMatches.slice(0, 10);

  result.total = result.taxonomyMatches.length + result.databaseMatches.length + result.customMatches.length;

  return result;
}

/**
 * Find matching database entry for a taxonomy exercise
 */
function findDatabaseMatch(
  taxonomyExercise: TaxonomyExercise,
  database: ExerciseDatabaseEntry[]
): ExerciseDatabaseEntry | null {
  const canonicalLower = taxonomyExercise.canonical_name.toLowerCase();
  const aliases = taxonomyExercise.nlp_metadata?.aliases?.map(a => a.toLowerCase()) || [];

  // Try exact canonical name match first
  let match = database.find(ex => ex.name.toLowerCase() === canonicalLower);
  if (match) return match;

  // Try alias matches
  for (const alias of aliases) {
    match = database.find(ex => ex.name.toLowerCase() === alias);
    if (match) return match;
  }

  // Try partial match
  match = database.find(ex => {
    const nameLower = ex.name.toLowerCase();
    return nameLower.includes(canonicalLower) || canonicalLower.includes(nameLower);
  });

  return match || null;
}

/**
 * Determine how the query matched the exercise
 */
function determineMatchType(
  exercise: TaxonomyExercise,
  query: string
): 'exact' | 'alias' | 'slang' | 'intent' | 'fuzzy' {
  const canonicalLower = exercise.canonical_name.toLowerCase();

  if (canonicalLower === query || canonicalLower.includes(query)) {
    return 'exact';
  }

  if (exercise.nlp_metadata?.aliases?.some(a => a.toLowerCase().includes(query))) {
    return 'alias';
  }

  if (exercise.nlp_metadata?.slang_terms?.some(s => s.toLowerCase().includes(query))) {
    return 'slang';
  }

  if (exercise.nlp_metadata?.intent_triggers?.some(i => query.includes(i.toLowerCase()))) {
    return 'intent';
  }

  return 'fuzzy';
}

/**
 * Export movement pattern type for external use
 * TaxonomyExercise is already exported at definition (line 39)
 */
export type { MovementPattern };

// ============================================
// RE-EXPORT SEMANTIC SEARCH MODULE
// ============================================

export {
  findExerciseByAnyName, generateCanonicalSlug, getExerciseBySlug, getTopSuggestions, invalidateSearchIndex, semanticSearch, type SearchSuggestion, type SemanticSearchResult
} from './semantic-search';
