/**
 * Tribunal Engine
 *
 * Core logic for PR verification:
 * - Detecting PRs from workout data
 * - Submitting PRs for verification
 * - Processing votes and determining outcomes
 * - Managing juror reputation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { WorkoutSession, WorkoutSet } from '@/lib/types/workout-session';

import type {
  PRRecord,
  PRStatus,
  PRType,
  PRVote,
  TribunalQueue,
  VerificationThresholds,
  VoteDecision
} from './types';

// ============================================
// STORAGE KEYS
// ============================================

const PR_HISTORY_KEY = '@tribunal:pr_history';
const PENDING_PRS_KEY = '@tribunal:pending';
const JUROR_STATS_KEY = '@tribunal:juror_stats';

// ============================================
// PR DETECTION
// ============================================

interface ExercisePR {
  exerciseName: string;
  prType: PRType;
  newValue: number;
  previousValue?: number;
  unit: string;
  setDetails: {
    weight?: number;
    reps?: number;
    rpe?: number;
  };
}

/**
 * Detect PRs from a completed workout by comparing to historical bests
 */
export async function detectPRsFromWorkout(
  workout: WorkoutSession,
  userId: string
): Promise<ExercisePR[]> {
  const detectedPRs: ExercisePR[] = [];
  const history = await getPRHistory(userId);

  for (const exercise of workout.exercises) {
    const completedSets = exercise.sets.filter((set) => set.isCompleted);
    if (completedSets.length === 0) continue;

    const exerciseKey = normalizeExerciseName(exercise.name);
    const previousBests = history[exerciseKey];

    // Check for weight PR (heaviest weight with at least 1 rep)
    const maxWeightSet = completedSets.reduce((max, set) => {
      const weight = set.weight ?? 0;
      return weight > (max?.weight ?? 0) ? set : max;
    }, null as WorkoutSet | null);

    if (maxWeightSet && maxWeightSet.weight) {
      const prevBestWeight = previousBests?.maxWeight ?? 0;
      if (maxWeightSet.weight > prevBestWeight) {
        detectedPRs.push({
          exerciseName: exercise.name,
          prType: 'weight',
          newValue: maxWeightSet.weight,
          previousValue: prevBestWeight > 0 ? prevBestWeight : undefined,
          unit: 'lbs', // TODO: Get from user preferences
          setDetails: {
            weight: maxWeightSet.weight,
            reps: parseReps(maxWeightSet.reps),
            rpe: maxWeightSet.rpe,
          },
        });
      }
    }

    // Check for rep PR at given weight (most reps at a standard weight)
    const maxRepsSet = completedSets.reduce((max, set) => {
      const reps = parseReps(set.reps);
      const maxReps = max ? parseReps(max.reps) : 0;
      return reps > maxReps ? set : max;
    }, null as WorkoutSet | null);

    if (maxRepsSet) {
      const reps = parseReps(maxRepsSet.reps);
      const weight = maxRepsSet.weight ?? 0;
      const prevBestReps = previousBests?.maxRepsAtWeight?.[weight] ?? 0;

      if (reps > prevBestReps && weight > 0) {
        detectedPRs.push({
          exerciseName: exercise.name,
          prType: 'reps',
          newValue: reps,
          previousValue: prevBestReps > 0 ? prevBestReps : undefined,
          unit: `reps @ ${weight}lbs`,
          setDetails: {
            weight,
            reps,
            rpe: maxRepsSet.rpe,
          },
        });
      }
    }

    // Check for volume PR (total volume in this exercise)
    const totalVolume = completedSets.reduce((sum, set) => {
      return sum + (set.weight ?? 0) * parseReps(set.reps);
    }, 0);

    const prevBestVolume = previousBests?.maxVolume ?? 0;
    if (totalVolume > prevBestVolume && totalVolume > 0) {
      detectedPRs.push({
        exerciseName: exercise.name,
        prType: 'volume',
        newValue: totalVolume,
        previousValue: prevBestVolume > 0 ? prevBestVolume : undefined,
        unit: 'lbs total',
        setDetails: {},
      });
    }
  }

  return detectedPRs;
}

/**
 * Normalize exercise name for consistent comparison
 */
function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Parse reps value (can be "8-10", "10", or number)
 * Returns the max value for ranges, or the number
 */
function parseReps(reps: number | string | undefined): number {
  if (reps === undefined) return 0;
  if (typeof reps === 'number') return reps;

  // Handle range like "8-10" - take the max
  if (reps.includes('-')) {
    const parts = reps.split('-').map(Number);
    return Math.max(...parts.filter(n => !isNaN(n)));
  }

  const parsed = parseInt(reps, 10);
  return isNaN(parsed) ? 0 : parsed;
}

