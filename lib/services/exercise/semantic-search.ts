/**
 * Semantic Exercise Search (CASP - Context-Aware Semantic Parser)
 *
 * Implements a robust 3-layer search and mapping system:
 * 1. Layer 1: Semantic Parser - Fuzzy matching with Levenshtein distance
 * 2. Layer 2: Entity Resolver - Maps to standardized exercise ontology
 * 3. Layer 3: Mapping Dictionary - Aliases array for alternative names
 *
 * Features:
 * - Sub-100ms execution for user "flow state"
 * - Offline-first, no cloud API dependencies
 * - Case-insensitive matching
 * - Canonical slugs for data portability
 */

import { getExerciseDatabase, type ExerciseDatabaseEntry } from './database';
import {
  levenshteinDistanceOptimized as levenshteinDistance,
  stringSimilarity,
} from '@/lib/utils/string-distance';

// ============================================
// TYPES
// ============================================

export interface SemanticSearchResult {
  exercise: ExerciseDatabaseEntry;
  score: number;
  matchType: 'exact' | 'alias' | 'fuzzy' | 'partial';
  matchedTerm?: string;
  canonicalSlug: string;
}

export interface SearchSuggestion {
  exercise: ExerciseDatabaseEntry;
  similarity: number;
  reason: string;
}

// ============================================
// SEARCH INDEX (Built on first search for O(1) lookups)
// ============================================

interface SearchIndex {
  // Map of lowercase name -> exercise
  byExactName: Map<string, ExerciseDatabaseEntry>;
  // Map of lowercase alias -> exercise
  byAlias: Map<string, ExerciseDatabaseEntry>;
  // Map of canonical slug -> exercise
  bySlug: Map<string, ExerciseDatabaseEntry>;
  // All searchable terms for fuzzy matching
  allTerms: Array<{ term: string; exercise: ExerciseDatabaseEntry; isAlias: boolean }>;
  // Built timestamp
  builtAt: number;
}

let searchIndex: SearchIndex | null = null;
let indexBuildPromise: Promise<SearchIndex> | null = null;

/**
 * Generate canonical slug from exercise name
 * e.g., "Barbell Bench Press" -> "bb_bench_press"
 */
export function generateCanonicalSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/barbell/gi, 'bb')
    .replace(/dumbbell/gi, 'db')
    .replace(/kettlebell/gi, 'kb')
    .replace(/cable/gi, 'cable')
    .replace(/machine/gi, 'machine')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

/**
 * Build search index from exercise database
 * This is done once and cached for O(1) lookups
 */
async function buildSearchIndex(): Promise<SearchIndex> {
  if (searchIndex && Date.now() - searchIndex.builtAt < 5 * 60 * 1000) {
    return searchIndex;
  }

  if (indexBuildPromise) {
    return indexBuildPromise;
  }

  indexBuildPromise = (async () => {
    const database = await getExerciseDatabase();

    const index: SearchIndex = {
      byExactName: new Map(),
      byAlias: new Map(),
      bySlug: new Map(),
      allTerms: [],
      builtAt: Date.now(),
    };

    for (const exercise of database) {
      const nameLower = exercise.name.toLowerCase();
      const slug = generateCanonicalSlug(exercise.name);

      // Index by exact name
      index.byExactName.set(nameLower, exercise);

      // Index by slug
      index.bySlug.set(slug, exercise);

      // Add name to fuzzy search terms
      index.allTerms.push({ term: nameLower, exercise, isAlias: false });

      // Index all aliases
      for (const alias of exercise.aliases || []) {
        const aliasLower = alias.toLowerCase();
        index.byAlias.set(aliasLower, exercise);
        index.allTerms.push({ term: aliasLower, exercise, isAlias: true });
      }
    }

    searchIndex = index;
    indexBuildPromise = null;
    return index;
  })();

  return indexBuildPromise;
}

// Note: levenshteinDistance and stringSimilarity are imported from @/lib/utils/string-distance
// Using stringSimilarity as calculateSimilarity
const calculateSimilarity = stringSimilarity;

// ============================================
// MAIN SEARCH FUNCTIONS
// ============================================

/**
 * Find exercise by any name (canonical, alias, or fuzzy match)
 * Implements the 3-layer CASP system
 *
 * @param input - User input (exercise name/alias/variation)
 * @returns Best match with score and match type
 */
