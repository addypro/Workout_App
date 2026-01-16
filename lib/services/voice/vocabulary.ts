/**
 * Vocabulary Boosting Service
 * Extracts exercise names and aliases from taxonomy for STT vocabulary hints
 *
 * Uses global popularity rankings (Top 250 most logged exercises) for priority ordering
 */

import taxonomyData from '@/data/legacy/exercise-taxonomy.json';
import { ALL_GLOBAL_RANKINGS, getAllVoiceAliases, TOP_20_EXERCISES } from '@/lib/services/popularity/global-rankings';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllIntentCommands } from './intent-mapping';

const VOCABULARY_CACHE_KEY = '@voice_vocabulary_cache';
const VOCABULARY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface VocabularyCache {
  vocabulary: string[];
  timestamp: number;
}

// High-priority workout command words
const COMMAND_VOCABULARY = [
  // Set/rep terms
  'sets', 'set', 'reps', 'rep', 'repetitions',
  'warmup', 'working', 'top', 'drop', 'failure',

  // Weight terms
  'pounds', 'lbs', 'kilograms', 'kg', 'kilos',
  'plates', 'weight', 'heavy', 'light',

  // Structure terms
  'superset', 'giant set', 'drop set', 'rest pause',
  'circuit', 'amrap', 'emom',

  // Actions
  'add', 'remove', 'change', 'modify', 'start', 'done',
  'skip', 'next', 'previous', 'finish', 'rest', 'pause',

  // Workout types
  'push', 'pull', 'legs', 'upper', 'lower', 'full body',
  'chest', 'back', 'shoulders', 'arms', 'core', 'glutes',

  // Common modifiers
  'incline', 'decline', 'flat', 'seated', 'standing',
  'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight',
  'single arm', 'single leg', 'unilateral', 'bilateral',
];

// Most common exercise names (manually curated for priority)
const PRIORITY_EXERCISES = [
  // Big compound lifts
  'bench press', 'squat', 'deadlift', 'overhead press',
  'barbell row', 'pull up', 'chin up', 'dip',

  // Popular variations
  'incline bench press', 'front squat', 'romanian deadlift',
  'sumo deadlift', 'close grip bench press', 'leg press',

  // Common accessory exercises
  'bicep curl', 'tricep pushdown', 'lateral raise',
  'face pull', 'leg curl', 'leg extension', 'calf raise',
  'lat pulldown', 'cable fly', 'dumbbell fly',

  // Core exercises
  'plank', 'crunch', 'hanging leg raise', 'russian twist',

  // Machine exercises
  'chest press', 'shoulder press', 'row machine',
  'hack squat', 'smith machine', 'cable crossover',
];

/**
 * Extract all exercise names and aliases from taxonomy
 */
function extractTaxonomyVocabulary(): string[] {
  const vocabulary = new Set<string>();

  try {
    const data = taxonomyData as any;

    // Extract from movement patterns
    if (data.movement_patterns) {
      for (const pattern of data.movement_patterns) {
        // Pattern name
        if (pattern.canonical_name) {
          vocabulary.add(pattern.canonical_name.toLowerCase());
        }

        // Exercises in pattern
        if (pattern.exercises) {
          for (const exercise of pattern.exercises) {
            // Canonical name
            if (exercise.canonical_name) {
              vocabulary.add(exercise.canonical_name.toLowerCase());
            }

            // Aliases
            if (exercise.nlp_metadata?.aliases) {
              for (const alias of exercise.nlp_metadata.aliases) {
                vocabulary.add(alias.toLowerCase());
              }
            }

            // Slang terms
            if (exercise.nlp_metadata?.slang_terms) {
              for (const slang of exercise.nlp_metadata.slang_terms) {
                vocabulary.add(slang.toLowerCase());
              }
            }
          }
        }
      }
    }

    // Extract from slang dictionary
    if (data.slang_dictionary) {
      for (const term of Object.keys(data.slang_dictionary)) {
        vocabulary.add(term.toLowerCase());

        // Direct matches
        const entry = data.slang_dictionary[term];
        if (entry.direct_match) {
          vocabulary.add(entry.direct_match.toLowerCase());
        }
      }
    }
  } catch (error) {
    console.warn('Failed to extract taxonomy vocabulary:', error);
  }

  return Array.from(vocabulary);
}

