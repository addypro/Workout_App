/**
 * Shared Parser Utilities
 *
 * Common parsing functions used across CSV, Excel, and other parsers.
 * Centralizes set type parsing, normalization, and common patterns.
 */

import type { SetType } from '@/lib/types/workout-session';

// ============================================
// SET TYPE PARSING
// ============================================

/**
 * Parse set type from various string formats
 * Handles common naming conventions from different apps (Hevy, Strong, etc.)
 */
export function parseSetType(typeStr: string | undefined | null): SetType {
  if (!typeStr) return 'working';

  const normalized = typeStr.toLowerCase().trim();

  // Warmup variants
  if (
    normalized === 'warmup' ||
    normalized === 'warm up' ||
    normalized === 'warm-up' ||
    normalized === 'w' ||
    normalized === 'wu'
  ) {
    return 'warmup';
  }

  // Drop set variants
  if (
    normalized === 'dropset' ||
    normalized === 'drop set' ||
    normalized === 'drop-set' ||
    normalized === 'd' ||
    normalized === 'ds'
  ) {
    return 'drop';
  }

  // Failure set variants
  if (
    normalized === 'failure' ||
    normalized === 'to failure' ||
    normalized === 'amrap' ||
    normalized === 'f'
  ) {
    return 'failure';
  }

  // Top set variants
  if (
    normalized === 'top' ||
    normalized === 'top set' ||
    normalized === 'main' ||
    normalized === 'main set'
  ) {
    return 'top';
  }

  // Working set variants (explicit)
  if (
    normalized === 'working' ||
    normalized === 'work' ||
    normalized === 'normal' ||
    normalized === 'regular'
  ) {
    return 'working';
  }

  // Default to working set
  return 'working';
}

// ============================================
// STRING NORMALIZATION
// ============================================

/**
 * Normalize exercise name for comparison/matching
 * Removes special characters, normalizes case and whitespace
 */
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Remove common parenthetical suffixes
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    // Remove special characters except spaces and hyphens
    .replace(/[^\w\s-]/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    // Remove common articles
    .replace(/\b(the|a|an)\b/g, '')
    .trim();
}

/**
 * Normalize muscle group name for matching
 */
export function normalizeMuscleGroup(muscle: string): string {
  return muscle
    .toLowerCase()
    .trim()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Parse numeric value from string, handling common formats
 */
export function parseNumericValue(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }

  // Remove common non-numeric characters
  const cleaned = value
    .toString()
    .replace(/[^\d.-]/g, '')
    .trim();

  if (!cleaned) return null;

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse rep range string (e.g., "8-12" or "10")
 */
export function parseRepRange(reps: string): { min: number; max: number } | null {
  if (!reps) return null;

  const cleaned = reps.toString().trim();

  // Check for range format (e.g., "8-12")
  const rangeMatch = cleaned.match(/(\d+)\s*[-–—]\s*(\d+)/);
  if (rangeMatch) {
    return {
      min: parseInt(rangeMatch[1], 10),
      max: parseInt(rangeMatch[2], 10),
    };
  }

  // Single value
  const singleMatch = cleaned.match(/(\d+)/);
  if (singleMatch) {
    const value = parseInt(singleMatch[1], 10);
    return { min: value, max: value };
  }

  return null;
}

// ============================================
// COMMON PATTERNS
// ============================================

/**
 * Common equipment keywords for detection
 */
export const EQUIPMENT_KEYWORDS = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'smith',
  'bodyweight',
  'band',
  'resistance band',
  'ez bar',
  'trap bar',
] as const;

/**
 * Detect equipment from exercise name
 */
export function detectEquipment(exerciseName: string): string | null {
  const nameLower = exerciseName.toLowerCase();

  for (const equipment of EQUIPMENT_KEYWORDS) {
    if (nameLower.includes(equipment)) {
      return equipment;
    }
  }

  return null;
}

/**
 * Common muscle group mappings
 */
export const MUSCLE_GROUP_ALIASES: Record<string, string> = {
  // Chest aliases
  pecs: 'chest',
  pectorals: 'chest',
  'pec major': 'chest',
  'pec minor': 'chest',

  // Back aliases
  lats: 'back',
  latissimus: 'back',
  'upper back': 'back',
  'lower back': 'back',
  traps: 'back',
  trapezius: 'back',
  rhomboids: 'back',

  // Shoulder aliases
  delts: 'shoulders',
  deltoids: 'shoulders',
  'front delt': 'shoulders',
  'side delt': 'shoulders',
  'rear delt': 'shoulders',

  // Arm aliases
  bis: 'biceps',
  tris: 'triceps',

  // Leg aliases
  quads: 'quadriceps',
  hams: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',

  // Core aliases
  abs: 'core',
  abdominals: 'core',
  obliques: 'core',
};

/**
 * Normalize muscle group name using aliases
 */
export function resolveMuscleGroup(muscle: string): string {
  const normalized = normalizeMuscleGroup(muscle);
  return MUSCLE_GROUP_ALIASES[normalized] || normalized;
}
