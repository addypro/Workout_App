/**
 * Navigation Utilities
 *
 * URL-driven routing utilities for maintaining cross-screen state.
 * Enables predictable navigation with context preservation.
 *
 * Features:
 * - Type-safe URL parameter encoding/decoding
 * - Deep link generation
 * - Navigation state preservation
 * - Back navigation utilities
 */

import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { useCallback, useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkoutContext {
  programId?: string;
  programName?: string;
  weekNumber?: number;
  dayNumber?: number;
  workoutId?: string;
  exerciseId?: string;
  muscleGroup?: string;
  equipment?: string;
  source?: 'programs' | 'discover' | 'exercises' | 'quick' | 'history';
}

export interface NavigationState {
  path: string;
  params: Record<string, string>;
  timestamp: number;
}

// ============================================================================
// PARAMETER ENCODING/DECODING
// ============================================================================

/**
 * Encode context object to URL search params
 */
export function encodeParams(context: WorkoutContext): string {
  const params = new URLSearchParams();

  Object.entries(context).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  });

  const str = params.toString();
  return str ? `?${str}` : '';
}

/**
 * Decode URL search params to context object
 */
export function decodeParams(search: string): WorkoutContext {
  const params = new URLSearchParams(search.replace(/^\?/, ''));
  const context: WorkoutContext = {};

  const stringKeys = ['programId', 'programName', 'workoutId', 'exerciseId', 'muscleGroup', 'equipment', 'source'] as const;
  const numberKeys = ['weekNumber', 'dayNumber'] as const;

  stringKeys.forEach((key) => {
    const value = params.get(key);
    if (value) (context as any)[key] = value;
  });

  numberKeys.forEach((key) => {
    const value = params.get(key);
    if (value) (context as any)[key] = parseInt(value, 10);
  });

  return context;
}

/**
 * Merge new params with existing ones
 */
export function mergeParams(
  current: string,
  updates: Partial<WorkoutContext>
): string {
  const existing = decodeParams(current);
  return encodeParams({ ...existing, ...updates });
}

// ============================================================================
// DEEP LINKS
// ============================================================================

export const DeepLinks = {
  /** Quick workout without program */
  quickWorkout: () => '/workout/quick',

  /** Program day workout */
  programDay: (programId: string, week: number, day: number) =>
    `/workout/${programId}${encodeParams({ weekNumber: week, dayNumber: day })}`,

  /** Exercise detail */
  exercise: (exerciseId: string, source?: WorkoutContext['source']) =>
    `/exercise/${exerciseId}${encodeParams({ source })}`,

  /** Program detail */
  program: (programId: string) => `/program/${programId}`,

  /** Browse with filters */
  browseFiltered: (filters: Partial<WorkoutContext>) =>
    `/(tabs)/browse${encodeParams(filters)}`,

  /** Exercises with filters */
  exercisesFiltered: (filters: Partial<WorkoutContext>) =>
    `/(tabs)/explore${encodeParams(filters)}`,

  /** Workout history */
  history: () => '/history',

  /** Specific workout log */
  workoutLog: (logId: string) => `/history/${logId}`,
} as const;

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

/**
 * Navigate to a route with context
 */
export function navigateWithContext(
  path: string,
  context: WorkoutContext
): void {
  const fullPath = path.includes('?')
    ? `${path}&${encodeParams(context).slice(1)}`
    : `${path}${encodeParams(context)}`;

  router.push(fullPath as any);
}

/**
 * Replace current route with context
 */
export function replaceWithContext(
  path: string,
  context: WorkoutContext
): void {
  const fullPath = path.includes('?')
    ? `${path}&${encodeParams(context).slice(1)}`
    : `${path}${encodeParams(context)}`;

  router.replace(fullPath as any);
}

/**
 * Go back with optional result
 */
