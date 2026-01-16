/**
 * League Tier System
 *
 * 8-tier Chess.com style league configuration.
 * Tiers: Wood → Stone → Bronze → Silver → Gold → Crystal → Master → Legend
 *
 * ARCHITECTURE:
 * - Database (`league_tiers` table) is the single source of truth
 * - Client-side fallback used for offline/loading states
 * - Mismatch validation warns developers when values drift
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================
// TIER CONFIGURATION
// ============================================

export interface TierConfig {
    id: number;
    name: string;
    rankOrder: number;
    icon: string;
    color: string;
    promotionTop: number; // Percentage promoted (0.2 = 20%)
    demotionBottom: number; // Percentage demoted (0.1 = 10%)
}

/**
 * Fallback tier configuration - used when database is unavailable.
 * This should match the seeded data in leagues_v2.sql.
 * If you update this, also update the SQL migration.
 */
const FALLBACK_TIERS: TierConfig[] = [
    {
        id: 1,
        name: 'Wood',
        rankOrder: 1,
        icon: '🪵',
        color: '#8B4513',
        promotionTop: 0.2,
        demotionBottom: 0, // Can't demote from Wood
    },
    {
        id: 2,
        name: 'Stone',
        rankOrder: 2,
        icon: '🪨',
        color: '#708090',
        promotionTop: 0.2,
        demotionBottom: 0.1,
    },
    {
        id: 3,
        name: 'Bronze',
        rankOrder: 3,
        icon: '🥉',
        color: '#CD7F32',
        promotionTop: 0.2,
        demotionBottom: 0.1,
    },
    {
        id: 4,
        name: 'Silver',
        rankOrder: 4,
        icon: '🥈',
        color: '#C0C0C0',
        promotionTop: 0.2,
        demotionBottom: 0.1,
    },
    {
        id: 5,
        name: 'Gold',
        rankOrder: 5,
        icon: '🥇',
        color: '#FFD700',
        promotionTop: 0.2,
        demotionBottom: 0.1,
    },
    {
        id: 6,
        name: 'Crystal',
        rankOrder: 6,
        icon: '💎',
        color: '#E0FFFF',
        promotionTop: 0.2,
        demotionBottom: 0.1,
    },
    {
        id: 7,
        name: 'Master',
        rankOrder: 7,
        icon: '👑',
        color: '#9400D3',
        promotionTop: 0.2,
        demotionBottom: 0.1,
    },
    {
        id: 8,
        name: 'Legend',
        rankOrder: 8,
        icon: '🔥',
        color: '#FF4500',
        promotionTop: 0, // Can't promote from Legend
        demotionBottom: 0.1,
    },
];

// ============================================
// TIER CACHE (SINGLE SOURCE OF TRUTH)
// ============================================

interface DatabaseTierRow {
    id: number;
    name: string;
    rank_order: number;
    icon: string;
    color: string;
    promotion_percent: number;
    demotion_percent: number;
}

function mapDatabaseRowToTierConfig(row: DatabaseTierRow): TierConfig {
    return {
        id: row.id,
        name: row.name,
        rankOrder: row.rank_order,
        icon: row.icon,
        color: row.color,
        promotionTop: Number(row.promotion_percent),
        demotionBottom: Number(row.demotion_percent),
    };
}

class TierCacheClass {
    private tiers: TierConfig[] | null = null;
    private tierById: Map<number, TierConfig> = new Map();
    private tierByName: Map<string, TierConfig> = new Map();
    private initialized = false;

    /**
     * Initialize tier cache by fetching from database.
     * Call this at app startup after authentication.
     */
    async initialize(supabase: SupabaseClient): Promise<void> {
        try {
            const { data, error } = await supabase
                .from('league_tiers')
                .select('*')
                .order('rank_order');

            if (error) {
                console.warn('[TierCache] Failed to fetch tiers from database:', error.message);
                this.useFallback();
                return;
            }

            if (data && data.length > 0) {
                this.tiers = data.map(mapDatabaseRowToTierConfig);
                this.buildLookupMaps();
                this.validateAgainstFallback();
            } else {
                console.warn('[TierCache] No tier data from database, using fallback');
                this.useFallback();
            }
        } catch (err) {
            console.warn('[TierCache] Error initializing, using fallback:', err);
            this.useFallback();
        }

        this.initialized = true;
    }

    private useFallback(): void {
        this.tiers = FALLBACK_TIERS;
        this.buildLookupMaps();
    }

    private buildLookupMaps(): void {
        this.tierById = new Map(this.getTiers().map((t) => [t.id, t]));
        this.tierByName = new Map(this.getTiers().map((t) => [t.name.toLowerCase(), t]));
    }

