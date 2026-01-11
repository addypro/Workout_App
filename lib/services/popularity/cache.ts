/**
 * Popularity Cache Manager
 *
 * Manages local caching of merged popularity scores.
 * Provides fast access to scores during exercise search.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncPopularity, getCachedPopularity } from '@/lib/services/sync/popularity-sync';
import { buildMergedPopularityScores, meetsGlobalThreshold } from './algorithm';
import type { PopularityCache } from '@/lib/services/sync/types';

const MERGED_CACHE_KEY = '@merged_popularity_scores';
const STATS_CACHE_KEY = '@popularity_stats';

interface PopularityStats {
  totalWorkouts: number;
  uniqueUsers: number;
  lastUpdated: string;
}

// In-memory cache for fast access
let memoryCache: Record<string, number> | null = null;
let memoryCacheTimestamp: number = 0;
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get popularity scores (with caching layers)
 * 1. Memory cache (fastest)
 * 2. AsyncStorage cache
 * 3. Server fetch
 */
export async function getPopularityScores(
  staticScores: Record<string, number>
): Promise<Record<string, number>> {
  // Check memory cache
  const now = Date.now();
  if (memoryCache && (now - memoryCacheTimestamp) < MEMORY_CACHE_TTL) {
    return memoryCache;
  }

  // Try local storage cache
  const localCache = await getLocalMergedCache();
  if (localCache) {
    memoryCache = localCache;
    memoryCacheTimestamp = now;
    return localCache;
  }

  // Fetch from server and merge
  const dynamicCache = await syncPopularity(false);
  const stats = await getLocalStats();

  const merged = buildMergedPopularityScores(
    dynamicCache,
    staticScores,
    stats ? {
      totalWorkouts: stats.totalWorkouts,
      uniqueUsers: stats.uniqueUsers,
      exerciseStats: [], // Will be populated from server
    } : undefined
  );

  // Save to local cache
  await saveLocalMergedCache(merged);

  memoryCache = merged;
  memoryCacheTimestamp = now;

  return merged;
}

/**
 * Get a single exercise's popularity score
 */
export async function getExercisePopularity(
  exerciseName: string,
  staticScores: Record<string, number>
): Promise<number> {
  const scores = await getPopularityScores(staticScores);
  return scores[exerciseName] ?? staticScores[exerciseName] ?? 50;
}

/**
 * Invalidate memory cache (call after sync)
 */
export function invalidateMemoryCache(): void {
  memoryCache = null;
  memoryCacheTimestamp = 0;
}

/**
 * Force refresh from server
 */
export async function refreshPopularityScores(
  staticScores: Record<string, number>
): Promise<Record<string, number>> {
  invalidateMemoryCache();

  const dynamicCache = await syncPopularity(true);
  const stats = await getLocalStats();

  const merged = buildMergedPopularityScores(
    dynamicCache,
    staticScores,
    stats ? {
      totalWorkouts: stats.totalWorkouts,
      uniqueUsers: stats.uniqueUsers,
      exerciseStats: [],
    } : undefined
  );

  await saveLocalMergedCache(merged);

  memoryCache = merged;
  memoryCacheTimestamp = Date.now();

  return merged;
}

/**
 * Get local merged cache from AsyncStorage
 */
async function getLocalMergedCache(): Promise<Record<string, number> | null> {
  try {
    const data = await AsyncStorage.getItem(MERGED_CACHE_KEY);
    if (!data) return null;

    const parsed = JSON.parse(data);
    // Check if cache is still valid (24 hours)
    const cacheAge = Date.now() - new Date(parsed.timestamp).getTime();
    if (cacheAge > 24 * 60 * 60 * 1000) {
      return null;
    }

    return parsed.scores;
  } catch {
    return null;
  }
}

/**
 * Save merged cache to AsyncStorage
 */
async function saveLocalMergedCache(scores: Record<string, number>): Promise<void> {
  try {
    await AsyncStorage.setItem(MERGED_CACHE_KEY, JSON.stringify({
      scores,
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Failed to save merged cache:', error);
  }
}

/**
 * Get local stats (for threshold checking)
 */
async function getLocalStats(): Promise<PopularityStats | null> {
  try {
    const data = await AsyncStorage.getItem(STATS_CACHE_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Save stats to local storage
 */
export async function saveLocalStats(stats: PopularityStats): Promise<void> {
  try {
    await AsyncStorage.setItem(STATS_CACHE_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('Failed to save stats:', error);
  }
}

/**
 * Check if dynamic adjustments are active
 */
export async function isDynamicPopularityActive(): Promise<boolean> {
  const stats = await getLocalStats();
  if (!stats) return false;

  return meetsGlobalThreshold({
    totalWorkouts: stats.totalWorkouts,
    uniqueUsers: stats.uniqueUsers,
    exerciseStats: [],
  });
}

/**
 * Clear all popularity caches
 */
export async function clearPopularityCache(): Promise<void> {
  invalidateMemoryCache();
  await AsyncStorage.multiRemove([MERGED_CACHE_KEY, STATS_CACHE_KEY]);
}
