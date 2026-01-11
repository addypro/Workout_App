/**
 * Voice Coordinator Service
 *
 * Orchestrates the full voice-to-workout pipeline:
 * 1. STT → Transcript (Native default, Whisper/Vosk when available)
 * 2. Tier 1: Local parser (free, fast)
 * 3. Tier 2: Enhanced parser with exercise lookup (free)
 * 4. Tier 3: LLM parser for complex commands (paid, cached)
 * 5. Clarification modal if ambiguous
 *
 * STT Engines:
 * - 'native': Uses device STT (default, most reliable)
 * - 'whisper': Best accuracy, noise-robust (requires native module)
 * - 'vosk': Lighter model, faster, offline (requires native module)
 */

// Lazy imports for optional native modules
let VoskSTTService: any = null;
let getVoskSTTService: any = null;
let WhisperSTTService: any = null;
let getWhisperSTTService: any = null;

// Try to load optional STT modules
try {
  const voskModule = require('./vosk-stt');
  VoskSTTService = voskModule.VoskSTTService;
  getVoskSTTService = voskModule.getVoskSTTService;
} catch (e) {
  console.log('[VoiceCoordinator] Vosk STT not available');
}

try {
  const whisperModule = require('./whisper-stt');
  WhisperSTTService = whisperModule.WhisperSTTService;
  getWhisperSTTService = whisperModule.getWhisperSTTService;
} catch (e) {
  console.log('[VoiceCoordinator] Whisper STT not available');
}

import { NativeSTTService, getNativeSTTService } from './native-stt';
import { parseVoiceCommand, generateClarificationRequest } from './enhanced-parser';
import { getCachedResult, cacheResult } from './cache';
import { getVocabularyBias } from './vocabulary';
import { searchExercisesEnhanced } from '@/lib/services/exercise/search';
import type {
  VoiceParseResult,
  STTState,
  ClarificationRequest,
} from './types';

// STT engine type
export type STTEngine = 'whisper' | 'vosk' | 'native';

// Common interface for STT services
interface STTServiceInterface {
  isAvailable(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  hasPermissions(): Promise<boolean>;
  start(config?: unknown): Promise<void>;
  stop(): Promise<unknown>;
  abort(): Promise<void>;
  onInterimResult(callback: (text: string) => void): void;
  onFinalResult(callback: (result: { transcript: string; confidence: number }) => void): void;
  onError(callback: (error: { code: string; message: string }) => void): void;
  onStateChange(callback: (state: STTState) => void): void;
  getState(): STTState;
}

// ============================================
// Types
// ============================================

export interface VoiceCoordinatorConfig {
  enableLLM: boolean; // Premium feature
  language: string;
  maxRecordingTime: number; // ms
  sttEngine: STTEngine; // 'whisper' (recommended), 'vosk', or 'native'
  onModelDownloadProgress?: (progress: number) => void; // For Whisper model download
}

export interface VoiceCoordinatorState {
  sttState: STTState;
  interimTranscript: string;
  finalTranscript: string;
  parseResult: VoiceParseResult | null;
  clarificationRequest: ClarificationRequest | null;
  error: string | null;
  isProcessing: boolean;
}

type StateListener = (state: VoiceCoordinatorState) => void;

// ============================================
// Coordinator Class
// ============================================

export class VoiceCoordinator {
  private sttService: NativeSTTService | any; // any for optional Whisper/Vosk
  private config: VoiceCoordinatorConfig;
  private state: VoiceCoordinatorState;
  private listeners = new Set<StateListener>();
  private recordingTimeout: ReturnType<typeof setTimeout> | null = null;
  private isModelLoading = false;