    /**
     * Validate that server tiers match fallback tiers.
     * Logs warning in development if mismatch detected.
     */
    private validateAgainstFallback(): void {
        if (!__DEV__) return;

        const serverTiers = this.tiers!;
        const mismatches: string[] = [];

        for (const fallback of FALLBACK_TIERS) {
            const server = serverTiers.find((t) => t.id === fallback.id);
            if (!server) {
                mismatches.push(`Tier ${fallback.name} (id=${fallback.id}) missing from database`);
                continue;
            }

            if (server.promotionTop !== fallback.promotionTop) {
                mismatches.push(
                    `${server.name}: promotionTop mismatch (server=${server.promotionTop}, fallback=${fallback.promotionTop})`
                );
            }
            if (server.demotionBottom !== fallback.demotionBottom) {
                mismatches.push(
                    `${server.name}: demotionBottom mismatch (server=${server.demotionBottom}, fallback=${fallback.demotionBottom})`
                );
            }
        }

        if (mismatches.length > 0) {
            console.warn(
                '[TierCache] ⚠️ Server/client tier config mismatch detected!\n' +
                'Update FALLBACK_TIERS in tier-system.ts to match database:\n' +
                mismatches.map((m) => `  - ${m}`).join('\n')
            );
        }
    }

    /**
     * Get all tiers. Returns cached or fallback tiers.
     */
    getTiers(): TierConfig[] {
        return this.tiers ?? FALLBACK_TIERS;
    }

    /**
     * Check if cache has been initialized from database.
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Get tier by ID.
     */
    getById(id: number): TierConfig | undefined {
        if (this.tierById.size === 0) {
            this.buildLookupMaps();
        }
        return this.tierById.get(id);
    }

    /**
     * Get tier by name (case-insensitive).
     */
    getByName(name: string): TierConfig | undefined {
        if (this.tierByName.size === 0) {
            this.buildLookupMaps();
        }
        return this.tierByName.get(name.toLowerCase());
    }

    /**
     * Get next higher tier.
     */
    getNextTier(currentTierId: number): TierConfig | undefined {
        return this.getById(currentTierId + 1);
    }

    /**
     * Get previous lower tier.
     */
    getPreviousTier(currentTierId: number): TierConfig | undefined {
        return this.getById(currentTierId - 1);
    }
}

// Singleton instance
export const TierCache = new TierCacheClass();

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the tier system by fetching config from database.
 * Call this once at app startup after authentication.
 */
export async function initializeTierSystem(supabase: SupabaseClient): Promise<void> {
    await TierCache.initialize(supabase);
}

// ============================================
// TIER LOOKUP (LEGACY API - BACKWARD COMPATIBLE)
// ============================================

/**
 * @deprecated Use TierCache.getTiers() for full list
 */
export const LEAGUE_TIERS = FALLBACK_TIERS;

export function getTierById(id: number): TierConfig | undefined {
    return TierCache.getById(id);
}

export function getTierByName(name: string): TierConfig | undefined {
    return TierCache.getByName(name);
}

export function getNextTier(currentTierId: number): TierConfig | undefined {
    return TierCache.getNextTier(currentTierId);
}

export function getPreviousTier(currentTierId: number): TierConfig | undefined {
    return TierCache.getPreviousTier(currentTierId);
}

// ============================================
// PROMOTION/DEMOTION LOGIC
// ============================================

export type PromotionStatus = 'promoted' | 'demoted' | 'retained';

/**
 * Calculate promotion status based on rank within cohort
 */
export function getPromotionStatus(
    rank: number,
    cohortSize: number,
    tier: TierConfig
): PromotionStatus {
    const promotionCutoff = Math.ceil(cohortSize * tier.promotionTop);
    const demotionCutoff = Math.floor(cohortSize * (1 - tier.demotionBottom));

    if (rank <= promotionCutoff && tier.promotionTop > 0) {
        return 'promoted';
    }

    if (rank > demotionCutoff && tier.demotionBottom > 0) {
        return 'demoted';
    }

    return 'retained';
}

/**
 * Check if user is in danger zone (bottom 20%)
 */
export function isInDangerZone(rank: number, cohortSize: number): boolean {
    const dangerCutoff = Math.floor(cohortSize * 0.8);
    return rank > dangerCutoff;
}

/**
 * Check if user is in promotion zone (top 20%)
 */
export function isInPromotionZone(rank: number, cohortSize: number): boolean {
    const promotionCutoff = Math.ceil(cohortSize * 0.2);
    return rank <= promotionCutoff;
}
