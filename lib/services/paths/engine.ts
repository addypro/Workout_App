/**
 * Pathfinder Engine
 *
 * Core logic for the visual progress system.
 * Generates paths from programs and tracks user progress through nodes.
 *
 * Features:
 * - Generate paths from program data
 * - Track node completion
 * - Calculate XP and streaks
 * - Persist progress to AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  NodeType,
  Path,
  PathGenerationOptions,
  PathNode,
  UserPathProgress
} from './types';

// ============================================
// STORAGE KEYS
// ============================================

const PATHS_KEY = '@pathfinder:paths';
const PROGRESS_KEY_PREFIX = '@pathfinder:progress:';

function progressKey(userId: string, pathId: string): string {
  return `${PROGRESS_KEY_PREFIX}${userId}:${pathId}`;
}

// ============================================
// XP CONFIGURATION
// ============================================

const XP_REWARDS: Record<NodeType, number> = {
  workout: 100,
  milestone: 250,
  checkpoint: 150,
  boss: 500,
  rest: 25,
};

/**
 * Granular XP bonuses for workout effort (integrated from xp-calculator)
 */
const XP_BONUS_VALUES = {
  /** XP per minute of workout (capped at MAX_MINUTES) */
  PER_MINUTE: 2,
  /** Max workout duration in minutes for XP bonus */
  MAX_MINUTES: 90,
  /** XP per completed set */
  PER_SET: 5,
  /** XP for hitting a new PR */
  PR_HIT: 50,
  /** XP for completing a challenge node */
  CHALLENGE_NODE: 500,
} as const;

/**
 * Detailed XP breakdown for UI display
 */
export interface XPBreakdown {
  base: number;
  duration: number;
  volume: number;
  prs: number;
  total: number;
}


// ============================================
// PATH GENERATION
// ============================================

/**
 * Generate a path from program workout data
 */
