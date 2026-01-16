// Simulate Ghost Users Edge Function
// Runs hourly to generate fake activity for bot users in leagues
// Prevents empty league states for new apps

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Ghost profiles with target XP per week
const GHOST_PROFILES = [
    // Bronze tier pacers (300 XP/week)
    { namePattern: 'FitnessFan', tier: 3, xpPerWeek: 300 },
    { namePattern: 'GymNewbie', tier: 3, xpPerWeek: 280 },
    { namePattern: 'IronStarter', tier: 3, xpPerWeek: 320 },

    // Silver tier pacers (500 XP/week)
    { namePattern: 'ConsistentCarl', tier: 4, xpPerWeek: 500 },
    { namePattern: 'SteadySarah', tier: 4, xpPerWeek: 480 },
    { namePattern: 'RegularRyan', tier: 4, xpPerWeek: 520 },

    // Gold tier pacers (800 XP/week)
    { namePattern: 'GrinderGary', tier: 5, xpPerWeek: 800 },
    { namePattern: 'PowerPete', tier: 5, xpPerWeek: 750 },
    { namePattern: 'StrongSteve', tier: 5, xpPerWeek: 850 },

    // Crystal tier pacers (1200 XP/week)
    { namePattern: 'EliteEmma', tier: 6, xpPerWeek: 1200 },
    { namePattern: 'ChampChris', tier: 6, xpPerWeek: 1150 },
]

Deno.serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Check if ghost users are enabled
        const ghostsEnabled = Deno.env.get('GHOST_USERS_ENABLED') === 'true'
        if (!ghostsEnabled) {
            return new Response(
                JSON.stringify({ success: true, message: 'Ghost users disabled' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Get all ghost users
        const { data: ghosts, error: ghostError } = await supabase
            .from('profiles')
            .select('id, display_name, raw_user_meta_data')
            .eq('raw_user_meta_data->>is_bot', 'true')

        if (ghostError) {
            console.log('No ghost users found, using profile-based detection')
        }

        // Get current active period
        const { data: period, error: periodError } = await supabase
            .from('league_periods')
            .select('id')
            .eq('status', 'active')
            .order('start_date', { ascending: false })
            .limit(1)
            .single()

        if (periodError || !period) {
            return new Response(
                JSON.stringify({ success: false, error: 'No active period' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        const results = {
            processed: 0,
            xpAdded: 0,
        }

        // Get ghost standings
        const { data: ghostStandings, error: standingsError } = await supabase
            .from('league_standings')
            .select('id, user_id, tier_id, xp')
            .eq('period_id', period.id)
            .in('user_id', (ghosts || []).map(g => g.id))

        if (standingsError || !ghostStandings) {
            console.log('No ghost standings found')
        }

        // For each ghost, randomly add XP (20% chance per hour)
        for (const standing of ghostStandings || []) {
            // Find matching profile for XP rate
            const profile = GHOST_PROFILES.find(p => p.tier === standing.tier_id) || GHOST_PROFILES[0]

            // 20% chance to add XP this hour
            if (Math.random() > 0.8) {
                // Calculate hourly XP (weekly / 168 hours)
                const baseXpPerHour = profile.xpPerWeek / 168
                // Add some variance (80-120%)
                const variance = 0.8 + Math.random() * 0.4
                const xpGain = Math.round(baseXpPerHour * variance)

                await supabase
                    .from('league_standings')
                    .update({
                        xp: standing.xp + xpGain,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', standing.id)

                results.processed++
                results.xpAdded += xpGain
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
        console.error('Error in simulate-ghosts:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        )
    }
})
