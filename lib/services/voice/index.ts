/**
 * Voice Services
 * Main exports for speech-to-workout feature
 * 
 * Uses Direct-to-Intent (Gemini Multimodal) - bypasses traditional STT entirely
 */

// Types
export type {
  ClarificationOption,
  ClarificationRequest, ClarificationType, ParsedExerciseIntent, STTConfig, STTError, STTResult, STTState, SupersetIntent, VoiceCommandType, VoiceParseResult
} from './types';

// Parsing
export { generateClarificationRequest, parseVoiceCommand, setWorkoutContext } from './enhanced-parser';

// Intent Mapping (Voice-First Exercise Matching)
export {
  getAllIntentCommands,
  getAllIntentExercises, getClarificationOptions, matchVoiceIntent, VOICE_INTENTS, type IntentMatchResult, type VoiceIntent
} from './intent-mapping';

// UFIRE - Unified Fitness Intent & Recommendation Engine
export {
  CONFIDENCE_THRESHOLDS, explainScore, getContextualFlowScore, getExerciseFrequencyScores,
  getTopExercises, inferWorkoutType, predictNextExercise, quickScore, recordExercisePerformed,
  recordWorkoutExercises, scoreExercises, UFIRE_WEIGHTS, type ExerciseCandidate,
  type ScoredExercise,
  type UFIREResult,
  type WorkoutContext
} from './ufire';

// Caching
export {
  cacheResult, clearCache, getCachedLLMResponse, getCachedResult, getCacheStats
} from './cache';

// Vocabulary
export {
  clearVocabularyCache, getCommandVocabulary,
  getPriorityExercises, getVocabularyBias
} from './vocabulary';

// Local Embeddings (semantic search)
export {
  clearEmbeddingsCache, findBestMatch, getEmbeddingStats, initializeEmbeddings, isInitialized as isEmbeddingsInitialized, reindexEmbeddings, searchSimilar, type ExerciseEmbedding,
  type SimilarityResult
} from './embeddings';

// Direct-to-Intent (Gemini Multimodal - RECOMMENDED)
// This is the primary approach - bypasses STT entirely
export {
  cancelVoiceRecording, checkVoicePermission, extractWorkoutFromVoice, requestVoicePermission,
  startVoiceRecording,
  stopVoiceRecording, VoiceDirectService, voiceDirectService
} from './voice-direct-service';

// Direct-to-Intent Types
export type {
  AudioContext, AudioFile,
  AudioUploadRequest, DirectIntentError, DirectIntentResult, ExtractedExercise,
  ExtractedSuperset, ExtractedWorkoutFromAudio, RecordingProgress, RecordingState, UseDirectVoiceReturn
} from './direct-intent-types';

export { AUDIO_CONFIG } from './direct-intent-types';

// Modifier-Aware Matching (Robust exercise resolution)
export {
  extractComponents, matchExerciseRobust, resolveExerciseName,
  type ExerciseComponents, type MatchResult
} from './modifier-matcher';
