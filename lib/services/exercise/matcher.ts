import { getExerciseDatabase } from '@/lib/services/exercise/database';
import { findBestMatch, findTopMatches, type MatchResult } from '@/lib/utils/fuzzy';

/**
 * Exercise Matcher Service
 * 
 * Uses a UFIRE-inspired multi-layer matching approach:
 * 1. Exact match (normalized) - instant return
 * 2. Word-based matching - prioritizes "bench press" → "Bench Press" over "French Press"
 * 3. Alias lookup - matches common gym slang
 * 4. Fuzzy fallback - only if no good word matches
 */

// In-memory cache for fast matching
interface IndexEntry {
    displayName: string;    // Original name from database
    canonicalName: string;  // The ID to use
    searchTerms: string[];  // All searchable variations
    isAlias: boolean;
}

let searchIndex: IndexEntry[] | null = null;

/**
 * Build the search index from the exercise database
 */
async function ensureIndex(): Promise<void> {
    if (searchIndex) return;

    const db = await getExerciseDatabase();
    searchIndex = [];

    for (const ex of db) {
        // Add canonical name as primary entry
        searchIndex.push({
            displayName: ex.name,
            canonicalName: ex.name,
            searchTerms: [ex.name.toLowerCase()],
            isAlias: false,
        });

        // Add aliases
        if (ex.aliases) {
            for (const alias of ex.aliases) {
                searchIndex.push({
                    displayName: alias,
                    canonicalName: ex.name,
                    searchTerms: [alias.toLowerCase()],
                    isAlias: true,
                });
            }
        }
    }

    console.log(`[ExerciseMatcher] Indexed ${searchIndex.length} entries`);
}

/**
 * Get all searchable names for matching
 */
async function getAllSearchableNames(): Promise<string[]> {
    await ensureIndex();
    return searchIndex!.map(e => e.displayName);
}

/**
 * Look up the canonical name for a matched display name
 */
function getCanonicalName(displayName: string): string {
    if (!searchIndex) return displayName;
    const entry = searchIndex.find(e => e.displayName === displayName);
    return entry ? entry.canonicalName : displayName;
}

/**
 * Match a raw exercise name to a canonical name from the database
 * 
 * @param rawName - The name extracted from voice/PDF/image
 * @param confidenceThreshold - Minimum confidence level ('exact', 'high', 'medium', 'low')
 * @returns The canonical exercise name if confident match, otherwise the raw name
 */
export async function matchExerciseName(
    rawName: string,
    confidenceThreshold: 'exact' | 'high' | 'medium' | 'low' = 'high'
): Promise<string> {
    await ensureIndex();

    if (!searchIndex || !rawName || rawName.trim().length === 0) {
        return rawName;
    }

    const candidates = await getAllSearchableNames();
    const result = findBestMatch(rawName, candidates);

    if (!result) {
        console.log(`[ExerciseMatcher] No match found for "${rawName}"`);
        return rawName;
    }

    // Define confidence hierarchy
    const confidenceLevels = ['exact', 'high', 'medium', 'low'];
    const thresholdIndex = confidenceLevels.indexOf(confidenceThreshold);
    const resultIndex = confidenceLevels.indexOf(result.confidence);

    // Only accept if result confidence meets or exceeds threshold
    if (resultIndex <= thresholdIndex) {
        const canonical = getCanonicalName(result.match);
        console.log(`[ExerciseMatcher] "${rawName}" → "${canonical}" (${result.confidence}, score: ${result.score.toFixed(2)})`);
        return canonical;
    }

    console.log(`[ExerciseMatcher] "${rawName}" → keeping raw (${result.confidence} < ${confidenceThreshold})`);
    return rawName;
}

/**
 * Get multiple match suggestions for disambiguation UI
 * 
 * @param rawName - The name to match
 * @param limit - Maximum number of suggestions
 * @returns Array of match results with canonical names
 */
export async function getMatchSuggestions(
    rawName: string,
    limit: number = 3
): Promise<Array<{ name: string; confidence: MatchResult['confidence']; score: number }>> {
    await ensureIndex();

    if (!searchIndex || !rawName) {
        return [];
    }

    const candidates = await getAllSearchableNames();
    const results = findTopMatches(rawName, candidates, limit);

    return results.map(r => ({
        name: getCanonicalName(r.match),
        confidence: r.confidence,
        score: r.score,
    }));
}

/**
 * Match multiple exercise names in batch (more efficient)
 */
export async function matchExerciseNames(
    rawNames: string[],
    confidenceThreshold: 'exact' | 'high' | 'medium' | 'low' = 'high'
): Promise<string[]> {
    await ensureIndex();

    return Promise.all(
        rawNames.map(name => matchExerciseName(name, confidenceThreshold))
    );
}
