/**
 * Class Templates Service
 *
 * CRUD operations for workout class templates.
 * Templates are reusable workout blueprints that can be scheduled as sessions.
 */

import { supabase } from '../../supabase/client';
import type {
    ClassExercise,
    ClassTemplate,
    CreateClassTemplateInput,
    PaginatedResult,
    ServiceResult,
} from './types';

// ============================================
// CREATE
// ============================================

/**
 * Create a new class template
 */
export async function createClassTemplate(
    input: CreateClassTemplateInput
): Promise<ServiceResult<ClassTemplate>> {
    try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user?.id) {
            return { data: null, error: 'Not authenticated' };
        }

        // Get coach profile
        const { data: coach, error: coachError } = await supabase
            .from('coach_profiles')
            .select('id')
            .eq('user_id', user.user.id)
            .single();

        if (coachError || !coach) {
            return { data: null, error: 'Coach profile not found' };
        }

        const { data, error } = await supabase
            .from('class_templates')
            .insert({
                coach_id: coach.id,
                name: input.name,
                description: input.description,
                exercises_json: input.exercisesJson,
                estimated_duration_minutes: input.estimatedDurationMinutes ?? 60,
                default_capacity: input.defaultCapacity ?? 20,
                tags: input.tags ?? [],
            })
            .select()
            .single();

        if (error) {
            console.error('[ClassTemplates] Create error:', error);
            return { data: null, error: error.message };
        }

        return { data: mapDbToTemplate(data), error: null };
    } catch (e: any) {
        console.error('[ClassTemplates] Create exception:', e);
        return { data: null, error: e.message };
    }
}

// ============================================
// READ
// ============================================

/**
 * Get all templates for the current coach
 */
export async function getMyClassTemplates(
    page: number = 1,
    pageSize: number = 20
): Promise<ServiceResult<PaginatedResult<ClassTemplate>>> {
    try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user?.id) {
            return { data: null, error: 'Not authenticated' };
        }

        // Get coach profile
        const { data: coach, error: coachError } = await supabase
            .from('coach_profiles')
            .select('id')
            .eq('user_id', user.user.id)
            .single();

        if (coachError || !coach) {
            return { data: null, error: 'Coach profile not found' };
        }

        // Get count
        const { count } = await supabase
            .from('class_templates')
            .select('*', { count: 'exact', head: true })
            .eq('coach_id', coach.id);

        // Get page
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
            .from('class_templates')
            .select('*')
            .eq('coach_id', coach.id)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('[ClassTemplates] List error:', error);
            return { data: null, error: error.message };
        }

        return {
            data: {
                items: (data ?? []).map(mapDbToTemplate),
                total: count ?? 0,
                page,
                pageSize,
                hasMore: (count ?? 0) > page * pageSize,
            },
            error: null,
        };
    } catch (e: any) {
        console.error('[ClassTemplates] List exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Get a single template by ID
 */
export async function getClassTemplate(
    templateId: string
): Promise<ServiceResult<ClassTemplate>> {
    try {
        const { data, error } = await supabase
            .from('class_templates')
            .select('*')
            .eq('id', templateId)
            .single();

        if (error) {
            console.error('[ClassTemplates] Get error:', error);
            return { data: null, error: error.message };
        }

        return { data: mapDbToTemplate(data), error: null };
    } catch (e: any) {
        console.error('[ClassTemplates] Get exception:', e);
        return { data: null, error: e.message };
    }
}

// ============================================
// UPDATE
// ============================================

/**
 * Update a class template
 */
export async function updateClassTemplate(
    templateId: string,
    input: Partial<CreateClassTemplateInput>
): Promise<ServiceResult<ClassTemplate>> {
    try {
        const updateData: Record<string, unknown> = {};

        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.exercisesJson !== undefined) updateData.exercises_json = input.exercisesJson;
        if (input.estimatedDurationMinutes !== undefined) {
            updateData.estimated_duration_minutes = input.estimatedDurationMinutes;
        }
        if (input.defaultCapacity !== undefined) updateData.default_capacity = input.defaultCapacity;
        if (input.tags !== undefined) updateData.tags = input.tags;

        const { data, error } = await supabase
            .from('class_templates')
            .update(updateData)
            .eq('id', templateId)
            .select()
            .single();

        if (error) {
            console.error('[ClassTemplates] Update error:', error);
            return { data: null, error: error.message };
        }

        return { data: mapDbToTemplate(data), error: null };
    } catch (e: any) {
        console.error('[ClassTemplates] Update exception:', e);
        return { data: null, error: e.message };
    }
}

// ============================================
// DELETE
// ============================================

/**
 * Delete a class template
 */
export async function deleteClassTemplate(
    templateId: string
): Promise<ServiceResult<void>> {
    try {
        const { error } = await supabase
            .from('class_templates')
            .delete()
            .eq('id', templateId);

        if (error) {
            console.error('[ClassTemplates] Delete error:', error);
            return { data: null, error: error.message };
        }

        return { data: undefined, error: null };
    } catch (e: any) {
        console.error('[ClassTemplates] Delete exception:', e);
        return { data: null, error: e.message };
    }
}

// ============================================
// HELPERS
// ============================================

function mapDbToTemplate(row: any): ClassTemplate {
    return {
        id: row.id,
        coachId: row.coach_id,
        name: row.name,
        description: row.description,
        exercisesJson: row.exercises_json as ClassExercise[],
        estimatedDurationMinutes: row.estimated_duration_minutes,
        defaultCapacity: row.default_capacity,
        tags: row.tags ?? [],
        timesUsed: row.times_used ?? 0,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}
