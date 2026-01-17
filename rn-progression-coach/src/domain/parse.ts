import { ExerciseJson, RepSpec } from '../types/models';

export function parseRepSpec(reps: string): RepSpec {
  const trimmed = reps.trim().toLowerCase();
  // Time formats like "180s" or "10min"
  const secMatch = trimmed.match(/^([0-9]+)\s*s$/);
  if (secMatch) {
    return { kind: 'time', value: Number(secMatch[1]), unit: 's' };
  }
  const minMatch = trimmed.match(/^([0-9]+)\s*(min|m)$/);
  if (minMatch) {
    return { kind: 'time', value: Number(minMatch[1]) * 60, unit: 's' };
  }
  // Default: reps as integer
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n)) {
    // fallback to 0 reps
    return { kind: 'reps', value: 0 };
  }
  return { kind: 'reps', value: n };
}

export function inferExerciseKind(ex: ExerciseJson): 'strength' | 'hypertrophy' | 'bodyweight' | 'conditioning' | 'mobility' {
  const name = ex.name.toLowerCase();
  const repSpec = parseRepSpec(ex.reps);

  if (name.includes('stretch') || name.includes('mobility') || name.includes('rotation') || name.includes('ankle') || name.includes('pigeon')) {
    return 'mobility';
  }

  if (name.includes('walk') || name.includes('run') || name.includes('bike') || name.includes('row') || name.includes('battle ropes')) {
    return 'conditioning';
  }

  if (name.includes('push up') || name.includes('pull-up') || name.includes('chin-up') || name.includes('plank') || name.includes('dip')) {
    return 'bodyweight';
  }

  // If high reps/time, treat as hypertrophy/conditioning
  if (repSpec.kind === 'reps' && repSpec.value >= 12) return 'hypertrophy';

  return 'strength';
}

export function canonicalizeExerciseName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\(.*?\)/g, '')
    .trim()
    .toLowerCase();
}
