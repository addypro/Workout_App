import { supabase } from '../client';
import type { DbExerciseDatabase } from '../types';

// In-memory cache for frequently accessed exercises
let exerciseCache: DbExerciseDatabase[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get all exercises from database
export async function getAllExercises(): Promise<DbExerciseDatabase[]> {
  // Return cached data if still valid
  if (exerciseCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return exerciseCache;
  }

  const { data, error } = await supabase
    .from('exercise_database')
    .select('*')
    .order('name');

  if (error) throw error;

  // Update cache
  exerciseCache = data ?? [];
  cacheTimestamp = Date.now();

  return exerciseCache;
}

// Get exercise by ID
export async function getExerciseById(id: string): Promise<DbExerciseDatabase | null> {
  const { data, error } = await supabase
    .from('exercise_database')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// Get exercise by name (exact match)
export async function getExerciseByName(name: string): Promise<DbExerciseDatabase | null> {
  const { data, error } = await supabase
    .from('exercise_database')
    .select('*')
    .eq('name', name)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// Search exercises by name or alias (uses PostgreSQL full-text search)
export async function searchExercises(
  query: string,
  limit: number = 10
): Promise<DbExerciseDatabase[]> {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase().trim();

  // Use PostgreSQL ILIKE for flexible matching
  const { data, error } = await supabase
    .from('exercise_database')
    .select('*')
    .or(`name.ilike.%${lowerQuery}%,aliases.cs.{${lowerQuery}}`)
    .limit(limit);

  if (error) throw error;

  // Score and sort results for relevance
  const scored = (data ?? []).map(ex => {
    const lowerName = ex.name.toLowerCase();
    let score = 0;

    if (lowerName === lowerQuery) {
      score = 100; // Exact match
    } else if (lowerName.startsWith(lowerQuery)) {
      score = 80; // Starts with query
    } else if (lowerName.includes(lowerQuery)) {
      score = 60; // Contains query
    } else if (ex.aliases?.some((a: string) => a.toLowerCase().includes(lowerQuery))) {
      score = 40; // Alias match
    }

    return { exercise: ex, score };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.exercise);
}

// Search exercises by category
export async function getExercisesByCategory(category: string): Promise<DbExerciseDatabase[]> {
  const { data, error } = await supabase
    .from('exercise_database')
    .select('*')
    .eq('category', category)
    .order('name');

  if (error) throw error;
  return data ?? [];
}

// Search exercises by equipment
export async function getExercisesByEquipment(equipment: string): Promise<DbExerciseDatabase[]> {
  const { data, error } = await supabase
    .from('exercise_database')
    .select('*')
    .contains('equipment', [equipment])
    .order('name');

  if (error) throw error;
  return data ?? [];
}

// Get all unique categories
export async function getCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('exercise_database')
    .select('category')
    .not('category', 'is', null);

  if (error) throw error;

  const categories = [...new Set((data ?? []).map(d => d.category).filter(Boolean))];
  return categories.sort() as string[];
}

// Get all unique equipment types
export async function getEquipmentTypes(): Promise<string[]> {
  const exercises = await getAllExercises();
  const equipmentSet = new Set<string>();

  exercises.forEach(ex => {
    if (Array.isArray(ex.equipment)) {
      ex.equipment.forEach(e => equipmentSet.add(e));
    }
  });

  return [...equipmentSet].sort();
}

// Clear the cache (call after importing new exercises)
export function clearExerciseCache(): void {
  exerciseCache = null;
  cacheTimestamp = 0;
}

// Bulk insert exercises (for seeding)
export async function bulkInsertExercises(
  exercises: Omit<DbExerciseDatabase, 'id' | 'createdAt'>[]
): Promise<number> {
  // Insert in batches of 100 to avoid timeout
  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
    const batch = exercises.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from('exercise_database')
      .upsert(batch, {
        onConflict: 'name',
        ignoreDuplicates: false
      });

    if (error) throw error;
    inserted += batch.length;
  }

  // Clear cache after bulk insert
  clearExerciseCache();

  return inserted;
}
