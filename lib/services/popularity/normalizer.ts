/**
 * Exercise Name Normalizer
 *
 * Normalizes exercise names for consistent matching between
 * user-entered names and canonical taxonomy names.
 */

/**
 * Normalize an exercise name for comparison
 * - Lowercase
 * - Remove extra whitespace
 * - Remove common variations
 */
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove common parenthetical notes
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    // Normalize common abbreviations
    .replace(/\bdb\b/gi, 'dumbbell')
    .replace(/\bbb\b/gi, 'barbell')
    .replace(/\bsldl\b/gi, 'stiff leg deadlift')
    .replace(/\brdl\b/gi, 'romanian deadlift')
    // Remove trailing/leading spaces again
    .trim();
}

/**
 * Create a canonical key for an exercise
 * Used for matching in popularity lookups
 */
export function createCanonicalKey(name: string): string {
  return normalizeExerciseName(name)
    // Remove all non-alphanumeric characters
    .replace(/[^a-z0-9\s]/g, '')
    // Replace spaces with underscores
    .replace(/\s+/g, '_');
}

/**
 * Check if two exercise names likely refer to the same exercise
 */
export function exerciseNamesMatch(name1: string, name2: string): boolean {
  return createCanonicalKey(name1) === createCanonicalKey(name2);
}

/**
 * Extract the base exercise name (without equipment/variation modifiers)
 */
export function extractBaseExercise(name: string): string {
  const normalized = normalizeExerciseName(name);

  // Common equipment prefixes to remove
  const equipmentPrefixes = [
    'barbell',
    'dumbbell',
    'cable',
    'machine',
    'smith machine',
    'kettlebell',
    'ez bar',
    'resistance band',
  ];

  let base = normalized;
  for (const prefix of equipmentPrefixes) {
    if (base.startsWith(prefix + ' ')) {
      base = base.substring(prefix.length + 1);
      break;
    }
  }

  return base.trim();
}
