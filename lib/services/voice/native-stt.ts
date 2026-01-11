/**
 * Native Speech-to-Text Service
 * Wrapper around expo-speech-recognition for on-device speech recognition
 */

import type { STTConfig, STTResult, STTError, STTState } from './types';

// Type definitions for expo-speech-recognition events
interface SpeechResultEvent {
  results: Array<{ transcript: string; confidence: number }>;
  isFinal: boolean;
}

interface SpeechErrorEvent {
  error: string;
  message: string;
}

type SpeechEventCallback<T> = (event: T) => void;

// Conditionally import expo-speech-recognition (requires native build)
let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: <T>(
  eventName: string,
  callback: SpeechEventCallback<T>
) => void = () => {};

try {
  const speechModule = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = speechModule.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = speechModule.useSpeechRecognitionEvent;
} catch {
  console.warn('[NativeSTT] expo-speech-recognition not available (requires native build)');
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

// Confidence threshold below which we recommend cloud fallback
export const CLOUD_FALLBACK_THRESHOLD = 0.75;

/**
 * Native STT Service class for managing speech recognition
 */
class NativeSTTService {
  private config: STTConfig;
  private currentState: STTState = 'idle';
  private interimCallback?: (text: string) => void;
  private finalCallback?: (result: STTResult) => void;
  private errorCallback?: (error: STTError) => void;
  private stateCallback?: (state: STTState) => void;

  constructor(config: Partial<STTConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if speech recognition is available on this device
   */
  async isAvailable(): Promise<boolean> {
    try {
      const status = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      return status.granted || status.canAskAgain;
    } catch {
      return false;
    }
  }

  /**
   * Request microphone permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const status = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return status.granted;
    } catch {
      return false;
    }
  }

  /**
   * Check current permission status
   */
  async hasPermissions(): Promise<boolean> {
    try {
      const status = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      return status.granted;
    } catch {
      return false;
    }
  }

  /**
   * Start listening for speech
   */
  async start(customConfig?: Partial<STTConfig>): Promise<void> {
    const config = { ...this.config, ...customConfig };

    // Get vocabulary bias if not provided
    if (!config.vocabularyBias.length) {
      config.vocabularyBias = await getVocabularyBias();
    }

    try {
      this.setState('listening');

      await ExpoSpeechRecognitionModule.start({
        lang: config.language,
        interimResults: config.interimResults,
        maxAlternatives: config.maxAlternatives,
        continuous: config.continuous,
        // iOS-specific: helps with gym environment noise
        requiresOnDeviceRecognition: false,
        // Android-specific: use default recognizer
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'free_form',
        },
        // Vocabulary hints for better exercise name recognition
        contextualStrings: config.vocabularyBias.slice(0, 100), // Limit to 100 hints
      });
    } catch (error) {
      this.setState('error');
      this.handleError('recognition_failed', 'Failed to start speech recognition');
      throw error;
    }
  }

  /**
   * Stop listening and get final result
   */
  async stop(): Promise<STTResult | null> {
    try {
      this.setState('processing');
      await ExpoSpeechRecognitionModule.stop();
      // Result will come through the event listener
      return null; // Result delivered via callback
    } catch (error) {
      this.setState('error');
      this.handleError('recognition_failed', 'Failed to stop speech recognition');
      return null;
    }
  }

  /**
   * Abort recognition without processing
   */
  async abort(): Promise<void> {
    try {
      await ExpoSpeechRecognitionModule.abort();
      this.setState('idle');
    } catch {
      // Ignore abort errors
    }
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
   * Handle speech recognition result event
   * Call this from the useSpeechRecognitionEvent hook
   */
  handleResult(event: {
    results: Array<{
      transcript: string;
      confidence: number;
      isFinal: boolean;
    }>;
  }): void {
    if (!event.results?.length) return;

    const result = event.results[0];

    if (result.isFinal) {
      this.setState('idle');
      const sttResult: STTResult = {
        transcript: result.transcript,
        confidence: result.confidence ?? 0.8, // Default if not provided
        isFinal: true,
        alternatives: event.results.slice(1).map((r) => r.transcript),
        source: 'native',
      };
      this.finalCallback?.(sttResult);
    } else {
      this.interimCallback?.(result.transcript);
    }
  }

  /**
   * Handle speech recognition error event
   */
  handleErrorEvent(event: { error: string; message?: string }): void {
    this.setState('error');

    let code: STTError['code'] = 'unknown';
    let recoverable = true;

    switch (event.error) {
      case 'not-allowed':
      case 'service-not-allowed':
        code = 'permission_denied';
        recoverable = false;
        break;
      case 'network':
        code = 'network_error';
        recoverable = true;
        break;
      case 'no-speech':
      case 'audio-capture':
        code = 'recognition_failed';
        recoverable = true;
        break;
      default:
        code = 'unknown';
        recoverable = true;
    }

    this.handleError(code, event.message || event.error, recoverable);
  }

  /**
   * Handle speech recognition end event
   */
  handleEnd(): void {
    if (this.currentState === 'listening') {
      this.setState('idle');
    }
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
let serviceInstance: NativeSTTService | null = null;

/**
 * Get or create the native STT service instance
 */
export function getNativeSTTService(
  config?: Partial<STTConfig>
): NativeSTTService {
  if (!serviceInstance) {
    serviceInstance = new NativeSTTService(config);
  }
  return serviceInstance;
}

/**
 * React hook for using native STT in components
 * Handles event subscriptions automatically
 */
export function useNativeSTT(service: NativeSTTService) {
  // Subscribe to speech recognition events
  useSpeechRecognitionEvent<SpeechResultEvent>('result', (event) => {
    service.handleResult({
      results: event.results.map((r: { transcript: string; confidence: number }) => ({
        transcript: r.transcript,
        confidence: r.confidence,
        isFinal: event.isFinal,
      })),
    });
  });

  useSpeechRecognitionEvent<SpeechErrorEvent>('error', (event) => {
    service.handleErrorEvent({
      error: event.error,
      message: event.message,
    });
  });

  useSpeechRecognitionEvent('end', () => {
    service.handleEnd();
  });

  return service;
}

export { NativeSTTService };
