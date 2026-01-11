/**
 * Voice Logging Modal
 *
 * Full-screen modal for voice workout logging.
 * Uses the "Direct-to-Intent" approach with Gemini 1.5 Flash.
 *
 * Flow:
 * 1. User taps mic button -> Recording starts
 * 2. User speaks their workout (e.g., "I did bench press, 3 sets of 8 at 185")
 * 3. User taps stop -> Audio is uploaded to Edge Function
 * 4. Gemini extracts structured workout data
 * 5. User reviews and confirms the extracted exercises
 */

import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppTheme } from '@/lib/context/theme-context';
import { useDirectVoice } from '@/lib/hooks/use-direct-voice';
import type { AudioContext, ExtractedExercise } from '@/lib/services/voice/direct-intent-types';
import { VoiceRecorder } from './voice-recorder';

// ============================================
// Props
// ============================================

export interface VoiceLoggingModalProps {
  visible: boolean;
  onClose: () => void;
  onExercisesExtracted: (exercises: ExtractedExercise[], supersets?: Array<{ type: 'superset' | 'giant_set' | 'circuit'; exerciseOrders: number[] }>) => void;
  context?: AudioContext;
}

// ============================================
// Component
// ============================================

export function VoiceLoggingModal({
  visible,
  onClose,
  onExercisesExtracted,
  context,
}: VoiceLoggingModalProps) {
  const { colors, themeName: colorScheme } = useAppTheme();

  const {
    state,
    isRecording,
    isProcessing,
    durationMs,
    result,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
    hasPermission,
    requestPermission,
  } = useDirectVoice(context);

  // Handle close
  const handleClose = useCallback(() => {
    if (isRecording) {
      cancelRecording();
    }
    reset();
    onClose();
  }, [isRecording, cancelRecording, reset, onClose]);

  // Handle confirm extraction
  const handleConfirm = useCallback(() => {
    if (!result?.exercises?.length) return;

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    onExercisesExtracted(result.exercises, result.supersets);
    reset();
    onClose();
  }, [result, onExercisesExtracted, reset, onClose]);

  // Handle retry
  const handleRetry = useCallback(() => {
    reset();
  }, [reset]);

  // Render extracted exercises preview
  const renderExercisePreview = useMemo(() => {
    if (!result?.exercises?.length) return null;

    return (
      <View style={styles.exercisesContainer}>
        <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
          Extracted Exercises ({result.exercises.length})
        </ThemedText>

        {result.confidence !== undefined && (
          <View style={styles.confidenceRow}>
            <ThemedText style={[styles.confidenceLabel, { color: colors.textSecondary }]}>
              Confidence:
            </ThemedText>
            <View
              style={[
                styles.confidenceBadge,
                {
                  backgroundColor:
                    result.confidence > 0.8
                      ? colors.success + '20'
                      : result.confidence > 0.6
                        ? colors.warning + '20'
                        : colors.error + '20',
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.confidenceText,
                  {
                    color:
                      result.confidence > 0.8
                        ? colors.success
                        : result.confidence > 0.6
                          ? colors.warning
                          : colors.error,
                  },
                ]}
              >
                {Math.round(result.confidence * 100)}%
              </ThemedText>
            </View>
          </View>
        )}

        <ScrollView
          style={styles.exercisesList}
          showsVerticalScrollIndicator={false}
        >
          {result.exercises.map((exercise, index) => (
            <View
              key={`${exercise.nameRaw}-${index}`}
              style={[
                styles.exerciseCard,
                {
                  backgroundColor: colors.card,
                  borderColor: exercise.needsReview
                    ? colors.warning
                    : colors.separator,
                },
              ]}
            >
              <View style={styles.exerciseHeader}>
                <ThemedText
                  style={[styles.exerciseName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {exercise.nameRaw}
                </ThemedText>
                {exercise.needsReview && (
                  <IconSymbol
                    name="exclamationmark.triangle.fill"
                    size={16}
                    color={colors.warning}
                  />
                )}
              </View>

              <View style={styles.exerciseDetails}>
                <ThemedText
                  style={[styles.exerciseDetail, { color: colors.textSecondary }]}
                >
                  {exercise.sets} sets x {exercise.reps} reps
                </ThemedText>
                {exercise.weight && (
                  <ThemedText
                    style={[styles.exerciseDetail, { color: colors.textSecondary }]}
                  >
                    @ {exercise.weight} {exercise.weightUnit || 'lbs'}
                  </ThemedText>
                )}
              </View>

              {exercise.notes && (
                <ThemedText
                  style={[styles.exerciseNotes, { color: colors.textTertiary }]}
                  numberOfLines={2}
                >
                  {exercise.notes}
                </ThemedText>
              )}
            </View>
          ))}
        </ScrollView>

        {result.warnings && result.warnings.length > 0 && (
          <View style={[styles.warningsContainer, { backgroundColor: colors.warning + '10' }]}>
            {result.warnings.map((warning, index) => (
              <ThemedText
                key={index}
                style={[styles.warningText, { color: colors.warning }]}
              >
                {warning}
              </ThemedText>
            ))}
          </View>
        )}
      </View>
    );
  }, [result, colors]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <BlurView
        intensity={100}
        tint={colorScheme === 'focus' ? 'dark' : 'light'}
        style={[styles.container, { backgroundColor: colors.background + 'f0' }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <IconSymbol name="xmark" size={20} color={colors.textSecondary} />
          </Pressable>

          <ThemedText style={[styles.title, { color: colors.text }]}>
            Voice Log
          </ThemedText>

          <View style={styles.closeButton} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Processing state - show dedicated loading screen */}
          {(state === 'uploading' || state === 'processing') && (
            <View style={styles.processingContainer}>
              <View style={[styles.processingIconContainer, { backgroundColor: colors.tint + '20' }]}>
                <ActivityIndicator size="large" color={colors.tint} />
              </View>
              <ThemedText style={[styles.processingTitle, { color: colors.text }]}>
                {state === 'uploading' ? 'Uploading Audio...' : 'Analyzing Workout...'}
              </ThemedText>
              <ThemedText style={[styles.processingSubtitle, { color: colors.textSecondary }]}>
                {state === 'uploading'
                  ? 'Sending your recording for processing'
                  : 'AI is extracting exercises, sets, reps, and weights'}
              </ThemedText>
              <View style={[styles.processingSteps, { backgroundColor: colors.card }]}>
                <View style={styles.processingStep}>
                  <IconSymbol
                    name={state === 'uploading' ? 'arrow.up.circle' : 'checkmark.circle.fill'}
                    size={18}
                    color={state === 'uploading' ? colors.tint : colors.success}
                  />
                  <ThemedText style={[styles.processingStepText, { color: colors.textSecondary }]}>
                    Recording captured
                  </ThemedText>
                </View>
                <View style={styles.processingStep}>
                  <IconSymbol
                    name={state === 'processing' ? 'waveform' : 'circle'}
                    size={18}
                    color={state === 'processing' ? colors.tint : colors.textTertiary}
                  />
                  <ThemedText style={[styles.processingStepText, { color: state === 'processing' ? colors.text : colors.textTertiary }]}>
                    Extracting workout data
                  </ThemedText>
                </View>
              </View>
            </View>
          )}

          {/* Idle / Recording state */}
          {(state === 'idle' || state === 'recording') && (
            <View style={styles.recorderContainer}>
              <ThemedText
                style={[styles.instructions, { color: colors.textSecondary }]}
              >
                {state === 'idle'
                  ? 'Tap the microphone and describe your workout'
                  : 'Speak clearly about your exercises, sets, reps, and weights'}
              </ThemedText>

              <VoiceRecorder
                state={state}
                durationMs={durationMs}
                hasPermission={hasPermission}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onCancelRecording={cancelRecording}
                size="large"
                showDuration
                showCancel
              />

              {/* Example text */}
              {state === 'idle' && (
                <View style={[styles.exampleBox, { backgroundColor: colors.card }]}>
                  <ThemedText
                    style={[styles.exampleLabel, { color: colors.textSecondary }]}
                  >
                    Example:
                  </ThemedText>
                  <ThemedText
                    style={[styles.exampleText, { color: colors.textSecondary }]}
                  >
                    "I did bench press, 4 sets of 8 at 185 pounds. Then I supersetted
                    dumbbell flyes with pushups, 3 sets of 12 each."
                  </ThemedText>
                </View>
              )}
            </View>
          )}

          {/* Success state - show extracted exercises */}
          {state === 'success' && result && (
            <View style={styles.resultContainer}>
              {renderExercisePreview}

              <View style={styles.actionButtons}>
                <Pressable
                  onPress={handleRetry}
                  style={[styles.actionButton, { backgroundColor: colors.card }]}
                >
                  <IconSymbol name="arrow.counterclockwise" size={18} color={colors.text} />
                  <ThemedText style={[styles.actionButtonText, { color: colors.text }]}>
                    Try Again
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={handleConfirm}
                  style={[styles.actionButton, styles.primaryButton, { backgroundColor: colors.tint }]}
                >
                  <IconSymbol name="checkmark" size={18} color="#fff" />
                  <ThemedText style={[styles.actionButtonText, { color: '#fff' }]}>
                    Add to Workout
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          )}

          {/* Error state */}
          {state === 'error' && error && (
            <View style={styles.errorContainer}>
              <View
                style={[styles.errorIconContainer, { backgroundColor: colors.error + '20' }]}
              >
                <IconSymbol name="exclamationmark.triangle.fill" size={40} color={colors.error} />
              </View>

              <ThemedText style={[styles.errorTitle, { color: colors.text }]}>
                {error.code === 'permission_denied'
                  ? 'Microphone Access Required'
                  : error.code === 'no_workout_detected'
                    ? 'No Workout Detected'
                    : 'Something Went Wrong'}
              </ThemedText>

              <ThemedText style={[styles.errorMessage, { color: colors.textSecondary }]}>
                {error.message}
              </ThemedText>

              {error.suggestion && (
                <ThemedText style={[styles.errorSuggestion, { color: colors.textTertiary }]}>
                  {error.suggestion}
                </ThemedText>
              )}

              <View style={styles.errorActions}>
                {error.code === 'permission_denied' ? (
                  <Pressable
                    onPress={requestPermission}
                    style={[styles.actionButton, { backgroundColor: colors.tint }]}
                  >
                    <IconSymbol name="mic.fill" size={18} color="#fff" />
                    <ThemedText style={[styles.actionButtonText, { color: '#fff' }]}>
                      Grant Permission
                    </ThemedText>
                  </Pressable>
                ) : error.recoverable ? (
                  <Pressable
                    onPress={handleRetry}
                    style={[styles.actionButton, { backgroundColor: colors.tint }]}
                  >
                    <IconSymbol name="arrow.counterclockwise" size={18} color="#fff" />
                    <ThemedText style={[styles.actionButtonText, { color: '#fff' }]}>
                      Try Again
                    </ThemedText>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleClose}
                    style={[styles.actionButton, { backgroundColor: colors.card }]}
                  >
                    <ThemedText style={[styles.actionButtonText, { color: colors.text }]}>
                      Close
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </View>
      </BlurView>
    </Modal>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  recorderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  instructions: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 24,
  },
  exampleBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    maxWidth: 340,
  },
  exampleLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exampleText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  resultContainer: {
    flex: 1,
    paddingTop: 16,
  },
  exercisesContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  confidenceLabel: {
    fontSize: 14,
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: '600',
  },
  exercisesList: {
    flex: 1,
  },
  exerciseCard: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  exerciseDetails: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  exerciseDetail: {
    fontSize: 14,
  },
  exerciseNotes: {
    fontSize: 13,
    marginTop: 6,
  },
  warningsContainer: {
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  warningText: {
    fontSize: 13,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryButton: {},
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  errorSuggestion: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 24,
  },
  errorActions: {
    marginTop: 8,
    minWidth: 200,
  },
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  processingIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  processingTitle: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  processingSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  processingSteps: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
    width: '100%',
    maxWidth: 280,
  },
  processingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  processingStepText: {
    fontSize: 14,
  },
});

export default VoiceLoggingModal;
