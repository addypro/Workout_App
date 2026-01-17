/**
 * Coach Invite Service
 *
 * Handles athlete invitations via:
 * - Code: 8-character alphanumeric codes
 * - Link: Shareable URLs with tokens
 * - Email: Direct email invitations
 */

import { supabase } from '../../supabase/client';
import { canAddAthlete } from './profile';
import {
  AcceptInviteInput,
  AthleteStatus,
  CoachAthlete,
  CoachInvite,
  CreateInviteInput,
  InviteMethod,
  PaginatedResult,
  ServiceResult,
} from './types';

// ============================================
// INVITE CREATION
// ============================================

/**
 * Create a new invite for athletes
 */
export async function createInvite(
  input: CreateInviteInput
): Promise<ServiceResult<CoachInvite>> {
  try {
    // Check if coach can add more athletes
    const canAdd = await canAddAthlete();
    if (!canAdd.data?.canAdd) {
      return { data: null, error: canAdd.data?.reason || 'Cannot add more athletes', success: false };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    // Get coach profile
    const { data: coachProfile, error: profileError } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !coachProfile) {
      return { data: null, error: 'Coach profile not found', success: false };
    }

    // Generate invite code using database function
    const { data: codeData, error: codeError } = await supabase
      .rpc('generate_invite_code');

    if (codeError) throw codeError;

    const inviteCode = codeData as string;
    const expiresInDays = input.expiresInDays || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Generate link token if link invite
    const linkToken = input.inviteType === InviteMethod.LINK
      ? generateLinkToken()
      : null;

    const { data, error } = await supabase
      .from('coach_invites')
      .insert({
        coach_id: coachProfile.id,
        invite_type: input.inviteType,
        invite_code: inviteCode,
        invite_link_token: linkToken,
        email: input.email,
        max_uses: input.maxUses || (input.inviteType === InviteMethod.LINK ? 999 : 1),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      data: mapToCoachInvite(data),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachInvites] createInvite error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to create invite',
      success: false,
    };
  }
}

/**
 * Create a quick code invite (simplest method)
 */
export async function createCodeInvite(): Promise<ServiceResult<CoachInvite>> {
  return createInvite({ inviteType: InviteMethod.CODE });
}

/**
 * Create a shareable link invite
 */
export async function createLinkInvite(
  maxUses: number = 999,
  expiresInDays: number = 30
): Promise<ServiceResult<CoachInvite>> {
  return createInvite({
    inviteType: InviteMethod.LINK,
    maxUses,
    expiresInDays,
  });
}

/**
 * Create an email invite for a specific person
 */
export async function createEmailInvite(email: string): Promise<ServiceResult<CoachInvite>> {
  return createInvite({
    inviteType: InviteMethod.EMAIL,
    email,
  });
}

// ============================================
// INVITE MANAGEMENT
// ============================================

/**
 * Get all invites for the current coach
 */
export async function getMyInvites(
  page: number = 1,
  pageSize: number = 20
): Promise<ServiceResult<PaginatedResult<CoachInvite>>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    // Get coach profile
    const { data: coachProfile } = await supabase
      .from('coach_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!coachProfile) {
      return { data: null, error: 'Coach profile not found', success: false };
    }

    const offset = (page - 1) * pageSize;

    // Get total count
    const { count } = await supabase
      .from('coach_invites')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', coachProfile.id);

    // Get paginated data
    const { data, error } = await supabase
      .from('coach_invites')
      .select('*')
      .eq('coach_id', coachProfile.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    return {
      data: {
        data: (data || []).map(mapToCoachInvite),
        total: count || 0,
        page,
        pageSize,
        hasMore: (count || 0) > offset + pageSize,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachInvites] getMyInvites error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get invites',
      success: false,
    };
  }
}

/**
 * Deactivate an invite
 */
export async function deactivateInvite(inviteId: string): Promise<ServiceResult<void>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const { error } = await supabase
      .from('coach_invites')
      .update({ is_active: false })
      .eq('id', inviteId);

    if (error) throw error;

    return { data: undefined, error: null, success: true };
  } catch (error) {
    console.error('[CoachInvites] deactivateInvite error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to deactivate invite',
      success: false,
    };
  }
}

