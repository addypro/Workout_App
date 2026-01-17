import { ExerciseContext, ExercisePrescription, ExerciseKind, ProgressionProfile, SetLog } from '../../types/models';
import { clamp, roundToIncrement } from '../../lib/units';
import { estimate1rmEpley, adjustForRpe } from './estimation';

export interface Suggestion {
  suggestedLoad?: number;
  rationale: string;
  minLoad?: number;
  maxLoad?: number;
}

export interface ProgressionUpdate {
  context: ExerciseContext;
  nextSuggestedLoad?: number;
  note: string;
}

export function defaultIncrementForKind(kind: ExerciseKind, upperInc: number, lowerInc: number): number {
  // crude heuristic
  if (kind === 'strength' || kind === 'hypertrophy') return upperInc;
  return upperInc;
}

function isLowerBody(canonicalName: string): boolean {
  const n = canonicalName.toLowerCase();
  return n.includes('squat') || n.includes('deadlift') || n.includes('leg') || n.includes('lunge') || n.includes('hip') || n.includes('glute');
}

export function pickIncrement(canonicalName: string, upperInc: number, lowerInc: number, ctx?: ExerciseContext): number {
  if (ctx?.preferredIncrement && ctx.preferredIncrement > 0) return ctx.preferredIncrement;
  return isLowerBody(canonicalName) ? lowerInc : upperInc;
}

export function suggestLoad(
  profile: ProgressionProfile,
  ex: ExercisePrescription,
  ctx: ExerciseContext | undefined,
  opts: { unitUpperInc: number; unitLowerInc: number }
): Suggestion {
  // Non-weighted categories
  if (ex.kind === 'mobility') return { rationale: 'Mobility: focus on quality; keep as written.' };
  if (ex.kind === 'conditioning') return { rationale: 'Conditioning: track completion; progress time/distance slowly.' };

  // Determine a base weight:
  // 1) last working weight, else
  // 2) inferred from est1rm and target reps @ RPE 8, else
  // 3) a conservative placeholder.
  const repTarget = ex.sets[0]?.repSpec.kind === 'reps' ? ex.sets[0].repSpec.value : 5;
  const targetRpe = ex.sets[0]?.targetRpe ?? 8;

  let base = ctx?.lastWorkingWeight;
  if (!base && ctx?.est1rm) {
    // Rough percent from reps:
    // 5 reps ~ 85%, 8 reps ~ 75%, 10 reps ~ 70%, 12 reps ~ 65%.
    const pct = repTarget <= 3 ? 0.9 : repTarget <= 5 ? 0.85 : repTarget <= 8 ? 0.75 : repTarget <= 10 ? 0.7 : 0.65;
    base = ctx.est1rm * pct;
    base = adjustForRpe(base, targetRpe);
  }

  if (!base) {
    // Conservative default: users will pick something and it becomes context.
    base = 20;
  }

  const inc = pickIncrement(ex.canonicalName, opts.unitUpperInc, opts.unitLowerInc, ctx);

  // Profile-specific adjustments
  let suggested = base;
  let rationale = 'Using last working weight.';

  if (!ctx?.lastWorkingWeight && ctx?.est1rm) {
    rationale = 'Using estimated 1RM from history.';
  }

  if (profile === 'LINEAR_LP') {
    // Start at base; increases happen after completing session.
    rationale += ' Linear LP: increase next session if you hit targets.';
  } else if (profile === 'DOUBLE_PROGRESSION') {
    rationale += ' Double progression: add reps first, then weight.';
  } else if (profile === 'PERCENT_TM') {
    // Without explicit %TM in dataset, we still act as if it is % based.
    // Keep base stable; adjust by weekly wave via week/day could be added later.
    rationale += ' %TM-style: keep effort on rails; adjust via performance.';
  } else if (profile === 'BODYWEIGHT_STEP') {
    return { rationale: 'Bodyweight/skills: progress difficulty level when sets feel easy.' };
  }

  // Provide a range for user agency
  const minLoad = Math.max(0, suggested - 2 * inc);
  const maxLoad = suggested + 2 * inc;

  return {
    suggestedLoad: roundToIncrement(suggested, inc),
    minLoad: roundToIncrement(minLoad, inc),
    maxLoad: roundToIncrement(maxLoad, inc),
    rationale,
  };
}

