/**
 * Excel Parser
 *
 * Parses .xlsx and .xls files into workout program format.
 * Uses the xlsx library for parsing.
 */

import * as XLSX from 'xlsx';
import type { ParsedWorkout, ParsedProgram } from '@/lib/types/program';
import { parseSetType } from '@/lib/utils/parser-utils';

// Extended result type that includes computed metadata
export interface ExcelParseResult extends ParsedProgram {
  totalWeeks: number;
  totalDays: number;
}

// Column name variations to handle different formats
const COLUMN_MAPPINGS: Record<string, string[]> = {
  week: ['week', 'wk', 'w'],
  day: ['day', 'd', 'workout day'],
  exercise: ['exercise', 'exercise name', 'name', 'movement'],
  sets: ['sets', 'set', 's'],
  reps: ['reps', 'rep', 'r', 'repetitions'],
  weight: ['weight', 'load', 'lbs', 'kg', 'wt'],
  rest: ['rest', 'rest (seconds)', 'rest time', 'rest (sec)', 'recovery'],
  notes: ['notes', 'note', 'comments', 'instructions'],
  setType: ['set type', 'settype', 'type', 'set_type', 'exercise type'],
};

/**
 * Normalize column header to standard name
 */
function normalizeColumnName(header: string): string | null {
  const lowerHeader = header.toLowerCase().trim();

  for (const [standardName, variations] of Object.entries(COLUMN_MAPPINGS)) {
    if (variations.some(v => lowerHeader === v || lowerHeader.includes(v))) {
      return standardName;
    }
  }

  return null;
}

/**
 * Parse Excel file content (as base64 or array buffer)
 */
export function parseExcel(data: ArrayBuffer | string, isBase64 = false): ExcelParseResult {
  // Parse the workbook
  const workbook = XLSX.read(data, {
    type: isBase64 ? 'base64' : 'array',
  });

  // Get the first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel file has no sheets');
  }

  const sheet = workbook.Sheets[sheetName];

  // Convert to JSON (array of arrays first to get headers)
  const rawData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

  if (rawData.length < 2) {
    throw new Error('Excel file must have at least a header row and one data row');
  }

  // First row is headers
  const headers = rawData[0].map(h => String(h || ''));

  // Map headers to standard names
  const columnMap: Record<number, string> = {};
  headers.forEach((header, index) => {
    const standardName = normalizeColumnName(header);
    if (standardName) {
      columnMap[index] = standardName;
    }
  });

  // Ensure we have required columns
  const hasExercise = Object.values(columnMap).includes('exercise');
  if (!hasExercise) {
    throw new Error('Excel file must have an Exercise column');
  }

  // Parse data rows
  const workoutMap = new Map<string, ParsedWorkout>();
  let maxWeek = 1;
  let maxDay = 1;

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    // Extract values using column map
    const getValue = (key: string): string => {
      const colIndex = Object.entries(columnMap).find(([_, v]) => v === key)?.[0];
      if (colIndex === undefined) return '';
      return String(row[parseInt(colIndex)] || '').trim();
    };

    const exerciseName = getValue('exercise');
    if (!exerciseName) continue; // Skip empty rows

    const week = parseInt(getValue('week')) || 1;
    const day = parseInt(getValue('day')) || 1;
    const sets = parseInt(getValue('sets')) || 3;
    const reps = getValue('reps') || '8-12';
    const weight = getValue('weight') || undefined;
    const restStr = getValue('rest');
    const restSeconds = restStr ? parseInt(restStr) : undefined;
    const notes = getValue('notes') || undefined;
    const setTypeStr = getValue('setType');
    const setType = parseSetType(setTypeStr);

    maxWeek = Math.max(maxWeek, week);
    maxDay = Math.max(maxDay, day);

    // Create workout key
    const workoutKey = `${week}-${day}`;

    if (!workoutMap.has(workoutKey)) {
      workoutMap.set(workoutKey, {
        week,
        day,
        name: `Week ${week} - Day ${day}`,
        exercises: [],
      });
    }

    workoutMap.get(workoutKey)!.exercises.push({
      name: exerciseName,
      sets,
      reps,
      weight,
      restSeconds,
      notes,
      setType,
    });
  }

  // Convert map to sorted array
  const workouts = Array.from(workoutMap.values()).sort((a, b) => {
    if (a.week !== b.week) return a.week - b.week;
    return a.day - b.day;
  });

  if (workouts.length === 0) {
    throw new Error('No valid workout data found in Excel file');
  }

  return {
    name: 'Imported Program',
    workouts,
    totalWeeks: maxWeek,
    totalDays: workouts.length,
  };
}

/**
 * Parse Excel file from a URI (for mobile)
 */
export async function parseExcelFromUri(uri: string): Promise<ExcelParseResult> {
  const FileSystem = require('expo-file-system');

  // Read file as base64
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return parseExcel(base64, true);
}

/**
 * Parse Excel file from web File object
 */
export async function parseExcelFromFile(file: File): Promise<ExcelParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        const result = parseExcel(data);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read Excel file'));
    reader.readAsArrayBuffer(file);
  });
}
