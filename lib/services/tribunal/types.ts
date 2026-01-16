/**
 * Tribunal Types
 *
 * Defines data structures for the peer-to-peer PR verification system.
 * Users vote on whether claimed PRs are legitimate.
 */

// ============================================
// PR RECORD TYPES
// ============================================

export type PRType =
  | 'weight' // New weight PR for an exercise
  | 'reps' // New rep PR at a given weight
  | 'volume' // New volume PR (sets × reps × weight)
  | 'duration'; // New duration PR (for timed exercises)

export type PRStatus =
  | 'pending' // Awaiting verification
  | 'verified' // Approved by tribunal
  | 'rejected' // Rejected by tribunal
  | 'expired'; // Timed out without enough votes

export interface PRRecord {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  /** Exercise name */
  exerciseName: string;
  /** Type of PR */
  prType: PRType;
  /** The new PR value */
  newValue: number;
  /** Previous best (if known) */
  previousValue?: number;
  /** Unit (lbs, kg, reps, seconds) */
  unit: string;
  /** Optional video proof URL */
  videoUrl?: string;
  /** Optional photo proof URL */
  photoUrl?: string;
  /** Workout ID where PR was achieved */
  workoutId?: string;
  /** Date the PR was achieved */
  achievedAt: string;
  /** Date submitted for verification */
  submittedAt: string;
  /** Current verification status */
  status: PRStatus;
  /** Votes received */
  votes: PRVote[];
  /** Threshold needed for verification */
  votesNeeded: number;
  /** Deadline for voting */
  expiresAt: string;
}

// ============================================
// VOTING TYPES
// ============================================

export type VoteDecision = 'approve' | 'reject' | 'skip';

export interface PRVote {
  id: string;
  prRecordId: string;
  jurorUserId: string;
  decision: VoteDecision;
  /** Optional reason for rejection */
  reason?: string;
  /** Confidence level (1-5) */
  confidence: number;
  /** Time spent reviewing (seconds) */
  reviewTimeSeconds: number;
  votedAt: string;
}

// ============================================
// JUROR TYPES
// ============================================

export interface JurorStats {
  userId: string;
  /** Total cases reviewed */
  totalReviews: number;
  /** Approvals given */
  approvals: number;
  /** Rejections given */
  rejections: number;
  /** Skips */
  skips: number;
  /** Accuracy rate (agreement with final outcome) */
  accuracyRate: number;
  /** Average review time */
  avgReviewTime: number;
  /** Juror reputation score */
  reputation: number;
  /** Last activity */
  lastActiveAt: string;
}

// ============================================
// QUEUE TYPES
// ============================================

export interface TribunalQueue {
  /** PRs pending review by this user */
  pendingReviews: PRRecord[];
  /** PRs this user has submitted for review */
  mySubmissions: PRRecord[];
  /** Total pending PRs in the system */
  totalPending: number;
}

// ============================================
// VERIFICATION THRESHOLDS
// ============================================

export interface VerificationThresholds {
  /** Minimum votes needed for standard PRs */
  standardMinVotes: number;
  /** Minimum votes for exceptional PRs (>50% improvement) */
  exceptionalMinVotes: number;
  /** Approval percentage needed to verify */
  approvalThreshold: number;
  /** Hours before PR expires without verification */
  expirationHours: number;
}

export const DEFAULT_THRESHOLDS: VerificationThresholds = {
  standardMinVotes: 3,
  exceptionalMinVotes: 5,
  approvalThreshold: 0.66, // 66% approval
  expirationHours: 72, // 3 days
};

// ============================================
// TRIBUNAL STATE
// ============================================

export interface TribunalState {
  queue: TribunalQueue | null;
  jurorStats: JurorStats | null;
  isLoading: boolean;
  error: string | null;
}