export async function findExerciseByAnyName(
  input: string
): Promise<SemanticSearchResult | null> {
  const startTime = performance.now();
  const index = await buildSearchIndex();
  const inputLower = input.toLowerCase().trim();

  // Layer 1: Exact name match (O(1))
  const exactMatch = index.byExactName.get(inputLower);
  if (exactMatch) {
    logPerformance('findExerciseByAnyName', startTime, 'exact');
    return {
      exercise: exactMatch,
      score: 100,
      matchType: 'exact',
      matchedTerm: exactMatch.name,
      canonicalSlug: generateCanonicalSlug(exactMatch.name),
    };
  }

  // Layer 2: Alias match (O(1))
  const aliasMatch = index.byAlias.get(inputLower);
  if (aliasMatch) {
    logPerformance('findExerciseByAnyName', startTime, 'alias');
    return {
      exercise: aliasMatch,
      score: 95,
      matchType: 'alias',
      matchedTerm: inputLower,
      canonicalSlug: generateCanonicalSlug(aliasMatch.name),
    };
  }

  // Layer 3: Fuzzy matching with Levenshtein distance
  let bestMatch: { term: string; exercise: ExerciseDatabaseEntry; score: number; isAlias: boolean } | null = null;

  // For short inputs, use stricter matching
  const maxDistance = inputLower.length <= 5 ? 2 : Math.ceil(inputLower.length * 0.3);

  for (const entry of index.allTerms) {
    // Quick length check to skip obviously non-matching terms
    if (Math.abs(entry.term.length - inputLower.length) > maxDistance) continue;

    // Check for substring match first (faster than Levenshtein)
    if (entry.term.includes(inputLower) || inputLower.includes(entry.term)) {
      const score = entry.term.includes(inputLower) ? 85 : 75;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { ...entry, score };
      }
      continue;
    }

    // Calculate Levenshtein distance
    const distance = levenshteinDistance(inputLower, entry.term, maxDistance);
    if (distance <= maxDistance) {
      const similarity = 1 - distance / Math.max(inputLower.length, entry.term.length);
      const score = Math.round(similarity * 70); // Max 70 for fuzzy matches

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { ...entry, score };
      }
    }
  }

  if (bestMatch && bestMatch.score >= 40) {
    logPerformance('findExerciseByAnyName', startTime, 'fuzzy');
    return {
      exercise: bestMatch.exercise,
      score: bestMatch.score,
      matchType: bestMatch.score >= 75 ? 'partial' : 'fuzzy',
      matchedTerm: bestMatch.term,
      canonicalSlug: generateCanonicalSlug(bestMatch.exercise.name),
    };
  }

  logPerformance('findExerciseByAnyName', startTime, 'no-match');
  return null;
}

/**
 * Get top 3 closest exercise suggestions for a query
 * Used when no exact match is found
 */
export async function getTopSuggestions(
  input: string,
  limit: number = 3
): Promise<SearchSuggestion[]> {
  const startTime = performance.now();
  const index = await buildSearchIndex();
  const inputLower = input.toLowerCase().trim();

  const suggestions: Array<{
    exercise: ExerciseDatabaseEntry;
    similarity: number;
    term: string;
    isAlias: boolean;
  }> = [];

  // Score all terms
  for (const entry of index.allTerms) {
    // Calculate similarity
    let similarity = calculateSimilarity(inputLower, entry.term);

    // Boost for substring matches
    if (entry.term.includes(inputLower)) {
      similarity = Math.max(similarity, 0.8);
    } else if (inputLower.includes(entry.term)) {
      similarity = Math.max(similarity, 0.7);
    }

    // Boost for word matches
    const inputWords = inputLower.split(/\s+/);
    const termWords = entry.term.split(/\s+/);
    const matchingWords = inputWords.filter(iw =>
      termWords.some(tw => tw.includes(iw) || iw.includes(tw))
    );
    if (matchingWords.length > 0) {
      const wordBoost = matchingWords.length / Math.max(inputWords.length, termWords.length);
      similarity = Math.max(similarity, 0.5 + wordBoost * 0.3);
    }

    if (similarity >= 0.3) {
      suggestions.push({
        exercise: entry.exercise,
        similarity,
        term: entry.term,
        isAlias: entry.isAlias,
      });
    }
  }

  // Sort by similarity and deduplicate
  suggestions.sort((a, b) => b.similarity - a.similarity);

  const seen = new Set<string>();
  const result: SearchSuggestion[] = [];

  for (const s of suggestions) {
    if (seen.has(s.exercise.name)) continue;
    seen.add(s.exercise.name);

    result.push({
      exercise: s.exercise,
      similarity: s.similarity,
      reason: s.isAlias
        ? `Matches alias "${s.term}"`
        : s.similarity >= 0.9
        ? 'Very close match'
        : s.similarity >= 0.7
        ? 'Similar name'
        : 'Partial match',
    });

    if (result.length >= limit) break;
  }

  logPerformance('getTopSuggestions', startTime, `${result.length} results`);
  return result;
}

