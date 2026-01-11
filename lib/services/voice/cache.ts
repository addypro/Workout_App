/**
 * Voice Command Cache Service
 * Multi-tier caching for transcriptions and parsed results
 *
 * Cache Hierarchy:
 * 1. Memory cache (5 min) - Recent commands
 * 2. AsyncStorage cache (7 days) - Parse results
 * 3. AsyncStorage LLM cache (30 days) - Expensive LLM responses
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { VoiceParseResult, CachedParseResult, CacheStats } from './types';

// Check if we're in a native environment (not SSR/web server)
const isNativeEnvironment = typeof window !== 'undefined' && Platform.OS !== 'web';

// Cache keys
const CACHE_KEYS = {
  PARSE_RESULTS: '@voice_parse_cache',
  LLM_RESPONSES: '@voice_llm_cache',
  STATS: '@voice_cache_stats',
};

// TTL values in milliseconds
const CACHE_TTL = {
  MEMORY: 5 * 60 * 1000,           // 5 minutes
  PARSE_RESULTS: 7 * 24 * 60 * 60 * 1000,  // 7 days
  LLM_RESPONSES: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// Maximum cache entries
const MAX_ENTRIES = {
  MEMORY: 50,
  PARSE_RESULTS: 200,
  LLM_RESPONSES: 100,
};

// Memory cache (fast, short-lived)
const memoryCache = new Map<string, CachedParseResult>();
let cacheStats: CacheStats = {
  totalEntries: 0,
  memoryEntries: 0,
  storageEntries: 0,
  hitRate: 0,
  lastCleanup: Date.now(),
};
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Normalize transcript for consistent cache keys
 */
export function normalizeTranscript(transcript: string): string {
  return transcript
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')     // Collapse whitespace
    .trim();
}

/**
 * Generate a simple hash for cache key
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `v_${Math.abs(hash).toString(36)}`;
}

/**
 * Generate cache key from normalized transcript
 */
export function getCacheKey(transcript: string): string {
  const normalized = normalizeTranscript(transcript);
  return hashString(normalized);
}

/**
 * Get cached parse result
 */
export async function getCachedResult(
  transcript: string
): Promise<VoiceParseResult | null> {
  const key = getCacheKey(transcript);

  // Check memory cache first (fastest)
  const memoryEntry = memoryCache.get(key);
  if (memoryEntry && Date.now() < memoryEntry.expiresAt) {
    memoryEntry.hitCount++;
    cacheHits++;
    updateHitRate();
    return memoryEntry.result;
  }

  // Check AsyncStorage cache (only in native environment)
  if (isNativeEnvironment) {
    try {
      const storageData = await AsyncStorage.getItem(CACHE_KEYS.PARSE_RESULTS);
      if (storageData) {
        const cache: Record<string, CachedParseResult> = JSON.parse(storageData);
        const entry = cache[key];

        if (entry && Date.now() < entry.expiresAt) {
          // Promote to memory cache
          memoryCache.set(key, { ...entry, hitCount: entry.hitCount + 1 });
          cacheHits++;
          updateHitRate();
          return entry.result;
        }
      }
    } catch (error) {
      console.warn('Cache read error:', error);
    }
  }

  cacheMisses++;
  updateHitRate();
  return null;
}

/**
 * Cache a parse result
 */
export async function cacheResult(
  transcript: string,
  result: VoiceParseResult
): Promise<void> {
  const key = getCacheKey(transcript);
  const now = Date.now();

  // Determine TTL based on whether LLM was used
  const ttl = result.processingTier === 3
    ? CACHE_TTL.LLM_RESPONSES
    : CACHE_TTL.PARSE_RESULTS;

  const entry: CachedParseResult = {
    result,
    timestamp: now,
    expiresAt: now + ttl,
    hitCount: 0,
  };

  // Add to memory cache
  memoryCache.set(key, entry);

  // Prune memory cache if needed
  if (memoryCache.size > MAX_ENTRIES.MEMORY) {
    pruneMemoryCache();
  }

  // Persist to AsyncStorage (only in native environment)
  if (isNativeEnvironment) {
    try {
      const cacheKey = result.processingTier === 3
        ? CACHE_KEYS.LLM_RESPONSES
        : CACHE_KEYS.PARSE_RESULTS;

      const storageData = await AsyncStorage.getItem(cacheKey);
      const cache: Record<string, CachedParseResult> = storageData
        ? JSON.parse(storageData)
        : {};

      cache[key] = entry;

      // Prune storage cache if needed
      const maxEntries = result.processingTier === 3
        ? MAX_ENTRIES.LLM_RESPONSES
        : MAX_ENTRIES.PARSE_RESULTS;

      if (Object.keys(cache).length > maxEntries) {
        pruneStorageCache(cache, maxEntries);
      }

      await AsyncStorage.setItem(cacheKey, JSON.stringify(cache));
      updateStats();
    } catch (error) {
      console.warn('Cache write error:', error);
    }
  }
}

/**
 * Get cached LLM response specifically
 */
export async function getCachedLLMResponse(
  transcript: string
): Promise<VoiceParseResult | null> {
  if (!isNativeEnvironment) return null;

  const key = getCacheKey(transcript);

  try {
    const storageData = await AsyncStorage.getItem(CACHE_KEYS.LLM_RESPONSES);
    if (storageData) {
      const cache: Record<string, CachedParseResult> = JSON.parse(storageData);
      const entry = cache[key];

      if (entry && Date.now() < entry.expiresAt) {
        cacheHits++;
        updateHitRate();
        return entry.result;
      }
    }
  } catch (error) {
    console.warn('LLM cache read error:', error);
  }

  return null;
}