function summarizeSetLogs(sets: SetLog[]): { completed: number; total: number; avgRpe?: number; best1rm?: number; lastLoad?: number } {
  let completed = 0;
  let total = sets.length;
  let rpeSum = 0;
  let rpeCount = 0;
  let best1rm = 0;
  let lastLoad: number | undefined;

  for (const s of sets) {
    if (s.isCompleted) completed += 1;
    if (typeof s.rpe === 'number') {
      rpeSum += s.rpe;
      rpeCount += 1;
    }
    if (typeof s.actualLoad === 'number') lastLoad = s.actualLoad;
    if (typeof s.actualLoad === 'number' && typeof s.actualReps === 'number' && s.actualReps > 0) {
      const est = estimate1rmEpley(s.actualLoad, s.actualReps);
      best1rm = Math.max(best1rm, est);
    }
  }

  return {
    completed,
    total,
    avgRpe: rpeCount ? rpeSum / rpeCount : undefined,
    best1rm: best1rm || undefined,
    lastLoad,
  };
}

export function applyProgression(
  profile: ProgressionProfile,
  ex: ExercisePrescription,
  prevCtx: ExerciseContext | undefined,
  setLogs: SetLog[],
  opts: { unitUpperInc: number; unitLowerInc: number }
): ProgressionUpdate {
  const now = new Date().toISOString();
  const baseCtx: ExerciseContext = prevCtx ?? {
    canonicalName: ex.canonicalName,
    kind: ex.kind,
    updatedAt: now,
  };

  const inc = pickIncrement(ex.canonicalName, opts.unitUpperInc, opts.unitLowerInc, prevCtx);
  const summary = summarizeSetLogs(setLogs);

  const nextCtx: ExerciseContext = { ...baseCtx, updatedAt: now };
  let note = '';
  let nextSuggestedLoad: number | undefined;

  if (ex.kind === 'mobility') {
    note = 'Mobility logged.';
    return { context: nextCtx, note };
  }

  if (ex.kind === 'conditioning') {
    note = 'Conditioning logged.';
    // optionally track duration in last set
    const last = setLogs[setLogs.length - 1];
    if (last?.actualSeconds) nextCtx.lastDurationSeconds = last.actualSeconds;
    return { context: nextCtx, note };
  }

  if (ex.kind === 'bodyweight') {
    // If all sets completed and avgRpe <= 8, bump difficulty.
    const avgRpe = summary.avgRpe ?? 8;
    const allDone = summary.completed === summary.total;
    const level = nextCtx.difficultyLevel ?? 1;
    if (allDone && avgRpe <= 8) {
      nextCtx.difficultyLevel = level + 1;
      note = `Bodyweight: difficulty level → ${nextCtx.difficultyLevel}`;
    } else {
      nextCtx.difficultyLevel = level;
      note = 'Bodyweight: keep difficulty level.';
    }
    return { context: nextCtx, note };
  }

  // Weighted lifts
  if (summary.best1rm) {
    nextCtx.est1rm = summary.best1rm;
  }
  if (summary.lastLoad) {
    nextCtx.lastWorkingWeight = summary.lastLoad;
  }
  if (summary.avgRpe) {
    nextCtx.lastAvgRpe = summary.avgRpe;
  }

  const avgRpe = summary.avgRpe ?? 8;
  const hitAll = summary.completed === summary.total;

  if (profile === 'LINEAR_LP') {
    if (hitAll && avgRpe <= 9) {
      nextSuggestedLoad = roundToIncrement((nextCtx.lastWorkingWeight ?? 0) + inc, inc);
      note = `LP: hit targets (avg RPE ${avgRpe.toFixed(1)}). +${inc}`;
    } else if (!hitAll) {
      // Missed: small deload
      nextSuggestedLoad = roundToIncrement(Math.max(0, (nextCtx.lastWorkingWeight ?? 0) - 2 * inc), inc);
      note = `LP: missed targets. -${2 * inc} (deload)`;
    } else {
      nextSuggestedLoad = nextCtx.lastWorkingWeight;
      note = `LP: keep weight (avg RPE ${avgRpe.toFixed(1)}).`;
    }
  } else if (profile === 'DOUBLE_PROGRESSION') {
    // If very easy, bump weight; if hard, keep.
    if (hitAll && avgRpe <= 8) {
      nextSuggestedLoad = roundToIncrement((nextCtx.lastWorkingWeight ?? 0) + inc, inc);
      note = `DP: easy completion (avg RPE ${avgRpe.toFixed(1)}). +${inc}`;
    } else {
      nextSuggestedLoad = nextCtx.lastWorkingWeight;
      note = `DP: aim for more reps at same weight (avg RPE ${avgRpe.toFixed(1)}).`;
    }
  } else {
    // default
    if (hitAll && avgRpe <= 8.5) {
      nextSuggestedLoad = roundToIncrement((nextCtx.lastWorkingWeight ?? 0) + inc, inc);
      note = `Progress: +${inc}`;
    } else {
      nextSuggestedLoad = nextCtx.lastWorkingWeight;
      note = 'Progress: keep for next time.';
    }
  }

  return {
    context: nextCtx,
    nextSuggestedLoad,
    note,
  };
}
