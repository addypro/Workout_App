/**
 * Voice Direct Service
 *
 * Handles audio recording and uploading for the "Direct-to-Intent" approach.
 * Audio is recorded using expo-av and sent directly to Gemini via Supabase
 * Edge Function for workout extraction.
 *
 * KEY ARCHITECTURE DECISION:
 * We bypass traditional STT (Speech-to-Text) entirely. Instead:
 * 1. Record audio as AAC (small file size)
 * 2. Send raw audio to Gemini 1.5 Flash
 * 3. Gemini extracts structured workout JSON directly
 *
 * This is 50x cheaper than Whisper + LLM pipeline.
 */

import { supabase } from '@/lib/supabase/client';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import {
  AUDIO_CONFIG,
  type AudioContext,
  type AudioFile,
  type DirectIntentError,
  type DirectIntentResult,
  type ExtractedWorkoutFromAudio,
} from './direct-intent-types';

// ============================================
// RECORDING CONFIG
// ============================================

/**
 * Recording options optimized for voice + bandwidth
 * AAC codec provides excellent compression with good quality
 */
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
    numberOfChannels: AUDIO_CONFIG.CHANNELS,
    bitRate: AUDIO_CONFIG.BIT_RATE,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
    numberOfChannels: AUDIO_CONFIG.CHANNELS,
    bitRate: AUDIO_CONFIG.BIT_RATE,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: AUDIO_CONFIG.BIT_RATE,
  },
};

// ============================================
// SERVICE CLASS
// ============================================

export class VoiceDirectService {
  private static instance: VoiceDirectService;
  private recording: Audio.Recording | null = null;
  private permissionGranted = false;
  private startTime = 0;

  private constructor() { }

  public static getInstance(): VoiceDirectService {
    if (!VoiceDirectService.instance) {
      VoiceDirectService.instance = new VoiceDirectService();
    }
    return VoiceDirectService.instance;
  }

  // ============================================
  // PERMISSIONS
  // ============================================

  /**
   * Check if microphone permission is granted
   */
  public async checkPermission(): Promise<boolean> {
    try {
      const { status } = await Audio.getPermissionsAsync();
      this.permissionGranted = status === 'granted';
      return this.permissionGranted;
    } catch (error) {
      console.error('Failed to check audio permission:', error);
      return false;
    }
  }

