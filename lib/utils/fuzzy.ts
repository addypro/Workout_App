/**
 * Advanced Exercise Matching Algorithm
 * 
 * Uses a multi-layer approach inspired by UFIRE:
 * 1. Exact match (normalized)
 * 2. Word-based matching (prioritizes matching whole words)
 * 3. Substring containment
 * 4. Levenshtein distance as fallback
 * 
 * This fixes the "bench press" → "French Press" bug by prioritizing
 * word overlap over character-level similarity.
 */

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Normalize a string for comparison
 */
function normalize(s: string): string {
    return s.toLowerCase().trim();
}

/**
 * Extract words from a string (alphanumeric only)
 */
function getWords(s: string): string[] {
    return normalize(s)
        .split(/[^a-z0-9]+/)
        .filter(w => w.length > 0);
}

/**
 * Calculate word overlap score between two strings
 * Returns a score between 0-1, where 1 = perfect match
 */
function wordOverlapScore(a: string, b: string): number {
    const wordsA = new Set(getWords(a));
    const wordsB = new Set(getWords(b));

    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let matchCount = 0;
    for (const word of wordsA) {
        if (wordsB.has(word)) matchCount++;
    }

    // Jaccard similarity
    const union = new Set([...wordsA, ...wordsB]).size;
    return matchCount / union;
}

/**
 * Check if all words from query appear in the candidate
 */
function allWordsMatch(query: string, candidate: string): boolean {
    const queryWords = getWords(query);
    const candidateWords = new Set(getWords(candidate));

    return queryWords.every(qw => {
        // Check exact word match
        if (candidateWords.has(qw)) return true;

        // Check if any candidate word starts with this query word
        for (const cw of candidateWords) {
            if (cw.startsWith(qw) || qw.startsWith(cw)) return true;
        }
        return false;
    });
}

/**
 * Calculate a combined match score (lower is better)
 * This implements a UFIRE-inspired weighted scoring:
 * - Exact match: 0
 * - All words match: 0.1 + length difference penalty
 * - High word overlap: 1 - overlap score
 * - Substring match: 2 + length penalty
 * - Levenshtein fallback: 3 + normalized distance
 */
function calculateMatchScore(query: string, candidate: string): number {
    const queryNorm = normalize(query).replace(/[^a-z0-9]/g, '');
    const candidateNorm = normalize(candidate).replace(/[^a-z0-9]/g, '');

    // Priority 1: Exact match (score = 0)
    if (queryNorm === candidateNorm) {
        return 0;
    }

    // Priority 2: All words from query match in candidate
    if (allWordsMatch(query, candidate)) {
        const lengthPenalty = Math.abs(queryNorm.length - candidateNorm.length) * 0.01;
        return 0.1 + lengthPenalty;
    }

    // Priority 3: High word overlap (Jaccard > 0.5)
    const wordOverlap = wordOverlapScore(query, candidate);
    if (wordOverlap >= 0.5) {
        return 1 - wordOverlap; // 0.5 overlap = 0.5 score, 1.0 overlap = 0 score
    }

    // Priority 4: Substring containment
    if (candidateNorm.includes(queryNorm) || queryNorm.includes(candidateNorm)) {
        const lengthPenalty = Math.abs(queryNorm.length - candidateNorm.length) * 0.05;
        return 2 + lengthPenalty;
    }

    // Priority 5: Levenshtein distance (normalized to 0-1 range)
    const levenshtein = levenshteinDistance(queryNorm, candidateNorm);
    const maxLen = Math.max(queryNorm.length, candidateNorm.length);
    const normalizedDistance = levenshtein / maxLen;

    return 3 + normalizedDistance;
}

export interface MatchResult {
    match: string;
    score: number;
    confidence: 'exact' | 'high' | 'medium' | 'low';
}

/**
 * Find the best match from a list of candidates using multi-layer scoring
 */
export function findBestMatch(target: string, candidates: string[]): MatchResult | null {
    if (!candidates.length || !target) return null;

    let bestMatch = '';
    let bestScore = Infinity;

    for (const candidate of candidates) {
        const score = calculateMatchScore(target, candidate);
        if (score < bestScore) {
            bestScore = score;
            bestMatch = candidate;
        }
    }

    // Determine confidence level based on score
    let confidence: 'exact' | 'high' | 'medium' | 'low';
    if (bestScore < 0.1) {
        confidence = 'exact';
    } else if (bestScore < 1) {
        confidence = 'high';
    } else if (bestScore < 3) {
        confidence = 'medium';
    } else {
        confidence = 'low';
    }

    return { match: bestMatch, score: bestScore, confidence };
}

/**
 * Find multiple good matches (for disambiguation UI)
 */
export function findTopMatches(target: string, candidates: string[], limit: number = 3): MatchResult[] {
    if (!candidates.length || !target) return [];

    const scored = candidates.map(candidate => ({
        match: candidate,
        score: calculateMatchScore(target, candidate),
        confidence: 'medium' as const,
    }));

    // Sort by score ascending (lower is better)
    scored.sort((a, b) => a.score - b.score);

    // Take top N and assign confidence
    return scored.slice(0, limit).map(r => ({
        ...r,
        confidence: r.score < 0.1 ? 'exact' : r.score < 1 ? 'high' : r.score < 3 ? 'medium' : 'low',
    }));
}
