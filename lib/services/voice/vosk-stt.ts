/**
 * Vosk Offline Speech-to-Text Service
 *
 * Uses Vosk for completely offline, on-device speech recognition.
 * No cloud dependency, no per-request costs, works offline.
 *
 * Model: vosk-model-small-en-us (~40MB)
 */

import type { EventSubscription } from 'react-native';
import type { STTConfig, STTResult, STTError, STTState } from './types';

// Conditionally import Vosk (requires native build)
let Vosk: any = null;
let VOSK_AVAILABLE = false;

try {
  Vosk = require('react-native-vosk');
  VOSK_AVAILABLE = true;
} catch {
  console.warn('[VoskSTT] react-native-vosk not available (requires native build)');
}
import { getVocabularyBias } from './vocabulary';

// Default configuration optimized for workout commands
const DEFAULT_CONFIG: STTConfig = {
  language: 'en-US',
  maxAlternatives: 3,
  vocabularyBias: [],
  interimResults: true,
  continuous: false,
};

// Vosk-specific configuration
interface VoskConfig {
  modelPath: string;
  timeout?: number;
}

const DEFAULT_VOSK_CONFIG: VoskConfig = {
  modelPath: 'model-en-us',
  timeout: 10000, // 10 seconds max listening time
};

/**
 * Vosk STT Service class for offline speech recognition
 */
class VoskSTTService {
  private config: STTConfig;
  private voskConfig: VoskConfig;
  private currentState: STTState = 'idle';
  private isModelLoaded = false;
  private isModelLoading = false;

  // Callbacks
  private interimCallback?: (text: string) => void;
  private finalCallback?: (result: STTResult) => void;
  private errorCallback?: (error: STTError) => void;
  private stateCallback?: (state: STTState) => void;

  // Event subscriptions
  private resultSubscription?: EventSubscription;
  private partialSubscription?: EventSubscription;
  private errorSubscription?: EventSubscription;
  private timeoutSubscription?: EventSubscription;
  private finalSubscription?: EventSubscription;

  constructor(config: Partial<STTConfig> = {}, voskConfig: Partial<VoskConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.voskConfig = { ...DEFAULT_VOSK_CONFIG, ...voskConfig };
  }

  /**
   * Check if speech recognition is available (model loaded)
   */
  async isAvailable(): Promise<boolean> {
    return this.isModelLoaded;
  }

