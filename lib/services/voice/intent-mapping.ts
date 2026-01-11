/**
 * Voice-First Intent Mapping System
 *
 * Maps voice commands to exercises with intelligent disambiguation.
 * Uses keywords for broader matching and excludes to prevent false positives.
 *
 * When a user says a generic term like "squat", provides either:
 * - The default exercise (if high confidence)
 * - A clarification prompt with options (if ambiguous)
 */

export interface VoiceIntent {
  voiceCommand: string;
  aliases: string[];
  defaultExercise: string;
  keywords: string[]; // Broader matching terms
  excludes: string[]; // Terms that disqualify a match
  clarificationPrompt: string;
  databaseMapping: string[];
}

export interface IntentMatchResult {
  matched: boolean;
  intent: VoiceIntent | null;
  confidence: 'high' | 'medium' | 'low';
  needsClarification: boolean;
  suggestedExercise: string | null;
  alternatives: string[];
}

/**
 * Voice Intent Mappings
 * Source: exercises-v2.9.json with 26 core intents
 * Enhanced with keywords/excludes from Python mapping script
 */
export const VOICE_INTENTS: VoiceIntent[] = [
  {
    voiceCommand: 'Squat',
    aliases: ['Back Squat', 'Legs'],
    defaultExercise: 'Barbell High Bar Back Squat',
    keywords: ['Squat', 'Hack', 'Thruster', 'Wall Sit', 'Sissy'],
    excludes: ['Split', 'Bulgarian', 'Cossack', 'Lunge', 'Clean', 'Snatch', 'Jerk', 'Press', 'Row', 'Deadlift'],
    clarificationPrompt: 'Barbell, Goblet, or Front Squat?',
    databaseMapping: [
      'Barbell High Bar Back Squat',
      'Barbell Low Bar Back Squat',
      'Barbell Front Rack Squat',
      'Dumbbell Goblet Squat',
      'Barbell Zercher Squat',
      'Barbell Box Back Squat',
      'Bodyweight Squat',
      'Landmine Goblet Squat',
      'Double Kettlebell Front Rack Squat',
      'Barbell Overhead Squat',
      'Safety Bar Squat',
      'Bodyweight Pistol Squat',
      'Machine Hack Squat',
      'Barbell Hack Squat',
    ],
  },
  {
    voiceCommand: 'Bench Press',
    aliases: ['Bench', 'Chest Press'],
    defaultExercise: 'Barbell Bench Press',
    keywords: ['Bench Press', 'Floor Press', 'Chest Press', 'Board Press', 'Svend', 'Fly', 'Crossover', 'Pec Deck'],
    excludes: ['Close Grip', 'Spider', 'Row', 'Curl', 'Rear', 'Reverse'],
    clarificationPrompt: 'Flat, Incline, or Dumbbell?',
    databaseMapping: [
      'Barbell Bench Press',
      'Barbell Incline Bench Press',
      'Barbell Decline Bench Press',
      'Double Dumbbell Bench Press',
      'Double Dumbbell Incline Bench Press',
      'Double Dumbbell Floor Press',
      'Barbell Floor Press',
      'Machine Chest Press',
      'Cable Fly',
      'Pec Deck Machine',
    ],
  },
  {
    voiceCommand: 'Deadlift',
    aliases: ['Pull'],
    defaultExercise: 'Barbell Conventional Deadlift',
    keywords: ['Deadlift', 'Rack Pull', 'Good Morning'],
    excludes: ['Romanian', 'Stiff', 'Clean', 'High Pull', 'Row'],
    clarificationPrompt: 'Conventional, Sumo, or Rack Pull?',
    databaseMapping: [
      'Barbell Conventional Deadlift',
      'Barbell Sumo Deadlift',
      'Barbell Rack Pull',
      'Barbell Snatch Grip Deadlift',
      'Barbell Deficit Deadlift',
      'Trap Bar Deadlift',
      'Barbell Good Morning',
    ],
  },
  {
    voiceCommand: 'RDL',
    aliases: ['Romanian Deadlift', 'Stiff Leg'],
    defaultExercise: 'Barbell Romanian Deadlift',
    keywords: ['Romanian Deadlift', 'Stiff Legged Deadlift', 'Stiff Leg Deadlift'],
    excludes: [],
    clarificationPrompt: 'Barbell or Dumbbell?',
    databaseMapping: [
      'Barbell Romanian Deadlift',
      'Barbell Stiff Legged Deadlift',
      'Double Dumbbell Romanian Deadlift',
      'Single Leg Dumbbell Romanian Deadlift',
      'Double Kettlebell Romanian Deadlift',
    ],
  },
  {
    voiceCommand: 'Overhead Press',
    aliases: ['Military Press', 'Shoulder Press', 'OHP'],
    defaultExercise: 'Barbell Overhead Press',
    keywords: ['Overhead Press', 'Military Press', 'Shoulder Press', 'Push Press', 'Z Press', 'Arnold Press', 'Viking Press', 'Bradford', 'Cuban'],
    excludes: ['Squat', 'Lunge'],
    clarificationPrompt: 'Barbell, Dumbbell, or Seated?',
    databaseMapping: [
      'Barbell Overhead Press',
      'Barbell Push Press',
      'Barbell Seated Overhead Press',
      'Barbell Z Press',
      'Double Dumbbell Seated Overhead Press',
      'Double Dumbbell Standing Overhead Press',
      'Double Dumbbell Arnold Press',
      'Single Arm Kettlebell Overhead Press',
      'Double Kettlebell Push Press',
      'Landmine Shoulder Press',
    ],
  },
  {
    voiceCommand: 'Row',
    aliases: ['Back Row'],
    defaultExercise: 'Barbell Bent Over Row',
    keywords: ['Row', 'Shrug', 'Kelso'],
    excludes: ['Upright', 'Rear Delt'],
    clarificationPrompt: 'Barbell, Dumbbell, or Cable?',
    databaseMapping: [
      'Barbell Bent Over Row',
      'Barbell Pendlay Row',
      'Single Arm Dumbbell Prone Row',
      'Double Dumbbell Prone Row',
      'Chest Supported Dumbbell Row',
      'Single Arm Landmine Meadows Row',
      'Single Arm Cable Low Row',
      'Cable Seated Row',
      'Ring Row',
      'Double Kettlebell Gorilla Row',
      'Barbell Shrug',
      'Dumbbell Shrug',
    ],
  },
  {
    voiceCommand: 'Pull Up',
    aliases: ['Chin Up'],
    defaultExercise: 'Pull Up',
    keywords: ['Pull Up', 'Chin Up', 'Muscle Up'],
    excludes: ['Lat Pulldown'],
    clarificationPrompt: 'Bodyweight, Weighted, or Assisted?',
    databaseMapping: [
      'Pull Up',
      'Chin Up',
      'Neutral Grip Pull Up',
      'Weighted Pull Up',
      'Superband Assisted Bar Pull Up',
      'Bar Eccentric Pull Up',
      'Bar L Sit Pull Up',
      'Muscle Up',
    ],
  },
  {
    voiceCommand: 'Lat Pulldown',
    aliases: ['Pulldown'],
    defaultExercise: 'Cable Lat Pulldown',
    keywords: ['Lat Pulldown', 'Pulldown', 'Pullover'],
    excludes: ['Tricep'],
    clarificationPrompt: 'Wide, Close, or Reverse Grip?',
    databaseMapping: [
      'Cable Lat Pulldown',
      'Cable Wide Grip Lat Pulldown',
      'Cable Close Grip Lat Pulldown',
      'Cable Reverse Grip Lat Pulldown',
      'Cable Straight Arm Pulldown',
      'Dumbbell Pullover',
      'Cable Pullover',
    ],
  },
  {
    voiceCommand: 'Lunge',
    aliases: ['Walking Lunge', 'Split Squat'],
    defaultExercise: 'Bodyweight Walking Lunge',
    keywords: ['Lunge', 'Split Squat', 'Bulgarian', 'Cossack', 'Step Up'],
    excludes: [],
    clarificationPrompt: 'Walking, Reverse, or Split Squat?',
    databaseMapping: [
      'Bodyweight Walking Lunge',
      'Barbell Back Rack Walking Lunge',
      'Double Dumbbell Suitcase Walking Lunge',
      'Double Dumbbell Suitcase Bulgarian Split Squat',
      'Barbell Back Rack Split Squat',
      'Double Dumbbell Suitcase Alternating Reverse Lunge',
      'Bodyweight Cossack Squat',
      'Dumbbell Step Up',
      'Barbell Step Up',
    ],
  },
  {
    voiceCommand: 'Hip Thrust',
    aliases: ['Bridge', 'Glutes'],
    defaultExercise: 'Barbell Hip Thrust',
    keywords: ['Hip Thrust', 'Glute Bridge', 'Frog Pump', 'Abduction', 'Kickback', 'Clam', 'Tibialis'],
    excludes: ['Tricep'],
    clarificationPrompt: 'Barbell, Single Leg, or Machine?',
    databaseMapping: [
      'Barbell Hip Thrust',
      'Barbell Glute Bridge',
      'Bodyweight Glute Bridge',
      'Bodyweight Single Leg Glute Bridge',
      'Dumbbell Hip Thrust',
      'Machine Hip Thrust',
      'Miniband Frog Pump',
      'Cable Glute Kickback',
      'Machine Hip Abduction',
      'Miniband Clamshell',
    ],
  },
  {
    voiceCommand: 'Push Up',
    aliases: ['Press Up'],
    defaultExercise: 'Bodyweight Push Up',
    keywords: ['Push Up'],
    excludes: [],
    clarificationPrompt: 'Standard, Kneeling, or Diamond?',
    databaseMapping: [
      'Bodyweight Push Up',
      'Bodyweight Kneeling Push Up',
      'Bodyweight Diamond Push Up',
      'Bodyweight Wide Push Up',
      'Ring Push Up',
      'Bodyweight Decline Push Up',
      'Bodyweight Incline Push Up',
      'Handstand Push Up',
    ],
  },
  {
    voiceCommand: 'Dip',
    aliases: ['Dips'],
    defaultExercise: 'Bodyweight Dip',
    keywords: ['Dip'],
    excludes: [],
    clarificationPrompt: 'Bar, Ring, or Machine?',
    databaseMapping: [
      'Bodyweight Dip',
      'Weighted Dip',
      'Ring Dip',
      'Machine Assisted Dip',
      'Bench Dip',
    ],
  },
  {
    voiceCommand: 'Lateral Raise',
    aliases: ['Side Raise'],
    defaultExercise: 'Double Dumbbell Standing Lateral Raise',
    keywords: ['Lateral Raise', 'Side Raise', 'Lu Raise', 'Upright Row'],
    excludes: [],
    clarificationPrompt: 'Dumbbell or Cable?',
    databaseMapping: [
      'Double Dumbbell Standing Lateral Raise',
      'Single Dumbbell Lateral Raise',
      'Cable Lateral Raise',
      'Double Plate Lu Raise',
      'Barbell Upright Row',
      'Dumbbell Upright Row',
      'Cable Upright Row',
    ],
  },
  {
    voiceCommand: 'Front Raise',
    aliases: [],
    defaultExercise: 'Double Dumbbell Front Raise',
    keywords: ['Front Raise'],
    excludes: [],
    clarificationPrompt: 'Dumbbell, Plate, or Cable?',
    databaseMapping: [
      'Double Dumbbell Front Raise',
      'Single Dumbbell Front Raise',
      'Plate Front Raise',
      'Cable Front Raise',
      'Barbell Front Raise',
    ],
  },
  {
    voiceCommand: 'Rear Delt',
    aliases: ['Reverse Fly'],
    defaultExercise: 'Double Dumbbell Rear Delt Fly',
    keywords: ['Rear Delt', 'Reverse Fly', 'Face Pull', 'Band Pull Apart', 'Y-Raise', 'W-Raise'],
    excludes: [],
    clarificationPrompt: 'Fly or Face Pull?',
    databaseMapping: [
      'Double Dumbbell Rear Delt Fly',
      'Cable Rear Delt Fly',
      'Cable Face Pull',
      'Resistance Band Face Pull',
      'Resistance Band Pull Apart',
      'Machine Rear Delt Fly',
    ],
  },
  {
    voiceCommand: 'Bicep Curl',
    aliases: ['Curls', 'Guns'],
    defaultExercise: 'Barbell Bicep Curl',
    keywords: ['Curl'],
    excludes: ['Leg', 'Hamstring', 'Nordic', 'Jefferson', 'Good Morning', 'Upright'],
    clarificationPrompt: 'Barbell, Dumbbell, or Hammer?',
    databaseMapping: [
      'Barbell Bicep Curl',
      'Double Dumbbell Standing Bicep Curl',
      'Dumbbell Hammer Curl',
      'EZ Bar Wide Grip Bicep Curl',
      'EZ Bar Preacher Curl',
      'Cable Straight Bar Bicep Curl',
      'Double Dumbbell Spider Curl',
      'Double Dumbbell Incline Bench Bicep Curl',
      'Concentration Curl',
    ],
  },
  {
    voiceCommand: 'Tricep Extension',
    aliases: ['Skullcrusher', 'Pushdown'],
    defaultExercise: 'Cable Rope Tricep Pushdown',
    keywords: ['Tricep', 'Skull Crusher', 'Skullcrusher', 'French Press', 'Tate Press', 'JM Press', 'Kickback'],
    excludes: ['Glute'],
    clarificationPrompt: 'Pushdown, Skullcrusher, or Overhead?',
    databaseMapping: [
      'Cable Rope Tricep Pushdown',
      'Cable V Bar Tricep Pushdown',
      'EZ Bar Skull Crusher',
      'EZ Bar Lying Tricep Extension',
      'Cable Rope Overhead Tricep Extension',
      'Dumbbell Overhead Tricep Extension',
      'Dumbbell Tricep Kickback',
      'Close Grip Bench Press',
    ],
  },
  {
    voiceCommand: 'Leg Curl',
    aliases: ['Hamstring Curl'],
    defaultExercise: 'Machine Seated Leg Curl',
    keywords: ['Leg Curl', 'Hamstring Curl', 'Nordic', 'Glute Ham Raise', 'GHR'],
    excludes: [],
    clarificationPrompt: 'Seated, Lying, or Nordic?',
    databaseMapping: [
      'Machine Seated Leg Curl',
      'Machine Lying Leg Curl',
      'Nordic Hamstring Curl',
      'Glute Ham Raise',
      'Stability Ball Leg Curl',
      'Slider Leg Curl',
    ],
  },
  {
    voiceCommand: 'Leg Extension',
    aliases: ['Quads'],
    defaultExercise: 'Machine Leg Extension',
    keywords: ['Leg Extension'],
    excludes: [],
    clarificationPrompt: 'Machine or Band?',
    databaseMapping: [
      'Machine Leg Extension',
      'Resistance Band Leg Extension',
    ],
  },
  {
    voiceCommand: 'Leg Press',
    aliases: [],
    defaultExercise: 'Leg Press',
    keywords: ['Leg Press'],
    excludes: ['Calf'],
    clarificationPrompt: 'Standard, Horizontal, or Single Leg?',
    databaseMapping: [
      'Leg Press',
      '45 Degree Leg Press',
      'Horizontal Leg Press',
      'Single Leg Press',
    ],
  },
  {
    voiceCommand: 'Calf Raise',
    aliases: ['Calves'],
    defaultExercise: 'Machine Standing Calf Raise',
    keywords: ['Calf Raise', 'Calf Press'],
    excludes: [],
    clarificationPrompt: 'Standing, Seated, or Donkey?',
    databaseMapping: [
      'Machine Standing Calf Raise',
      'Machine Seated Calf Raise',
      'Donkey Calf Raise',
      'Leg Press Calf Raise',
      'Bodyweight Single Leg Calf Raise',
      'Smith Machine Calf Raise',
    ],
  },
  {
    voiceCommand: 'Plank',
    aliases: ['Core Hold'],
    defaultExercise: 'Bodyweight Plank',
    keywords: ['Plank'],
    excludes: [],
    clarificationPrompt: 'Front or Side?',
    databaseMapping: [
      'Bodyweight Plank',
      'Bodyweight Side Plank',
      'Bodyweight Kneeling Forearm Plank',
      'Bodyweight Copenhagen Plank',
      'Stability Ball Forearm Plank',
      'RKC Plank',
    ],
  },
  {
    voiceCommand: 'Abs',
    aliases: ['Core', 'Crunch', 'Sit Up'],
    defaultExercise: 'Bodyweight Crunch',
    keywords: ['Crunch', 'Sit Up', 'Leg Raise', 'Dead Bug', 'Hollow Body', 'V Up', 'Russian Twist', 'Ab Wheel', 'Toe Touch', 'Woodchop', 'Pallof', 'Bird Dog', 'Knee Raise', 'Heel Tap', 'Flutter Kick', 'Stir the Pot', 'Kick Through', 'Oblique', 'Mountain Climber', 'Scissor', 'Bicycle', 'Vacuum'],
    excludes: ['Plank'],
    clarificationPrompt: 'Crunch, Leg Raise, or Twist?',
    databaseMapping: [
      'Bodyweight Crunch',
      'Bodyweight Sit Up',
      'Hanging Leg Raise',
      'Cable Kneeling Crunch',
      'Bodyweight Dead Bug',
      'Ab Wheel Kneeling Rollout',
      'Stability Ball Russian Twist',
      'Bodyweight V Up',
      'Pallof Press',
      'Bodyweight Mountain Climber',
      'Bodyweight Bicycle Crunch',
      'Hanging Knee Raise',
    ],
  },
  {
    voiceCommand: 'Carry',
    aliases: ['Walk'],
    defaultExercise: 'Double Dumbbell Farmer Carry',
    keywords: ['Carry', 'Walk', 'March'],
    excludes: ['Lunge', 'Crab', 'Wall'],
    clarificationPrompt: 'Farmers or Suitcase?',
    databaseMapping: [
      'Double Dumbbell Farmer Carry',
      'Single Dumbbell Suitcase Carry',
      'Single Arm Kettlebell Suitcase March',
      'Barbell Overhead Carry',
      'Heavy Sandbag Bear Hug Carry',
      'Kettlebell Goblet Carry',
      'Trap Bar Farmer Carry',
    ],
  },
  {
    voiceCommand: 'Olympic',
    aliases: ['Clean', 'Snatch', 'Power'],
    defaultExercise: 'Barbell Power Clean',
    keywords: ['Clean', 'Snatch', 'Jerk', 'Swing', 'High Pull'],
    excludes: ['Press', 'Deadlift'],
    clarificationPrompt: 'Clean, Snatch, or Jerk?',
    databaseMapping: [
      'Barbell Power Clean',
      'Barbell Hang Power Clean',
      'Barbell Power Snatch',
      'Barbell Squat Clean',
      'Barbell Split Jerk',
      'Barbell High Pull',
      'Double Kettlebell Clean to Push Press',
      'Single Arm Kettlebell Snatch',
      'Kettlebell Swing',
    ],
  },
  {
    voiceCommand: 'Cardio',
    aliases: [],
    defaultExercise: 'Treadmill Run',
    keywords: ['Run', 'Sprint', 'Jog', 'Rowing', 'Bike', 'Cycle', 'Elliptical', 'SkiErg', 'Jump Rope', 'Burpee', 'Jack', 'Battle Rope', 'Sled', 'Prowler', 'Box Jump'],
    excludes: ['Renegade'],
    clarificationPrompt: 'Run, Bike, or Row?',
    databaseMapping: [
      'Treadmill Run',
      'Outdoor Run',
      'Rowing Machine',
      'Stationary Bike',
      'Assault Bike',
      'Elliptical',
      'SkiErg',
      'Jump Rope',
      'Burpee',
      'Jumping Jack',
      'Battle Rope',
      'Sled Push',
      'Box Jump',
    ],
  },
];

