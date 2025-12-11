import programsData from '@/data/workout-programs.json';

export interface KaggleProgram {
  id: string;
  name: string;
  type: string;
  duration: number; // weeks
  difficulty: string;
  muscleGroups: string[];
  equipment: string[];
  description: string;
  workouts: KaggleWorkout[];
  source: string;
}

export interface KaggleWorkout {
  week: number;
  day: number;
  name: string;
  exercises: KaggleExercise[];
}

export interface KaggleExercise {
  name: string;
  sets: number;
  reps: string;
  weight: string | null;
  restTime: number;
}

export interface ProgramFilters {
  type?: string;
  difficulty?: string;
  duration?: string;
  search?: string;
}

// Load all programs
export function getAllPrograms(): KaggleProgram[] {
  return programsData.programs as KaggleProgram[];
}

// Get program by ID
export function getProgramById(id: string): KaggleProgram | undefined {
  return programsData.programs.find((p: any) => p.id === id) as KaggleProgram | undefined;
}

// Filter programs
export function filterPrograms(filters: ProgramFilters): KaggleProgram[] {
  let programs = getAllPrograms();

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    programs = programs.filter(p =>
      p.name.toLowerCase().includes(searchLower) ||
      p.description.toLowerCase().includes(searchLower) ||
      p.muscleGroups.some(mg => mg.toLowerCase().includes(searchLower))
    );
  }

  if (filters.type && filters.type !== 'ALL') {
    programs = programs.filter(p => p.type === filters.type);
  }

  if (filters.difficulty && filters.difficulty !== 'ALL') {
    programs = programs.filter(p => p.difficulty === filters.difficulty);
  }

  if (filters.duration && filters.duration !== 'ALL') {
    programs = programs.filter(p => {
      switch (filters.duration) {
        case 'SHORT': // 1-4 weeks
          return p.duration <= 4;
        case 'MEDIUM': // 5-8 weeks
          return p.duration >= 5 && p.duration <= 8;
        case 'LONG': // 9-12 weeks
          return p.duration >= 9 && p.duration <= 12;
        case 'EXTENDED': // 12+ weeks
          return p.duration > 12;
        default:
          return true;
      }
    });
  }

  return programs;
}

// Get unique values for filters
export function getProgramTypes(): string[] {
  const types = new Set(programsData.programs.map((p: any) => p.type));
  return Array.from(types).sort();
}

export function getProgramDifficulties(): string[] {
  const difficulties = new Set(programsData.programs.map((p: any) => p.difficulty));
  return Array.from(difficulties).sort();
}

// Get statistics
export function getProgramStats() {
  const programs = getAllPrograms();
  const totalPrograms = programs.length;
  const totalWorkouts = programs.reduce((sum, p) => sum + p.workouts.length, 0);

  const byType: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};

  programs.forEach(p => {
    byType[p.type] = (byType[p.type] || 0) + 1;
    byDifficulty[p.difficulty] = (byDifficulty[p.difficulty] || 0) + 1;
  });

  return {
    totalPrograms,
    totalWorkouts,
    byType,
    byDifficulty,
    metadata: programsData.metadata,
  };
}
