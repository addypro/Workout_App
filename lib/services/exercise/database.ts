// Exercise Database Service
// Using JSON file for React Native compatibility

import exercisesData from '@/data/exercises.json';

export interface ExerciseDatabaseEntry {
  id: string;
  name: string;
  aliases: string[];
  category?: string;
  equipment: string[];
  videoUrl?: string;
}

// Cache for exercise database
let exerciseDatabaseCache: ExerciseDatabaseEntry[] | null = null;

export async function getExerciseDatabase(): Promise<ExerciseDatabaseEntry[]> {
  // Return cache if available
  if (exerciseDatabaseCache) {
    return exerciseDatabaseCache;
  }

  // Load from JSON file and add IDs
  const result: ExerciseDatabaseEntry[] = exercisesData.map((ex: any, index) => ({
    id: `ex-${index + 1}`,
    name: ex.name,
    aliases: ex.aliases || [],
    category: ex.category,
    equipment: ex.equipment || [],
    videoUrl: ex.videoUrl,
  }));

  // Update cache
  exerciseDatabaseCache = result;

  return result;
}

/**
 * Clear the exercise database cache (useful after updates)
 */
export function clearExerciseDatabaseCache(): void {
  exerciseDatabaseCache = null;
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
