/**
 * Seed exercises to Supabase PostgreSQL database
 * Run with: npx tsx scripts/seed-exercises-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const dotenv = require('dotenv');
dotenv.config();

// Create Supabase client with service role key for admin operations
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ExerciseInput {
  name: string;
  aliases?: string[];
  category?: string;
  equipment?: string[];
  muscleGroups?: string[];
  videoUrl?: string;
  instructions?: string;
}

async function loadExercisesFromJson(): Promise<ExerciseInput[]> {
  const exercisesPath = path.join(__dirname, '../data/exercises.json');

  if (!fs.existsSync(exercisesPath)) {
    console.error('Error: exercises.json not found at', exercisesPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(exercisesPath, 'utf-8');
  const data = JSON.parse(raw);

  // Handle both array format and object with exercises key
  const exercises: any[] = Array.isArray(data) ? data : data.exercises || [];

  return exercises.map((ex: any) => ({
    name: ex.name || ex.Name || '',
    aliases: ex.aliases || ex.Aliases || [],
    category: ex.category || ex.Category || ex.primary_muscle || null,
    equipment: ex.equipment || ex.Equipment || [],
    muscleGroups: ex.muscleGroups || ex.muscles || [],
    videoUrl: ex.videoUrl || ex.video_url || null,
    instructions: ex.instructions || ex.Instructions || null,
  }));
}

async function seedExercises() {
  console.log('Starting exercise database seeding to Supabase...\n');

  // Load exercises from JSON
  const exercises = await loadExercisesFromJson();
  console.log(`Loaded ${exercises.length} exercises from JSON file\n`);

  // Filter out invalid entries
  const validExercises = exercises.filter(ex => ex.name && ex.name.trim().length > 0);
  console.log(`Found ${validExercises.length} valid exercises\n`);

  // Clear existing exercises
  console.log('Clearing existing exercises...');
  const { error: deleteError } = await supabase
    .from('exercise_database')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (deleteError) {
    console.error('Error clearing exercises:', deleteError);
  }

  // Insert in batches
  const BATCH_SIZE = 100;
  let inserted = 0;
  let skipped = 0;
  const seenNames = new Set<string>();

  console.log('Inserting exercises in batches...\n');

  for (let i = 0; i < validExercises.length; i += BATCH_SIZE) {
    const batch = validExercises.slice(i, i + BATCH_SIZE);

    // Deduplicate within batch
    const uniqueBatch = batch.filter(ex => {
      const normalizedName = ex.name.toLowerCase().trim();
      if (seenNames.has(normalizedName)) {
        skipped++;
        return false;
      }
      seenNames.add(normalizedName);
      return true;
    });

    if (uniqueBatch.length === 0) continue;

    const { error } = await supabase
      .from('exercise_database')
      .upsert(
        uniqueBatch.map(ex => ({
          name: ex.name.trim(),
          aliases: ex.aliases || [],
          category: ex.category || null,
          equipment: ex.equipment || [],
          muscleGroups: ex.muscleGroups || null,
          videoUrl: ex.videoUrl || null,
          instructions: ex.instructions || null,
        })),
        { onConflict: 'name', ignoreDuplicates: true }
      );

    if (error) {
      console.error(`Error inserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
    } else {
      inserted += uniqueBatch.length;
    }

    // Progress indicator
    const progress = Math.round(((i + batch.length) / validExercises.length) * 100);
    process.stdout.write(`\rProgress: ${progress}% (${inserted} inserted, ${skipped} duplicates skipped)`);
  }

  console.log('\n\n=== Seeding Complete ===');
  console.log(`Total exercises inserted: ${inserted}`);
  console.log(`Duplicates skipped: ${skipped}`);

  // Verify count
  const { count, error: countError } = await supabase
    .from('exercise_database')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`Database now contains: ${count} exercises`);
  }

  // Show category breakdown
  const { data: categories } = await supabase
    .from('exercise_database')
    .select('category');

  if (categories) {
    const categoryCount: Record<string, number> = {};
    categories.forEach(ex => {
      const cat = ex.category || 'Uncategorized';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    console.log('\nExercises by category:');
    Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count}`);
      });
  }
}

// Run the seeder
seedExercises()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
