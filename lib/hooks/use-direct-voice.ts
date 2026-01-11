/**
 * useDirectVoice Hook
 *
 * React hook for the "Direct-to-Intent" voice workout logging.
 * Manages recording state, permissions, and extraction results.
 *
 * Usage:
 * ```tsx
 * const {
 *   state,
 *   isRecording,
 *   durationMs,
 *   result,
 *   error,
 *   startRecording,
 *   stopRecording,
 *   cancelRecording,
 * } = useDirectVoice();
 * ```
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  voiceDirectService,
  type AudioFile,
} from '@/lib/services/voice/voice-direct-service';
import {
  AUDIO_CONFIG,
  type RecordingState,
  type ExtractedWorkoutFromAudio,
  type DirectIntentError,
  type DirectIntentResult,
  type AudioContext,
  type UseDirectVoiceReturn,
} from '@/lib/services/voice/direct-intent-types';

// ============================================
// HOOK
// ============================================

export function useDirectVoice(context?: AudioContext): UseDirectVoiceReturn {
  // State
  const [state, setState] = useState<RecordingState>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [result, setResult] = useState<ExtractedWorkoutFromAudio | null>(null);
  const [error, setError] = useState<DirectIntentError | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  // Refs
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check permission on mount
  useEffect(() => {
    voiceDirectService.checkPermission().then(setHasPermission);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (maxDurationTimeoutRef.current) {
        clearTimeout(maxDurationTimeoutRef.current);
      }
      // Cancel any in-progress recording
      if (voiceDirectService.isRecording()) {
        voiceDirectService.cancelRecording();
      }
    };
  }, []);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const granted = await voiceDirectService.requestPermission();
    setHasPermission(granted);
    return granted;
  }, []);

  // Start duration tracking
  const startDurationTracking = useCallback(() => {
    setDurationMs(0);

    // Update duration every 100ms
    durationIntervalRef.current = setInterval(() => {
      const currentDuration = voiceDirectService.getRecordingDuration();
      setDurationMs(currentDuration);
    }, 100);

    // Auto-stop at max duration
    maxDurationTimeoutRef.current = setTimeout(async () => {
      console.log('Max duration reached, auto-stopping');
      await stopRecordingInternal();
    }, AUDIO_CONFIG.MAX_DURATION_MS);
  }, []);

  // Stop duration tracking
  const stopDurationTracking = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setResult(null);

      // Request permission if needed
      if (!hasPermission) {
        setState('requesting');
        const granted = await requestPermission();
        if (!granted) {
          setState('error');
          setError({
            code: 'permission_denied',
            message: 'Microphone permission is required',
            recoverable: false,
            suggestion: 'Please enable microphone access in Settings',
          });
          return;
        }
      }

      setState('recording');
      await voiceDirectService.startRecording();
      startDurationTracking();
    } catch (err: any) {
      setState('error');
      setError(err.code ? err : {
        code: 'recording_failed',
        message: err.message || 'Failed to start recording',
        recoverable: true,
      });
    }
  }, [hasPermission, requestPermission, startDurationTracking]);

  // Internal stop recording (for auto-stop)
  const stopRecordingInternal = useCallback(async (): Promise<DirectIntentResult> => {
    stopDurationTracking();

    try {
      // Stop recording
      setState('uploading');
      const audioFile = await voiceDirectService.stopRecording();

      // Extract workout
      setState('processing');
      const extractionResult = await voiceDirectService.extractWorkout(audioFile, context);

      if (extractionResult.success && extractionResult.data) {
        setState('success');
        setResult(extractionResult.data);
        return extractionResult;
      } else {
        setState('error');
        setError(extractionResult.error || {
          code: 'extraction_failed',
          message: 'Unknown error',
          recoverable: true,
        });
        return extractionResult;
      }
    } catch (err: any) {
      setState('error');
      const directError: DirectIntentError = err.code ? err : {
        code: 'extraction_failed',
        message: err.message || 'Failed to process recording',
        recoverable: true,
      };
      setError(directError);
      return { success: false, error: directError };
    }
  }, [context, stopDurationTracking]);

  // Stop recording (user-initiated)
  const stopRecording = useCallback(async (): Promise<DirectIntentResult> => {
    if (state !== 'recording') {
      return {
        success: false,
        error: {
          code: 'recording_failed',
          message: 'Not currently recording',
          recoverable: true,
        },
      };
    }
    return stopRecordingInternal();
  }, [state, stopRecordingInternal]);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    stopDurationTracking();
    voiceDirectService.cancelRecording();
    setState('idle');
    setDurationMs(0);
  }, [stopDurationTracking]);

  // Reset state
  const reset = useCallback(() => {
    stopDurationTracking();
    setState('idle');
    setDurationMs(0);
    setResult(null);
    setError(null);
  }, [stopDurationTracking]);

  // Derived state
  const isRecording = state === 'recording';
  const isProcessing = state === 'uploading' || state === 'processing';

  return {
    // State
    state,
    isRecording,
    isProcessing,
    durationMs,

    // Result
    result,
    error,

    // Actions
    startRecording,
    stopRecording,
    cancelRecording,
    reset,

    // Permissions
    hasPermission,
    requestPermission,
  };
}

export default useDirectVoice;