// ============================================
// PR HISTORY MANAGEMENT
// ============================================

interface PRHistoryEntry {
  maxWeight?: number;
  maxRepsAtWeight?: Record<number, number>;
  maxVolume?: number;
  maxDuration?: number;
  lastUpdated: string;
}

type PRHistory = Record<string, PRHistoryEntry>;

export async function getPRHistory(userId: string): Promise<PRHistory> {
  try {
    const key = `${PR_HISTORY_KEY}:${userId}`;
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('[Tribunal] Error loading PR history:', error);
    return {};
  }
}

async function updatePRHistory(userId: string, pr: ExercisePR): Promise<void> {
  try {
    const key = `${PR_HISTORY_KEY}:${userId}`;
    const history = await getPRHistory(userId);
    const exerciseKey = normalizeExerciseName(pr.exerciseName);

    const entry = history[exerciseKey] ?? {
      lastUpdated: new Date().toISOString(),
    };

    switch (pr.prType) {
      case 'weight':
        entry.maxWeight = Math.max(entry.maxWeight ?? 0, pr.newValue);
        break;
      case 'reps':
        entry.maxRepsAtWeight = entry.maxRepsAtWeight ?? {};
        const weight = pr.setDetails.weight ?? 0;
        entry.maxRepsAtWeight[weight] = Math.max(
          entry.maxRepsAtWeight[weight] ?? 0,
          pr.newValue
        );
        break;
      case 'volume':
        entry.maxVolume = Math.max(entry.maxVolume ?? 0, pr.newValue);
        break;
      case 'duration':
        entry.maxDuration = Math.max(entry.maxDuration ?? 0, pr.newValue);
        break;
    }

    entry.lastUpdated = new Date().toISOString();
    history[exerciseKey] = entry;

    await AsyncStorage.setItem(key, JSON.stringify(history));
  } catch (error) {
    console.error('[Tribunal] Error updating PR history:', error);
  }
}

// ============================================
// PR SUBMISSION
// ============================================

/**
 * Submit a PR for tribunal verification
 */
export async function submitPRForVerification(
  pr: ExercisePR,
  userId: string,
  username: string,
  workoutId?: string,
  videoUrl?: string,
  photoUrl?: string,
  thresholds: VerificationThresholds = {
    standardMinVotes: 3,
    exceptionalMinVotes: 5,
    approvalThreshold: 0.66,
    expirationHours: 72,
  }
): Promise<PRRecord> {
  // Determine if this is an exceptional PR (>50% improvement)
  const improvementPercent = pr.previousValue
    ? ((pr.newValue - pr.previousValue) / pr.previousValue) * 100
    : 100;

  const isExceptional = improvementPercent > 50;
  const votesNeeded = isExceptional
    ? thresholds.exceptionalMinVotes
    : thresholds.standardMinVotes;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + thresholds.expirationHours);

  const record: PRRecord = {
    id: `pr-${userId}-${Date.now()}`,
    userId,
    username,
    exerciseName: pr.exerciseName,
    prType: pr.prType,
    newValue: pr.newValue,
    previousValue: pr.previousValue,
    unit: pr.unit,
    videoUrl,
    photoUrl,
    workoutId,
    achievedAt: new Date().toISOString(),
    submittedAt: new Date().toISOString(),
    status: 'pending',
    votes: [],
    votesNeeded,
    expiresAt: expiresAt.toISOString(),
  };

  // Save to pending queue
  await savePendingPR(record);

  return record;
}

async function savePendingPR(record: PRRecord): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(PENDING_PRS_KEY);
    const pending: PRRecord[] = data ? JSON.parse(data) : [];
    pending.push(record);
    await AsyncStorage.setItem(PENDING_PRS_KEY, JSON.stringify(pending));
  } catch (error) {
    console.error('[Tribunal] Error saving pending PR:', error);
  }
}

// ============================================
// VOTING
// ============================================

/**
 * Submit a vote on a PR
 */
