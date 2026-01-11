/**
 * Whisper.cpp Offline Speech-to-Text Service
 *
 * Uses whisper.rn (whisper.cpp binding) for high-quality, offline speech recognition.
 * Optimized for noisy gym environments with background music and clanking weights.
 *
 * NOTE: This module requires the whisper.rn native module to be installed and linked.
 * If not available, the VoiceCoordinator will fall back to native STT.
 *
 * Models:
 * - tiny.en: ~75MB, fastest, good for simple commands
 * - base.en: ~150MB, better accuracy, recommended
 * - small.en: ~500MB, best accuracy, slower
 */

import { Audio } from 'expo-av';
import { Paths, deleteAsync, getInfoAsync, makeDirectoryAsync, createDownloadResumable } from 'expo-file-system';

import type { STTConfig, STTResult, STTError, STTState } from './types';
import { getVocabularyBias } from './vocabulary';

// Lazy-loaded whisper.rn module
let whisperModule: {
  initWhisper: (config: { filePath: string }) => Promise<any>;
  transcribe: (context: any, uri: string, options: any) => Promise<any>;
} | null = null;

// Try to load whisper.rn - will fail gracefully if not available
let whisperLoadError: Error | null = null;
try {
  // @ts-ignore - whisper.rn doesn't have types
  whisperModule = require('whisper.rn');
} catch (e) {
  whisperLoadError = e as Error;
  console.warn('[WhisperSTT] whisper.rn module not available:', e);
}

type WhisperContext = any;

// Model configuration
export type WhisperModel = 'tiny.en' | 'base.en' | 'small.en';

interface WhisperModelInfo {
  name: WhisperModel;
  size: string;
  url: string;
  filename: string;
}

const WHISPER_MODELS: Record<WhisperModel, WhisperModelInfo> = {
  'tiny.en': {
    name: 'tiny.en',
    size: '75MB',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
    filename: 'ggml-tiny.en.bin',
  },
  'base.en': {
    name: 'base.en',
    size: '150MB',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
    filename: 'ggml-base.en.bin',
  },
  'small.en': {
    name: 'small.en',
    size: '500MB',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin',
    filename: 'ggml-small.en.bin',
  },
};

// Default recommended model for gym use
const DEFAULT_MODEL: WhisperModel = 'base.en';

// Default configuration
const DEFAULT_CONFIG: STTConfig = {
  language: 'en',
  maxAlternatives: 1,
  vocabularyBias: [],
  interimResults: false, // Whisper processes full audio, no interim
  continuous: false,
};

interface WhisperSTTConfig {
  model: WhisperModel;
  maxDuration: number; // Max recording duration in ms
  onProgress?: (progress: number) => void;
}

const DEFAULT_WHISPER_CONFIG: WhisperSTTConfig = {
  model: DEFAULT_MODEL,
  maxDuration: 15000, // 15 seconds max
};

/**
 * Whisper STT Service for high-quality offline speech recognition
 */
class WhisperSTTService {
  private config: STTConfig;
  private whisperConfig: WhisperSTTConfig;
  private currentState: STTState = 'idle';
  private whisperContext: WhisperContext | null = null;
  private isModelLoaded = false;
  private isModelLoading = false;
  private recording: Audio.Recording | null = null;
  private recordingUri: string | null = null;

  // Callbacks
  private interimCallback?: (text: string) => void;
  private finalCallback?: (result: STTResult) => void;
  private errorCallback?: (error: STTError) => void;
  private stateCallback?: (state: STTState) => void;

  constructor(
    config: Partial<STTConfig> = {},
    whisperConfig: Partial<WhisperSTTConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.whisperConfig = { ...DEFAULT_WHISPER_CONFIG, ...whisperConfig };
  }

  /**
   * Check if speech recognition is available (module installed and model loaded)
   */
  async isAvailable(): Promise<boolean> {
    return whisperModule !== null && this.isModelLoaded;
  }

  /**
   * Check if whisper.rn module is installed
   */
  static isModuleAvailable(): boolean {
    return whisperModule !== null;
  }

  /**
   * Get the model file path
   */
  private getModelPath(): string {
    const modelInfo = WHISPER_MODELS[this.whisperConfig.model];
    return `${Paths.document.uri}whisper/${modelInfo.filename}`;
  }

  /**
   * Check if model is downloaded
   */
  async isModelDownloaded(): Promise<boolean> {
    const modelPath = this.getModelPath();
    const info = await getInfoAsync(modelPath);
    return info.exists;
  }

