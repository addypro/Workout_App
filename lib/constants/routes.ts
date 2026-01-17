/**
 * Route Constants
 *
 * Centralized route definitions for type-safe navigation.
 * Use these constants instead of hardcoded strings throughout the app.
 */

// ============================================
// TAB ROUTES
// ============================================

export const TABS = {
  /** Home / My Programs tab */
  HOME: '/(tabs)' as const,
  /** History / Explore tab */
  HISTORY: '/(tabs)/explore' as const,
  /** You tab (profile + settings) */
  YOU: '/(tabs)/you' as const,
  /** Coach dashboard tab (role-gated) */
  COACH: '/(tabs)/coach' as const,
} as const;

// ============================================
// AUTH ROUTES
// ============================================

export const AUTH = {
  /** Login screen */
  LOGIN: '/(auth)/login' as const,
  /** OAuth callback handler */
  CALLBACK: '/(auth)/callback' as const,
  /** Role selection for new users */
  SELECT_ROLE: '/(auth)/select-role' as const,
  /** Landing / auth entry */
  LANDING: '/(auth)/landing' as const,
} as const;

// ============================================
// COACH ROUTES
// ============================================

export const COACH = {
  /** Coach onboarding (new coaches) */
  ONBOARDING: '/coach/onboarding' as const,
  /** Athletes list */
  ATHLETES: '/coach/athletes' as const,
  /** Individual athlete detail */
  ATHLETE_DETAIL: (id: string) => `/coach/athlete/${id}` as const,
  /** Invite athletes modal */
  INVITE: '/coach/invite' as const,
  /** Assign program modal */
  ASSIGN_PROGRAM: '/coach/assign-program' as const,
} as const;

// ============================================
// WORKOUT ROUTES
// ============================================

export const WORKOUT = {
  /** Quick/ad-hoc workout */
  QUICK: '/workout/quick' as const,
  /** Program day workout execution */
  SESSION: (programId: string) => `/workout/${programId}` as const,
  /** Workout with week/day params */
  SESSION_WITH_PARAMS: (programId: string, week: number, day: number) =>
    `/workout/${programId}?week=${week}&day=${day}` as const,
  /** Week/day preview picker */
  PREVIEW: (programId: string) => `/workout/${programId}/preview` as const,
  /** Workout completion summary */
  SUMMARY: (programId: string) => `/workout/${programId}/summary` as const,
} as const;

// ============================================
// PROGRAM ROUTES
// ============================================

export const PROGRAM = {
  /** Program builder/editor */
  EDIT: (programId: string) => `/program/${programId}/edit` as const,
  /** Browse program detail */
  DETAIL: (programId: string) => `/browse?programId=${programId}` as const,
  /** Legacy program detail route */
  LEGACY_DETAIL: (programId: string) => `/browse/${programId}` as const,
} as const;

// ============================================
// HISTORY ROUTES
// ============================================

export const HISTORY = {
  /** History list */
  LIST: '/(tabs)/explore' as const,
  /** Legacy history list (kept for deep-link compatibility) */
  LEGACY_LIST: '/history' as const,
  /** Individual workout log detail */
  LOG: (logId: string) => `/history/${logId}` as const,
} as const;

// ============================================
// MODAL ROUTES
// ============================================

export const MODALS = {
  /** Exercise picker modal */
  EXERCISE_PICKER: '/exercise-picker' as const,
  /** Generic modal */
  MODAL: '/modal' as const,
} as const;

// ============================================
// COMBINED ROUTES OBJECT
// ============================================

export const ROUTES = {
  TABS,
  AUTH,
  COACH,
  WORKOUT,
  PROGRAM,
  HISTORY,
  MODALS,
} as const;

// ============================================
// TYPE EXPORTS
// ============================================

export type TabRoute = (typeof TABS)[keyof typeof TABS];
export type AuthRoute = (typeof AUTH)[keyof typeof AUTH];
export type CoachRoute = (typeof COACH)[keyof typeof COACH];
export type WorkoutRoute = (typeof WORKOUT)[keyof typeof WORKOUT];
export type ProgramRoute = (typeof PROGRAM)[keyof typeof PROGRAM];
export type HistoryRoute = (typeof HISTORY)[keyof typeof HISTORY];
export type ModalRoute = (typeof MODALS)[keyof typeof MODALS];

// ============================================
// NAVIGATION HELPERS
// ============================================

/**
 * Check if a route path is a coach-specific route
 */
export function isCoachRoute(path: string): boolean {
  return path.startsWith('/coach') || path === TABS.COACH;
}

/**
 * Check if a route path is an auth route
 */
export function isAuthRoute(path: string): boolean {
  return path.startsWith('/(auth)');
}

/**
 * Check if a route path is protected (requires authentication)
 */
export function isProtectedRoute(path: string): boolean {
  // Auth routes are public
  if (isAuthRoute(path)) return false;
  // All other routes require authentication
  return true;
}

/**
 * Get the default route for a user role
 */
export function getDefaultRoute(isCoach: boolean): string {
  return isCoach ? TABS.COACH : TABS.HOME;
}
