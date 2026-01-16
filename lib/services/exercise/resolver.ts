/**
 * Unified Exercise Resolver
 * 
 * Single canonical function for exercise name resolution.
 * Used by BOTH voice logging AND search for consistent results.
 * 
 * Resolution Order:
 * 1. Exact match in aliasToExerciseMap (O(1))
 * 2. Slang dictionary lookup
 * 3. Modifier-aware matching (action word + equipment filtering)
 * 4. Fuzzy fallback with scoring
 */

import taxonomyData from '@/data/legacy/exercise-taxonomy.json';
import { ALL_GLOBAL_RANKINGS, type GlobalExerciseRanking } from '@/lib/services/popularity/global-rankings';

// ============================================
// TYPES
// ============================================

export interface TaxonomyExercise {
    id: string;
    canonical_name: string;
    type: string;
    popularity_score: number;
    nlp_metadata?: {
        aliases?: string[];
        slang_terms?: string[];
        misspellings?: string[];
    };
}

interface MovementPattern {
    pattern_id: string;
    exercises: TaxonomyExercise[];
}

interface SlangEntry {
    direct_match?: string;
    intent?: string;
    patterns?: string[];
}

export interface ResolveResult {
    exercise: TaxonomyExercise | null;
    globalRanking: GlobalExerciseRanking | null;
    confidence: number;
    matchType: 'exact' | 'alias' | 'slang' | 'modifier' | 'fuzzy' | 'none';
    rawQuery: string;
}

// ============================================
// ALIAS MAP (Single Source of Truth)
// ============================================

const aliasToExerciseMap = new Map<string, TaxonomyExercise>();
const slangDictionary: Record<string, SlangEntry> = (taxonomyData as any).slang_dictionary || {};
let initialized = false;

function initializeAliasMap() {
    if (initialized) return;

    // 1. Map all taxonomy exercises
    for (const pattern of (taxonomyData as any).movement_patterns as MovementPattern[]) {
        for (const exercise of pattern.exercises) {
            // Map canonical name
            aliasToExerciseMap.set(exercise.canonical_name.toLowerCase(), exercise);

            // Map all NLP aliases
            if (exercise.nlp_metadata?.aliases) {
                for (const alias of exercise.nlp_metadata.aliases) {
                    aliasToExerciseMap.set(alias.toLowerCase(), exercise);
                }
            }

            // Map misspellings
            if (exercise.nlp_metadata?.misspellings) {
                for (const misspelling of exercise.nlp_metadata.misspellings) {
                    aliasToExerciseMap.set(misspelling.toLowerCase(), exercise);
                }
            }

            // Map slang terms
            if (exercise.nlp_metadata?.slang_terms) {
                for (const slang of exercise.nlp_metadata.slang_terms) {
                    aliasToExerciseMap.set(slang.toLowerCase(), exercise);
                }
            }
        }
    }

    // 2. Map slang dictionary direct_match entries
    for (const [slangTerm, entry] of Object.entries(slangDictionary)) {
        if (entry.direct_match) {
            const exercise = aliasToExerciseMap.get(entry.direct_match.toLowerCase());
            if (exercise && !aliasToExerciseMap.has(slangTerm.toLowerCase())) {
                aliasToExerciseMap.set(slangTerm.toLowerCase(), exercise);
            }
        }
    }

    // 3. Map global-rankings aliases (augments taxonomy with voice aliases)
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

    initialized = true;
    console.log(`[Resolver] Initialized with ${aliasToExerciseMap.size} aliases`);
}

// Lazy initialization - called on first resolve() instead of module load

// ============================================
// MODIFIER EXTRACTION
// ============================================

const MODIFIERS = [
    'single arm', 'one arm', 'single leg', 'one leg', 'alternating',
    'incline', 'decline', 'flat', 'seated', 'standing', 'lying',
    'dumbbell', 'db', 'barbell', 'bb', 'cable', 'machine', 'kettlebell', 'kb',
    'close grip', 'wide grip', 'neutral grip', 'reverse grip',
].sort((a, b) => b.length - a.length);

const ACTION_WORDS = ['row', 'press', 'curl', 'squat', 'lunge', 'fly', 'raise', 'pulldown', 'pushdown', 'extension', 'deadlift'];

function extractModifiers(query: string): { modifiers: string[]; actionWord: string | null; remainder: string } {
    let normalized = query.toLowerCase().trim();
    const modifiers: string[] = [];

    for (const modifier of MODIFIERS) {
        if (normalized.includes(modifier)) {
            modifiers.push(modifier);
            normalized = normalized.replace(modifier, ' ').replace(/\s+/g, ' ').trim();
        }
    }

    let actionWord: string | null = null;
    for (const word of ACTION_WORDS) {
        if (normalized.includes(word)) {
            actionWord = word;
            break;
        }
    }

    return { modifiers, actionWord, remainder: normalized };
}