  /**
   * Load the Vosk model
   * Must be called before starting recognition
   */
  async loadModel(): Promise<boolean> {
    if (this.isModelLoaded) return true;
    if (this.isModelLoading) {
      // Wait for existing load to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isModelLoading) {
            clearInterval(checkInterval);
            resolve(this.isModelLoaded);
          }
        }, 100);
      });
    }

    this.isModelLoading = true;

    try {
      console.log('[VoskSTT] Loading model:', this.voskConfig.modelPath);
      await Vosk.loadModel(this.voskConfig.modelPath);
      this.isModelLoaded = true;
      console.log('[VoskSTT] Model loaded successfully');
      return true;
    } catch (error) {
      console.error('[VoskSTT] Failed to load model:', error);
      this.handleError('recognition_failed', `Failed to load Vosk model: ${error}`);
      return false;
    } finally {
      this.isModelLoading = false;
    }
  }

  /**
   * Request microphone permissions
   * Vosk uses the native audio, so we need to use expo-av for permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { Audio } = await import('expo-av');
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Check current permission status
   */
  async hasPermissions(): Promise<boolean> {
    try {
      const { Audio } = await import('expo-av');
      const { status } = await Audio.getPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Start listening for speech
   */
  async start(customConfig?: Partial<STTConfig>): Promise<void> {
    const config = { ...this.config, ...customConfig };

    // Ensure model is loaded
    if (!this.isModelLoaded) {
      const loaded = await this.loadModel();
      if (!loaded) {
        throw new Error('Failed to load Vosk model');
      }
    }

    // Set up event listeners
    this.setupListeners();

    // Build grammar from vocabulary bias for better accuracy
    let grammar: string[] | undefined;
    if (config.vocabularyBias.length > 0) {
      // Add [unk] token to allow unknown words
      grammar = [...config.vocabularyBias.slice(0, 50), '[unk]'];
    } else {
      // Get vocabulary bias if not provided
      const bias = await getVocabularyBias();
      if (bias.length > 0) {
        grammar = [...bias.slice(0, 50), '[unk]'];
      }
    }

    try {
      this.setState('listening');

      const startOptions: { grammar?: string[]; timeout?: number } = {};
      if (grammar) {
        startOptions.grammar = grammar;
      }
      if (this.voskConfig.timeout) {
        startOptions.timeout = this.voskConfig.timeout;
      }

      await Vosk.start(startOptions);
      console.log('[VoskSTT] Started listening');
    } catch (error) {
      this.setState('error');
      this.handleError('recognition_failed', `Failed to start Vosk: ${error}`);
      throw error;
    }
  }

  /**
   * Stop listening and get final result
   * Returns a promise that resolves when Vosk delivers the final result
   */
  async stop(): Promise<STTResult | null> {
    return new Promise((resolve) => {
      try {
        this.setState('processing');

        // Set up a one-time listener for the final result
        const originalFinalCallback = this.finalCallback;
        let resolved = false;

        // Timeout to prevent hanging forever
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this.finalCallback = originalFinalCallback;
            this.setState('idle');
            resolve(null);
          }
        }, 3000); // 3 second timeout

        this.finalCallback = (result: STTResult) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            this.finalCallback = originalFinalCallback;
            // Also call the original callback if set
            originalFinalCallback?.(result);
            resolve(result);
          }
        };

        Vosk.stop();
      } catch (error) {
        this.setState('error');
        this.handleError('recognition_failed', 'Failed to stop Vosk');
        resolve(null);
      }
    });
  }

  /**
   * Abort recognition without processing
   */
  async abort(): Promise<void> {
    try {
      Vosk.stop();
      this.setState('idle');
      this.cleanupListeners();
    } catch {
      // Ignore abort errors
    }
  }

  /**
   * Unload the model to free memory
   */
  unload(): void {
    this.cleanupListeners();
    Vosk.unload();
    this.isModelLoaded = false;
    this.setState('idle');
    console.log('[VoskSTT] Model unloaded');
  }

  /**
   * Set callback for interim results (live transcription)
   */
  onInterimResult(callback: (text: string) => void): void {
    this.interimCallback = callback;
  }

  /**
   * Set callback for final result
   */
  onFinalResult(callback: (result: STTResult) => void): void {
    this.finalCallback = callback;
  }

  /**
   * Set callback for errors
   */
  onError(callback: (error: STTError) => void): void {
    this.errorCallback = callback;
  }

  /**
   * Set callback for state changes
   */
  onStateChange(callback: (state: STTState) => void): void {
    this.stateCallback = callback;
  }

  /**
   * Get current state
   */
  getState(): STTState {
    return this.currentState;
  }

  /**
   * Check if model is loaded
   */
  isReady(): boolean {
    return this.isModelLoaded;
  }

  private setupListeners(): void {
    // Clean up any existing listeners
    this.cleanupListeners();

    // Partial/interim results
    this.partialSubscription = Vosk.onPartialResult((result: string) => {
      try {
        const parsed = JSON.parse(result);
        if (parsed.partial) {
          this.interimCallback?.(parsed.partial);
        }
      } catch {
        // Raw string result
        if (result) {
          this.interimCallback?.(result);
        }
      }
    });

    // Result when silence detected (intermediate)
    this.resultSubscription = Vosk.onResult((result: string) => {
      try {
        const parsed = JSON.parse(result);
        if (parsed.text) {
          // Keep listening for more
          this.interimCallback?.(parsed.text);
        }
      } catch {
        if (result) {
          this.interimCallback?.(result);
        }
      }
    });

    // Final result when stream ends
    this.finalSubscription = Vosk.onFinalResult((result: string) => {
      this.setState('idle');
      this.cleanupListeners();

      try {
        const parsed = JSON.parse(result);
        const transcript = parsed.text || '';

        if (transcript) {
          const sttResult: STTResult = {
            transcript,
            confidence: 0.9, // Vosk doesn't provide confidence, assume high for offline
            isFinal: true,
            alternatives: [],
            source: 'native',
          };
          this.finalCallback?.(sttResult);
        }
      } catch {
        // Raw string result
        if (result) {
          const sttResult: STTResult = {
            transcript: result,
            confidence: 0.9,
            isFinal: true,
            alternatives: [],
            source: 'native',
          };
          this.finalCallback?.(sttResult);
        }
      }
    });

    // Error handling
    this.errorSubscription = Vosk.onError((error: string) => {
      console.error('[VoskSTT] Error:', error);
      this.setState('error');
      this.cleanupListeners();
      this.handleError('recognition_failed', String(error));
    });

    // Timeout handling
    this.timeoutSubscription = Vosk.onTimeout(() => {
      console.log('[VoskSTT] Timeout - no speech detected');
      this.setState('idle');
      this.cleanupListeners();
      this.handleError('timeout', 'No speech detected', true);
    });
  }

  private cleanupListeners(): void {
    this.resultSubscription?.remove();
    this.partialSubscription?.remove();
    this.errorSubscription?.remove();
    this.timeoutSubscription?.remove();
    this.finalSubscription?.remove();
    this.resultSubscription = undefined;
    this.partialSubscription = undefined;
    this.errorSubscription = undefined;
    this.timeoutSubscription = undefined;
    this.finalSubscription = undefined;
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
let serviceInstance: VoskSTTService | null = null;

/**
 * Get or create the Vosk STT service instance
 */
export function getVoskSTTService(
  config?: Partial<STTConfig>,
  voskConfig?: Partial<VoskConfig>
): VoskSTTService {
  if (!serviceInstance) {
    serviceInstance = new VoskSTTService(config, voskConfig);
  }
  return serviceInstance;
}

/**
 * Pre-load the model for faster first recognition
 * Call this during app startup
 */
export async function preloadVoskModel(): Promise<boolean> {
  const service = getVoskSTTService();
  return service.loadModel();
}

/**
 * Unload the model to free memory
 * Call this when voice features are not needed
 */
export function unloadVoskModel(): void {
  if (serviceInstance) {
    serviceInstance.unload();
  }
}

export { VoskSTTService };
