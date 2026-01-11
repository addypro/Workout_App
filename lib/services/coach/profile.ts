/**
 * Coach Profile Service
 *
 * Handles coach profile creation, updates, and retrieval.
 * Includes subscription tier management and dashboard data.
 */

import { supabase } from '../../supabase/client';
import {
  CoachProfile,
  CoachDashboard,
  CreateCoachProfileInput,
  UpdateCoachProfileInput,
  ServiceResult,
  SubscriptionTier,
  TIER_LIMITS,
} from './types';

// ============================================
// PROFILE MANAGEMENT
// ============================================

/**
 * Get the current user's coach profile
 */
export async function getCoachProfile(): Promise<ServiceResult<CoachProfile>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const { data, error } = await supabase
      .from('coach_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No profile found
        return { data: null, error: null, success: true };
      }
      throw error;
    }

    return {
      data: mapToCoachProfile(data),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachProfile] getCoachProfile error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get coach profile',
      success: false,
    };
  }
}

/**
 * Create a new coach profile for the current user
 */
export async function createCoachProfile(
  input: CreateCoachProfileInput
): Promise<ServiceResult<CoachProfile>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    // Check if profile already exists
    const existing = await getCoachProfile();
    if (existing.data) {
      return { data: null, error: 'Coach profile already exists', success: false };
    }

    const { data, error } = await supabase
      .from('coach_profiles')
      .insert({
        user_id: user.id,
        display_name: input.displayName,
        business_name: input.businessName,
        bio: input.bio,
        specializations: input.specializations || [],
        subscription_tier: SubscriptionTier.TRIAL,
        max_athletes: TIER_LIMITS.trial,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      data: mapToCoachProfile(data),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachProfile] createCoachProfile error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to create coach profile',
      success: false,
    };
  }
}

/**
 * Update the current user's coach profile
 */
export async function updateCoachProfile(
  input: UpdateCoachProfileInput
): Promise<ServiceResult<CoachProfile>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const updateData: Record<string, unknown> = {};
    if (input.displayName !== undefined) updateData.display_name = input.displayName;
    if (input.businessName !== undefined) updateData.business_name = input.businessName;
    if (input.bio !== undefined) updateData.bio = input.bio;
    if (input.specializations !== undefined) updateData.specializations = input.specializations;
    if (input.avatarUrl !== undefined) updateData.avatar_url = input.avatarUrl;

    const { data, error } = await supabase
      .from('coach_profiles')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return {
      data: mapToCoachProfile(data),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachProfile] updateCoachProfile error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to update coach profile',
      success: false,
    };
  }
}

// ============================================
// DASHBOARD DATA
// ============================================

/**
 * Get coach dashboard data with aggregated stats
 */
export async function getCoachDashboard(): Promise<ServiceResult<CoachDashboard>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Not authenticated', success: false };
    }

    const { data, error } = await supabase
      .from('coach_dashboard')
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { data: null, error: 'Coach profile not found', success: false };
      }
      throw error;
    }

    return {
      data: {
        coachId: data.coach_id,
        userId: data.user_id,
        displayName: data.display_name,
        subscriptionTier: data.subscription_tier as SubscriptionTier,
        subscriptionStatus: data.subscription_status,
        currentAthleteCount: data.current_athlete_count,
        maxAthletes: data.max_athletes,
        trialEndsAt: data.trial_ends_at ? new Date(data.trial_ends_at) : undefined,
        trialDaysRemaining: data.trial_days_remaining,
        totalPrograms: data.total_programs,
        activeAssignments: data.active_assignments,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachProfile] getCoachDashboard error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to get dashboard',
      success: false,
    };
  }
}

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

/**
 * Check if the coach's trial has expired
 */
export async function isTrialExpired(): Promise<boolean> {
  const result = await getCoachProfile();
  if (!result.data) return true;

  if (result.data.subscriptionTier !== SubscriptionTier.TRIAL) {
    return false;
  }

  return new Date() > result.data.trialEndsAt;
}

/**
 * Get remaining trial days
 */
export async function getTrialDaysRemaining(): Promise<number> {
  const result = await getCoachProfile();
  if (!result.data) return 0;

  if (result.data.subscriptionTier !== SubscriptionTier.TRIAL) {
    return 0;
  }

  const now = new Date();
  const trialEnd = result.data.trialEndsAt;
  const diffTime = trialEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Check if coach can add more athletes
 */
export async function canAddAthlete(): Promise<ServiceResult<{ canAdd: boolean; reason?: string }>> {
  try {
    const result = await getCoachProfile();
    if (!result.data) {
      return { data: { canAdd: false, reason: 'No coach profile found' }, error: null, success: true };
    }

    const profile = result.data;

    // Check trial expiration
    if (profile.subscriptionTier === SubscriptionTier.TRIAL) {
      if (new Date() > profile.trialEndsAt) {
        return {
          data: { canAdd: false, reason: 'Trial has expired. Please subscribe to continue.' },
          error: null,
          success: true,
        };
      }
    }

    // Check subscription status
    if (profile.subscriptionStatus !== 'active' && profile.subscriptionTier !== SubscriptionTier.TRIAL) {
      return {
        data: { canAdd: false, reason: 'Subscription is not active.' },
        error: null,
        success: true,
      };
    }

    // Check athlete limit
    if (profile.currentAthleteCount >= profile.maxAthletes) {
      return {
        data: {
          canAdd: false,
          reason: `Athlete limit reached (${profile.currentAthleteCount}/${profile.maxAthletes}). Upgrade to add more.`,
        },
        error: null,
        success: true,
      };
    }

    return { data: { canAdd: true }, error: null, success: true };
  } catch (error) {
    console.error('[CoachProfile] canAddAthlete error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to check athlete limit',
      success: false,
    };
  }
}

/**
 * Update subscription tier (called from Stripe webhook)
 * This should typically be called from a server-side function
 */
export async function updateSubscriptionTier(
  coachId: string,
  tier: SubscriptionTier,
  stripeSubscriptionId: string
): Promise<ServiceResult<CoachProfile>> {
  try {
    const { data, error } = await supabase
      .from('coach_profiles')
      .update({
        subscription_tier: tier,
        stripe_subscription_id: stripeSubscriptionId,
        subscription_status: 'active',
        max_athletes: TIER_LIMITS[tier],
      })
      .eq('id', coachId)
      .select()
      .single();

    if (error) throw error;

    return {
      data: mapToCoachProfile(data),
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('[CoachProfile] updateSubscriptionTier error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to update subscription',
      success: false,
    };
  }
}

// ============================================
// HELPERS
// ============================================

function mapToCoachProfile(data: Record<string, unknown>): CoachProfile {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    displayName: data.display_name as string,
    businessName: data.business_name as string | undefined,
    bio: data.bio as string | undefined,
    specializations: (data.specializations as string[]) || [],
    avatarUrl: data.avatar_url as string | undefined,
    stripeCustomerId: data.stripe_customer_id as string | undefined,
    stripeSubscriptionId: data.stripe_subscription_id as string | undefined,
    subscriptionTier: data.subscription_tier as SubscriptionTier,
    subscriptionStatus: data.subscription_status as 'active' | 'past_due' | 'canceled' | 'incomplete',
    maxAthletes: data.max_athletes as number,
    currentAthleteCount: data.current_athlete_count as number,
    trialStartedAt: new Date(data.trial_started_at as string),
    trialEndsAt: new Date(data.trial_ends_at as string),
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}
