/**
 * Send Workout Reminders Edge Function
 *
 * Scheduled function to send workout reminder notifications to athletes.
 * Should be triggered via pg_cron or external scheduler (e.g., daily at 8am).
 *
 * Finds all pending workouts for today and sends reminders to athletes.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================
// TYPES
// ============================================

interface WorkoutReminder {
    id: string;
    athlete_user_id: string;
    workout_name: string;
    scheduled_date: string;
    scheduled_time: string | null;
    coach_name: string;
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
// FORMAT TIME
// ============================================

function formatScheduledTime(time: string | null): string {
    if (!time) return '';
    try {
        const date = new Date(time);
        return ` at ${date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        })}`;
    } catch {
        return '';
    }
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
        const targetDate = body.date || new Date().toISOString().split('T')[0];

        console.log(`Processing workout reminders for date: ${targetDate}`);

        // Initialize Supabase client with service role
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Find all pending workouts for today that haven't been reminded
        const { data: workouts, error: workoutError } = await supabase
            .from('assigned_workouts')
            .select(`
        id,
        athlete_user_id,
        workout_name,
        scheduled_date,
        scheduled_time,
        program_assignments!inner (
          coach_profiles!inner (
            display_name
          )
        )
      `)
            .eq('scheduled_date', targetDate)
            .eq('status', 'pending')
            .eq('reminder_sent', false);

        if (workoutError) {
            console.error('Error fetching workouts:', workoutError);
            throw workoutError;
        }

        if (!workouts || workouts.length === 0) {
            console.log('No workouts need reminders');
            return new Response(
                JSON.stringify({ success: true, remindersSent: 0, message: 'No workouts need reminders' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`Found ${workouts.length} workouts needing reminders`);

        // Get athlete user IDs
        const athleteUserIds = [...new Set(workouts.map(w => w.athlete_user_id))];

        // Get push tokens for athletes
        const { data: tokens, error: tokenError } = await supabase
            .from('user_push_tokens')
            .select('user_id, push_token')
            .in('user_id', athleteUserIds);

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

        // Build notification messages
        const messages: ExpoPushMessage[] = [];
        const workoutIds: string[] = [];

        for (const workout of workouts) {
            const athleteTokens = tokenMap.get(workout.athlete_user_id);
            if (!athleteTokens || athleteTokens.length === 0) {
                console.log(`No push token for athlete ${workout.athlete_user_id}`);
                continue;
            }

            const coachName =
                (workout as any).program_assignments?.coach_profiles?.display_name || 'Your coach';
            const timeStr = formatScheduledTime(workout.scheduled_time);

            for (const token of athleteTokens) {
                messages.push({
                    to: token,
                    sound: 'default',
                    title: '🏋️ Workout Reminder',
                    body: `${workout.workout_name}${timeStr} - assigned by ${coachName}`,
                    data: {
                        type: 'workout_reminder',
                        workoutId: workout.id,
                    },
                });
            }

            workoutIds.push(workout.id);
        }

        // Send notifications
        if (messages.length > 0) {
            await sendExpoPush(messages);
            console.log(`Sent ${messages.length} reminder notifications`);
        }

        // Mark workouts as reminded
        if (workoutIds.length > 0) {
            const { error: updateError } = await supabase
                .from('assigned_workouts')
                .update({ reminder_sent: true })
                .in('id', workoutIds);

            if (updateError) {
                console.error('Error updating reminder_sent:', updateError);
            } else {
                console.log(`Marked ${workoutIds.length} workouts as reminded`);
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                remindersSent: messages.length,
                workoutsProcessed: workoutIds.length,
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