/**
 * Search exercises with combined exact, alias, and fuzzy matching
 * Returns results sorted by relevance score
 */
export async function semanticSearch(
  query: string,
  limit: number = 20
): Promise<SemanticSearchResult[]> {
  const startTime = performance.now();
  const index = await buildSearchIndex();
  const queryLower = query.toLowerCase().trim();

  if (!queryLower) return [];

  const results: Map<string, SemanticSearchResult> = new Map();

  // Check exact match first
  const exactMatch = index.byExactName.get(queryLower);
  if (exactMatch) {
    results.set(exactMatch.name, {
      exercise: exactMatch,
      score: 100,
      matchType: 'exact',
      matchedTerm: exactMatch.name,
      canonicalSlug: generateCanonicalSlug(exactMatch.name),
    });
  }

  // Check alias matches
  const aliasMatch = index.byAlias.get(queryLower);
  if (aliasMatch && !results.has(aliasMatch.name)) {
    results.set(aliasMatch.name, {
      exercise: aliasMatch,
      score: 95,
      matchType: 'alias',
      matchedTerm: queryLower,
      canonicalSlug: generateCanonicalSlug(aliasMatch.name),
    });
  }

  // Fuzzy and partial matching
  const queryWords = queryLower.split(/\s+/);

  for (const entry of index.allTerms) {
    if (results.has(entry.exercise.name)) continue;

    let score = 0;
    let matchType: 'fuzzy' | 'partial' = 'fuzzy';

    // Substring contains check
    if (entry.term.includes(queryLower)) {
      score = 85;
      matchType = 'partial';
    } else if (queryLower.includes(entry.term) && entry.term.length >= 4) {
      score = 75;
      matchType = 'partial';
    } else {
      // Word-level matching
      const termWords = entry.term.split(/\s+/);
      const matchingWords = queryWords.filter(qw =>
        termWords.some(tw => tw.includes(qw) || qw.includes(tw))
      );

      if (matchingWords.length > 0) {
        score = 50 + (matchingWords.length / queryWords.length) * 30;
        matchType = 'partial';
      } else {
        // Levenshtein for very similar terms
        const similarity = calculateSimilarity(queryLower, entry.term);
        if (similarity >= 0.6) {
          score = Math.round(similarity * 60);
        }
      }
    }

    if (score >= 40) {
      results.set(entry.exercise.name, {
        exercise: entry.exercise,
        score,
        matchType,
        matchedTerm: entry.term,
        canonicalSlug: generateCanonicalSlug(entry.exercise.name),
      });
    }
  }

  // Sort by score and limit
  const sorted = Array.from(results.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  logPerformance('semanticSearch', startTime, `${sorted.length} results`);
  return sorted;
}

/**
 * Get exercise by canonical slug
 */
export async function getExerciseBySlug(slug: string): Promise<ExerciseDatabaseEntry | null> {
  const index = await buildSearchIndex();
  return index.bySlug.get(slug) || null;
}

/**
 * Invalidate the search index (call when database changes)
 */
export function invalidateSearchIndex(): void {
  searchIndex = null;
}

// ============================================
// PERFORMANCE LOGGING
// ============================================

// React Native global for development mode
declare const __DEV__: boolean;

function logPerformance(operation: string, startTime: number, result: string): void {
  const duration = performance.now() - startTime;
  if (typeof __DEV__ !== 'undefined' && __DEV__ && duration > 100) {
    console.warn(`[SemanticSearch] ${operation} took ${duration.toFixed(2)}ms (${result})`);
  }
}

// ============================================
// EXPORTS
// ============================================

export {
  buildSearchIndex,
  // Re-export from shared utility for backwards compatibility
  levenshteinDistance,
  calculateSimilarity,
};
