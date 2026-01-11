/**
 * useVoiceWorkout Hook
 *
 * React hook for voice-controlled workout input.
 * Provides a clean interface to the voice coordinator.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  VoiceCoordinator,
  VoiceCoordinatorState,
  getVoiceCoordinator,
} from '@/lib/services/voice/coordinator';
import type { VoiceParseResult, ClarificationRequest } from '@/lib/services/voice/types';

// ============================================
// Types
// ============================================

export interface UseVoiceWorkoutReturn {
  // State
  isListening: boolean;
  isProcessing: boolean;
  interimTranscript: string;
  finalTranscript: string;
  parseResult: VoiceParseResult | null;
  clarificationRequest: ClarificationRequest | null;
  error: string | null;

  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<VoiceParseResult | null>;
  cancelRecording: () => void;
  processText: (text: string) => Promise<VoiceParseResult | null>;
  selectClarification: (optionId: string) => Promise<VoiceParseResult | null>;
  dismissClarification: () => void;
  clearResult: () => void;
}

// ============================================
// Hook
// ============================================

export function useVoiceWorkout(options?: {
  enableLLM?: boolean;
  onResult?: (result: VoiceParseResult) => void;
  onError?: (error: string) => void;
}): UseVoiceWorkoutReturn {
  const [state, setState] = useState<VoiceCoordinatorState>({
    sttState: 'idle',
    interimTranscript: '',
    finalTranscript: '',
    parseResult: null,
    clarificationRequest: null,
    error: null,
    isProcessing: false,
  });

  const [coordinator] = useState(() =>
    getVoiceCoordinator({ enableLLM: options?.enableLLM })
  );

  // Subscribe to coordinator state changes
  useEffect(() => {
    const unsubscribe = coordinator.subscribe((newState) => {
      setState(newState);

      // Notify callbacks
      if (newState.parseResult && newState.parseResult.success && !newState.clarificationRequest) {
        options?.onResult?.(newState.parseResult);
      }
      if (newState.error) {
        options?.onError?.(newState.error);
      }
    });

    return unsubscribe;
  }, [coordinator, options?.onResult, options?.onError]);

  // Actions
  const startRecording = useCallback(async () => {
    await coordinator.startRecording();
  }, [coordinator]);

  const stopRecording = useCallback(async () => {
    return await coordinator.stopRecording();
  }, [coordinator]);

  const cancelRecording = useCallback(() => {
    coordinator.cancelRecording();
  }, [coordinator]);

  const processText = useCallback(
    async (text: string) => {
      return await coordinator.processTranscript(text);
    },
    [coordinator]
  );

  const selectClarification = useCallback(
    async (optionId: string) => {
      return await coordinator.handleClarificationSelection(optionId);
    },
    [coordinator]
  );

  const dismissClarification = useCallback(() => {
    setState((prev) => ({ ...prev, clarificationRequest: null }));
  }, []);

  const clearResult = useCallback(() => {
    setState((prev) => ({
      ...prev,
      parseResult: null,
      clarificationRequest: null,
      finalTranscript: '',
      error: null,
    }));
  }, []);

  return {
    // State
    isListening: state.sttState === 'listening',
    isProcessing: state.isProcessing || state.sttState === 'processing',
    interimTranscript: state.interimTranscript,
    finalTranscript: state.finalTranscript,
    parseResult: state.parseResult,
    clarificationRequest: state.clarificationRequest,
    error: state.error,

    // Actions
    startRecording,
    stopRecording,
    cancelRecording,
    processText,
    selectClarification,
    dismissClarification,
    clearResult,
  };
}

// ============================================
// Simplified Hook for Quick Input
// ============================================

/**
 * Simplified hook for just voice-to-text without parsing
 */
export function useVoiceInput(options?: {
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
}): {
  isListening: boolean;
  transcript: string;
  startListening: () => Promise<void>;
  stopListening: () => Promise<string | null>;
  cancel: () => void;
} {
  const {
    isListening,
    interimTranscript,
    finalTranscript,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceWorkout();

  useEffect(() => {
    if (finalTranscript && options?.onTranscript) {
      options.onTranscript(finalTranscript);
    }
  }, [finalTranscript, options?.onTranscript]);

  useEffect(() => {
    if (error && options?.onError) {
      options.onError(error);
    }
  }, [error, options?.onError]);

  const stopListening = useCallback(async () => {
    const result = await stopRecording();
    return result?.rawTranscript || null;
  }, [stopRecording]);

  return {
    isListening,
    transcript: interimTranscript || finalTranscript,
    startListening: startRecording,
    stopListening,
    cancel: cancelRecording,
  };
}
