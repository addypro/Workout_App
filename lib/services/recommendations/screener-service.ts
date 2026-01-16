/**
 * Screener Service
 *
 * Smart onboarding that routes users to the right challenge.
 * Uses Ghost Scan (analyze history) OR 3-question wizard.
 */

import { FEATURES } from '@/lib/config/feature-flags';
import * as tribunal from '@/lib/services/tribunal/engine';

import type { ChallengeRecommendation } from '../challenges/types';

// ============================================
// WIZARD TYPES
// ============================================

export type FitnessGoal = 'look_good' | 'be_strong' | 'move_fast';
export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
export type EquipmentAccess = 'full_gym' | 'home' | 'bodyweight';

export interface WizardAnswers {
    goal: FitnessGoal;
    canDo10Pushups: boolean;
    equipment: EquipmentAccess;
}

// ============================================
// GHOST SCAN (Analyze History)
// ============================================

/**
 * Analyze user's workout history to recommend a challenge.
 * "Ghost Scan" - reads existing data without asking questions.
 */
export async function analyzeHistory(userId: string): Promise<ChallengeRecommendation> {
    if (!FEATURES.smart_screener.enabled) {
        return {
            templateId: null,
            confidence: 'low',
            reason: 'Smart Screener is disabled',
            needsWizard: true,
        };
    }

    try {
        // Get PR history from tribunal engine
        const prHistory = await tribunal.getPRHistory(userId);

        // Calculate powerlifting total
        const bench = getMaxWeight(prHistory, ['bench press', 'bench', 'barbell bench']);
        const squat = getMaxWeight(prHistory, ['squat', 'back squat', 'barbell squat']);
        const deadlift = getMaxWeight(prHistory, ['deadlift', 'conventional deadlift', 'barbell deadlift']);
        const plTotal = bench + squat + deadlift;

        // Strong powerlifting base → 1000lb Club
        if (plTotal > 800) {
            return {
                templateId: '1000lb-club',
                confidence: 'high',
                reason: `Your total is ${plTotal}lb - you're ready for the 1000lb Club!`,
                needsWizard: false,
            };
        }

        // Check workout frequency (estimate from PR count)
        const prCount = Object.keys(prHistory).length;
        const estimatedFrequency = Math.min(prCount / 4, 7); // Rough weekly estimate

        // High consistency → Iron Will 75
        if (estimatedFrequency > 4) {
            return {
                templateId: 'iron-will-75',
                confidence: 'medium',
                reason: 'Your consistency is impressive - challenge yourself with Iron Will 75!',
                needsWizard: false,
            };
        }

        // Check for running/cardio data
        const hasRunData = Object.keys(prHistory).some((ex) =>
            ['run', 'running', 'jog', 'treadmill', 'cardio'].some((term) =>
                ex.toLowerCase().includes(term)
            )
        );

        // No cardio experience → Runner's Awakening
        if (!hasRunData && prCount > 0) {
            return {
                templateId: 'runners-awakening',
                confidence: 'medium',
                reason: "Time to add cardio - start with the Runner's Awakening!",
                needsWizard: false,
            };
        }

        // Some lifting + some cardio → Hyrox Engine
        if (plTotal > 400 && hasRunData) {
            return {
                templateId: 'hyrox-engine',
                confidence: 'medium',
                reason: 'You have a solid hybrid base - try the Hyrox Engine!',
                needsWizard: false,
            };
        }

        // Not enough data for confident recommendation
        return {
            templateId: null,
            confidence: 'low',
            reason: 'Need more information to make a recommendation',
            needsWizard: true,
        };
    } catch (error) {
        console.error('[ScreenerService] Error analyzing history:', error);
        return {
            templateId: null,
            confidence: 'low',
            reason: 'Could not analyze history',
            needsWizard: true,
        };
    }
}

// ============================================
// WIZARD RECOMMENDATION
// ============================================

/**
 * Get challenge recommendation from 3-question wizard.
 * Used when Ghost Scan doesn't have enough data.
 */
export function getWizardRecommendation(answers: WizardAnswers): ChallengeRecommendation {
    const { goal, canDo10Pushups, equipment } = answers;

    // Strength goal + full gym → 1000lb Club
    if (goal === 'be_strong' && equipment === 'full_gym') {
        return {
            templateId: '1000lb-club',
            confidence: 'high',
            reason: 'Perfect match for your strength goals!',
            needsWizard: false,
        };
    }

    // Speed/endurance goal → Runner's Awakening
    if (goal === 'move_fast') {
        return {
            templateId: 'runners-awakening',
            confidence: 'high',
            reason: "Let's build your endurance foundation!",
            needsWizard: false,
        };
    }

    // Intermediate+ with gym → Hyrox Engine
    if (canDo10Pushups && equipment === 'full_gym' && goal === 'look_good') {
        return {
            templateId: 'hyrox-engine',
            confidence: 'medium',
            reason: 'Hybrid training for total body transformation!',
            needsWizard: false,
        };
    }

    // Some fitness base + not bodyweight only → Iron Will 75
    if (canDo10Pushups && equipment !== 'bodyweight') {
        return {
            templateId: 'iron-will-75',
            confidence: 'medium',
            reason: 'You have the base - now push your limits!',
            needsWizard: false,
        };
    }

    // Complete beginner → Runner's Awakening (gentle start)
    return {
        templateId: 'runners-awakening',
        confidence: 'low',
        reason: 'Start here to build consistency!',
        needsWizard: false,
    };
}

// ============================================
// COMBINED FLOW
// ============================================

/**
 * Get best challenge recommendation - tries Ghost Scan first,
 * then falls back to wizard if needed.
 */
export async function getRecommendation(
    userId: string,
    wizardAnswers?: WizardAnswers
): Promise<ChallengeRecommendation> {
    // Try Ghost Scan first
    const historyResult = await analyzeHistory(userId);

    // If Ghost Scan is confident, use it
    if (!historyResult.needsWizard && historyResult.confidence !== 'low') {
        return historyResult;
    }

    // Fall back to wizard if answers provided
    if (wizardAnswers) {
        return getWizardRecommendation(wizardAnswers);
    }

    // Otherwise, indicate wizard is needed
    return historyResult;
}

// ============================================
// HELPERS
// ============================================

function getMaxWeight(
    prHistory: Record<string, { maxWeight?: number }>,
    exerciseVariants: string[]
): number {
    let maxWeight = 0;

    for (const [exercise, data] of Object.entries(prHistory)) {
        const normalized = exercise.toLowerCase().trim();
        if (exerciseVariants.some((variant) => normalized.includes(variant))) {
            maxWeight = Math.max(maxWeight, data.maxWeight || 0);
        }
    }

    return maxWeight;
}
