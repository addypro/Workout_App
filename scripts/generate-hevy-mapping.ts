#!/usr/bin/env npx ts-node
/**
 * Generate Hevy/Strong Exercise Mapping
 * 
 * Creates a mapping file that converts our taxonomy names to Hevy/Strong format:
 * - Our format: "Barbell Bench Press" (equipment prefix)
 * - Hevy/Strong format: "Bench Press (Barbell)" (equipment suffix)
 * 
 * Usage: npx ts-node scripts/generate-hevy-mapping.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Equipment mapping from our format to Hevy/Strong format
const EQUIPMENT_NORMALIZATION: Record<string, string> = {
    'barbell': 'Barbell',
    'dumbbell': 'Dumbbell',
    'dumbbells': 'Dumbbell',
    'kettlebell': 'Kettlebell',
    'kettlebells': 'Kettlebell',
    'cable': 'Cable',
    'cables': 'Cable',
    'machine': 'Machine',
    'smith_machine': 'Smith Machine',
    'smith machine': 'Smith Machine',
    'body weight': 'Bodyweight',
    'bodyweight': 'Bodyweight',
    'none': 'Bodyweight',
    'bench': 'Bench',
    'incline_bench': 'Incline Bench',
    'decline_bench': 'Decline Bench',
    'squat_rack': 'Barbell',
    'trap_bar': 'Trap Bar',
    'ez_bar': 'EZ Bar',
    'ez-bar': 'EZ Bar',
    'bands': 'Resistance Band',
    'resistance band': 'Resistance Band',
    'medicine_ball': 'Medicine Ball',
    'medicine ball': 'Medicine Ball',
    'foam_roll': 'Foam Roller',
    'foam roll': 'Foam Roller',
    'other': 'Other',
};

// Common exercise name transformations for Hevy/Strong format
const NAME_TRANSFORMATIONS: Record<string, string> = {
    // Prefix-to-suffix conversions
    'Barbell Bench Press': 'Bench Press (Barbell)',
    'Dumbbell Bench Press': 'Bench Press (Dumbbell)',
    'Barbell Back Squat': 'Squat (Barbell)',
    'Goblet Squat': 'Goblet Squat (Kettlebell)',
    'Conventional Deadlift': 'Deadlift (Barbell)',
    'Romanian Deadlift': 'Romanian Deadlift (Barbell)',
    'Sumo Deadlift': 'Sumo Deadlift (Barbell)',
    'Barbell Row': 'Bent Over Row (Barbell)',
    'Dumbbell Row': 'Single Arm Row (Dumbbell)',
    'Lat Pulldown': 'Lat Pulldown (Cable)',
    'Cable Row': 'Seated Row (Cable)',
    'Incline Bench Press': 'Incline Bench Press (Barbell)',
    'Overhead Press': 'Shoulder Press (Barbell)',
    'Dumbbell Shoulder Press': 'Shoulder Press (Dumbbell)',
};

interface TaxonomyExercise {
    id: string;
    canonical_name: string;
    constraints?: {
        equipment?: string[];
    };
    nlp_metadata?: {
        aliases?: string[];
    };
}

interface MovementPattern {
    pattern_id: string;
    exercises: TaxonomyExercise[];
}

interface TaxonomyData {
    movement_patterns: MovementPattern[];
}

interface HevyMapping {
    canonical_name: string;
    hevy_name: string;
    strong_name: string;
    equipment: string;
    import_aliases: string[];
}

/**
 * Convert our canonical name to Hevy/Strong format
 */
function toHevyFormat(canonicalName: string, equipment: string[]): string {
    // Check for manual transformation first
    if (NAME_TRANSFORMATIONS[canonicalName]) {
        return NAME_TRANSFORMATIONS[canonicalName];
    }

    // Get primary equipment
    const primaryEquipment = equipment[0] || 'bodyweight';
    const normalizedEquipment = EQUIPMENT_NORMALIZATION[primaryEquipment.toLowerCase()] ||
        primaryEquipment.charAt(0).toUpperCase() + primaryEquipment.slice(1);

    // If name already contains equipment prefix, remove it and add as suffix
    const lowerName = canonicalName.toLowerCase();
    const lowerEquip = primaryEquipment.toLowerCase();

    // Check if name starts with equipment (e.g., "Barbell Bench Press")
    if (lowerName.startsWith(lowerEquip + ' ')) {
        const baseName = canonicalName.substring(primaryEquipment.length + 1);
        return `${baseName} (${normalizedEquipment})`;
    }

    // Check if name starts with normalized equipment (e.g., "Dumbbell Curl")
    for (const [key, value] of Object.entries(EQUIPMENT_NORMALIZATION)) {
        if (lowerName.startsWith(key + ' ')) {
            const baseName = canonicalName.substring(key.length + 1);
            return `${baseName} (${value})`;
        }
    }

    // Name doesn't have equipment prefix, just add suffix if equipment is known
    if (normalizedEquipment && normalizedEquipment !== 'Bodyweight') {
        return `${canonicalName} (${normalizedEquipment})`;
    }

    // Bodyweight exercises don't need suffix in Hevy format
    return canonicalName;
}