// Build lookup maps for fast matching
const intentByCommand = new Map<string, VoiceIntent>();
const intentByAlias = new Map<string, VoiceIntent>();
const intentByKeyword = new Map<string, VoiceIntent[]>();

for (const intent of VOICE_INTENTS) {
  // Primary command (lowercase)
  intentByCommand.set(intent.voiceCommand.toLowerCase(), intent);

  // Aliases (lowercase)
  for (const alias of intent.aliases) {
    intentByAlias.set(alias.toLowerCase(), intent);
  }

  // Keywords (lowercase) - multiple intents can share keywords
  for (const keyword of intent.keywords) {
    const keyLower = keyword.toLowerCase();
    const existing = intentByKeyword.get(keyLower) || [];
    existing.push(intent);
    intentByKeyword.set(keyLower, existing);
  }
}

/**
 * Normalize input for matching
 */
function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ');
}

/**
 * Check if input contains any exclude terms for an intent
 */
function hasExcludeTerm(input: string, intent: VoiceIntent): boolean {
  const inputLower = input.toLowerCase();
  return intent.excludes.some(exclude => inputLower.includes(exclude.toLowerCase()));
}

/**
 * Match voice input to an intent using keywords
 */
function matchByKeyword(input: string): VoiceIntent | null {
  const inputLower = input.toLowerCase();

  // Find all keywords present in input
  const matchedIntents = new Map<VoiceIntent, number>();

  Array.from(intentByKeyword.entries()).forEach(([keyword, intents]) => {
    if (inputLower.includes(keyword)) {
      for (const intent of intents) {
        // Skip if input contains an exclude term
        if (hasExcludeTerm(input, intent)) continue;

        const count = matchedIntents.get(intent) || 0;
        matchedIntents.set(intent, count + 1);
      }
    }
  });

  if (matchedIntents.size === 0) return null;

  // Return intent with most keyword matches
  let bestIntent: VoiceIntent | null = null;
  let bestCount = 0;

  Array.from(matchedIntents.entries()).forEach(([intent, count]) => {
    if (count > bestCount) {
      bestCount = count;
      bestIntent = intent;
    }
  });

  return bestIntent;
}

