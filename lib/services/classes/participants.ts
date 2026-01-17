/**
 * Class Participants Service
 *
 * Operations for managing class participants.
 * Handles join/leave, check-in, and roster management.
 */

import { supabase } from '../../supabase/client';
import type {
    ClassCheckin,
    ClassCheckinMethod,
    ClassParticipant,
    ClassParticipantStatus,
    ServiceResult,
} from './types';

// ============================================
// JOIN / LEAVE
// ============================================

/**
 * Join a class session
 */
export async function joinClassSession(
    sessionId: string
): Promise<ServiceResult<ClassParticipant>> {
    try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user?.id) {
            return { data: null, error: 'Not authenticated' };
        }

        // Check capacity
        const { data: session } = await supabase
            .from('class_sessions')
            .select('capacity, current_participant_count, status')
            .eq('id', sessionId)
            .single();

        if (!session) {
            return { data: null, error: 'Session not found' };
        }

        if (session.status === 'canceled') {
            return { data: null, error: 'Session is canceled' };
        }

        if (session.status === 'completed') {
            return { data: null, error: 'Session is already completed' };
        }

        const status: ClassParticipantStatus =
            session.current_participant_count >= session.capacity ? 'waitlisted' : 'joined';

        const { data, error } = await supabase
            .from('class_participants')
            .insert({
                session_id: sessionId,
                athlete_user_id: user.user.id,
                status,
                joined_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            // Handle duplicate join
            if (error.code === '23505') {
                return { data: null, error: 'Already joined this session' };
            }
            console.error('[ClassParticipants] Join error:', error);
            return { data: null, error: error.message };
        }

        return { data: mapDbToParticipant(data), error: null };
    } catch (e: any) {
        console.error('[ClassParticipants] Join exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Leave a class session
 */
export async function leaveClassSession(
    sessionId: string
): Promise<ServiceResult<void>> {
    try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user?.id) {
            return { data: null, error: 'Not authenticated' };
        }

        const { error } = await supabase
            .from('class_participants')
            .update({
                status: 'canceled',
                canceled_at: new Date().toISOString(),
            })
            .eq('session_id', sessionId)
            .eq('athlete_user_id', user.user.id);

        if (error) {
            console.error('[ClassParticipants] Leave error:', error);
            return { data: null, error: error.message };
        }

        return { data: undefined, error: null };
    } catch (e: any) {
        console.error('[ClassParticipants] Leave exception:', e);
        return { data: null, error: e.message };
    }
}

// ============================================
// CHECK-IN
// ============================================

/**
 * Check in to a class session (athlete)
 */
