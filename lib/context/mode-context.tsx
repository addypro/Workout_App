/**
 * Mode Context - Shapeshifting UI Engine
 *
 * Controls the app's contextual navigation based on user state:
 * - HOME: Default browsing mode (blue theme)
 * - GYM: Active workout mode (red theme, focused UI)
 * - JURY: Tribunal verification mode (grey theme)
 *
 * Auto-switches based on:
 * - Active workout detection
 * - Geofence triggers (placeholder)
 * - Pending PR verifications (placeholder)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth, useUserId } from '@/lib/context/auth-context';
import { getLatestActiveWorkoutState } from '@/lib/db/storage';

// ============================================
// TYPES
// ============================================

export type AppMode = 'HOME' | 'GYM' | 'JURY';

interface ModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  /** Whether user manually overrode the auto-detected mode */
  isManualOverride: boolean;
  /** Reset to auto-detect mode */
  resetToAuto: () => void;
  /** Check if there's an active workout */
  hasActiveWorkout: boolean;
  /** Number of pending PR verifications (Tribunal) */
  pendingVerifications: number;
}

// Legacy storage key prefix for active workouts (pre-SQLite)
const LEGACY_WORKOUT_SESSION_PREFIX = 'workout-session-';

// ============================================
// CONTEXT
// ============================================

const ModeContext = createContext<ModeContextType | undefined>(undefined);

// ============================================
// HOOKS (Placeholders for future implementation)
// ============================================

/**
 * Placeholder hook for geofence detection
 * Will detect when user enters/exits gym locations
 */
function useGeofence(): { isAtGym: boolean } {
  // TODO: Implement with expo-location geofencing
  // For now, always returns false
  return { isAtGym: false };
}

/**
 * Placeholder hook for pending PR verifications
 * Returns count of PRs awaiting user's tribunal vote
 */
function usePendingVerifications(): { count: number } {
  // TODO: Fetch from Supabase tribunal queue
  // For now, returns 0
  return { count: 0 };
}

// ============================================
// PROVIDER
// ============================================

interface ModeProviderProps {
  children: React.ReactNode;
}

// Cache expiry for AsyncStorage.getAllKeys() - 30 seconds
const KEYS_CACHE_TTL_MS = 30000;

