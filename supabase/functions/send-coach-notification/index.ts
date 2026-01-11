/**
 * Send Coach Notification Edge Function
 *
 * Sends push notifications to coaches when their athletes interact with workouts.
 * Called from the client after workout start/complete actions.
 *
 * Uses Expo Push Notification Service.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================
// TYPES
// ============================================

interface NotificationRequest {
    type: 'workout_started' | 'workout_completed';
    athleteUserId: string;
    athleteName: string;
    workoutId: string;
    workoutName: string;
    programName?: string;
    // For completed workouts
    durationMinutes?: number;
    exerciseCount?: number;
    totalSets?: number;
    prs?: Array<{
        exerciseName: string;
        prType: string;
        previousValue: number;
        newValue: number;
    }>;
    athleteRating?: number;
}

interface ExpoPushMessage {
    to: string;
    sound: 'default' | null;
    title: string;
    body: string;
    data?: Record<string, unknown>;
}

// ============================================
// CORS HEADERS
// ============================================

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// NOTIFICATION FORMATTING
// ============================================

function formatNotification(payload: NotificationRequest): { title: string; body: string } {
    if (payload.type === 'workout_started') {
        return {
            title: '🏋️ Workout Started',
            body: `${payload.athleteName} started ${payload.workoutName}`,
        };
    }

    // workout_completed
    const prText = payload.prs && payload.prs.length > 0
        ? ` - ${payload.prs.length} PR${payload.prs.length > 1 ? 's' : ''}!`
        : '';

    const durationText = payload.durationMinutes ? ` (${payload.durationMinutes}min)` : '';

    return {
        title: '✅ Workout Completed',
        body: `${payload.athleteName} finished ${payload.workoutName}${prText}${durationText}`,
    };
}

// ============================================
// EXPO PUSH
// ============================================

async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
    if (messages.length === 0) return;

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Expo push error:', error);
        throw new Error(`Expo push failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('Expo push result:', result);
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const payload: NotificationRequest = await req.json();

        console.log('Notification request:', payload.type, 'for athlete:', payload.athleteUserId);

        // Initialize Supabase client with service role
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Find the coach(es) for this athlete
        const { data: coachRelations, error: relationError } = await supabase
            .from('coach_athletes')
            .select('coach_id')
            .eq('athlete_user_id', payload.athleteUserId)
            .eq('status', 'active');

        if (relationError) {
            console.error('Error finding coach relations:', relationError);
            throw relationError;
        }

        if (!coachRelations || coachRelations.length === 0) {
            console.log('No active coach relations found');
            return new Response(
                JSON.stringify({ success: true, message: 'No coaches to notify' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get coach user IDs from coach profiles
        const coachIds = coachRelations.map(r => r.coach_id);
        const { data: coachProfiles, error: profileError } = await supabase
            .from('coach_profiles')
            .select('user_id')
            .in('id', coachIds);

        if (profileError) {
            console.error('Error finding coach profiles:', profileError);
            throw profileError;
        }

        const coachUserIds = coachProfiles?.map(p => p.user_id) || [];

        if (coachUserIds.length === 0) {
            console.log('No coach user IDs found');
            return new Response(
                JSON.stringify({ success: true, message: 'No coaches to notify' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get push tokens for coaches
        const { data: tokens, error: tokenError } = await supabase
            .from('user_push_tokens')
            .select('push_token')
            .in('user_id', coachUserIds);

        if (tokenError) {
            console.error('Error finding push tokens:', tokenError);
            throw tokenError;
        }

        if (!tokens || tokens.length === 0) {
            console.log('No push tokens found for coaches');
            return new Response(
                JSON.stringify({ success: true, message: 'No push tokens registered' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Format notification
        const { title, body } = formatNotification(payload);

        // Build messages for each token
        const messages: ExpoPushMessage[] = tokens.map(t => ({
            to: t.push_token,
            sound: 'default',
            title,
            body,
            data: {
                type: payload.type,
                workoutId: payload.workoutId,
                athleteUserId: payload.athleteUserId,
                prs: payload.prs,
            },
        }));

        // Send notifications
        await sendExpoPush(messages);

        console.log(`Sent ${messages.length} notifications`);

        return new Response(
            JSON.stringify({
                success: true,
                notificationsSent: messages.length,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
