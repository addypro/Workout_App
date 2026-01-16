#!/usr/bin/env node

/**
 * Create Fresh Athletes for Invite Testing
 * 
 * Creates NEW athlete accounts with NO coach relationship,
 * so you can test the full invite flow:
 * 1. Coach creates invite (code or link)
 * 2. Athlete signs up / logs in
 * 3. Athlete enters invite code or clicks link
 * 4. Coach sees new athlete appear
 * 
 * Usage:
 *   node scripts/create-fresh-athletes.mjs
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Fresh athletes - NOT connected to any coach
const FRESH_ATHLETES = [
    {
        email: 'newathlete1@test.workout.app',
        password: 'TestAthlete123!',
        name: 'New Athlete One',
    },
    {
        email: 'newathlete2@test.workout.app',
        password: 'TestAthlete123!',
        name: 'New Athlete Two',
    },
    {
        email: 'newathlete3@test.workout.app',
        password: 'TestAthlete123!',
        name: 'New Athlete Three',
    },
];

async function main() {
    console.log('🆕 Creating Fresh Athletes for Invite Testing');
    console.log('='.repeat(50) + '\n');

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        console.error('❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env');
        process.exit(1);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const athlete of FRESH_ATHLETES) {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: athlete.email,
            password: athlete.password,
            email_confirm: true,
            user_metadata: { role: 'athlete', display_name: athlete.name },
        });

        if (error) {
            if (error.message.includes('already been registered')) {
                console.log(`⚠️  Already exists: ${athlete.email}`);

                // Delete any existing coach relationship for this user
                const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
                const existingUser = users.find(u => u.email === athlete.email);

                if (existingUser) {
                    const { error: deleteError } = await supabaseAdmin
                        .from('coach_athletes')
                        .delete()
                        .eq('athlete_user_id', existingUser.id);

                    if (!deleteError) {
                        console.log(`   🔄 Removed any existing coach relationships`);
                    }
                }
            } else {
                console.error(`❌ Error: ${athlete.email} - ${error.message}`);
            }
        } else {
            console.log(`✅ Created: ${data.user.email}`);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ FRESH ATHLETES READY!');
    console.log('='.repeat(50));
    console.log('\nThese accounts are NOT connected to any coach:\n');

    FRESH_ATHLETES.forEach((a, i) => {
        console.log(`Athlete ${i + 1}: ${a.email}`);
        console.log(`           Password: ${a.password}\n`);
    });

    console.log('Test Flow:');
    console.log('──────────────────────────────────────────────────');
    console.log('1. Log in as coach (coach@test.workout.app)');
    console.log('2. Go to "Invite Athletes" → Create a code OR link');
    console.log('3. Log out');
    console.log('4. Log in as newathlete1@test.workout.app');
    console.log('5. Enter the invite code (or click the link)');
    console.log('6. Log back in as coach → See new athlete appear!');
    console.log('');
}

main();
