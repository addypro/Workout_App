/**
 * UFIRE Scoring Engine
 *
 * Unified Fitness Intent & Recommendation Engine
 * Implements the Weighted Heuristic Scorer (WHS) algorithm for exercise ranking.
 *
 * Formula: S_i = ω₁·SemanticMatch + ω₂·UserFrequency + ω₃·GlobalPopularity + ω₄·ContextualFlow
 *
 * Weights (optimized for fitness applications):
 * - ω₁ = 0.45 (Semantic Match) - How well the phrase matches the exercise
 * - ω₂ = 0.30 (User Frequency) - How often user has performed this exercise
 * - ω₃ = 0.15 (Global Popularity) - Trending/popular exercises
 * - ω₄ = 0.10 (Contextual Flow) - Current workout context
 */

import { getExerciseFrequencyScores, getRecencyScore } from './frequency-tracker';
import { getContextualFlowScore, type WorkoutContext } from './contextual-flow';
import { getPopularityScores, getStaticPopularityScores } from '../../popularity';

// Cache for popularity scores (refreshed periodically)
let popularityCache: Record<string, number> = {};
let popularityCacheTime = 0;
const POPULARITY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get popularity score for an exercise (0-1 normalized)
 */
async function getPopularityScore(exerciseName: string): Promise<number> {
  const now = Date.now();

  // Refresh cache if expired
  if (now - popularityCacheTime > POPULARITY_CACHE_TTL || Object.keys(popularityCache).length === 0) {
    try {
      const staticScores = getStaticPopularityScores();
      popularityCache = await getPopularityScores(staticScores);
      popularityCacheTime = now;
    } catch (error) {
      console.warn('Error loading popularity scores:', error);
      // Use default score if cache fails
      return 0.5;
    }
  }

  // Get score and normalize to 0-1
  const score = popularityCache[exerciseName.toLowerCase()] ?? 50;
  return score / 100;
}

// UFIRE Weights (must sum to 1.0)
export const UFIRE_WEIGHTS = {
  semanticMatch: 0.45,    // ω₁
  userFrequency: 0.30,    // ω₂
  globalPopularity: 0.15, // ω₃
  contextualFlow: 0.10,   // ω₄
} as const;

// Confidence thresholds for auto-execution vs disambiguation
export const CONFIDENCE_THRESHOLDS = {
  autoExecute: 0.85,        // > 0.85: Auto-add exercise immediately
  disambiguate: 0.25,       // 0.25 - 0.85: Show disambiguation popup
  reject: 0.25,             // < 0.25: No valid matches found
} as const;

export interface ExerciseCandidate {
  id?: string;
  name: string;
  semanticScore: number;    // Raw score from search (0-100)
  equipment?: string[];
  muscleGroups?: string[];
  category?: string;
}

export interface ScoredExercise {
  id?: string;
  name: string;
  ufireScore: number;       // Final UFIRE score (0-1)
  confidence: number;       // Confidence level (0-1)
  breakdown: {
    semantic: number;       // Normalized 0-1
    frequency: number;      // Normalized 0-1
    popularity: number;     // Normalized 0-1
    contextual: number;     // Normalized 0-1
  };
  action: 'auto' | 'disambiguate' | 'reject';
}

export interface UFIREResult {
  topMatch: ScoredExercise | null;
  alternatives: ScoredExercise[];
  action: 'auto' | 'disambiguate' | 'reject';
  confidence: number;
}

/**
 * Normalize semantic score from search (0-100) to (0-1)
 */
function normalizeSemanticScore(score: number): number {
  return Math.min(1, Math.max(0, score / 100));
}

/**
 * Calculate UFIRE score for a single exercise
 */
async function calculateUFIREScore(
  candidate: ExerciseCandidate,
  context: WorkoutContext | null,
  userId: string = 'local'
): Promise<ScoredExercise> {
  // Get component scores
  const semantic = normalizeSemanticScore(candidate.semanticScore);

  // Get frequency scores (batch for efficiency)
  const frequencyScores = await getExerciseFrequencyScores([candidate.name], userId);
  const frequency = frequencyScores[candidate.name] || 0;

  // Get popularity score
  const popularity = await getPopularityScore(candidate.name);

  // Get contextual flow score
  const contextual = context
    ? getContextualFlowScore(candidate, context)
    : 0.5; // Neutral if no context

  // Calculate weighted UFIRE score
  const ufireScore =
    UFIRE_WEIGHTS.semanticMatch * semantic +
    UFIRE_WEIGHTS.userFrequency * frequency +
    UFIRE_WEIGHTS.globalPopularity * popularity +
    UFIRE_WEIGHTS.contextualFlow * contextual;

  // Calculate confidence (primarily based on semantic match with boost from other factors)
  const confidence = Math.min(1, semantic * 0.7 + ufireScore * 0.3);

  // Determine action based on confidence
  let action: 'auto' | 'disambiguate' | 'reject';
  if (confidence >= CONFIDENCE_THRESHOLDS.autoExecute) {
    action = 'auto';
  } else if (confidence >= CONFIDENCE_THRESHOLDS.reject) {
    action = 'disambiguate';
  } else {
    action = 'reject';
  }

  return {
    id: candidate.id,
    name: candidate.name,
    ufireScore,
    confidence,
    breakdown: {
      semantic,
      frequency,
      popularity,
      contextual,
    },
    action,
  };
}

