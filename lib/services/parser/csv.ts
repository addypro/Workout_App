// CSV Parser Service
// Parse workout programs from CSV files

import { ParsedProgram, ParsedWorkout, ParsedExercise } from '@/lib/types/program';
import { parseSetType } from '@/lib/utils/parser-utils';

export interface CSVRow {
  [key: string]: string;
}

/**
 * Parse CSV content into a workout program
 * Expected CSV format:
 * Week, Day, Exercise, Sets, Reps, Weight, Notes
 */
export async function parseCSV(csvContent: string): Promise<ParsedProgram> {
  const lines = csvContent.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  // Parse rows
  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row: CSVRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row);
    }
  }

  // Group by week and day
  const workouts: ParsedWorkout[] = [];
  let currentWeek = 1;
  let currentDay = 1;
  let currentWorkout: ParsedWorkout | null = null;
  let exerciseOrder = 0;

  rows.forEach((row) => {
    const week = parseInt(row.week || row.wk || '1') || currentWeek;
    const day = parseInt(row.day || '1') || currentDay;
    const exerciseName = row.exercise || row['exercise name'] || '';
    const sets = parseInt(row.sets || '0') || 0;
    const reps = row.reps || row.repetitions || '';
    const weight = row.weight || '';
    const restTime = parseInt(row['rest (seconds)'] || row.rest || row['rest time'] || '0') || 0;
    const notes = row.notes || '';
    const setType = parseSetType(row['set type'] || row.settype || row.type || row['set_type']);

    // Check if we need to start a new workout
    if (!currentWorkout || currentWorkout.week !== week || currentWorkout.day !== day) {
      if (currentWorkout) {
        workouts.push(currentWorkout);
      }
      currentWorkout = {
        week,
        day,
        exercises: [],
        order: workouts.length,
      };
      exerciseOrder = 0;
      currentWeek = week;
      currentDay = day;
    }

    // Add exercise to current workout
    if (exerciseName && sets > 0 && currentWorkout) {
      const exercise: ParsedExercise = {
        name: exerciseName.trim(),
        sets,
        reps: reps || undefined,
        weight: weight || undefined,
        restSeconds: restTime > 0 ? restTime : undefined,
        notes: notes || undefined,
        setType: setType || undefined,
        order: exerciseOrder++,
      };
      currentWorkout.exercises.push(exercise);
    }
  });

  // Add the last workout
  const lastWorkout = currentWorkout as ParsedWorkout | null;
  if (lastWorkout && lastWorkout.exercises.length > 0) {
    workouts.push(lastWorkout);
  }

  return {
    name: 'Imported Program',
    workouts,
  };
}

/**
 * Parse a CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        // Escaped quote
        currentValue += '"';
        i++;
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // End of value
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  // Add the last value
  values.push(currentValue.trim());

  return values;
}
