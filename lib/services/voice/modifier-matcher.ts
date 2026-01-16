/**
 * Modifier-Aware Exercise Matching
 * 
 * Knuth-inspired hierarchical matching algorithm that extracts
 * exercise components (modifiers, action words, equipment) and
 * matches by specificity rather than simple word overlap.
 * 
 * This prevents greedy matches like "single arm dumbbell row" → "Barbell Row"
 * by requiring modifier overlap scoring.
 */

import { lookupExerciseByAlias, lookupSlang, type TaxonomyExercise } from '@/lib/services/exercise/search';
import { ALL_GLOBAL_RANKINGS, type GlobalExerciseRanking } from '@/lib/services/popularity/global-rankings';

// ============================================
// MODIFIER PATTERNS (ordered by specificity)
// ============================================

const LATERALITY_MODIFIERS = [
    'single arm', 'one arm', 'single leg', 'one leg',
    'alternating', 'unilateral', 'bilateral',
];

const POSITION_MODIFIERS = [
    'incline', 'decline', 'flat',
    'seated', 'standing', 'lying', 'prone', 'supine', 'kneeling',
    'overhead', 'behind the neck', 'behind neck',
];

const EQUIPMENT_MODIFIERS = [
    'dumbbell', 'db', 'dumbell',  // Include common misspelling
    'barbell', 'bb',
    'cable', 'machine',
    'kettlebell', 'kb',
    'ez bar', 'ez-bar',
    'smith machine', 'smith',
    'landmine',
    'resistance band', 'band',
    'bodyweight', 'bw',
];

const GRIP_MODIFIERS = [
    'close grip', 'narrow grip',
    'wide grip',
    'neutral grip', 'hammer grip',
    'reverse grip', 'supinated', 'pronated',
    'underhand', 'overhand',
];

const TEMPO_MODIFIERS = [
    'pause', 'tempo', 'slow',
    'explosive', 'power',
];

// All modifiers combined for extraction
const ALL_MODIFIERS = [
    ...LATERALITY_MODIFIERS,
    ...POSITION_MODIFIERS,
    ...EQUIPMENT_MODIFIERS,
    ...GRIP_MODIFIERS,
    ...TEMPO_MODIFIERS,
].sort((a, b) => b.length - a.length); // Longest first for greedy matching

// ============================================
// ACTION WORDS → EXERCISE CATEGORY
// ============================================

const ACTION_WORD_TO_CATEGORY: Record<string, string[]> = {
    // Back - Rows
    'row': ['back'],
    'rows': ['back'],
    'rowing': ['back'],

    // Back - Pulls
    'pulldown': ['back'],
    'pull-down': ['back'],
    'pullup': ['back'],
    'pull-up': ['back'],
    'pull up': ['back'],
    'chinup': ['back'],
    'chin-up': ['back'],
    'chin up': ['back'],

    // Chest - Press
    'press': ['chest', 'shoulders', 'triceps'],
    'bench': ['chest'],
    'pushup': ['chest'],
    'push-up': ['chest'],
    'push up': ['chest'],

    // Chest - Fly
    'fly': ['chest'],
    'flye': ['chest'],
    'flies': ['chest'],
    'flyes': ['chest'],
    'crossover': ['chest'],

    // Biceps
    'curl': ['biceps'],
    'curls': ['biceps'],

    // Triceps
    'pushdown': ['triceps'],
    'push-down': ['triceps'],
    'extension': ['triceps', 'legs'],
    'extensions': ['triceps', 'legs'],
    'skullcrusher': ['triceps'],
    'skull crusher': ['triceps'],

    // Shoulders
    'raise': ['shoulders'],
    'raises': ['shoulders'],
    'lateral': ['shoulders'],
    'shrug': ['shoulders', 'back'],
    'shrugs': ['shoulders', 'back'],

    // Legs
    'squat': ['legs'],
    'squats': ['legs'],
    'lunge': ['legs'],
    'lunges': ['legs'],
    'deadlift': ['legs', 'back'],
    'leg press': ['legs'],
    'thrust': ['legs'],

    // Core
    'crunch': ['core'],
    'crunches': ['core'],
    'plank': ['core'],

};

// Extract just the action word keys for matching
const ACTION_WORDS = Object.keys(ACTION_WORD_TO_CATEGORY);

// ============================================
// COMPONENT EXTRACTION
// ============================================

export interface ExerciseComponents {
    modifiers: string[];
    actionWord: string | null;
    actionCategories: string[];
    remainder: string;
    original: string;
}

/**
 * Extract structured components from an exercise query.
 * Uses greedy matching on modifiers (longest first).
 */
