/**
 * Voice Service Types
 * TypeScript interfaces for speech-to-workout feature
 */

import type { SetType } from '@/lib/types/workout-session';

// ============================================
// Speech-to-Text Types
// ============================================

export interface STTResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  alternatives?: string[];
  source: 'native' | 'cloud';
}

export interface STTConfig {
  language: string;
  maxAlternatives: number;
  vocabularyBias: string[];
  interimResults: boolean;
  continuous: boolean;
}

export type STTState = 'idle' | 'listening' | 'processing' | 'error';

export interface STTError {
  code: 'permission_denied' | 'network_error' | 'recognition_failed' | 'timeout' | 'unknown';
  message: string;
  recoverable: boolean;
}

// ============================================
// Voice Command Parsing Types
// ============================================

export type VoiceCommandType =
  | 'add_exercise'      // "Add bench press 3x8"
  | 'add_superset'      // "Superset bench with flies"
  | 'add_dropset'       // "Add drop set after this"
  | 'create_workout'    // "Create a push workout with..."
  | 'modify_set'        // "Change to 4 sets"
  | 'navigation'        // "Next exercise", "Skip"
  | 'control'           // "Start rest", "Done"
  | 'unknown';

export interface ParsedExerciseIntent {
  rawName: string;
  matchedExerciseId?: string;
  matchedExerciseName?: string;
  matchConfidence: number;
  sets?: number;
  reps?: number | string;  // Can be "8-10" range
  weight?: number;
  weightUnit?: 'lbs' | 'kg';
  setType?: SetType;
  restTime?: number;
  needsClarification: boolean;
  clarificationReason?: 'equipment_variant' | 'similar_exercise';
}

export interface SupersetIntent {
  exercises: ParsedExerciseIntent[];
  groupId: string;
  restAfterComplete: number;
}

export interface VoiceParseResult {
  type: VoiceCommandType;
  success: boolean;
  confidence: number;

  // Single exercise
  exercise?: ParsedExerciseIntent;

  // Superset/Giant set
  superset?: SupersetIntent;

  // Full workout generation
  workout?: {
    name: string;
    exercises: ParsedExerciseIntent[];
    supersetGroups?: SupersetIntent[];
  };

  // Clarification request (when exercise needs disambiguation)
  clarification?: ClarificationRequest;

  // Navigation/control commands
  command?: string;

  // Raw data
  rawTranscript: string;
  processingTier: 1 | 2 | 3;
  cached: boolean;

  // Cost tracking (for analytics)
  costs?: {
    sttCost: number;
    llmCost: number;
  };
}

// ============================================
// Clarification Types
// ============================================

export type ClarificationType =
  | 'equipment_variant'   // Barbell vs Dumbbell
  | 'exercise_variant'    // High Bar vs Low Bar Squat
  | 'similar_exercise'    // Multiple matches
  | 'superset_confirm'    // Confirm superset grouping
  | 'rep_range';          // Confirm rep range interpretation

export interface ClarificationOption {
  id: string;
  label: string;
  description?: string;
  isDefault?: boolean;
  icon?: string;
  exerciseId?: string;
}

export interface ClarificationRequest {
  type: ClarificationType;
  question: string;
  options: ClarificationOption[];
  context?: {
    originalTranscript: string;
    partialParse?: Partial<ParsedExerciseIntent>;
  };
}

// ============================================
// Cache Types
// ============================================

export interface CachedParseResult {
  result: VoiceParseResult;
  timestamp: number;
  expiresAt: number;
  hitCount: number;
}

export interface CacheStats {
  totalEntries: number;
  memoryEntries: number;
  storageEntries: number;
  hitRate: number;
  lastCleanup: number;
}

// ============================================
// LLM Parser Types
// ============================================

export interface LLMParseRequest {
  transcript: string;
  context: {
    currentWorkout?: string;
    currentExercise?: string;
    recentExercises?: string[];
    userHistory?: string[];
  };
}

export interface LLMParseResponse {
  success: boolean;
  workout?: {
    name: string;
    exercises: Array<{
      name: string;
      sets: number;
      reps: string;
      weight?: number;
      setType?: SetType;
      supersetWith?: string;
    }>;
  };
  clarifications?: ClarificationRequest[];
  tokensUsed?: number;
  cost?: number;
}

// ============================================
// Voice Coordinator Types
// ============================================

export interface VoiceCoordinatorConfig {
  enableCloudFallback: boolean;
  cloudConfidenceThreshold: number;  // Below this, use cloud STT
  enableLLM: boolean;
  llmComplexityThreshold: number;    // Above this, use LLM
  maxRecordingDuration: number;      // ms
  language: string;
}

export interface VoiceCoordinatorCallbacks {
  onStateChange?: (state: STTState) => void;
  onInterimTranscript?: (text: string) => void;
  onFinalResult?: (result: VoiceParseResult) => void;
  onClarificationNeeded?: (request: ClarificationRequest) => void;
  onError?: (error: STTError) => void;
}

// ============================================
// Voice Hook Types
// ============================================

export interface UseVoiceWorkoutOptions {
  onExerciseAdd?: (exercise: ParsedExerciseIntent) => void;
  onSupersetAdd?: (superset: SupersetIntent) => void;
  onWorkoutCreate?: (workout: VoiceParseResult['workout']) => void;
  onCommand?: (command: string) => void;
  onError?: (error: STTError) => void;
  isPremium?: boolean;
}

export interface UseVoiceWorkoutReturn {
  // State
  state: STTState;
  isListening: boolean;
  isProcessing: boolean;
  interimTranscript: string;

  // Clarification
  showClarification: boolean;
  clarificationRequest: ClarificationRequest | null;

  // Actions
  startListening: () => Promise<void>;
  stopListening: () => Promise<VoiceParseResult | null>;
  cancelListening: () => void;
  handleClarificationSelect: (option: ClarificationOption) => void;
  dismissClarification: () => void;

  // Permissions
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
}
