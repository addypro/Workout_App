/**
 * Wolfpack Types
 *
 * Defines data structures for the effort-based league system.
 * Wolfpacks are cohorts of ~30 users competing on weekly effort scores.
 */

// ============================================
// LEAGUE TYPES
// ============================================

export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface League {
  id: string;
  tier: LeagueTier;
  /** League week (ISO week number) */
  week: number;
  /** League year */
  year: number;
  /** Members in this league */
  members: LeagueMember[];
  /** Start date of the league week */
  startDate: string;
  /** End date of the league week */
  endDate: string;
  /** Whether the league is finalized */
  isFinalized: boolean;
}

export interface LeagueMember {
  userId: string;
  username: string;
  avatarUrl?: string;
  /** Current week's effort score */
  weekScore: number;
  /** All-time effort score */
  totalScore: number;
  /** Current rank in the league (1-indexed) */
  rank: number;
  /** Previous rank (for movement indicators) */
  previousRank?: number;
  /** Number of workouts this week */
  workoutsThisWeek: number;
  /** Current streak (days) */
  streak: number;
  /** Tier they will move to next week (based on current position) */
  projectedTier?: LeagueTier;
}

// ============================================
// EFFORT SCORING
// ============================================

export interface EffortScore {
  id: string;
  userId: string;
  workoutId: string;
  /** Base points from workout completion */
  basePoints: number;
  /** Bonus from exercise volume */
  volumeBonus: number;
  /** Bonus from consistency (streak) */
  streakBonus: number;
  /** Bonus from intensity (% of max) */
  intensityBonus: number;
  /** Bonus from variety (unique exercises) */
  varietyBonus: number;
  /** Total effort score */
  total: number;
  /** Timestamp */
  createdAt: string;
}

export interface EffortBreakdown {
  /** Completion: Did they finish? (100 base) */
  completion: number;
  /** Volume: Total sets × reps × weight */
  volume: number;
  /** Duration: Time spent (capped) */
  duration: number;
  /** Intensity: Average RPE or % of max */
  intensity: number;
  /** Consistency: Streak bonus */
  consistency: number;
  /** Variety: Unique muscle groups/exercises */
  variety: number;
}

// ============================================
// SCORING CONFIGURATION
// ============================================

export interface ScoringConfig {
  /** Base points for completing a workout */
  baseCompletion: number;
  /** Points per minute (capped) */
  pointsPerMinute: number;
  /** Maximum minutes counted */
  maxMinutes: number;
  /** Points per set completed */
  pointsPerSet: number;
  /** Streak multiplier (increases with streak) */
  streakMultiplier: number;
  /** Max streak bonus multiplier */
  maxStreakMultiplier: number;
  /** Variety bonus per unique muscle group */
  varietyBonus: number;
  /** Intensity bonus per RPE point above 7 */
  intensityBonus: number;
}

// ============================================
// PROMOTION/DEMOTION
// ============================================

export interface LeagueMovement {
  userId: string;
  fromTier: LeagueTier;
  toTier: LeagueTier;
  /** Reason for movement */
  reason: 'promotion' | 'demotion' | 'stay';
  /** Week the movement applies to */
  week: number;
  year: number;
}

// ============================================
// WOLFPACK STATE
// ============================================

export interface WolfpackState {
  /** User's current league */
  currentLeague: League | null;
  /** User's member data */
  userMember: LeagueMember | null;
  /** Recent effort scores */
  recentScores: EffortScore[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
}
