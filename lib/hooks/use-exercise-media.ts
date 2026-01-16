/**
 * useExerciseMedia Hook
 * 
 * React hook for accessing ExerciseDB media for exercises.
 * Handles loading states, caching, and error handling.
 */

import { useEffect, useState } from 'react';
import { getExerciseMedia, hasMediaCached, type ExerciseMedia } from '../services/exercise/media-service';

interface UseExerciseMediaResult {
    media: ExerciseMedia | null;
    isLoading: boolean;
    error: string | null;
    isCached: boolean;
}

/**
 * Hook to get exercise media for a given exercise name
 * 
 * @param exerciseName - The taxonomy name of the exercise
 * @param options - Configuration options
 * @returns Media data, loading state, and error state
 * 
 * @example
 * ```tsx
 * const { media, isLoading } = useExerciseMedia('Barbell Squat');
 * 
 * if (isLoading) return <ActivityIndicator />;
 * if (media?.localGifPath) {
 *   return <Image source={{ uri: media.localGifPath }} />;
 * }
 * ```
 */
export function useExerciseMedia(
    exerciseName: string | undefined,
    options?: {
        enabled?: boolean;
    }
): UseExerciseMediaResult {
    const [media, setMedia] = useState<ExerciseMedia | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const enabled = options?.enabled ?? true;
    const isCached = exerciseName ? hasMediaCached(exerciseName) : false;

    useEffect(() => {
        if (!exerciseName || !enabled) {
            setMedia(null);
            setIsLoading(false);
            setError(null);
            return;
        }

        let cancelled = false;

        async function fetchMedia() {
            setIsLoading(true);
            setError(null);

            try {
                const result = await getExerciseMedia(exerciseName!);

                if (!cancelled) {
                    setMedia(result);
                    if (result.error) {
                        setError(result.error);
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load media');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        fetchMedia();

        return () => {
            cancelled = true;
        };
    }, [exerciseName, enabled]);

    return {
        media,
        isLoading,
        error,
        isCached,
    };
}

/**
 * Hook to preload media for multiple exercises
 * Use this on list screens to warm the cache
 * 
 * @param exerciseNames - Array of exercise names to preload
 */
export function usePreloadExerciseMedia(exerciseNames: string[]): void {
    useEffect(() => {
        if (exerciseNames.length === 0) return;

        // Import dynamically to avoid circular deps
        import('../services/exercise/media-service').then(({ preloadExerciseMedia }) => {
            preloadExerciseMedia(exerciseNames);
        });
    }, [exerciseNames.join(',')]);
}
