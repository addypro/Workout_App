const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

/**
 * Import Kaggle Fitness Programs Dataset
 *
 * Usage: node scripts/import-kaggle-programs.js <path-to-dataset-folder>
 *
 * The dataset should contain CSV files with programs, workouts, and exercises
 */

async function importKaggleDataset(datasetPath) {
  console.log('🏋️  Starting Kaggle Fitness Dataset Import...\n');

  // Verify dataset path exists
  if (!fs.existsSync(datasetPath)) {
    console.error(`❌ Error: Dataset path not found: ${datasetPath}`);
    console.log('\n💡 Tip: Download the dataset first from:');
    console.log('   https://www.kaggle.com/datasets/adnanelouardi/600k-fitness-exercise-and-workout-program-dataset');
    console.log('\n   Or run: kaggle datasets download -d adnanelouardi/600k-fitness-exercise-and-workout-program-dataset');
    process.exit(1);
  }

  console.log(`📂 Dataset path: ${datasetPath}\n`);

  // Find CSV files in dataset
  const files = fs.readdirSync(datasetPath);
  const csvFiles = files.filter(f => f.endsWith('.csv'));

  console.log(`📄 Found ${csvFiles.length} CSV files:`);
  csvFiles.forEach(f => console.log(`   - ${f}`));
  console.log();

  // Identify the main program file (usually the largest or with "program" in name)
  const programFile = csvFiles.find(f =>
    f.toLowerCase().includes('program') ||
    f.toLowerCase().includes('workout')
  ) || csvFiles[0];

  console.log(`📊 Processing main file: ${programFile}\n`);

  // Read and parse CSV
  const csvPath = path.join(datasetPath, programFile);
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`✅ Parsed ${records.length} records\n`);

  // Analyze the data structure
  if (records.length > 0) {
    console.log('📋 Sample Record Structure:');
    const sampleKeys = Object.keys(records[0]);
    sampleKeys.forEach(key => {
      const value = records[0][key];
      const preview = value ? value.substring(0, 50) : '(empty)';
      console.log(`   ${key}: ${preview}${value && value.length > 50 ? '...' : ''}`);
    });
    console.log();
  }

  // Transform data to app format
  console.log('🔄 Transforming data to app format...\n');

  const programs = transformToAppFormat(records);

  console.log(`✅ Transformed ${programs.length} programs\n`);

  // Save to JSON file
  const outputPath = path.join(__dirname, '../data/workout-programs.json');
  const output = {
    programs: programs.slice(0, 2598), // Limit to 2,598 as mentioned
    metadata: {
      totalPrograms: Math.min(programs.length, 2598),
      importDate: new Date().toISOString(),
      source: 'Kaggle - 600K Fitness Dataset',
      datasetUrl: 'https://www.kaggle.com/datasets/adnanelouardi/600k-fitness-exercise-and-workout-program-dataset',
    },
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`💾 Saved to: ${outputPath}`);
  console.log(`📊 Total programs: ${output.metadata.totalPrograms}`);
  console.log('\n✨ Import complete!\n');

  // Print statistics
  printStatistics(output.programs);
}

function transformToAppFormat(records) {
  const programs = [];
  const programMap = new Map();

  // Group records by program
  records.forEach(record => {
    // Try to identify program identifier (adjust based on actual CSV structure)
    const programId = record.program_id || record.id || record.Program_ID || record.ID;
    const programName = record.program_name || record.name || record.Program_Name || record.Name || 'Untitled Program';

    if (!programId) {
      // Skip records without identifier
      return;
    }

    if (!programMap.has(programId)) {
      // Create new program
      const program = {
        id: `kaggle-${programId}`,
        name: programName,
        type: detectProgramType(record),
        duration: parseDuration(record.duration || record.weeks || record.program_duration || 4),
        difficulty: normalizeDifficulty(record.difficulty || record.level || 'INTERMEDIATE'),
        muscleGroups: parseMuscleGroups(record.target_muscles || record.muscle_groups || record.muscles || ''),
        equipment: parseEquipment(record.equipment || record.equipment_required || ''),
        description: record.description || record.program_description || '',
        workouts: [],
        source: 'kaggle',
      };

      programMap.set(programId, program);
    }

    // Add workout/exercise data if available
    const program = programMap.get(programId);

    if (record.exercise_name || record.exercise) {
      // This record contains exercise data
      addExerciseToProgram(program, record);
    }
  });

  return Array.from(programMap.values());
}

