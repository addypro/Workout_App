/**
 * Challenge Types
 *
 * Type definitions for the Challenges system.
 */

// ============================================
// CHALLENGE TEMPLATE TYPES
// ============================================

export type ChallengeCategory = 'strength' | 'volume' | 'endurance' | 'hybrid';

export interface ChallengeRules {
    /** If true, missing a day resets progress to day 1 (Iron Will) */
    resetOnMiss?: boolean;
    /** Required workouts per day (Iron Will = 2) */
    workoutsPerDay?: number;
    /** Verification method */
    verification?: 'pr_sum' | 'pr_detector' | 'voice_log' | 'none';
    /** Target PR sum for strength challenges */
    prSumTarget?: number;
    /** Required exercise names for PR-based challenges */
    requiredExercises?: string[];
}

export interface ChallengePathConfig {
    /** Workouts/nodes in the challenge path */
    workouts: Array<{
        id: string;
        name: string;
        type?: 'workout' | 'checkpoint' | 'milestone' | 'boss';
        week?: number;
        day?: number;
        threshold?: number; // For PR-based milestones
    }>;
    /** Create checkpoints every N days */
    checkpointInterval?: number;
    /** Final boss node configuration */
    bossNode?: {
        id: string;
        name: string;
        type: 'boss';
    };
}

export interface ChallengeTemplate {
    id: string;
    name: string;
    description?: string;
    category: ChallengeCategory;
    durationDays: number | null; // null = unlimited (1000lb Club)
    rules: ChallengeRules;
    pathConfig: ChallengePathConfig;
    badgeId?: string;
}

// ============================================
// USER CHALLENGE TYPES
// ============================================

export type ChallengeStatus = 'active' | 'completed' | 'failed';

export interface UserChallenge {
    id: string;
    userId: string;
    templateId: string;
    pathId: string; // Links to Pathfinder path
    startDate: string; // ISO date
    currentDay: number;
    status: ChallengeStatus;
    metadata?: {
        /** Current PR totals for 1000lb Club */
        currentPRSum?: number;
        /** Last activity date */
        lastActivityDate?: string;
        /** Number of workouts today */
        workoutsToday?: number;
    };
    createdAt: string;
    updatedAt: string;
}

// ============================================
// CHALLENGE PROGRESS
// ============================================

export interface ChallengeProgress {
    challengeId: string;
    templateName: string;
    currentDay: number;
    totalDays: number | null;
    status: ChallengeStatus;
    nodesCompleted: number;
    totalNodes: number;
    percentComplete: number;
    pathId: string;
}

// ============================================
// CHALLENGE RECOMMENDATION
// ============================================

export interface ChallengeRecommendation {
    templateId: string | null;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    needsWizard: boolean;
}