export function extractComponents(query: string): ExerciseComponents {
    let normalized = query.toLowerCase().trim();
    const original = normalized;
    const modifiers: string[] = [];

    // Extract modifiers (greedy, longest first)
    for (const modifier of ALL_MODIFIERS) {
        if (normalized.includes(modifier)) {
            modifiers.push(modifier);
            normalized = normalized.replace(modifier, ' ').replace(/\s+/g, ' ').trim();
        }
    }

    // Extract action word
    let actionWord: string | null = null;
    let actionCategories: string[] = [];

    for (const word of ACTION_WORDS) {
        if (normalized.includes(word)) {
            actionWord = word;
            actionCategories = ACTION_WORD_TO_CATEGORY[word] || [];
            break;
        }
    }

    return {
        modifiers,
        actionWord,
        actionCategories,
        remainder: normalized,
        original,
    };
}

// ============================================
// MODIFIER OVERLAP SCORING
// ============================================

/**
 * Extract modifiers present in a candidate exercise name.
 * Used for bidirectional modifier matching.
 */
function extractCandidateModifiers(candidateName: string): string[] {
    const nameLower = candidateName.toLowerCase();
    const modifiers: string[] = [];

    for (const modifier of ALL_MODIFIERS) {
        if (nameLower.includes(modifier)) {
            modifiers.push(modifier);
        }
    }

    return modifiers;
}

/**
 * Check if two modifiers are synonymous.
 */
function areModifiersSynonymous(mod1: string, mod2: string): boolean {
    const synonymGroups = [
        ['single arm', 'one arm', 'unilateral'],
        ['single leg', 'one leg'],
        ['dumbbell', 'db', 'dumbell'],
        ['barbell', 'bb'],
        ['kettlebell', 'kb'],
        ['ez bar', 'ez-bar'],
        ['smith machine', 'smith'],
        ['close grip', 'narrow grip'],
        ['neutral grip', 'hammer grip'],
    ];

    for (const group of synonymGroups) {
        if (group.includes(mod1) && group.includes(mod2)) {
            return true;
        }
    }

    return false;
}

/**
 * Bidirectional modifier overlap scoring.
 *
 * Key insight: Modifier mismatch should penalize in BOTH directions:
 * - Query has modifier, candidate doesn't → penalty (missing required modifier)
 * - Query lacks modifier, candidate has it → penalty (unwanted modifier)
 *
 * This ensures "Bench Press" matches "Bench Press" better than "Incline Bench Press".
 */
function scoreModifierOverlap(candidateName: string, queryModifiers: string[]): number {
    const candidateModifiers = extractCandidateModifiers(candidateName);

    // Case 1: Query has NO modifiers
    if (queryModifiers.length === 0) {
        if (candidateModifiers.length === 0) {
            // Perfect match - neither has modifiers
            return 80;
        }
        // Candidate has modifiers user didn't ask for - PENALIZE
        // Each unwanted modifier reduces score significantly
        // Position modifiers (incline/decline) are most impactful
        const positionMods = candidateModifiers.filter(m => POSITION_MODIFIERS.includes(m));
        const otherMods = candidateModifiers.filter(m => !POSITION_MODIFIERS.includes(m));

        // Position modifiers are severe penalty (they change the exercise fundamentally)
        // Other modifiers are moderate penalty (variations)
        const penalty = (positionMods.length * 25) + (otherMods.length * 10);
        return Math.max(10, 60 - penalty);
    }

    // Case 2: Query HAS modifiers - match bidirectionally
    let matchedQueryMods = 0;
    const matchedCandidateMods = new Set<string>();

    for (const queryMod of queryModifiers) {
        let found = false;

        for (const candMod of candidateModifiers) {
            if (queryMod === candMod || areModifiersSynonymous(queryMod, candMod)) {
                matchedQueryMods++;
                matchedCandidateMods.add(candMod);
                found = true;
                break;
            }
        }

        // Check if candidate name contains the modifier directly (even if not extracted)
        if (!found && candidateName.toLowerCase().includes(queryMod)) {
            matchedQueryMods++;
            found = true;
        }
    }

    // Calculate overlap ratio (how many query modifiers found)
    const queryOverlapRatio = queryModifiers.length > 0
        ? matchedQueryMods / queryModifiers.length
        : 1;

    // Calculate extra modifier penalty (candidate has mods user didn't ask for)
    const extraModifiers = candidateModifiers.filter(m => !matchedCandidateMods.has(m));
    const extraPenalty = extraModifiers.length * 15;

    // Final score: query overlap * 100, minus extra modifier penalty
    return Math.max(0, Math.round(queryOverlapRatio * 100) - extraPenalty);
}

/**
 * Check if candidate matches the action word categories.
 */
function matchesActionCategory(candidate: GlobalExerciseRanking, categories: string[]): boolean {
    if (categories.length === 0) return true; // No filter
    return categories.includes(candidate.category);
}

