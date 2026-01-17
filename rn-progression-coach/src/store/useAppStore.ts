import { create } from 'zustand';
import { ActiveProgramPlan, ExerciseContext, ProgramId, WorkoutLog, ExerciseLog, WorkoutPlan, UnitSystem } from '../types/models';
import { listPrograms, buildWorkoutPlans, defaultPlanConfig } from '../domain/programs';
import { stableHash } from '../lib/hash';
import { getLatestActivePlan, upsertActivePlan, getAllExerciseContexts, upsertExerciseContext, insertWorkoutLog, getWorkoutLogById } from '../db/queries';
import { applyProgression } from '../domain/progression/rules';

interface AppState {
  isBootstrapped: boolean;
  programs: { programId: ProgramId; kaggleName: string; workoutCount: number }[];
  workoutPlansByProgram: Record<string, WorkoutPlan[]>;
  activePlan: ActiveProgramPlan | null;
  exerciseContexts: Record<string, ExerciseContext>;

  bootstrap: () => Promise<void>;

  startProgram: (programId: ProgramId, unitSystem: UnitSystem) => Promise<ActiveProgramPlan>;
  setActivePlanWorkoutIndex: (planId: string, idx: number) => Promise<void>;

  refreshContexts: () => Promise<void>;

  saveWorkoutLog: (log: WorkoutLog) => Promise<void>;
  loadWorkoutLog: (workoutLogId: string) => Promise<WorkoutLog | null>;

  upsertExerciseContextFromLog: (workoutLog: WorkoutLog, ex: ExerciseLog) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  isBootstrapped: false,
  programs: [],
  workoutPlansByProgram: {},
  activePlan: null,
  exerciseContexts: {},

  bootstrap: async () => {
    const programs = listPrograms();
    const activePlan = await getLatestActivePlan();
    const contexts = await getAllExerciseContexts();

    const workoutPlansByProgram: Record<string, WorkoutPlan[]> = {};
    // Lazy build only for active plan on bootstrap
    if (activePlan) {
      workoutPlansByProgram[activePlan.programId] = await buildWorkoutPlans(activePlan.programId);
    }

    set({ programs, activePlan, exerciseContexts: contexts, workoutPlansByProgram, isBootstrapped: true });
  },

  startProgram: async (programId, unitSystem) => {
    const cfg = defaultPlanConfig(programId);
    const planId = await stableHash(`${programId}::${new Date().toISOString()}`);
    const plan: ActiveProgramPlan = {
      planId,
      programId,
      startedAt: new Date().toISOString(),
      currentWorkoutIndex: 0,
      unitSystem,
      defaultUpperIncrement: cfg.defaultUpperIncrement,
      defaultLowerIncrement: cfg.defaultLowerIncrement,
      progressionProfile: cfg.progressionProfile,
    };

    await upsertActivePlan(plan);
    const workoutPlans = await buildWorkoutPlans(programId);

    set((s) => ({
      activePlan: plan,
      workoutPlansByProgram: { ...s.workoutPlansByProgram, [programId]: workoutPlans },
    }));

    return plan;
  },

  setActivePlanWorkoutIndex: async (planId, idx) => {
    const ap = get().activePlan;
    if (!ap || ap.planId !== planId) return;
    const updated = { ...ap, currentWorkoutIndex: idx };
    await upsertActivePlan(updated);
    set({ activePlan: updated });
  },

  refreshContexts: async () => {
    const contexts = await getAllExerciseContexts();
    set({ exerciseContexts: contexts });
  },

  saveWorkoutLog: async (log) => {
    await insertWorkoutLog(log);
  },

  loadWorkoutLog: async (workoutLogId) => {
    return await getWorkoutLogById(workoutLogId);
  },

  upsertExerciseContextFromLog: async (workoutLog, ex) => {
    const ap = get().activePlan;
    if (!ap) return;

    const workoutPlans = get().workoutPlansByProgram[workoutLog.programId];
    const plan = workoutPlans?.find((p) => p.workoutId === workoutLog.workoutId);
    if (!plan) return;
    const pres = plan.exercises.find((e) => e.canonicalName === ex.canonicalName);
    if (!pres) return;

    const prevCtx = get().exerciseContexts[ex.canonicalName];
    const update = applyProgression(ap.progressionProfile, pres, prevCtx, ex.sets, {
      unitUpperInc: ap.defaultUpperIncrement,
      unitLowerInc: ap.defaultLowerIncrement,
    });

    await upsertExerciseContext(update.context);
    // Refresh local cache cheaply
    set((s) => ({ exerciseContexts: { ...s.exerciseContexts, [update.context.canonicalName]: update.context } }));
  },
}));
