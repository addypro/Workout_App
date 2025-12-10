import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUserPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram,
  searchPrograms,
} from '../supabase/services/programs';
import type { CreateProgramInput, UpdateProgramInput, DbProgram } from '../supabase/types';

// Query keys
export const programKeys = {
  all: ['programs'] as const,
  lists: () => [...programKeys.all, 'list'] as const,
  list: (userId: string) => [...programKeys.lists(), userId] as const,
  details: () => [...programKeys.all, 'detail'] as const,
  detail: (id: string) => [...programKeys.details(), id] as const,
  search: (userId: string, query: string) => [...programKeys.list(userId), 'search', query] as const,
};

// Hook to fetch all programs for a user
export function usePrograms(userId: string | undefined) {
  return useQuery({
    queryKey: programKeys.list(userId ?? ''),
    queryFn: () => getUserPrograms(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook to fetch a single program
export function useProgram(programId: string | undefined) {
  return useQuery({
    queryKey: programKeys.detail(programId ?? ''),
    queryFn: () => getProgramById(programId!),
    enabled: !!programId,
    staleTime: 1000 * 60 * 5,
  });
}

// Hook to search programs
export function useSearchPrograms(userId: string | undefined, query: string) {
  return useQuery({
    queryKey: programKeys.search(userId ?? '', query),
    queryFn: () => searchPrograms(userId!, query),
    enabled: !!userId && query.length >= 2,
    staleTime: 1000 * 60 * 2, // 2 minutes for search results
  });
}

// Hook to create a program
export function useCreateProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProgramInput) => createProgram(input),
    onSuccess: (newProgram) => {
      // Invalidate and refetch programs list
      queryClient.invalidateQueries({ queryKey: programKeys.list(newProgram.userId) });
    },
  });
}

// Hook to update a program
export function useUpdateProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ programId, input }: { programId: string; input: UpdateProgramInput }) =>
      updateProgram(programId, input),
    onSuccess: (updatedProgram) => {
      // Update the program in cache
      queryClient.setQueryData(programKeys.detail(updatedProgram.id), updatedProgram);
      // Invalidate the list to reflect changes
      queryClient.invalidateQueries({ queryKey: programKeys.list(updatedProgram.userId) });
    },
  });
}

// Hook to delete a program
export function useDeleteProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (programId: string) => deleteProgram(programId),
    onMutate: async (programId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: programKeys.detail(programId) });

      // Snapshot the previous value
      const previousProgram = queryClient.getQueryData<DbProgram>(programKeys.detail(programId));

      // Optimistically remove from cache
      queryClient.removeQueries({ queryKey: programKeys.detail(programId) });

      return { previousProgram };
    },
    onError: (err, programId, context) => {
      // Rollback on error
      if (context?.previousProgram) {
        queryClient.setQueryData(programKeys.detail(programId), context.previousProgram);
      }
    },
    onSettled: () => {
      // Always refetch lists after mutation settles
      queryClient.invalidateQueries({ queryKey: programKeys.lists() });
    },
  });
}
