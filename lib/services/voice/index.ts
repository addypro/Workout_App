/**
 * Voice Services
 * Main exports for speech-to-workout feature
 */

// Types
export type {
  STTResult,
  STTConfig,
  STTState,
  STTError,
  VoiceCommandType,
  ParsedExerciseIntent,
  SupersetIntent,
  VoiceParseResult,
  ClarificationType,
  ClarificationOption,
  ClarificationRequest,
} from './types';

// Native STT (expo-speech-recognition)
export { NativeSTTService, getNativeSTTService, useNativeSTT } from './native-stt';

// Whisper STT (recommended, best accuracy for gym)
export {
  WhisperSTTService,
  getWhisperSTTService,
  preloadWhisperModel,
  predownloadWhisperModel,
  unloadWhisperModel,
  isWhisperModelDownloaded,
  WHISPER_MODELS,
  DEFAULT_MODEL as DEFAULT_WHISPER_MODEL,
} from './whisper-stt';
export type { WhisperModel, WhisperSTTConfig } from './whisper-stt';

// Vosk Offline STT (lighter alternative)
export {
  VoskSTTService,
  getVoskSTTService,
  preloadVoskModel,
  unloadVoskModel,
} from './vosk-stt';

// Parsing
export { parseVoiceCommand, generateClarificationRequest, setWorkoutContext } from './enhanced-parser';

// Intent Mapping (Voice-First Exercise Matching)
export {
  matchVoiceIntent,
  getClarificationOptions,
  getAllIntentCommands,
  getAllIntentExercises,
  VOICE_INTENTS,
  type VoiceIntent,
  type IntentMatchResult,
} from './intent-mapping';

// UFIRE - Unified Fitness Intent & Recommendation Engine
export {
  scoreExercises,
  quickScore,
  explainScore,
  UFIRE_WEIGHTS,
  CONFIDENCE_THRESHOLDS,
  recordExercisePerformed,
  recordWorkoutExercises,
  getExerciseFrequencyScores,
  getTopExercises,
  getContextualFlowScore,
  predictNextExercise,
  inferWorkoutType,
  type ExerciseCandidate,
  type ScoredExercise,
  type UFIREResult,
  type WorkoutContext,
} from './ufire';

// Caching
export {
  getCachedResult,
  cacheResult,
  getCachedLLMResponse,
  clearCache,
  getCacheStats,
} from './cache';

// Vocabulary
export {
  getVocabularyBias,
  getCommandVocabulary,
  getPriorityExercises,
  clearVocabularyCache,
} from './vocabulary';

// Local Embeddings (semantic search)
export {
  initializeEmbeddings,
  searchSimilar,
  findBestMatch,
  isInitialized as isEmbeddingsInitialized,
  getEmbeddingStats,
  clearEmbeddingsCache,
  reindexEmbeddings,
  type ExerciseEmbedding,
  type SimilarityResult,
} from './embeddings';

// Coordinator
export {
  VoiceCoordinator,
  VoiceCoordinatorConfig,
  VoiceCoordinatorState,
  getVoiceCoordinator,
  resetVoiceCoordinator,
  type STTEngine,
} from './coordinator';

// Direct-to-Intent (Gemini Multimodal - NEW!)
// This is the recommended approach - bypasses STT entirely
export {
  voiceDirectService,
  VoiceDirectService,
  checkVoicePermission,
  requestVoicePermission,
  startVoiceRecording,
  stopVoiceRecording,
  cancelVoiceRecording,
  extractWorkoutFromVoice,
} from './voice-direct-service';

// Direct-to-Intent Types
export type {
  RecordingState,
  RecordingProgress,
  AudioFile,
  AudioUploadRequest,
  AudioContext,
  ExtractedWorkoutFromAudio,
  ExtractedExercise,
  ExtractedSuperset,
  DirectIntentResult,
  DirectIntentError,
  UseDirectVoiceReturn,
} from './direct-intent-types';

export { AUDIO_CONFIG } from './direct-intent-types';
