/**
 * Fetch ExerciseDB Script
 * 
 * Downloads all exercises from ExerciseDB API v1 and saves to a local JSON file.
 * Run with: npx ts-node scripts/fetch-exercisedb.ts
 * 
 * This eliminates runtime API costs by caching everything at build time.
 */

const EXERCISEDB_BASE_URL = 'https://www.ascendapi.com/api/v1';
const OUTPUT_FILE = './data/exercisedb-cache.json';
const PAGE_SIZE = 25; // API max limit
const DELAY_MS = 2000; // 2 seconds between requests
const MAX_RETRIES = 3;

interface ExerciseDBExercise {
    exerciseId: string;
    name: string;
    gifUrl: string;
    targetMuscles: string[];
    bodyParts: string[];
    equipments: string[];
    secondaryMuscles: string[];
    instructions: string[];
}

interface APIResponse {
    success: boolean;
    metadata: {
        totalExercises: number;
        totalPages: number;
        currentPage: number;
        nextPage: string | null;
    };
    data: ExerciseDBExercise[];
}

async function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(offset: number, retries = 0): Promise<APIResponse> {
    const url = `${EXERCISEDB_BASE_URL}/exercises?offset=${offset}&limit=${PAGE_SIZE}`;
    console.log(`  Fetching offset=${offset}...`);

    const response = await fetch(url);

    if (response.status === 429) {
        if (retries < MAX_RETRIES) {
            const backoffMs = DELAY_MS * Math.pow(2, retries);
            console.log(`  ⚠️ Rate limited, waiting ${backoffMs}ms before retry ${retries + 1}/${MAX_RETRIES}...`);
            await delay(backoffMs);
            return fetchPage(offset, retries + 1);
        }
        throw new Error(`Rate limited after ${MAX_RETRIES} retries`);
    }

    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

async function fetchAllExercises(): Promise<ExerciseDBExercise[]> {
    console.log('🏋️ Fetching ExerciseDB data...\n');

    const allExercises: ExerciseDBExercise[] = [];
    let offset = 0;
    let totalExercises = 0;

    // Fetch first page to get total count
    const firstPage = await fetchPage(0);
    totalExercises = firstPage.metadata.totalExercises;
    allExercises.push(...firstPage.data);
    offset += PAGE_SIZE;

    console.log(`  Total exercises: ${totalExercises}`);
    console.log(`  Pages to fetch: ${Math.ceil(totalExercises / PAGE_SIZE)}\n`);

    // Fetch remaining pages
    while (offset < totalExercises) {
        await delay(DELAY_MS);
        const page = await fetchPage(offset);
        allExercises.push(...page.data);
        offset += PAGE_SIZE;

        const progress = Math.round((allExercises.length / totalExercises) * 100);
        console.log(`  Progress: ${progress}% (${allExercises.length}/${totalExercises})`);
    }

    return allExercises;
}

async function main(): Promise<void> {
    try {
        const exercises = await fetchAllExercises();

        // Create cache object with metadata
        const cache = {
            fetchedAt: new Date().toISOString(),
            version: '1.0.0',
            totalExercises: exercises.length,
            exercises: exercises,
        };

        // Write to file
        const fs = await import('fs');
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cache, null, 2));

        console.log(`\n✅ Successfully cached ${exercises.length} exercises`);
        console.log(`📁 Output: ${OUTPUT_FILE}`);

        // Print some stats
        const uniqueBodyParts = new Set(exercises.flatMap(e => e.bodyParts));
        const uniqueEquipments = new Set(exercises.flatMap(e => e.equipments));
        const uniqueMuscles = new Set(exercises.flatMap(e => e.targetMuscles));

        console.log(`\n📊 Statistics:`);
        console.log(`   Body parts: ${uniqueBodyParts.size}`);
        console.log(`   Equipment types: ${uniqueEquipments.size}`);
        console.log(`   Target muscles: ${uniqueMuscles.size}`);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
