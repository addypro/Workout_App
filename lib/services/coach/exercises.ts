/**
 * Coach Exercises Service
 *
 * Handles custom exercise creation and management for coaches.
 * Coaches can create sport-specific exercises with video demos.
 */

import { supabase } from '../../supabase/client';
import {
  CoachExercise,
  CreateExerciseInput,
  ServiceResult,
  PaginatedResult,
} from './types';

// ============================================
// EXERCISE MANAGEMENT
// ============================================

/**
 * Create a custom exercise
 */
export async function createExercise(
  input: CreateExerciseInput
): Promise<ServiceResult<CoachExercise>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const { data: coachProfile } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!coachProfile) {
      return { data: null, error: 'Coach profile not found', success: false };
    }

    const normalizedName = normalizeExerciseName(input.name);

    const { data, error } = await supabase
      .from('coach_exercises')
      .insert({
        coach_id: coachProfile.id,
        name: input.name,
        normalized_name: normalizedName,
        description: input.description,
        instructions: input.instructions,
        equipment: input.equipment || [],
        muscle_groups: input.muscleGroups || [],
        movement_pattern: input.movementPattern,
        difficulty: input.difficulty,
        video_url: input.videoUrl,
        sport_tags: input.sportTags || [],
        share_with_athletes: input.shareWithAthletes ?? true,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      data: mapToCoachExercise(data),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachExercises] createExercise error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to create exercise',
      success: false,
    };
  }
}

/**
 * Get all exercises for the current coach
 */
export async function getMyExercises(
  page: number = 1,
  pageSize: number = 50
): Promise<ServiceResult<PaginatedResult<CoachExercise>>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const { data: coachProfile } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!coachProfile) {
      return { data: null, error: 'Coach profile not found', success: false };
    }

    const offset = (page - 1) * pageSize;

    const { count } = await supabase
      .from('coach_exercises')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', coachProfile.id);

    const { data, error } = await supabase
      .from('coach_exercises')
      .select('*')
      .eq('coach_id', coachProfile.id)
      .order('name', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    return {
      data: {
        data: (data || []).map(mapToCoachExercise),
        total: count || 0,
        page,
        pageSize,
        hasMore: (count || 0) > offset + pageSize,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachExercises] getMyExercises error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get exercises',
      success: false,
    };
  }
}

/**
 * Search exercises by name
 */
export async function searchExercises(
  query: string,
  limit: number = 20
): Promise<ServiceResult<CoachExercise[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const { data: coachProfile } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!coachProfile) {
      return { data: null, error: 'Coach profile not found', success: false };
    }

    const normalizedQuery = normalizeExerciseName(query);

    const { data, error } = await supabase
      .from('coach_exercises')
      .select('*')
      .eq('coach_id', coachProfile.id)
      .ilike('normalized_name', `%${normalizedQuery}%`)
      .limit(limit);

    if (error) throw error;

    return {
      data: (data || []).map(mapToCoachExercise),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachExercises] searchExercises error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to search exercises',
      success: false,
    };
  }
}

/**
 * Get exercises by sport tag
 */
export async function getExercisesBySport(
  sport: string
): Promise<ServiceResult<CoachExercise[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const { data: coachProfile } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!coachProfile) {
      return { data: null, error: 'Coach profile not found', success: false };
    }

    const { data, error } = await supabase
      .from('coach_exercises')
      .select('*')
      .eq('coach_id', coachProfile.id)
      .contains('sport_tags', [sport.toLowerCase()]);

    if (error) throw error;

    return {
      data: (data || []).map(mapToCoachExercise),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachExercises] getExercisesBySport error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get exercises',
      success: false,
    };
  }
}

/**
 * Get exercises by muscle group
 */
export async function getExercisesByMuscleGroup(
  muscleGroup: string
): Promise<ServiceResult<CoachExercise[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const { data: coachProfile } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!coachProfile) {
      return { data: null, error: 'Coach profile not found', success: false };
    }

    const { data, error } = await supabase
      .from('coach_exercises')
      .select('*')
      .eq('coach_id', coachProfile.id)
      .contains('muscle_groups', [muscleGroup.toLowerCase()]);

    if (error) throw error;

    return {
      data: (data || []).map(mapToCoachExercise),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachExercises] getExercisesByMuscleGroup error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get exercises',
      success: false,
    };
  }
}

/**
 * Get a single exercise
 */
export async function getExercise(exerciseId: string): Promise<ServiceResult<CoachExercise>> {
  try {
    const { data, error } = await supabase
      .from('coach_exercises')
      .select('*')
      .eq('id', exerciseId)
      .single();

    if (error) throw error;

    return {
      data: mapToCoachExercise(data),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachExercises] getExercise error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get exercise',
      success: false,
    };
  }
}

/**
 * Update an exercise
 */
export async function updateExercise(
  exerciseId: string,
  input: Partial<CreateExerciseInput>
): Promise<ServiceResult<CoachExercise>> {
  try {
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) {
      updateData.name = input.name;
      updateData.normalized_name = normalizeExerciseName(input.name);
    }
    if (input.description !== undefined) updateData.description = input.description;
    if (input.instructions !== undefined) updateData.instructions = input.instructions;
    if (input.equipment !== undefined) updateData.equipment = input.equipment;
    if (input.muscleGroups !== undefined) updateData.muscle_groups = input.muscleGroups;
    if (input.movementPattern !== undefined) updateData.movement_pattern = input.movementPattern;
    if (input.difficulty !== undefined) updateData.difficulty = input.difficulty;
    if (input.videoUrl !== undefined) updateData.video_url = input.videoUrl;
    if (input.sportTags !== undefined) updateData.sport_tags = input.sportTags;
    if (input.shareWithAthletes !== undefined) updateData.share_with_athletes = input.shareWithAthletes;

    const { data, error } = await supabase
      .from('coach_exercises')
      .update(updateData)
      .eq('id', exerciseId)
      .select()
      .single();

    if (error) throw error;

    return {
      data: mapToCoachExercise(data),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachExercises] updateExercise error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to update exercise',
      success: false,
    };
  }
}

