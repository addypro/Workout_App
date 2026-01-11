/**
 * Rename Exercises with Parenthetical Equipment Notation
 *
 * Transforms: "Barbell Bicep Curl" → "Bicep Curl (Barbell)"
 * Transforms: "Alternating Double Dumbbell Bicep Curl" → "Bicep Curl (Dumbbell - Alternating)"
 *
 * Preserves original name as alias for search compatibility.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exercisesPath = path.join(__dirname, '../data/exercises-v2.9.json');

// ============================================
// EQUIPMENT PREFIXES TO TRANSFORM
// Order matters - longer/more specific patterns first
// ============================================

const EQUIPMENT_PATTERNS = [
  // Dumbbell variations (most specific first)
  { pattern: /^Alternating Double Dumbbell\s+/i, equipment: 'Dumbbell', variant: 'Alternating' },
  { pattern: /^Double Dumbbell\s+/i, equipment: 'Dumbbell', variant: 'Double' },
  { pattern: /^Single Dumbbell\s+/i, equipment: 'Dumbbell', variant: 'Single Arm' },
  { pattern: /^Alternating Dumbbell\s+/i, equipment: 'Dumbbell', variant: 'Alternating' },
  { pattern: /^Dumbbell\s+/i, equipment: 'Dumbbell', variant: null },

  // Kettlebell variations
  { pattern: /^Alternating Double Kettlebell Bottoms Up\s+/i, equipment: 'Kettlebell', variant: 'Bottoms Up Alternating' },
  { pattern: /^Double Kettlebell Bottoms Up\s+/i, equipment: 'Kettlebell', variant: 'Bottoms Up Double' },
  { pattern: /^Single Kettlebell Bottoms Up\s+/i, equipment: 'Kettlebell', variant: 'Bottoms Up Single Arm' },
  { pattern: /^Alternating Double Kettlebell\s+/i, equipment: 'Kettlebell', variant: 'Alternating' },
  { pattern: /^Double Kettlebell\s+/i, equipment: 'Kettlebell', variant: 'Double' },
  { pattern: /^Single Kettlebell\s+/i, equipment: 'Kettlebell', variant: 'Single Arm' },
  { pattern: /^Kettlebell\s+/i, equipment: 'Kettlebell', variant: null },

  // Barbell variations
  { pattern: /^Barbell Back Rack\s+/i, equipment: 'Barbell', variant: 'Back Rack' },
  { pattern: /^Barbell Front Rack\s+/i, equipment: 'Barbell', variant: 'Front Rack' },
  { pattern: /^Barbell\s+/i, equipment: 'Barbell', variant: null },

  // EZ Bar
  { pattern: /^EZ Bar Close Grip\s+/i, equipment: 'EZ Bar', variant: 'Close Grip' },
  { pattern: /^EZ Bar\s+/i, equipment: 'EZ Bar', variant: null },

  // Cable
  { pattern: /^Cable\s+/i, equipment: 'Cable', variant: null },

  // Smith Machine
  { pattern: /^Smith Machine\s+/i, equipment: 'Smith Machine', variant: null },
];

// Exercises to skip (already have good names or are bodyweight)
const SKIP_PATTERNS = [
  /^Bodyweight/i,
  /^Banded/i,
  /^Band /i,
  /^TRX/i,
  /^Landmine/i,  // Keep as prefix
  /^Trap Bar/i,  // Keep as prefix
  /^Safety Bar/i,
];

// ============================================
// TRANSFORMATION LOGIC
// ============================================

function transformExerciseName(exercise) {
  const originalName = exercise.name;

  // Check if we should skip this exercise
  for (const skipPattern of SKIP_PATTERNS) {
    if (skipPattern.test(originalName)) {
      return null; // No change needed
    }
  }

  // Try each equipment pattern
  for (const { pattern, equipment, variant } of EQUIPMENT_PATTERNS) {
    if (pattern.test(originalName)) {
      // Extract the core exercise name
      const coreName = originalName.replace(pattern, '').trim();

      // Skip if core name is too short or empty
      if (coreName.length < 3) {
        return null;
      }

      // Build the new name
      let suffix = equipment;
      if (variant) {
        suffix = `${equipment} - ${variant}`;
      }

      const newName = `${coreName} (${suffix})`;

      return {
        originalName,
        newName,
        equipment,
        variant,
        coreName
      };
    }
  }

  return null; // No pattern matched
}

function ensureAliasExists(exercise, originalName) {
  if (!exercise.aliases) {
    exercise.aliases = [];
  }

  // Add original name as alias if not already present
  const aliasLower = originalName.toLowerCase();
  const hasAlias = exercise.aliases.some(a => a.toLowerCase() === aliasLower);

  if (!hasAlias) {
    exercise.aliases.push(originalName);
  }

  // Also add common variations for searchability
  const variations = [];

  // Add "Barbell X" alias for "(Barbell)" exercises
  if (exercise.name.includes('(Barbell)')) {
    const baseName = exercise.name.replace(/\s*\(Barbell\)\s*$/, '');
    variations.push(`Barbell ${baseName}`);
  }

  // Add "Dumbbell X" alias for "(Dumbbell" exercises
  if (exercise.name.includes('(Dumbbell')) {
    const baseName = exercise.name.replace(/\s*\(Dumbbell[^)]*\)\s*$/, '');
    variations.push(`Dumbbell ${baseName}`);

    // Add specific variations
    if (exercise.name.includes('Alternating')) {
      variations.push(`Alternating Dumbbell ${baseName}`);
    }
    if (exercise.name.includes('Double')) {
      variations.push(`Double Dumbbell ${baseName}`);
    }
  }

  // Add "Cable X" alias for "(Cable)" exercises
  if (exercise.name.includes('(Cable)')) {
    const baseName = exercise.name.replace(/\s*\(Cable\)\s*$/, '');
    variations.push(`Cable ${baseName}`);
  }

  // Add unique variations as aliases
  for (const variation of variations) {
    const varLower = variation.toLowerCase();
    if (!exercise.aliases.some(a => a.toLowerCase() === varLower) &&
        exercise.name.toLowerCase() !== varLower) {
      exercise.aliases.push(variation);
    }
  }
}

// ============================================
// MAIN SCRIPT
// ============================================

console.log('Reading exercises...');
const exercises = JSON.parse(fs.readFileSync(exercisesPath, 'utf-8'));
console.log(`Found ${exercises.length} exercises`);

let renamedCount = 0;
const renamedExercises = [];
const byEquipment = {};

for (const exercise of exercises) {
  const transform = transformExerciseName(exercise);

  if (transform) {
    const { originalName, newName, equipment, variant, coreName } = transform;

    // Track by equipment for summary
    if (!byEquipment[equipment]) {
      byEquipment[equipment] = [];
    }
    byEquipment[equipment].push({ from: originalName, to: newName });

    // Update exercise
    exercise.name = newName;
    ensureAliasExists(exercise, originalName);

    renamedCount++;
    renamedExercises.push({ from: originalName, to: newName });
  }
}

// Sort exercises alphabetically by new name
exercises.sort((a, b) => a.name.localeCompare(b.name));

// Write back
fs.writeFileSync(exercisesPath, JSON.stringify(exercises, null, 2));

console.log(`\n✓ Renamed ${renamedCount} exercises`);
console.log('\nBy equipment type:');
for (const [equipment, list] of Object.entries(byEquipment)) {
  console.log(`  ${equipment}: ${list.length} exercises`);
}

console.log('\nSample transformations:');
const samples = renamedExercises.slice(0, 20);
for (const { from, to } of samples) {
  console.log(`  "${from}"`);
  console.log(`    → "${to}"`);
}

if (renamedExercises.length > 20) {
  console.log(`  ... and ${renamedExercises.length - 20} more`);
}

console.log('\n✓ Original names preserved as aliases for search compatibility');
