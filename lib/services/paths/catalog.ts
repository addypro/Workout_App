/**
 * Paths Catalog
 *
 * Hardcoded path definitions. Reuses existing challenge templates
 * from lib/services/challenges/templates.ts.
 */

import { ALL_CHALLENGE_TEMPLATES } from '../challenges';
import type { Path, PathNode } from './types';

// Re-export for external consumers
export type { Path, PathNode } from './types';

// ============================================
// STARTER DAG PATH
// ============================================

/**
 * A simple starter path with 4 nodes demonstrating DAG structure.
 * Node 1 (Start) -> Node 2 (Build) + Node 3 (Recover) -> Node 4 (Boss)
 */
export const STARTER_PATH: Path = {
    id: 'starter-path',
    type: 'program',
    name: 'Getting Started',
    description: 'Your first week of training. Complete workouts to unlock the Boss challenge.',
    nodes: [
        {
            id: 'day-1-start',
            type: 'workout',
            status: 'available',
            title: 'Day 1: Foundation',
            subtitle: 'Start your journey',
            position: 0,
            x: 0.5,
            y: 0.1,
            connections: ['day-2-build', 'day-3-recover'],
            meta: { xpReward: 50, icon: 'dumbbell' },
        },
        {
            id: 'day-2-build',
            type: 'workout',
            status: 'locked',
            title: 'Day 2: Build',
            subtitle: 'Push your limits',
            position: 1,
            x: 0.25,
            y: 0.4,
            connections: ['day-4-boss'],
            meta: { xpReward: 50, icon: 'flame.fill' },
        },
        {
            id: 'day-3-recover',
            type: 'rest',
            status: 'locked',
            title: 'Day 3: Active Recovery',
            subtitle: 'Light movement',
            position: 2,
            x: 0.75,
            y: 0.4,
            connections: ['day-4-boss'],
            meta: { xpReward: 25, icon: 'heart.fill', isOptional: true },
        },
        {
            id: 'day-4-boss',
            type: 'boss',
            status: 'locked',
            title: 'Week 1 Boss',
            subtitle: 'Test your progress',
            position: 3,
            x: 0.5,
            y: 0.7,
            connections: [],
            meta: { xpReward: 100, icon: 'star.fill', color: '#FFD700' },
        },
    ],
    activeNodeId: 'day-1-start',
    progress: 0,
    totalXp: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

// ============================================
// CHALLENGE TEMPLATE PATHS
// ============================================

/**
 * Generate a linear path from a challenge template.
 */
export function generatePathFromChallenge(
    challengeId: string,
    totalDays: number
): Path | null {
    const template = ALL_CHALLENGE_TEMPLATES.find(t => t.id === challengeId);
    if (!template) return null;

    const nodes: PathNode[] = [];
    const checkpointInterval = template.pathConfig.checkpointInterval || 7;

    for (let day = 1; day <= totalDays; day++) {
        const isCheckpoint = day % checkpointInterval === 0;
        const isBoss = day === totalDays;

        let nodeType: PathNode['type'] = 'workout';
        if (isBoss) nodeType = 'boss';
        else if (isCheckpoint) nodeType = 'checkpoint';

        const node: PathNode = {
            id: `${challengeId}-day-${day}`,
            type: nodeType,
            status: day === 1 ? 'available' : 'locked',
            title: isBoss ? 'Final Boss' : isCheckpoint ? `Week ${day / checkpointInterval} Complete` : `Day ${day}`,
            subtitle: template.name,
            position: day - 1,
            x: 0.5,
            y: (day - 1) / totalDays,
            connections: day < totalDays ? [`${challengeId}-day-${day + 1}`] : [],
            meta: {
                xpReward: isBoss ? 200 : isCheckpoint ? 100 : 25,
                icon: isBoss ? 'crown.fill' : isCheckpoint ? 'flag.fill' : 'circle.fill',
            },
        };

        nodes.push(node);
    }

    return {
        id: `path-${challengeId}`,
        type: 'challenge',
        name: template.name,
        description: template.description,
        nodes,
        activeNodeId: nodes[0]?.id,
        progress: 0,
        totalXp: 0,
        referenceId: challengeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

// ============================================
// CATALOG
// ============================================

export const PATH_CATALOG = {
    'starter-path': STARTER_PATH,
} as const;

/**
 * Get all available paths (hardcoded + generated from challenges).
 */
export function getAllPaths(): Path[] {
    const paths: Path[] = [STARTER_PATH];

    // Generate paths from challenge templates
    for (const template of ALL_CHALLENGE_TEMPLATES) {
        const totalDays = template.durationDays ?? 30;
        const path = generatePathFromChallenge(template.id, totalDays);
        if (path) {
            paths.push(path);
        }
    }

    return paths;
}

/**
 * Get a specific path by ID.
 */
export function getPath(pathId: string): Path | null {
    if (pathId === 'starter-path') {
        return STARTER_PATH;
    }

    // Check if it's a challenge-based path
    if (pathId.startsWith('path-')) {
        const challengeId = pathId.replace('path-', '');
        const template = ALL_CHALLENGE_TEMPLATES.find(t => t.id === challengeId);
        if (template) {
            return generatePathFromChallenge(challengeId, template.durationDays ?? 30);
        }
    }

    return null;
}