// ============================================
// INVITE LOOKUP (FOR ATHLETES)
// ============================================

/**
 * Look up an invite by code (for athletes joining)
 */
export async function lookupInvite(code: string): Promise<ServiceResult<{
  invite: CoachInvite;
  coachName: string;
  coachBio?: string;
}>> {
  try {
    const { data, error } = await supabase
      .from('coach_invites')
      .select(`
        *,
        coach_profiles!inner (
          display_name,
          bio,
          avatar_url
        )
      `)
      .eq('invite_code', code.toUpperCase())
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { data: null, error: 'Invalid or expired invite code', success: false };
      }
      throw error;
    }

    // Check usage limit
    if (data.max_uses && data.current_uses >= data.max_uses) {
      return { data: null, error: 'This invite has reached its maximum uses', success: false };
    }

    const coachProfile = data.coach_profiles as Record<string, unknown>;

    return {
      data: {
        invite: mapToCoachInvite(data),
        coachName: coachProfile.display_name as string,
        coachBio: coachProfile.bio as string | undefined,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachInvites] lookupInvite error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to lookup invite',
      success: false,
    };
  }
}

/**
 * Look up invite by link token
 */
export async function lookupInviteByToken(token: string): Promise<ServiceResult<{
  invite: CoachInvite;
  coachName: string;
  coachBio?: string;
}>> {
  try {
    const { data, error } = await supabase
      .from('coach_invites')
      .select(`
        *,
        coach_profiles!inner (
          display_name,
          bio,
          avatar_url
        )
      `)
      .eq('invite_link_token', token)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { data: null, error: 'Invalid or expired invite link', success: false };
      }
      throw error;
    }

    if (data.max_uses && data.current_uses >= data.max_uses) {
      return { data: null, error: 'This invite link has reached its maximum uses', success: false };
    }

    const coachProfile = data.coach_profiles as Record<string, unknown>;

    return {
      data: {
        invite: mapToCoachInvite(data),
        coachName: coachProfile.display_name as string,
        coachBio: coachProfile.bio as string | undefined,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachInvites] lookupInviteByToken error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to lookup invite',
      success: false,
    };
  }
}

// ============================================
// ACCEPT INVITE (ATHLETE SIDE)
// ============================================

/**
 * Accept a coach invite (as an athlete)
 */
export async function acceptInvite(
  input: AcceptInviteInput
): Promise<ServiceResult<CoachAthlete>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    // Use the database function which handles all validation
    const { data, error } = await supabase.rpc('accept_coach_invite', {
      p_invite_code: input.inviteCode.toUpperCase(),
      p_share_history: input.shareWorkoutHistory || false,
      p_share_metrics: input.shareBodyMetrics || false,
    });

    if (error) throw error;

    // Get the created relationship
    const { data: athlete, error: fetchError } = await supabase
      .from('coach_athletes')
      .select('*')
      .eq('id', data)
      .single();

    if (fetchError) throw fetchError;

    return {
      data: mapToCoachAthlete(athlete),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachInvites] acceptInvite error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to accept invite',
      success: false,
    };
  }
}

// ============================================
// ATHLETE MANAGEMENT
// ============================================

/**
 * Get all athletes for the current coach
 */
export async function getMyAthletes(
  status?: AthleteStatus,
  page: number = 1,
  pageSize: number = 20
): Promise<ServiceResult<PaginatedResult<CoachAthlete>>> {
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

    let query = supabase
      .from('coach_athletes')
      .select('*', { count: 'exact' })
      .eq('coach_id', coachProfile.id);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query
      .order('joined_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    return {
      data: {
        data: (data || []).map(mapToCoachAthlete),
        total: count || 0,
        page,
        pageSize,
        hasMore: (count || 0) > offset + pageSize,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachInvites] getMyAthletes error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get athletes',
      success: false,
    };
  }
}

/**
 * Remove an athlete from the coach's roster
 */