export function generatePathFromProgram(
  programId: string,
  programName: string,
  workouts: Array<{
    id: string;
    name: string;
    week?: number;
    day?: number;
  }>,
  options: Partial<PathGenerationOptions> = {}
): Path {
  const { includeRestDays = false, includeMilestones = true, layout = 'linear' } = options;

  const nodes: PathNode[] = [];
  let position = 0;
  let currentWeek = 0;

  workouts.forEach((workout, index) => {
    const week = workout.week ?? Math.floor(index / 3) + 1;
    const day = workout.day ?? (index % 3) + 1;

    // Add weekly milestone node at the start of each new week
    if (includeMilestones && week > currentWeek) {
      if (currentWeek > 0) {
        // End of previous week checkpoint
        nodes.push(createCheckpointNode(position, currentWeek));
        position++;
      }
      currentWeek = week;
    }

    // Calculate node position for layout
    const { x, y } = calculateNodePosition(position, nodes.length + workouts.length, layout);

    // Create workout node
    const node: PathNode = {
      id: `node-${programId}-${workout.id}`,
      type: 'workout',
      status: position === 0 ? 'available' : 'locked',
      title: workout.name,
      subtitle: `Week ${week}, Day ${day}`,
      referenceId: workout.id,
      position,
      x,
      y,
      connections: [],
      meta: {
        xpReward: XP_REWARDS.workout,
      },
    };

    // Connect to previous node
    if (nodes.length > 0) {
      const prevNode = nodes[nodes.length - 1];
      prevNode.connections.push(node.id);
    }

    nodes.push(node);
    position++;
  });

  // Add final milestone node
  if (includeMilestones && nodes.length > 0) {
    const finalMilestone: PathNode = {
      id: `node-${programId}-complete`,
      type: 'milestone',
      status: 'locked',
      title: 'Program Complete!',
      subtitle: `${programName} Mastered`,
      position,
      x: 0.5,
      y: 1,
      connections: [],
      meta: {
        icon: 'trophy.fill',
        color: '#FFD700',
        xpReward: XP_REWARDS.milestone * 2,
      },
    };

    // Connect last node to final milestone
    const lastNode = nodes[nodes.length - 1];
    lastNode.connections.push(finalMilestone.id);
    nodes.push(finalMilestone);
  }

  return {
    id: `path-${programId}`,
    type: 'program',
    name: programName,
    nodes,
    progress: 0,
    totalXp: 0,
    referenceId: programId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create a weekly checkpoint node
 */
function createCheckpointNode(position: number, week: number): PathNode {
  return {
    id: `checkpoint-week-${week}`,
    type: 'checkpoint',
    status: 'locked',
    title: `Week ${week} Complete`,
    position,
    x: 0.5,
    y: position * 0.1,
    connections: [],
    meta: {
      icon: 'checkmark.seal.fill',
      xpReward: XP_REWARDS.checkpoint,
    },
  };
}

/**
 * Calculate node position based on layout style
 */
function calculateNodePosition(
  position: number,
  totalNodes: number,
  layout: 'linear' | 'branching' | 'spiral'
): { x: number; y: number } {
  switch (layout) {
    case 'spiral':
      // Spiral pattern from center outward
      const angle = position * 0.5;
      const radius = 0.1 + position * 0.02;
      return {
        x: 0.5 + Math.cos(angle) * radius,
        y: 0.5 + Math.sin(angle) * radius,
      };

    case 'branching':
      // Alternating left-right pattern
      const isEven = position % 2 === 0;
      return {
        x: isEven ? 0.3 : 0.7,
        y: position / Math.max(totalNodes - 1, 1),
      };

    case 'linear':
    default:
      // Simple vertical path with slight wave
      const wave = Math.sin(position * 0.5) * 0.1;
      return {
        x: 0.5 + wave,
        y: position / Math.max(totalNodes - 1, 1),
      };
  }
}

// ============================================
// XP CALCULATION
// ============================================

/**
 * Calculate granular XP for a completed workout node
 * Returns detailed breakdown for UI display
 */
export function calculateWorkoutXP(
  nodeType: NodeType,
  workoutData?: {
    durationMs?: number;
    completedSets?: number;
    newPRCount?: number;
  }
): XPBreakdown {
  // Base XP from node type
  const base = XP_REWARDS[nodeType];

  // Early return for non-workout nodes
  if (nodeType !== 'workout' || !workoutData) {
    return { base, duration: 0, volume: 0, prs: 0, total: base };
  }

  // Duration bonus (2 XP/min, capped at 90 min = 180 XP max)
  const durationMinutes = workoutData.durationMs
    ? Math.min(workoutData.durationMs / 60000, XP_BONUS_VALUES.MAX_MINUTES)
    : 0;
  const duration = Math.round(durationMinutes * XP_BONUS_VALUES.PER_MINUTE);

  // Volume bonus (5 XP/completed set)
  const volume = (workoutData.completedSets ?? 0) * XP_BONUS_VALUES.PER_SET;

  // PR bonus (50 XP/PR)
  const prs = (workoutData.newPRCount ?? 0) * XP_BONUS_VALUES.PR_HIT;

  const total = base + duration + volume + prs;

  return { base, duration, volume, prs, total };
}

// ============================================
// PROGRESS TRACKING
// ============================================

/**
 * Complete a node and update path progress
 * 
 * @param workoutData Optional workout metrics for granular XP calculation
 */
export async function completeNode(
  path: Path,
  nodeId: string,
  userId: string,
  workoutData?: {
    durationMs?: number;
    completedSets?: number;
    newPRCount?: number;
  }
): Promise<{ updatedPath: Path; xpEarned: number; xpBreakdown: XPBreakdown; newStreak: number }> {
  const nodeIndex = path.nodes.findIndex((n) => n.id === nodeId);
  if (nodeIndex === -1) {
    throw new Error(`Node ${nodeId} not found in path ${path.id}`);
  }

  const node = path.nodes[nodeIndex];
  if (node.status !== 'available' && node.status !== 'in_progress') {
    throw new Error(`Node ${nodeId} is not available for completion`);
  }

  // Update node status
  const updatedNodes = [...path.nodes];
  updatedNodes[nodeIndex] = {
    ...node,
    status: 'completed',
    completedAt: new Date().toISOString(),
    progress: 1,
  };

  // Unlock connected nodes
  node.connections.forEach((connectedId) => {
    const connectedIndex = updatedNodes.findIndex((n) => n.id === connectedId);
    if (connectedIndex !== -1 && updatedNodes[connectedIndex].status === 'locked') {
      updatedNodes[connectedIndex] = {
        ...updatedNodes[connectedIndex],
        status: 'available',
      };
    }
  });

  // Calculate progress
  const completedCount = updatedNodes.filter((n) => n.status === 'completed').length;
  const progress = completedCount / updatedNodes.length;

  // Calculate XP with granular bonuses
  const xpBreakdown = calculateWorkoutXP(node.type, workoutData);
  const xpEarned = xpBreakdown.total;

  // Update streak
  const progressData = await getProgress(userId, path.id);
  const newStreak = calculateStreak(progressData);

  // Create updated path
  const updatedPath: Path = {
    ...path,
    nodes: updatedNodes,
    progress,
    totalXp: path.totalXp + xpEarned,
    activeNodeId: node.connections[0] ?? undefined,
    updatedAt: new Date().toISOString(),
  };

  // Persist updated path
  await savePath(updatedPath);

  // Update progress
  await saveProgress(userId, path.id, {
    userId,
    pathId: path.id,
    nodeProgress: Object.fromEntries(updatedNodes.map((n) => [n.id, n.status])),
    currentStreak: newStreak,
    longestStreak: Math.max(progressData?.longestStreak ?? 0, newStreak),
    xpEarned: (progressData?.xpEarned ?? 0) + xpEarned,
    lastActivityAt: new Date().toISOString(),
  });

  return { updatedPath, xpEarned, xpBreakdown, newStreak };
}

/**
 * Start a node (mark as in_progress)
 */
export function startNode(path: Path, nodeId: string): Path {
  const nodeIndex = path.nodes.findIndex((n) => n.id === nodeId);
  if (nodeIndex === -1) {
    throw new Error(`Node ${nodeId} not found in path ${path.id}`);
  }

  const node = path.nodes[nodeIndex];
  if (node.status !== 'available') {
    throw new Error(`Node ${nodeId} is not available to start`);
  }

  const updatedNodes = [...path.nodes];
  updatedNodes[nodeIndex] = {
    ...node,
    status: 'in_progress',
  };

  return {
    ...path,
    nodes: updatedNodes,
    activeNodeId: nodeId,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate current streak based on activity
 */
function calculateStreak(progress: UserPathProgress | null): number {
  if (!progress) return 1;

  const lastActivity = new Date(progress.lastActivityAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Same day, streak continues
    return progress.currentStreak;
  } else if (diffDays === 1) {
    // Next day, streak increases
    return progress.currentStreak + 1;
  } else {
    // Streak broken
    return 1;
  }
}

// ============================================
// PERSISTENCE
// ============================================

/**
 * Save a path to storage
 */
export async function savePath(path: Path): Promise<void> {
  try {
    const existingPaths = await getAllPaths();
    const pathIndex = existingPaths.findIndex((p) => p.id === path.id);

    if (pathIndex === -1) {
      existingPaths.push(path);
    } else {
      existingPaths[pathIndex] = path;
    }

    await AsyncStorage.setItem(PATHS_KEY, JSON.stringify(existingPaths));
  } catch (error) {
    console.error('[Pathfinder] Error saving path:', error);
    throw error;
  }
}

/**
 * Get all paths from storage
 */
export async function getAllPaths(): Promise<Path[]> {
  try {
    const data = await AsyncStorage.getItem(PATHS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[Pathfinder] Error loading paths:', error);
    return [];
  }
}

/**
 * Get a specific path by ID
 */
export async function getPath(pathId: string): Promise<Path | null> {
  const paths = await getAllPaths();
  return paths.find((p) => p.id === pathId) ?? null;
}

/**
 * Delete a path
 */
export async function deletePath(pathId: string): Promise<void> {
  const paths = await getAllPaths();
  const filtered = paths.filter((p) => p.id !== pathId);
  await AsyncStorage.setItem(PATHS_KEY, JSON.stringify(filtered));
}

/**
 * Save user progress for a path
 */
async function saveProgress(userId: string, pathId: string, progress: UserPathProgress): Promise<void> {
  await AsyncStorage.setItem(progressKey(userId, pathId), JSON.stringify(progress));
}

/**
 * Get user progress for a path
 */
export async function getProgress(userId: string, pathId: string): Promise<UserPathProgress | null> {
  try {
    const data = await AsyncStorage.getItem(progressKey(userId, pathId));
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[Pathfinder] Error loading progress:', error);
    return null;
  }
}

// ============================================
// UTILITIES
// ============================================

/**
 * Get the next available node in a path
 */
export function getNextAvailableNode(path: Path): PathNode | null {
  return path.nodes.find((n) => n.status === 'available') ?? null;
}

/**
 * Get all completed nodes in a path
 */
export function getCompletedNodes(path: Path): PathNode[] {
  return path.nodes.filter((n) => n.status === 'completed');
}

/**
 * Check if path is complete
 */
export function isPathComplete(path: Path): boolean {
  return path.nodes.every((n) => n.status === 'completed');
}

/**
 * Get path statistics
 */
export function getPathStats(path: Path): {
  totalNodes: number;
  completedNodes: number;
  progress: number;
  totalXp: number;
  remainingXp: number;
} {
  const completedNodes = path.nodes.filter((n) => n.status === 'completed').length;
  const remainingXp = path.nodes
    .filter((n) => n.status !== 'completed')
    .reduce((sum, n) => sum + (n.meta?.xpReward ?? XP_REWARDS[n.type]), 0);

  return {
    totalNodes: path.nodes.length,
    completedNodes,
    progress: path.progress,
    totalXp: path.totalXp,
    remainingXp,
  };
}
