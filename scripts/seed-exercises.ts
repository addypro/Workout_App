// Seed Exercise Database
// Run with: npx tsx scripts/seed-exercises.ts

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ExerciseData {
  name: string;
  aliases: string[];
  category: string;
  equipment: string[];
  videoUrl?: string;
}

async function main() {
  console.log('🌱 Seeding exercise database...');

  // Read exercises from JSON file
  const exercisesPath = path.join(__dirname, '..', 'data', 'exercises.json');

  if (!fs.existsSync(exercisesPath)) {
    console.error('❌ exercises.json not found at:', exercisesPath);
    console.log('Please ensure the data/exercises.json file exists');
    process.exit(1);
  }

  const exercisesJson = fs.readFileSync(exercisesPath, 'utf-8');
  const exercises: ExerciseData[] = JSON.parse(exercisesJson);

  console.log(`Found ${exercises.length} exercises to seed`);

  // Clear existing exercises
  console.log('Clearing existing exercises...');
  await prisma.exerciseDatabase.deleteMany();

  // Insert exercises
  let count = 0;
  for (const exercise of exercises) {
    try {
      await prisma.exerciseDatabase.create({
        data: {
          name: exercise.name,
          aliases: JSON.stringify(exercise.aliases || []),
          category: exercise.category,
          equipment: JSON.stringify(exercise.equipment || []),
          videoUrl: exercise.videoUrl,
        },
      });
      count++;
      if (count % 10 === 0) {
        console.log(`✅ Inserted ${count}/${exercises.length} exercises`);
      }
    } catch (error) {
      console.error(`❌ Error inserting exercise "${exercise.name}":`, error);
    }
  }

  console.log(`\n✨ Successfully seeded ${count} exercises!`);

  // Display some statistics
  const categoryCount = await prisma.exerciseDatabase.groupBy({
    by: ['category'],
    _count: true,
  });

  console.log('\n📊 Exercises by category:');
  categoryCount.forEach((cat) => {
    console.log(`  - ${cat.category}: ${cat._count} exercises`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
