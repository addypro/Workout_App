/**
 * Iron Will 75 Challenge Template
 *
 * 75 Days. 2 Workouts/Day. No Exceptions.
 * If you miss ONE day, the path resets to Day 1.
 *
 * Target: Gen Z / TikTok crowd (disguised 75 Hard)
 */

import type { ChallengeTemplate } from '../types';

export const IRON_WILL_75: ChallengeTemplate = {
    id: 'iron-will-75',
    name: 'The Iron Will 75',
    description: '75 Days. 2 Workouts/Day. No Exceptions. Miss a day? Start over.',
    category: 'volume',
    durationDays: 75,
    rules: {
        resetOnMiss: true,
        workoutsPerDay: 2,
        verification: 'voice_log',
    },
    pathConfig: {
        workouts: [
            // Generate 75 daily workout nodes
            ...Array.from({ length: 75 }, (_, i) => ({
                id: `iron-day-${i + 1}`,
                name: `Day ${i + 1}`,
                type: 'workout' as const,
                week: Math.floor(i / 7) + 1,
                day: (i % 7) + 1,
            })),
        ],
        checkpointInterval: 7, // Weekly checkpoints
        bossNode: {
            id: 'iron-mind-boss',
            name: 'The Iron Mind',
            type: 'boss',
        },
    },
    badgeId: 'iron-mind-badge',
};
