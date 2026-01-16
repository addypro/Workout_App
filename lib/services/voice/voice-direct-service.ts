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

// Re-export types for external use
export type { AudioFile };

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
// VAD (Voice Activity Detection) CONFIG
// ============================================

/**
 * VAD uses expo-av's metering to detect speech vs silence.
 * Metering returns dB values where:
 * - Silence: ~-160 to -55 dB
 * - Speech: ~-50 to 0 dB
 */
const VAD_CONFIG = {
  /** dB threshold above which we consider speech detected */
  SPEECH_THRESHOLD_DB: -45,

  /** dB threshold below which we consider silence */
  SILENCE_THRESHOLD_DB: -55,

  /** Stop recording after this many ms of silence following speech */
  AUTO_STOP_SILENCE_MS: 5000,

  /** Minimum speech duration before auto-stop is armed (prevents false triggers) */
  MIN_SPEECH_DURATION_MS: 500,

  /** How often to poll meter status (ms) */
  METER_POLL_INTERVAL_MS: 100,
};

/** VAD state machine */
export type VADState = 'waiting' | 'speaking' | 'trailing_silence';

/** Callback for VAD state changes */
export type VADStateCallback = (state: VADState, silenceMs?: number) => void;

// ============================================
// SERVICE CLASS
// ============================================

export class VoiceDirectService {
  private static instance: VoiceDirectService;
  private recording: Audio.Recording | null = null;
  private permissionGranted = false;
  private startTime = 0;

  // VAD State
  private vadState: VADState = 'waiting';
  private speechStartTime = 0;
  private silenceStartTime = 0;
  private vadCallback: VADStateCallback | null = null;
  private autoStopEnabled = true;
  private autoStopTriggered = false;

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
   * @param options.autoStop Enable auto-stop on silence (default: true)
   * @param options.onVADStateChange Callback for VAD state changes
   */
  public async startRecording(options?: {
    autoStop?: boolean;
    onVADStateChange?: VADStateCallback;
  }): Promise<void> {
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
      // Reset VAD state
      this.vadState = 'waiting';
      this.speechStartTime = 0;
      this.silenceStartTime = 0;
      this.autoStopEnabled = options?.autoStop ?? true;
      this.autoStopTriggered = false;
      this.vadCallback = options?.onVADStateChange ?? null;

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

      // Set up meter callback for VAD
      this.recording.setOnRecordingStatusUpdate((status) => {
        if (status.metering !== undefined && this.recording) {
          this.processVAD(status.metering);
        }
      });

      // Set meter polling interval
      this.recording.setProgressUpdateInterval(VAD_CONFIG.METER_POLL_INTERVAL_MS);

      // Pre-warm Edge Function (fire-and-forget to eliminate cold start)
      this.prewarmEdgeFunction();

      console.log('Recording started with VAD enabled');
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

      const mimeType = this.getMimeTypeFromUri(uri);

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

      // Reset VAD state (keep autoStopTriggered for caller to check)
      this.vadState = 'waiting';
      this.vadCallback = null;

      console.log(`Recording stopped: ${durationMs}ms, ${sizeBytes} bytes, autoStop: ${this.autoStopTriggered}`);

      return {
        uri,
        filename: `workout_log_${Date.now()}.${this.getFileExtensionFromUri(uri)}`,
        mimeType,
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
      // Reset VAD state
      this.vadState = 'waiting';
      this.vadCallback = null;
      this.autoStopTriggered = false;
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
  // VAD (Voice Activity Detection)
  // ============================================

  /**
   * Process metering data for VAD
   * State machine: waiting → speaking → trailing_silence → (auto-stop)
   */
  private processVAD(meteringDb: number): void {
    const now = Date.now();
    const isSpeech = meteringDb > VAD_CONFIG.SPEECH_THRESHOLD_DB;
    const isSilence = meteringDb < VAD_CONFIG.SILENCE_THRESHOLD_DB;

    switch (this.vadState) {
      case 'waiting':
        // Waiting for user to start speaking
        if (isSpeech) {
          this.vadState = 'speaking';
          this.speechStartTime = now;
          this.vadCallback?.('speaking');
          console.log('[VAD] Speech detected');
        }
        break;

      case 'speaking':
        if (isSilence) {
          // Check if user has spoken long enough to arm auto-stop
          const speechDuration = now - this.speechStartTime;
          if (speechDuration >= VAD_CONFIG.MIN_SPEECH_DURATION_MS) {
            this.vadState = 'trailing_silence';
            this.silenceStartTime = now;
            this.vadCallback?.('trailing_silence', 0);
            console.log('[VAD] Speech ended, waiting for silence timeout');
          }
        }
        break;

      case 'trailing_silence':
        if (isSpeech) {
          // User started speaking again, go back to speaking
          this.vadState = 'speaking';
          this.vadCallback?.('speaking');
          console.log('[VAD] Speech resumed');
        } else if (isSilence) {
          // Check if silence has exceeded auto-stop threshold
          const silenceDuration = now - this.silenceStartTime;
          this.vadCallback?.('trailing_silence', silenceDuration);

          if (this.autoStopEnabled && silenceDuration >= VAD_CONFIG.AUTO_STOP_SILENCE_MS) {
            console.log('[VAD] Auto-stop triggered after', silenceDuration, 'ms silence');
            this.autoStopTriggered = true;
            // Auto-stop the recording
            this.stopRecording().catch((err) => {
              console.error('[VAD] Auto-stop failed:', err);
            });
          }
        }
        break;
    }
  }

  /**
   * Get current VAD state
   */
  public getVADState(): VADState {
    return this.vadState;
  }

  private getFileExtensionFromUri(uri: string): string {
    const clean = uri.split('?')[0];
    const parts = clean.split('.');
    const extension = parts[parts.length - 1]?.toLowerCase();
    return extension || 'm4a';
  }

  private getMimeTypeFromUri(uri: string): AudioFile['mimeType'] {
    const extension = this.getFileExtensionFromUri(uri);
    if (extension === 'm4a') return 'audio/m4a';
    if (extension === 'aac') return 'audio/aac';
    if (extension === 'wav') return 'audio/wav';
    if (extension === 'webm') return 'audio/webm';
    if (extension === 'mp3') return 'audio/mpeg';
    if (extension === 'mp4') return 'audio/mp4';
    return 'audio/mp4';
  }

  /**
   * Check if recording was auto-stopped by VAD
   */
  public wasAutoStopped(): boolean {
    return this.autoStopTriggered;
  }

  /**
   * Get remaining silence time before auto-stop (ms)
   */
  public getSilenceRemaining(): number {
    if (this.vadState !== 'trailing_silence' || !this.silenceStartTime) {
      return VAD_CONFIG.AUTO_STOP_SILENCE_MS;
    }
    const elapsed = Date.now() - this.silenceStartTime;
    return Math.max(0, VAD_CONFIG.AUTO_STOP_SILENCE_MS - elapsed);
  }

  // ============================================
  // PRE-WARM & CHUNK UPLOAD
  // ============================================

  /** Chunk size for parallel upload (100KB chunks) */
  private static readonly CHUNK_SIZE_BYTES = 100 * 1024;

  /** Max parallel chunk uploads */
  private static readonly MAX_PARALLEL_UPLOADS = 3;

  /**
   * Pre-warm the Edge Function to eliminate cold start latency.
   * Called when recording starts so the function is hot when we upload.
   */
  private async prewarmEdgeFunction(): Promise<void> {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) return;

      // Fire-and-forget OPTIONS request to warm up the function
      fetch(`${supabaseUrl}/functions/v1/extract-workout-data`, {
        method: 'OPTIONS',
        headers: {
          'apikey': supabaseAnonKey,
        },
      }).catch(() => {
        // Ignore errors - this is just a warm-up
      });

      console.log('[Voice] Edge Function pre-warm sent');
    } catch {
      // Ignore - pre-warm is best-effort
    }
  }

