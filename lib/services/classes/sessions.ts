/**
 * Class Sessions Service
 *
 * Operations for scheduling and managing class sessions.
 * Sessions are instances of templates scheduled for specific times.
 */

import { isFeatureEnabled } from '../../config/feature-flags';
import { supabase } from '../../supabase/client';
import type {
    ClassExercise,
    ClassSession,
    ClassSessionStatus,
    CreateClassSessionInput,
    PaginatedResult,
    ServiceResult,
} from './types';

// ============================================
// CREATE
// ============================================

/**
 * Schedule a new class session
 */
export async function createClassSession(
    input: CreateClassSessionInput
): Promise<ServiceResult<ClassSession>> {
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

        // Get template for defaults
        const { data: template, error: templateError } = await supabase
            .from('class_templates')
            .select('*')
            .eq('id', input.templateId)
            .single();

        if (templateError || !template) {
            return { data: null, error: 'Template not found' };
        }

        const { data, error } = await supabase
            .from('class_sessions')
            .insert({
                template_id: input.templateId,
                coach_id: coach.id,
                name: input.name ?? template.name,
                description: input.description ?? template.description,
                start_at: input.startAt.toISOString(),
                end_at: input.endAt?.toISOString(),
                capacity: input.capacity ?? template.default_capacity,
                exercises_json: input.exercisesJson ?? template.exercises_json,
                reminder_minutes: input.reminderMinutes ?? 30,
                location_name: input.locationName,
                location_address: input.locationAddress,
                status: 'scheduled',
            })
            .select()
            .single();

        if (error) {
            console.error('[ClassSessions] Create error:', error);
            return { data: null, error: error.message };
        }

        return { data: mapDbToSession(data), error: null };
    } catch (e: any) {
        console.error('[ClassSessions] Create exception:', e);
        return { data: null, error: e.message };
    }
}

// ============================================
// READ
// ============================================

/**
 * Get upcoming sessions for the current coach
 */
export async function getMyUpcomingSessions(
    page: number = 1,
    pageSize: number = 20
): Promise<ServiceResult<PaginatedResult<ClassSession>>> {
    try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user?.id) {
            return { data: null, error: 'Not authenticated' };
        }

        const { data: coach } = await supabase
            .from('coach_profiles')
            .select('id')
            .eq('user_id', user.user.id)
            .single();

        if (!coach) {
            return { data: null, error: 'Coach profile not found' };
        }

        const now = new Date().toISOString();

        const { count } = await supabase
            .from('class_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('coach_id', coach.id)
            .gte('start_at', now)
            .in('status', ['scheduled', 'in_progress']);

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
            .from('class_sessions')
            .select('*')
            .eq('coach_id', coach.id)
            .gte('start_at', now)
            .in('status', ['scheduled', 'in_progress'])
            .order('start_at', { ascending: true })
            .range(from, to);

        if (error) {
            console.error('[ClassSessions] List error:', error);
            return { data: null, error: error.message };
        }

        return {
            data: {
                items: (data ?? []).map(mapDbToSession),
                total: count ?? 0,
                page,
                pageSize,
                hasMore: (count ?? 0) > page * pageSize,
            },
            error: null,
        };
    } catch (e: any) {
        console.error('[ClassSessions] List exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Get sessions for an athlete (joined sessions)
 */
export async function getMyJoinedSessions(): Promise<ServiceResult<ClassSession[]>> {
    // Graceful degradation when feature is disabled or DB not ready
    if (!isFeatureEnabled('workout_classes')) {
        return { data: [], error: null };
    }

    try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user?.id) {
            return { data: [], error: null }; // Return empty instead of error for guest users
        }

        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from('class_sessions')
            .select(`
        *,
        class_participants!inner(athlete_user_id, status)
      `)
            .eq('class_participants.athlete_user_id', user.user.id)
            .eq('class_participants.status', 'joined')
            .gte('start_at', now)
            .in('status', ['scheduled', 'in_progress'])
            .order('start_at', { ascending: true });

        if (error) {
            // Graceful degradation: log warning but return empty instead of erroring
            console.warn('[ClassSessions] Joined list query failed (DB may not be ready):', error.message);
            return { data: [], error: null };
        }

        return { data: (data ?? []).map(mapDbToSession), error: null };
    } catch (e: any) {
        // Graceful degradation: log warning but return empty
        console.warn('[ClassSessions] Joined list exception (DB may not be ready):', e.message);
        return { data: [], error: null };
    }
}

