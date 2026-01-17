/**
 * Class Auto-Complete Edge Function
 *
 * Auto-completes pending workout logs after 24 hours.
 * Creates workout logs for checked-in athletes when class ends.
 * Called by pg_cron every hour.
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
    status: string;
    exercises_json: any[];
}

interface ClassCheckin {
    athlete_user_id: string;
    session_id: string;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, serviceKey);

        const now = new Date();
        let logsCreated = 0;
        let logsAutoCompleted = 0;

        // ========================================
        // 1. Create logs for recently ended classes
        // ========================================

        // Find sessions that ended 1-2 hours ago and are still "in_progress"
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

        const { data: endedSessions, error: endedError } = await supabase
            .from('class_sessions')
            .select('id, name, start_at, status, exercises_json')
            .eq('status', 'in_progress')
            .lte('start_at', twoHoursAgo.toISOString()) as {
                data: ClassSession[] | null;
                error: any;
            };

        if (endedError) {
            console.error('Error fetching ended sessions:', endedError);
        } else if (endedSessions) {
            for (const session of endedSessions) {
                // Mark session as completed
                await supabase
                    .from('class_sessions')
                    .update({ status: 'completed' })
                    .eq('id', session.id);

                // Get checked-in athletes
                const { data: checkins } = await supabase
                    .from('class_checkins')
                    .select('athlete_user_id, session_id')
                    .eq('session_id', session.id) as { data: ClassCheckin[] | null; error: any };

                if (!checkins) continue;

                for (const checkin of checkins) {
                    // Check if log already exists
                    const { data: existingLog } = await supabase
                        .from('class_workout_logs')
                        .select('id')
                        .eq('session_id', session.id)
                        .eq('athlete_user_id', checkin.athlete_user_id)
                        .maybeSingle();

                    if (existingLog) continue;

                    // Create workout log
                    const { error: insertError } = await supabase
                        .from('class_workout_logs')
                        .insert({
                            session_id: session.id,
                            athlete_user_id: checkin.athlete_user_id,
                            exercises_json: session.exercises_json || [],
                            status: 'pending_review',
                        });

                    if (!insertError) {
                        logsCreated++;

                        // Send notification to review
                        await supabase.from('notifications').insert({
                            user_id: checkin.athlete_user_id,
                            type: 'class_review_needed',
                            title: 'Review Your Workout',
                            body: `Your ${session.name} class workout is ready for review.`,
                            reference_id: session.id,
                            reference_type: 'class_session',
                        });
                    }
                }
            }
        }

        // ========================================
        // 2. Auto-complete logs older than 24 hours
        // ========================================

        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const { data: pendingLogs, error: pendingError } = await supabase
            .from('class_workout_logs')
            .select('id, session_id')
            .eq('status', 'pending_review')
            .lte('created_at', twentyFourHoursAgo.toISOString());

        if (pendingError) {
            console.error('Error fetching pending logs:', pendingError);
        } else if (pendingLogs) {
            for (const log of pendingLogs) {
                const { error: updateError } = await supabase
                    .from('class_workout_logs')
                    .update({
                        status: 'auto_completed',
                        auto_completed_at: now.toISOString(),
                    })
                    .eq('id', log.id);

                if (!updateError) {
                    logsAutoCompleted++;
                }
            }
        }

        return new Response(
            JSON.stringify({
                message: 'Auto-complete processed',
                logsCreated,
                logsAutoCompleted,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Error in class-auto-complete:', error);
        return new Response(JSON.stringify({ error: String(error) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