/**
 * Clear all voice caches
 */
export async function clearCache(): Promise<void> {
  memoryCache.clear();
  if (isNativeEnvironment) {
    await AsyncStorage.multiRemove([
      CACHE_KEYS.PARSE_RESULTS,
      CACHE_KEYS.LLM_RESPONSES,
      CACHE_KEYS.STATS,
    ]);
  }
  resetStats();
}

/**
 * Clear only expired entries
 */
export async function cleanupExpiredEntries(): Promise<number> {
  // Skip cleanup in SSR/non-native environments
  if (!isNativeEnvironment) {
    return 0;
  }

  let removedCount = 0;
  const now = Date.now();

  // Clean memory cache
  for (const [key, entry] of memoryCache.entries()) {
    if (now > entry.expiresAt) {
      memoryCache.delete(key);
      removedCount++;
    }
  }

  // Clean storage caches
  for (const cacheKey of [CACHE_KEYS.PARSE_RESULTS, CACHE_KEYS.LLM_RESPONSES]) {
    try {
      const storageData = await AsyncStorage.getItem(cacheKey);
      if (storageData) {
        const cache: Record<string, CachedParseResult> = JSON.parse(storageData);
        const originalSize = Object.keys(cache).length;

        for (const key of Object.keys(cache)) {
          if (now > cache[key].expiresAt) {
            delete cache[key];
            removedCount++;
          }
        }

        if (Object.keys(cache).length !== originalSize) {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(cache));
        }
      }
    } catch (error) {
      console.warn('Cache cleanup error:', error);
    }
  }

  cacheStats.lastCleanup = now;
  await saveStats();

  return removedCount;
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  await updateStats();
  return { ...cacheStats };
}

/**
 * Check if a similar query exists in cache (for suggestions)
 */
export async function findSimilarCached(
  transcript: string
): Promise<VoiceParseResult[]> {
  const normalized = normalizeTranscript(transcript);
  const words = normalized.split(' ');
  const results: VoiceParseResult[] = [];

  // Check memory cache for similar entries
  for (const entry of memoryCache.values()) {
    if (Date.now() < entry.expiresAt) {
      const cachedNormalized = normalizeTranscript(entry.result.rawTranscript);
      const cachedWords = cachedNormalized.split(' ');

      // Simple word overlap check
      const overlap = words.filter((w) => cachedWords.includes(w)).length;
      if (overlap >= Math.ceil(words.length * 0.6)) {
        results.push(entry.result);
      }
    }
  }

  return results.slice(0, 5); // Limit suggestions
}

// ============================================
// Private helpers
// ============================================

function pruneMemoryCache(): void {
  // Remove oldest entries based on timestamp
  const entries = Array.from(memoryCache.entries());
  entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

  const toRemove = entries.slice(0, Math.ceil(MAX_ENTRIES.MEMORY * 0.2));
  for (const [key] of toRemove) {
    memoryCache.delete(key);
  }
}

function pruneStorageCache(
  cache: Record<string, CachedParseResult>,
  maxEntries: number
): void {
  const entries = Object.entries(cache);

  // Sort by hit count (keep popular) then by timestamp (remove old)
  entries.sort((a, b) => {
    if (a[1].hitCount !== b[1].hitCount) {
      return b[1].hitCount - a[1].hitCount;
    }
    return b[1].timestamp - a[1].timestamp;
  });

  // Keep only maxEntries
  const toKeep = entries.slice(0, maxEntries);
  const keys = new Set(toKeep.map(([k]) => k));

  for (const key of Object.keys(cache)) {
    if (!keys.has(key)) {
      delete cache[key];
    }
  }
}

function updateHitRate(): void {
  const total = cacheHits + cacheMisses;
  cacheStats.hitRate = total > 0 ? cacheHits / total : 0;
}

async function updateStats(): Promise<void> {
  let storageEntries = 0;

  if (isNativeEnvironment) {
    try {
      for (const cacheKey of [CACHE_KEYS.PARSE_RESULTS, CACHE_KEYS.LLM_RESPONSES]) {
        const data = await AsyncStorage.getItem(cacheKey);
        if (data) {
          const cache = JSON.parse(data);
          storageEntries += Object.keys(cache).length;
        }
      }
    } catch {
      // Ignore errors
    }
  }

  cacheStats = {
    ...cacheStats,
    memoryEntries: memoryCache.size,
    storageEntries,
    totalEntries: memoryCache.size + storageEntries,
  };
}

async function saveStats(): Promise<void> {
  if (!isNativeEnvironment) return;
  try {
    await AsyncStorage.setItem(CACHE_KEYS.STATS, JSON.stringify(cacheStats));
  } catch {
    // Ignore errors
  }
}

function resetStats(): void {
  cacheHits = 0;
  cacheMisses = 0;
  cacheStats = {
    totalEntries: 0,
    memoryEntries: 0,
    storageEntries: 0,
    hitRate: 0,
    lastCleanup: Date.now(),
  };
}

// Run cleanup on import (once per session) - only in native environments
if (isNativeEnvironment) {
  setTimeout(() => {
    cleanupExpiredEntries().catch(() => {});
  }, 5000);
}
