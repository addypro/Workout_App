/**
 * Class Reminders Edge Function
 *
 * Sends reminder notifications to athletes before their class starts.
 * Called by pg_cron every 5 minutes.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClassSession {
    id: string;
    name: string;
    start_at: string;
    reminder_minutes: number;
    coach_id: string;
}

interface ClassParticipant {
    athlete_user_id: string;
    session_id: string;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, serviceKey);

        const now = new Date();

        // Find sessions starting within the next 35 minutes that haven't been reminded
        // We check 35 min because cron runs every 5 min and typical reminder is 30 min
        const thirtyFiveMinFromNow = new Date(now.getTime() + 35 * 60 * 1000);

        const { data: upcomingSessions, error: sessionsError } = await supabase
            .from('class_sessions')
            .select('id, name, start_at, reminder_minutes, coach_id')
            .eq('status', 'scheduled')
            .gte('start_at', now.toISOString())
            .lte('start_at', thirtyFiveMinFromNow.toISOString()) as {
                data: ClassSession[] | null;
                error: any;
            };

        if (sessionsError) {
            console.error('Error fetching sessions:', sessionsError);
            return new Response(JSON.stringify({ error: sessionsError.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (!upcomingSessions || upcomingSessions.length === 0) {
            return new Response(JSON.stringify({ message: 'No upcoming sessions', sent: 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        let totalSent = 0;

        for (const session of upcomingSessions) {
            const startTime = new Date(session.start_at);
            const minutesUntilStart = Math.round((startTime.getTime() - now.getTime()) / 60000);

            // Check if we should send reminder now (within window of reminder_minutes)
            if (minutesUntilStart > session.reminder_minutes || minutesUntilStart < 0) {
                continue;
            }

            // Get participants for this session
            const { data: participants, error: participantsError } = await supabase
                .from('class_participants')
                .select('athlete_user_id, session_id')
                .eq('session_id', session.id)
                .eq('status', 'joined') as { data: ClassParticipant[] | null; error: any };

            if (participantsError || !participants) {
                console.error(`Error fetching participants for session ${session.id}:`, participantsError);
                continue;
            }

            // Send notification to each participant
            for (const participant of participants) {
                // Check if reminder already sent (using a notifications table or flag)
                const { data: existing } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', participant.athlete_user_id)
                    .eq('type', 'class_reminder')
                    .eq('reference_id', session.id)
                    .maybeSingle();

                if (existing) {
                    continue; // Already sent
                }

                // Insert notification
                const { error: notifError } = await supabase.from('notifications').insert({
                    user_id: participant.athlete_user_id,
                    type: 'class_reminder',
                    title: 'Class Starting Soon',
                    body: `${session.name} starts in ${minutesUntilStart} minutes!`,
                    reference_id: session.id,
                    reference_type: 'class_session',
                    data: {
                        session_id: session.id,
                        session_name: session.name,
                        start_at: session.start_at,
                    },
                });

                if (!notifError) {
                    totalSent++;
                }
            }
        }

        return new Response(
            JSON.stringify({
                message: 'Reminders processed',
                sessionsChecked: upcomingSessions.length,
                remindersSent: totalSent,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Error in class-reminders:', error);
        return new Response(JSON.stringify({ error: String(error) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
