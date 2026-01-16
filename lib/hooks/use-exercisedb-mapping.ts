/**
 * useExerciseDbMapping Hook
 * 
 * Provides access to ExerciseDB mapping for exercise cards.
 * Loads mapping once and provides lookup function.
 */

import {
    getExerciseMedia as getExerciseMediaStatic,
    preloadCache,
    type ExerciseMedia,
} from '@/lib/services/exercise/static-exercisedb';
import { useCallback, useEffect, useState } from 'react';

interface ExerciseDbMappingResult {
    /** Get GIF and instructions for an exercise name */
    getMedia: (exerciseName: string) => ExerciseMedia | null;
    /** Whether mapping is loaded */
    isLoaded: boolean;
    /** Preloaded media cache */
    mediaCache: Map<string, ExerciseMedia>;
}

// In-memory cache for media lookups
const mediaLookupCache = new Map<string, ExerciseMedia>();
let isPreloaded = false;

/**
 * Hook to access ExerciseDB mapping for exercise cards
 * 
 * @example
 * ```tsx
 * const { getMedia, isLoaded } = useExerciseDbMapping();
 * const media = getMedia('Barbell Row');
 * if (media?.gifUrl) {
 *   // Show GIF
 * }
 * ```
 */
export function useExerciseDbMapping(): ExerciseDbMappingResult {
    const [isLoaded, setIsLoaded] = useState(isPreloaded);

    // Preload cache on first mount
    useEffect(() => {
        if (isPreloaded) return;

        preloadCache()
            .then(() => {
                isPreloaded = true;
                setIsLoaded(true);
            })
            .catch((error) => {
                console.warn('[useExerciseDbMapping] Preload failed:', error);
                setIsLoaded(true); // Still mark as loaded to prevent blocking
            });
    }, []);

    // Synchronous lookup from cache, async populate on miss
    const getMedia = useCallback((exerciseName: string): ExerciseMedia | null => {
        if (!exerciseName) return null;

        const key = exerciseName.toLowerCase();

        // Return from cache if available
        if (mediaLookupCache.has(key)) {
            return mediaLookupCache.get(key) || null;
        }

        // Queue async lookup (fire and forget - will be in cache next render)
        getExerciseMediaStatic(exerciseName)
            .then((media) => {
                if (media.isMatched) {
                    mediaLookupCache.set(key, media);
                }
            })
            .catch(() => {
                // Ignore errors - exercise just won't have media
            });

        return null;
    }, []);

    return {
        getMedia,
        isLoaded,
        mediaCache: mediaLookupCache,
    };
}

/**
 * Preload media for a list of exercise names
 * Call this when displaying a list to warm the cache
 */
export async function preloadExerciseMedia(exerciseNames: string[]): Promise<void> {
    // Ensure cache is loaded
    await preloadCache();

    // Load first 20 in parallel
    const namesToLoad = exerciseNames.slice(0, 20);
    await Promise.all(
        namesToLoad.map(async (name) => {
            const key = name.toLowerCase();
            if (!mediaLookupCache.has(key)) {
                try {
                    const media = await getExerciseMediaStatic(name);
                    if (media.isMatched) {
                        mediaLookupCache.set(key, media);
                    }
                } catch {
                    // Ignore
                }
            }
        })
    );
}
