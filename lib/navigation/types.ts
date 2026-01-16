/**
 * Type-Safe Navigation System
 * 
 * Provides compile-time safety for navigation routes.
 * If a route file is renamed, TypeScript will catch broken links at build time.
 * 
 * Usage:
 * ```typescript
 * import { safeNavigate, AppRoutes } from '@/lib/navigation/types';
 * 
 * // Instead of: router.push('/workout/123')
 * safeNavigate(router, '/workout/[id]', { id: '123' });
 * ```
 */

import { Router } from 'expo-router';

// ============================================
// APP ROUTES TYPE DEFINITIONS
// ============================================

/**
 * Complete mapping of all app routes to their required parameters.
 * Update this when adding/renaming routes in the app/ directory.
 */
export type AppRoutes = {
    // ==========================================
    // TAB ROUTES (main navigation)
    // ==========================================
    '/(tabs)': undefined;
    '/(tabs)/browse': { returnTo?: string; programId?: string };
    '/(tabs)/coach': undefined;
    '/(tabs)/explore': undefined;
    '/(tabs)/tools': undefined;
    '/(tabs)/upload': undefined;
    '/(tabs)/you': undefined;

    // ==========================================
    // AUTH ROUTES
    // ==========================================
    '/(auth)/login': undefined;
    '/(auth)/landing': undefined;
    '/(auth)/select-role': undefined;
    '/(auth)/callback': undefined;

    // ==========================================
    // WORKOUT ROUTES
    // ==========================================
    '/workout/quick': undefined;
    '/workout/[id]': {
        id: string;
        week?: number;
        day?: number;
        assignmentId?: string;
    };
    '/workout/[id]/summary': {
        id: string;
        duration?: number;
        exercisesCompleted?: number;
        totalSets?: number;
        totalVolume?: number;
        savedToHistory?: boolean;
    };

    // ==========================================
    // EXERCISE ROUTES
    // ==========================================
    '/exercise-picker': { workoutIndex?: number };

    // ==========================================
    // PROGRAM ROUTES
    // ==========================================
    '/program/[id]/edit': { id: string };
    '/program/import-review': undefined;
    '/browse/[id]': { id: string };

    // ==========================================
    // HISTORY ROUTES
    // ==========================================
    '/history': undefined;
    '/history/[id]': { id: string };

    // ==========================================
    // SETTINGS ROUTES
    // ==========================================
    '/settings': undefined;

    // ==========================================
    // COACH ROUTES
    // ==========================================
    '/coach': undefined;
    '/coach/programs': undefined;
    '/coach/programs/builder': { id?: string };
    '/coach/quick-workout': undefined;
    '/coach/assign-program': { programId?: string };
    '/coach/assign-workout': { athleteId?: string };
    '/coach/athletes': undefined;
    '/coach/invite': undefined;
    '/coach/onboarding': undefined;
    '/coach/athlete/[id]': { id: string };
    '/coach/athlete/calendar': { athleteId: string };
};

// ============================================
// TYPE HELPERS
// ============================================

/** 
 * Helper type to check if all props in an object are optional.
 * Makes routes with params like { returnTo?: string } callable without args.
 */
type AllOptional<T> = T extends undefined
    ? true
    : {} extends T
    ? true
    : false;

/** Routes that can be called without parameters (undefined or all-optional params) */
export type StaticRoutes = {
    [K in keyof AppRoutes]: AllOptional<AppRoutes[K]> extends true ? K : never;
}[keyof AppRoutes];

/** Routes that require parameters (at least one required param) */
export type DynamicRoutes = Exclude<keyof AppRoutes, StaticRoutes>;

/** Get the params type for a specific route */
export type RouteParams<T extends keyof AppRoutes> = AppRoutes[T];

// ============================================
// NAVIGATION UTILITIES
// ============================================

/**
 * Build a URL string from a route and its parameters.
 * Handles both dynamic segments (e.g., [id]) and query params.
 */
function buildUrl<T extends keyof AppRoutes>(
    route: T,
    params: AppRoutes[T]
): string {
    if (!params) return route as string;

    let url = route as string;
    const queryParams: Record<string, string> = {};

    // Process each param
    for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
        if (value === undefined || value === null) continue;

        const dynamicSegment = `[${key}]`;
        if (url.includes(dynamicSegment)) {
            // Replace dynamic segment (e.g., /workout/[id] -> /workout/123)
            url = url.replace(dynamicSegment, String(value));
        } else {
            // Add as query param
            queryParams[key] = String(value);
        }
    }

    // Append query params if any
    const queryString = Object.entries(queryParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');

    return queryString ? `${url}?${queryString}` : url;
}

/**
 * Type-safe navigation wrapper.
 * Use this instead of router.push() to get compile-time route checking.
 * 
 * @example
 * // Navigate to a static route
 * safeNavigate(router, '/(tabs)/browse');
 * 
 * // Navigate to a dynamic route
 * safeNavigate(router, '/workout/[id]', { id: 'abc123', week: 1 });
 */
export function safeNavigate<T extends StaticRoutes>(
    router: Router,
    route: T
): void;
export function safeNavigate<T extends DynamicRoutes>(
    router: Router,
    route: T,
    params: AppRoutes[T]
): void;
export function safeNavigate<T extends keyof AppRoutes>(
    router: Router,
    route: T,
    params?: AppRoutes[T]
): void {
    const url = buildUrl(route, params as AppRoutes[T]);
    router.push(url as any);
}

/**
 * Type-safe replace navigation (no back history).
 */
export function safeReplace<T extends StaticRoutes>(
    router: Router,
    route: T
): void;
export function safeReplace<T extends DynamicRoutes>(
    router: Router,
    route: T,
    params: AppRoutes[T]
): void;
export function safeReplace<T extends keyof AppRoutes>(
    router: Router,
    route: T,
    params?: AppRoutes[T]
): void {
    const url = buildUrl(route, params as AppRoutes[T]);
    router.replace(url as any);
}

/**
 * Build a type-safe URL string without navigating.
 * Useful for href props in Link components.
 */
export function buildRoute<T extends StaticRoutes>(route: T): string;
export function buildRoute<T extends DynamicRoutes>(
    route: T,
    params: AppRoutes[T]
): string;
export function buildRoute<T extends keyof AppRoutes>(
    route: T,
    params?: AppRoutes[T]
): string {
    return buildUrl(route, params as AppRoutes[T]);
}