/**
 * Match voice input to an intent
 * Returns the matched intent with confidence level
 */
export function matchVoiceIntent(voiceInput: string): IntentMatchResult {
  const normalized = normalizeInput(voiceInput);

  // 1. Exact match on command
  const exactCommand = intentByCommand.get(normalized);
  if (exactCommand && !hasExcludeTerm(normalized, exactCommand)) {
    return {
      matched: true,
      intent: exactCommand,
      confidence: 'high',
      needsClarification: false,
      suggestedExercise: exactCommand.defaultExercise,
      alternatives: exactCommand.databaseMapping.slice(0, 5),
    };
  }

  // 2. Exact match on alias
  const exactAlias = intentByAlias.get(normalized);
  if (exactAlias && !hasExcludeTerm(normalized, exactAlias)) {
    return {
      matched: true,
      intent: exactAlias,
      confidence: 'high',
      needsClarification: false,
      suggestedExercise: exactAlias.defaultExercise,
      alternatives: exactAlias.databaseMapping.slice(0, 5),
    };
  }

  // 3. Keyword-based matching with exclude filtering
  const keywordMatch = matchByKeyword(normalized);
  if (keywordMatch) {
    // Check if input specifies a variation
    const variation = findSpecificVariation(normalized, keywordMatch);
    if (variation) {
      return {
        matched: true,
        intent: keywordMatch,
        confidence: 'high',
        needsClarification: false,
        suggestedExercise: variation,
        alternatives: [],
      };
    }

    return {
      matched: true,
      intent: keywordMatch,
      confidence: 'medium',
      needsClarification: true,
      suggestedExercise: keywordMatch.defaultExercise,
      alternatives: keywordMatch.databaseMapping.slice(0, 5),
    };
  }

  // 4. Partial match - check if input contains command or vice versa
  for (const intent of VOICE_INTENTS) {
    // Skip if input contains an exclude term
    if (hasExcludeTerm(normalized, intent)) continue;

    const command = intent.voiceCommand.toLowerCase();

    // Input contains command (e.g., "barbell squat" contains "squat")
    if (normalized.includes(command)) {
      // Check if input specifies a variation
      const variation = findSpecificVariation(normalized, intent);
      if (variation) {
        return {
          matched: true,
          intent,
          confidence: 'high',
          needsClarification: false,
          suggestedExercise: variation,
          alternatives: [],
        };
      }

      return {
        matched: true,
        intent,
        confidence: 'medium',
        needsClarification: true,
        suggestedExercise: intent.defaultExercise,
        alternatives: intent.databaseMapping.slice(0, 5),
      };
    }

    // Command contains input (e.g., "bench press" when user says "bench")
    if (command.includes(normalized) && normalized.length >= 3) {
      return {
        matched: true,
        intent,
        confidence: 'medium',
        needsClarification: false,
        suggestedExercise: intent.defaultExercise,
        alternatives: intent.databaseMapping.slice(0, 5),
      };
    }

    // Check aliases
    for (const alias of intent.aliases) {
      const aliasLower = alias.toLowerCase();
      if (normalized.includes(aliasLower) || aliasLower.includes(normalized)) {
        return {
          matched: true,
          intent,
          confidence: 'medium',
          needsClarification: false,
          suggestedExercise: intent.defaultExercise,
          alternatives: intent.databaseMapping.slice(0, 5),
        };
      }
    }
  }

  // No match
  return {
    matched: false,
    intent: null,
    confidence: 'low',
    needsClarification: false,
    suggestedExercise: null,
    alternatives: [],
  };
}

