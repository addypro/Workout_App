/**
 * Gym Membership Service
 * 
 * Manages gym_members records in Supabase when users set their home gym.
 * This enables transitive RLS policies for coaches to see gym traffic data.
 */

import type { GymInfo } from '@/lib/context/preferences-context';
import { supabase } from '@/lib/supabase/client';
import type { Gym, GymMember, GymMemberInsert } from '@/lib/types/gym-network';

/**
 * Creates or updates a gym record and the user's membership.
 * Called when user sets their home gym.
 */
export async function joinGym(gymInfo: GymInfo): Promise<{ gym: Gym; membership: GymMember } | null> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.warn('[GymMembership] No authenticated user');
            return null;
        }

        // Step 1: Upsert the gym record
        const gymData = {
            id: gymInfo.id, // Use provided ID (could be OSM ID or custom UUID)
            name: gymInfo.name,
            osm_id: gymInfo.osmId || null,
            address: gymInfo.address || null,
            // PostGIS geography requires special handling
            ...(gymInfo.latitude && gymInfo.longitude ? {
                location: `POINT(${gymInfo.longitude} ${gymInfo.latitude})`,
            } : {}),
            created_by: user.id,
            source: gymInfo.osmId ? 'osm' : 'user',
        };

        // Upsert gym - if OSM ID exists, match on that; otherwise match on ID
        const { data: gym, error: gymError } = await supabase
            .from('gyms')
            .upsert(gymData, {
                onConflict: gymInfo.osmId ? 'osm_id' : 'id',
                ignoreDuplicates: false,
            })
            .select()
            .single();

        if (gymError) {
            console.error('[GymMembership] Failed to upsert gym:', gymError);
            return null;
        }

        // Step 2: Deactivate any previous memberships for this user
        await supabase
            .from('gym_members')
            .update({ status: 'inactive', left_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .eq('status', 'active');

        // Step 3: Create new membership (or reactivate if exists)
        const membershipData: GymMemberInsert = {
            gym_id: gym.id,
            user_id: user.id,
            status: 'active',
            role: 'member',
            visible_in_leaderboard: true,
            visible_to_other_members: false,
        };

        const { data: membership, error: memberError } = await supabase
            .from('gym_members')
            .upsert(membershipData, {
                onConflict: 'gym_id,user_id',
                ignoreDuplicates: false,
            })
            .select()
            .single();

        if (memberError) {
            console.error('[GymMembership] Failed to upsert membership:', memberError);
            return null;
        }

        console.log('[GymMembership] Joined gym:', gym.name, 'membership:', membership.id);
        return { gym, membership };
    } catch (error) {
        console.error('[GymMembership] Error joining gym:', error);
        return null;
    }
}

/**
 * Deactivates the user's current gym membership.
 * Called when user clears their home gym.
 */
export async function leaveCurrentGym(): Promise<boolean> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.warn('[GymMembership] No authenticated user');
            return false;
        }

        const { error } = await supabase
            .from('gym_members')
            .update({
                status: 'inactive',
                left_at: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .eq('status', 'active');

        if (error) {
            console.error('[GymMembership] Failed to leave gym:', error);
            return false;
        }

        console.log('[GymMembership] Left current gym');
        return true;
    } catch (error) {
        console.error('[GymMembership] Error leaving gym:', error);
        return false;
    }
}

/**
 * Gets the user's current active gym membership.
 */
export async function getCurrentMembership(): Promise<GymMember | null> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('gym_members')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows found - not an error
                return null;
            }
            console.error('[GymMembership] Failed to get membership:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('[GymMembership] Error getting membership:', error);
        return null;
    }
}

/**
 * Records a check-in at the user's gym.
 * Called when user starts a workout at their home gym.
 */
export async function recordGymCheckIn(gymId: string): Promise<boolean> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error } = await supabase.rpc('increment_visits', { p_gym_id: gymId });

        // Fallback: just update last_check_in if RPC doesn't exist
        if (error) {
            await supabase
                .from('gym_members')
                .update({ last_check_in: new Date().toISOString() })
                .eq('user_id', user.id)
                .eq('gym_id', gymId)
                .eq('status', 'active');
        }

        return true;
    } catch (error) {
        console.error('[GymMembership] Error recording check-in:', error);
        return false;
    }
}
