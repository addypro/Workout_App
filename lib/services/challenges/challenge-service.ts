/**
 * Challenge Service
 *
 * Core logic for the Challenges system.
 * Wraps Pathfinder to create challenge-specific paths.
 *
 * DESIGN: Isolated module - imports FROM core app, never INTO.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { FEATURES } from '@/lib/config/feature-flags';
import * as pathfinder from '@/lib/services/paths/engine';
import * as tribunal from '@/lib/services/tribunal/engine';

import { ALL_CHALLENGE_TEMPLATES, getTemplateById } from './templates';
import type {
    ChallengeProgress,
    ChallengeTemplate,
    UserChallenge
} from './types';

// ============================================
// STORAGE KEYS
// ============================================

const CHALLENGE_KEY_PREFIX = '@challenges:user:';
const TODAY_WORKOUTS_KEY = '@challenges:today_workouts';

function getUserChallengeKey(userId: string): string {
    return `${CHALLENGE_KEY_PREFIX}${userId}`;
}

// ============================================
// TEMPLATE ACCESS
// ============================================

/**
 * Get all available challenge templates
 */
export function getAllTemplates(): ChallengeTemplate[] {
    if (!FEATURES.challenges.enabled) return [];
    return ALL_CHALLENGE_TEMPLATES;
}

/**
 * Get a specific template by ID
 */
export function getTemplate(templateId: string): ChallengeTemplate | undefined {
    if (!FEATURES.challenges.enabled) return undefined;
    return getTemplateById(templateId);
}

// ============================================
// CHALLENGE LIFECYCLE
// ============================================

/**
 * Join a challenge - creates user instance + pathfinder path
 */
export async function joinChallenge(
    userId: string,
    templateId: string
): Promise<UserChallenge | null> {
    if (!FEATURES.challenges.enabled) {
        console.warn('[ChallengeService] Challenges are disabled');
        return null;
    }

    const template = getTemplateById(templateId);
    if (!template) {
        console.error(`[ChallengeService] Template not found: ${templateId}`);
        return null;
    }

    // Check if already in this challenge
    const existing = await getUserChallenges(userId);
    const alreadyJoined = existing.find(
        (c) => c.templateId === templateId && c.status === 'active'
    );
    if (alreadyJoined) {
        console.warn('[ChallengeService] Already joined this challenge');
        return alreadyJoined;
    }

    // Generate pathfinder path from template config
    const pathId = `challenge-${templateId}-${userId}-${Date.now()}`;
    const workouts = template.pathConfig.workouts.map((w) => ({
        id: w.id,
        name: w.name,
        week: w.week,
        day: w.day,
    }));

    const path = pathfinder.generatePathFromProgram(
        pathId,
        template.name,
        workouts,
        { layout: 'linear', includeCheckpoints: !!template.pathConfig.checkpointInterval }
    );

    await pathfinder.savePath(path);

    // Create user challenge instance
    const now = new Date().toISOString();
    const challenge: UserChallenge = {
        id: `uc-${Date.now()}`,
        userId,
        templateId,
        pathId: path.id,
        startDate: now.split('T')[0],
        currentDay: 1,
        status: 'active',
        metadata: {
            lastActivityDate: now.split('T')[0],
            workoutsToday: 0,
        },
        createdAt: now,
        updatedAt: now,
    };

    // Save to storage
    await saveUserChallenge(userId, challenge);

    console.log(`[ChallengeService] Joined challenge: ${template.name}`);
    return challenge;
}

/**
 * Get all challenges for a user
 */
export async function getUserChallenges(userId: string): Promise<UserChallenge[]> {
    if (!FEATURES.challenges.enabled) return [];

    try {
        const key = getUserChallengeKey(userId);
        const data = await AsyncStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('[ChallengeService] Error getting challenges:', error);
        return [];
    }
}

/**
 * Get active challenges for a user
 */
export async function getActiveChallenges(userId: string): Promise<UserChallenge[]> {
    const all = await getUserChallenges(userId);
    return all.filter((c) => c.status === 'active');
}

/**
 * Get challenge progress for display
 */
export async function getChallengeProgress(
    userId: string,
    challengeId: string
): Promise<ChallengeProgress | null> {
    const challenges = await getUserChallenges(userId);
    const challenge = challenges.find((c) => c.id === challengeId);
    if (!challenge) return null;

    const template = getTemplateById(challenge.templateId);
    if (!template) return null;

    const path = await pathfinder.getPath(challenge.pathId);
    const stats = path ? pathfinder.getPathStats(path) : { completedNodes: 0, totalNodes: 0 };

    return {
        challengeId: challenge.id,
        templateName: template.name,
        currentDay: challenge.currentDay,
        totalDays: template.durationDays,
        status: challenge.status,
        nodesCompleted: stats.completedNodes,
        totalNodes: stats.totalNodes,
        percentComplete:
            stats.totalNodes > 0 ? Math.round((stats.completedNodes / stats.totalNodes) * 100) : 0,
        pathId: challenge.pathId,
    };
}

// ============================================
// DAILY PROGRESS TRACKING
// ============================================

/**
 * Record a workout for challenge progress
 * Called when a workout is completed
 */
