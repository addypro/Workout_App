
import fs from 'fs';
import path from 'path';

// Types (simplified for the script)
interface Exercise {
    name: string;
    sets: number | string | null;
    reps: number | string | null;
    weight: number | string | null;
    restTime?: number | null;
}

interface Workout {
    exercises: Exercise[];
}

interface Program {
    id: string;
    name: string;
    type?: string;
    workouts: Workout[];
}

const INPUT_FILE = path.join(process.cwd(), 'data/workout-programs.json');
const OUTPUT_FILE = path.join(process.cwd(), 'data/workout-programs-optimized.json');

// Heuristics Configuration
const MAX_MISSING_DATA_RATIO = 0.20; // 20%
const MIN_NAME_LENGTH = 4;
const BAD_NAME_KEYWORDS = ['test', 'temp', 'untitled', 'dummy', 'example'];
const MAX_SPECIAL_CHAR_RATIO = 0.3;

function isDataLacking(program: Program): boolean {
    let totalExercises = 0;
    let badExercises = 0;

    if (!program.workouts || program.workouts.length === 0) return true;

    for (const workout of program.workouts) {
        if (!workout.exercises || workout.exercises.length === 0) {
            // Empty workout counts as "bad" data
            // But maybe we just ignore it? Let's verify context.
            // If a program has workouts but no exercises, it's useless.
            continue;
        }

        for (const ex of workout.exercises) {
            totalExercises++;

            const hasName = ex.name && ex.name.trim().length > 1;
            const hasReps = ex.reps !== null && ex.reps !== undefined && ex.reps !== '';
            const hasSets = ex.sets !== null && ex.sets !== undefined;
            const hasTime = ex.restTime !== null; // some exercises are just time based?

            // heuristic: must have name AND (reps OR sets OR time or weight)
            // Actually, usually name is critical. If name is "Exercise 1" that's also bad.
            if (!hasName) {
                badExercises++;
            } else if (!hasReps && !hasSets && !hasTime) {
                // Might be a weird entry
                badExercises++;
            }
        }
    }

    if (totalExercises === 0) return true; // Empty program

    return (badExercises / totalExercises) > MAX_MISSING_DATA_RATIO;
}

function hasWeirdName(name: string): boolean {
    if (!name) return true;
    const trimmed = name.trim();

    if (trimmed.length < MIN_NAME_LENGTH) return true;

    const lower = trimmed.toLowerCase();
    if (BAD_NAME_KEYWORDS.some(kw => lower.includes(kw))) return true;

    // Check for excessive special characters (non-alphanumeric, non-space, non-parenthesis)
    const specialChars = trimmed.replace(/[a-zA-Z0-9\s()\-.]/g, '').length;
    if (specialChars / trimmed.length > MAX_SPECIAL_CHAR_RATIO) return true;

    return false;
}

async function optimize() {
    console.log(`Reading from ${INPUT_FILE}...`);

    try {
        const rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
        const data = JSON.parse(rawData);

        if (!data.programs || !Array.isArray(data.programs)) {
            console.error('Invalid JSON structure: expected "programs" array.');
            return;
        }

        const totalPrograms = data.programs.length;
        console.log(`Total programs found: ${totalPrograms}`);

        const optimizedPrograms = data.programs.filter((program: Program) => {
            // 1. Check Name
            if (hasWeirdName(program.name)) return false;

            // 2. Check Data Quality
            if (isDataLacking(program)) return false;

            // 3. check "useless" - e.g. single day programs that claim to be full programs but have 1 exercise?
            // Let's assume isDataLacking covers most "useless" cases (missing exercises).

            return true;
        });

        console.log(`Optimized programs count: ${optimizedPrograms.length}`);
        console.log(`Removed: ${totalPrograms - optimizedPrograms.length} programs`);

        const outputData = { programs: optimizedPrograms };
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2));
        console.log(`Wrote optimized database to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('Error optimizing database:', error);
    }
}

optimize();