/**
 * Generate import aliases for an exercise
 */
function generateAliases(canonicalName: string, hevyName: string, equipment: string[], existingAliases: string[] = []): string[] {
    const aliases = new Set<string>();

    // Add Hevy/Strong format
    aliases.add(hevyName);
    aliases.add(hevyName.toLowerCase());

    // Add canonical name and lowercase
    aliases.add(canonicalName);
    aliases.add(canonicalName.toLowerCase());

    // Add existing aliases
    existingAliases.forEach(a => {
        aliases.add(a);
        aliases.add(a.toLowerCase());
    });

    // Add without parentheses version
    const withoutParens = hevyName.replace(/\s*\([^)]+\)\s*/g, '').trim();
    if (withoutParens !== hevyName) {
        aliases.add(withoutParens);
        aliases.add(withoutParens.toLowerCase());
    }

    // Add common variations
    const variations = [
        canonicalName.replace(/-/g, ' '),
        canonicalName.replace(/ /g, '-'),
        hevyName.replace(/-/g, ' '),
    ];
    variations.forEach(v => aliases.add(v.toLowerCase()));

    return Array.from(aliases);
}

async function main() {
    const dataDir = path.join(__dirname, '..', 'data');
    const taxonomyPath = path.join(dataDir, 'exercise-taxonomy.json');
    const outputPath = path.join(dataDir, 'hevy-strong-mapping.json');

    console.log('🏋️  Generating Hevy/Strong Exercise Mapping\n');

    // Load taxonomy
    const taxonomyData: TaxonomyData = JSON.parse(fs.readFileSync(taxonomyPath, 'utf-8'));

    const mappings: HevyMapping[] = [];
    const seenNames = new Set<string>();

    // Process all exercises in taxonomy
    for (const pattern of taxonomyData.movement_patterns) {
        for (const exercise of pattern.exercises) {
            if (seenNames.has(exercise.canonical_name)) continue;
            seenNames.add(exercise.canonical_name);

            const equipment = exercise.constraints?.equipment || ['bodyweight'];
            const hevyName = toHevyFormat(exercise.canonical_name, equipment);
            const aliases = generateAliases(
                exercise.canonical_name,
                hevyName,
                equipment,
                exercise.nlp_metadata?.aliases || []
            );

            mappings.push({
                canonical_name: exercise.canonical_name,
                hevy_name: hevyName,
                strong_name: hevyName, // Same format
                equipment: equipment[0] || 'bodyweight',
                import_aliases: aliases,
            });
        }
    }

    // Sort alphabetically
    mappings.sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));

    // Write output
    const output = {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        description: 'Mapping between our exercise names and Hevy/Strong format',
        format: {
            our_format: 'Equipment Name (e.g., "Barbell Bench Press")',
            hevy_strong_format: 'Name (Equipment) (e.g., "Bench Press (Barbell)")',
        },
        exercises: mappings,
        stats: {
            total: mappings.length,
            withEquipmentSuffix: mappings.filter(m => m.hevy_name.includes('(')).length,
            bodyweight: mappings.filter(m => m.equipment === 'bodyweight' || m.equipment === 'none').length,
        },
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log(`✅ Generated mapping for ${mappings.length} exercises`);
    console.log(`   - With equipment suffix: ${output.stats.withEquipmentSuffix}`);
    console.log(`   - Bodyweight: ${output.stats.bodyweight}`);
    console.log(`\n📁 Output: ${outputPath}`);

    // Show sample mappings
    console.log('\n📋 Sample Mappings:');
    mappings.slice(0, 10).forEach(m => {
        console.log(`   ${m.canonical_name} → ${m.hevy_name}`);
    });
}

main().catch(console.error);