/**
 * Get available sessions for an athlete to discover and join
 * Returns upcoming sessions with capacity that the athlete hasn't joined
 */
export async function getAvailableSessions(
    filter: 'all' | 'today' | 'week' = 'all'
): Promise<ServiceResult<ClassSession[]>> {
    try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user?.id) {
            return { data: null, error: 'Not authenticated' };
        }

        const now = new Date();
        let endDate: Date | undefined;

        // Calculate filter bounds
        if (filter === 'today') {
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
        } else if (filter === 'week') {
            endDate = new Date(now);
            endDate.setDate(endDate.getDate() + 7);
        }

        // Get sessions athlete has already joined
        const { data: joinedSessions } = await supabase
            .from('class_participants')
            .select('session_id')
            .eq('athlete_user_id', user.user.id)
            .eq('status', 'joined');

        const joinedIds = (joinedSessions ?? []).map((p) => p.session_id);

        // Build query for available sessions
        let query = supabase
            .from('class_sessions')
            .select('*')
            .eq('status', 'scheduled')
            .gte('start_at', now.toISOString())
            .order('start_at', { ascending: true })
            .limit(50);

        if (endDate) {
            query = query.lte('start_at', endDate.toISOString());
        }

        const { data, error } = await query;

        if (error) {
            console.error('[ClassSessions] Available list error:', error);
            return { data: null, error: error.message };
        }

        // Filter out already joined and at-capacity sessions
        const available = (data ?? [])
            .filter((s) => !joinedIds.includes(s.id))
            .filter((s) => s.current_participant_count < s.capacity)
            .map(mapDbToSession);

        return { data: available, error: null };
    } catch (e: any) {
        console.error('[ClassSessions] Available list exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Get a single session by ID
 */
export async function getClassSession(
    sessionId: string
): Promise<ServiceResult<ClassSession>> {
    try {
        const { data, error } = await supabase
            .from('class_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (error) {
            console.error('[ClassSessions] Get error:', error);
            return { data: null, error: error.message };
        }

        return { data: mapDbToSession(data), error: null };
    } catch (e: any) {
        console.error('[ClassSessions] Get exception:', e);
        return { data: null, error: e.message };
    }
}

// ============================================
// UPDATE
// ============================================

/**
 * Update a class session
 */
export async function updateClassSession(
    sessionId: string,
    input: Partial<Omit<CreateClassSessionInput, 'templateId'>>
): Promise<ServiceResult<ClassSession>> {
    try {
        const updateData: Record<string, unknown> = {};

        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.startAt !== undefined) updateData.start_at = input.startAt.toISOString();
        if (input.endAt !== undefined) updateData.end_at = input.endAt.toISOString();
        if (input.capacity !== undefined) updateData.capacity = input.capacity;
        if (input.exercisesJson !== undefined) updateData.exercises_json = input.exercisesJson;
        if (input.reminderMinutes !== undefined) updateData.reminder_minutes = input.reminderMinutes;
        if (input.locationName !== undefined) updateData.location_name = input.locationName;
        if (input.locationAddress !== undefined) updateData.location_address = input.locationAddress;

        // Increment change version for notification tracking
        const { data: current } = await supabase
            .from('class_sessions')
            .select('change_version')
            .eq('id', sessionId)
            .single();

        updateData.change_version = (current?.change_version ?? 0) + 1;

        const { data, error } = await supabase
            .from('class_sessions')
            .update(updateData)
            .eq('id', sessionId)
            .select()
            .single();

        if (error) {
            console.error('[ClassSessions] Update error:', error);
            return { data: null, error: error.message };
        }

        return { data: mapDbToSession(data), error: null };
    } catch (e: any) {
        console.error('[ClassSessions] Update exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Update session status
 */
export async function updateSessionStatus(
    sessionId: string,
    status: ClassSessionStatus
): Promise<ServiceResult<void>> {
    try {
        const { error } = await supabase
            .from('class_sessions')
            .update({ status })
            .eq('id', sessionId);

        if (error) {
            console.error('[ClassSessions] Status update error:', error);
            return { data: null, error: error.message };
        }

        return { data: undefined, error: null };
    } catch (e: any) {
        console.error('[ClassSessions] Status update exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Start a class session
 */
export async function startClassSession(
    sessionId: string
): Promise<ServiceResult<ClassSession>> {
    try {
        const { data, error } = await supabase
            .from('class_sessions')
            .update({ status: 'in_progress' })
            .eq('id', sessionId)
            .select()
            .single();

        if (error) {
            console.error('[ClassSessions] Start error:', error);
            return { data: null, error: error.message };
        }

        return { data: mapDbToSession(data), error: null };
    } catch (e: any) {
        console.error('[ClassSessions] Start exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Complete a class session
 */
export async function completeClassSession(
    sessionId: string
): Promise<ServiceResult<ClassSession>> {
    try {
        const { data, error } = await supabase
            .from('class_sessions')
            .update({ status: 'completed' })
            .eq('id', sessionId)
            .select()
            .single();

        if (error) {
            console.error('[ClassSessions] Complete error:', error);
            return { data: null, error: error.message };
        }

        return { data: mapDbToSession(data), error: null };
    } catch (e: any) {
        console.error('[ClassSessions] Complete exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Cancel a class session
 */
export async function cancelClassSession(
    sessionId: string
): Promise<ServiceResult<void>> {
    try {
        const { error } = await supabase
            .from('class_sessions')
            .update({ status: 'canceled' })
            .eq('id', sessionId);

        if (error) {
            console.error('[ClassSessions] Cancel error:', error);
            return { data: null, error: error.message };
        }

        return { data: undefined, error: null };
    } catch (e: any) {
        console.error('[ClassSessions] Cancel exception:', e);
        return { data: null, error: e.message };
    }
}

// ============================================
// DELETE
// ============================================

/**
 * Delete a class session
 */
export async function deleteClassSession(
    sessionId: string
): Promise<ServiceResult<void>> {
    try {
        const { error } = await supabase
            .from('class_sessions')
            .delete()
            .eq('id', sessionId);

        if (error) {
            console.error('[ClassSessions] Delete error:', error);
            return { data: null, error: error.message };
        }

        return { data: undefined, error: null };
    } catch (e: any) {
        console.error('[ClassSessions] Delete exception:', e);
        return { data: null, error: e.message };
    }
}

// ============================================
// HELPERS
// ============================================

function mapDbToSession(row: any): ClassSession {
    return {
        id: row.id,
        templateId: row.template_id,
        coachId: row.coach_id,
        name: row.name,
        description: row.description,
        startAt: new Date(row.start_at),
        endAt: row.end_at ? new Date(row.end_at) : undefined,
        timezone: row.timezone ?? 'America/New_York',
        capacity: row.capacity,
        currentParticipantCount: row.current_participant_count ?? 0,
        exercisesJson: row.exercises_json as ClassExercise[],
        reminderMinutes: row.reminder_minutes ?? 30,
        status: row.status as ClassSessionStatus,
        changeVersion: row.change_version ?? 1,
        locationName: row.location_name,
        locationAddress: row.location_address,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}