  constructor(config?: Partial<VoiceCoordinatorConfig>) {
    this.config = {
      enableLLM: false,
      language: 'en-US',
      maxRecordingTime: 30000, // 30 seconds max
      sttEngine: 'native', // Default to Native STT (most reliable)
      ...config,
    };

    // Initialize the appropriate STT service
    // Fall back to native if requested engine isn't available
    let engine = this.config.sttEngine;

    if (engine === 'whisper' && !getWhisperSTTService) {
      console.warn('[VoiceCoordinator] Whisper not available, falling back to native');
      engine = 'native';
    }

    if (engine === 'vosk' && !getVoskSTTService) {
      console.warn('[VoiceCoordinator] Vosk not available, falling back to native');
      engine = 'native';
    }

    // Update config with actual engine being used
    this.config.sttEngine = engine;

    switch (engine) {
      case 'whisper':
        this.sttService = getWhisperSTTService(
          {},
          { onProgress: this.config.onModelDownloadProgress }
        );
        // Pre-load Whisper model in background
        this.preloadModel();
        break;
      case 'vosk':
        this.sttService = getVoskSTTService();
        // Pre-load Vosk model in background
        this.preloadModel();
        break;
      case 'native':
      default:
        this.sttService = getNativeSTTService();
        break;
    }

    this.state = {
      sttState: 'idle',
      interimTranscript: '',
      finalTranscript: '',
      parseResult: null,
      clarificationRequest: null,
      error: null,
      isProcessing: false,
    };

    this.setupSTTListeners();
  }

  /**
   * Pre-load STT model for faster first recognition
   */
  private async preloadModel(): Promise<void> {
    if (this.config.sttEngine === 'native') return;

    this.isModelLoading = true;
    try {
      if (this.sttService?.loadModel) {
        await this.sttService.loadModel();
        console.log(`[VoiceCoordinator] ${this.config.sttEngine} model pre-loaded`);
      }
    } catch (error) {
      console.warn(`[VoiceCoordinator] Failed to pre-load ${this.config.sttEngine} model:`, error);
    } finally {
      this.isModelLoading = false;
    }
  }

  /**
   * Check if the STT engine is ready
   */
  isReady(): boolean {
    if (this.config.sttEngine === 'whisper' && this.sttService?.isReady) {
      return this.sttService.isReady();
    }
    if (this.config.sttEngine === 'vosk' && this.sttService?.isReady) {
      return this.sttService.isReady();
    }
    return true;
  }

