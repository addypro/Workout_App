/**
 * Pre-filtering Utilities
 *
 * Quick keyword-based checks to identify likely workout programs
 * before invoking expensive Claude Vision API calls.
 */

// High-confidence workout keywords (presence strongly suggests workout content)
const WORKOUT_KEYWORDS_PRIMARY = [
  'sets',
  'reps',
  'workout',
  'exercise',
  'training',
  'superset',
  'dropset',
  'warmup',
  'warm-up',
  'cooldown',
  'cool-down',
];

// Secondary keywords (support primary keywords)
const WORKOUT_KEYWORDS_SECONDARY = [
  'rpe',
  'rir',
  'amrap',
  'tempo',
  'rest',
  'failure',
  'hypertrophy',
  'strength',
  'volume',
  'intensity',
  'deload',
  'progression',
  'week',
  'day',
  'split',
  'push',
  'pull',
  'legs',
  'upper',
  'lower',
  'chest',
  'back',
  'shoulders',
  'arms',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'core',
  'abs',
];

// Exercise name patterns (common exercises)
const EXERCISE_PATTERNS = [
  'squat',
  'deadlift',
  'bench',
  'press',
  'row',
  'curl',
  'extension',
  'pulldown',
  'pullup',
  'pull-up',
  'pushup',
  'push-up',
  'dip',
  'lunge',
  'raise',
  'fly',
  'flye',
  'shrug',
  'crunch',
  'plank',
];

// Non-workout indicators (presence suggests NOT a workout program)
const NON_WORKOUT_KEYWORDS = [
  'recipe',
  'ingredient',
  'calories',
  'macros',
  'meal plan',
  'nutrition guide',
  'cookbook',
  'serving size',
  'tablespoon',
  'teaspoon',
  'invoice',
  'receipt',
  'contract',
  'agreement',
  'terms and conditions',
];

interface PrefilterResult {
  isLikelyWorkout: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  primaryKeywordCount: number;
  secondaryKeywordCount: number;
  exerciseCount: number;
  nonWorkoutIndicators: number;
  recommendation: 'proceed' | 'warn' | 'reject';
  reason?: string;
}

/**
 * Analyze text content to determine if it's likely a workout program
 *
 * This is a fast, heuristic check that runs before Claude Vision.
 * It can save API tokens by rejecting obvious non-workout documents.
 */
export function analyzeWorkoutLikelihood(textContent: string): PrefilterResult {
  const lowerText = textContent.toLowerCase();

  // Count keyword occurrences
  let primaryCount = 0;
  let secondaryCount = 0;
  let exerciseCount = 0;
  let nonWorkoutCount = 0;

  for (const keyword of WORKOUT_KEYWORDS_PRIMARY) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = lowerText.match(regex);
    primaryCount += matches?.length || 0;
  }

  for (const keyword of WORKOUT_KEYWORDS_SECONDARY) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = lowerText.match(regex);
    secondaryCount += matches?.length || 0;
  }

  for (const exercise of EXERCISE_PATTERNS) {
    const regex = new RegExp(`\\b${exercise}\\b`, 'gi');
    const matches = lowerText.match(regex);
    exerciseCount += matches?.length || 0;
  }

  for (const keyword of NON_WORKOUT_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      nonWorkoutCount++;
    }
  }

  // Check for numeric patterns common in workouts (3x10, 4 sets, etc.)
  const setRepPatterns = lowerText.match(/\d+\s*[x×]\s*\d+|\d+\s*sets?\s*[x×of]?\s*\d+/gi);
  const setRepCount = setRepPatterns?.length || 0;

  // Scoring logic
  const totalWorkoutSignals = primaryCount + (secondaryCount * 0.5) + (exerciseCount * 0.7) + (setRepCount * 2);
  const workoutDensity = totalWorkoutSignals / Math.max(lowerText.length / 1000, 1); // per 1000 chars

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' | 'none';
  let isLikelyWorkout: boolean;
  let recommendation: 'proceed' | 'warn' | 'reject';
  let reason: string | undefined;

  if (nonWorkoutCount >= 3) {
    confidence = 'none';
    isLikelyWorkout = false;
    recommendation = 'reject';
    reason = 'Document appears to be a nutrition guide or non-workout content';
  } else if (primaryCount >= 5 && (exerciseCount >= 3 || setRepCount >= 3)) {
    confidence = 'high';
    isLikelyWorkout = true;
    recommendation = 'proceed';
  } else if (primaryCount >= 2 && (exerciseCount >= 1 || setRepCount >= 1)) {
    confidence = 'medium';
    isLikelyWorkout = true;
    recommendation = 'proceed';
  } else if (primaryCount >= 1 || exerciseCount >= 2) {
    confidence = 'low';
    isLikelyWorkout = true;
    recommendation = 'warn';
    reason = 'Low workout keyword density - document may not be a structured program';
  } else {
    confidence = 'none';
    isLikelyWorkout = false;
    recommendation = 'warn';
    reason = 'No workout-related content detected';
  }

  return {
    isLikelyWorkout,
    confidence,
    primaryKeywordCount: primaryCount,
    secondaryKeywordCount: secondaryCount,
    exerciseCount,
    nonWorkoutIndicators: nonWorkoutCount,
    recommendation,
    reason,
  };
}

/**
 * Extract readable text from PDF for pre-filtering
 * Note: This is a simple extraction for keyword checking only.
 * The actual parsing uses Claude Vision for accuracy.
 */
export function extractTextForPrefilter(pdfBase64: string): string {
  // Decode base64 to get raw PDF bytes
  try {
    const binaryString = atob(pdfBase64);

    // Simple text extraction: look for text between BT and ET markers (PDF text objects)
    // and extract readable ASCII strings
    const textMatches: string[] = [];

    // Extract strings that look like readable text (ASCII printable chars)
    // This is a heuristic approach - not perfect but fast
    let currentWord = '';
    for (let i = 0; i < binaryString.length; i++) {
      const charCode = binaryString.charCodeAt(i);
      // Printable ASCII range
      if (charCode >= 32 && charCode <= 126) {
        currentWord += binaryString[i];
      } else {
        if (currentWord.length >= 3) {
          textMatches.push(currentWord);
        }
        currentWord = '';
      }
    }
    if (currentWord.length >= 3) {
      textMatches.push(currentWord);
    }

    // Join and return first 50KB of text (enough for keyword analysis)
    return textMatches.join(' ').slice(0, 50000);
  } catch {
    // If decoding fails, return empty string (let Claude handle it)
    return '';
  }
}

/**
 * Quick pre-filter check for workout PDFs
 *
 * Returns recommendation on whether to proceed with Claude Vision.
 * This saves API tokens on obvious non-workout documents.
 */
export function prefilterPDF(pdfBase64: string): PrefilterResult {
  const extractedText = extractTextForPrefilter(pdfBase64);

  if (extractedText.length < 100) {
    // Not enough text extracted - could be image-heavy PDF
    // Let Claude Vision handle it
    return {
      isLikelyWorkout: true,
      confidence: 'low',
      primaryKeywordCount: 0,
      secondaryKeywordCount: 0,
      exerciseCount: 0,
      nonWorkoutIndicators: 0,
      recommendation: 'proceed',
      reason: 'Insufficient text extracted - may be image-based PDF',
    };
  }

  return analyzeWorkoutLikelihood(extractedText);
}
