/**
 * Coach Service Types
 *
 * Type definitions for the coach feature including:
 * - Subscription tiers and limits
 * - Coach-athlete relationships
 * - Program assignments
 * - Custom exercises
 */

// ============================================
// ENUMS
// ============================================

export const SubscriptionTier = {
  TRIAL: 'trial',
  STARTER: 'starter',
  PRO: 'pro',
  ELITE: 'elite',
} as const;

export type SubscriptionTier = typeof SubscriptionTier[keyof typeof SubscriptionTier];

export const SubscriptionStatus = {
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  INCOMPLETE: 'incomplete',
} as const;

export type SubscriptionStatus = typeof SubscriptionStatus[keyof typeof SubscriptionStatus];

export const InviteMethod = {
  CODE: 'code',
  LINK: 'link',
  EMAIL: 'email',
} as const;

export type InviteMethod = typeof InviteMethod[keyof typeof InviteMethod];

export const AthleteStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  REMOVED: 'removed',
  LEFT: 'left',
} as const;

export type AthleteStatus = typeof AthleteStatus[keyof typeof AthleteStatus];

export const AssignmentStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
} as const;

export type AssignmentStatus = typeof AssignmentStatus[keyof typeof AssignmentStatus];

export const WorkoutStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
} as const;

export type WorkoutStatus = typeof WorkoutStatus[keyof typeof WorkoutStatus];

export const ProgramCategory = {
  STRENGTH: 'strength',
  HYPERTROPHY: 'hypertrophy',
  POWERLIFTING: 'powerlifting',
  BODYBUILDING: 'bodybuilding',
  CROSSFIT: 'crossfit',
  SPORT_SPECIFIC: 'sport_specific',
  REHABILITATION: 'rehabilitation',
  GENERAL_FITNESS: 'general_fitness',
} as const;

export type ProgramCategory = typeof ProgramCategory[keyof typeof ProgramCategory];

// ============================================
// TIER CONFIGURATION
// ============================================

export const TIER_LIMITS: Record<SubscriptionTier, number> = {
  trial: 50,     // Full access during 14-day trial
  starter: 10,
  pro: 50,
  elite: 99999,  // Essentially unlimited
};

export const TIER_PRICES: Record<Exclude<SubscriptionTier, 'trial'>, { monthly: number; yearly: number }> = {
  starter: { monthly: 29, yearly: 290 },
  pro: { monthly: 79, yearly: 790 },
  elite: { monthly: 199, yearly: 1990 },
};

// ============================================
// CORE INTERFACES
// ============================================