/**
 * Delete an exercise
 */
export async function deleteExercise(exerciseId: string): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('coach_exercises')
      .delete()
      .eq('id', exerciseId);

    if (error) throw error;

    return { data: undefined, error: null, success: true };
  } catch (error) {
    console.error('[CoachExercises] deleteExercise error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to delete exercise',
      success: false,
    };
  }
}

/**
 * Increment exercise usage count
 */
export async function incrementUsageCount(exerciseId: string): Promise<void> {
  try {
    await supabase.rpc('increment_coach_exercise_usage', { exercise_id: exerciseId });
  } catch (error) {
    console.error('[CoachExercises] incrementUsageCount error:', error);
  }
}

// ============================================
// ATHLETE ACCESS
// ============================================

/**
 * Get exercises shared by an athlete's coach
 * (For athlete view of coach's exercise library)
 */
export async function getCoachSharedExercises(
  coachId: string
): Promise<ServiceResult<CoachExercise[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    // Verify athlete has access to this coach
    const { data: relationship } = await supabase
      .from('coach_athletes')
      .select('id')
      .eq('coach_id', coachId)
      .eq('athlete_user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!relationship) {
      return { data: null, error: 'Not connected to this coach', success: false };
    }

    const { data, error } = await supabase
      .from('coach_exercises')
      .select('*')
      .eq('coach_id', coachId)
      .eq('share_with_athletes', true)
      .order('name', { ascending: true });

    if (error) throw error;

    return {
      data: (data || []).map(mapToCoachExercise),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachExercises] getCoachSharedExercises error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get exercises',
      success: false,
    };
  }
}

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Import exercises from a list
 */
export async function bulkImportExercises(
  exercises: CreateExerciseInput[]
): Promise<ServiceResult<{ imported: number; failed: number }>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const { data: coachProfile } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!coachProfile) {
      return { data: null, error: 'Coach profile not found', success: false };
    }

    let imported = 0;
    let failed = 0;

    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < exercises.length; i += batchSize) {
      const batch = exercises.slice(i, i + batchSize);
      const records = batch.map((ex) => ({
        coach_id: coachProfile.id,
        name: ex.name,
        normalized_name: normalizeExerciseName(ex.name),
        description: ex.description,
        instructions: ex.instructions,
        equipment: ex.equipment || [],
        muscle_groups: ex.muscleGroups || [],
        movement_pattern: ex.movementPattern,
        difficulty: ex.difficulty,
        video_url: ex.videoUrl,
        sport_tags: ex.sportTags || [],
        share_with_athletes: ex.shareWithAthletes ?? true,
      }));

      const { data, error } = await supabase
        .from('coach_exercises')
        .upsert(records, { onConflict: 'coach_id,normalized_name' })
        .select();

      if (error) {
        failed += batch.length;
        console.error('[CoachExercises] Batch import error:', error);
      } else {
        imported += (data || []).length;
        failed += batch.length - (data || []).length;
      }
    }

    return {
      data: { imported, failed },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachExercises] bulkImportExercises error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to import exercises',
      success: false,
    };
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Normalize exercise name for consistent matching
 */
function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_');    // Replace spaces with underscores
}

function mapToCoachExercise(data: Record<string, unknown>): CoachExercise {
  return {
    id: data.id as string,
    coachId: data.coach_id as string,
    name: data.name as string,
    normalizedName: data.normalized_name as string,
    description: data.description as string | undefined,
    instructions: data.instructions as string | undefined,
    equipment: (data.equipment as string[]) || [],
    muscleGroups: (data.muscle_groups as string[]) || [],
    movementPattern: data.movement_pattern as string | undefined,
    difficulty: data.difficulty as CoachExercise['difficulty'],
    videoUrl: data.video_url as string | undefined,
    thumbnailUrl: data.thumbnail_url as string | undefined,
    demoImages: (data.demo_images as string[]) || [],
    sportTags: (data.sport_tags as string[]) || [],
    shareWithAthletes: data.share_with_athletes as boolean,
    usageCount: data.usage_count as number,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}

// ============================================
// SPORT PRESETS
// ============================================

/**
 * Common sport tags for categorization
 */
export const SPORT_TAGS = [
  'basketball',
  'football',
  'soccer',
  'baseball',
  'volleyball',
  'tennis',
  'golf',
  'swimming',
  'track_field',
  'crossfit',
  'powerlifting',
  'olympic_weightlifting',
  'bodybuilding',
  'mma',
  'boxing',
  'wrestling',
  'hockey',
  'lacrosse',
  'rugby',
  'gymnastics',
] as const;

/**
 * Common movement patterns
 */
export const MOVEMENT_PATTERNS = [
  'squat',
  'hinge',
  'push',
  'pull',
  'lunge',
  'carry',
  'rotation',
  'anti_rotation',
  'plyo',
  'sprint',
  'agility',
  'mobility',
] as const;
