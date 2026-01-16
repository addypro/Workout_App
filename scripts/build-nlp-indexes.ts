/**
 * Build NLP Indexes Script
 * 
 * Generates pre-built hash maps from legacy taxonomy for O(1) lookups.
 * Run with: npx ts-node scripts/build-nlp-indexes.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Types for the output indexes (snake_case for backward compat with search.ts)
interface MovementPattern {
    pattern_id: string;
    canonical_name: string;
    description: string;
    icon: string;
    default_exercise_id: string;
    exercises: string[];
}

interface SlangEntry {
    direct_match?: string;
    description?: string;
}

interface ExerciseNLP {
    progression?: string;
    regression?: string;
    siblings?: string[];
    clarificationQuestion?: string;
    options?: Array<{ id: string; label: string; default?: boolean }>;
}

interface HevyNLPIndexes {
    version: string;
    generatedAt: string;
    stats: {
        aliasCount: number;
        slangCount: number;
        patternCount: number;
        intentCount: number;
        exerciseNLPCount: number;
    };
    aliasMap: Record<string, string>;
    slangDictionary: Record<string, SlangEntry>;
    movementPatterns: MovementPattern[];
    intentTriggers: Record<string, string[]>;
    exerciseNLP: Record<string, ExerciseNLP>;
}

// Paths
const TAXONOMY_PATH = path.join(__dirname, '../data/legacy/exercise-taxonomy.json');
const HEVY_DB_PATH = path.join(__dirname, '../data/hevy-primary-database.json');
const OUTPUT_PATH = path.join(__dirname, '../data/hevy-nlp-indexes.json');

function buildIndexes(): void {
    console.log('🔨 Building NLP indexes...\n');

    // Load taxonomy
    let taxonomyData: any;
    try {
        const taxonomyContent = fs.readFileSync(TAXONOMY_PATH, 'utf-8');
        taxonomyData = JSON.parse(taxonomyContent);
        console.log('✓ Loaded taxonomy file');
    } catch (e) {
        console.error('✗ Failed to load taxonomy:', e);
        process.exit(1);
    }

    // Load Hevy DB for canonical names
    let hevyDb: any[];
    try {
        const hevyContent = fs.readFileSync(HEVY_DB_PATH, 'utf-8');
        hevyDb = JSON.parse(hevyContent);
        console.log(`✓ Loaded Hevy database (${hevyDb.length} exercises)`);
    } catch (e) {
        console.error('✗ Failed to load Hevy database:', e);
        process.exit(1);
    }

    // Create Hevy name set for validation
    const hevyNames = new Set(hevyDb.map((ex: any) => ex.name.toLowerCase()));

    // Initialize indexes
    const aliasMap: Record<string, string> = {};
    const slangDictionary: Record<string, SlangEntry> = {};
    const movementPatterns: MovementPattern[] = [];
    const intentTriggers: Record<string, string[]> = {};
    const exerciseNLP: Record<string, ExerciseNLP> = {};

    // Process Hevy database aliases first (highest priority)
    for (const ex of hevyDb) {
        const canonical = ex.name;

        // Add canonical name as its own alias
        aliasMap[canonical.toLowerCase()] = canonical;

        // Add any aliases from Hevy DB
        if (ex.aliases && Array.isArray(ex.aliases)) {
            for (const alias of ex.aliases) {
                aliasMap[alias.toLowerCase()] = canonical;
            }
        }
    }
    console.log(`✓ Indexed ${Object.keys(aliasMap).length} Hevy aliases`);

    // Process movement patterns from taxonomy
    const patterns = taxonomyData.movement_patterns || [];
    for (const pattern of patterns) {
        const patternExercises: string[] = [];

        for (const ex of pattern.exercises || []) {
            const canonicalName = ex.canonical_name;
            patternExercises.push(canonicalName);

            // Extract NLP metadata
            const nlp = ex.nlp_metadata || {};

            // Add aliases
            for (const alias of nlp.aliases || []) {
                const key = alias.toLowerCase();
                if (!aliasMap[key]) {
                    aliasMap[key] = canonicalName;
                }
            }

            // Add slang terms
            for (const slang of nlp.slang_terms || []) {
                const key = slang.toLowerCase();
                if (!aliasMap[key]) {
                    aliasMap[key] = canonicalName;
                }
            }

            // Add misspellings
            for (const misspelling of nlp.misspellings || []) {
                const key = misspelling.toLowerCase();
                if (!aliasMap[key]) {
                    aliasMap[key] = canonicalName;
                }
            }

            // Add intent triggers
            for (const intent of nlp.intent_triggers || []) {
                const key = intent.toLowerCase();
                if (!intentTriggers[key]) {
                    intentTriggers[key] = [];
                }
                if (!intentTriggers[key].includes(canonicalName)) {
                    intentTriggers[key].push(canonicalName);
                }
            }

            // Extract smart suggestions and UI prompts
            const suggestions = ex.smart_suggestions || {};
            const ui = ex.ui_prompts || {};

            if (suggestions.progression_id || suggestions.regression_id ||
                suggestions.siblings?.length || ui.clarification_question || ui.options?.length) {
                exerciseNLP[canonicalName] = {
                    progression: suggestions.progression_id,
                    regression: suggestions.regression_id,
                    siblings: suggestions.siblings,
                    clarificationQuestion: ui.clarification_question,
                    options: ui.options,
                };
            }
        }

        // Add movement pattern (snake_case for backward compat)
        movementPatterns.push({
            pattern_id: pattern.pattern_id,
            canonical_name: pattern.canonical_name,
            description: pattern.description || '',
            icon: pattern.icon || 'figure.strengthtraining.traditional',
            default_exercise_id: pattern.default_exercise_id || '',
            exercises: patternExercises,
        });
    }
    console.log(`✓ Processed ${movementPatterns.length} movement patterns`);

    // Process slang dictionary
    const slang = taxonomyData.slang_dictionary || {};
    for (const [term, entry] of Object.entries(slang)) {
        slangDictionary[term.toLowerCase()] = entry as SlangEntry;

        // Also add to alias map if has direct_match
        const e = entry as SlangEntry;
        if (e.direct_match && !aliasMap[term.toLowerCase()]) {
            aliasMap[term.toLowerCase()] = e.direct_match;
        }
    }
    console.log(`✓ Processed ${Object.keys(slangDictionary).length} slang entries`);

    // Build final output
    const output: HevyNLPIndexes = {
        version: '1.0',
        generatedAt: new Date().toISOString(),
        stats: {
            aliasCount: Object.keys(aliasMap).length,
            slangCount: Object.keys(slangDictionary).length,
            patternCount: movementPatterns.length,
            intentCount: Object.keys(intentTriggers).length,
            exerciseNLPCount: Object.keys(exerciseNLP).length,
        },
        aliasMap,
        slangDictionary,
        movementPatterns,
        intentTriggers,
        exerciseNLP,
    };

    // Write output
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

    const fileSize = fs.statSync(OUTPUT_PATH).size;
    console.log(`\n✓ Generated ${OUTPUT_PATH}`);
    console.log(`  Size: ${(fileSize / 1024).toFixed(1)} KB`);
    console.log(`\n📊 Stats:`);
    console.log(`  - Aliases: ${output.stats.aliasCount}`);
    console.log(`  - Slang entries: ${output.stats.slangCount}`);
    console.log(`  - Movement patterns: ${output.stats.patternCount}`);
    console.log(`  - Intent triggers: ${output.stats.intentCount}`);
    console.log(`  - Exercise NLP: ${output.stats.exerciseNLPCount}`);
}

// Run
buildIndexes();
