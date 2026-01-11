import { Program } from '@/lib/db/storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert, Platform } from 'react-native';
import * as XLSX from 'xlsx';

// Dynamic import for sharing (may not be available)
let Sharing: any = null;
try {
  Sharing = require('expo-sharing');
} catch (e) {
  // expo-sharing not installed
}

// Template CSV content
export const CSV_TEMPLATE = `Week,Day,Exercise,Sets,Reps,Weight,Rest (seconds),Notes
1,1,Bench Press,4,8-10,135 lbs,90,Warm up with lighter weight
1,1,Incline Dumbbell Press,3,10-12,40 lbs,60,Focus on stretch at bottom
1,1,Cable Flyes,3,12-15,,60,Squeeze at peak contraction
1,2,Squat,4,6-8,185 lbs,120,Go below parallel
1,2,Romanian Deadlift,3,10-12,135 lbs,90,Feel the hamstring stretch
1,2,Leg Press,3,12-15,,60,
1,3,REST,,,,,Active recovery day
1,4,Pull-ups,4,8-10,,90,Add weight if needed
1,4,Barbell Rows,4,8-10,135 lbs,90,
1,4,Face Pulls,3,15-20,,45,
1,5,Overhead Press,4,6-8,95 lbs,90,AM session
1,5,Lateral Raises,3,12-15,15 lbs,45,AM session
1,5,Cardio - HIIT,1,20 min,,0,PM session (optional)
1,6,REST,,,,,
1,7,REST,,,,,Weekly rest
2,1,Bench Press,4,8-10,140 lbs,90,Progressive overload
2,1,Incline Dumbbell Press,3,10-12,42.5 lbs,60,
2,1,Cable Flyes,3,12-15,,60,
2,2,Squat,4,6-8,190 lbs,120,Add 5 lbs from week 1
2,2,Romanian Deadlift,3,10-12,140 lbs,90,
2,3,REST,,,,,
2,4,Pull-ups,4,8-10,,90,
2,4,Barbell Rows,4,8-10,140 lbs,90,`;

/**
 * Generate CSV content from a program
 */
export function programToCSV(program: Program): string {
  const parsedData = typeof program.parsedData === 'string'
    ? JSON.parse(program.parsedData)
    : program.parsedData;

  const workouts = parsedData?.workouts || [];

  // CSV header
  const lines = ['Week,Day,Exercise,Sets,Reps,Weight,Rest (seconds),Notes'];

  // Generate rows for each exercise
  for (const workout of workouts) {
    for (const exercise of workout.exercises || []) {
      const restValue = exercise.restTime || exercise.restSeconds || '';
      const row = [
        workout.week || 1,
        workout.day || 1,
        `"${(exercise.name || '').replace(/"/g, '""')}"`, // Escape quotes in name
        exercise.sets || '',
        exercise.reps || '',
        exercise.weight ? `"${exercise.weight}"` : '',
        restValue,
        exercise.notes ? `"${(exercise.notes || '').replace(/"/g, '""')}"` : '',
      ];
      lines.push(row.join(','));
    }
  }

  return lines.join('\n');
}

/**
 * Download/share a CSV file
 */
