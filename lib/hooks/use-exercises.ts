import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import {
  getAllExercises,
  searchExercises,
  getExerciseById,
  getExercisesByCategory,
  getCategories,
  getEquipmentTypes,
} from '../supabase/services/exercises';

// Query keys
export const exerciseKeys = {
  all: ['exercises'] as const,
  lists: () => [...exerciseKeys.all, 'list'] as const,
  list: () => [...exerciseKeys.lists(), 'all'] as const,
  details: () => [...exerciseKeys.all, 'detail'] as const,
  detail: (id: string) => [...exerciseKeys.details(), id] as const,
  search: (query: string) => [...exerciseKeys.all, 'search', query] as const,
  category: (category: string) => [...exerciseKeys.all, 'category', category] as const,
  categories: () => [...exerciseKeys.all, 'categories'] as const,
  equipment: () => [...exerciseKeys.all, 'equipment'] as const,
};

// Hook to fetch all exercises (with aggressive caching)
export function useExercises() {
  return useQuery({
    queryKey: exerciseKeys.list(),
    queryFn: getAllExercises,
    staleTime: 1000 * 60 * 30, // 30 minutes - exercises rarely change
    gcTime: 1000 * 60 * 60, // 1 hour garbage collection
  });
}

// Hook to fetch a single exercise
export function useExercise(exerciseId: string | undefined) {
  return useQuery({
    queryKey: exerciseKeys.detail(exerciseId ?? ''),
    queryFn: () => getExerciseById(exerciseId!),
    enabled: !!exerciseId,
    staleTime: 1000 * 60 * 30,
  });
}

// Hook to search exercises with debouncing
export function useSearchExercises(query: string, debounceMs: number = 300) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  return useQuery({
    queryKey: exerciseKeys.search(debouncedQuery),
    queryFn: () => searchExercises(debouncedQuery, 20),
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60 * 5, // 5 minutes for search results
    placeholderData: (previousData) => previousData, // Keep showing old results while loading
  });
}

// Hook to get exercises by category
export function useExercisesByCategory(category: string | undefined) {
  return useQuery({
    queryKey: exerciseKeys.category(category ?? ''),
    queryFn: () => getExercisesByCategory(category!),
    enabled: !!category,
    staleTime: 1000 * 60 * 30,
  });
}

// Hook to get all categories
export function useExerciseCategories() {
  return useQuery({
    queryKey: exerciseKeys.categories(),
    queryFn: getCategories,
    staleTime: 1000 * 60 * 60, // 1 hour - categories rarely change
  });
}

// Hook to get all equipment types
export function useEquipmentTypes() {
  return useQuery({
    queryKey: exerciseKeys.equipment(),
    queryFn: getEquipmentTypes,
    staleTime: 1000 * 60 * 60,
  });
}

// Hook for local filtering (when you have all exercises cached)
export function useFilteredExercises(filters: {
  query?: string;
  category?: string;
  equipment?: string;
}) {
  const { data: allExercises, isLoading } = useExercises();

  const filteredExercises = useMemo(() => {
    if (!allExercises) return [];

    let result = [...allExercises];

    // Filter by search query
    if (filters.query && filters.query.length >= 2) {
      const lowerQuery = filters.query.toLowerCase();
      result = result.filter(
        ex =>
          ex.name.toLowerCase().includes(lowerQuery) ||
          ex.aliases?.some((a: string) => a.toLowerCase().includes(lowerQuery))
      );
    }

    // Filter by category
    if (filters.category) {
      result = result.filter(ex => ex.category === filters.category);
    }

    // Filter by equipment
    if (filters.equipment) {
      result = result.filter(ex => ex.equipment?.includes(filters.equipment));
    }

    return result;
  }, [allExercises, filters.query, filters.category, filters.equipment]);

  return {
    data: filteredExercises,
    isLoading,
  };
}
