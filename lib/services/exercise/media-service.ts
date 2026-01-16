/**
 * Exercise Media Service
 * 
 * Provides unified access to exercise media (GIFs, videos, images) from ExerciseDB.
 * Handles caching, offline fallbacks, and lazy loading.
 */

import * as FileSystem from 'expo-file-system';
import { searchExercises, type ExerciseDBExercise } from './exercisedb-client';

// ============================================
// CONFIGURATION
// ============================================

// Cache directory path - use documentDirectory as fallback
const getCacheDirectory = () => {
    const baseDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
    return `${baseDir}exercise-media/`;
};

const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================
// TYPES
// ============================================

export interface ExerciseMedia {
    gifUrl?: string;
    localGifPath?: string;
    imageUrl?: string;
    localImagePath?: string;
    instructions?: string[];
    tips?: string[];
    isLoading: boolean;
    error?: string;
}

export interface MediaCacheEntry {
    exerciseDbId: string;
    localPath: string;
    cachedAt: number;
    url: string;
}

// ============================================
// IN-MEMORY CACHE
// ============================================

const mediaCache = new Map<string, ExerciseMedia>();
const exerciseDbIdCache = new Map<string, string>(); // taxonomy name -> exerciseDb ID
const pendingRequests = new Map<string, Promise<ExerciseMedia>>();

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Ensure cache directory exists
 */
async function ensureCacheDirectory(): Promise<void> {
    const cacheDir = getCacheDirectory();
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
    }
}

/**
 * Generate cache file path for a URL
 */
function getCachePathForUrl(url: string): string {
    const hash = url.split('/').pop()?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'unknown';
    return `${getCacheDirectory()}${hash}`;
}

/**
 * Download and cache a media file
 */
async function downloadAndCache(url: string): Promise<string | null> {
    try {
        await ensureCacheDirectory();
        const localPath = getCachePathForUrl(url);

        const fileInfo = await FileSystem.getInfoAsync(localPath);
        if (fileInfo.exists) {
            // Check if cache is still valid
            const modTime = fileInfo.modificationTime || 0;
            if (Date.now() - modTime * 1000 < CACHE_MAX_AGE_MS) {
                return localPath;
            }
        }

        // Download the file
        const downloadResult = await FileSystem.downloadAsync(url, localPath);

        if (downloadResult.status === 200) {
            return localPath;
        }

        return null;
    } catch (error) {
        console.warn('[MediaService] Download error:', error);
        return null;
    }
}

/**
 * Clear old cached files
 */
export async function clearOldCache(): Promise<void> {
    try {
        await ensureCacheDirectory();
        const cacheDir = getCacheDirectory();
        const files = await FileSystem.readDirectoryAsync(cacheDir);

        for (const file of files) {
            const filePath = `${cacheDir}${file}`;
            const fileInfo = await FileSystem.getInfoAsync(filePath);

            if (fileInfo.exists) {
                const modTime = fileInfo.modificationTime || 0;
                if (Date.now() - modTime * 1000 > CACHE_MAX_AGE_MS) {
                    await FileSystem.deleteAsync(filePath, { idempotent: true });
                }
            }
        }
    } catch (error) {
        console.warn('[MediaService] Cache cleanup error:', error);
    }
}

// ============================================
// EXERCISE DB MATCHING
// ============================================

/**
 * Find ExerciseDB exercise by searching with our taxonomy name
 */
