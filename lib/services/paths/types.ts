/**
 * Pathfinder Types
 *
 * Defines the data structures for the visual progress system.
 * Inspired by Brilliant.org's node-based learning paths.
 */

// ============================================
// NODE TYPES
// ============================================

export type NodeStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export type NodeType =
  | 'workout' // A single workout session
  | 'milestone' // Achievement milestone (e.g., first week complete)
  | 'checkpoint' // Weekly/monthly checkpoint
  | 'boss' // Challenge workout (PR attempt, AMRAP, etc.)
  | 'rest'; // Rest day node

export interface PathNode {
  id: string;
  type: NodeType;
  status: NodeStatus;
  /** Display title */
  title: string;
  /** Optional subtitle (e.g., "Week 1, Day 1") */
  subtitle?: string;
  /** Reference to workout/program data */
  referenceId?: string;
  /** Position in the path (0-indexed) */
  position: number;
  /** X position for rendering (0-1 normalized) */
  x: number;
  /** Y position for rendering (0-1 normalized, 0 = top) */
  y: number;
  /** Connections to other nodes (node IDs) */
  connections: string[];
  /** Completion date if completed */
  completedAt?: string;
  /** Progress within this node (0-1) */
  progress?: number;
  /** Metadata for rendering (icon, color, etc.) */
  meta?: {
    icon?: string;
    color?: string;
    isOptional?: boolean;
    xpReward?: number;
  };
}

// ============================================
// PATH TYPES
// ============================================

export type PathType =
  | 'program' // A full program path
  | 'weekly' // A week's worth of workouts
  | 'challenge'; // A special challenge path

export interface Path {
  id: string;
  type: PathType;
  /** Display name */
  name: string;
  /** Description */
  description?: string;
  /** All nodes in this path */
  nodes: PathNode[];
  /** Current active node ID */
  activeNodeId?: string;
  /** Overall progress (0-1) */
  progress: number;
  /** Total XP earned from this path */
  totalXp: number;
  /** Reference to program/challenge */
  referenceId?: string;
  /** Created timestamp */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
}

// ============================================
// USER PATH PROGRESS
// ============================================

export interface UserPathProgress {
  userId: string;
  pathId: string;
  /** Map of node ID -> completion status */
  nodeProgress: Record<string, NodeStatus>;
  /** Current streak (consecutive days) */
  currentStreak: number;
  /** Longest streak */
  longestStreak: number;
  /** Total XP earned */
  xpEarned: number;
  /** Last activity date */
  lastActivityAt: string;
}

// ============================================
// PATH GENERATION OPTIONS
// ============================================

export interface PathGenerationOptions {
  /** Program ID to generate path from */
  programId: string;
  /** User ID for personalization */
  userId: string;
  /** Include rest day nodes */
  includeRestDays?: boolean;
  /** Include milestone nodes (weekly, monthly) */
  includeMilestones?: boolean;
  /** Include checkpoint nodes at intervals */
  includeCheckpoints?: boolean;
  /** Layout style */
  layout?: 'linear' | 'branching' | 'spiral';
}

// ============================================
// PATH STATE (for context/hooks)
// ============================================

export interface PathState {
  /** Currently active path */
  activePath: Path | null;
  /** All user paths */
  paths: Path[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
}
