/**
 * VoiceRecorder Component
 *
 * A beautiful, accessible voice recording component using expo-av.
 * Implements the "Direct-to-Intent" approach where audio is sent
 * directly to Gemini for workout extraction.
 *
 * Features:
 * - Pulsing animation while recording
 * - Permission handling
 * - Duration display
 * - Max duration enforcement (2 min)
 */

import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppTheme } from '@/lib/context/theme-context';
import {
  AUDIO_CONFIG,
  type RecordingState
} from '@/lib/services/voice/direct-intent-types';

// ============================================
// Props
// ============================================

export interface VoiceRecorderProps {
  /** Current recording state */
  state: RecordingState;

  /** Recording duration in milliseconds */
  durationMs: number;

  /** Whether microphone permission is granted */
  hasPermission: boolean;

  /** Callback when user starts recording */
  onStartRecording: () => void;

  /** Callback when user stops recording */
  onStopRecording: () => void;

  /** Callback when user cancels recording */
  onCancelRecording: () => void;

  /** Size variant */
  size?: 'small' | 'medium' | 'large';

  /** Whether to show duration */
  showDuration?: boolean;

  /** Whether to show cancel button while recording */
  showCancel?: boolean;
}

// ============================================
// Component
// ============================================

export function VoiceRecorder({
  state,
  durationMs,
  hasPermission,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  size = 'large',
  showDuration = true,
  showCancel = true,
}: VoiceRecorderProps) {
  const { colors } = useAppTheme();

  // Animation values
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.3);
  const buttonScale = useSharedValue(1);

  const isRecording = state === 'recording';
  const isProcessing = state === 'uploading' || state === 'processing';
  const isIdle = state === 'idle';

  // Pulse animation while recording
  useEffect(() => {
    if (isRecording) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) })
        ),
        -1, // infinite
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.1, { duration: 600 }),
          withTiming(0.3, { duration: 600 })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = withTiming(1, { duration: 200 });
      pulseOpacity.value = withTiming(0.3, { duration: 200 });
    }
  }, [isRecording]);

  // Button press animation
  const handlePressIn = useCallback(() => {
    buttonScale.value = withTiming(0.92, { duration: 100 });
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handlePressOut = useCallback(() => {
    buttonScale.value = withTiming(1, { duration: 100 });
  }, []);

  // Handle button press
  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (isRecording) {
      onStopRecording();
    } else if (isIdle) {
      onStartRecording();
    }
  }, [isRecording, isIdle, onStartRecording, onStopRecording]);

  // Animated styles
  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Size configurations
  const sizeConfig = {
    small: { button: 48, icon: 20, pulse: 64 },
    medium: { button: 64, icon: 28, pulse: 88 },
    large: { button: 80, icon: 36, pulse: 110 },
  }[size];

  // Format duration
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Remaining time warning
  const remainingMs = AUDIO_CONFIG.MAX_DURATION_MS - durationMs;
  const isNearLimit = remainingMs < 15000 && isRecording;

  return (
    <View style={styles.container}>
      {/* Duration display */}
      {showDuration && (isRecording || isProcessing) && (
        <View style={styles.durationContainer}>
          <ThemedText
            style={[
              styles.duration,
              isNearLimit && { color: colors.error },
            ]}
          >
            {formatDuration(durationMs)}
          </ThemedText>
          {isNearLimit && (
            <ThemedText style={[styles.warning, { color: colors.error }]}>
              {Math.ceil(remainingMs / 1000)}s left
            </ThemedText>
          )}
        </View>
      )}

      {/* Main button container */}
      <View style={styles.buttonContainer}>
        {/* Pulse ring (only when recording) */}
        {isRecording && (
          <Animated.View
            style={[
              styles.pulseRing,
              pulseAnimatedStyle,
              {
                width: sizeConfig.pulse,
                height: sizeConfig.pulse,
                borderRadius: sizeConfig.pulse / 2,
                backgroundColor: colors.error,
              },
            ]}
          />
        )}

        {/* Main button */}
        <Animated.View style={buttonAnimatedStyle}>
          <Pressable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={isProcessing}
            style={[
              styles.button,
              {
                width: sizeConfig.button,
                height: sizeConfig.button,
                borderRadius: sizeConfig.button / 2,
                backgroundColor: isRecording ? colors.error : colors.tint,
                opacity: hasPermission ? 1 : 0.5,
              },
            ]}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <IconSymbol
                name={isRecording ? 'stop.fill' : 'mic.fill'}
                size={sizeConfig.icon}
                color="#fff"
              />
            )}
          </Pressable>
        </Animated.View>

        {/* Cancel button (appears when recording) */}
        {showCancel && isRecording && (
          <Pressable
            onPress={onCancelRecording}
            style={[
              styles.cancelButton,
              { backgroundColor: colors.card },
            ]}
          >
            <IconSymbol name="xmark" size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* State label */}
      <ThemedText
        style={[styles.stateLabel, { color: colors.textSecondary }]}
      >
        {state === 'idle' && (hasPermission ? 'Tap to record' : 'Permission required')}
        {state === 'recording' && 'Recording... Tap to stop'}
        {state === 'uploading' && 'Uploading...'}
        {state === 'processing' && 'Extracting workout...'}
        {state === 'success' && 'Done!'}
        {state === 'error' && 'Something went wrong'}
      </ThemedText>
    </View>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  durationContainer: {
    alignItems: 'center',
    gap: 4,
    minHeight: 50,
    paddingTop: 8,
  },
  duration: {
    fontSize: 32,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    lineHeight: 40,
    includeFontPadding: false,
  },
  warning: {
    fontSize: 12,
    fontWeight: '500',
  },
  buttonContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  cancelButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateLabel: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default VoiceRecorder;