export async function recordWorkoutForChallenge(userId: string): Promise<void> {
    if (!FEATURES.challenges.enabled) return;

    const today = new Date().toISOString().split('T')[0];
    const challenges = await getActiveChallenges(userId);

    for (const challenge of challenges) {
        // Update workouts today count
        const isNewDay = challenge.metadata?.lastActivityDate !== today;
        const workoutsToday = isNewDay ? 1 : (challenge.metadata?.workoutsToday || 0) + 1;

        challenge.metadata = {
            ...challenge.metadata,
            lastActivityDate: today,
            workoutsToday,
        };
        challenge.updatedAt = new Date().toISOString();

        await updateUserChallenge(userId, challenge);
    }
}

/**
 * Check daily progress for Iron Will style challenges
 * Should be called at end of day (or on next app open)
 */
export async function checkDailyProgress(
    userId: string
): Promise<{ failed: string[]; continued: string[] }> {
    if (!FEATURES.challenges.enabled) return { failed: [], continued: [] };

    const challenges = await getActiveChallenges(userId);
    const yesterday = getYesterday();
    const failed: string[] = [];
    const continued: string[] = [];

    for (const challenge of challenges) {
        const template = getTemplateById(challenge.templateId);
        if (!template) continue;

        // Only check reset_on_miss challenges
        if (!template.rules.resetOnMiss) {
            continued.push(challenge.id);
            continue;
        }

        const lastActivity = challenge.metadata?.lastActivityDate;
        const requiredWorkouts = template.rules.workoutsPerDay || 1;
        const workoutsLogged = challenge.metadata?.workoutsToday || 0;

        // Check if yesterday was missed
        if (lastActivity !== yesterday || workoutsLogged < requiredWorkouts) {
            // FAIL - Reset to day 1
            challenge.currentDay = 1;
            challenge.metadata = {
                ...challenge.metadata,
                workoutsToday: 0,
            };
            challenge.updatedAt = new Date().toISOString();
            await updateUserChallenge(userId, challenge);
            failed.push(challenge.id);

            console.log(`[ChallengeService] "${template.name}" reset - missed daily requirement`);
        } else {
            // Success - increment day
            challenge.currentDay += 1;

            // Check if completed
            if (template.durationDays && challenge.currentDay > template.durationDays) {
                challenge.status = 'completed';
                console.log(`[ChallengeService] "${template.name}" COMPLETED!`);
            }

            challenge.updatedAt = new Date().toISOString();
            await updateUserChallenge(userId, challenge);
            continued.push(challenge.id);
        }
    }

    return { failed, continued };
}

// ============================================
// PR-BASED MILESTONE CHECKING
// ============================================

/**
 * Check PR-based milestones (for 1000lb Club)
 * Called after PR detection
 */
export async function checkPRMilestones(
    userId: string
): Promise<{ unlocked: string[]; currentTotal: number }> {
    if (!FEATURES.challenges.enabled) return { unlocked: [], currentTotal: 0 };

    const challenges = await getActiveChallenges(userId);
    const unlocked: string[] = [];
    let currentTotal = 0;

    for (const challenge of challenges) {
        const template = getTemplateById(challenge.templateId);
        if (!template || template.rules.verification !== 'pr_sum') continue;

        // Get PR totals from tribunal engine
        const prHistory = await tribunal.getPRHistory(userId);
        currentTotal = sumPowerlifts(prHistory, template.rules.requiredExercises || []);

        // Update metadata
        challenge.metadata = {
            ...challenge.metadata,
            currentPRSum: currentTotal,
        };

        // Check milestone thresholds
        const path = await pathfinder.getPath(challenge.pathId);
        if (!path) continue;

        for (const workout of template.pathConfig.workouts) {
            if (!workout.threshold) continue;

            if (currentTotal >= workout.threshold) {
                // Find corresponding node and unlock
                const node = path.nodes.find((n) => n.id === workout.id);
                if (node && node.status !== 'completed') {
                    await pathfinder.completeNode(path, node.id, userId);
                    unlocked.push(`${workout.name} (${workout.threshold}lb)`);
                    console.log(`[ChallengeService] Unlocked milestone: ${workout.name}`);
                }
            }
        }

        // Check if fully completed
        if (currentTotal >= (template.rules.prSumTarget || 0)) {
            challenge.status = 'completed';
            console.log(`[ChallengeService] "${template.name}" COMPLETED!`);
        }

        challenge.updatedAt = new Date().toISOString();
        await updateUserChallenge(userId, challenge);
    }

    return { unlocked, currentTotal };
}

// ============================================
// HELPERS
// ============================================

async function saveUserChallenge(userId: string, challenge: UserChallenge): Promise<void> {
    const challenges = await getUserChallenges(userId);
    challenges.push(challenge);
    await AsyncStorage.setItem(getUserChallengeKey(userId), JSON.stringify(challenges));
}

async function updateUserChallenge(userId: string, updated: UserChallenge): Promise<void> {
    const challenges = await getUserChallenges(userId);
    const index = challenges.findIndex((c) => c.id === updated.id);
    if (index >= 0) {
        challenges[index] = updated;
        await AsyncStorage.setItem(getUserChallengeKey(userId), JSON.stringify(challenges));
    }
}

function getYesterday(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
}

function sumPowerlifts(prHistory: Record<string, { maxWeight?: number }>, exercises: string[]): number {
    const normalizedExercises = exercises.map((e) => e.toLowerCase().trim());
    let total = 0;

    for (const [exercise, data] of Object.entries(prHistory)) {
        const normalized = exercise.toLowerCase().trim();
        if (normalizedExercises.some((req) => normalized.includes(req) || req.includes(normalized))) {
            total += data.maxWeight || 0;
        }
    }

    return total;
}
