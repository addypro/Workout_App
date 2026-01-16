/**
 * Runner's Awakening Challenge Template
 *
 * 8-Week Couch to 5K style progression.
 * Walk/Run intervals building to continuous 5K.
 *
 * Target: Beginners / Resolutioners
 */

import type { ChallengeTemplate } from '../types';

export const RUNNERS_AWAKENING: ChallengeTemplate = {
    id: 'runners-awakening',
    name: "The Runner's Awakening",
    description: '8 weeks from couch to 5K. Start walking, finish running.',
    category: 'endurance',
    durationDays: 56, // 8 weeks
    rules: {
        verification: 'voice_log',
        workoutsPerDay: 1,
    },
    pathConfig: {
        workouts: [
            // Week 1: Run 60s, Walk 90s
            { id: 'run-w1d1', name: 'Week 1 Day 1', type: 'workout', week: 1, day: 1 },
            { id: 'run-w1d2', name: 'Week 1 Day 2', type: 'workout', week: 1, day: 3 },
            { id: 'run-w1d3', name: 'Week 1 Day 3', type: 'workout', week: 1, day: 5 },
            { id: 'run-w1-check', name: '1 Week Complete', type: 'checkpoint', week: 1 },

            // Week 2
            { id: 'run-w2d1', name: 'Week 2 Day 1', type: 'workout', week: 2, day: 1 },
            { id: 'run-w2d2', name: 'Week 2 Day 2', type: 'workout', week: 2, day: 3 },
            { id: 'run-w2d3', name: 'Week 2 Day 3', type: 'workout', week: 2, day: 5 },
            { id: 'run-w2-check', name: '2 Weeks Complete', type: 'checkpoint', week: 2 },

            // Week 3
            { id: 'run-w3d1', name: 'Week 3 Day 1', type: 'workout', week: 3, day: 1 },
            { id: 'run-w3d2', name: 'Week 3 Day 2', type: 'workout', week: 3, day: 3 },
            { id: 'run-w3d3', name: 'Week 3 Day 3', type: 'workout', week: 3, day: 5 },
            { id: 'run-w3-check', name: '3 Weeks Complete', type: 'checkpoint', week: 3 },

            // Week 4 - Milestone
            { id: 'run-w4d1', name: 'Week 4 Day 1', type: 'workout', week: 4, day: 1 },
            { id: 'run-w4d2', name: 'Week 4 Day 2', type: 'workout', week: 4, day: 3 },
            { id: 'run-w4d3', name: 'Week 4 Day 3', type: 'workout', week: 4, day: 5 },
            { id: 'run-w4-mile', name: 'Halfway There!', type: 'milestone', week: 4 },

            // Week 5
            { id: 'run-w5d1', name: 'Week 5 Day 1', type: 'workout', week: 5, day: 1 },
            { id: 'run-w5d2', name: 'Week 5 Day 2', type: 'workout', week: 5, day: 3 },
            { id: 'run-w5d3', name: 'Week 5 Day 3', type: 'workout', week: 5, day: 5 },
            { id: 'run-w5-check', name: '5 Weeks Complete', type: 'checkpoint', week: 5 },

            // Week 6
            { id: 'run-w6d1', name: 'Week 6 Day 1', type: 'workout', week: 6, day: 1 },
            { id: 'run-w6d2', name: 'Week 6 Day 2', type: 'workout', week: 6, day: 3 },
            { id: 'run-w6d3', name: 'Week 6 Day 3', type: 'workout', week: 6, day: 5 },
            { id: 'run-w6-check', name: '6 Weeks Complete', type: 'checkpoint', week: 6 },

            // Week 7
            { id: 'run-w7d1', name: 'Week 7 Day 1', type: 'workout', week: 7, day: 1 },
            { id: 'run-w7d2', name: 'Week 7 Day 2', type: 'workout', week: 7, day: 3 },
            { id: 'run-w7d3', name: 'Week 7 Day 3', type: 'workout', week: 7, day: 5 },
            { id: 'run-w7-check', name: '7 Weeks Complete', type: 'checkpoint', week: 7 },

            // Week 8 - Final
            { id: 'run-w8d1', name: 'Week 8 Day 1', type: 'workout', week: 8, day: 1 },
            { id: 'run-w8d2', name: 'Week 8 Day 2', type: 'workout', week: 8, day: 3 },
            { id: 'run-w8d3', name: 'Final 5K Run', type: 'workout', week: 8, day: 5 },
        ],
        bossNode: {
            id: 'endurance-boss',
            name: 'The Endurance',
            type: 'boss',
        },
    },
    badgeId: 'endurance-badge',
};
