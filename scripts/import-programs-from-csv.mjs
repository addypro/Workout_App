/**
 * Import Programs from Kaggle CSV (Full Data Version)
 *
 * Parses programs_detailed_boostcamp_kaggle.csv and generates programs-full.json
 * Contains ALL workout data for each program (all weeks, days, exercises).
 * Optimized format to minimize file size while preserving complete data.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, '../data/programs_detailed_boostcamp_kaggle.csv');
const OUTPUT_PATH = path.join(__dirname, '../data/programs-full.json');

// CSV columns:
// title, description, level, goal, equipment, program_length, time_per_workout,
// week, day, number_of_exercises, exercise_name, sets, reps, intensity, created, last_edit

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

function inferType(goals) {
  const goalsLower = goals.toLowerCase();

  if (goalsLower.includes('powerlifting')) return 'POWERLIFTING';
  if (goalsLower.includes('olympic weightlifting')) return 'STRENGTH';
  if (goalsLower.includes('bodybuilding') || goalsLower.includes('hypertrophy') || goalsLower.includes('muscle')) return 'HYPERTROPHY';
  if (goalsLower.includes('bodyweight') || goalsLower.includes('calisthenics')) return 'BODYWEIGHT';
  if (goalsLower.includes('athletics') || goalsLower.includes('sport')) return 'ATHLETIC';
  if (goalsLower.includes('weight loss') || goalsLower.includes('fat loss')) return 'WEIGHT_LOSS';
  if (goalsLower.includes('strength') || goalsLower.includes('powerbuilding')) return 'STRENGTH';
  if (goalsLower.includes('endurance') || goalsLower.includes('cardio')) return 'ENDURANCE';

  return 'GENERAL_FITNESS';
}

function inferDifficulty(levels) {
  const levelsLower = levels.toLowerCase();

  if (levelsLower.includes('elite')) return 'ELITE';
  if (levelsLower.includes('advanced')) return 'ADVANCED';
  if (levelsLower.includes('intermediate')) return 'INTERMEDIATE';
  if (levelsLower.includes('beginner') || levelsLower.includes('novice')) return 'BEGINNER';

  return 'INTERMEDIATE';
}

function generateId(title) {
  const base64 = Buffer.from(title.substring(0, 20)).toString('base64').replace(/[+/=]/g, '');
  return `kaggle-${base64}`;
}

function formatReps(reps) {
  const num = parseFloat(reps);
  if (isNaN(num)) return reps;

  // Negative values indicate seconds (time-based)
  if (num < 0) {
    return `${Math.abs(Math.round(num))}s`;
  }

  return String(Math.round(num));
}

async function main() {
  console.log('Starting CSV import (full data)...');
  console.log(`Reading from: ${CSV_PATH}`);

  const programs = new Map();
  let lineCount = 0;
  let headerSkipped = false;

  const fileStream = fs.createReadStream(CSV_PATH);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }

    lineCount++;
    if (lineCount % 100000 === 0) {
      console.log(`Processed ${lineCount} rows, ${programs.size} programs found...`);
    }

    const cols = parseCSVLine(line);
    if (cols.length < 14) continue;

    const [
      title, description, level, goal, equipment, programLength, timePerWorkout,
      week, day, numExercises, exerciseName, sets, reps, intensity
    ] = cols;

    if (!title || title === 'title') continue;

    const programKey = title;

    if (!programs.has(programKey)) {
      programs.set(programKey, {
        id: generateId(title),
        name: title,
        description: description || `${title} workout program`,
        type: inferType(goal || ''),
        difficulty: inferDifficulty(level || ''),
        duration: Math.round(parseFloat(programLength) || 4),
        daysPerWeek: 0,
        goals: goal || '',
        equipment: equipment || '',
        timePerWorkout: Math.round(parseFloat(timePerWorkout) || 45),
        workouts: new Map(), // Map of "week-day" -> workout
      });
    }

    const program = programs.get(programKey);
    const weekNum = Math.round(parseFloat(week) || 1);
    const dayNum = Math.round(parseFloat(day) || 1);
    const workoutKey = `${weekNum}-${dayNum}`;

    if (!program.workouts.has(workoutKey)) {
      program.workouts.set(workoutKey, {
        week: weekNum,
        day: dayNum,
        name: `Week ${weekNum}, Day ${dayNum}`,
        exercises: []
      });
    }

    const workout = program.workouts.get(workoutKey);

    if (exerciseName && exerciseName.trim()) {
      workout.exercises.push({
        name: exerciseName.trim(),
        sets: Math.round(parseFloat(sets) || 3),
        reps: formatReps(reps || '10'),
      });
    }
  }

  console.log(`\nProcessed ${lineCount} total rows`);
  console.log(`Found ${programs.size} unique programs`);

  // Convert to output format with ALL workout data
  const output = {
    version: '3.0',
    generated: new Date().toISOString(),
    source: 'programs_detailed_boostcamp_kaggle.csv',
    programs: []
  };

  let totalWorkouts = 0;
  let totalExercises = 0;

  for (const [, program] of programs) {
    // Convert workouts Map to sorted array
    const workoutsArray = Array.from(program.workouts.values())
      .sort((a, b) => {
        if (a.week !== b.week) return a.week - b.week;
        return a.day - b.day;
      });

    // Calculate unique days per week
    const uniqueDays = new Set(workoutsArray.map(w => w.day));

    // Count exercises
    const exerciseCount = workoutsArray.reduce((sum, w) => sum + w.exercises.length, 0);
    totalWorkouts += workoutsArray.length;
    totalExercises += exerciseCount;

    output.programs.push({
      id: program.id,
      name: program.name,
      description: program.description,
      type: program.type,
      difficulty: program.difficulty,
      duration: program.duration,
      daysPerWeek: uniqueDays.size,
      timePerWorkout: program.timePerWorkout,
      equipment: program.equipment,
      goals: program.goals,
      // Full workout data - all weeks, days, exercises
      workouts: workoutsArray.map(w => ({
        w: w.week,  // Shortened keys to reduce file size
        d: w.day,
        n: w.name,
        e: w.exercises.map(ex => ({
          n: ex.name,   // name
          s: ex.sets,   // sets
          r: ex.reps,   // reps
        }))
      }))
    });
  }

  // Sort by name
  output.programs.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`\nWriting ${output.programs.length} programs to ${OUTPUT_PATH}...`);
  console.log(`Total workouts: ${totalWorkouts}`);
  console.log(`Total exercises: ${totalExercises}`);

  // Write without pretty printing to minimize size
  const jsonString = JSON.stringify(output);
  fs.writeFileSync(OUTPUT_PATH, jsonString);

  const fileSizeMB = (Buffer.byteLength(jsonString) / (1024 * 1024)).toFixed(2);
  console.log(`File size: ${fileSizeMB} MB`);

  // Print summary stats
  const stats = {
    total: output.programs.length,
    byType: {},
    byDifficulty: {}
  };

  output.programs.forEach(p => {
    stats.byType[p.type] = (stats.byType[p.type] || 0) + 1;
    stats.byDifficulty[p.difficulty] = (stats.byDifficulty[p.difficulty] || 0) + 1;
  });

  console.log('\n=== Import Summary ===');
  console.log(`Total programs: ${stats.total}`);
  console.log(`Total workouts: ${totalWorkouts}`);
  console.log(`Total exercises: ${totalExercises}`);
  console.log('\nBy type:');
  Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  console.log('\nBy difficulty:');
  Object.entries(stats.byDifficulty).sort((a, b) => b[1] - a[1]).forEach(([diff, count]) => {
    console.log(`  ${diff}: ${count}`);
  });

  console.log('\nDone!');
}

main().catch(console.error);
