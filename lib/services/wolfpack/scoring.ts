/**
 * Wolfpack Scoring Engine
 *
 * Calculates effort scores based on workout data.
 * Effort-based scoring rewards consistency and hard work over raw strength.
 *
 * Scoring Philosophy:
 * - Everyone can earn points regardless of fitness level
 * - Consistency is heavily rewarded (streak bonuses)
 * - Variety keeps things interesting (muscle group bonuses)
 * - Intensity matters but isn't everything
 */

import type { WorkoutSession, WorkoutSet } from '@/lib/types/workout-session';

import type { EffortBreakdown, EffortScore, ScoringConfig } from './types';

// ============================================
// DEFAULT SCORING CONFIG
// ============================================

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  baseCompletion: 100, // Points just for finishing
  pointsPerMinute: 2, // Encourages longer sessions
  maxMinutes: 90, // Cap to prevent gaming
  pointsPerSet: 10, // Volume matters
  streakMultiplier: 0.05, // 5% bonus per day
  maxStreakMultiplier: 0.5, // Max 50% bonus at 10+ days
  varietyBonus: 15, // Per unique muscle group
  intensityBonus: 5, // Per RPE point above 7
};

// ============================================
// MAIN SCORING FUNCTION
// ============================================

/**
 * Calculate effort score for a completed workout
 */