function detectProgramType(record) {
  const typeStr = (record.type || record.program_type || '').toLowerCase();

  if (typeStr.includes('strength') || typeStr.includes('power')) return 'STRENGTH';
  if (typeStr.includes('hypertrophy') || typeStr.includes('bodybuilding')) return 'HYPERTROPHY';
  if (typeStr.includes('endurance') || typeStr.includes('cardio')) return 'ENDURANCE';
  if (typeStr.includes('weight loss') || typeStr.includes('fat')) return 'WEIGHT_LOSS';
  if (typeStr.includes('athlete') || typeStr.includes('sport')) return 'ATHLETIC';

  return 'GENERAL_FITNESS';
}

function normalizeDifficulty(difficulty) {
  const diff = difficulty.toLowerCase();

  if (diff.includes('begin') || diff.includes('novice')) return 'BEGINNER';
  if (diff.includes('inter') || diff.includes('moderate')) return 'INTERMEDIATE';
  if (diff.includes('adv') || diff.includes('expert')) return 'ADVANCED';

  return 'INTERMEDIATE';
}

function parseMuscleGroups(muscleStr) {
  if (!muscleStr) return [];

  // Split by common delimiters
  const muscles = muscleStr.split(/[,;|]/).map(m => m.trim()).filter(Boolean);
  return [...new Set(muscles)]; // Remove duplicates
}

function parseEquipment(equipmentStr) {
  if (!equipmentStr) return ['Bodyweight'];

  const equipment = equipmentStr.split(/[,;|]/).map(e => e.trim()).filter(Boolean);
  return [...new Set(equipment)];
}

function parseDuration(durationStr) {
  // Try to parse duration as number of weeks
  const num = parseInt(durationStr);
  return isNaN(num) ? 4 : num;
}

function addExerciseToProgram(program, record) {
  const week = parseInt(record.week || record.week_number || 1);
  const day = parseInt(record.day || record.day_number || 1);

  // Find or create workout
  let workout = program.workouts.find(w => w.week === week && w.day === day);

  if (!workout) {
    workout = {
      week,
      day,
      name: record.workout_name || `Week ${week}, Day ${day}`,
      exercises: [],
    };
    program.workouts.push(workout);
  }

  // Add exercise
  const exercise = {
    name: record.exercise_name || record.exercise || 'Unknown Exercise',
    sets: parseInt(record.sets || 3),
    reps: record.reps || record.repetitions || '10',
    weight: record.weight || null,
    restTime: parseInt(record.rest_seconds || record.rest || 60),
  };

  workout.exercises.push(exercise);
}

function printStatistics(programs) {
  console.log('📈 Dataset Statistics:\n');

  // Count by type
  const byType = {};
  const byDifficulty = {};
  const byDuration = {};

  programs.forEach(p => {
    byType[p.type] = (byType[p.type] || 0) + 1;
    byDifficulty[p.difficulty] = (byDifficulty[p.difficulty] || 0) + 1;

    const durationBucket = p.duration <= 4 ? '1-4 weeks' :
                           p.duration <= 8 ? '5-8 weeks' :
                           p.duration <= 12 ? '9-12 weeks' : '12+ weeks';
    byDuration[durationBucket] = (byDuration[durationBucket] || 0) + 1;
  });

  console.log('By Type:');
  Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });

  console.log('\nBy Difficulty:');
  Object.entries(byDifficulty).sort((a, b) => b[1] - a[1]).forEach(([diff, count]) => {
    console.log(`   ${diff}: ${count}`);
  });

  console.log('\nBy Duration:');
  Object.entries(byDuration).sort().forEach(([duration, count]) => {
    console.log(`   ${duration}: ${count}`);
  });

  // Total workouts
  const totalWorkouts = programs.reduce((sum, p) => sum + (p.workouts?.length || 0), 0);
  console.log(`\n📋 Total Workouts: ${totalWorkouts}`);

  const avgWorkoutsPerProgram = (totalWorkouts / programs.length).toFixed(1);
  console.log(`📊 Average Workouts per Program: ${avgWorkoutsPerProgram}`);
}

// Main execution
const datasetPath = process.argv[2];

if (!datasetPath) {
  console.error('❌ Error: Please provide dataset path');
  console.log('\nUsage: node scripts/import-kaggle-programs.js <path-to-dataset>');
  console.log('\nExample:');
  console.log('  node scripts/import-kaggle-programs.js ~/Downloads/kaggle-fitness-dataset');
  process.exit(1);
}

importKaggleDataset(datasetPath).catch(error => {
  console.error('\n❌ Import failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