/**
 * Get vocabulary bias array for STT
 * Combines global rankings (Top 250), commands, and taxonomy data
 * Priority order matters for STT engines - most common exercises first
 */
export async function getVocabularyBias(): Promise<string[]> {
  try {
    // Check cache first
    const cached = await AsyncStorage.getItem(VOCABULARY_CACHE_KEY);
    if (cached) {
      const { vocabulary, timestamp } = JSON.parse(cached) as VocabularyCache;
      if (Date.now() - timestamp < VOCABULARY_CACHE_TTL) {
        return vocabulary;
      }
    }

    // Build vocabulary list (priority order matters for some STT engines)
    const vocabulary: string[] = [];
    const seen = new Set<string>();

    const addTerm = (term: string) => {
      const lower = term.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        vocabulary.push(lower);
      }
    };

    // 1. Top 20 exercises first (most frequently logged globally)
    for (const exercise of TOP_20_EXERCISES) {
      addTerm(exercise.name);
      exercise.aliases.forEach(addTerm);
    }

    // 2. All global rankings (Top 250 with voice aliases)
    for (const exercise of ALL_GLOBAL_RANKINGS) {
      addTerm(exercise.name);
      exercise.aliases.forEach(addTerm);
    }

    // 3. All voice aliases from global rankings (for fuzzy matching)
    getAllVoiceAliases().forEach(addTerm);

    // 4. Intent commands (squat, bench, deadlift, etc.)
    getAllIntentCommands().forEach(addTerm);

    // 5. Command vocabulary
    COMMAND_VOCABULARY.forEach(addTerm);

    // 6. Legacy priority exercises (fallback)
    PRIORITY_EXERCISES.forEach(addTerm);

    // 7. Taxonomy-extracted vocabulary (additional coverage)
    extractTaxonomyVocabulary().forEach(addTerm);

    // Cache for next time
    await AsyncStorage.setItem(
      VOCABULARY_CACHE_KEY,
      JSON.stringify({
        vocabulary,
        timestamp: Date.now(),
      })
    );

    return vocabulary;
  } catch (error) {
    console.warn('Failed to get vocabulary bias:', error);
    // Return global rankings + intent commands + commands on error
    const fallback = [
      ...TOP_20_EXERCISES.map(e => e.name.toLowerCase()),
      ...getAllVoiceAliases(),
      ...getAllIntentCommands(),
      ...COMMAND_VOCABULARY,
    ];
    return [...new Set(fallback)];
  }
}

/**
 * Get just the command vocabulary (for simple command recognition)
 */
export function getCommandVocabulary(): string[] {
  return COMMAND_VOCABULARY;
}

/**
 * Get priority exercise names (for quick matching)
 */
export function getPriorityExercises(): string[] {
  return PRIORITY_EXERCISES;
}

/**
 * Clear vocabulary cache (call when taxonomy updates)
 */
export async function clearVocabularyCache(): Promise<void> {
  await AsyncStorage.removeItem(VOCABULARY_CACHE_KEY);
}

/**
 * Get vocabulary statistics (for debugging)
 */
export async function getVocabularyStats(): Promise<{
  total: number;
  commands: number;
  priorityExercises: number;
  taxonomyTerms: number;
  cached: boolean;
}> {
  const taxonomyTerms = extractTaxonomyVocabulary();
  const cached = await AsyncStorage.getItem(VOCABULARY_CACHE_KEY);

  return {
    total: COMMAND_VOCABULARY.length + PRIORITY_EXERCISES.length + taxonomyTerms.length,
    commands: COMMAND_VOCABULARY.length,
    priorityExercises: PRIORITY_EXERCISES.length,
    taxonomyTerms: taxonomyTerms.length,
    cached: !!cached,
  };
}
