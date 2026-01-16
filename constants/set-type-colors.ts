/**
 * Set Type Colors
 *
 * Color definitions for different set types in workout screens.
 * Based on "The Invisible Spotter" intensity heatmap design.
 */

import type { SetType } from '@/lib/types/workout-session';

// ============================================
// SET TYPE COLORS
// ============================================

/**
 * Colors for each set type - used for badges and indicators
 */
export const SET_TYPE_COLORS: Record<SetType, { bg: string; border: string; text: string }> = {
    warmup: { bg: '#8E8E9320', border: '#8E8E93', text: '#8E8E93' },
    working: { bg: '#5AC8FA20', border: '#5AC8FA', text: '#5AC8FA' },
    top: { bg: '#FF950020', border: '#FF9500', text: '#FF9500' },
    drop: { bg: '#AF52DE20', border: '#AF52DE', text: '#AF52DE' },
    failure: { bg: '#FF3B3020', border: '#FF3B30', text: '#FF3B30' },
};

/**
 * Completed set colors - prominent green to easily identify done sets
 */
export const COMPLETED_SET_COLORS = {
    bg: '#34C75925',
    border: '#34C759',
    text: '#34C759',
    checkBg: '#34C759',
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get colors for a set based on its type and completion status
 */
export function getSetColors(
    setType: SetType,
    isCompleted: boolean
): { bg: string; border: string; text: string } {
    if (isCompleted) {
        return COMPLETED_SET_COLORS;
    }
    return SET_TYPE_COLORS[setType];
}