export function calculateEffortScore(
  workout: WorkoutSession,
  userId: string,
  currentStreak: number = 0,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): EffortScore {
  const breakdown = calculateBreakdown(workout, currentStreak, config);

  const basePoints = breakdown.completion;
  const volumeBonus = breakdown.volume + breakdown.duration;
  const streakBonus = breakdown.consistency;
  const intensityBonus = breakdown.intensity;
  const varietyBonus = breakdown.variety;

  const total = basePoints + volumeBonus + streakBonus + intensityBonus + varietyBonus;

  return {
    id: `score-${workout.id}-${Date.now()}`,
    userId,
    workoutId: workout.id,
    basePoints,
    volumeBonus,
    streakBonus,
    intensityBonus,
    varietyBonus,
    total: Math.round(total),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Calculate detailed breakdown of effort score
 */
export function calculateBreakdown(
  workout: WorkoutSession,
  currentStreak: number,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): EffortBreakdown {
  // 1. Completion points (just for finishing)
  const completion = config.baseCompletion;

  // 2. Volume points (sets completed)
  const completedSets = countCompletedSets(workout);
  const volumePoints = completedSets * config.pointsPerSet;

  // 3. Duration points (calculated from startTime and endTime)
  const durationMs = workout.endTime
    ? new Date(workout.endTime).getTime() - new Date(workout.startTime).getTime()
    : 0;
  const durationMinutes = Math.min(durationMs / 60000, config.maxMinutes);
  const durationPoints = Math.round(durationMinutes * config.pointsPerMinute);

  // 4. Intensity points (RPE-based)
  const avgRpe = calculateAverageRpe(workout);
  const rpeBonus = avgRpe > 7 ? (avgRpe - 7) * config.intensityBonus * completedSets : 0;

  // 5. Consistency points (streak bonus)
  const streakMultiplier = Math.min(
    currentStreak * config.streakMultiplier,
    config.maxStreakMultiplier
  );
  const consistencyPoints = Math.round(completion * streakMultiplier);

  // 6. Variety points (unique muscle groups)
  const uniqueMuscleGroups = countUniqueMuscleGroups(workout);
  const varietyPoints = uniqueMuscleGroups * config.varietyBonus;

  return {
    completion,
    volume: volumePoints,
    duration: durationPoints,
    intensity: Math.round(rpeBonus),
    consistency: consistencyPoints,
    variety: varietyPoints,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Count total completed sets in a workout
 */
function countCompletedSets(workout: WorkoutSession): number {
  return workout.exercises.reduce((total, exercise) => {
    return total + exercise.sets.filter((set) => set.isCompleted).length;
  }, 0);
}

/**
 * Calculate average RPE across all completed sets
 */
function calculateAverageRpe(workout: WorkoutSession): number {
  const allSets: WorkoutSet[] = [];

  workout.exercises.forEach((exercise) => {
    exercise.sets.forEach((set) => {
      if (set.isCompleted && set.rpe) {
        allSets.push(set);
      }
    });
  });

  if (allSets.length === 0) return 0;

  const totalRpe = allSets.reduce((sum, set) => sum + (set.rpe ?? 0), 0);
  return totalRpe / allSets.length;
}

/**
 * Count unique muscle groups targeted in workout
 * This is a simplified version - could be enhanced with exercise database lookup
 */
function countUniqueMuscleGroups(workout: WorkoutSession): number {
  const muscleGroups = new Set<string>();

  workout.exercises.forEach((exercise) => {
    // Simplified muscle group detection based on exercise name
    const name = exercise.name.toLowerCase();

    if (name.includes('squat') || name.includes('leg')) muscleGroups.add('legs');
    if (name.includes('bench') || name.includes('chest') || name.includes('push')) muscleGroups.add('chest');
    if (name.includes('deadlift') || name.includes('row') || name.includes('pull')) muscleGroups.add('back');
    if (name.includes('shoulder') || name.includes('press') || name.includes('ohp')) muscleGroups.add('shoulders');
    if (name.includes('curl') || name.includes('bicep')) muscleGroups.add('biceps');
    if (name.includes('tricep') || name.includes('extension')) muscleGroups.add('triceps');
    if (name.includes('core') || name.includes('ab') || name.includes('plank')) muscleGroups.add('core');
    if (name.includes('calf') || name.includes('calves')) muscleGroups.add('calves');
    if (name.includes('glute') || name.includes('hip')) muscleGroups.add('glutes');
  });

  return muscleGroups.size;
}

// ============================================
// TIER CALCULATIONS
// ============================================

/**
 * Determine tier based on all-time score
 */
export function getTierFromScore(totalScore: number): 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' {
  if (totalScore >= 50000) return 'diamond';
  if (totalScore >= 25000) return 'platinum';
  if (totalScore >= 10000) return 'gold';
  if (totalScore >= 3000) return 'silver';
  return 'bronze';
}

/**
 * Get promotion/demotion thresholds for a league
 */
export function getLeagueThresholds(leagueSize: number = 30): {
  promotionTop: number;
  demotionBottom: number;
} {
  // Top 20% promote, bottom 20% demote
  return {
    promotionTop: Math.ceil(leagueSize * 0.2),
    demotionBottom: Math.floor(leagueSize * 0.2),
  };
}

/**
 * Determine if a rank results in promotion, demotion, or staying
 */
export function getMovementFromRank(
  rank: number,
  leagueSize: number = 30
): 'promotion' | 'demotion' | 'stay' {
  const { promotionTop, demotionBottom } = getLeagueThresholds(leagueSize);

  if (rank <= promotionTop) return 'promotion';
  if (rank > leagueSize - demotionBottom) return 'demotion';
  return 'stay';
}

// ============================================
// SCORE DISPLAY HELPERS
// ============================================

/**
 * Format a score for display
 */
export function formatScore(score: number): string {
  if (score >= 1000) {
    return `${(score / 1000).toFixed(1)}k`;
  }
  return score.toString();
}

/**
 * Get tier display info
 */
export function getTierInfo(tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'): {
  name: string;
  color: string;
  icon: string;
  minScore: number;
} {
  const tiers = {
    bronze: { name: 'Bronze', color: '#CD7F32', icon: 'star', minScore: 0 },
    silver: { name: 'Silver', color: '#C0C0C0', icon: 'star.fill', minScore: 3000 },
    gold: { name: 'Gold', color: '#FFD700', icon: 'star.fill', minScore: 10000 },
    platinum: { name: 'Platinum', color: '#E5E4E2', icon: 'star.circle.fill', minScore: 25000 },
    diamond: { name: 'Diamond', color: '#B9F2FF', icon: 'sparkles', minScore: 50000 },
  };

  return tiers[tier];
}