export async function submitVote(
  prRecordId: string,
  jurorUserId: string,
  decision: VoteDecision,
  confidence: number,
  reviewTimeSeconds: number,
  reason?: string,
  thresholds: VerificationThresholds = {
    standardMinVotes: 3,
    exceptionalMinVotes: 5,
    approvalThreshold: 0.66,
    expirationHours: 72,
  }
): Promise<{ vote: PRVote; updatedRecord: PRRecord }> {
  const vote: PRVote = {
    id: `vote-${jurorUserId}-${Date.now()}`,
    prRecordId,
    jurorUserId,
    decision,
    reason,
    confidence,
    reviewTimeSeconds,
    votedAt: new Date().toISOString(),
  };

  // Get and update the PR record
  const pending = await getPendingPRs();
  const recordIndex = pending.findIndex((p) => p.id === prRecordId);

  if (recordIndex === -1) {
    throw new Error(`PR record ${prRecordId} not found`);
  }

  const record = pending[recordIndex];

  // Check if user already voted
  if (record.votes.some((v) => v.jurorUserId === jurorUserId)) {
    throw new Error('User has already voted on this PR');
  }

  // Add vote
  record.votes.push(vote);

  // Check if we have enough votes to determine outcome
  const nonSkipVotes = record.votes.filter((v) => v.decision !== 'skip');
  if (nonSkipVotes.length >= record.votesNeeded) {
    const approvals = nonSkipVotes.filter((v) => v.decision === 'approve').length;
    const approvalRate = approvals / nonSkipVotes.length;

    if (approvalRate >= thresholds.approvalThreshold) {
      record.status = 'verified';
      // Update user's PR history
      await updatePRHistory(record.userId, {
        exerciseName: record.exerciseName,
        prType: record.prType,
        newValue: record.newValue,
        previousValue: record.previousValue,
        unit: record.unit,
        setDetails: {},
      });
    } else {
      record.status = 'rejected';
    }
  }

  // Save updated record
  pending[recordIndex] = record;
  await AsyncStorage.setItem(PENDING_PRS_KEY, JSON.stringify(pending));

  return { vote, updatedRecord: record };
}

// ============================================
// QUEUE MANAGEMENT
// ============================================

/**
 * Get all pending PRs
 */
export async function getPendingPRs(): Promise<PRRecord[]> {
  try {
    const data = await AsyncStorage.getItem(PENDING_PRS_KEY);
    const pending: PRRecord[] = data ? JSON.parse(data) : [];

    // Filter out expired PRs
    const now = new Date();
    const active = pending.filter((pr) => {
      if (pr.status !== 'pending') return false;
      const expires = new Date(pr.expiresAt);
      if (expires < now) {
        // Mark as expired (side effect, could be moved to separate function)
        pr.status = 'expired';
        return false;
      }
      return true;
    });

    return active;
  } catch (error) {
    console.error('[Tribunal] Error loading pending PRs:', error);
    return [];
  }
}

/**
 * Get tribunal queue for a user (PRs they can vote on)
 */
export async function getTribunalQueue(userId: string): Promise<TribunalQueue> {
  const allPending = await getPendingPRs();

  // Filter PRs this user can vote on (not their own, not already voted)
  const pendingReviews = allPending.filter(
    (pr) =>
      pr.userId !== userId && !pr.votes.some((v) => v.jurorUserId === userId)
  );

  // Get user's own submissions
  const mySubmissions = allPending.filter((pr) => pr.userId === userId);

  return {
    pendingReviews,
    mySubmissions,
    totalPending: allPending.length,
  };
}

// ============================================
// UTILITIES
// ============================================

/**
 * Get a formatted display string for a PR
 */
export function formatPRDisplay(pr: PRRecord): string {
  const improvement = pr.previousValue
    ? ` (+${Math.round(((pr.newValue - pr.previousValue) / pr.previousValue) * 100)}%)`
    : '';

  switch (pr.prType) {
    case 'weight':
      return `${pr.newValue} ${pr.unit}${improvement}`;
    case 'reps':
      return `${pr.newValue} ${pr.unit}${improvement}`;
    case 'volume':
      return `${pr.newValue} ${pr.unit}${improvement}`;
    case 'duration':
      return `${Math.floor(pr.newValue / 60)}:${(pr.newValue % 60).toString().padStart(2, '0')}${improvement}`;
    default:
      return `${pr.newValue} ${pr.unit}`;
  }
}

/**
 * Get status display info
 */
export function getStatusInfo(status: PRStatus): {
  label: string;
  color: string;
  icon: string;
} {
  switch (status) {
    case 'pending':
      return { label: 'Awaiting Votes', color: '#FF9500', icon: 'clock' };
    case 'verified':
      return { label: 'Verified', color: '#34C759', icon: 'checkmark.seal.fill' };
    case 'rejected':
      return { label: 'Rejected', color: '#FF3B30', icon: 'xmark.circle.fill' };
    case 'expired':
      return { label: 'Expired', color: '#8E8E93', icon: 'clock.badge.xmark' };
  }
}
