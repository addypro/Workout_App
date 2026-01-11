/**
 * Notification Types
 *
 * Type definitions for push notifications sent to coaches
 * when athletes interact with assigned workouts.
 */

// ============================================
// NOTIFICATION TYPES
// ============================================

export type NotificationType =
    | 'workout_started'
    | 'workout_completed';

export interface WorkoutStartedPayload {
    type: 'workout_started';
    athleteUserId: string;
    athleteName: string;
    workoutId: string;
    workoutName: string;
    programName?: string;
    startedAt: Date;
}

export interface PRRecord {
    exerciseName: string;
    prType: 'weight' | 'volume' | 'reps';
    previousValue: number;
    newValue: number;
    unit?: string;
}

export interface WorkoutCompletedPayload {
    type: 'workout_completed';
    athleteUserId: string;
    athleteName: string;
    workoutId: string;
    workoutName: string;
    programName?: string;
    startedAt: Date;
    completedAt: Date;
    durationMinutes: number;
    exerciseCount: number;
    totalSets: number;
    prs: PRRecord[];
    averageRestSeconds?: number;
    athleteRating?: number;
    athleteFeedback?: string;
}

export type CoachNotificationPayload =
    | WorkoutStartedPayload
    | WorkoutCompletedPayload;

// ============================================
// PUSH TOKEN TYPES
// ============================================

export interface PushToken {
    id: string;
    userId: string;
    pushToken: string;
    platform: 'ios' | 'android';
    createdAt: Date;
    updatedAt: Date;
}

export interface RegisterTokenInput {
    pushToken: string;
    platform: 'ios' | 'android';
}

// ============================================
// NOTIFICATION DISPLAY
// ============================================

export interface NotificationDisplay {
    title: string;
    body: string;
    data?: Record<string, unknown>;
}

export function formatNotification(payload: CoachNotificationPayload): NotificationDisplay {
    if (payload.type === 'workout_started') {
        return {
            title: '🏋️ Workout Started',
            body: `${payload.athleteName} started ${payload.workoutName}`,
            data: { type: payload.type, workoutId: payload.workoutId },
        };
    }

    // workout_completed
    const prText = payload.prs.length > 0
        ? ` - ${payload.prs.length} PR${payload.prs.length > 1 ? 's' : ''}!`
        : '';

    return {
        title: '✅ Workout Completed',
        body: `${payload.athleteName} finished ${payload.workoutName}${prText} (${payload.durationMinutes}min)`,
        data: {
            type: payload.type,
            workoutId: payload.workoutId,
            prs: payload.prs,
        },
    };
}
