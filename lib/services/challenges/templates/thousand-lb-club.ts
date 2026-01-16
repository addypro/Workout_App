/**
 * 1000lb Club Challenge Template
 *
 * Combined 1RM of Bench + Squat + Deadlift > 1000 lbs.
 * No time limit - milestone-based progression.
 *
 * Target: Powerlifters / Gym Bros
 */

import type { ChallengeTemplate } from '../types';

export const THOUSAND_LB_CLUB: ChallengeTemplate = {
    id: '1000lb-club',
    name: 'The 1000lb Club',
    description: 'Bench + Squat + Deadlift = 1000 lbs. Join the elite.',
    category: 'strength',
    durationDays: null, // No deadline - milestone based
    rules: {
        verification: 'pr_sum',
        prSumTarget: 1000,
        requiredExercises: ['bench press', 'squat', 'deadlift'],
    },
    pathConfig: {
        workouts: [
            {
                id: 'base-camp',
                name: 'Base Camp',
                type: 'checkpoint',
                threshold: 500,
            },
            {
                id: 'the-climb',
                name: 'The Climb',
                type: 'milestone',
                threshold: 750,
            },
            {
                id: 'the-summit',
                name: 'The Summit',
                type: 'boss',
                threshold: 1000,
            },
        ],
    },
    badgeId: '1000lb-club-badge',
};
