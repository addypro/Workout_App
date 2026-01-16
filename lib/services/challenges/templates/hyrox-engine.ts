/**
 * Hyrox Engine Challenge Template
 *
 * 12-Week hybrid training for Hyrox-style competition.
 * Mixed modal: Running + Sled + Wall Balls + Ski Erg.
 *
 * Target: Functional Fitness / Crossfitters
 */

import type { ChallengeTemplate } from '../types';

export const HYROX_ENGINE: ChallengeTemplate = {
    id: 'hyrox-engine',
    name: 'The Hyrox Engine',
    description: '12 weeks of hybrid training. Running meets functional fitness.',
    category: 'hybrid',
    durationDays: 84, // 12 weeks
    rules: {
        verification: 'voice_log',
        workoutsPerDay: 1,
    },
    pathConfig: {
        workouts: [
            // Phase 1: Base Building (Weeks 1-4)
            { id: 'hyrox-w1d1', name: 'Run Foundation', type: 'workout', week: 1, day: 1 },
            { id: 'hyrox-w1d2', name: 'Strength Circuit', type: 'workout', week: 1, day: 3 },
            { id: 'hyrox-w1d3', name: 'Mixed Modal', type: 'workout', week: 1, day: 5 },
            { id: 'hyrox-w2d1', name: 'Long Run', type: 'workout', week: 2, day: 1 },
            { id: 'hyrox-w2d2', name: 'Wall Ball Focus', type: 'workout', week: 2, day: 3 },
            { id: 'hyrox-w2d3', name: 'Tempo Work', type: 'workout', week: 2, day: 5 },
            { id: 'hyrox-w3d1', name: 'Intervals', type: 'workout', week: 3, day: 1 },
            { id: 'hyrox-w3d2', name: 'Sled Power', type: 'workout', week: 3, day: 3 },
            { id: 'hyrox-w3d3', name: 'Recovery Run', type: 'workout', week: 3, day: 5 },
            { id: 'hyrox-w4d1', name: 'Test Week', type: 'workout', week: 4, day: 1 },
            { id: 'hyrox-w4d2', name: 'Benchmark', type: 'workout', week: 4, day: 3 },
            { id: 'hyrox-p1-mile', name: 'Phase 1 Complete', type: 'milestone', week: 4 },

            // Phase 2: Build (Weeks 5-8)
            { id: 'hyrox-w5d1', name: 'Speed Work', type: 'workout', week: 5, day: 1 },
            { id: 'hyrox-w5d2', name: 'Strength Build', type: 'workout', week: 5, day: 3 },
            { id: 'hyrox-w5d3', name: 'Race Simulation', type: 'workout', week: 5, day: 5 },
            { id: 'hyrox-w6d1', name: 'Hill Repeats', type: 'workout', week: 6, day: 1 },
            { id: 'hyrox-w6d2', name: 'Functional Power', type: 'workout', week: 6, day: 3 },
            { id: 'hyrox-w6d3', name: 'Long Mixed', type: 'workout', week: 6, day: 5 },
            { id: 'hyrox-w7d1', name: 'Lactate Threshold', type: 'workout', week: 7, day: 1 },
            { id: 'hyrox-w7d2', name: 'Full Circuit', type: 'workout', week: 7, day: 3 },
            { id: 'hyrox-w7d3', name: 'Recovery', type: 'workout', week: 7, day: 5 },
            { id: 'hyrox-w8d1', name: 'Test Effort', type: 'workout', week: 8, day: 1 },
            { id: 'hyrox-w8d2', name: 'Benchmark 2', type: 'workout', week: 8, day: 3 },
            { id: 'hyrox-p2-mile', name: 'Phase 2 Complete', type: 'milestone', week: 8 },

            // Phase 3: Peak (Weeks 9-12)
            { id: 'hyrox-w9d1', name: 'Race Pace', type: 'workout', week: 9, day: 1 },
            { id: 'hyrox-w9d2', name: 'Full Simulation', type: 'workout', week: 9, day: 3 },
            { id: 'hyrox-w9d3', name: 'Active Recovery', type: 'workout', week: 9, day: 5 },
            { id: 'hyrox-w10d1', name: 'Race Prep A', type: 'workout', week: 10, day: 1 },
            { id: 'hyrox-w10d2', name: 'Race Prep B', type: 'workout', week: 10, day: 3 },
            { id: 'hyrox-w10d3', name: 'Shakeout', type: 'workout', week: 10, day: 5 },
            { id: 'hyrox-w11d1', name: 'Final Tune', type: 'workout', week: 11, day: 1 },
            { id: 'hyrox-w11d2', name: 'Easy Movers', type: 'workout', week: 11, day: 3 },
            { id: 'hyrox-w11d3', name: 'Rest & Prepare', type: 'workout', week: 11, day: 5 },
            { id: 'hyrox-w12d1', name: 'Pre-Race', type: 'workout', week: 12, day: 1 },
        ],
        bossNode: {
            id: 'hyrox-race',
            name: 'Race Day Ready',
            type: 'boss',
        },
    },
    badgeId: 'hyrox-engine-badge',
};