  /**
   * Get the current STT engine
   */
  getEngine(): STTEngine {
    return this.config.sttEngine;
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Start voice recording
   */
  async startRecording(): Promise<void> {
    if (this.state.sttState !== 'idle') {
      return;
    }

    // Wait for model to load if using Vosk
    if (this.config.sttEngine === 'vosk' && this.isModelLoading) {
      console.log('[VoiceCoordinator] Waiting for model to load...');
      // Wait up to 5 seconds for model
      const startTime = Date.now();
      while (this.isModelLoading && Date.now() - startTime < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    this.updateState({
      sttState: 'listening',
      interimTranscript: '',
      finalTranscript: '',
      parseResult: null,
      clarificationRequest: null,
      error: null,
      isProcessing: false,
    });

    try {
      // Get vocabulary bias for better recognition
      const vocabularyBias = await getVocabularyBias();

      // Start the appropriate STT service
      switch (this.config.sttEngine) {
        case 'whisper':
          // Whisper handles vocabulary through prompt
          await this.sttService.start({
            language: this.config.language,
            vocabularyBias,
          });
          break;
        case 'vosk':
          await this.sttService.start({
            vocabularyBias,
          });
          break;
        case 'native':
        default:
          await this.sttService.start({
            language: this.config.language,
            maxAlternatives: 3,
            vocabularyBias,
            interimResults: true,
            continuous: false,
          });
          break;
      }

      // Set max recording timeout
      this.recordingTimeout = setTimeout(() => {
        this.stopRecording();
      }, this.config.maxRecordingTime);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start recording';
      this.updateState({
        sttState: 'error',
        error: message,
      });
    }
  }

  /**
   * Stop voice recording and process result
   */
  async stopRecording(): Promise<VoiceParseResult | null> {
    if (this.state.sttState !== 'listening') {
      return null;
    }

    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }

    this.updateState({ sttState: 'processing' });

    try {
      const result = await this.sttService.stop();

      if (!result || !result.transcript.trim()) {
        this.updateState({
          sttState: 'idle',
          error: 'No speech detected',
        });
        return null;
      }

      this.updateState({ finalTranscript: result.transcript });

      // Process the transcript
      return await this.processTranscript(result.transcript);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Recording failed';
      this.updateState({
        sttState: 'error',
        error: message,
      });
      return null;
    }
  }

  /**
   * Cancel recording without processing
   */
  cancelRecording(): void {
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }

    if (this.state.sttState === 'listening') {
      this.sttService.stop().catch(() => {});
    }

    this.updateState({
      sttState: 'idle',
      interimTranscript: '',
      isProcessing: false,
    });
  }

  /**
   * Process a transcript directly (for text input fallback)
   */
  async processTranscript(transcript: string): Promise<VoiceParseResult | null> {
    this.updateState({ isProcessing: true });

    try {
      // Check cache first
      const cached = await getCachedResult(transcript);
      if (cached) {
        const result: VoiceParseResult = { ...cached, cached: true };
        await this.handleParseResult(result);
        return result;
      }

      // Process through parser pipeline
      const result = await parseVoiceCommand(transcript);

      // Cache successful results
      if (result.success) {
        await cacheResult(transcript, result);
      }

      await this.handleParseResult(result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Parse failed';
      this.updateState({
        sttState: 'error',
        error: message,
        isProcessing: false,
      });
      return null;
    }
  }

  /**
   * Handle clarification selection
   */
  async handleClarificationSelection(
    optionId: string
  ): Promise<VoiceParseResult | null> {
    const { parseResult, clarificationRequest } = this.state;

    if (!parseResult || !clarificationRequest) {
      return null;
    }

    const selectedOption = clarificationRequest.options.find(
      (opt) => opt.id === optionId
    );

    if (!selectedOption) {
      return null;
    }

    // Update the exercise with selected match
    if (parseResult.exercise) {
      const updatedResult: VoiceParseResult = {
        ...parseResult,
        exercise: {
          ...parseResult.exercise,
          matchedExerciseId: selectedOption.exerciseId,
          matchedExerciseName: selectedOption.label,
          matchConfidence: 100,
          needsClarification: false,
        },
      };

      this.updateState({
        parseResult: updatedResult,
        clarificationRequest: null,
        isProcessing: false,
      });

      return updatedResult;
    }

    return null;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current state
   */
  getState(): VoiceCoordinatorState {
    return { ...this.state };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
    }
    this.listeners.clear();

    // Unload STT model to free memory
    if (this.sttService?.unload) {
      this.sttService.unload();
    }
  }

  // ============================================
  // Private Methods
  // ============================================

  private setupSTTListeners(): void {
    this.sttService.onInterimResult((text: string) => {
      this.updateState({ interimTranscript: text });
    });

    this.sttService.onFinalResult((result: { transcript: string; confidence: number }) => {
      this.updateState({
        finalTranscript: result.transcript,
        interimTranscript: '',
      });
    });
  }

  private async handleParseResult(result: VoiceParseResult): Promise<void> {
    this.updateState({
      parseResult: result,
      sttState: 'idle',
    });

    // Check if clarification is needed
    if (result.exercise?.needsClarification) {
      // Fetch search results for clarification options
      const searchResults = await searchExercisesEnhanced(
        result.exercise.rawName,
        {}
      );

      const clarification = generateClarificationRequest(
        result.exercise,
        searchResults
      );

      this.updateState({
        clarificationRequest: clarification,
        isProcessing: false,
      });
    } else {
      this.updateState({ isProcessing: false });
    }
  }

  private updateState(partial: Partial<VoiceCoordinatorState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  }
}

// ============================================
// Factory Function
// ============================================

let coordinatorInstance: VoiceCoordinator | null = null;

/**
 * Get or create the voice coordinator singleton
 */
export function getVoiceCoordinator(
  config?: Partial<VoiceCoordinatorConfig>
): VoiceCoordinator {
  if (!coordinatorInstance) {
    coordinatorInstance = new VoiceCoordinator(config);
  }
  return coordinatorInstance;
}

/**
 * Reset the coordinator (for testing)
 */
export function resetVoiceCoordinator(): void {
  if (coordinatorInstance) {
    coordinatorInstance.dispose();
    coordinatorInstance = null;
  }
}
