/**
 * Test script to verify coach feature database schema
 * Run with: node scripts/test-coach-schema.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dahuiaqdbaenlsiniykx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhaHVpYXFkYmFlbmxzaW5peWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMjcwMDQsImV4cCI6MjA4MDkwMzAwNH0.I-I773D0fcyHQCI80warLU3kQJjVOdqsCSCzyszagZw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSchema() {
  console.log('\n🧪 Testing Coach Feature Database Schema\n');
  console.log('='.repeat(50));

  const tables = [
    'coach_profiles',
    'coach_athletes',
    'coach_invites',
    'coach_programs',
    'program_assignments',
    'assigned_workouts',
    'coach_exercises',
  ];

  let passed = 0;
  let failed = 0;

  for (const table of tables) {
    try {
      // Try to select from the table (will fail with RLS but confirms table exists)
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error && !error.message.includes('no rows')) {
        // RLS errors are expected for unauthenticated requests
        if (error.code === 'PGRST301' || error.message.includes('JWTExpired') ||
            error.message.includes('permission denied') || error.code === '42501') {
          console.log(`✅ ${table} - exists (RLS active)`);
          passed++;
        } else {
          console.log(`❌ ${table} - error: ${error.message}`);
          failed++;
        }
      } else {
        console.log(`✅ ${table} - exists (${data?.length || 0} rows visible)`);
        passed++;
      }
    } catch (err) {
      console.log(`❌ ${table} - error: ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));

  // Test views
  console.log('\n📊 Testing Views:\n');
  const views = ['coach_dashboard', 'athlete_coaches'];

  for (const view of views) {
    try {
      const { error } = await supabase
        .from(view)
        .select('*')
        .limit(1);

      if (error && (error.code === 'PGRST301' || error.code === '42501' ||
                    error.message.includes('permission'))) {
        console.log(`✅ ${view} - exists (RLS active)`);
        passed++;
      } else if (error) {
        console.log(`❌ ${view} - error: ${error.message}`);
        failed++;
      } else {
        console.log(`✅ ${view} - exists`);
        passed++;
      }
    } catch (err) {
      console.log(`❌ ${view} - error: ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));

  // Test functions
  console.log('\n⚙️  Testing Functions:\n');

  try {
    const { data, error } = await supabase.rpc('generate_invite_code');
    if (error && (error.code === '42501' || error.message.includes('permission'))) {
      console.log('✅ generate_invite_code() - exists (requires auth)');
      passed++;
    } else if (error) {
      console.log(`❌ generate_invite_code() - error: ${error.message}`);
      failed++;
    } else {
      console.log(`✅ generate_invite_code() - works! Generated: ${data}`);
      passed++;
    }
  } catch (err) {
    console.log(`❌ generate_invite_code() - error: ${err.message}`);
    failed++;
  }

  try {
    const { error } = await supabase.rpc('accept_coach_invite', {
      p_invite_code: 'TESTCODE',
      p_share_history: false,
      p_share_metrics: false
    });
    if (error && (error.code === '42501' || error.message.includes('permission') ||
                  error.message.includes('Invalid or expired'))) {
      console.log('✅ accept_coach_invite() - exists (requires auth/valid code)');
      passed++;
    } else if (error) {
      console.log(`❌ accept_coach_invite() - error: ${error.message}`);
      failed++;
    } else {
      console.log('✅ accept_coach_invite() - exists');
      passed++;
    }
  } catch (err) {
    console.log(`❌ accept_coach_invite() - error: ${err.message}`);
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`\n📋 Summary: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('\n🎉 All coach feature schema components verified!\n');
  } else {
    console.log('\n⚠️  Some components need attention.\n');
  }

  return failed === 0;
}

testSchema()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
