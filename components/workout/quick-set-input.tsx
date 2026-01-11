/**
 * Quick Set Input Component
 *
 * Natural language input for logging workout sets:
 * - Text input with NLP parsing
 * - Voice input using speech recognition
 * - Real-time parsing feedback
 * - Exercise clarification when ambiguous
 * - Example prompts
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Keyboard,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  parseWorkoutEntry,
  formatParsedEntry,
  getVoiceInputExamples,
  type ParsedSetEntry,
  type ParserResult,
} from '@/lib/services/workout/voice-parser';

// Voice recognition temporarily disabled - uncomment when expo-speech-recognition is installed
// import { useVoiceWorkout } from '@/lib/hooks/use-voice-workout';
// import { InlineVoiceButton } from '@/components/voice/voice-input-button';
// import { ClarificationModal } from '@/components/voice/clarification-modal';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface QuickSetInputProps {
  onSubmit: (entry: ParsedSetEntry) => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  enableVoice?: boolean;
}

export function QuickSetInput({
  onSubmit,
  onCancel,
  placeholder = 'e.g., "Bench 225 for 5" or "3x8 squats at 185"',
  autoFocus = true,
  enableVoice = true,
}: QuickSetInputProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [input, setInput] = useState('');
  const [parseResult, setParseResult] = useState<ParserResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(true);

  // Voice hook - DISABLED until expo-speech-recognition is installed
  // Stub values to prevent crashes
  const isListening = false;
  const isVoiceProcessing = false;
  const interimTranscript = '';
  const finalTranscript = '';
  const clarificationRequest = null;
  const startRecording = async () => {};
  const stopRecording = async () => {};
  const selectClarification = async (_optionId: string) => null;
  const dismissClarification = () => {};
  // const voiceError = null;

  /* Voice hook - uncomment when expo-speech-recognition is installed
  const {
    isListening,
    isProcessing: isVoiceProcessing,
    interimTranscript,
    finalTranscript,
    clarificationRequest,
    startRecording,
    stopRecording,
    selectClarification,
    dismissClarification,
    error: voiceError,
  } = useVoiceWorkout({
    onResult: (result) => {
      // Handle successful voice parse
      if (result.exercise) {
        // Convert voice result to ParsedSetEntry
        const entry: ParsedSetEntry = {
          exerciseName: result.exercise.rawName,
          sets: result.exercise.sets || 1,
          reps: typeof result.exercise.reps === 'number' ? result.exercise.reps : 10,
          weight: result.exercise.weight,
          weightUnit: result.exercise.weightUnit || 'lbs',
          confidence: result.exercise.matchConfidence,
          rawInput: result.rawTranscript,
          exerciseMatch: result.exercise.matchedExerciseId ? {
            id: result.exercise.matchedExerciseId,
            name: result.exercise.matchedExerciseName || result.exercise.rawName,
            confidence: result.exercise.matchConfidence,
          } : undefined,
        };
        setParseResult({ success: true, entry });
      }
    },
    onError: (error) => {
      console.warn('Voice error:', error);
    },
  });
  */

  // Parse input as user types (debounced)
  useEffect(() => {
    if (!input.trim()) {
      setParseResult(null);
      setShowExamples(true);
      return;
    }

    setShowExamples(false);
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const result = await parseWorkoutEntry(input);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setParseResult(result);
      } catch (error) {
        console.error('Parse error:', error);
        setParseResult({
          success: false,
          error: 'Failed to parse input',
        });
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [input]);

  const handleSubmit = useCallback(async () => {
    if (!parseResult?.success || !parseResult.entry) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Keyboard.dismiss();
    onSubmit(parseResult.entry);
    setInput('');
    setParseResult(null);
  }, [parseResult, onSubmit]);

  const handleExamplePress = (example: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput(example);
  };

  // Voice recording toggle - DISABLED
  const handleVoicePress = useCallback(async () => {
    // Voice disabled - no-op
    console.log('Voice input disabled - expo-speech-recognition not installed');
  }, []);

  /* Voice effects - uncomment when expo-speech-recognition is installed
  // Update input with interim transcript
  useEffect(() => {
    if (interimTranscript) {
      setInput(interimTranscript);
    }
  }, [interimTranscript]);

  // Update input with final transcript
  useEffect(() => {
    if (finalTranscript) {
      setInput(finalTranscript);
    }
  }, [finalTranscript]);
  */

  const examples = getVoiceInputExamples().slice(0, 4);

  return (
    <View style={styles.container}>
      {/* Input Field */}
      <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.separator }]}>
        <IconSymbol name="text.bubble" size={20} color={colors.textTertiary} />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={input}
          onChangeText={setInput}
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
        {input.length > 0 && (
          <Pressable onPress={() => setInput('')} hitSlop={8}>
            <IconSymbol name="xmark.circle.fill" size={18} color={colors.textTertiary} />
          </Pressable>
        )}
        {/* Voice button - DISABLED until expo-speech-recognition is installed
        {enableVoice && (
          <InlineVoiceButton
            isListening={isListening}
            isProcessing={isVoiceProcessing}
            onPress={handleVoicePress}
          />
        )}
        */}
      </View>

      {/* Voice status - DISABLED
      {isListening && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={[styles.voiceStatusContainer, { backgroundColor: colors.tint + '15' }]}
        >
          <IconSymbol name="mic.fill" size={14} color={colors.tint} />
          <ThemedText style={[styles.voiceStatusText, { color: colors.tint }]}>
            Listening... Speak your set
          </ThemedText>
        </Animated.View>
      )}
      */}

      {/* Parse Result Preview */}
      {parseResult && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(100)}
          style={[
            styles.resultContainer,
            {
              backgroundColor: parseResult.success ? StatusColors.success + '15' : StatusColors.error + '15',
              borderColor: parseResult.success ? StatusColors.success + '40' : StatusColors.error + '40',
            },
          ]}
        >
          {parseResult.success && parseResult.entry ? (
            <View style={styles.successResult}>
              <View style={styles.resultLeft}>
                <IconSymbol name="checkmark.circle.fill" size={18} color={StatusColors.success} />
                <View style={styles.resultText}>
                  <ThemedText style={[styles.parsedExercise, { color: colors.text }]}>
                    {parseResult.entry.exerciseMatch?.name || parseResult.entry.exerciseName}
                  </ThemedText>
                  <ThemedText style={[styles.parsedDetails, { color: colors.textSecondary }]}>
                    {parseResult.entry.weight && `${parseResult.entry.weight} ${parseResult.entry.weightUnit} • `}
                    {parseResult.entry.sets > 1 ? `${parseResult.entry.sets}×${parseResult.entry.reps}` : `${parseResult.entry.reps} reps`}
                  </ThemedText>
                </View>
              </View>
              <Pressable
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.logButton,
                  { backgroundColor: StatusColors.success, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <IconSymbol name="plus.circle.fill" size={16} color="#fff" />
                <ThemedText style={styles.logButtonText}>Log</ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.errorResult}>
              <IconSymbol name="exclamationmark.triangle.fill" size={18} color={StatusColors.error} />
              <ThemedText style={[styles.errorText, { color: StatusColors.error }]}>
                {parseResult.error}
              </ThemedText>
            </View>
          )}
        </Animated.View>
      )}

      {/* Confidence Indicator */}
      {parseResult?.success && parseResult.entry && (
        <View style={styles.confidenceRow}>
          <View style={[styles.confidenceBar, { backgroundColor: colors.separator }]}>
            <View
              style={[
                styles.confidenceFill,
                {
                  width: `${parseResult.entry.confidence}%`,
                  backgroundColor: parseResult.entry.confidence >= 70
                    ? StatusColors.success
                    : parseResult.entry.confidence >= 40
                      ? StatusColors.warning
                      : StatusColors.error,
                },
              ]}
            />
          </View>
          <ThemedText style={[styles.confidenceText, { color: colors.textTertiary }]}>
            {parseResult.entry.confidence}% match
          </ThemedText>
        </View>
      )}

      {/* Example Chips */}
      {showExamples && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.examplesContainer}>
          <ThemedText style={[styles.examplesLabel, { color: colors.textSecondary }]}>
            Try these examples:
          </ThemedText>
          <View style={styles.examplesRow}>
            {examples.map((example, i) => (
              <Pressable
                key={i}
                onPress={() => handleExamplePress(example)}
                style={[styles.exampleChip, { backgroundColor: colors.elevated, borderColor: colors.separator }]}
              >
                <ThemedText style={[styles.exampleText, { color: colors.text }]} numberOfLines={1}>
                  {example}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Cancel Button */}
      {onCancel && (
        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <ThemedText style={[styles.cancelText, { color: colors.textSecondary }]}>
            Cancel
          </ThemedText>
        </Pressable>
      )}

      {/* Voice Clarification Modal - DISABLED until expo-speech-recognition is installed
      <ClarificationModal
        visible={!!clarificationRequest}
        request={clarificationRequest}
        onSelect={selectClarification}
        onDismiss={dismissClarification}
      />
      */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    ...Typography.body,
    padding: 0,
  },
  voiceButton: {
    padding: 4,
    borderRadius: Radius.sm,
  },
  resultContainer: {
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  successResult: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  resultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  resultText: {
    flex: 1,
  },
  parsedExercise: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  parsedDetails: {
    ...Typography.caption1,
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  logButtonText: {
    color: '#fff',
    ...Typography.subhead,
    fontWeight: '600',
  },
  errorResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    ...Typography.caption1,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
  },
  confidenceText: {
    ...Typography.caption2,
    minWidth: 70,
    textAlign: 'right',
  },
  examplesContainer: {
    gap: Spacing.xs,
  },
  examplesLabel: {
    ...Typography.caption1,
  },
  examplesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exampleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '48%',
  },
  exampleText: {
    ...Typography.caption1,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  cancelText: {
    ...Typography.subhead,
  },
  voiceStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  voiceStatusText: {
    ...Typography.caption1,
    fontWeight: '500',
  },
});