  /**
   * Split base64 audio into chunks for parallel upload.
   * Returns array of base64 chunks.
   */
  private splitIntoChunks(base64: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < base64.length; i += chunkSize) {
      chunks.push(base64.slice(i, i + chunkSize));
    }
    return chunks;
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
      if (!base64 || base64.length < 32) {
        throw this.createError(
          'upload_failed',
          'Audio file could not be read. Please try again.',
          true
        );
      }

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

      const headers = {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey || '',
        'Authorization': session?.access_token
          ? `Bearer ${session.access_token}`
          : `Bearer ${supabaseAnonKey}`,
      };

      const endpoint = `${supabaseUrl}/functions/v1/extract-workout-data`;
      const fullContext = { ...context, durationMs: audioFile.durationMs };

      let response: Response;

      const uploadSingle = async (): Promise<Response> =>
        fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            base64,
            type: audioFile.mimeType,
            context: fullContext,
          }),
        });

      // Chunk uploads are unreliable on stateless Edge Functions (chunks may hit different instances).
      // Keep single upload for typical voice logs; only chunk for truly huge payloads.
      const CHUNK_THRESHOLD = 4 * 1024 * 1024;

      if (base64.length > CHUNK_THRESHOLD) {
        console.log(`[Voice] Using parallel chunk upload (${base64.length} bytes, ${Math.ceil(base64.length / VoiceDirectService.CHUNK_SIZE_BYTES)} chunks)`);

        // Split into chunks
        const chunks = this.splitIntoChunks(base64, VoiceDirectService.CHUNK_SIZE_BYTES);
        const sessionId = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const uploadChunk = async (chunkIndex: number, chunkBase64: string, isFinal: boolean) => {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              mode: 'chunk',
              sessionId,
              chunkIndex,
              base64: chunkBase64,
              type: audioFile.mimeType,
              context: fullContext,
              totalChunks: chunks.length,
              isFinal,
            }),
          });

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Chunk ${chunkIndex} failed: ${res.status} - ${errorText}`);
          }

          if (!isFinal) {
            try {
              const ack = await res.json();
              if (!ack?.success) {
                throw new Error(`Chunk ${chunkIndex} failed: invalid ack`);
              }
            } catch (error) {
              throw new Error(`Chunk ${chunkIndex} failed: invalid ack`);
            }
          }

          return res;
        };

        try {
          // Upload chunks in parallel (except final)
          const uploadPromises: Promise<Response>[] = [];
          for (let i = 0; i < chunks.length - 1; i++) {
            uploadPromises.push(uploadChunk(i, chunks[i], false));

            // Limit parallel uploads
            if (uploadPromises.length >= VoiceDirectService.MAX_PARALLEL_UPLOADS) {
              await Promise.all(uploadPromises.splice(0, VoiceDirectService.MAX_PARALLEL_UPLOADS));
            }
          }

          // Wait for remaining non-final chunks
          if (uploadPromises.length > 0) {
            await Promise.all(uploadPromises);
          }

          // Send final chunk (triggers processing)
          console.log('[Voice] Sending final chunk...');
          response = await uploadChunk(chunks.length - 1, chunks[chunks.length - 1], true);
        } catch (error) {
          console.warn('[Voice] Chunk upload failed, falling back to single upload:', error);
          response = await uploadSingle();
        }
      } else {
        // Small file: single upload
        console.log(`[Voice] Using single upload (${base64.length} bytes)`);
        response = await uploadSingle();
      }

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