/**
 * Find a specific variation within an intent's database mapping
 */
function findSpecificVariation(input: string, intent: VoiceIntent): string | null {
  const inputWords = input.toLowerCase().split(/\s+/);

  // Keywords that indicate specific variations
  const variationKeywords: Record<string, string[]> = {
    'incline': ['incline'],
    'decline': ['decline'],
    'flat': ['flat', 'bench press'],
    'sumo': ['sumo'],
    'romanian': ['romanian', 'rdl'],
    'stiff': ['stiff'],
    'conventional': ['conventional'],
    'front': ['front'],
    'goblet': ['goblet'],
    'dumbbell': ['dumbbell', 'db'],
    'barbell': ['barbell', 'bb'],
    'cable': ['cable'],
    'machine': ['machine'],
    'bodyweight': ['bodyweight', 'bw'],
    'kettlebell': ['kettlebell', 'kb'],
    'single arm': ['single arm', 'one arm'],
    'single leg': ['single leg', 'one leg'],
    'seated': ['seated', 'sitting'],
    'standing': ['standing'],
    'hammer': ['hammer'],
    'wide': ['wide'],
    'close': ['close', 'narrow'],
    'reverse': ['reverse'],
    'lying': ['lying'],
    'nordic': ['nordic'],
  };

  // Check each database mapping against input
  for (const exercise of intent.databaseMapping) {
    const exerciseLower = exercise.toLowerCase();

    // Check for variation keywords in input
    for (const [variation, keywords] of Object.entries(variationKeywords)) {
      for (const keyword of keywords) {
        if (input.includes(keyword) && exerciseLower.includes(variation)) {
          return exercise;
        }
      }
    }

    // Check for word overlap (more than just the base command)
    const exerciseWords = exerciseLower.split(/\s+/);
    const matchingWords = inputWords.filter(w => exerciseWords.includes(w));
    if (matchingWords.length >= 2) {
      return exercise;
    }
  }

  return null;
}

