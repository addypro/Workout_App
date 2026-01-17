/**
 * Feature Flags Configuration
 *
 * Controls feature visibility and activation.
 * Supports remote sync from Supabase for staged rollouts.
 */

import { supabase } from '@/lib/supabase/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================
// TYPES
// ============================================

export type FeatureFlagName =
    | 'challenges'
    | 'leagues_v2'
    | 'ghost_users'
    | 'smart_screener'
    | 'gym'
    | 'voice_vad'
    | 'voice_streaming'
    // P0: UX Redesign
    | 'smart_fab'
    // P1: UX Redesign
    | 'resume_hero'
    | 'voice_first'
    // Weight Suggestion Engine (Phase 3)
    | 'weight_suggestions';

export interface FeatureFlag {
    enabled: boolean;
    rolloutPercent: number; // 0-100
}

// ============================================
// STATIC DEFAULTS (bundled with app)
// ============================================

export const FEATURES: Record<FeatureFlagName, FeatureFlag> = {
    /** Challenges system */
    challenges: { enabled: true, rolloutPercent: 100 },

    /** 8-tier League system */
    leagues_v2: { enabled: true, rolloutPercent: 100 },

    /** Ghost user simulation for leagues */
    ghost_users: { enabled: false, rolloutPercent: 0 },

    /** Smart Screener onboarding */
    smart_screener: { enabled: true, rolloutPercent: 100 },

    /** Gym finder and check-in */
    gym: { enabled: false, rolloutPercent: 0 },

    /** Voice activity detection */
    voice_vad: { enabled: true, rolloutPercent: 100 },

    /** Real-time voice streaming */
    voice_streaming: { enabled: false, rolloutPercent: 0 },

    // ========== P0: UX REDESIGN ==========
    /** Smart FAB with gesture controls */
    smart_fab: { enabled: true, rolloutPercent: 100 },

    // ========== P1: UX REDESIGN ==========
    /** Resume workout hero card */
    resume_hero: { enabled: true, rolloutPercent: 100 },

    /** Voice-first prompt on quick workout */
    voice_first: { enabled: false, rolloutPercent: 0 },

    // ========== WEIGHT SUGGESTION ENGINE ==========
    /** Weight suggestions based on E1RM/EWMA progression */
    weight_suggestions: { enabled: __DEV__, rolloutPercent: 100 },
};

// ============================================
// REMOTE SYNC STATE
// ============================================

const STORAGE_KEY = '@feature_flags_v3';

interface FlagState {
    flags: Record<FeatureFlagName, FeatureFlag>;
    lastSyncedAt: number | null;
    userId: string | null;
}

let state: FlagState = {
    flags: { ...FEATURES },
    lastSyncedAt: null,
    userId: null,
};

// ============================================
// ROLLOUT LOGIC
// ============================================

/**
 * Deterministic hash of user ID for consistent rollout
 */
function hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash) % 100;
}

function isInRollout(userId: string | null, rolloutPercent: number): boolean {
    if (rolloutPercent >= 100) return true;
    if (rolloutPercent <= 0) return false;
    if (!userId) return false;
    return hashUserId(userId) < rolloutPercent;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Initialize feature flags - call on app startup
 */
export async function initFeatureFlags(userId?: string): Promise<void> {
    state.userId = userId ?? null;

    // Load cached flags first
    try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            state.flags = { ...FEATURES, ...parsed.flags };
            state.lastSyncedAt = parsed.lastSyncedAt;
        }
    } catch (e) {
        console.warn('[FeatureFlags] Cache load failed:', e);
    }

    // Sync from remote (fire and forget)
    syncFlags().catch(() => { });
}

/**
 * Sync flags from Supabase app_config table
 */
export async function syncFlags(): Promise<void> {
    try {
        const { data, error } = await supabase
            .from('app_config')
            .select('key, value')
            .eq('category', 'feature_flag');

        if (error) {
            console.warn('[FeatureFlags] Sync error:', error.message);
            return;
        }

        if (data) {
            for (const row of data) {
                const flagName = row.key as FeatureFlagName;
                if (flagName in state.flags && typeof row.value === 'object') {
                    state.flags[flagName] = {
                        ...state.flags[flagName],
                        ...row.value,
                    };
                }
            }
        }

        state.lastSyncedAt = Date.now();
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
            flags: state.flags,
            lastSyncedAt: state.lastSyncedAt,
        }));

        console.log('[FeatureFlags] Synced from remote');
    } catch (e) {
        console.warn('[FeatureFlags] Sync failed:', e);
    }
}

/**
 * Check if a feature is enabled for current user
 */
export function isFeatureEnabled(flagName: FeatureFlagName): boolean {
    const flag = state.flags[flagName];
    if (!flag?.enabled) return false;
    return isInRollout(state.userId, flag.rolloutPercent);
}

/**
 * Set user ID for rollout calculations
 */
export function setFeatureFlagUserId(userId: string): void {
    state.userId = userId;
}

/**
 * Get all flags (for debugging/settings screen)
 */
export function getAllFlags(): Record<FeatureFlagName, FeatureFlag & { enabledForUser: boolean }> {
    const result: Record<string, FeatureFlag & { enabledForUser: boolean }> = {};
    for (const [name, flag] of Object.entries(state.flags)) {
        result[name] = {
            ...flag,
            enabledForUser: isFeatureEnabled(name as FeatureFlagName),
        };
    }
    return result as Record<FeatureFlagName, FeatureFlag & { enabledForUser: boolean }>;
}

// ============================================
// LEGACY COMPAT (for existing code)
// ============================================

/** @deprecated Use isFeatureEnabled() instead */
export const CHALLENGES_ENABLED = true;
export const LEAGUES_V2_ENABLED = true;
export const GHOST_USERS_ENABLED = false;
export const SMART_SCREENER_ENABLED = true;
