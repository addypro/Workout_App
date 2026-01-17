import programsJson from '../data/programs.json';
import { ProgramId, ProgramJson, WorkoutPlan, WorkoutJson, ExercisePrescription, SetPrescription, ActiveProgramPlan, ProgressionProfile } from '../types/models';
import { parseRepSpec, inferExerciseKind, canonicalizeExerciseName } from './parse';
import { stableHash } from '../lib/hash';

const programs = programsJson as ProgramJson;

export function listPrograms(): { programId: ProgramId; kaggleName: string; workoutCount: number }[] {
  return Object.entries(programs).map(([programId, p]) => ({
    programId,
    kaggleName: p.kaggleName,
    workoutCount: p.workouts.length,
  }));
}

export function getProgram(programId: ProgramId) {
  const p = programs[programId];
  if (!p) throw new Error(`Unknown programId: ${programId}`);
  return p;
}

export function guessProgressionProfile(programId: ProgramId): ProgressionProfile {
  const id = programId.toLowerCase();
  if (id.includes('wendler') || id.includes('531') || id.includes('nsuns')) return 'PERCENT_TM';
  if (id.includes('stronglifts') || id.includes('starting-strength') || id.includes('greyskull') || id.includes('texas-method')) return 'LINEAR_LP';
  if (id.includes('bodyweight') || id.includes('convict') || id.includes('calisthenics')) return 'BODYWEIGHT_STEP';
  if (id.includes('couch') || id.includes('conditioning') || id.includes('soccer') || id.includes('basketball')) return 'CONDITIONING_PROGRESS';
  if (id.includes('mobility')) return 'MOBILITY_MAINTAIN';
  return 'DOUBLE_PROGRESSION';
}

function sortWorkouts(ws: WorkoutJson[]): WorkoutJson[] {
  return [...ws].sort((a, b) => (a.week - b.week) || (a.day - b.day) || a.name.localeCompare(b.name));
}

export async function buildWorkoutPlans(programId: ProgramId): Promise<WorkoutPlan[]> {
  const p = getProgram(programId);
  const ws = sortWorkouts(p.workouts);

  const plans: WorkoutPlan[] = [];
  for (const w of ws) {
    const workoutId = await stableHash(`${programId}::${w.week}::${w.day}::${w.name}`);
    const exercises: ExercisePrescription[] = w.exercises.map((ex) => {
      const kind = inferExerciseKind(ex);
      const canonical = canonicalizeExerciseName(ex.name);
      const repSpec = parseRepSpec(ex.reps);
      const sets: SetPrescription[] = Array.from({ length: ex.sets }).map((_, idx) => ({
        setIndex: idx,
        repSpec,
        // A default target RPE that the progression engine can override per profile
        targetRpe: kind === 'strength' ? 8 : kind === 'hypertrophy' ? 8 : 7,
      }));

      return {
        rawName: ex.name,
        canonicalName: canonical,
        kind,
        sets,
        defaultRestSeconds: Math.max(0, Math.round(ex.restTime * 60)),
      };
    });

    plans.push({
      workoutId,
      programId,
      week: w.week,
      day: w.day,
      name: w.name,
      exercises,
    });
  }

  return plans;
}

export function defaultPlanConfig(programId: ProgramId): Pick<ActiveProgramPlan, 'defaultUpperIncrement' | 'defaultLowerIncrement' | 'progressionProfile'> {
  const profile = guessProgressionProfile(programId);
  // naive defaults; user can edit
  return {
    progressionProfile: profile,
    defaultUpperIncrement: 2.5,
    defaultLowerIncrement: 5,
  };
}
