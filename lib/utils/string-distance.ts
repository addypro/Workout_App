/**
 * String Distance Utilities
 *
 * Centralized string distance/similarity algorithms used for fuzzy matching.
 * Includes Levenshtein distance, Jaro-Winkler, and common similarity helpers.
 */

// ============================================
// LEVENSHTEIN DISTANCE
// ============================================

/**
 * Calculate the Levenshtein (edit) distance between two strings.
 * Uses dynamic programming for O(m*n) time complexity.
 *
 * @param a First string
 * @param b Second string
 * @returns The minimum number of single-character edits (insertions, deletions, substitutions)
 */
export function levenshteinDistance(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  // Quick equality check
  if (aLower === bLower) return 0;

  const m = aLower.length;
  const n = bLower.length;

  // Handle empty string cases
  if (m === 0) return n;
  if (n === 0) return m;

  // Create distance matrix
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = aLower[i - 1] === bLower[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,     // deletion
        dp[i][j - 1] + 1,     // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Memory-optimized Levenshtein distance using only two rows.
 * Better for comparing long strings. Supports early termination.
 *
 * @param a First string
 * @param b Second string
 * @param maxDistance Optional early termination threshold (returns maxDistance + 1 if exceeded)
 */
export function levenshteinDistanceOptimized(
  a: string,
  b: string,
  maxDistance: number = Infinity
): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower === bLower) return 0;

  const m = aLower.length;
  const n = bLower.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // Early termination if length difference exceeds max
  if (Math.abs(m - n) > maxDistance) return maxDistance + 1;

  // Ensure we iterate over the shorter string
  const [shorter, longer] = m < n ? [aLower, bLower] : [bLower, aLower];
  const shortLen = shorter.length;
  const longLen = longer.length;

  let prevRow = Array.from({ length: shortLen + 1 }, (_, i) => i);
  let currRow = new Array(shortLen + 1);

  for (let i = 1; i <= longLen; i++) {
    currRow[0] = i;
    let minInRow = i;

    for (let j = 1; j <= shortLen; j++) {
      const cost = longer[i - 1] === shorter[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,
        currRow[j - 1] + 1,
        prevRow[j - 1] + cost
      );
      minInRow = Math.min(minInRow, currRow[j]);
    }

    // Early termination if all values in row exceed max
    if (minInRow > maxDistance) return maxDistance + 1;

    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[shortLen];
}

// ============================================
// SIMILARITY SCORES
// ============================================

/**
 * Calculate normalized similarity score between two strings (0-1).
 * 1 = identical, 0 = completely different
 */
export function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;

  const distance = levenshteinDistanceOptimized(a, b);
  const maxLength = Math.max(a.length, b.length);

  return 1 - distance / maxLength;
}

/**
 * Check if two strings are similar within a threshold.
 * Uses Levenshtein distance normalized by string length.
 *
 * @param a First string
 * @param b Second string
 * @param threshold Maximum distance ratio (0-1), default 0.3
 */
export function isSimilar(a: string, b: string, threshold: number = 0.3): boolean {
  return stringSimilarity(a, b) >= 1 - threshold;
}

/**
 * Calculate percentage match between two strings
 */
export function percentMatch(a: string, b: string): number {
  return Math.round(stringSimilarity(a, b) * 100);
}

// ============================================
// FUZZY MATCHING
// ============================================

/**
 * Find the best match for a query in a list of candidates.
 * Returns the candidate with the lowest edit distance.
 */
export function findBestMatch<T>(
  query: string,
  candidates: T[],
  accessor: (item: T) => string
): { item: T; score: number; distance: number } | null {
  if (!query || candidates.length === 0) return null;

  let bestMatch: T | null = null;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const candidateStr = accessor(candidate);
    const distance = levenshteinDistanceOptimized(query, candidateStr);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = candidate;
    }
  }

  if (!bestMatch) return null;

  const maxLength = Math.max(query.length, accessor(bestMatch).length);
  const score = 1 - bestDistance / maxLength;

  return { item: bestMatch, score, distance: bestDistance };
}

/**
 * Find all matches within a similarity threshold.
 * Returns matches sorted by similarity score (best first).
 */
export function findMatches<T>(
  query: string,
  candidates: T[],
  accessor: (item: T) => string,
  minSimilarity: number = 0.6
): Array<{ item: T; score: number; distance: number }> {
  if (!query || candidates.length === 0) return [];

  const results: Array<{ item: T; score: number; distance: number }> = [];

  for (const candidate of candidates) {
    const candidateStr = accessor(candidate);
    const distance = levenshteinDistanceOptimized(query, candidateStr);
    const maxLength = Math.max(query.length, candidateStr.length);
    const score = 1 - distance / maxLength;

    if (score >= minSimilarity) {
      results.push({ item: candidate, score, distance });
    }
  }

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
}

// ============================================
// PREFIX/SUBSTRING MATCHING
// ============================================

/**
 * Check if query is a prefix of target (case-insensitive)
 */
export function isPrefixMatch(query: string, target: string): boolean {
  return target.toLowerCase().startsWith(query.toLowerCase());
}

/**
 * Check if query is contained in target (case-insensitive)
 */
export function isSubstringMatch(query: string, target: string): boolean {
  return target.toLowerCase().includes(query.toLowerCase());
}

/**
 * Check if all words in query appear in target (case-insensitive)
 */
export function isWordMatch(query: string, target: string): boolean {
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
  const targetLower = target.toLowerCase();

  return queryWords.every((word) => targetLower.includes(word));
}

// ============================================
// SCORING UTILITIES
// ============================================

/**
 * Calculate a weighted match score based on multiple factors.
 * Useful for ranking search results.
 */
export function calculateMatchScore(
  query: string,
  target: string,
  weights: {
    exact?: number;
    prefix?: number;
    substring?: number;
    similarity?: number;
  } = {}
): number {
  const {
    exact = 100,
    prefix = 80,
    substring = 50,
    similarity = 30,
  } = weights;

  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();

  // Exact match
  if (queryLower === targetLower) {
    return exact;
  }

  // Prefix match
  if (targetLower.startsWith(queryLower)) {
    return prefix;
  }

  // Substring match
  if (targetLower.includes(queryLower)) {
    return substring;
  }

  // Fuzzy similarity
  const sim = stringSimilarity(query, target);
  return Math.round(sim * similarity);
}
