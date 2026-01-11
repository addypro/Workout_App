/**
 * Voice/NLP Workout Entry Parser
 *
 * Parses natural language workout entries like:
 * - "Bench press 225 for 5"
 * - "Squat 3 sets of 8 at 185"
 * - "Did 10 pull ups"
 * - "Deadlift 315 x 3"
 */

import { searchExercisesAdvanced } from '@/lib/services/exercise/search';

// ============================================
// TYPES
// ============================================

export interface ParsedSetEntry {
  exerciseName: string;
  exerciseMatch?: {
    id: string;
    name: string;
    confidence: number;
  };
  sets: number;
  reps: number;
  weight?: number;
  weightUnit: 'lbs' | 'kg';
  notes?: string;
  rawInput: string;
  confidence: number;
}

export interface ParserResult {
  success: boolean;
  entry?: ParsedSetEntry;
  error?: string;
  suggestions?: string[];
}

// ============================================
// PATTERNS
// ============================================

/**
 * Common patterns for workout logging
 */
const PATTERNS = {
  // "Bench press 225 for 5" or "Bench 225 x 5"
  exerciseWeightReps: /^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:lbs?|kg|pounds?|kilos?)?\s*(?:for|x|×|at|@)?\s*(\d+)(?:\s*(?:reps?|times?))?$/i,

  // "3 sets of 8 bench press at 185"
  setsOfReps: /^(\d+)\s*(?:sets?\s*(?:of|x|×))?\s*(\d+)\s+(.+?)(?:\s+(?:at|@|with)\s*(\d+(?:\.\d+)?)\s*(?:lbs?|kg)?)?$/i,

  // "Did 10 pull ups" or "10 pushups"
  simpleReps: /^(?:did\s+)?(\d+)\s+(.+?)(?:\s*(?:reps?|times?))?$/i,

  // "Squat 185 3x8" or "Deadlift 315 3 x 5"
  exerciseWeightSetsReps: /^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:lbs?|kg)?\s+(\d+)\s*[x×]\s*(\d+)$/i,

  // "3x8 squats" or "3 x 10 bench"
  setsRepsExercise: /^(\d+)\s*[x×]\s*(\d+)\s+(.+?)(?:\s+(?:at|@|with)\s*(\d+(?:\.\d+)?)\s*(?:lbs?|kg)?)?$/i,

  // Extract weight unit
  weightUnit: /(\d+(?:\.\d+)?)\s*(kg|kilos?|pounds?|lbs?)/i,

  // Just exercise and weight: "Bench 225"
  exerciseWeight: /^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:lbs?|kg|pounds?|kilos?)?$/i,
};

/**
 * Common exercise aliases for better matching
 */
const EXERCISE_ALIASES: Record<string, string[]> = {
  'bench press': ['bench', 'bp', 'flat bench'],
  'incline bench press': ['incline bench', 'incline', 'ibp'],
  'squat': ['squats', 'back squat', 'barbell squat'],
  'deadlift': ['dl', 'deads'],
  'pull up': ['pull ups', 'pullup', 'pullups', 'chin up', 'chin ups'],
  'push up': ['push ups', 'pushup', 'pushups'],
  'overhead press': ['ohp', 'shoulder press', 'military press'],
  'barbell row': ['bb row', 'bent over row', 'row'],
  'lat pulldown': ['lat pull', 'pulldown', 'pull down'],
  'bicep curl': ['curls', 'curl', 'biceps', 'dumbbell curl', 'db curl'],
  'tricep extension': ['triceps', 'tricep', 'skull crusher', 'skullcrusher'],
  'leg press': ['legpress'],
  'romanian deadlift': ['rdl', 'romanian dl', 'stiff leg deadlift'],
  'hip thrust': ['hip thrusts', 'glute bridge'],
  'calf raise': ['calf raises', 'calves'],
  'lateral raise': ['lateral raises', 'side raise', 'side raises'],
};

// ============================================
// PARSER FUNCTIONS
// ============================================

/**
 * Parse natural language workout entry
 */
