#!/usr/bin/env node

/**
 * Seed Coach Test Data
 *
 * Creates test data for coach workflow testing:
 * - Test athlete accounts
 * - Coach-athlete relationships
 * - Sample invite codes
 * - Test programs with assignments
 *
 * Usage:
 *   node scripts/seed-coach-test-data.mjs
 *
 * Requirements:
 *   - SUPABASE_SERVICE_ROLE_KEY in .env (for admin operations)
 *   - OR use Supabase dashboard for manual user creation
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import 'dotenv/config';

// ============================================
// CONFIGURATION
// ============================================

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Test athlete data
const TEST_ATHLETES = [
  {
    email: 'athlete1@test.workout.app',
    password: 'TestAthlete123!',
    name: 'Alex Runner',
    metadata: { role: 'athlete', display_name: 'Alex Runner' }
  },
  {
    email: 'athlete2@test.workout.app',
    password: 'TestAthlete123!',
    name: 'Sam Lifter',
    metadata: { role: 'athlete', display_name: 'Sam Lifter' }
  },
  {
    email: 'athlete3@test.workout.app',
    password: 'TestAthlete123!',
    name: 'Jordan Strong',
    metadata: { role: 'athlete', display_name: 'Jordan Strong' }
  },
  {
    email: 'athlete4@test.workout.app',
    password: 'TestAthlete123!',
    name: 'Taylor Fitness',
    metadata: { role: 'athlete', display_name: 'Taylor Fitness' }
  },
  {
    email: 'athlete5@test.workout.app',
    password: 'TestAthlete123!',
    name: 'Morgan Power',
    metadata: { role: 'athlete', display_name: 'Morgan Power' }
  },
];

// Test coach data (to associate athletes with)
const TEST_COACH = {
  email: 'coach@test.workout.app',
  password: 'TestCoach123!',
  name: 'Coach Mike',
  metadata: { role: 'coach', display_name: 'Coach Mike' }
};

// Sample program template
const SAMPLE_PROGRAM = {
  name: 'Beginner Strength Program',
  description: 'A 4-week program designed for beginners focusing on compound movements and building a strength foundation.',
  duration_weeks: 4,
  days_per_week: 3,
  difficulty: 'beginner',
  category: 'strength',
  is_public: false,
  is_template: true,
  workouts: [
    {
      dayNumber: 1,
      name: 'Day 1: Upper Body A',
      exercises: [
        { name: 'Bench Press (Barbell)', sets: 3, reps: '8-10', rest: 90 },
        { name: 'Row (Barbell)', sets: 3, reps: '8-10', rest: 90 },
        { name: 'Overhead Press (Dumbbell)', sets: 3, reps: '10-12', rest: 60 },
        { name: 'Curl (Dumbbell)', sets: 2, reps: '12-15', rest: 45 },
        { name: 'Tricep Pushdown (Cable)', sets: 2, reps: '12-15', rest: 45 },
      ]
    },
    {
      dayNumber: 2,
      name: 'Day 2: Lower Body',
      exercises: [
        { name: 'Squat (Barbell)', sets: 3, reps: '8-10', rest: 120 },
        { name: 'Romanian Deadlift (Barbell)', sets: 3, reps: '10-12', rest: 90 },
        { name: 'Leg Press (Machine)', sets: 3, reps: '10-12', rest: 90 },
        { name: 'Leg Curl (Machine)', sets: 2, reps: '12-15', rest: 45 },
        { name: 'Calf Raise (Standing)', sets: 3, reps: '15-20', rest: 30 },
      ]
    },
    {
      dayNumber: 3,
      name: 'Day 3: Upper Body B',
      exercises: [
        { name: 'Pull-Up (Bodyweight)', sets: 3, reps: '6-8', rest: 90 },
        { name: 'Incline Press (Dumbbell)', sets: 3, reps: '8-10', rest: 90 },
        { name: 'Lateral Raise (Dumbbell)', sets: 3, reps: '12-15', rest: 45 },
        { name: 'Face Pull (Cable)', sets: 3, reps: '15-20', rest: 45 },
        { name: 'Plank (Bodyweight)', sets: 3, reps: '30-45s', rest: 30 },
      ]
    },
  ]
};

// ============================================
// HELPERS
// ============================================

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateLinkToken() {
  return randomUUID().replace(/-/g, '');
}

// ============================================
// MAIN SEEDING FUNCTIONS
// ============================================

async function seedWithServiceRole(supabaseAdmin) {
  console.log('\n🔐 Using Service Role Key for admin operations...\n');

  const createdUsers = [];

  // Create test coach
  console.log('📝 Creating test coach...');
  const { data: coachData, error: coachError } = await supabaseAdmin.auth.admin.createUser({
    email: TEST_COACH.email,
    password: TEST_COACH.password,
    email_confirm: true,
    user_metadata: TEST_COACH.metadata,
  });

  if (coachError) {
    if (coachError.message.includes('already been registered')) {
      console.log(`   ⚠️  Coach already exists: ${TEST_COACH.email}`);
      // Get existing user
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const existingCoach = users.find(u => u.email === TEST_COACH.email);
      if (existingCoach) createdUsers.push({ ...TEST_COACH, id: existingCoach.id, isCoach: true });
    } else {
      console.error(`   ❌ Error creating coach: ${coachError.message}`);
    }
  } else {
    console.log(`   ✅ Coach created: ${coachData.user.email} (${coachData.user.id})`);
    createdUsers.push({ ...TEST_COACH, id: coachData.user.id, isCoach: true });
  }

  // Create test athletes
  console.log('\n📝 Creating test athletes...');
  for (const athlete of TEST_ATHLETES) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: athlete.email,
      password: athlete.password,
      email_confirm: true,
      user_metadata: athlete.metadata,
    });

    if (error) {
      if (error.message.includes('already been registered')) {
        console.log(`   ⚠️  Already exists: ${athlete.email}`);
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users.find(u => u.email === athlete.email);
        if (existingUser) createdUsers.push({ ...athlete, id: existingUser.id });
      } else {
        console.error(`   ❌ Error: ${athlete.email} - ${error.message}`);
      }
    } else {
      console.log(`   ✅ Created: ${data.user.email} (${data.user.id})`);
      createdUsers.push({ ...athlete, id: data.user.id });
    }
  }

  return createdUsers;
}

async function createCoachProfile(supabase, coachUserId) {
  console.log('\n📋 Creating coach profile...');

  const { data: existing } = await supabase
    .from('coach_profiles')
    .select('id')
    .eq('user_id', coachUserId)
    .single();

  if (existing) {
    console.log(`   ⚠️  Coach profile already exists: ${existing.id}`);
    return existing.id;
  }

  const { data, error } = await supabase
    .from('coach_profiles')
    .insert({
      user_id: coachUserId,
      display_name: 'Coach Mike',
      business_name: 'Test Fitness Coaching',
      bio: 'Experienced fitness coach helping athletes reach their goals.',
      specializations: ['strength', 'hypertrophy', 'athletic-performance'],
      subscription_tier: 'trial',
      max_athletes: 50,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`   ❌ Error creating coach profile: ${error.message}`);
    return null;
  }

  console.log(`   ✅ Coach profile created: ${data.id}`);
  return data.id;
}

async function createCoachAthleteRelationships(supabase, coachId, athletes) {
  console.log('\n🤝 Creating coach-athlete relationships...');

  for (const athlete of athletes) {
    if (athlete.isCoach) continue;

    const inviteCode = generateInviteCode();

    // Check if relationship exists
    const { data: existing } = await supabase
      .from('coach_athletes')
      .select('id')
      .eq('coach_id', coachId)
      .eq('athlete_user_id', athlete.id)
      .single();

    if (existing) {
      console.log(`   ⚠️  Relationship exists for ${athlete.name}`);
      continue;
    }

    const { data, error } = await supabase
      .from('coach_athletes')
      .insert({
        coach_id: coachId,
        athlete_user_id: athlete.id,
        status: 'active',
        invite_code: inviteCode,
        invite_method: 'code',
        invited_at: new Date().toISOString(),
        joined_at: new Date().toISOString(),
        share_workout_history: true,
        share_body_metrics: false,
      })
      .select()
      .single();

    if (error) {
      console.error(`   ❌ Error for ${athlete.name}: ${error.message}`);
    } else {
      console.log(`   ✅ ${athlete.name} connected to coach`);
    }
  }
}

async function createSampleInvites(supabase, coachId) {
  console.log('\n📨 Creating sample invite codes...');

  const invites = [
    {
      invite_type: 'code',
      invite_code: generateInviteCode(),
      max_uses: 1,
      current_uses: 0,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
    },
    {
      invite_type: 'link',
      invite_code: generateInviteCode(),
      invite_link_token: generateLinkToken(),
      max_uses: 10,
      current_uses: 0,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
    },
    {
      invite_type: 'code',
      invite_code: generateInviteCode(),
      max_uses: 1,
      current_uses: 1,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: false, // Used up
    },
  ];

  for (const invite of invites) {
    const { data, error } = await supabase
      .from('coach_invites')
      .insert({
        coach_id: coachId,
        ...invite,
      })
      .select()
      .single();

    if (error) {
      console.error(`   ❌ Error: ${error.message}`);
    } else {
      const statusEmoji = invite.is_active ? '✅' : '⏹️';
      console.log(`   ${statusEmoji} Invite ${data.invite_code} (${invite.invite_type}, ${invite.is_active ? 'active' : 'used'})`);
    }
  }
}

async function createSampleProgram(supabase, coachId) {
  console.log('\n📚 Creating sample program...');

  // Check if program exists
  const { data: existing } = await supabase
    .from('coach_programs')
    .select('id')
    .eq('coach_id', coachId)
    .eq('name', SAMPLE_PROGRAM.name)
    .single();

  if (existing) {
    console.log(`   ⚠️  Program already exists: ${existing.id}`);
    return existing.id;
  }

  const { data, error } = await supabase
    .from('coach_programs')
    .insert({
      coach_id: coachId,
      name: SAMPLE_PROGRAM.name,
      description: SAMPLE_PROGRAM.description,
      duration_weeks: SAMPLE_PROGRAM.duration_weeks,
      days_per_week: SAMPLE_PROGRAM.days_per_week,
      difficulty: SAMPLE_PROGRAM.difficulty,
      category: SAMPLE_PROGRAM.category,
      is_public: SAMPLE_PROGRAM.is_public,
      is_template: SAMPLE_PROGRAM.is_template,
      workouts: SAMPLE_PROGRAM.workouts,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }

  console.log(`   ✅ Program created: ${data.id}`);
  return data.id;
}

async function assignProgramToAthletes(supabase, programId, coachId, athletes) {
  console.log('\n📋 Assigning program to first 2 athletes...');

  const athletesToAssign = athletes.filter(a => !a.isCoach).slice(0, 2);

  for (const athlete of athletesToAssign) {
    // Check if assignment exists
    const { data: existing } = await supabase
      .from('program_assignments')
      .select('id')
      .eq('program_id', programId)
      .eq('athlete_user_id', athlete.id)
      .single();

    if (existing) {
      console.log(`   ⚠️  ${athlete.name} already assigned`);
      continue;
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + SAMPLE_PROGRAM.duration_weeks * 7 * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('program_assignments')
      .insert({
        program_id: programId,
        coach_id: coachId,
        athlete_user_id: athlete.id,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        status: 'active',
        current_week: 1,
        modifications: {},
        coach_notes: 'Welcome! Start with lighter weights and focus on form.',
      })
      .select('id')
      .single();

    if (error) {
      console.error(`   ❌ Error for ${athlete.name}: ${error.message}`);
    } else {
      console.log(`   ✅ ${athlete.name} assigned to program`);

      // Generate assigned workouts
      await generateAssignedWorkouts(supabase, data.id, athlete.id, startDate);
    }
  }
}

async function generateAssignedWorkouts(supabase, assignmentId, athleteUserId, startDate) {
  const workoutData = [];

  for (let week = 1; week <= SAMPLE_PROGRAM.duration_weeks; week++) {
    for (const workout of SAMPLE_PROGRAM.workouts) {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + (week - 1) * 7 + workout.dayNumber - 1);

      workoutData.push({
        assignment_id: assignmentId,
        athlete_user_id: athleteUserId,
        week_number: week,
        day_number: workout.dayNumber,
        workout_name: workout.name,
        exercises: workout.exercises,
        scheduled_date: weekStart.toISOString().split('T')[0],
        status: week === 1 && workout.dayNumber === 1 ? 'in_progress' : 'pending',
      });
    }
  }

  const { error } = await supabase
    .from('assigned_workouts')
    .insert(workoutData);

  if (error) {
    console.error(`      ⚠️  Error creating workouts: ${error.message}`);
  } else {
    console.log(`      📅 Created ${workoutData.length} scheduled workouts`);
  }
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  console.log('🏋️ Coach Test Data Seeder');
  console.log('========================\n');

  if (!SUPABASE_URL) {
    console.error('❌ Missing EXPO_PUBLIC_SUPABASE_URL in .env');
    process.exit(1);
  }

  // Check if we have service role key
  if (!SERVICE_ROLE_KEY) {
    console.log('⚠️  No SUPABASE_SERVICE_ROLE_KEY found.\n');
    console.log('To create test users, you need to either:');
    console.log('');
    console.log('1. Add SUPABASE_SERVICE_ROLE_KEY to .env');
    console.log('   Get it from: Supabase Dashboard > Project Settings > API > service_role');
    console.log('');
    console.log('2. Or create users manually in Supabase Dashboard:');
    console.log('   - Go to Authentication > Users > Add User');
    console.log('');
    console.log('Test accounts to create:');
    console.log('------------------------');
    console.log(`Coach:   ${TEST_COACH.email} / ${TEST_COACH.password}`);
    TEST_ATHLETES.forEach((a, i) => {
      console.log(`Athlete ${i+1}: ${a.email} / ${a.password}`);
    });
    console.log('\nOnce users are created, run this script again with the service role key,');
    console.log('or manually set up relationships in the database.');
    console.log('');

    // Still try to set up relationships if coach profile exists
    const supabase = createClient(SUPABASE_URL, ANON_KEY);
    console.log('Checking for existing coach profile...');

    const { data: profiles } = await supabase
      .from('coach_profiles')
      .select('*')
      .limit(1);

    if (profiles && profiles.length > 0) {
      console.log(`\n✅ Found coach profile: ${profiles[0].display_name}`);
      console.log('You can use the app to create invites and manage athletes.\n');
    }

    return;
  }

  // Create admin client with service role key
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Step 1: Create users
    const users = await seedWithServiceRole(supabaseAdmin);

    if (users.length === 0) {
      console.error('\n❌ No users created. Exiting.');
      process.exit(1);
    }

    // Step 2: Find coach
    const coach = users.find(u => u.isCoach);
    if (!coach) {
      console.error('\n❌ Coach not found. Exiting.');
      process.exit(1);
    }

    // Step 3: Create coach profile
    const coachProfileId = await createCoachProfile(supabaseAdmin, coach.id);
    if (!coachProfileId) {
      console.error('\n❌ Failed to create coach profile. Exiting.');
      process.exit(1);
    }

    // Step 4: Create coach-athlete relationships
    await createCoachAthleteRelationships(supabaseAdmin, coachProfileId, users);

    // Step 5: Create sample invites
    await createSampleInvites(supabaseAdmin, coachProfileId);

    // Step 6: Create sample program
    const programId = await createSampleProgram(supabaseAdmin, coachProfileId);

    // Step 7: Assign program to some athletes
    if (programId) {
      await assignProgramToAthletes(supabaseAdmin, programId, coachProfileId, users);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ SEEDING COMPLETE!');
    console.log('='.repeat(50));
    console.log('\nTest Credentials:');
    console.log('─'.repeat(50));
    console.log(`Coach Login:    ${TEST_COACH.email}`);
    console.log(`                Password: ${TEST_COACH.password}`);
    console.log('─'.repeat(50));
    TEST_ATHLETES.forEach((a, i) => {
      console.log(`Athlete ${i+1}:     ${a.email}`);
      console.log(`                Password: ${a.password}`);
    });
    console.log('─'.repeat(50));
    console.log('\nWorkflow Test Steps:');
    console.log('1. Log in as coach');
    console.log('2. Go to Coach tab - you should see 5 athletes');
    console.log('3. Go to "Assign Program" - see the sample program');
    console.log('4. Go to "Invite Athletes" - create new invites');
    console.log('5. Log out, log in as an athlete');
    console.log('6. Check if they can see assigned workouts');
    console.log('');
  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  }
}

main();
