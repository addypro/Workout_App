/**
 * Direct-to-Intent Voice Types
 *
 * Types for the "Direct Multimodal" approach where audio is sent
 * directly to Gemini 1.5 Flash for workout extraction.
 *
 * WHY THIS APPROACH:
 * - Standard pipeline: Audio -> STT (Whisper) -> Text -> LLM -> JSON
 * - Direct pipeline: Audio -> Gemini Multimodal -> JSON
 *
 * Benefits:
 * - 50x cheaper (no dedicated STT API costs)
 * - Lower latency (single API call)
 * - Better context (Gemini hears tone, pauses, corrections)
 */

import type { SetType } from '@/lib/types/workout-session';

// ============================================
// Recording State
// ============================================

export type RecordingState =
  | 'idle'           // Not recording
  | 'requesting'     // Requesting permissions
  | 'recording'      // Actively recording
  | 'uploading'      // Sending to Edge Function
  | 'processing'     // Gemini is extracting
  | 'success'        // Extraction complete
  | 'error';         // Something went wrong

export interface RecordingProgress {
  state: RecordingState;
  durationMs: number;
  fileSizeBytes?: number;
  message?: string;
}

// ============================================
// Audio File Types
// ============================================

export interface AudioFile {
  uri: string;
  filename: string;
  mimeType: 'audio/mp4' | 'audio/m4a' | 'audio/aac' | 'audio/wav';
  durationMs: number;
  sizeBytes: number;
}

export interface AudioUploadRequest {
  base64: string;
  mimeType: string;
  durationMs: number;
  context?: AudioContext;
}

export interface AudioContext {
  /** Current workout being logged (for continuity) */
  workoutName?: string;
  /** Previous exercises in session (for superset detection) */
  previousExercises?: string[];
  /** User's preferred weight unit */
  weightUnit?: 'lbs' | 'kg';
  /** Known exercise names to boost recognition */
  exerciseVocabulary?: string[];
}

// ============================================
// Gemini Extraction Response
// ============================================

export interface ExtractedWorkoutFromAudio {
  /** Overall confidence in the extraction (0-1) */
  confidence: number;

  /** Detected workout name/type */
  workoutName?: string;

  /** Array of extracted exercises */
  exercises: ExtractedExercise[];

  /** Detected supersets/giant sets */
  supersets?: ExtractedSuperset[];

  /** Any notes or special instructions mentioned */
  notes?: string;

  /** Warnings about unclear audio */
  warnings?: string[];

  /** Whether the user seemed to correct themselves */
  hadCorrections?: boolean;

  /** Processing metadata */
  metadata?: {
    audioDurationMs: number;
    tokensUsed: number;
    processingTimeMs: number;
    cached: boolean;
  };
}

export interface ExtractedExercise {
  /** Exercise name as spoken */
  nameRaw: string;

  /** Normalized exercise name (matched to database) */
  nameNormalized?: string;

  /** Matched exercise ID from database */
  exerciseId?: string;

  /** Match confidence (0-1) */
  matchConfidence?: number;

  /** Number of sets */
  sets: number;

  /** Reps (can be range like "8-10" or "AMRAP") - default for all sets */
  reps: string;

  /** Weight if mentioned - default for all sets */
  weight?: number;

  /** Weight unit */
  weightUnit?: 'lbs' | 'kg';

  /** RPE if mentioned */
  rpe?: number;

  /** Rest time in seconds */
  restSeconds?: number;

  /** Special set type */
  setType?: SetType | 'normal';

  /** Any notes for this exercise */
  notes?: string;

  /** Order in workout */
  order: number;

  /** Whether this exercise needs manual review */
  needsReview?: boolean;

  /** Reason for needing review */
  reviewReason?: 'low_confidence' | 'unknown_exercise' | 'unclear_reps';

  /**
   * Per-set details when weights/reps vary between sets.
   * If present, use these instead of top-level weight/reps.
   * If absent, apply top-level weight/reps to all sets (backward compatible).
   */
  perSetDetails?: Array<{
    reps: string;
    weight?: number;
    setType?: 'warmup' | 'working' | 'drop' | 'top' | 'failure' | 'normal';
  }>;
}

export interface ExtractedSuperset {
  id: string;
  type: 'superset' | 'giant_set' | 'circuit';
  exerciseOrders: number[];
  restAfterComplete?: number;
}

// ============================================
// Service Response Types
// ============================================

export interface DirectIntentResult {
  success: boolean;
  data?: ExtractedWorkoutFromAudio;
  error?: DirectIntentError;
}

export interface DirectIntentError {
  code:
  | 'permission_denied'
  | 'recording_failed'
  | 'upload_failed'
  | 'extraction_failed'
  | 'no_workout_detected'
  | 'audio_too_short'
  | 'audio_too_long'
  | 'network_error'
  | 'api_error';
  message: string;
  recoverable: boolean;
  suggestion?: string;
}

// ============================================
// Hook Return Types
// ============================================

export interface UseDirectVoiceReturn {
  // State
  state: RecordingState;
  isRecording: boolean;
  isProcessing: boolean;
  durationMs: number;

  // Result
  result: ExtractedWorkoutFromAudio | null;
  error: DirectIntentError | null;

  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<DirectIntentResult>;
  cancelRecording: () => void;
  reset: () => void;

  // Permissions
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
}

// ============================================
// Constants
// ============================================

export const AUDIO_CONFIG = {
  /** Maximum recording duration in milliseconds (2 minutes) */
  MAX_DURATION_MS: 120_000,

  /** Minimum recording duration in milliseconds (1 second) */
  MIN_DURATION_MS: 1_000,

  /** Preferred audio format for bandwidth efficiency */
  PREFERRED_FORMAT: 'audio/m4a' as const,

  /** Target sample rate */
  SAMPLE_RATE: 44100,

  /** Number of channels */
  CHANNELS: 1,

  /** Bit rate for AAC encoding */
  BIT_RATE: 128000,
} as const;
