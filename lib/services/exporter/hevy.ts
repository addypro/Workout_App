// Hevy CSV Exporter Service
// Adapted for Expo/React Native

export interface ParsedProgramData {
  name: string;
  description?: string;
  weeks: Array<{
    weekNumber: number;
    days: Array<{
      dayNumber: number;
      workouts: Array<{
        name?: string;
        exercises: Array<{
          name: string;
          sets: number;
          reps?: string;
          weight?: string;
          notes?: string;
        }>;
      }>;
    }>;
  }>;
}

/**
 * Generate Hevy-compatible CSV format
 * Hevy CSV format: Date, Exercise Name, Sets, Reps, Weight, Notes
 * Dates are formatted as YYYY-MM-DD
 */
export function generateHevyCSV(programData: ParsedProgramData, startDate?: Date): string {
  const rows: string[] = [];

  // Hevy CSV header
  rows.push('Date,Exercise Name,Sets,Reps,Weight,Notes');

  // Use provided start date or default to today
  const baseDate = startDate || new Date();

  // Generate rows for each workout
  programData.weeks.forEach((week) => {
    week.days.forEach((day) => {
      // Calculate workout date
      const daysOffset = (week.weekNumber - 1) * 7 + (day.dayNumber - 1);
      const workoutDate = new Date(baseDate);
      workoutDate.setDate(baseDate.getDate() + daysOffset);

      const dateStr = formatDate(workoutDate);

      day.workouts.forEach((workout) => {
        workout.exercises.forEach((exercise) => {
          // Format reps (handle ranges like "8-10")
          const repsStr = exercise.reps || '';

          // Format weight (extract numeric value if possible)
          const weightStr = formatWeight(exercise.weight);

          // Create CSV row
          const row = [
            dateStr,
            escapeCSV(exercise.name),
            exercise.sets.toString(),
            escapeCSV(repsStr),
            escapeCSV(weightStr),
            escapeCSV(exercise.notes || ''),
          ];

          rows.push(row.join(','));
        });
      });
    });
  });

  return rows.join('\n');
}

/**
 * Format date as YYYY-MM-DD for Hevy
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format weight value
 * Extracts numeric value from strings like "225 lbs", "100 kg", "RPE 8"
 */
function formatWeight(weight?: string): string {
  if (!weight) return '';

  // Extract number from weight string
  const match = weight.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    return match[1];
  }

  // Return as-is if no number found (e.g., "RPE 8")
  return weight;
}

/**
 * Escape CSV values (handle commas, quotes, newlines)
 */
function escapeCSV(value: string): string {
  if (!value) return '';

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