/**
 * Score and rank a list of exercise candidates using UFIRE algorithm
 */
export async function scoreExercises(
  candidates: ExerciseCandidate[],
  context: WorkoutContext | null = null,
  userId: string = 'local'
): Promise<UFIREResult> {
  if (candidates.length === 0) {
    return {
      topMatch: null,
      alternatives: [],
      action: 'reject',
      confidence: 0,
    };
  }

  // Get frequency scores for all candidates at once
  const exerciseNames = candidates.map(c => c.name);
  const frequencyScores = await getExerciseFrequencyScores(exerciseNames, userId);

  // Score all candidates
  const scoredExercises: ScoredExercise[] = await Promise.all(
    candidates.map(async (candidate) => {
      const semantic = normalizeSemanticScore(candidate.semanticScore);
      const frequency = frequencyScores[candidate.name] || 0;
      const popularity = await getPopularityScore(candidate.name);
      const contextual = context
        ? getContextualFlowScore(candidate, context)
        : 0.5;

      const ufireScore =
        UFIRE_WEIGHTS.semanticMatch * semantic +
        UFIRE_WEIGHTS.userFrequency * frequency +
        UFIRE_WEIGHTS.globalPopularity * popularity +
        UFIRE_WEIGHTS.contextualFlow * contextual;

      const confidence = Math.min(1, semantic * 0.7 + ufireScore * 0.3);

      let action: 'auto' | 'disambiguate' | 'reject';
      if (confidence >= CONFIDENCE_THRESHOLDS.autoExecute) {
        action = 'auto';
      } else if (confidence >= CONFIDENCE_THRESHOLDS.reject) {
        action = 'disambiguate';
      } else {
        action = 'reject';
      }

      return {
        id: candidate.id,
        name: candidate.name,
        ufireScore,
        confidence,
        breakdown: { semantic, frequency, popularity, contextual },
        action,
      };
    })
  );

  // Sort by UFIRE score
  scoredExercises.sort((a, b) => b.ufireScore - a.ufireScore);

  const topMatch = scoredExercises[0];
  const alternatives = scoredExercises.slice(1, 4); // Top 3 alternatives

  // Determine overall action
  let overallAction: 'auto' | 'disambiguate' | 'reject';

  if (topMatch.action === 'auto') {
    // Check if there's a close second that might cause confusion
    if (alternatives.length > 0) {
      const scoreDiff = topMatch.ufireScore - alternatives[0].ufireScore;
      if (scoreDiff < 0.1) {
        // Close competition, ask for disambiguation
        overallAction = 'disambiguate';
      } else {
        overallAction = 'auto';
      }
    } else {
      overallAction = 'auto';
    }
  } else if (topMatch.action === 'disambiguate') {
    overallAction = 'disambiguate';
  } else {
    overallAction = 'reject';
  }

  return {
    topMatch,
    alternatives,
    action: overallAction,
    confidence: topMatch.confidence,
  };
}

/**
 * Quick score for a single exercise (used for real-time suggestions)
 */
export async function quickScore(
  exerciseName: string,
  semanticScore: number,
  context: WorkoutContext | null = null,
  userId: string = 'local'
): Promise<number> {
  const candidate: ExerciseCandidate = {
    name: exerciseName,
    semanticScore,
  };

  const scored = await calculateUFIREScore(candidate, context, userId);
  return scored.ufireScore;
}

/**
 * Get explanation of why an exercise was ranked
 */
export function explainScore(scored: ScoredExercise): string {
  const parts: string[] = [];

  if (scored.breakdown.semantic > 0.8) {
    parts.push('Strong name match');
  } else if (scored.breakdown.semantic > 0.5) {
    parts.push('Good name match');
  }

  if (scored.breakdown.frequency > 0.7) {
    parts.push('You do this often');
  } else if (scored.breakdown.frequency > 0.3) {
    parts.push('You\'ve done this before');
  }

  if (scored.breakdown.popularity > 0.7) {
    parts.push('Very popular exercise');
  }

  if (scored.breakdown.contextual > 0.7) {
    parts.push('Fits your current workout');
  } else if (scored.breakdown.contextual < 0.3) {
    parts.push('Different muscle group');
  }

  return parts.join(' • ') || 'Match found';
}
