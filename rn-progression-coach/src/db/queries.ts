import { getDb } from './db';
import { ActiveProgramPlan, ExerciseContext, WorkoutLog, ExerciseLog, SetLog } from '../types/models';

export async function upsertActivePlan(plan: ActiveProgramPlan): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO active_program_plan (plan_id, program_id, started_at, current_workout_index, unit_system, default_upper_increment, default_lower_increment, progression_profile)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(plan_id) DO UPDATE SET
       program_id=excluded.program_id,
       started_at=excluded.started_at,
       current_workout_index=excluded.current_workout_index,
       unit_system=excluded.unit_system,
       default_upper_increment=excluded.default_upper_increment,
       default_lower_increment=excluded.default_lower_increment,
       progression_profile=excluded.progression_profile
    `,
    [
      plan.planId,
      plan.programId,
      plan.startedAt,
      plan.currentWorkoutIndex,
      plan.unitSystem,
      plan.defaultUpperIncrement,
      plan.defaultLowerIncrement,
      plan.progressionProfile,
    ]
  );
}

export async function getLatestActivePlan(): Promise<ActiveProgramPlan | null> {
  const db = getDb();
  const row = await db.getFirstAsync<any>(`SELECT * FROM active_program_plan ORDER BY started_at DESC LIMIT 1`);
  if (!row) return null;
  return {
    planId: row.plan_id,
    programId: row.program_id,
    startedAt: row.started_at,
    currentWorkoutIndex: row.current_workout_index,
    unitSystem: row.unit_system,
    defaultUpperIncrement: row.default_upper_increment,
    defaultLowerIncrement: row.default_lower_increment,
    progressionProfile: row.progression_profile,
  };
}

export async function getAllExerciseContexts(): Promise<Record<string, ExerciseContext>> {
  const db = getDb();
  const rows = await db.getAllAsync<any>(`SELECT * FROM exercise_context`);
  const out: Record<string, ExerciseContext> = {};
  for (const r of rows) {
    out[r.canonical_name] = {
      canonicalName: r.canonical_name,
      kind: r.kind,
      est1rm: r.est1rm ?? undefined,
      lastWorkingWeight: r.last_working_weight ?? undefined,
      preferredIncrement: r.preferred_increment ?? undefined,
      lastAvgRpe: r.last_avg_rpe ?? undefined,
      difficultyLevel: r.difficulty_level ?? undefined,
      lastDurationSeconds: r.last_duration_seconds ?? undefined,
      lastDistanceMeters: r.last_distance_meters ?? undefined,
      updatedAt: r.updated_at,
    };
  }
  return out;
}

export async function upsertExerciseContext(ctx: ExerciseContext): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO exercise_context (canonical_name, kind, est1rm, last_working_weight, preferred_increment, last_avg_rpe, difficulty_level, last_duration_seconds, last_distance_meters, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(canonical_name) DO UPDATE SET
       kind=excluded.kind,
       est1rm=excluded.est1rm,
       last_working_weight=excluded.last_working_weight,
       preferred_increment=excluded.preferred_increment,
       last_avg_rpe=excluded.last_avg_rpe,
       difficulty_level=excluded.difficulty_level,
       last_duration_seconds=excluded.last_duration_seconds,
       last_distance_meters=excluded.last_distance_meters,
       updated_at=excluded.updated_at
    `,
    [
      ctx.canonicalName,
      ctx.kind,
      ctx.est1rm ?? null,
      ctx.lastWorkingWeight ?? null,
      ctx.preferredIncrement ?? null,
      ctx.lastAvgRpe ?? null,
      ctx.difficultyLevel ?? null,
      ctx.lastDurationSeconds ?? null,
      ctx.lastDistanceMeters ?? null,
      ctx.updatedAt,
    ]
  );
}

