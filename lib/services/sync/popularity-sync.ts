/**
 * Popularity Sync Service
 *
 * Fetches and caches the global exercise popularity scores.
 * These are calculated server-side based on aggregate user data.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase/client';
import type { PopularityCache } from './types';

const POPULARITY_CACHE_KEY = '@popularity_cache';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch popularity scores from the server
 */
export async function fetchPopularityFromServer(): Promise<PopularityCache | null> {
  try {
    const { data, error } = await supabase
      .from('popularity_cache')
      .select('scores, generatedAt, version')
      .eq('id', 1)
      .single();

    if (error || !data) {
      console.warn('Failed to fetch popularity cache:', error?.message);
      return null;
    }

    return {
      scores: data.scores as Record<string, number>,
      generatedAt: data.generatedAt,
      version: data.version,
    };
  } catch (error) {
    console.error('Popularity fetch error:', error);
    return null;
  }
}

/**
 * Get cached popularity scores (local storage)
 */
export async function getCachedPopularity(): Promise<PopularityCache | null> {
  try {
    const data = await AsyncStorage.getItem(POPULARITY_CACHE_KEY);
    if (!data) return null;

    const cache = JSON.parse(data) as PopularityCache & { fetchedAt: string };

    // Check if cache is still valid
    const fetchedAt = new Date(cache.fetchedAt).getTime();
    const now = Date.now();

    if (now - fetchedAt > CACHE_DURATION_MS) {
      // Cache expired
      return null;
    }

    return cache;
  } catch (error) {
    console.error('Failed to load popularity cache:', error);
    return null;
  }
}

/**
 * Save popularity scores to local cache
 */
export async function savePopularityCache(cache: PopularityCache): Promise<void> {
  try {
    const dataWithTimestamp = {
      ...cache,
      fetchedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(POPULARITY_CACHE_KEY, JSON.stringify(dataWithTimestamp));
  } catch (error) {
    console.error('Failed to save popularity cache:', error);
  }
}

/**
 * Sync popularity scores - fetch fresh if cache expired or force refresh
 */
export async function syncPopularity(forceRefresh = false): Promise<PopularityCache | null> {
  // Try local cache first
  if (!forceRefresh) {
    const cached = await getCachedPopularity();
    if (cached) {
      return cached;
    }
  }

  // Fetch from server
  const serverData = await fetchPopularityFromServer();
  if (serverData) {
    await savePopularityCache(serverData);
    return serverData;
  }

  // Fallback to expired cache if server fails
  const data = await AsyncStorage.getItem(POPULARITY_CACHE_KEY);
  if (data) {
    return JSON.parse(data) as PopularityCache;
  }

  return null;
}

/**
 * Get the local cache version for comparison
 */
export async function getLocalCacheVersion(): Promise<number> {
  try {
    const data = await AsyncStorage.getItem(POPULARITY_CACHE_KEY);
    if (!data) return 0;
    const cache = JSON.parse(data) as PopularityCache;
    return cache.version;
  } catch {
    return 0;
  }
}

/**
 * Check if server has newer popularity data
 */
export async function hasNewerPopularityData(): Promise<boolean> {
  try {
    const localVersion = await getLocalCacheVersion();

    const { data, error } = await supabase
      .from('popularity_cache')
      .select('version')
      .eq('id', 1)
      .single();

    if (error || !data) return false;

    return data.version > localVersion;
  } catch {
    return false;
  }
}
