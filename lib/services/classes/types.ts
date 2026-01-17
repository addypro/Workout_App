/**
 * Workout Classes Types
 *
 * Type definitions for the Workout Classes feature.
 * Enables coaches to run group workout sessions with multiple athletes.
 */

// ============================================
// ENUMS
// ============================================

export const ClassSessionStatus = {
    SCHEDULED: 'scheduled',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELED: 'canceled',
} as const;
export type ClassSessionStatus = typeof ClassSessionStatus[keyof typeof ClassSessionStatus];

export const ClassParticipantStatus = {
    JOINED: 'joined',
    WAITLISTED: 'waitlisted',
    CANCELED: 'canceled',
} as const;
export type ClassParticipantStatus = typeof ClassParticipantStatus[keyof typeof ClassParticipantStatus];

export const ClassPlanSource = {
    DEFAULT: 'default',
    HISTORY: 'history',
    COACH_OVERRIDE: 'coach_override',
} as const;
export type ClassPlanSource = typeof ClassPlanSource[keyof typeof ClassPlanSource];

export const ClassCheckinMethod = {
    TAP: 'tap',
    CODE: 'code',
    QR: 'qr',
    MANUAL: 'manual',
} as const;
export type ClassCheckinMethod = typeof ClassCheckinMethod[keyof typeof ClassCheckinMethod];

export const ClassWorkoutLogStatus = {
    PENDING_REVIEW: 'pending_review',
    REVIEWED: 'reviewed',
    AUTO_COMPLETED: 'auto_completed',
} as const;
export type ClassWorkoutLogStatus = typeof ClassWorkoutLogStatus[keyof typeof ClassWorkoutLogStatus];

// ============================================
// CORE INTERFACES
// ============================================

/**
 * Reusable workout plan for classes
 */
export interface ClassTemplate {
    id: string;
    coachId: string;

    // Template info
    name: string;
    description?: string;

    // Workout content
    exercisesJson: ClassExercise[];

    // Duration estimate (minutes)
    estimatedDurationMinutes: number;

    // Capacity defaults
    defaultCapacity: number;

    // Tags for filtering
    tags: string[];

    // Usage tracking
    timesUsed: number;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Scheduled class instance
 */
export interface ClassSession {
    id: string;
    templateId: string;
    coachId: string;

    // Session info
    name: string;
    description?: string;

    // Scheduling
    startAt: Date;
    endAt?: Date;
    timezone: string;

    // Capacity
    capacity: number;
    currentParticipantCount: number;

    // Workout content
    exercisesJson: ClassExercise[];

    // Notification settings
    reminderMinutes: number;

    // Status
    status: ClassSessionStatus;

    // Change tracking
    changeVersion: number;

    // Location
    locationName?: string;
    locationAddress?: string;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;

    // Joined fields (optional, populated by queries)
    templateName?: string;
    coachName?: string;
}

/**
 * Athlete reservation for a session
 */
export interface ClassParticipant {
    id: string;
    sessionId: string;
    athleteUserId: string;

    // Status
    status: ClassParticipantStatus;

    // Join tracking
    joinedAt: Date;
    canceledAt?: Date;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;

    // Joined fields (optional)
    athleteName?: string;
    athleteAvatarUrl?: string;
    checkedIn?: boolean;
}

/**
 * Per-athlete planned exercises for a session
 */
export interface ClassParticipantPlan {
    id: string;
    sessionId: string;
    athleteUserId: string;

    // Per-athlete exercises
    plannedExercisesJson: ClassExercise[];

    // Source of the plan
    source: ClassPlanSource;

    // Version tracking
    planVersion: number;

    // Coach notes for this athlete
    coachNotes?: string;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Check-in record
 */
export interface ClassCheckin {
    id: string;
    sessionId: string;
    athleteUserId: string;

    // Check-in details
    checkedInAt: Date;

    // Method
    method: ClassCheckinMethod;

    // Code used (if method = 'code')
    codeUsed?: string;

    // Timestamps
    createdAt: Date;
}

/**
 * Per-athlete workout completion record
 */
export interface ClassWorkoutLog {
    id: string;
    sessionId: string;
    athleteUserId: string;

    // Workout content
    exercisesJson: ClassExercise[];

    // Status
    status: ClassWorkoutLogStatus;

    // Completion tracking
    reviewedAt?: Date;
    autoCompletedAt?: Date;

    // Feedback
    athleteFeedback?: string;
    athleteRating?: number;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

// ============================================
// EXERCISE TYPES
// ============================================

/**
 * Exercise definition within a class
 */
export interface ClassExercise {
    exerciseId?: string;
    name: string;
    sets: number;
    reps: string; // e.g., "8-12", "AMRAP", "5"
    weight?: string; // e.g., "135lbs", "bodyweight", "RPE 8"
    restSeconds?: number;
    tempo?: string; // e.g., "3-1-1-0"
    rpe?: number;
    notes?: string;
    videoUrl?: string;
}

// ============================================
// INPUT TYPES
// ============================================

/**
 * Input for creating a class template
 */
export interface CreateClassTemplateInput {
    name: string;
    description?: string;
    exercisesJson: ClassExercise[];
    estimatedDurationMinutes?: number;
    defaultCapacity?: number;
    tags?: string[];
}

/**
 * Input for scheduling a class session
 */
export interface CreateClassSessionInput {
    templateId: string;
    name?: string; // Override template name
    description?: string;
    startAt: Date;
    endAt?: Date;
    capacity?: number;
    exercisesJson?: ClassExercise[]; // Override template exercises
    reminderMinutes?: number;
    locationName?: string;
    locationAddress?: string;
}

/**
 * Input for coach to customize an athlete's plan
 */
export interface UpdateParticipantPlanInput {
    sessionId: string;
    athleteUserId: string;
    plannedExercisesJson: ClassExercise[];
    coachNotes?: string;
}

// ============================================
// RESULT TYPES
// ============================================

/**
 * Service result wrapper (matches existing pattern)
 */
export interface ServiceResult<T> {
    data: T | null;
    error: string | null;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

// ============================================
// VIEW TYPES (for UI)
// ============================================

/**
 * Session with participant info (for athlete view)
 */
export interface ClassSessionWithDetails extends ClassSession {
    template?: ClassTemplate;
    myParticipation?: ClassParticipant;
    myCheckin?: ClassCheckin;
    myWorkoutLog?: ClassWorkoutLog;
}

/**
 * Session with roster (for coach view)
 */
export interface ClassSessionWithRoster extends ClassSession {
    participants: ClassParticipant[];
    checkins: ClassCheckin[];
    participantPlans: ClassParticipantPlan[];
}
