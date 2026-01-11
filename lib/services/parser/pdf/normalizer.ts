/**
 * Exercise Normalizer
 *
 * Matches raw exercise names from PDFs to the internal exercise database.
 * Uses fuzzy matching and semantic similarity.
 */

import {
  searchExercises,
  type ExerciseDatabaseEntry,
} from '@/lib/services/exercise/database';
import type { ExtractedExercise, ExtractedProgram } from './types';

// Common abbreviations and their expansions
const ABBREVIATIONS: Record<string, string[]> = {
  'db': ['dumbbell'],
  'bb': ['barbell'],
  'ez': ['ez bar', 'ez-bar'],
  'kb': ['kettlebell'],
  'sg': ['smith machine'],
  'btn': ['behind the neck'],
  'rdl': ['romanian deadlift'],
  'sldl': ['stiff leg deadlift', 'stiff-leg deadlift'],
  'cgbp': ['close grip bench press'],
  'ohp': ['overhead press'],
  'jm': ['jm press'],
  'inc': ['incline'],
  'dec': ['decline'],
  'lat': ['lateral'],
  'tri': ['tricep', 'triceps'],
  'bi': ['bicep', 'biceps'],
  'ext': ['extension'],
  'curl': ['curl'],
  'fly': ['flye', 'flies'],
  'ss': ['superset'],
  'alt': ['alternating'],
  'uni': ['unilateral', 'single arm', 'single leg'],
};

// Common exercise name variations
const VARIATIONS: Record<string, string[]> = {
  'bench press': ['bench', 'flat bench', 'chest press'],
  'squat': ['back squat', 'barbell squat'],
  'deadlift': ['conventional deadlift', 'dead lift'],
  'pullup': ['pull up', 'pull-up', 'chin up', 'chinup'],
  'pushup': ['push up', 'push-up'],
  'row': ['rowing'],
  'press': ['pressing'],
  'curl': ['curling'],
  'raise': ['raises'],
  'fly': ['flye', 'flies', 'flys'],
  'lunge': ['lunges', 'lunging'],
  'split squat': ['bulgarian split squat', 'bulgarian'],
  'hip thrust': ['glute bridge', 'barbell hip thrust'],
  'face pull': ['face pulls', 'facepull'],
  'tricep pushdown': ['pushdown', 'tricep extension cable'],
  'lateral raise': ['side raise', 'side lateral raise', 'delt raise'],
  'leg press': ['45 degree leg press', 'leg press machine'],
  'leg curl': ['lying leg curl', 'seated leg curl', 'hamstring curl'],
  'leg extension': ['quad extension', 'knee extension'],
  'calf raise': ['calf raises', 'standing calf raise', 'seated calf raise'],
  'shrug': ['shrugs', 'trap shrug'],
  'dip': ['dips', 'chest dip', 'tricep dip'],
  'skull crusher': ['skullcrusher', 'lying tricep extension'],
  'preacher curl': ['preacher', 'scott curl'],
  'hammer curl': ['hammers', 'hammer curls'],
  'cable crossover': ['cable cross', 'cable fly'],
};

/**
 * Normalize an exercise name by expanding abbreviations and standardizing format
 */
function normalizeExerciseName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Expand abbreviations
  for (const [abbrev, expansions] of Object.entries(ABBREVIATIONS)) {
    const pattern = new RegExp(`\\b${abbrev}\\b`, 'gi');
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, expansions[0]);
    }
  }

  // Remove common noise words
  normalized = normalized
    .replace(/\b(the|a|an)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
}

/**
 * Calculate similarity score between two strings (0-1)
 * Uses Levenshtein distance normalized by string length
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    const containmentScore = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
    return Math.max(0.8, containmentScore);
  }

  // Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - distance / maxLength;
}

/**
 * Find the best matching exercise from the database
 */
