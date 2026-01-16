/**
 * Static ExerciseDB Service
 * 
 * Uses pre-cached ExerciseDB data with no runtime API calls.
 * All data comes from static JSON files bundled with the app.
 */

// ============================================
// TYPES
// ============================================

export interface CachedExercise {
    exerciseId: string;
    name: string;
    gifUrl: string;
    targetMuscles: string[];
    bodyParts: string[];
    equipments: string[];
    secondaryMuscles: string[];
    instructions: string[];
}

export interface ExerciseMapping {
    exerciseDbId: string;
    gifUrl: string;
    matchScore: number;
    matchedOn: string;
}

export interface ExerciseMedia {
    gifUrl?: string;
    instructions?: string[];
    secondaryMuscles?: string[];
    bodyParts?: string[];
    matchScore?: number;
    isMatched: boolean;
}

// ============================================
// STATIC DATA (Loaded Lazily)
// ============================================

let exerciseDbCache: Record<string, CachedExercise> | null = null;
let mappingCache: Record<string, ExerciseMapping> | null = null;

/**
 * Load the ExerciseDB cache from static JSON
 * Returns exercise lookup by ID
 */
async function loadExerciseDbCache(): Promise<Record<string, CachedExercise>> {
    if (exerciseDbCache) return exerciseDbCache;

    try {
        // Dynamic import of the cache file
        const cacheData = await import('@/data/exercisedb-cache.json');
        const exercises: CachedExercise[] = cacheData.exercises || [];

        // Build lookup by ID
        exerciseDbCache = {};
        for (const exercise of exercises) {
            exerciseDbCache[exercise.exerciseId] = exercise;
        }

        console.log(`[StaticExerciseDB] Loaded ${exercises.length} exercises`);
        return exerciseDbCache;
    } catch (error) {
        console.warn('[StaticExerciseDB] Cache not available:', error);
        return {};
    }
}

/**
 * Load the taxonomy-to-ExerciseDB mapping
 */
async function loadMapping(): Promise<Record<string, ExerciseMapping>> {
    if (mappingCache) return mappingCache;

    try {
        const mappingData = await import('@/data/exercisedb-mapping.json');
        mappingCache = mappingData.mapping || {};

        const stats = mappingData.stats || {};
        console.log(`[StaticExerciseDB] Mapping loaded: ${stats.matched}/${stats.totalHevy ?? 'unknown'} matched`);
        return mappingCache;
    } catch (error) {
        console.warn('[StaticExerciseDB] Mapping not available:', error);
        return {};
    }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Get exercise media by taxonomy name
 * Uses static cache - no API calls
 */
export async function getExerciseMedia(taxonomyName: string): Promise<ExerciseMedia> {
    const mapping = await loadMapping();
    const cache = await loadExerciseDbCache();

    const key = taxonomyName.toLowerCase();
    const mappedExercise = mapping[key];

    if (!mappedExercise || !mappedExercise.exerciseDbId) {
        return { isMatched: false };
    }

    const exercise = cache[mappedExercise.exerciseDbId];

    if (!exercise) {
        // Have mapping but exercise not in cache
        return {
            gifUrl: mappedExercise.gifUrl || undefined,
            matchScore: mappedExercise.matchScore,
            isMatched: true,
        };
    }

    // Full exercise data available
    // gifUrl is already a full URL from the cache, use directly
    const gifUrl = exercise.gifUrl || undefined;

    return {
        gifUrl,
        instructions: exercise.instructions,
        secondaryMuscles: exercise.secondaryMuscles,
        bodyParts: exercise.bodyParts,
        matchScore: mappedExercise.matchScore,
        isMatched: true,
    };
}

/**
 * Search ExerciseDB cache by name
 * Useful for finding exercises not in taxonomy
 */
export async function searchExerciseDb(query: string, limit = 10): Promise<CachedExercise[]> {
    const cache = await loadExerciseDbCache();
    const exercises = Object.values(cache);

    const normalizedQuery = query.toLowerCase();

    return exercises
        .filter(e => e.name.toLowerCase().includes(normalizedQuery))
        .slice(0, limit);
}

/**
 * Get direct ExerciseDB exercise by ID
 */
export async function getExerciseById(exerciseDbId: string): Promise<CachedExercise | null> {
    const cache = await loadExerciseDbCache();
    return cache[exerciseDbId] || null;
}

/**
 * Check if static cache is available
 */
export async function isCacheAvailable(): Promise<boolean> {
    try {
        const cache = await loadExerciseDbCache();
        return Object.keys(cache).length > 0;
    } catch {
        return false;
    }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
    exerciseCount: number;
    mappedCount: number;
    isLoaded: boolean;
}> {
    const cache = await loadExerciseDbCache();
    const mapping = await loadMapping();

    const mappedCount = Object.values(mapping).filter(m => m.exerciseDbId).length;

    return {
        exerciseCount: Object.keys(cache).length,
        mappedCount,
        isLoaded: Object.keys(cache).length > 0,
    };
}

/**
 * Preload static cache
 * Call on app launch to ensure data is ready
 */
export async function preloadCache(): Promise<void> {
    await Promise.all([
        loadExerciseDbCache(),
        loadMapping(),
    ]);
}
