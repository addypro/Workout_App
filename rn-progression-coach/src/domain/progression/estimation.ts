import { clamp } from '../../lib/units';

// Epley: 1RM = w * (1 + reps/30)
export function estimate1rmEpley(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

// Convert RPE (~reps in reserve) to an adjustment factor.
// This is a pragmatic heuristic: each RIR ~ 3%.
export function adjustForRpe(estimated1rm: number, rpe: number): number {
  // RPE 10 -> 0 RIR, RPE 9 -> 1 RIR, etc.
  const rir = clamp(10 - rpe, 0, 5);
  const factor = 1 - rir * 0.03;
  return estimated1rm * factor;
}