function scoreModifierMatch(candidateName: string, modifiers: string[]): number {
    if (modifiers.length === 0) return 50;

    const nameLower = candidateName.toLowerCase();
    let matches = 0;

    for (const modifier of modifiers) {
        if (nameLower.includes(modifier)) matches++;
        // Check synonyms
        if (modifier === 'single arm' && (nameLower.includes('one arm') || nameLower.includes('unilateral'))) matches++;
        if (modifier === 'dumbbell' && nameLower.includes('db')) matches++;
        if (modifier === 'barbell' && nameLower.includes('bb')) matches++;
    }

    return Math.round((matches / modifiers.length) * 100);
}

// ============================================
// MAIN RESOLVER
// ============================================

/**
 * Resolve an exercise name to a taxonomy exercise.
 * This is the SINGLE canonical function for all exercise resolution.
 */
export function resolveExercise(query: string): ResolveResult {
    // Lazy initialization on first use
    initializeAliasMap();

    const rawQuery = query;
    const normalized = query.toLowerCase().trim();

    // Layer 1: Exact match in alias map (O(1))
    const exactMatch = aliasToExerciseMap.get(normalized);
    if (exactMatch) {
        const globalRanking = ALL_GLOBAL_RANKINGS.find(
            r => r.name.toLowerCase() === exactMatch.canonical_name.toLowerCase()
        ) || null;

        console.log(`[Resolver] "${query}" → "${exactMatch.canonical_name}" (exact)`);
        return {
            exercise: exactMatch,
            globalRanking,
            confidence: 100,
            matchType: 'exact',
            rawQuery,
        };
    }

    // Layer 2: Slang dictionary lookup
    const slangEntry = slangDictionary[normalized];
    if (slangEntry?.direct_match) {
        const exercise = aliasToExerciseMap.get(slangEntry.direct_match.toLowerCase());
        if (exercise) {
            const globalRanking = ALL_GLOBAL_RANKINGS.find(
                r => r.name.toLowerCase() === exercise.canonical_name.toLowerCase()
            ) || null;

            console.log(`[Resolver] "${query}" → "${exercise.canonical_name}" (slang)`);
            return {
                exercise,
                globalRanking,
                confidence: 95,
                matchType: 'slang',
                rawQuery,
            };
        }
    }

    // Layer 3: Modifier-aware matching
    const { modifiers, actionWord } = extractModifiers(query);

    if (actionWord || modifiers.length > 0) {
        // Filter candidates by action word
        let candidates = ALL_GLOBAL_RANKINGS;
        if (actionWord) {
            candidates = candidates.filter(c =>
                c.name.toLowerCase().includes(actionWord)
            );
        }

        // Score by modifier overlap
        const scored = candidates.map(c => ({
            candidate: c,
            score: scoreModifierMatch(c.name, modifiers) + Math.round(c.score / 10),
        })).sort((a, b) => b.score - a.score);

        if (scored.length > 0 && scored[0].score >= 50) {
            const best = scored[0].candidate;
            const exercise = aliasToExerciseMap.get(best.name.toLowerCase()) || null;

            console.log(`[Resolver] "${query}" → "${best.name}" (modifier, score: ${scored[0].score})`);
            return {
                exercise,
                globalRanking: best,
                confidence: Math.min(90, scored[0].score),
                matchType: 'modifier',
                rawQuery,
            };
        }
    }

    // Layer 4: Fuzzy fallback (simple word overlap)
    let bestMatch: GlobalExerciseRanking | null = null;
    let bestScore = 0;
    const queryWords = normalized.split(/\s+/);

    for (const ranking of ALL_GLOBAL_RANKINGS) {
        const nameWords = ranking.name.toLowerCase().split(/\s+/);
        let overlap = 0;
        for (const word of queryWords) {
            if (nameWords.some(nw => nw.includes(word) || word.includes(nw))) {
                overlap++;
            }
        }
        const score = (overlap / Math.max(queryWords.length, nameWords.length)) * 100;
        if (score > bestScore) {
            bestScore = score;
            bestMatch = ranking;
        }
    }

    if (bestMatch && bestScore >= 40) {
        const exercise = aliasToExerciseMap.get(bestMatch.name.toLowerCase()) || null;

        console.log(`[Resolver] "${query}" → "${bestMatch.name}" (fuzzy, score: ${bestScore})`);
        return {
            exercise,
            globalRanking: bestMatch,
            confidence: Math.min(70, bestScore),
            matchType: 'fuzzy',
            rawQuery,
        };
    }

    // No match found
    console.log(`[Resolver] "${query}" → No match found`);
    return {
        exercise: null,
        globalRanking: null,
        confidence: 0,
        matchType: 'none',
        rawQuery,
    };
}

/**
 * Simple wrapper that returns just the exercise name.
 * For use in voice handler.
 */
export function resolveExerciseName(query: string): {
    name: string;
    confidence: number;
    matched: boolean;
} {
    const result = resolveExercise(query);

    if (result.exercise) {
        return {
            name: result.exercise.canonical_name,
            confidence: result.confidence,
            matched: true,
        };
    }

    if (result.globalRanking) {
        return {
            name: result.globalRanking.name,
            confidence: result.confidence,
            matched: true,
        };
    }

    return {
        name: query,
        confidence: 0,
        matched: false,
    };
}

// Re-export for convenience
export { aliasToExerciseMap };
