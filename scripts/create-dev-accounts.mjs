#!/usr/bin/env node

/**
 * Create Test Accounts for Dev Mode
 * 
 * Creates a coach and athlete account in Supabase for development testing.
 * These accounts have REAL sessions, unlike the mock devModeLogin.
 * 
 * Usage:
 *   node scripts/create-dev-accounts.mjs
 * 
 * Then use these credentials in the app's Dev Mode buttons or login screen.
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Dev accounts - for testing coach and athlete flows
const DEV_ACCOUNTS = [
    {
        email: 'coach@test.workout.app',
        password: 'TestCoach123!',
        name: 'Test Coach',
        role: 'coach',
    },
    {
        email: 'athlete@test.workout.app',
        password: 'TestAthlete123!',
        name: 'Test Athlete',
        role: 'athlete',
    },
];

async function main() {
    console.log('🔧 Creating Dev Test Accounts');
    console.log('='.repeat(50) + '\n');

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        console.error('❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env');
        console.log('\nMake sure you have these in your .env file:');
        console.log('  EXPO_PUBLIC_SUPABASE_URL=your-project-url');
        console.log('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
        process.exit(1);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const account of DEV_ACCOUNTS) {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: account.email,
            password: account.password,
            email_confirm: true, // Skip email confirmation
            user_metadata: {
                role: account.role,
                display_name: account.name,
                name: account.name,
            },
        });

        if (error) {
            if (error.message.includes('already been registered')) {
                console.log(`⚠️  Already exists: ${account.email} (${account.role})`);
            } else {
                console.error(`❌ Error: ${account.email} - ${error.message}`);
            }
        } else {
            console.log(`✅ Created: ${data.user.email} (${account.role})`);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ DEV ACCOUNTS READY!');
    console.log('='.repeat(50));
    console.log('\nUse these credentials to test with real Supabase sessions:\n');

    DEV_ACCOUNTS.forEach((a) => {
        console.log(`${a.role.toUpperCase()}:`);
        console.log(`  Email:    ${a.email}`);
        console.log(`  Password: ${a.password}\n`);
    });

    console.log('How to Use:');
    console.log('──────────────────────────────────────────────────');
    console.log('1. In the app, go to Login screen');
    console.log('2. Enter email and password above');
    console.log('3. You\'ll have a REAL Supabase session');
    console.log('4. All database queries will work!');
    console.log('');
}

main();