export interface CoachProfile {
  id: string;
  userId: string;
  displayName: string;
  businessName?: string;
  bio?: string;
  specializations: string[];
  avatarUrl?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  maxAthletes: number;
  currentAthleteCount: number;
  trialStartedAt: Date;
  trialEndsAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoachAthlete {
  id: string;
  coachId: string;
  athleteUserId: string;
  inviteMethod: InviteMethod;
  inviteCode?: string;
  invitedAt: Date;
  joinedAt?: Date;
  status: AthleteStatus;
  shareWorkoutHistory: boolean;
  shareBodyMetrics: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  athleteName?: string;
  athleteEmail?: string;
  athleteAvatarUrl?: string;
}

export interface CoachInvite {
  id: string;
  coachId: string;
  inviteType: InviteMethod;
  inviteCode: string;
  inviteLinkToken?: string;
  email?: string;
  maxUses: number;
  currentUses: number;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface CoachProgram {
  id: string;
  coachId: string;
  name: string;
  description?: string;
  category?: ProgramCategory;
  sport?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  durationWeeks?: number;
  daysPerWeek?: number;
  workouts: ProgramWorkout[];
  isTemplate: boolean;
  isPublic: boolean;
  timesAssigned: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProgramWorkout {
  week: number;
  day: number;
  slot?: 'primary' | 'secondary';  // Support 2 workouts/day (AM/PM)
  name: string;
  isRestDay?: boolean;              // Rest day flag
  exercises: ProgramExercise[];
  notes?: string;
}

export interface ProgramScheduleConfig {
  startDate: Date;
  durationWeeks: number;
  daysPerWeek: number;
  restDays: number[];  // 0=Sunday, 6=Saturday
  autoEndDate: boolean;
}

export interface ProgramExercise {
  exerciseId?: string;
  name: string;
  sets: number;
  reps: string;
  weight?: string;
  restSeconds?: number;
  tempo?: string;
  rpe?: number;
  notes?: string;
  videoUrl?: string;
}

export interface ProgramAssignment {
  id: string;
  programId: string;
  coachId: string;
  athleteUserId: string;
  startDate: Date;
  endDate?: Date;
  currentWeek: number;
  status: AssignmentStatus;
  modifications: Record<string, unknown>;
  coachNotes?: string;
  athleteNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  programName?: string;
  athleteName?: string;
}

export interface AssignedWorkout {
  id: string;
  assignmentId: string;
  athleteUserId: string;
  scheduledDate: Date;
  scheduledAt?: Date;
  scheduledTime?: Date;  // Optional specific time for workout
  weekNumber: number;
  dayNumber: number;
  workoutName: string;
  exercises: ProgramExercise[];
  status: WorkoutStatus;
  startedAt?: Date;
  completedAt?: Date;
  skippedReasonCode?: string;
  skippedReasonText?: string;
  skippedAt?: Date;
  actualResults: Record<string, unknown>;
  athleteFeedback?: string;
  athleteRating?: number;
  coachFeedback?: string;
  reminderSent?: boolean;
  incompleteNotificationSent?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuickWorkout {
  id: string;
  coachId: string;
  name: string;
  description?: string;
  exercises: ProgramExercise[];
  estimatedDuration?: number;  // minutes
  timesAssigned: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoachExercise {
  id: string;
  coachId: string;
  name: string;
  normalizedName: string;
  description?: string;
  instructions?: string;
  equipment: string[];
  muscleGroups: string[];
  movementPattern?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  videoUrl?: string;
  thumbnailUrl?: string;
  demoImages: string[];
  sportTags: string[];
  shareWithAthletes: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface CoachDashboard {
  coachId: string;
  userId: string;
  displayName: string;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  currentAthleteCount: number;
  maxAthletes: number;
  trialEndsAt?: Date;
  trialDaysRemaining?: number;
  totalPrograms: number;
  activeAssignments: number;
}

export interface AthleteCoachView {
  coachId: string;
  coachName: string;
  businessName?: string;
  bio?: string;
  avatarUrl?: string;
  status: AthleteStatus;
  shareWorkoutHistory: boolean;
  shareBodyMetrics: boolean;
  joinedAt: Date;
  activePrograms: number;
}

// ============================================
// INPUT TYPES
// ============================================

export interface CreateCoachProfileInput {
  displayName: string;
  businessName?: string;
  bio?: string;
  specializations?: string[];
}

export interface UpdateCoachProfileInput {
  displayName?: string;
  businessName?: string;
  bio?: string;
  specializations?: string[];
  avatarUrl?: string;
}

export interface CreateInviteInput {
  inviteType: InviteMethod;
  email?: string;
  maxUses?: number;
  expiresInDays?: number;
}

export interface CreateProgramInput {
  name: string;
  description?: string;
  category?: ProgramCategory;
  sport?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  durationWeeks?: number;
  daysPerWeek?: number;
  workouts?: ProgramWorkout[];
  isTemplate?: boolean;
}

export interface AssignProgramInput {
  programId: string;
  athleteUserId: string;
  startDate: Date;
  modifications?: Record<string, unknown>;
  coachNotes?: string;
}

export interface CreateExerciseInput {
  name: string;
  description?: string;
  instructions?: string;
  equipment?: string[];
  muscleGroups?: string[];
  movementPattern?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  videoUrl?: string;
  sportTags?: string[];
  shareWithAthletes?: boolean;
}

export interface AcceptInviteInput {
  inviteCode: string;
  shareWorkoutHistory?: boolean;
  shareBodyMetrics?: boolean;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
