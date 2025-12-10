import { supabase } from '../client';
import type {
  DbProgram,
  CreateProgramInput,
  UpdateProgramInput,
  ProgramWithDetails,
} from '../types';

// Get all programs for a user
export async function getUserPrograms(userId: string): Promise<DbProgram[]> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('userId', userId)
    .order('createdAt', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Get a single program by ID
export async function getProgramById(programId: string): Promise<DbProgram | null> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('id', programId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
  return data;
}

// Get program with all details (workouts, exercises)
export async function getProgramWithDetails(programId: string): Promise<ProgramWithDetails | null> {
  const { data, error } = await supabase
    .from('programs')
    .select(`
      *,
      user:users(*),
      workoutLogs:workout_logs(*)
    `)
    .eq('id', programId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// Create a new program
export async function createProgram(input: CreateProgramInput): Promise<DbProgram> {
  const { data, error } = await supabase
    .from('programs')
    .insert({
      userId: input.userId,
      name: input.name,
      description: input.description ?? null,
      sourceFileUri: input.sourceFileUri,
      sourceType: input.sourceType,
      status: input.status ?? 'PARSING',
      parsedData: input.parsedData ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update a program
export async function updateProgram(
  programId: string,
  input: UpdateProgramInput
): Promise<DbProgram> {
  const { data, error } = await supabase
    .from('programs')
    .update({
      ...input,
      updatedAt: new Date().toISOString(),
    })
    .eq('id', programId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete a program
export async function deleteProgram(programId: string): Promise<void> {
  const { error } = await supabase
    .from('programs')
    .delete()
    .eq('id', programId);

  if (error) throw error;
}

// Get programs by status
export async function getProgramsByStatus(
  userId: string,
  status: DbProgram['status']
): Promise<DbProgram[]> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('userId', userId)
    .eq('status', status)
    .order('createdAt', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Search programs by name
export async function searchPrograms(
  userId: string,
  query: string
): Promise<DbProgram[]> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('userId', userId)
    .ilike('name', `%${query}%`)
    .order('createdAt', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
