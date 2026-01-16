/**
 * Incremental ExerciseDB Fetch Script
 * 
 * Downloads exercises in small batches with state persistence.
 * Can be run multiple times - automatically resumes from where it left off.
 * 
 * Run with: npx ts-node scripts/fetch-exercisedb-incremental.ts
 */

const EXERCISEDB_BASE_URL = 'https://www.ascendapi.com/api/v1';
const OUTPUT_FILE = './data/exercisedb-cache.json';
const STATE_FILE = './data/exercisedb-fetch-state.json';
const PAGE_SIZE = 25;
const BATCH_SIZE = 5; // Fetch 5 pages per run
const DELAY_MS = 3000; // 3 seconds between requests

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

interface FetchState {
    nextOffset: number;
    totalExercises: number;
    exercises: ExerciseDBExercise[];
    lastFetchAt: string;
}

async function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(offset: number): Promise<{ exercises: ExerciseDBExercise[]; total: number } | null> {
    const url = `${EXERCISEDB_BASE_URL}/exercises?offset=${offset}&limit=${PAGE_SIZE}`;
    console.log(`  Fetching offset=${offset}...`);

    try {
        const response = await fetch(url);

        if (response.status === 429) {
            console.log('  ⚠️ Rate limited - stopping for this session');
            return null;
        }

        if (!response.ok) {
            console.log(`  ❌ Error: ${response.status}`);
            return null;
        }

        const data = await response.json();
        return {
            exercises: data.data || [],
            total: data.metadata?.totalExercises || 0,
        };
    } catch (error) {
        console.log(`  ❌ Network error: ${error}`);
        return null;
    }
}

async function loadState(): Promise<FetchState> {
    const fs = await import('fs');

    if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf-8');
        return JSON.parse(raw);
    }

    return {
        nextOffset: 0,
        totalExercises: 0,
        exercises: [],
        lastFetchAt: '',
    };
}

async function saveState(state: FetchState): Promise<void> {
    const fs = await import('fs');
    state.lastFetchAt = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function saveCache(exercises: ExerciseDBExercise[]): Promise<void> {
    const fs = await import('fs');
    const cache = {
        fetchedAt: new Date().toISOString(),
        version: '1.0.0',
        totalExercises: exercises.length,
        exercises,
    };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cache, null, 2));
}

async function main(): Promise<void> {
    console.log('🏋️ ExerciseDB Incremental Fetch\n');

    const state = await loadState();

    if (state.nextOffset > 0) {
        console.log(`📁 Resuming from offset ${state.nextOffset}`);
        console.log(`   Already have ${state.exercises.length} exercises\n`);
    }

    // Fetch first page if needed to get total
    if (state.totalExercises === 0) {
        const first = await fetchPage(0);
        if (!first) {
            console.log('❌ Could not fetch first page');
            return;
        }
        state.totalExercises = first.total;
        state.exercises.push(...first.exercises);
        state.nextOffset = PAGE_SIZE;
        await saveState(state);
        console.log(`  Total exercises: ${state.totalExercises}\n`);
        await delay(DELAY_MS);
    }

    // Check if complete
    if (state.nextOffset >= state.totalExercises) {
        console.log('✅ Already complete!');
        await saveCache(state.exercises);
        console.log(`📁 Cache saved: ${OUTPUT_FILE}`);
        return;
    }

    // Fetch batch
    let pagesThisRun = 0;

    while (state.nextOffset < state.totalExercises && pagesThisRun < BATCH_SIZE) {
        const result = await fetchPage(state.nextOffset);

        if (!result) {
            // Rate limited or error - save progress and exit
            await saveState(state);
            await saveCache(state.exercises);
            console.log(`\n📁 Progress saved. Have ${state.exercises.length}/${state.totalExercises} exercises`);
            console.log('   Run again later to continue.');
            return;
        }

        state.exercises.push(...result.exercises);
        state.nextOffset += PAGE_SIZE;
        pagesThisRun++;

        const progress = Math.round((state.exercises.length / state.totalExercises) * 100);
        console.log(`  Progress: ${progress}% (${state.exercises.length}/${state.totalExercises})`);

        await delay(DELAY_MS);
    }

    // Save progress
    await saveState(state);
    await saveCache(state.exercises);

    if (state.nextOffset >= state.totalExercises) {
        console.log(`\n✅ Complete! Downloaded ${state.exercises.length} exercises`);
        console.log(`📁 Cache saved: ${OUTPUT_FILE}`);

        // Clean up state file
        const fs = await import('fs');
        if (fs.existsSync(STATE_FILE)) {
            fs.unlinkSync(STATE_FILE);
        }
    } else {
        console.log(`\n📁 Batch complete. Have ${state.exercises.length}/${state.totalExercises} exercises`);
        console.log('   Run again to fetch more.');
    }
}

main();