export async function checkInToSession(
    sessionId: string,
    method: ClassCheckinMethod = 'tap',
    code?: string
): Promise<ServiceResult<ClassCheckin>> {
    try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user?.id) {
            return { data: null, error: 'Not authenticated' };
        }

        // Verify participant is joined
        const { data: participant } = await supabase
            .from('class_participants')
            .select('status')
            .eq('session_id', sessionId)
            .eq('athlete_user_id', user.user.id)
            .single();

        if (!participant || participant.status !== 'joined') {
            return { data: null, error: 'Must be joined to check in' };
        }

        const { data, error } = await supabase
            .from('class_checkins')
            .insert({
                session_id: sessionId,
                athlete_user_id: user.user.id,
                method,
                code_used: code,
                checked_in_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return { data: null, error: 'Already checked in' };
            }
            console.error('[ClassParticipants] Check-in error:', error);
            return { data: null, error: error.message };
        }

        return { data: mapDbToCheckin(data), error: null };
    } catch (e: any) {
        console.error('[ClassParticipants] Check-in exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Manual check-in by coach
 */
export async function coachCheckInAthlete(
    sessionId: string,
    athleteUserId: string
): Promise<ServiceResult<ClassCheckin>> {
    try {
        const { data, error } = await supabase
            .from('class_checkins')
            .insert({
                session_id: sessionId,
                athlete_user_id: athleteUserId,
                method: 'manual',
                checked_in_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return { data: null, error: 'Athlete already checked in' };
            }
            console.error('[ClassParticipants] Coach check-in error:', error);
            return { data: null, error: error.message };
        }

        return { data: mapDbToCheckin(data), error: null };
    } catch (e: any) {
        console.error('[ClassParticipants] Coach check-in exception:', e);
        return { data: null, error: e.message };
    }
}

// ============================================
// ROSTER QUERIES
// ============================================

/**
 * Get roster for a session (coach view)
 */
export async function getSessionRoster(
    sessionId: string
): Promise<ServiceResult<ClassParticipant[]>> {
    try {
        const { data, error } = await supabase
            .from('class_participants')
            .select(`
        *,
        profiles:athlete_user_id(display_name, avatar_url),
        class_checkins(checked_in_at)
      `)
            .eq('session_id', sessionId)
            .eq('status', 'joined')
            .order('joined_at', { ascending: true });

        if (error) {
            console.error('[ClassParticipants] Roster error:', error);
            return { data: null, error: error.message };
        }

        const participants = (data ?? []).map((row) => {
            const participant = mapDbToParticipant(row);
            // Add joined fields
            if (row.profiles) {
                participant.athleteName = row.profiles.display_name;
                participant.athleteAvatarUrl = row.profiles.avatar_url;
            }
            participant.checkedIn = row.class_checkins?.length > 0;
            return participant;
        });

        return { data: participants, error: null };
    } catch (e: any) {
        console.error('[ClassParticipants] Roster exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Get my participation status for a session
 */
export async function getMyParticipation(
    sessionId: string
): Promise<ServiceResult<ClassParticipant | null>> {
    try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user?.id) {
            return { data: null, error: 'Not authenticated' };
        }

        const { data, error } = await supabase
            .from('class_participants')
            .select('*')
            .eq('session_id', sessionId)
            .eq('athlete_user_id', user.user.id)
            .maybeSingle();

        if (error) {
            console.error('[ClassParticipants] Get participation error:', error);
            return { data: null, error: error.message };
        }

        return { data: data ? mapDbToParticipant(data) : null, error: null };
    } catch (e: any) {
        console.error('[ClassParticipants] Get participation exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Get my check-in status for a session
 */
export async function getMyCheckin(
    sessionId: string
): Promise<ServiceResult<ClassCheckin | null>> {
    try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user?.id) {
            return { data: null, error: 'Not authenticated' };
        }

        const { data, error } = await supabase
            .from('class_checkins')
            .select('*')
            .eq('session_id', sessionId)
            .eq('athlete_user_id', user.user.id)
            .maybeSingle();

        if (error) {
            console.error('[ClassParticipants] Get checkin error:', error);
            return { data: null, error: error.message };
        }

        return { data: data ? mapDbToCheckin(data) : null, error: null };
    } catch (e: any) {
        console.error('[ClassParticipants] Get checkin exception:', e);
        return { data: null, error: e.message };
    }
}

/**
 * Get checked-in athletes for a session
 */
export async function getCheckedInAthletes(
    sessionId: string
): Promise<ServiceResult<ClassCheckin[]>> {
    try {
        const { data, error } = await supabase
            .from('class_checkins')
            .select('*')
            .eq('session_id', sessionId)
            .order('checked_in_at', { ascending: true });

        if (error) {
            console.error('[ClassParticipants] Get checkins error:', error);
            return { data: null, error: error.message };
        }

        return { data: (data ?? []).map(mapDbToCheckin), error: null };
    } catch (e: any) {
        console.error('[ClassParticipants] Get checkins exception:', e);
        return { data: null, error: e.message };
    }
}

// ============================================
// HELPERS
// ============================================

function mapDbToParticipant(row: any): ClassParticipant {
    return {
        id: row.id,
        sessionId: row.session_id,
        athleteUserId: row.athlete_user_id,
        status: row.status as ClassParticipantStatus,
        joinedAt: new Date(row.joined_at),
        canceledAt: row.canceled_at ? new Date(row.canceled_at) : undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}

function mapDbToCheckin(row: any): ClassCheckin {
    return {
        id: row.id,
        sessionId: row.session_id,
        athleteUserId: row.athlete_user_id,
        checkedInAt: new Date(row.checked_in_at),
        method: row.method as ClassCheckinMethod,
        codeUsed: row.code_used,
        createdAt: new Date(row.created_at),
    };
}
