import { ExercisePrescription, ProgressionProfile, WorkoutPlan, WorkoutLog } from '../../types/models';
import { suggestLoad, applyProgression } from './rules';
import { useAppStore } from '../../store/useAppStore';

// Note: this module is "pure" if you pass in contexts.
// The screen layer uses store/db.

export function materializeWorkoutWithSuggestions(
  plan: WorkoutPlan,
  profile: ProgressionProfile,
  contexts: Record<string, any>,
  opts: { unitUpperInc: number; unitLowerInc: number }
): WorkoutPlan {
  const exercises = plan.exercises.map((ex) => {
    const ctx = contexts[ex.canonicalName];
    const s = suggestLoad(profile, ex, ctx, opts);
    if (typeof s.suggestedLoad === 'number') {
      return {
        ...ex,
        sets: ex.sets.map((set) => ({
          ...set,
          suggestedLoad: s.suggestedLoad,
          minLoad: s.minLoad,
          maxLoad: s.maxLoad,
        })),
      };
    }
    return ex;
  });

  return { ...plan, exercises };
}

export async function commitWorkoutLogAndUpdateContext(workoutLog: WorkoutLog): Promise<void> {
  const { upsertExerciseContextFromLog } = useAppStore.getState();
  for (const ex of workoutLog.exercises) {
    await upsertExerciseContextFromLog(workoutLog, ex);
  }
}

export { applyProgression };
