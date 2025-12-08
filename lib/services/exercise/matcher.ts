// Exercise Matching Service
// Adapted for Expo/React Native

import { ExerciseDatabaseEntry, searchExercises, getExerciseDatabase } from './database';

export interface MatchResult {
  exercise: ExerciseDatabaseEntry;
  confidence: number;
  matchedName: string;
}

/**
 * Calculate Levenshtein distance between two strings
 * Optimized with early exit for large differences
 */
function levenshteinDistance(str1: string, str2: string, maxDistance?: number): number {
  const m = str1.length;
  const n = str2.length;

  // Early exit if difference in length exceeds max distance
  if (maxDistance !== undefined && Math.abs(m - n) > maxDistance) {
    return maxDistance + 1;
  }

  // Use space-optimized version (only need previous row)
  let prevRow: number[] = Array(n + 1).fill(0).map((_, i) => i);
  let currRow: number[] = Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    let minInRow = i;

    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        currRow[j] = prevRow[j - 1];
      } else {
        currRow[j] = Math.min(
          prevRow[j] + 1,     // deletion
          currRow[j - 1] + 1, // insertion
          prevRow[j - 1] + 1  // substitution
        );
      }
      minInRow = Math.min(minInRow, currRow[j]);
    }

    // Early exit if all values exceed max distance
    if (maxDistance !== undefined && minInRow > maxDistance) {
      return maxDistance + 1;
    }

    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[n];
}

/**
 * Calculate similarity score between 0 and 100
 * Optimized with early exit for low similarity
 */
function calculateSimilarity(str1: string, str2: string, minSimilarity: number = 0): number {
  const lower1 = str1.toLowerCase();
  const lower2 = str2.toLowerCase();

  // Quick exact match check
  if (lower1 === lower2) return 100;

  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 100;

  // Calculate max allowed distance for min similarity
  const maxDistance = Math.ceil(maxLength * (1 - minSimilarity / 100));

  const distance = levenshteinDistance(lower1, lower2, maxDistance);

  // Early exit if distance exceeds threshold
  if (distance > maxDistance) {
    return 0;
  }

  const similarity = ((maxLength - distance) / maxLength) * 100;
  return Math.max(0, Math.min(100, similarity));
}

/**
 * Match an exercise name to the database
 */
export async function matchExercise(exerciseName: string): Promise<MatchResult | null> {
  const lowerName = exerciseName.toLowerCase().trim();

  if (!lowerName) {
    return null;
  }

  // Search for exercises
  const candidates = await searchExercises(exerciseName);

  if (candidates.length === 0) {
    return null;
  }

  // Calculate confidence scores (only check aliases if name match is below threshold)
  const matches: MatchResult[] = candidates.map(ex => {
    let confidence = calculateSimilarity(exerciseName, ex.name, 50);
    let matchedName = ex.name;

    // Only check aliases if name match is below 80% (optimization)
    if (confidence < 80) {
      for (const alias of ex.aliases) {
        const aliasConfidence = calculateSimilarity(exerciseName, alias, confidence);
        if (aliasConfidence > confidence) {
          confidence = aliasConfidence;
          matchedName = alias;
          // Early exit if we find a very good match
          if (confidence >= 90) break;
        }
      }
    }

    return {
      exercise: ex,
      confidence: Math.round(confidence),
      matchedName,
    };
  });

  // Return best match if confidence is above threshold
  const bestMatch = matches[0];
  if (bestMatch.confidence >= 50) {
    return bestMatch;
  }

  return null;
}

/**
 * Match multiple exercises efficiently
 * Loads exercise database once and reuses it for all matches
 */
export async function matchExercises(exerciseNames: string[]): Promise<Map<string, MatchResult | null>> {
  const results = new Map<string, MatchResult | null>();

  if (exerciseNames.length === 0) {
    return results;
  }

  // Load exercise database once
  const database = await getExerciseDatabase();

  // Process all exercises
  for (const exerciseName of exerciseNames) {
    const lowerName = exerciseName.toLowerCase().trim();

    if (!lowerName) {
      results.set(exerciseName, null);
      continue;
    }

    // Use in-memory search
    const lowerQuery = lowerName;
    const scored = database.map(ex => {
      let score = 0;
      const lowerName = ex.name.toLowerCase();

      if (lowerName === lowerQuery) {
        score = 100;
      } else if (lowerName.startsWith(lowerQuery)) {
        score = 80;
      } else if (lowerName.includes(lowerQuery)) {
        score = 60;
      } else if (ex.aliases.some(a => a.toLowerCase().includes(lowerQuery))) {
        score = 40;
      }

      return { exercise: ex, score };
    });

    const candidates = scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(item => item.exercise);

    if (candidates.length === 0) {
      results.set(exerciseName, null);
      continue;
    }

    // Calculate best match
    let bestMatch: MatchResult | null = null;
    let bestConfidence = 0;

    for (const ex of candidates) {
      let confidence = calculateSimilarity(exerciseName, ex.name, bestConfidence);
      let matchedName = ex.name;

      if (confidence < 80) {
        for (const alias of ex.aliases) {
          const aliasConfidence = calculateSimilarity(exerciseName, alias, confidence);
          if (aliasConfidence > confidence) {
            confidence = aliasConfidence;
            matchedName = alias;
            if (confidence >= 90) break;
          }
        }
      }

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = {
          exercise: ex,
          confidence: Math.round(confidence),
          matchedName,
        };
      }
    }

    results.set(exerciseName, bestConfidence >= 50 ? bestMatch : null);
  }

  return results;
}