/**
 * Get clarification options for an intent
 */
export function getClarificationOptions(intent: VoiceIntent): {
  prompt: string;
  options: Array<{ label: string; exercise: string }>;
} {
  // Extract key variations from database mapping
  const options: Array<{ label: string; exercise: string }> = [];
  const seenLabels = new Set<string>();

  for (const exercise of intent.databaseMapping.slice(0, 5)) {
    // Create a short label from the exercise name
    let label = exercise
      .replace(new RegExp(intent.voiceCommand, 'i'), '')
      .replace(/^(Barbell|Dumbbell|Double|Single|Bodyweight|Machine|Cable)\s+/i, '')
      .trim();

    // If label is empty or same as command, use equipment type
    if (!label || label.toLowerCase() === intent.voiceCommand.toLowerCase()) {
      const equipment = exercise.match(/^(Barbell|Dumbbell|Bodyweight|Cable|Machine|Kettlebell)/i);
      label = equipment ? equipment[1] : exercise.split(' ')[0];
    }

    if (!seenLabels.has(label.toLowerCase())) {
      seenLabels.add(label.toLowerCase());
      options.push({ label, exercise });
    }
  }

  return {
    prompt: intent.clarificationPrompt,
    options,
  };
}

/**
 * Get all intent voice commands for vocabulary
 */
