const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function seedExercises() {
  try {
    console.log('🏋️  Starting exercise database seeding...\n');

    // Load exercises from JSON
    const exercisesPath = path.join(__dirname, '../data/exercises.json');
    const exercisesData = JSON.parse(fs.readFileSync(exercisesPath, 'utf-8'));

    console.log(`📚 Loaded ${exercisesData.length} exercises from JSON file\n`);

    // Clear existing exercises
    console.log('🗑️  Clearing existing exercises...');
    const deleted = await prisma.exerciseDatabase.deleteMany({});
    console.log(`   Deleted ${deleted.count} existing exercises\n`);

    // Prepare exercises for insertion (only include fields that exist in schema)
    const exercises = exercisesData.map((ex, index) => ({
      name: ex.name,
      aliases: ex.aliases || [],
      category: ex.category || null,
      equipment: ex.equipment || [],
      muscleGroups: ex.muscleGroups || [],
      videoUrl: ex.videoUrl || null,
      instructions: null, // Not in our JSON but in schema
    }));

    // Insert in batches of 100
    console.log('💾 Inserting exercises in batches...');
    const BATCH_SIZE = 100;
    let inserted = 0;

    for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
      const batch = exercises.slice(i, i + BATCH_SIZE);
      await prisma.exerciseDatabase.createMany({
        data: batch,
        skipDuplicates: true,
      });
      inserted += batch.length;
      const progress = Math.round((inserted / exercises.length) * 100);
      process.stdout.write(`   Progress: ${progress}% (${inserted}/${exercises.length})\r`);
    }

    console.log(`\n\n✅ Seeding complete!`);
    console.log(`   Total exercises inserted: ${inserted}`);

    // Show category breakdown
    const categories = {};
    exercisesData.forEach(ex => {
      const cat = ex.category || 'Unknown';
      categories[cat] = (categories[cat] || 0) + 1;
    });

    console.log('\n📊 Exercises by category:');
    Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([cat, count]) => {
        console.log(`   ${cat}: ${count}`);
      });

  } catch (error) {
    console.error('\n❌ Error seeding exercises:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedExercises();