export function ModeProvider({ children }: ModeProviderProps) {
  const { user } = useAuth();
  const userId = useUserId();
  const [mode, setModeInternal] = useState<AppMode>('HOME');
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [hasActiveWorkout, setHasActiveWorkout] = useState(false);

  // Placeholder hooks
  const { isAtGym } = useGeofence();
  const { count: pendingVerifications } = usePendingVerifications();

  // STATE-OF-THE-ART PATTERN: Cache AsyncStorage keys to prevent repeated scans
  // getAllKeys() is expensive and blocks the JS thread; caching eliminates lag
  const keysCache = useRef<{ keys: string[]; timestamp: number } | null>(null);

  /**
   * Get cached AsyncStorage keys (refreshes every 30 seconds)
   * This prevents repeated getAllKeys() scans that cause UI lag
   */
  const getCachedKeys = useCallback(async (): Promise<string[]> => {
    const now = Date.now();

    // Return cached keys if still fresh
    if (keysCache.current && (now - keysCache.current.timestamp) < KEYS_CACHE_TTL_MS) {
      return keysCache.current.keys;
    }

    // Fetch fresh keys (spread to convert readonly string[] to string[])
    const allKeys = [...await AsyncStorage.getAllKeys()];
    keysCache.current = { keys: allKeys, timestamp: now };
    return allKeys;
  }, []);

  /**
   * Invalidate keys cache (call after writing new active workout keys)
   */
  const invalidateKeysCache = useCallback(() => {
    keysCache.current = null;
  }, []);

  /**
   * Check for any active workout in AsyncStorage
   * Uses cached keys to avoid repeated scans
   */
  const checkActiveWorkout = useCallback(async (): Promise<boolean> => {
    try {
      const latest = await getLatestActiveWorkoutState(userId);
      if (latest) {
        return true;
      }
    } catch (error) {
      console.error('[ModeContext] Error checking active workout:', error);
    }

    try {
      const allKeys = await getCachedKeys();
      const legacyKeys = allKeys.filter((key) => key.startsWith(LEGACY_WORKOUT_SESSION_PREFIX));

      if (legacyKeys.length === 0) return false;

      for (const key of legacyKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const state = JSON.parse(data);
          if (state?.status === 'in_progress' || state?.status === 'paused') {
            return true;
          }
        }
      }
    } catch (error) {
      console.error('[ModeContext] Error checking legacy workouts:', error);
    }

    return false;
  }, [getCachedKeys, userId]);

  /**
   * Auto-detect the appropriate mode based on context
   */
  const detectMode = useCallback(async () => {
    if (isManualOverride) return;

    // Priority 1: Active workout -> GYM mode
    const hasWorkout = await checkActiveWorkout();
    setHasActiveWorkout(hasWorkout);

    if (hasWorkout) {
      setModeInternal('GYM');
      return;
    }

    // Priority 2: At gym (geofence) -> GYM mode
    if (isAtGym) {
      setModeInternal('GYM');
      return;
    }

    // Priority 3: Pending verifications -> JURY mode
    if (pendingVerifications > 0) {
      setModeInternal('JURY');
      return;
    }

    // Default: HOME mode
    setModeInternal('HOME');
  }, [isManualOverride, checkActiveWorkout, isAtGym, pendingVerifications]);

  // Run detection on mount and when dependencies change
  useEffect(() => {
    detectMode();
  }, [detectMode, user?.id]);

  // Poll for active workout changes (every 5 seconds when in HOME mode)
  useEffect(() => {
    if (mode !== 'HOME' || isManualOverride) return;

    const interval = setInterval(() => {
      detectMode();
    }, 5000);

    return () => clearInterval(interval);
  }, [mode, isManualOverride, detectMode]);

  /**
   * Manually set mode (overrides auto-detection)
   */
  const setMode = useCallback((newMode: AppMode) => {
    setModeInternal(newMode);
    setIsManualOverride(true);
  }, []);

  /**
   * Reset to auto-detection
   */
  const resetToAuto = useCallback(() => {
    setIsManualOverride(false);
    detectMode();
  }, [detectMode]);

  const value = useMemo<ModeContextType>(
    () => ({
      mode,
      setMode,
      isManualOverride,
      resetToAuto,
      hasActiveWorkout,
      pendingVerifications,
    }),
    [mode, setMode, isManualOverride, resetToAuto, hasActiveWorkout, pendingVerifications]
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

// ============================================
// HOOK
// ============================================

export function useMode(): ModeContextType {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
}

// ============================================
// MODE COLORS (for tab bar theming)
// ============================================

export const ModeColors = {
  HOME: {
    tabBarActive: '#007AFF', // iOS Blue
    tabBarInactive: '#8E8E93',
    tabBarBackground: 'rgba(255, 255, 255, 0.95)',
    tabBarBackgroundDark: 'rgba(28, 28, 30, 0.95)',
  },
  GYM: {
    tabBarActive: '#FF3B30', // iOS Red
    tabBarInactive: '#8E8E93',
    tabBarBackground: 'rgba(255, 248, 247, 0.95)',
    tabBarBackgroundDark: 'rgba(40, 28, 28, 0.95)',
  },
  JURY: {
    tabBarActive: '#8E8E93', // iOS Grey
    tabBarInactive: '#636366',
    tabBarBackground: 'rgba(242, 242, 247, 0.95)',
    tabBarBackgroundDark: 'rgba(44, 44, 46, 0.95)',
  },
} as const;

/**
 * Get colors for the current mode
 */
export function getModeColors(mode: AppMode, isDark: boolean) {
  const modeConfig = ModeColors[mode];
  return {
    tabBarActive: modeConfig.tabBarActive,
    tabBarInactive: modeConfig.tabBarInactive,
    tabBarBackground: isDark ? modeConfig.tabBarBackgroundDark : modeConfig.tabBarBackground,
  };
}
