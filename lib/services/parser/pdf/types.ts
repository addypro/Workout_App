/**
 * PDF Parser Types
 *
 * TypeScript schemas for structured PDF workout extraction.
 * Mirrors Pydantic/Zod validation patterns for reliability.
 */

// ============================================
// Analysis/Router Phase Types
// ============================================

export interface ProgramOption {
  /** Name of the program variation (e.g., "4-Day Split", "Push/Pull/Legs") */
  name: string;
  /** Starting page number (1-indexed) */
  pageStart: number;
  /** Ending page number (1-indexed) */
  pageEnd: number;
  /** Brief description of this variation */
  description: string;
  /** Estimated training days per week */
  daysPerWeek?: number;
}

export interface PDFAnalysis {
  /** True if document contains workout routines */
  isWorkoutProgram: boolean;
  /** True if user must choose between multiple program variations */
  containsMultiplePrograms: boolean;
  /** List of distinct programs found in the document */
  programOptions: ProgramOption[];
  /** Reason if document is not a workout program */
  rejectionReason?: string;
  /** Suggested document type if not a workout (e.g., "nutrition_guide", "recipe_book") */
  suggestedType?: string;
  /** Program author if detected */
  author?: string;
  /** Program title if detected */
  title?: string;
  /** Total pages in document */
  totalPages?: number;
}

// ============================================
// Extraction Phase Types
// ============================================

export interface ExtractedSet {
  /** Set number within the exercise */
  setNumber: number;
  /** Target reps (can be range like "8-12" or single number) */
  reps: string;
  /** Target weight if specified */
  weight?: string;
  /** RPE target if specified (1-10) */
  rpe?: number;
  /** RIR (Reps In Reserve) if specified */
  rir?: number;
  /** Rest time in seconds */
  restSeconds?: number;
  /** Special set type */
  setType?: 'warmup' | 'working' | 'drop' | 'failure' | 'amrap' | 'myo';
  /** Additional notes for this set */
  notes?: string;
}

export interface ExtractedExercise {
  /** Order within the workout */
  order: number;
  /** Raw exercise name as written in PDF */
  nameRaw: string;
  /** Normalized exercise name (filled by normalizer) */
  nameNormalized?: string;
  /** Exercise ID from database (filled by normalizer) */
  exerciseId?: string;
  /** Confidence score for name match (0-1) */
  matchConfidence?: number;
  /** Number of sets */
  sets: number;
  /** Rep scheme (e.g., "8-10", "12", "AMRAP") */
  reps: string;
  /** Weight/load instruction */
  weight?: string;
  /** Rest period in seconds */
  restSeconds?: number;
  /** Tempo notation (e.g., "3-1-2-0") */
  tempo?: string;
  /** RPE target */
  rpe?: number;
  /** Detailed set information */
  setDetails?: ExtractedSet[];
  /** Superset group ID (links exercises done together) */
  supersetId?: string;
  /** Giant set group ID */
  giantSetId?: string;
  /** Is this a drop set? */
  isDropSet?: boolean;
  /** Special technique instructions */
  technique?: string;
  /** Coaching notes from the PDF */
  notes?: string;
  /** Target muscle group if specified */
  targetMuscle?: string;
}

export interface ExtractedWorkout {
  /** Day number within the week */
  dayNumber: number;
  /** Workout name (e.g., "Push Day", "Upper A") */
  name: string;
  /** Target muscle groups */
  muscleGroups?: string[];
  /** Estimated duration in minutes */
  estimatedDuration?: number;
  /** Exercises in this workout */
  exercises: ExtractedExercise[];
  /** General notes for the workout */
  notes?: string;
}

export interface ExtractedWeek {
  /** Week number */
  weekNumber: number;
  /** Week theme/focus (e.g., "Base Volume", "Intensity") */
  theme?: string;
  /** Workouts for this week */
  workouts: ExtractedWorkout[];
  /** Deload week? */
  isDeload?: boolean;
  /** Notes for the week */
  notes?: string;
}

export interface ExtractedProgram {
  /** Program name */
  name: string;
  /** Program author */
  author?: string;
  /** Number of weeks */
  totalWeeks: number;
  /** Days per week */
  daysPerWeek: number;
  /** Program goal/focus */
  goal?: string;
  /** Weekly structure */
  weeks: ExtractedWeek[];
  /** General program notes */
  notes?: string;
  /** Equipment required */
  equipmentRequired?: string[];
  /** Experience level */
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
}

// ============================================
// Full Parsed Result
// ============================================

export type ParsingStatus = 'success' | 'partial_success' | 'no_workout_found' | 'error';

export interface ParsedPDFResult {
  /** Parsing status */
  status: ParsingStatus;
  /** Error message if status is error */
  errorMessage?: string;
  /** Document metadata */
  metadata: {
    title?: string;
    author?: string;
    totalPages: number;
    processingTimeMs: number;
    /** Content hash for cache lookup (for subsequent requests) */
    contentHash?: string;
  };
  /** Initial analysis (from router phase) */
  analysis: PDFAnalysis;
  /** Selected program details (after user selection if multiple) */
  selectedProgram?: ExtractedProgram;
  /** Exercises that couldn't be matched to database */
  unmatchedExercises?: {
    nameRaw: string;
    suggestedMatches: Array<{ name: string; id: string; confidence: number }>;
  }[];
  /** Warnings during parsing */
  warnings?: string[];
}

// ============================================
// API Request/Response Types
// ============================================

export interface AnalyzePDFRequest {
  /** Base64-encoded PDF content */
  pdfBase64: string;
  /** Original filename */
  filename: string;
  /** File size in bytes (for cache key) */
  fileSize?: number;
}

export interface AnalyzePDFResponse {
  success: boolean;
  analysis?: PDFAnalysis;
  /** Content hash for cache lookups */
  contentHash?: string;
  /** Whether result was from cache */
  cached?: boolean;
  error?: string;
}

export interface ExtractProgramRequest {
  /** Base64-encoded PDF content */
  pdfBase64: string;
  /** Selected program option (from analysis) */
  selectedOption: ProgramOption;
  /** Known exercises from database (for normalization hints) */
  knownExercises?: string[];
  /** Content hash from analysis phase (for cache lookup) */
  contentHash?: string;
  /** File size in bytes (for cache key if contentHash not provided) */
  fileSize?: number;
}

export interface ExtractProgramResponse {
  success: boolean;
  program?: ExtractedProgram;
  unmatchedExercises?: string[];
  warnings?: string[];
  /** Whether result was from cache */
  cached?: boolean;
  error?: string;
}
