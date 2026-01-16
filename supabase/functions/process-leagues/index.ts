// Process Leagues Edge Function
// Runs weekly (Sunday midnight) to calculate rankings and promotions/demotions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TierConfig {
    id: number
    name: string
    promotion_percent: number
    demotion_percent: number
}

interface Standing {
    id: string
    user_id: string
    tier_id: number
    xp: number
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

        // Get current active period
        const { data: currentPeriod, error: periodError } = await supabase
            .from('league_periods')
            .select('id')
            .eq('status', 'active')
            .order('start_date', { ascending: false })
            .limit(1)
            .single()

        if (periodError || !currentPeriod) {
            return new Response(
                JSON.stringify({ success: false, error: 'No active period found' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // Get all tiers
        const { data: tiers, error: tiersError } = await supabase
            .from('league_tiers')
            .select('*')
            .order('rank_order')

        if (tiersError || !tiers) {
            throw tiersError
        }

        const tierMap = new Map<number, TierConfig>(tiers.map(t => [t.id, t]))

        const results = {
            processed: 0,
            promoted: 0,
            demoted: 0,
            retained: 0,
        }

        // Process each tier
        for (const tier of tiers as TierConfig[]) {
            // Get all standings in this tier, ordered by XP
            const { data: standings, error: standingsError } = await supabase
                .from('league_standings')
                .select('id, user_id, tier_id, xp')
                .eq('period_id', currentPeriod.id)
                .eq('tier_id', tier.id)
                .order('xp', { ascending: false })

            if (standingsError || !standings) {
                console.error(`Error getting standings for tier ${tier.name}:`, standingsError)
                continue
            }

            const cohortSize = standings.length
            if (cohortSize === 0) continue

            const promotionCutoff = Math.ceil(cohortSize * tier.promotion_percent)
            const demotionStart = cohortSize - Math.floor(cohortSize * tier.demotion_percent)

            for (let i = 0; i < standings.length; i++) {
                const standing = standings[i] as Standing
                const rank = i + 1
                let status: 'promoted' | 'demoted' | 'retained' = 'retained'
                let newTierId = tier.id

                // Check promotion (only if not Legend)
                if (rank <= promotionCutoff && tier.id < 8) {
                    status = 'promoted'
                    newTierId = tier.id + 1
                    results.promoted++
                }
                // Check demotion (only if not Wood)
                else if (rank > demotionStart && tier.id > 1) {
                    status = 'demoted'
                    newTierId = tier.id - 1
                    results.demoted++
                } else {
                    results.retained++
                }

                // Update standing with rank and promotion status
                await supabase
                    .from('league_standings')
                    .update({
                        rank,
                        promotion_status: status,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', standing.id)

                results.processed++
            }
        }

        // Mark current period as completed
        await supabase
            .from('league_periods')
            .update({ status: 'completed' })
            .eq('id', currentPeriod.id)

        // Create new period for next week
        const nextMonday = getNextMonday()
        const nextSunday = new Date(nextMonday)
        nextSunday.setDate(nextSunday.getDate() + 6)

        const { data: newPeriod, error: newPeriodError } = await supabase
            .from('league_periods')
            .insert({
                start_date: nextMonday.toISOString().split('T')[0],
                end_date: nextSunday.toISOString().split('T')[0],
                status: 'active',
            })
            .select()
            .single()

        if (newPeriodError) {
            console.error('Error creating new period:', newPeriodError)
        }

        // Migrate users to new period with updated tiers
        if (newPeriod) {
            const { data: oldStandings } = await supabase
                .from('league_standings')
                .select('user_id, tier_id, promotion_status')
                .eq('period_id', currentPeriod.id)

            for (const old of oldStandings || []) {
                let newTier = old.tier_id
                if (old.promotion_status === 'promoted') newTier = Math.min(8, old.tier_id + 1)
                if (old.promotion_status === 'demoted') newTier = Math.max(1, old.tier_id - 1)

                await supabase
                    .from('league_standings')
                    .insert({
                        period_id: newPeriod.id,
                        user_id: old.user_id,
                        tier_id: newTier,
                        xp: 0, // Reset XP for new week
                    })
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                results,
                newPeriodId: newPeriod?.id,
                timestamp: new Date().toISOString(),
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        console.error('Error in process-leagues:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        )
    }
})

function getNextMonday(): Date {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
    const nextMonday = new Date(today)
    nextMonday.setDate(today.getDate() + daysUntilMonday)
    nextMonday.setHours(0, 0, 0, 0)
    return nextMonday
}