export async function downloadCSV(content: string, filename: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      // Web: Create blob and trigger download
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } else {
      // Mobile: Save to cache and share
      const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
      const fileUri = `${cacheDir}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: 'utf8',
      });

      if (Sharing) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Export CSV',
            UTI: 'public.comma-separated-values-text',
          });
          return true;
        }
      }

      // Fallback: Show alert with file location
      Alert.alert(
        'CSV Saved',
        `File saved to: ${fileUri}\n\nInstall expo-sharing for native share functionality.`
      );
      return true;
    }
  } catch (error) {
    console.error('Error downloading CSV:', error);
    return false;
  }
}

/**
 * Download the template CSV
 */
export async function downloadTemplate(): Promise<boolean> {
  return downloadCSV(CSV_TEMPLATE, 'workout-template.csv');
}

/**
 * Export a program to CSV
 */
export async function exportProgramToCSV(program: Program): Promise<boolean> {
  const content = programToCSV(program);
  const safeName = program.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const filename = `${safeName}-workout.csv`;
  return downloadCSV(content, filename);
}

// Excel Template Data
export const EXCEL_TEMPLATE_DATA = [
  ['Week', 'Day', 'Exercise', 'Sets', 'Reps', 'Weight', 'Rest (seconds)', 'Notes'],
  [1, 1, 'Bench Press', 4, '8-10', '135 lbs', 90, 'Warm up with lighter weight'],
  [1, 1, 'Incline Dumbbell Press', 3, '10-12', '40 lbs', 60, 'Focus on stretch at bottom'],
  [1, 1, 'Cable Flyes', 3, '12-15', '', 60, 'Squeeze at peak contraction'],
  [1, 2, 'Squat', 4, '6-8', '185 lbs', 120, 'Go below parallel'],
  [1, 2, 'Romanian Deadlift', 3, '10-12', '135 lbs', 90, 'Feel the hamstring stretch'],
  [1, 2, 'Leg Press', 3, '12-15', '', 60, ''],
  [1, 3, 'REST', '', '', '', '', 'Active recovery day'],
  [1, 4, 'Pull-ups', 4, '8-10', '', 90, 'Add weight if needed'],
  [1, 4, 'Barbell Rows', 4, '8-10', '135 lbs', 90, ''],
  [1, 4, 'Face Pulls', 3, '15-20', '', 45, ''],
  [1, 5, 'Overhead Press', 4, '6-8', '95 lbs', 90, 'AM session'],
  [1, 5, 'Lateral Raises', 3, '12-15', '15 lbs', 45, 'AM session'],
  [1, 5, 'Cardio - HIIT', 1, '20 min', '', 0, 'PM session (optional)'],
  [1, 6, 'REST', '', '', '', '', ''],
  [1, 7, 'REST', '', '', '', '', 'Weekly rest'],
  [2, 1, 'Bench Press', 4, '8-10', '140 lbs', 90, 'Progressive overload'],
  [2, 1, 'Incline Dumbbell Press', 3, '10-12', '42.5 lbs', 60, ''],
  [2, 1, 'Cable Flyes', 3, '12-15', '', 60, ''],
  [2, 2, 'Squat', 4, '6-8', '190 lbs', 120, 'Add 5 lbs from week 1'],
  [2, 2, 'Romanian Deadlift', 3, '10-12', '140 lbs', 90, ''],
  [2, 3, 'REST', '', '', '', '', ''],
  [2, 4, 'Pull-ups', 4, '8-10', '', 90, ''],
  [2, 4, 'Barbell Rows', 4, '8-10', '140 lbs', 90, ''],
];

/**
 * Download/share an Excel file
 */
export async function downloadExcel(data: any[][], filename: string): Promise<boolean> {
  try {
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Set column widths for better readability
    worksheet['!cols'] = [
      { wch: 6 },  // Week
      { wch: 5 },  // Day
      { wch: 25 }, // Exercise
      { wch: 5 },  // Sets
      { wch: 8 },  // Reps
      { wch: 10 }, // Weight
      { wch: 14 }, // Rest
      { wch: 30 }, // Notes
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Workouts');

    if (Platform.OS === 'web') {
      // Web: Use XLSX's built-in download
      XLSX.writeFile(workbook, filename);
      return true;
    } else {
      // Mobile: Generate binary and save to cache
      const excelBuffer = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
      const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
      const fileUri = `${cacheDir}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, excelBuffer, {
        encoding: 'base64',
      });

      if (Sharing) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Export Excel',
            UTI: 'org.openxmlformats.spreadsheetml.sheet',
          });
          return true;
        }
      }

      // Fallback: Show alert with file location
      Alert.alert(
        'Excel Saved',
        `File saved to: ${fileUri}\n\nInstall expo-sharing for native share functionality.`
      );
      return true;
    }
  } catch (error) {
    console.error('Error downloading Excel:', error);
    return false;
  }
}

/**
 * Download the template Excel file
 */
export async function downloadExcelTemplate(): Promise<boolean> {
  return downloadExcel(EXCEL_TEMPLATE_DATA, 'workout-template.xlsx');
}

/**
 * Export a program to Excel
 */
export async function exportProgramToExcel(program: Program): Promise<boolean> {
  const parsedData = typeof program.parsedData === 'string'
    ? JSON.parse(program.parsedData)
    : program.parsedData;

  const workouts = parsedData?.workouts || [];

  // Build data array with header
  const data: any[][] = [
    ['Week', 'Day', 'Exercise', 'Sets', 'Reps', 'Weight', 'Rest (seconds)', 'Notes'],
  ];

  for (const workout of workouts) {
    for (const exercise of workout.exercises || []) {
      const restValue = exercise.restTime || exercise.restSeconds || '';
      data.push([
        workout.week || 1,
        workout.day || 1,
        exercise.name || '',
        exercise.sets || '',
        exercise.reps || '',
        exercise.weight || '',
        restValue,
        exercise.notes || '',
      ]);
    }
  }

  const safeName = program.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const filename = `${safeName}-workout.xlsx`;
  return downloadExcel(data, filename);
}

