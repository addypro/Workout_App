/**
 * Test ExerciseDB Integration
 * 
 * Verifies that cached exercises work correctly.
 * Run with: npx ts-node scripts/test-exercisedb.ts
 */

import * as fs from 'fs';

const CACHE_FILE = './data/exercisedb-cache.json';
const MAPPING_FILE = './data/exercisedb-mapping.json';

interface CachedExercise {
    exerciseId: string;
    name: string;
    gifUrl: string;
    targetMuscles: string[];
    bodyParts: string[];
    equipments: string[];
}

async function testGifUrl(url: string): Promise<boolean> {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

async function main() {
    console.log('🧪 Testing ExerciseDB Integration\n');

    // Test 1: Load cache
    console.log('1️⃣ Loading cache...');
    if (!fs.existsSync(CACHE_FILE)) {
        console.log('   ❌ Cache file not found!');
        return;
    }
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    console.log(`   ✅ Loaded ${cache.exercises.length} exercises\n`);

    // Test 2: Load mapping
    console.log('2️⃣ Loading mapping...');
    if (!fs.existsSync(MAPPING_FILE)) {
        console.log('   ❌ Mapping file not found!');
        return;
    }
    const mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'));
    console.log(`   ✅ Loaded mapping with ${mapping.stats.matched} matched exercises\n`);

    // Test 3: Sample exercises
    console.log('3️⃣ Sample cached exercises:');
    const samples = cache.exercises.slice(0, 5);
    for (const ex of samples) {
        console.log(`   - ${ex.name}`);
        console.log(`     Muscles: ${ex.targetMuscles.join(', ')}`);
        console.log(`     Equipment: ${ex.equipments.join(', ')}`);
        console.log(`     GIF: ${ex.gifUrl ? '✓' : '✗'}`);
    }
    console.log();

    // Test 4: Verify GIF URLs are accessible
    console.log('4️⃣ Testing GIF accessibility (first 3)...');
    const testExercises = cache.exercises.slice(0, 3);
    for (const ex of testExercises) {
        const accessible = await testGifUrl(ex.gifUrl);
        console.log(`   ${accessible ? '✅' : '❌'} ${ex.name}: ${ex.gifUrl.substring(0, 50)}...`);
    }
    console.log();

    // Test 5: Check mapping has GIF URLs
    console.log('5️⃣ Matched taxonomy exercises with GIFs:');
    let withGifs = 0;
    const matchedExercises: string[] = [];
    for (const [name, data] of Object.entries(mapping.mapping)) {
        const m = data as { exerciseDbId: string; gifUrl: string; matchScore: number };
        if (m.exerciseDbId && m.gifUrl) {
            withGifs++;
            if (matchedExercises.length < 10) {
                matchedExercises.push(`${name} → ${m.gifUrl.substring(0, 40)}...`);
            }
        }
    }
    console.log(`   Total with GIFs: ${withGifs}`);
    console.log('   Sample mappings:');
    matchedExercises.forEach(m => console.log(`   - ${m}`));
    console.log();

    // Summary
    console.log('📊 Summary:');
    console.log(`   Cached exercises: ${cache.exercises.length}`);
    console.log(`   Taxonomy matched: ${mapping.stats.matched}`);
    console.log(`   With GIF URLs: ${withGifs}`);
    console.log('\n✅ Test complete!');
}

main();
