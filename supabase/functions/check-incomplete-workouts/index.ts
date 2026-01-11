/**
 * Check Incomplete Workouts Edge Function
 *
 * Scheduled function to check for workouts that weren't completed.
 * Should be triggered via pg_cron or external scheduler (e.g., daily at 9pm).
 *
 * Finds workouts from yesterday that are still pending and sends notifications
 * to both the athlete (encouragement) and coach (alert).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================
// TYPES
// ============================================

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
// EXPO PUSH
// ============================================

async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
    if (messages.length === 0) return;

    // Batch in groups of 100 (Expo limit)
    const batches: ExpoPushMessage[][] = [];
    for (let i = 0; i < messages.length; i += 100) {
        batches.push(messages.slice(i, i + 100));
    }

    for (const batch of batches) {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(batch),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Expo push error:', error);
        }
    }
}

// ============================================
// HELPER: Get yesterday's date
// ============================================

function getYesterdayDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
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
        // Get optional parameters from request body
        const body = await req.json().catch(() => ({}));
        const targetDate = body.date || getYesterdayDate();

        console.log(`Checking incomplete workouts for date: ${targetDate}`);

        // Initialize Supabase client with service role
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Find all workouts from target date that are still pending (not completed/skipped)
        const { data: incompleteWorkouts, error: workoutError } = await supabase
            .from('assigned_workouts')
            .select(`
        id,
        athlete_user_id,
        workout_name,
        scheduled_date,
        program_assignments!inner (
          coach_id,
          coach_profiles!inner (
            user_id,
            display_name
          )
        )
      `)
            .eq('scheduled_date', targetDate)
            .eq('status', 'pending')
            .eq('incomplete_notification_sent', false);

        if (workoutError) {
            console.error('Error fetching incomplete workouts:', workoutError);
            throw workoutError;
        }

        if (!incompleteWorkouts || incompleteWorkouts.length === 0) {
            console.log('No incomplete workouts found');
            return new Response(
                JSON.stringify({ success: true, notificationsSent: 0, message: 'No incomplete workouts' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`Found ${incompleteWorkouts.length} incomplete workouts`);

        // Collect all user IDs (athletes + coaches)
        const allUserIds = new Set<string>();
        const athleteUserIds = new Set<string>();
        const coachUserIds = new Set<string>();

        for (const workout of incompleteWorkouts) {
            athleteUserIds.add(workout.athlete_user_id);
            allUserIds.add(workout.athlete_user_id);

            const coachUserId = (workout as any).program_assignments?.coach_profiles?.user_id;
            if (coachUserId) {
                coachUserIds.add(coachUserId);
                allUserIds.add(coachUserId);
            }
        }

        // Get push tokens for all users
        const { data: tokens, error: tokenError } = await supabase
            .from('user_push_tokens')
            .select('user_id, push_token')
            .in('user_id', [...allUserIds]);

        if (tokenError) {
            console.error('Error fetching push tokens:', tokenError);
            throw tokenError;
        }

        // Build token map
        const tokenMap = new Map<string, string[]>();
        for (const t of tokens || []) {
            if (!tokenMap.has(t.user_id)) {
                tokenMap.set(t.user_id, []);
            }
            tokenMap.get(t.user_id)!.push(t.push_token);
        }

        // Get athlete names for coach notifications
        const { data: athleteProfiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', [...athleteUserIds]);

        const athleteNameMap = new Map<string, string>();
        for (const p of athleteProfiles || []) {
            athleteNameMap.set(p.id, p.display_name || 'Athlete');
        }

        // Build notification messages
        const messages: ExpoPushMessage[] = [];
        const workoutIds: string[] = [];

        for (const workout of incompleteWorkouts) {
            // Athlete notification (encouraging)
            const athleteTokens = tokenMap.get(workout.athlete_user_id);
            if (athleteTokens && athleteTokens.length > 0) {
                for (const token of athleteTokens) {
                    messages.push({
                        to: token,
                        sound: 'default',
                        title: '💪 Missed Workout',
                        body: `You missed "${workout.workout_name}" yesterday. Ready to catch up today?`,
                        data: {
                            type: 'workout_missed',
                            workoutId: workout.id,
                        },
                    });
                }
            }

            // Coach notification (informational)
            const coachUserId = (workout as any).program_assignments?.coach_profiles?.user_id;
            const coachTokens = coachUserId ? tokenMap.get(coachUserId) : null;
            if (coachTokens && coachTokens.length > 0) {
                const athleteName = athleteNameMap.get(workout.athlete_user_id) || 'An athlete';
                for (const token of coachTokens) {
                    messages.push({
                        to: token,
                        sound: null, // Silent for coach (less urgent)
                        title: '📋 Workout Incomplete',
                        body: `${athleteName} didn't complete "${workout.workout_name}" yesterday`,
                        data: {
                            type: 'athlete_workout_incomplete',
                            workoutId: workout.id,
                            athleteUserId: workout.athlete_user_id,
                        },
                    });
                }
            }

            workoutIds.push(workout.id);
        }

        // Send notifications
        if (messages.length > 0) {
            await sendExpoPush(messages);
            console.log(`Sent ${messages.length} incomplete workout notifications`);
        }

        // Mark workouts as notified
        if (workoutIds.length > 0) {
            const { error: updateError } = await supabase
                .from('assigned_workouts')
                .update({ incomplete_notification_sent: true })
                .in('id', workoutIds);

            if (updateError) {
                console.error('Error updating incomplete_notification_sent:', updateError);
            } else {
                console.log(`Marked ${workoutIds.length} workouts as notified`);
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                notificationsSent: messages.length,
                workoutsProcessed: workoutIds.length,
                athleteNotifications: [...athleteUserIds].length,
                coachNotifications: [...coachUserIds].length,
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