export async function insertWorkoutLog(workoutLog: WorkoutLog): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO workout_log (workout_log_id, plan_id, program_id, workout_id, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?)
    `,
    [workoutLog.workoutLogId, workoutLog.planId, workoutLog.programId, workoutLog.workoutId, workoutLog.startedAt, workoutLog.finishedAt ?? null]
  );

  for (const ex of workoutLog.exercises) {
    const exId = `${workoutLog.workoutLogId}::${ex.canonicalName}`;
    await db.runAsync(
      `INSERT INTO exercise_log (id, workout_log_id, canonical_name, raw_name, kind, notes)
       VALUES (?, ?, ?, ?, ?, ?)
      `,
      [exId, workoutLog.workoutLogId, ex.canonicalName, ex.rawName, ex.kind, ex.notes ?? null]
    );

    for (const s of ex.sets) {
      const setId = `${exId}::${s.setIndex}`;
      await db.runAsync(
        `INSERT INTO set_log (id, exercise_log_id, set_index, target_reps, target_seconds, suggested_load, actual_reps, actual_seconds, actual_load, rpe, is_completed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          setId,
          exId,
          s.setIndex,
          s.targetReps ?? null,
          s.targetSeconds ?? null,
          s.suggestedLoad ?? null,
          s.actualReps ?? null,
          s.actualSeconds ?? null,
          s.actualLoad ?? null,
          s.rpe ?? null,
          s.isCompleted ? 1 : 0,
        ]
      );
    }
  }
}

export async function getWorkoutLogById(workoutLogId: string): Promise<WorkoutLog | null> {
  const db = getDb();
  const wl = await db.getFirstAsync<any>(`SELECT * FROM workout_log WHERE workout_log_id = ?`, [workoutLogId]);
  if (!wl) return null;

  const exRows = await db.getAllAsync<any>(`SELECT * FROM exercise_log WHERE workout_log_id = ?`, [workoutLogId]);
  const exercises: ExerciseLog[] = [];

  for (const ex of exRows) {
    const setRows = await db.getAllAsync<any>(`SELECT * FROM set_log WHERE exercise_log_id = ? ORDER BY set_index ASC`, [ex.id]);
    const sets: SetLog[] = setRows.map((s) => ({
      setIndex: s.set_index,
      targetReps: s.target_reps ?? undefined,
      targetSeconds: s.target_seconds ?? undefined,
      suggestedLoad: s.suggested_load ?? undefined,
      actualReps: s.actual_reps ?? undefined,
      actualSeconds: s.actual_seconds ?? undefined,
      actualLoad: s.actual_load ?? undefined,
      rpe: s.rpe ?? undefined,
      isCompleted: s.is_completed === 1,
    }));

    exercises.push({
      canonicalName: ex.canonical_name,
      rawName: ex.raw_name,
      kind: ex.kind,
      notes: ex.notes ?? undefined,
      sets,
    });
  }

  return {
    workoutLogId: wl.workout_log_id,
    planId: wl.plan_id,
    programId: wl.program_id,
    workoutId: wl.workout_id,
    startedAt: wl.started_at,
    finishedAt: wl.finished_at ?? undefined,
    exercises,
  };
}

export async function getRecentExerciseLogs(canonicalName: string, limit: number = 10): Promise<{ workoutLogId: string; startedAt: string; sets: SetLog[] }[]> {
  const db = getDb();
  const exRows = await db.getAllAsync<any>(
    `SELECT el.id AS ex_id, wl.workout_log_id AS workout_log_id, wl.started_at AS started_at
     FROM exercise_log el
     JOIN workout_log wl ON wl.workout_log_id = el.workout_log_id
     WHERE el.canonical_name = ?
     ORDER BY wl.started_at DESC
     LIMIT ?`,
    [canonicalName, limit]
  );

  const out: { workoutLogId: string; startedAt: string; sets: SetLog[] }[] = [];
  for (const r of exRows) {
    const setRows = await db.getAllAsync<any>(`SELECT * FROM set_log WHERE exercise_log_id = ? ORDER BY set_index ASC`, [r.ex_id]);
    out.push({
      workoutLogId: r.workout_log_id,
      startedAt: r.started_at,
      sets: setRows.map((s) => ({
        setIndex: s.set_index,
        targetReps: s.target_reps ?? undefined,
        targetSeconds: s.target_seconds ?? undefined,
        suggestedLoad: s.suggested_load ?? undefined,
        actualReps: s.actual_reps ?? undefined,
        actualSeconds: s.actual_seconds ?? undefined,
        actualLoad: s.actual_load ?? undefined,
        rpe: s.rpe ?? undefined,
        isCompleted: s.is_completed === 1,
      })),
    });
  }
  return out;
}