export async function removeAthlete(athleteRelationId: string): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('coach_athletes')
      .update({ status: AthleteStatus.REMOVED })
      .eq('id', athleteRelationId);

    if (error) throw error;

    return { data: undefined, error: null, success: true };
  } catch (error) {
    console.error('[CoachInvites] removeAthlete error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to remove athlete',
      success: false,
    };
  }
}

/**
 * Leave a coach (athlete side)
 */
export async function leaveCoach(coachId: string): Promise<ServiceResult<void>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const { error } = await supabase
      .from('coach_athletes')
      .update({ status: AthleteStatus.LEFT })
      .eq('coach_id', coachId)
      .eq('athlete_user_id', user.id);

    if (error) throw error;

    return { data: undefined, error: null, success: true };
  } catch (error) {
    console.error('[CoachInvites] leaveCoach error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to leave coach',
      success: false,
    };
  }
}

/**
 * Update sharing preferences (athlete side)
 */
export async function updateSharingPreferences(
  coachId: string,
  shareWorkoutHistory: boolean,
  shareBodyMetrics: boolean
): Promise<ServiceResult<void>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const { error } = await supabase
      .from('coach_athletes')
      .update({
        share_workout_history: shareWorkoutHistory,
        share_body_metrics: shareBodyMetrics,
      })
      .eq('coach_id', coachId)
      .eq('athlete_user_id', user.id);

    if (error) throw error;

    return { data: undefined, error: null, success: true };
  } catch (error) {
    console.error('[CoachInvites] updateSharingPreferences error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to update preferences',
      success: false,
    };
  }
}

/**
 * Get coaches for the current athlete
 */
export async function getMyCoaches(): Promise<ServiceResult<CoachAthlete[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const { data, error } = await supabase
      .from('athlete_coaches')
      .select('*');

    if (error) throw error;

    return {
      data: (data || []).map((d) => ({
        id: '',
        coachId: d.coach_id,
        athleteUserId: user.id,
        inviteMethod: InviteMethod.CODE,
        invitedAt: new Date(),
        joinedAt: d.joined_at ? new Date(d.joined_at) : undefined,
        status: d.status as AthleteStatus,
        shareWorkoutHistory: d.share_workout_history,
        shareBodyMetrics: d.share_body_metrics,
        createdAt: new Date(),
        updatedAt: new Date(),
        athleteName: d.coach_name,
      })),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachInvites] getMyCoaches error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get coaches',
      success: false,
    };
  }
}

// ============================================
// HELPERS
// ============================================

function generateLinkToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function mapToCoachInvite(data: Record<string, unknown>): CoachInvite {
  return {
    id: data.id as string,
    coachId: data.coach_id as string,
    inviteType: data.invite_type as InviteMethod,
    inviteCode: data.invite_code as string,
    inviteLinkToken: data.invite_link_token as string | undefined,
    email: data.email as string | undefined,
    maxUses: data.max_uses as number,
    currentUses: data.current_uses as number,
    expiresAt: new Date(data.expires_at as string),
    isActive: data.is_active as boolean,
    createdAt: new Date(data.created_at as string),
  };
}

function mapToCoachAthlete(data: Record<string, unknown>): CoachAthlete {
  return {
    id: data.id as string,
    coachId: data.coach_id as string,
    athleteUserId: data.athlete_user_id as string,
    inviteMethod: data.invite_method as InviteMethod,
    inviteCode: data.invite_code as string | undefined,
    invitedAt: new Date(data.invited_at as string),
    joinedAt: data.joined_at ? new Date(data.joined_at as string) : undefined,
    status: data.status as AthleteStatus,
    shareWorkoutHistory: data.share_workout_history as boolean,
    shareBodyMetrics: data.share_body_metrics as boolean,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}

/**
 * Generate an invite URL for sharing
 */
export function getInviteUrl(invite: CoachInvite): string {
  // Use workoutapp:// to match app.json scheme
  const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'workoutapp://';

  if (invite.inviteLinkToken) {
    return `${baseUrl}join?token=${invite.inviteLinkToken}`;
  }

  return `${baseUrl}join?code=${invite.inviteCode}`;
}