export async function findBestMatch(
  rawName: string,
  topN: number = 5
): Promise<{
  bestMatch: ExerciseDatabaseEntry | null;
  confidence: number;
  alternatives: Array<{ exercise: ExerciseDatabaseEntry; confidence: number }>;
}> {
  const normalizedName = normalizeExerciseName(rawName);

  // First, try direct search
  let searchResults = await searchExercises(normalizedName);

  // If no results, try with original name
  if (searchResults.length === 0) {
    searchResults = await searchExercises(rawName);
  }

  // If still no results, try word-by-word search
  if (searchResults.length === 0) {
    const words = normalizedName.split(' ').filter(w => w.length > 2);
    for (const word of words) {
      const wordResults = await searchExercises(word);
      searchResults.push(...wordResults);
    }
  }

  if (searchResults.length === 0) {
    return { bestMatch: null, confidence: 0, alternatives: [] };
  }

  // Calculate similarity scores for each result
  const scored = searchResults.map(exercise => {
    const nameNormalized = normalizeExerciseName(exercise.name);

    // Calculate multiple similarity metrics
    const directSimilarity = calculateSimilarity(normalizedName, nameNormalized);

    // Check against known variations
    let variationBonus = 0;
    for (const [canonical, variations] of Object.entries(VARIATIONS)) {
      if (nameNormalized.includes(canonical)) {
        for (const variation of variations) {
          if (normalizedName.includes(variation) || variation.includes(normalizedName)) {
            variationBonus = Math.max(variationBonus, 0.2);
          }
        }
      }
    }

    // Word overlap score
    const words1 = new Set(normalizedName.split(' '));
    const words2 = new Set(nameNormalized.split(' '));
    const intersection = [...words1].filter(w => words2.has(w));
    const union = new Set([...words1, ...words2]);
    const jaccardSimilarity = intersection.length / union.size;

    // Combined score
    const confidence = Math.min(
      1,
      directSimilarity * 0.5 + jaccardSimilarity * 0.3 + variationBonus + 0.2
    );

    return { exercise, confidence };
  });

  // Sort by confidence
  scored.sort((a, b) => b.confidence - a.confidence);

  // Remove duplicates
  const seen = new Set<string>();
  const unique = scored.filter(s => {
    if (seen.has(s.exercise.id)) return false;
    seen.add(s.exercise.id);
    return true;
  });

  const [best, ...rest] = unique;

  return {
    bestMatch: best?.exercise || null,
    confidence: best?.confidence || 0,
    alternatives: rest.slice(0, topN - 1),
  };
}

/**
 * Normalize all exercises in an extracted program
 */
export async function normalizeProgram(
  program: ExtractedProgram,
  confidenceThreshold: number = 0.7
): Promise<{
  normalizedProgram: ExtractedProgram;
  unmatchedExercises: Array<{
    nameRaw: string;
    suggestedMatches: Array<{ name: string; id: string; confidence: number }>;
  }>;
  stats: {
    totalExercises: number;
    matched: number;
    unmatched: number;
    averageConfidence: number;
  };
}> {
  const unmatchedExercises: Array<{
    nameRaw: string;
    suggestedMatches: Array<{ name: string; id: string; confidence: number }>;
  }> = [];

  let totalExercises = 0;
  let matchedCount = 0;
  let totalConfidence = 0;

  // Cache to avoid duplicate lookups
  const matchCache = new Map<string, Awaited<ReturnType<typeof findBestMatch>>>();

  // Process all exercises
  const normalizedProgram = { ...program };

  for (const week of normalizedProgram.weeks) {
    for (const workout of week.workouts) {
      for (const exercise of workout.exercises) {
        totalExercises++;

        const cacheKey = exercise.nameRaw.toLowerCase();
        let matchResult = matchCache.get(cacheKey);

        if (!matchResult) {
          matchResult = await findBestMatch(exercise.nameRaw);
          matchCache.set(cacheKey, matchResult);
        }

        if (matchResult.bestMatch && matchResult.confidence >= confidenceThreshold) {
          exercise.nameNormalized = matchResult.bestMatch.name;
          exercise.exerciseId = matchResult.bestMatch.id;
          exercise.matchConfidence = matchResult.confidence;
          matchedCount++;
          totalConfidence += matchResult.confidence;
        } else {
          // Add to unmatched list with suggestions
          const existingUnmatched = unmatchedExercises.find(
            u => u.nameRaw.toLowerCase() === exercise.nameRaw.toLowerCase()
          );

          if (!existingUnmatched) {
            unmatchedExercises.push({
              nameRaw: exercise.nameRaw,
              suggestedMatches: [
                ...(matchResult.bestMatch
                  ? [
                      {
                        name: matchResult.bestMatch.name,
                        id: matchResult.bestMatch.id,
                        confidence: matchResult.confidence,
                      },
                    ]
                  : []),
                ...matchResult.alternatives.map(a => ({
                  name: a.exercise.name,
                  id: a.exercise.id,
                  confidence: a.confidence,
                })),
              ],
            });
          }

          exercise.matchConfidence = matchResult.confidence;
          totalConfidence += matchResult.confidence;
        }
      }
    }
  }

  return {
    normalizedProgram,
    unmatchedExercises,
    stats: {
      totalExercises,
      matched: matchedCount,
      unmatched: totalExercises - matchedCount,
      averageConfidence: totalExercises > 0 ? totalConfidence / totalExercises : 0,
    },
  };
}

/**
 * Manual exercise mapping - user confirms or corrects matches
 */
export function applyManualMappings(
  program: ExtractedProgram,
  mappings: Record<string, { name: string; id: string }>
): ExtractedProgram {
  const updatedProgram = { ...program };

  for (const week of updatedProgram.weeks) {
    for (const workout of week.workouts) {
      for (const exercise of workout.exercises) {
        const mapping = mappings[exercise.nameRaw.toLowerCase()];
        if (mapping) {
          exercise.nameNormalized = mapping.name;
          exercise.exerciseId = mapping.id;
          exercise.matchConfidence = 1; // Manual confirmation = 100%
        }
      }
    }
  }

  return updatedProgram;
}
