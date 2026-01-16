/**
 * Build ExerciseDB Mapping Script
 * 
 * Creates a mapping from our 429-exercise Hevy database to ExerciseDB IDs.
 * Uses fuzzy matching for GIF and instruction data.
 * 
 * Run with: npx ts-node scripts/build-exercisedb-mapping.ts
 */

// Use Hevy database as primary source (429 exercises)
const HEVY_FILE = './data/hevy-primary-database.json';
const TAXONOMY_FILE = './data/exercise-taxonomy.json'; // For NLP aliases
const CACHE_FILE = './data/exercisedb-cache.json';
const OUTPUT_FILE = './data/exercisedb-mapping.json';

// Simple Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

function similarity(a: string, b: string): number {
    const distance = levenshtein(a.toLowerCase(), b.toLowerCase());
    const maxLen = Math.max(a.length, b.length);
    return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

// Hevy exercise from primary database
interface HevyExercise {
    name: string;
    aliases: string[];
    category: string;
    equipment: string[];
}

interface ExerciseDBExercise {
    exerciseId: string;
    name: string;
    gifUrl: string;
    targetMuscles: string[];
    bodyParts: string[];
    equipments: string[];
    instructions?: string[];
}

interface Mapping {
    exerciseDbId: string;
    gifUrl: string;
    matchScore: number;
    matchedOn: string;
    hevyName: string;
    instructions?: string[];
}

function findBestMatch(
    exercise: HevyExercise,
    exerciseDb: ExerciseDBExercise[]
): { match: ExerciseDBExercise | null; score: number; matchedOn: string } {
    let bestMatch: ExerciseDBExercise | null = null;
    let bestScore = 0;
    let matchedOn = '';

    // Extract base name without equipment for better matching
    // "Bench Press (Barbell)" → "Bench Press"
    const baseNameMatch = exercise.name.match(/^(.+?)\s*\([^)]+\)$/);
    const baseName = baseNameMatch ? baseNameMatch[1] : exercise.name;

    // Names to check: Hevy name, base name, and aliases
    const namesToCheck = [
        exercise.name,
        baseName,
        ...exercise.aliases,
    ];

    for (const name of namesToCheck) {
        const normalizedName = name.toLowerCase().replace(/[^a-z0-9\s]/g, '');

        for (const dbExercise of exerciseDb) {
            const normalizedDbName = dbExercise.name.toLowerCase().replace(/[^a-z0-9\s]/g, '');

            // Check exact match first
            if (normalizedName === normalizedDbName) {
                return { match: dbExercise, score: 1, matchedOn: name };
            }

            // Check word overlap
            const nameWords = new Set(normalizedName.split(/\s+/));
            const dbWords = new Set(normalizedDbName.split(/\s+/));
            const intersection = [...nameWords].filter(w => dbWords.has(w));
            const wordOverlap = intersection.length / Math.max(nameWords.size, dbWords.size);

            // Combine with string similarity
            const stringSim = similarity(normalizedName, normalizedDbName);
            const combinedScore = wordOverlap * 0.6 + stringSim * 0.4;

            if (combinedScore > bestScore) {
                bestScore = combinedScore;
                bestMatch = dbExercise;
                matchedOn = name;
            }
        }
    }

    return { match: bestMatch, score: bestScore, matchedOn };
}

async function main(): Promise<void> {
    const fs = await import('fs');

    // Load Hevy database (primary source)
    console.log('📚 Loading Hevy primary database...');
    if (!fs.existsSync(HEVY_FILE)) {
        console.error('❌ Hevy database not found. Run hevy migration first.');
        process.exit(1);
    }
    const hevyRaw = fs.readFileSync(HEVY_FILE, 'utf-8');
    const hevyDb: HevyExercise[] = JSON.parse(hevyRaw);
    console.log(`   Found ${hevyDb.length} exercises in Hevy database`);

    // Load ExerciseDB cache
    console.log('📦 Loading ExerciseDB cache...');
    if (!fs.existsSync(CACHE_FILE)) {
        console.error('❌ Cache file not found. Run fetch-exercisedb.ts first.');
        process.exit(1);
    }
    const cacheRaw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(cacheRaw);
    const exerciseDb: ExerciseDBExercise[] = cache.exercises;
    console.log(`   Found ${exerciseDb.length} exercises in ExerciseDB cache`);

    // Build mapping
    console.log('\n🔗 Building mapping from Hevy to ExerciseDB...');
    const mapping: Record<string, Mapping> = {};
    let matched = 0;
    let unmatched = 0;
    const THRESHOLD = 0.6;

    for (const exercise of hevyDb) {
        const { match, score, matchedOn } = findBestMatch(exercise, exerciseDb);

        const key = exercise.name.toLowerCase();

        if (match && score >= THRESHOLD) {
            mapping[key] = {
                exerciseDbId: match.exerciseId,
                gifUrl: match.gifUrl,
                matchScore: Math.round(score * 100) / 100,
                matchedOn,
                hevyName: exercise.name,
                instructions: match.instructions,
            };
            matched++;
            console.log(`   ✅ ${exercise.name} → ${match.name} (${Math.round(score * 100)}%)`);
        } else {
            // Store as unmapped for reference
            mapping[key] = {
                exerciseDbId: '',
                gifUrl: '',
                matchScore: score,
                matchedOn: 'UNMATCHED',
                hevyName: exercise.name,
            };
            unmatched++;
            console.log(`   ❌ ${exercise.name} (best: ${Math.round(score * 100)}%)`);
        }
    }

    // Write mapping
    const output = {
        generatedAt: new Date().toISOString(),
        version: '3.0.0',
        source: 'hevy-primary-database.json (429 exercises)',
        stats: {
            totalHevy: hevyDb.length,
            matched,
            unmatched,
            matchRate: `${Math.round((matched / hevyDb.length) * 100)}%`,
            exerciseDbCacheSize: exerciseDb.length,
        },
        mapping,
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

    console.log(`\n✅ Mapping complete!`);
    console.log(`📁 Output: ${OUTPUT_FILE}`);
    console.log(`\n📊 Statistics:`);
    console.log(`   Hevy Database: ${hevyDb.length} exercises`);
    console.log(`   ExerciseDB Cache: ${exerciseDb.length} exercises`);
    console.log(`   Matched: ${matched} (${Math.round((matched / hevyDb.length) * 100)}%)`);
    console.log(`   Unmatched: ${unmatched}`);

    // Report potential for improvement
    if (matched < exerciseDb.length * 0.5) {
        console.log(`\n💡 Tip: More ExerciseDB exercises are available. Continue fetching to improve coverage.`);
    }
}

main();

