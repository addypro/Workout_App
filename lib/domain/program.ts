/**
 * Domain: Program
 *
 * Goal: Keep types stable and independent of UI/data layers.
 * We currently re-export the existing canonical types from `lib/services/programs/types`
 * to avoid a risky big-bang move. Over time, we can migrate ownership here.
 */

export {
    DifficultyLevel,
    ProgramCategory, ProgramType, type Exercise, type ProgramDisplayItem, type Workout,
    type WorkoutProgram
} from '@/lib/services/programs/types';

export type ProgramSource = 'builtin' | 'uploaded' | 'saved';

export type ProgramId = string;


