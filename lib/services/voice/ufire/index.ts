/**
 * UFIRE - Unified Fitness Intent & Recommendation Engine
 *
 * A 4-layer intent engine for voice-commanded fitness applications:
 *
 * Layer 1: Context-Aware Semantic Parser (CASP)
 *   - Uses existing search with fuzzy matching
 *   - Converts spoken phrases to exercise vectors
 *
 * Layer 2: Weighted Heuristic Scorer (WHS)
 *   - Ranks candidates using: Semantic + Frequency + Popularity + Context
 *   - Formula: S_i = 0.45·Semantic + 0.30·Frequency + 0.15·Popularity + 0.10·Context
 *
 * Layer 3: Sequential Bayesian Predictor (SBP)
 *   - Predicts next likely exercise based on patterns
 *   - Common sequences (squats → lunges, bench → flies)
 *
 * Layer 4: Agentic Multi-Step Workflow
 *   - Complex commands like "Create a 4-day program"
 *   - Handled by Tier 3 LLM parsing
 */

// Scoring Engine - The core UFIRE algorithm
export {
  scoreExercises,
  quickScore,
  explainScore,
  UFIRE_WEIGHTS,
  CONFIDENCE_THRESHOLDS,
  type ExerciseCandidate,
  type ScoredExercise,
  type UFIREResult,
} from './scoring-engine';

// Frequency Tracker - User exercise history
export {
  recordExercisePerformed,
  recordWorkoutExercises,
  getExerciseFrequencyScore,
  getExerciseFrequencyScores,
  getTopExercises,
  getRecencyScore,
  clearFrequencyData,
  type ExerciseFrequencyData,
} from './frequency-tracker';

// Contextual Flow - Workout state analysis
export {
  getContextualFlowScore,
  predictNextExercise,
  inferWorkoutType,
  type WorkoutContext,
} from './contextual-flow';