  /**
   * Request microphone permission
   */
  public async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      this.permissionGranted = status === 'granted';
      return this.permissionGranted;
    } catch (error) {
      console.error('Failed to request audio permission:', error);
      return false;
    }
  }

  // ============================================
  // RECORDING
  // ============================================

  /**
   * Start audio recording
   */
  public async startRecording(): Promise<void> {
    if (this.recording) {
      console.warn('Recording already in progress');
      return;
    }

    // Ensure permission
    if (!this.permissionGranted) {
      const granted = await this.requestPermission();
      if (!granted) {
        throw this.createError(
          'permission_denied',
          'Microphone permission is required to record audio',
          false,
          'Please enable microphone access in your device settings'
        );
      }
    }

    try {
      // Configure audio session for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create and start recording
      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      this.recording = recording;
      this.startTime = Date.now();

      console.log('Recording started');
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      throw this.createError(
        'recording_failed',
        error.message || 'Failed to start recording',
        true
      );
    }
  }

  /**
   * Stop recording and return audio file info
   */
  public async stopRecording(): Promise<AudioFile> {
    if (!this.recording) {
      throw this.createError(
        'recording_failed',
        'No recording in progress',
        true
      );
    }

    try {
      const durationMs = Date.now() - this.startTime;

      // Stop the recording
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;

      if (!uri) {
        throw this.createError(
          'recording_failed',
          'No audio file was created',
          true
        );
      }

      // Validate duration
      if (durationMs < AUDIO_CONFIG.MIN_DURATION_MS) {
        throw this.createError(
          'audio_too_short',
          'Recording is too short. Please speak for at least 1 second.',
          true
        );
      }

      if (durationMs > AUDIO_CONFIG.MAX_DURATION_MS) {
        throw this.createError(
          'audio_too_long',
          'Recording exceeded maximum duration of 2 minutes.',
          true
        );
      }

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const sizeBytes = (fileInfo as any).size || 0;

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      console.log(`Recording stopped: ${durationMs}ms, ${sizeBytes} bytes`);

      return {
        uri,
        filename: `workout_log_${Date.now()}.m4a`,
        mimeType: 'audio/mp4' as const,
        durationMs,
        sizeBytes,
      };
    } catch (error: any) {
      this.recording = null;
      if (error.code) throw error; // Already a DirectIntentError
      throw this.createError(
        'recording_failed',
        error.message || 'Failed to stop recording',
        true
      );
    }
  }

  /**
   * Cancel recording without saving
   */
  public async cancelRecording(): Promise<void> {
    if (!this.recording) return;

    try {
      await this.recording.stopAndUnloadAsync();
    } catch (error) {
      console.warn('Error stopping recording:', error);
    } finally {
      this.recording = null;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    }
  }

  /**
   * Get current recording duration in ms
   */
  public getRecordingDuration(): number {
    if (!this.recording || !this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  /**
   * Check if currently recording
   */
  public isRecording(): boolean {
    return this.recording !== null;
  }

  // ============================================
  // UPLOAD & EXTRACTION
  // ============================================

  /**
   * Upload audio file to Edge Function for extraction
   *
   * This is the core of the "Direct-to-Intent" approach:
   * Audio bytes are sent directly to Gemini 1.5 Flash which
   * extracts structured workout data in a single API call.
   */
  public async extractWorkout(
    audioFile: AudioFile,
    context?: AudioContext
  ): Promise<DirectIntentResult> {
    try {
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(audioFile.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Get Edge Function URL
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw this.createError(
          'api_error',
          'Supabase URL not configured',
          false
        );
      }

      // Get anon key for Edge Function authorization
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      // Get auth session if user is logged in
      const { data: { session } } = await supabase.auth.getSession();

      // Call the unified extract-workout-data Edge Function
      const response = await fetch(
        `${supabaseUrl}/functions/v1/extract-workout-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey || '',
            'Authorization': session?.access_token
              ? `Bearer ${session.access_token}`
              : `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            base64,
            type: audioFile.mimeType,
            context: {
              ...context,
              durationMs: audioFile.durationMs,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Edge Function error:', errorText);
        throw this.createError(
          'extraction_failed',
          `Server error: ${response.status}`,
          true
        );
      }

      const result = await response.json();

      // DEBUG: Log the transcription and extraction results
      console.log('=== VOICE EXTRACTION DEBUG ===');
      if (result.transcription) {
        console.log('[Transcription]:', result.transcription);
      }
      console.log('[Exercises found]:', result.exercises?.length || 0);
      result.exercises?.forEach((ex: any, i: number) => {
        console.log(`  [${i + 1}] ${ex.nameRaw}: ${ex.sets} sets`);
        if (ex.perSetDetails && ex.perSetDetails.length > 0) {
          ex.perSetDetails.forEach((sd: any, j: number) => {
            console.log(`      Set ${j + 1}: ${sd.reps} reps @ ${sd.weight ?? 'bodyweight'}`);
          });
        } else {
          console.log(`      weight: ${ex.weight}, reps: ${ex.reps}`);
        }
      });
      console.log('==============================');

      // Check for extraction errors
      if (result.error) {
        throw this.createError(
          result.error.code || 'extraction_failed',
          result.error.message || 'Extraction failed',
          result.error.recoverable ?? true
        );
      }

      // Validate we got exercises
      if (!result.exercises || result.exercises.length === 0) {
        throw this.createError(
          'no_workout_detected',
          'No exercises were detected in your audio. Please try again and clearly state your exercises.',
          true,
          'Example: "I did bench press, 3 sets of 8 at 185 pounds"'
        );
      }

      // Clean up the audio file
      try {
        await FileSystem.deleteAsync(audioFile.uri, { idempotent: true });
      } catch {
        // Ignore cleanup errors
      }

      return {
        success: true,
        data: result as ExtractedWorkoutFromAudio,
      };
    } catch (error: any) {
      if (error.code) {
        return { success: false, error };
      }

      // Network or unexpected error
      return {
        success: false,
        error: this.createError(
          error.message?.includes('network') ? 'network_error' : 'api_error',
          error.message || 'Failed to process audio',
          true
        ),
      };
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  private createError(
    code: DirectIntentError['code'],
    message: string,
    recoverable: boolean,
    suggestion?: string
  ): DirectIntentError {
    return { code, message, recoverable, suggestion };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const voiceDirectService = VoiceDirectService.getInstance();

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

export async function checkVoicePermission(): Promise<boolean> {
  return voiceDirectService.checkPermission();
}

export async function requestVoicePermission(): Promise<boolean> {
  return voiceDirectService.requestPermission();
}

export async function startVoiceRecording(): Promise<void> {
  return voiceDirectService.startRecording();
}

export async function stopVoiceRecording(): Promise<AudioFile> {
  return voiceDirectService.stopRecording();
}

export async function cancelVoiceRecording(): Promise<void> {
  return voiceDirectService.cancelRecording();
}

export async function extractWorkoutFromVoice(
  audioFile: AudioFile,
  context?: AudioContext
): Promise<DirectIntentResult> {
  return voiceDirectService.extractWorkout(audioFile, context);
}
