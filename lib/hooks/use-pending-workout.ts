/**
 * Pending Workout Hook
 *
 * Checks for and manages pending (unfinished) workout sessions.
 * Used by Resume Hero feature (P1 UX Redesign).
 *
 * TIGER 4 MITIGATION: Session recovery on app launch
 */

import { useCallback, useEffect, useState } from 'react';

import { isFeatureEnabled } from '@/lib/config/feature-flags';
import { useUserId } from '@/lib/context/auth-context';
import {
  clearActiveWorkoutState,
  clearPendingWorkoutEdits,
  getLatestActiveWorkoutState,
} from '@/lib/db/storage';

export interface PendingWorkout {
  id: string;
  programId: string;
  userId: string;
  name: string;
  startedAt: string;
  exerciseCount: number;
  completedSets: number;
  totalSets: number;
  status: 'in_progress' | 'paused';
}

interface UsePendingWorkoutResult {
  pendingWorkout: PendingWorkout | null;
  isLoading: boolean;
  discardPendingWorkout: () => Promise<void>;
  refreshPendingWorkout: () => Promise<void>;
}

export function usePendingWorkout(): UsePendingWorkoutResult {
  const [pendingWorkout, setPendingWorkout] = useState<PendingWorkout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userId = useUserId();

  const checkForPendingWorkout = useCallback(async () => {
    // Only check if Resume Hero feature is enabled
    if (!isFeatureEnabled('resume_hero')) {
      setPendingWorkout(null);
      setIsLoading(false);
      return;
    }

    try {
      const latest = await getLatestActiveWorkoutState(userId);
      if (!latest?.state?.session) {
        setPendingWorkout(null);
        return;
      }

      const session = latest.state.session;
      const sessionName = session.workoutName || (session as any).name || 'Workout';
      const exercises = session.exercises || [];
      let completedSets = 0;
      let totalSets = 0;

      for (const exercise of exercises) {
        const sets = exercise.sets || [];
        totalSets += sets.length;
        completedSets += sets.filter((s: any) => s.isCompleted ?? s.completed).length;
      }

      // Only show pending workouts that are in_progress or paused (not completed/cancelled)
      const status = session.status as string;
      if (status !== 'in_progress' && status !== 'paused') {
        setPendingWorkout(null);
        return;
      }

      setPendingWorkout({
        id: latest.programId,
        programId: latest.programId,
        userId,
        name: sessionName,
        startedAt: session.startTime || new Date().toISOString(),
        exerciseCount: exercises.length,
        completedSets,
        totalSets,
        status,
      });
      console.log('[PendingWorkout] Found pending session:', latest.programId);
    } catch (error) {
      console.error('[PendingWorkout] Error checking for pending workout:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const discardPendingWorkout = useCallback(async () => {
    if (!pendingWorkout) return;

    try {
      await clearActiveWorkoutState(pendingWorkout.userId, pendingWorkout.programId);
      await clearPendingWorkoutEdits(pendingWorkout.userId, pendingWorkout.programId);
      setPendingWorkout(null);
      console.log('[PendingWorkout] Discarded pending workout:', pendingWorkout.programId);
    } catch (error) {
      console.error('[PendingWorkout] Error discarding workout:', error);
    }
  }, [pendingWorkout]);

  const refreshPendingWorkout = useCallback(async () => {
    setIsLoading(true);
    await checkForPendingWorkout();
  }, [checkForPendingWorkout]);

  // Check on mount
  useEffect(() => {
    checkForPendingWorkout();
  }, [checkForPendingWorkout, userId]);

  return {
    pendingWorkout,
    isLoading,
    discardPendingWorkout,
    refreshPendingWorkout,
  };
}

/**
 * Format relative time for display
 * e.g., "2 hours ago", "Yesterday"
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString();
}

export function formatElapsedTime(dateString: string, nowMs: number = Date.now()): string {
  const start = new Date(dateString).getTime();
  const diffMs = Math.max(0, nowMs - start);
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