  /**
   * Download the Whisper model
   */
  async downloadModel(
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    const modelInfo = WHISPER_MODELS[this.whisperConfig.model];
    const modelPath = this.getModelPath();

    // Ensure directory exists
    const dirPath = `${Paths.document.uri}whisper`;
    const dirInfo = await getInfoAsync(dirPath);
    if (!dirInfo.exists) {
      await makeDirectoryAsync(dirPath, { intermediates: true });
    }

    console.log(`[WhisperSTT] Downloading ${modelInfo.name} (${modelInfo.size})...`);

    try {
      const downloadResumable = createDownloadResumable(
        modelInfo.url,
        modelPath,
        {},
        (downloadProgress) => {
          const progress =
            downloadProgress.totalBytesWritten /
            downloadProgress.totalBytesExpectedToWrite;
          onProgress?.(progress);
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (result?.uri) {
        console.log(`[WhisperSTT] Model downloaded to ${result.uri}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[WhisperSTT] Download failed:', error);
      this.handleError('recognition_failed', `Model download failed: ${error}`);
      return false;
    }
  }

  /**
   * Load the Whisper model
   */
  async loadModel(): Promise<boolean> {
    // Check if whisper module is available
    if (!whisperModule) {
      this.handleError('recognition_failed', 'Whisper module not available. Install whisper.rn and rebuild.');
      return false;
    }

    if (this.isModelLoaded) return true;
    if (this.isModelLoading) {
      // Wait for existing load
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (!this.isModelLoading) {
            clearInterval(check);
            resolve(this.isModelLoaded);
          }
        }, 100);
      });
    }

    this.isModelLoading = true;

    try {
      // Check if model is downloaded
      const isDownloaded = await this.isModelDownloaded();
      if (!isDownloaded) {
        console.log('[WhisperSTT] Model not found, downloading...');
        const downloaded = await this.downloadModel(
          this.whisperConfig.onProgress
        );
        if (!downloaded) {
          throw new Error('Failed to download model');
        }
      }

      const modelPath = this.getModelPath();
      console.log('[WhisperSTT] Initializing Whisper context...');

      this.whisperContext = await whisperModule.initWhisper({
        filePath: modelPath,
      });

      this.isModelLoaded = true;
      console.log('[WhisperSTT] Model loaded successfully');
      return true;
    } catch (error) {
      console.error('[WhisperSTT] Failed to load model:', error);
      this.handleError('recognition_failed', `Failed to load model: ${error}`);
      return false;
    } finally {
      this.isModelLoading = false;
    }
  }

  /**
   * Request microphone permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Check permission status
   */
  async hasPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.getPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Start recording audio
   */
  async start(customConfig?: Partial<STTConfig>): Promise<void> {
    const config = { ...this.config, ...customConfig };

    // Ensure model is loaded
    if (!this.isModelLoaded) {
      const loaded = await this.loadModel();
      if (!loaded) {
        throw new Error('Failed to load Whisper model');
      }
    }

    try {
      this.setState('listening');

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create recording with WAV format (required by Whisper)
      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 256000,
        },
      });

      this.recording = recording;
      console.log('[WhisperSTT] Recording started');

      // Auto-stop after max duration
      setTimeout(() => {
        if (this.currentState === 'listening') {
          this.stop();
        }
      }, this.whisperConfig.maxDuration);
    } catch (error) {
      this.setState('error');
      this.handleError('recognition_failed', `Failed to start recording: ${error}`);
      throw error;
    }
  }

  /**
   * Stop recording and transcribe
   */
  async stop(): Promise<STTResult | null> {
    if (!this.recording || this.currentState !== 'listening') {
      return null;
    }

    try {
      this.setState('processing');

      // Stop recording
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;

      if (!uri) {
        throw new Error('No recording URI');
      }

      console.log('[WhisperSTT] Recording stopped, transcribing...');

      // Transcribe with Whisper
      if (!this.whisperContext) {
        throw new Error('Whisper context not initialized');
      }

      const startTime = Date.now();

      if (!whisperModule) {
        throw new Error('Whisper module not available');
      }

      const result = await whisperModule.transcribe(this.whisperContext, uri, {
        language: 'en',
        maxLen: 1,
        tokenTimestamps: false,
        // Vocabulary boost via initial prompt
        prompt: await this.buildPrompt(),
      });

      const duration = Date.now() - startTime;
      console.log(`[WhisperSTT] Transcription completed in ${duration}ms`);

      // Clean up audio file
      await deleteAsync(uri, { idempotent: true });

      if (result && result.result) {
        const transcript = result.result.trim();

        if (transcript) {
          const sttResult: STTResult = {
            transcript,
            confidence: 0.95, // Whisper is generally high confidence
            isFinal: true,
            alternatives: [],
            source: 'native',
          };

          this.setState('idle');
          this.finalCallback?.(sttResult);
          return sttResult;
        }
      }

      this.setState('idle');
      return null;
    } catch (error) {
      console.error('[WhisperSTT] Transcription failed:', error);
      this.setState('error');
      this.handleError('recognition_failed', `Transcription failed: ${error}`);
      return null;
    }
  }

  /**
   * Build vocabulary boost prompt
   */
  private async buildPrompt(): Promise<string> {
    try {
      const vocab = await getVocabularyBias();
      // Use top exercises as context
      const topExercises = vocab.slice(0, 20).join(', ');
      return `Workout logging. Exercises: ${topExercises}. Sets, reps, weight.`;
    } catch {
      return 'Workout logging. Exercises, sets, reps, weight.';
    }
  }

  /**
   * Abort recording without transcribing
   */
  async abort(): Promise<void> {
    try {
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        const uri = this.recording.getURI();
        this.recording = null;

        if (uri) {
          await deleteAsync(uri, { idempotent: true });
        }
      }
      this.setState('idle');
    } catch {
      // Ignore abort errors
    }
  }

  /**
   * Unload model to free memory
   */
  async unload(): Promise<void> {
    if (this.whisperContext) {
      await this.whisperContext.release();
      this.whisperContext = null;
    }
    this.isModelLoaded = false;
    this.setState('idle');
    console.log('[WhisperSTT] Model unloaded');
  }

  // Callback setters
  onInterimResult(callback: (text: string) => void): void {
    this.interimCallback = callback;
  }

  onFinalResult(callback: (result: STTResult) => void): void {
    this.finalCallback = callback;
  }

  onError(callback: (error: STTError) => void): void {
    this.errorCallback = callback;
  }

  onStateChange(callback: (state: STTState) => void): void {
    this.stateCallback = callback;
  }

  getState(): STTState {
    return this.currentState;
  }

  isReady(): boolean {
    return this.isModelLoaded;
  }

  getModelInfo(): WhisperModelInfo {
    return WHISPER_MODELS[this.whisperConfig.model];
  }

  private setState(state: STTState): void {
    this.currentState = state;
    this.stateCallback?.(state);
  }

  private handleError(
    code: STTError['code'],
    message: string,
    recoverable = true
  ): void {
    this.errorCallback?.({
      code,
      message,
      recoverable,
    });
  }
}

// Singleton instance
let serviceInstance: WhisperSTTService | null = null;

/**
 * Get or create the Whisper STT service
 */
export function getWhisperSTTService(
  config?: Partial<STTConfig>,
  whisperConfig?: Partial<WhisperSTTConfig>
): WhisperSTTService {
  if (!serviceInstance) {
    serviceInstance = new WhisperSTTService(config, whisperConfig);
  }
  return serviceInstance;
}

/**
 * Pre-download the Whisper model
 */
export async function predownloadWhisperModel(
  model: WhisperModel = DEFAULT_MODEL,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  const service = new WhisperSTTService({}, { model, onProgress });
  return service.downloadModel(onProgress);
}

/**
 * Pre-load the Whisper model for faster first recognition
 */
export async function preloadWhisperModel(
  model: WhisperModel = DEFAULT_MODEL
): Promise<boolean> {
  const service = getWhisperSTTService({}, { model });
  return service.loadModel();
}

/**
 * Unload the Whisper model
 */
export async function unloadWhisperModel(): Promise<void> {
  if (serviceInstance) {
    await serviceInstance.unload();
  }
}

/**
 * Check if model is downloaded
 */
export async function isWhisperModelDownloaded(
  model: WhisperModel = DEFAULT_MODEL
): Promise<boolean> {
  const service = new WhisperSTTService({}, { model });
  return service.isModelDownloaded();
}

export { WhisperSTTService, WHISPER_MODELS, DEFAULT_MODEL };
export type { WhisperModelInfo, WhisperSTTConfig };
