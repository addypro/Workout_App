/**
 * Coach Service
 *
 * Unified export for all coach-related functionality.
 * Includes profile management, invitations, programs, and exercises.
 */

// ============================================
// TYPES
// ============================================
export * from './types';

// ============================================
// PROFILE SERVICE
// ============================================
export {
  canAddAthlete, createCoachProfile, getCoachDashboard, getCoachProfile, getTrialDaysRemaining, isTrialExpired, updateCoachProfile, updateSubscriptionTier
} from './profile';

// ============================================
// INVITE SERVICE
// ============================================
export {
  // Accept (athlete side)
  acceptInvite, createCodeInvite, createEmailInvite,
  // Create invites
  createInvite, createLinkInvite, deactivateInvite,
  // Helpers
  getInviteUrl,
  // Athlete management
  getMyAthletes, getMyCoaches,
  // Manage invites
  getMyInvites, leaveCoach,
  // Lookup (for athletes)
  lookupInvite,
  lookupInviteByToken, removeAthlete, updateSharingPreferences
} from './invites';

// ============================================
// PROGRAMS SERVICE
// ============================================
export {
  addCoachFeedback, assignExercisesAsWorkout,
  // Assignments
  assignProgram, assignQuickWorkout, completeWorkout,
  // Program CRUD
  createProgram,
  // Quick workouts
  createQuickWorkout, deleteProgram,
  // Assigned workouts
  getAssignedWorkouts, getAthleteAssignments, getAthleteCalendarWorkouts, getMyAssignments, getMyPrograms, getMyQuickWorkouts, getProgram, getTodaysWorkout, getUpcomingWorkouts, skipWorkout, startWorkout, updateAssignmentStatus, updateProgram
} from './programs';

// ============================================
// EXERCISES SERVICE
// ============================================
export {
  // Bulk operations
  bulkImportExercises,
  // Exercise CRUD
  createExercise, deleteExercise,
  // Athlete access
  getCoachSharedExercises, getExercise, getExercisesByMuscleGroup, getExercisesBySport, getMyExercises, incrementUsageCount, MOVEMENT_PATTERNS, searchExercises,
  // Constants
  SPORT_TAGS, updateExercise
} from './exercises';

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

import { getCoachProfile } from './profile';

/**
 * Check if the current user is a coach
 */
export async function isCoach(): Promise<boolean> {
  const result = await getCoachProfile();
  return result.data !== null;
}

/**
 * Check if the current user has an active coach subscription
 */
export async function hasActiveSubscription(): Promise<boolean> {
  const result = await getCoachProfile();
  if (!result.data) return false;

  const profile = result.data;

  // Check trial
  if (profile.subscriptionTier === 'trial') {
    return new Date() < profile.trialEndsAt;
  }

  // Check subscription status
  return profile.subscriptionStatus === 'active';
}
