import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUserWorkoutLogs,
  getWorkoutLogById,
  getProgramWorkoutLogs,
  createWorkoutLog,
  updateWorkoutLog,
  deleteWorkoutLog,
  getWorkoutStats,
  getExerciseHistory,
} from '../supabase/services/workout-logs';
import type { CreateWorkoutLogInput, DbWorkoutLog } from '../supabase/types';

// Query keys
export const workoutLogKeys = {
  all: ['workoutLogs'] as const,
  lists: () => [...workoutLogKeys.all, 'list'] as const,
  list: (userId: string) => [...workoutLogKeys.lists(), userId] as const,
  details: () => [...workoutLogKeys.all, 'detail'] as const,
  detail: (id: string) => [...workoutLogKeys.details(), id] as const,
  program: (programId: string) => [...workoutLogKeys.all, 'program', programId] as const,
  stats: (userId: string) => [...workoutLogKeys.all, 'stats', userId] as const,
  exerciseHistory: (userId: string, exerciseName: string) =>
    [...workoutLogKeys.all, 'history', userId, exerciseName] as const,
};

// Hook to fetch all workout logs for a user
export function useWorkoutLogs(userId: string | undefined, limit: number = 50) {
  return useQuery({
    queryKey: workoutLogKeys.list(userId ?? ''),
    queryFn: () => getUserWorkoutLogs(userId!, limit),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes - logs change frequently during workouts
  });
}

// Hook to fetch a single workout log
export function useWorkoutLog(logId: string | undefined) {
  return useQuery({
    queryKey: workoutLogKeys.detail(logId ?? ''),
    queryFn: () => getWorkoutLogById(logId!),
    enabled: !!logId,
    staleTime: 1000 * 60 * 5,
  });
}

// Hook to fetch workout logs for a specific program
export function useProgramWorkoutLogs(programId: string | undefined) {
  return useQuery({
    queryKey: workoutLogKeys.program(programId ?? ''),
    queryFn: () => getProgramWorkoutLogs(programId!),
    enabled: !!programId,
    staleTime: 1000 * 60 * 5,
  });
}

// Hook to fetch workout statistics
export function useWorkoutStats(userId: string | undefined) {
  return useQuery({
    queryKey: workoutLogKeys.stats(userId ?? ''),
    queryFn: () => getWorkoutStats(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook to fetch exercise history
export function useExerciseHistory(
  userId: string | undefined,
  exerciseName: string | undefined,
  limit: number = 20
) {
  return useQuery({
    queryKey: workoutLogKeys.exerciseHistory(userId ?? '', exerciseName ?? ''),
    queryFn: () => getExerciseHistory(userId!, exerciseName!, limit),
    enabled: !!userId && !!exerciseName,
    staleTime: 1000 * 60 * 5,
  });
}

// Hook to create a workout log
export function useCreateWorkoutLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateWorkoutLogInput) => createWorkoutLog(input),
    onSuccess: (newLog) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: workoutLogKeys.list(newLog.userId) });
      queryClient.invalidateQueries({ queryKey: workoutLogKeys.stats(newLog.userId) });
      if (newLog.programId) {
        queryClient.invalidateQueries({ queryKey: workoutLogKeys.program(newLog.programId) });
      }
    },
  });
}

// Hook to update a workout log
export function useUpdateWorkoutLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      logId,
      updates,
    }: {
      logId: string;
      updates: Partial<Omit<DbWorkoutLog, 'id' | 'userId' | 'completedAt'>>;
    }) => updateWorkoutLog(logId, updates),
    onSuccess: (updatedLog) => {
      // Update the log in cache
      queryClient.setQueryData(workoutLogKeys.detail(updatedLog.id), updatedLog);
      // Invalidate the list
      queryClient.invalidateQueries({ queryKey: workoutLogKeys.list(updatedLog.userId) });
    },
  });
}

// Hook to delete a workout log
export function useDeleteWorkoutLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (logId: string) => deleteWorkoutLog(logId),
    onSuccess: () => {
      // Invalidate all workout log queries
      queryClient.invalidateQueries({ queryKey: workoutLogKeys.all });
    },
  });
}