export function getAllIntentCommands(): string[] {
  const commands: string[] = [];

  for (const intent of VOICE_INTENTS) {
    commands.push(intent.voiceCommand.toLowerCase());
    for (const alias of intent.aliases) {
      commands.push(alias.toLowerCase());
    }
    // Also include keywords for vocabulary boosting
    for (const keyword of intent.keywords) {
      commands.push(keyword.toLowerCase());
    }
  }

  // Deduplicate
  return Array.from(new Set(commands));
}

/**
 * Get all exercises from intent mappings
 */
export function getAllIntentExercises(): string[] {
  const exercises = new Set<string>();

  for (const intent of VOICE_INTENTS) {
    for (const exercise of intent.databaseMapping) {
      exercises.add(exercise);
    }
  }

  return Array.from(exercises);
}

/**
 * Match an exercise name to its intent category
 */
export function getIntentForExercise(exerciseName: string): VoiceIntent | null {
  const nameLower = exerciseName.toLowerCase();

  for (const intent of VOICE_INTENTS) {
    // Check if exercise is in database mapping
    if (intent.databaseMapping.some(ex => ex.toLowerCase() === nameLower)) {
      return intent;
    }

    // Check keywords
    for (const keyword of intent.keywords) {
      if (nameLower.includes(keyword.toLowerCase())) {
        // Verify not excluded
        if (!intent.excludes.some(ex => nameLower.includes(ex.toLowerCase()))) {
          return intent;
        }
      }
    }
  }

  return null;
}