async function findExerciseDbMatch(taxonomyName: string): Promise<ExerciseDBExercise | null> {
    // Check cache first
    const cachedId = exerciseDbIdCache.get(taxonomyName.toLowerCase());
    if (cachedId === 'NOT_FOUND') {
        return null;
    }

    // Search ExerciseDB
    const results = await searchExercises(taxonomyName, 5);

    if (results.length === 0) {
        exerciseDbIdCache.set(taxonomyName.toLowerCase(), 'NOT_FOUND');
        return null;
    }

    // Find best match (exact name match or first result)
    const normalizedQuery = taxonomyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const exactMatch = results.find(r =>
        r.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedQuery
    );

    const match = exactMatch || results[0];
    exerciseDbIdCache.set(taxonomyName.toLowerCase(), match.exerciseId);

    return match;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Get media for an exercise by its taxonomy name
 * Returns cached data if available, otherwise fetches from ExerciseDB
 */
export async function getExerciseMedia(taxonomyName: string): Promise<ExerciseMedia> {
    const cacheKey = taxonomyName.toLowerCase();

    // Return cached data if available
    if (mediaCache.has(cacheKey)) {
        return mediaCache.get(cacheKey)!;
    }

    // Check if there's already a pending request for this exercise
    if (pendingRequests.has(cacheKey)) {
        return pendingRequests.get(cacheKey)!;
    }

    // Create new request
    const request = fetchExerciseMedia(taxonomyName);
    pendingRequests.set(cacheKey, request);

    try {
        const result = await request;
        mediaCache.set(cacheKey, result);
        return result;
    } finally {
        pendingRequests.delete(cacheKey);
    }
}

/**
 * Fetch exercise media from ExerciseDB
 */
async function fetchExerciseMedia(taxonomyName: string): Promise<ExerciseMedia> {
    try {
        const exercise = await findExerciseDbMatch(taxonomyName);

        if (!exercise) {
            return {
                isLoading: false,
                error: 'Exercise not found in ExerciseDB',
            };
        }

        // Build base URL for ExerciseDB assets
        const baseAssetUrl = 'https://cdn.exercisedb.dev/gifs';
        const gifUrl = exercise.gifUrl
            ? `${baseAssetUrl}/${exercise.gifUrl}`
            : undefined;

        // Try to cache GIF locally
        let localGifPath: string | undefined;
        if (gifUrl) {
            const cached = await downloadAndCache(gifUrl);
            if (cached) {
                localGifPath = cached;
            }
        }

        return {
            gifUrl,
            localGifPath,
            instructions: exercise.instructions,
            isLoading: false,
        };
    } catch (error) {
        console.error('[MediaService] Fetch error:', error);
        return {
            isLoading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Preload media for a list of exercises
 * Use this to warm the cache before showing exercise picker
 */
export function preloadExerciseMedia(exerciseNames: string[]): void {
    // Fire and forget - load in background
    for (const name of exerciseNames.slice(0, 10)) { // Limit to 10 at a time
        getExerciseMedia(name).catch(() => {
            // Silently ignore preload errors
        });
    }
}

/**
 * Check if media is cached for an exercise
 */
export function hasMediaCached(taxonomyName: string): boolean {
    return mediaCache.has(taxonomyName.toLowerCase());
}

/**
 * Clear all cached media
 */
export async function clearMediaCache(): Promise<void> {
    mediaCache.clear();
    exerciseDbIdCache.clear();

    try {
        const cacheDir = getCacheDirectory();
        const dirInfo = await FileSystem.getInfoAsync(cacheDir);
        if (dirInfo.exists) {
            await FileSystem.deleteAsync(cacheDir, { idempotent: true });
        }
    } catch (error) {
        console.warn('[MediaService] Clear cache error:', error);
    }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
    itemsInMemory: number;
    itemsOnDisk: number;
    diskSizeBytes: number;
}> {
    let itemsOnDisk = 0;
    let diskSizeBytes = 0;

    try {
        const cacheDir = getCacheDirectory();
        const dirInfo = await FileSystem.getInfoAsync(cacheDir);
        if (dirInfo.exists) {
            const files = await FileSystem.readDirectoryAsync(cacheDir);
            itemsOnDisk = files.length;

            for (const file of files) {
                const fileInfo = await FileSystem.getInfoAsync(`${cacheDir}${file}`);
                if (fileInfo.exists && 'size' in fileInfo) {
                    diskSizeBytes += fileInfo.size || 0;
                }
            }
        }
    } catch (error) {
        console.warn('[MediaService] Stats error:', error);
    }

    return {
        itemsInMemory: mediaCache.size,
        itemsOnDisk,
        diskSizeBytes,
    };
}