export function goBackWithResult(result?: Record<string, any>): void {
  if (router.canGoBack()) {
    router.back();
    // Result can be handled via a callback or event
  } else {
    router.replace('/(tabs)' as any);
  }
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to get and manipulate navigation context
 */
export function useNavigationContext() {
  const params = useLocalSearchParams<Record<string, string>>();
  const pathname = usePathname();

  const context = useMemo<WorkoutContext>(() => {
    const ctx: WorkoutContext = {};

    if (params.programId) ctx.programId = params.programId;
    if (params.programName) ctx.programName = params.programName;
    if (params.weekNumber) ctx.weekNumber = parseInt(params.weekNumber, 10);
    if (params.dayNumber) ctx.dayNumber = parseInt(params.dayNumber, 10);
    if (params.workoutId) ctx.workoutId = params.workoutId;
    if (params.exerciseId) ctx.exerciseId = params.exerciseId;
    if (params.muscleGroup) ctx.muscleGroup = params.muscleGroup;
    if (params.equipment) ctx.equipment = params.equipment;
    if (params.source) ctx.source = params.source as WorkoutContext['source'];

    return ctx;
  }, [params]);

  const updateContext = useCallback(
    (updates: Partial<WorkoutContext>) => {
      const newContext = { ...context, ...updates };
      const newPath = `${pathname}${encodeParams(newContext)}`;
      router.setParams(newContext as any);
    },
    [context, pathname]
  );

  const navigateTo = useCallback(
    (path: string, additionalContext?: Partial<WorkoutContext>) => {
      navigateWithContext(path, { ...context, ...additionalContext });
    },
    [context]
  );

  return {
    context,
    pathname,
    params,
    updateContext,
    navigateTo,
    hasContext: Object.keys(context).length > 0,
  };
}

/**
 * Hook to build breadcrumb trail
 */
export function useBreadcrumbs() {
  const { context, pathname } = useNavigationContext();

  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; path: string }[] = [];

    // Always start with home
    crumbs.push({ label: 'Home', path: '/(tabs)/index' });

    // Add program if in context
    if (context.programId && context.programName) {
      crumbs.push({
        label: context.programName,
        path: `/program/${context.programId}`,
      });
    }

    // Add week/day if in workout context
    if (context.weekNumber !== undefined && context.dayNumber !== undefined) {
      crumbs.push({
        label: `Week ${context.weekNumber} Day ${context.dayNumber}`,
        path: DeepLinks.programDay(
          context.programId || '',
          context.weekNumber,
          context.dayNumber
        ),
      });
    }

    // Add current screen based on pathname
    if (pathname.includes('/exercise/')) {
      crumbs.push({ label: 'Exercise', path: pathname });
    } else if (pathname.includes('/workout/')) {
      crumbs.push({ label: 'Workout', path: pathname });
    } else if (pathname.includes('/history')) {
      crumbs.push({ label: 'History', path: pathname });
    }

    return crumbs;
  }, [context, pathname]);

  const navigateToCrumb = useCallback((index: number) => {
    const crumb = breadcrumbs[index];
    if (crumb) {
      router.push(crumb.path as any);
    }
  }, [breadcrumbs]);

  return {
    breadcrumbs,
    navigateToCrumb,
    canGoBack: breadcrumbs.length > 1,
    currentCrumb: breadcrumbs[breadcrumbs.length - 1],
  };
}

/**
 * Hook for prefetching routes
 */
export function usePrefetch() {
  // Note: Expo Router doesn't have built-in prefetch, but we can preload data
  const prefetch = useCallback((path: string) => {
    // This would trigger data prefetching
    // For now, it's a no-op placeholder for future implementation
    console.log(`Prefetching: ${path}`);
  }, []);

  return { prefetch };
}

// ============================================================================
// ROUTE PATTERNS
// ============================================================================

export const RoutePatterns = {
  /** Check if path is a tab route */
  isTabRoute: (path: string) => path.startsWith('/(tabs)/'),

  /** Check if path is a workout route */
  isWorkoutRoute: (path: string) => path.startsWith('/workout/'),

  /** Check if path is an exercise route */
  isExerciseRoute: (path: string) => path.startsWith('/exercise/'),

  /** Check if path is a program route */
  isProgramRoute: (path: string) => path.startsWith('/program/'),

  /** Extract ID from route */
  extractId: (path: string): string | null => {
    const match = path.match(/\/([^/?]+)(?:\?|$)/);
    return match ? match[1] : null;
  },
} as const;
