// Exercise Database Service
// Adapted for Expo/React Native

import { prisma } from '@/lib/db/client';

export interface ExerciseDatabaseEntry {
  id: string;
  name: string;
  aliases: string[];
  category?: string;
  equipment: string[];
  videoUrl?: string;
}

// Cache for exercise database to avoid repeated DB queries
let exerciseDatabaseCache: ExerciseDatabaseEntry[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getExerciseDatabase(): Promise<ExerciseDatabaseEntry[]> {
  // Check cache first
  const now = Date.now();
  if (exerciseDatabaseCache && (now - cacheTimestamp) < CACHE_TTL) {
    return exerciseDatabaseCache;
  }

  try {
    // Try to load from database first
    const dbExercises = await prisma.exerciseDatabase.findMany();

    const result: ExerciseDatabaseEntry[] = dbExercises.map(ex => ({
      id: ex.id,
      name: ex.name,
      aliases: JSON.parse(ex.aliases),
      category: ex.category || undefined,
      equipment: JSON.parse(ex.equipment),
      videoUrl: ex.videoUrl || undefined,
    }));

    // Update cache
    exerciseDatabaseCache = result;
    cacheTimestamp = now;

    return result;
  } catch (error) {
    console.error('Error loading exercise database:', error);
    // Return empty array if database is not available
    return [];
  }
}

/**
 * Clear the exercise database cache (useful after updates)
 */
export function clearExerciseDatabaseCache(): void {
  exerciseDatabaseCache = null;
  cacheTimestamp = 0;
}

export async function searchExercises(query: string): Promise<ExerciseDatabaseEntry[]> {
  const database = await getExerciseDatabase();
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) {
    return database.slice(0, 20); // Return first 20 if no query
  }

  // Score exercises based on match quality
  const scored = database.map(ex => {
    let score = 0;
    const lowerName = ex.name.toLowerCase();

    // Exact match gets highest score
    if (lowerName === lowerQuery) {
      score = 100;
    } else if (lowerName.startsWith(lowerQuery)) {
      score = 80;
    } else if (lowerName.includes(lowerQuery)) {
      score = 60;
    } else if (ex.aliases.some(a => a.toLowerCase().includes(lowerQuery))) {
      score = 40;
    }

    return { exercise: ex, score };
  });

  // Filter and sort by score
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(item => item.exercise);
}

export async function getExerciseById(id: string): Promise<ExerciseDatabaseEntry | null> {
  const database = await getExerciseDatabase();
  return database.find(ex => ex.id === id) || null;
}