// ============================================
// HIERARCHICAL MATCHING
// ============================================

export interface MatchResult {
    exercise: GlobalExerciseRanking | null;
    taxonomyExercise: TaxonomyExercise | null;
    confidence: number;
    matchedVia: 'exact' | 'alias' | 'slang' | 'modifier' | 'fuzzy' | 'none';
    components: ExerciseComponents;
}

/**
 * Robust exercise matching using hierarchical approach.
 * 
 * Layer 1: Exact match in taxonomy/slang
 * Layer 2: Modifier-aware matching with specificity scoring
 * Layer 3: Fuzzy fallback (only on filtered candidates)
 */
export function matchExerciseRobust(query: string): MatchResult {
    const components = extractComponents(query);

    // Layer 1: Exact match via taxonomy alias map
    const exactMatch = lookupExerciseByAlias(query);
    if (exactMatch) {
        // Find corresponding global ranking
        const globalMatch = ALL_GLOBAL_RANKINGS.find(
            ex => ex.name.toLowerCase() === exactMatch.canonical_name.toLowerCase()
        );
        return {
            exercise: globalMatch || null,
            taxonomyExercise: exactMatch,
            confidence: 100,
            matchedVia: 'exact',
            components,
        };
    }

    // Layer 1b: Slang dictionary lookup
    const slangMatch = lookupSlang(query);
    if (slangMatch && slangMatch.exercises.length > 0) {
        const firstExercise = slangMatch.exercises[0];
        const globalMatch = ALL_GLOBAL_RANKINGS.find(
            ex => ex.name.toLowerCase() === firstExercise.canonical_name.toLowerCase()
        );
        return {
            exercise: globalMatch || null,
            taxonomyExercise: firstExercise,
            confidence: 95,
            matchedVia: 'slang',
            components,
        };
    }

    // Layer 2: Modifier-aware matching
    // Filter candidates by action word category first
    let candidates = ALL_GLOBAL_RANKINGS;
    if (components.actionWord && components.actionCategories.length > 0) {
        candidates = candidates.filter(c =>
            matchesActionCategory(c, components.actionCategories) ||
            c.name.toLowerCase().includes(components.actionWord!)
        );
    }

    // Score by modifier overlap
    const scored = candidates.map(candidate => {
        const modifierScore = scoreModifierOverlap(candidate.name, components.modifiers);

        // Bonus for name containing action word
        const actionBonus = components.actionWord &&
            candidate.name.toLowerCase().includes(components.actionWord) ? 10 : 0;

        // Bonus for higher popularity
        const popularityBonus = Math.round(candidate.score / 10);

        return {
            candidate,
            score: modifierScore + actionBonus + popularityBonus,
        };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Return best match if score is reasonable
    if (scored.length > 0 && scored[0].score >= 50) {
        const best = scored[0];
        return {
            exercise: best.candidate,
            taxonomyExercise: null,
            confidence: Math.min(95, best.score),
            matchedVia: 'modifier',
            components,
        };
    }

    // Layer 3: Fuzzy fallback on filtered candidates
    if (scored.length > 0) {
        // Return first candidate with lower confidence
        return {
            exercise: scored[0].candidate,
            taxonomyExercise: null,
            confidence: 40,
            matchedVia: 'fuzzy',
            components,
        };
    }

    return {
        exercise: null,
        taxonomyExercise: null,
        confidence: 0,
        matchedVia: 'none',
        components,
    };
}

/**
 * Simple wrapper for use in voice handler.
 * Returns the matched exercise name or original query.
 */
export function resolveExerciseName(query: string): {
    name: string;
    confidence: number;
    matched: boolean;
} {
    const result = matchExerciseRobust(query);

    // Debug logging for voice resolution tracing
    console.log(`[ModifierMatcher] Input: "${query}"`);
    console.log(`[ModifierMatcher] Components: modifiers=[${result.components.modifiers.join(', ')}], action="${result.components.actionWord}"`);
    console.log(`[ModifierMatcher] Matched via: ${result.matchedVia}, confidence: ${result.confidence}%`);

    if (result.taxonomyExercise) {
        console.log(`[ModifierMatcher] → Resolved to: "${result.taxonomyExercise.canonical_name}" (taxonomy)`);
        return {
            name: result.taxonomyExercise.canonical_name,
            confidence: result.confidence,
            matched: true,
        };
    }

    if (result.exercise) {
        console.log(`[ModifierMatcher] → Resolved to: "${result.exercise.name}" (global rankings)`);
        return {
            name: result.exercise.name,
            confidence: result.confidence,
            matched: true,
        };
    }

    console.log(`[ModifierMatcher] → No match found, returning original`);
    return {
        name: query, // Return original if no match
        confidence: 0,
        matched: false,
    };
}
