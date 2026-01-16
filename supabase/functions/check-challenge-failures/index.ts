// Check Challenge Failures Edge Function
// Runs daily at midnight to check Iron Will style challenges
// Resets challenges where users missed their daily requirements

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChallengeWithTemplate {
    id: string
    user_id: string
    template_id: string
    current_day: number
    metadata: {
        lastActivityDate?: string
        workoutsToday?: number
    }
    challenge_templates: {
        name: string
        duration_days: number | null
        rules: {
            resetOnMiss?: boolean
            workoutsPerDay?: number
        }
    }
}

Deno.serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        const today = new Date().toISOString().split('T')[0]
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

        // Get all active challenges with resetOnMiss rule
        const { data: challenges, error: fetchError } = await supabase
            .from('user_challenges')
            .select(`
        id,
        user_id,
        template_id,
        current_day,
        metadata,
        challenge_templates!inner (
          name,
          duration_days,
          rules
        )
      `)
            .eq('status', 'active')

        if (fetchError) {
            throw fetchError
        }

        const results = {
            processed: 0,
            reset: 0,
            advanced: 0,
            completed: 0,
            errors: 0,
        }

        for (const challenge of (challenges as ChallengeWithTemplate[]) || []) {
            try {
                const template = challenge.challenge_templates
                const rules = template.rules || {}

                // Skip if not a resetOnMiss challenge
                if (!rules.resetOnMiss) {
                    continue
                }

                results.processed++

                const lastActivity = challenge.metadata?.lastActivityDate
                const workoutsLogged = challenge.metadata?.workoutsToday || 0
                const requiredWorkouts = rules.workoutsPerDay || 1

                // Check if yesterday's requirement was met
                const missedYesterday = lastActivity !== yesterday || workoutsLogged < requiredWorkouts

                if (missedYesterday) {
                    // FAIL - Reset to day 1
                    await supabase
                        .from('user_challenges')
                        .update({
                            current_day: 1,
                            metadata: {
                                ...challenge.metadata,
                                workoutsToday: 0,
                                lastActivityDate: null,
                            },
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', challenge.id)

                    results.reset++
                    console.log(`Reset "${template.name}" for user ${challenge.user_id}`)
                } else {
                    // SUCCESS - Increment day
                    const newDay = challenge.current_day + 1

                    // Check if completed
                    if (template.duration_days && newDay > template.duration_days) {
                        await supabase
                            .from('user_challenges')
                            .update({
                                status: 'completed',
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', challenge.id)

                        results.completed++
                        console.log(`Completed "${template.name}" for user ${challenge.user_id}`)
                    } else {
                        await supabase
                            .from('user_challenges')
                            .update({
                                current_day: newDay,
                                metadata: {
                                    ...challenge.metadata,
                                    workoutsToday: 0, // Reset for new day
                                },
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', challenge.id)

                        results.advanced++
                    }
                }
            } catch (err) {
                console.error(`Error processing challenge ${challenge.id}:`, err)
                results.errors++
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                results,
                timestamp: new Date().toISOString(),
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        console.error('Error in check-challenge-failures:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        )
    }
})