export async function parseWorkoutEntry(input: string): Promise<ParserResult> {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed || trimmed.length < 3) {
    return {
      success: false,
      error: 'Input too short',
      suggestions: ['Try: "Bench 225 for 5" or "3x8 squats at 185"'],
    };
  }

  // Try each pattern
  let parsed: Partial<ParsedSetEntry> | null = null;

  // Pattern 1: "Bench press 225 for 5"
  const match1 = trimmed.match(PATTERNS.exerciseWeightReps);
  if (match1) {
    parsed = {
      exerciseName: match1[1].trim(),
      weight: parseFloat(match1[2]),
      reps: parseInt(match1[3]),
      sets: 1,
    };
  }

  // Pattern 2: "3 sets of 8 bench press at 185"
  if (!parsed) {
    const match2 = trimmed.match(PATTERNS.setsOfReps);
    if (match2) {
      parsed = {
        sets: parseInt(match2[1]),
        reps: parseInt(match2[2]),
        exerciseName: match2[3].trim(),
        weight: match2[4] ? parseFloat(match2[4]) : undefined,
      };
    }
  }

  // Pattern 3: "Squat 185 3x8"
  if (!parsed) {
    const match3 = trimmed.match(PATTERNS.exerciseWeightSetsReps);
    if (match3) {
      parsed = {
        exerciseName: match3[1].trim(),
        weight: parseFloat(match3[2]),
        sets: parseInt(match3[3]),
        reps: parseInt(match3[4]),
      };
    }
  }

  // Pattern 4: "3x8 squats at 185"
  if (!parsed) {
    const match4 = trimmed.match(PATTERNS.setsRepsExercise);
    if (match4) {
      parsed = {
        sets: parseInt(match4[1]),
        reps: parseInt(match4[2]),
        exerciseName: match4[3].trim(),
        weight: match4[4] ? parseFloat(match4[4]) : undefined,
      };
    }
  }

  // Pattern 5: Simple reps "Did 10 pull ups"
  if (!parsed) {
    const match5 = trimmed.match(PATTERNS.simpleReps);
    if (match5) {
      parsed = {
        reps: parseInt(match5[1]),
        exerciseName: match5[2].trim(),
        sets: 1,
      };
    }
  }

  // Pattern 6: Just exercise and weight "Bench 225"
  if (!parsed) {
    const match6 = trimmed.match(PATTERNS.exerciseWeight);
    if (match6) {
      parsed = {
        exerciseName: match6[1].trim(),
        weight: parseFloat(match6[2]),
        sets: 1,
        reps: 1, // Default to 1 rep if not specified
      };
    }
  }

  // If no pattern matched
  if (!parsed || !parsed.exerciseName) {
    return {
      success: false,
      error: 'Could not parse workout entry',
      suggestions: [
        'Try: "Bench 225 for 5"',
        'Try: "3x8 squats at 185"',
        'Try: "10 pull ups"',
      ],
    };
  }

  // Detect weight unit
  const unitMatch = input.match(PATTERNS.weightUnit);
  const weightUnit: 'lbs' | 'kg' = unitMatch
    ? (unitMatch[2].toLowerCase().startsWith('k') ? 'kg' : 'lbs')
    : 'lbs'; // Default to lbs

  // Try to match exercise name to database
  const exerciseMatch = await findBestExerciseMatch(parsed.exerciseName);

  // Calculate confidence
  const confidence = calculateConfidence(parsed, exerciseMatch);

  const entry: ParsedSetEntry = {
    exerciseName: parsed.exerciseName,
    exerciseMatch: exerciseMatch || undefined,
    sets: parsed.sets || 1,
    reps: parsed.reps || 1,
    weight: parsed.weight,
    weightUnit,
    rawInput: input,
    confidence,
  };

  return {
    success: true,
    entry,
  };
}

/**
 * Find best matching exercise from database
 */
async function findBestExerciseMatch(
  exerciseName: string
): Promise<{ id: string; name: string; confidence: number } | null> {
  // Check aliases first
  let searchTerm = exerciseName;
  for (const [canonical, aliases] of Object.entries(EXERCISE_ALIASES)) {
    if (aliases.some(a => exerciseName.includes(a) || a.includes(exerciseName))) {
      searchTerm = canonical;
      break;
    }
  }

  try {
    const results = await searchExercisesAdvanced(searchTerm);

    if (results.popular.length > 0) {
      const best = results.popular[0];
      // Calculate match confidence based on score
      const confidence = Math.min(100, best.score);
      return {
        id: best.id,
        name: best.name,
        confidence,
      };
    }

    // Check category results
    for (const cat of results.byCategory) {
      if (cat.exercises.length > 0) {
        const best = cat.exercises[0];
        return {
          id: best.id,
          name: best.name,
          confidence: Math.min(80, best.score),
        };
      }
    }
  } catch (error) {
    console.error('Error searching exercises:', error);
  }

  return null;
}

/**
 * Calculate overall parsing confidence
 */
function calculateConfidence(
  parsed: Partial<ParsedSetEntry>,
  exerciseMatch: { confidence: number } | null
): number {
  let confidence = 0;

  // Has exercise name
  if (parsed.exerciseName) confidence += 30;

  // Has valid reps (1-100)
  if (parsed.reps && parsed.reps >= 1 && parsed.reps <= 100) confidence += 20;

  // Has valid sets (1-20)
  if (parsed.sets && parsed.sets >= 1 && parsed.sets <= 20) confidence += 15;

  // Has reasonable weight (1-2000)
  if (parsed.weight && parsed.weight >= 1 && parsed.weight <= 2000) confidence += 15;

  // Exercise matched in database
  if (exerciseMatch) {
    confidence += Math.min(20, exerciseMatch.confidence / 5);
  }

  return Math.min(100, confidence);
}

/**
 * Format parsed entry for display
 */
export function formatParsedEntry(entry: ParsedSetEntry): string {
  const parts: string[] = [];

  const exerciseName = entry.exerciseMatch?.name || entry.exerciseName;
  parts.push(exerciseName);

  if (entry.weight) {
    parts.push(`${entry.weight} ${entry.weightUnit}`);
  }

  if (entry.sets > 1) {
    parts.push(`${entry.sets}x${entry.reps}`);
  } else {
    parts.push(`${entry.reps} reps`);
  }

  return parts.join(' • ');
}

/**
 * Get example inputs for voice logging
 */
export function getVoiceInputExamples(): string[] {
  return [
    'Bench press 225 for 5',
    '3 sets of 8 squats at 185',
    'Did 10 pull ups',
    'Deadlift 315 x 3',
    'Overhead press 135 3x8',
    '5x5 squats 225',
    'Bicep curls 35 for 12',
    'Lat pulldown 120 x 10',
  ];
}
