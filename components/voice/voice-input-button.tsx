/**
 * Voice Input Button
 *
 * Animated microphone button for voice input.
 * Shows recording state with pulsing animation.
 */

import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface VoiceInputButtonProps {
  isListening: boolean;
  isProcessing: boolean;
  transcript?: string;
  onPressIn: () => void;
  onPressOut: () => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const SIZES = {
  small: { button: 40, icon: 18, pulse: 60 },
  medium: { button: 52, icon: 22, pulse: 72 },
  large: { button: 64, icon: 28, pulse: 90 },
};

export function VoiceInputButton({
  isListening,
  isProcessing,
  transcript,
  onPressIn,
  onPressOut,
  disabled = false,
  size = 'medium',
}: VoiceInputButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const dimensions = SIZES[size];

  // Animation values
  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  // Start/stop pulse animation
  useEffect(() => {
    if (isListening) {
      // Pulse animation
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 800 }),
          withTiming(0, { duration: 800 })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = withTiming(1, { duration: 200 });
      pulseOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isListening]);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSpring(0.9);
    onPressIn();
  }, [disabled, onPressIn, scale]);

  const handlePressOut = useCallback(() => {
    if (disabled) return;
    scale.value = withSpring(1);
    onPressOut();
  }, [disabled, onPressOut, scale]);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const getIcon = () => {
    if (isProcessing) return 'ellipsis';
    if (isListening) return 'waveform';
    return 'mic.fill';
  };

  const getColor = () => {
    if (disabled) return colors.textTertiary;
    if (isListening) return '#FF3B30';
    if (isProcessing) return colors.tint;
    return colors.tint;
  };

  return (
    <View style={styles.container}>
      {/* Pulse ring */}
      <Animated.View
        style={[
          styles.pulse,
          pulseAnimatedStyle,
          {
            width: dimensions.pulse,
            height: dimensions.pulse,
            borderRadius: dimensions.pulse / 2,
            backgroundColor: getColor(),
          },
        ]}
      />

      {/* Button */}
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isProcessing}
      >
        <Animated.View
          style={[
            styles.button,
            buttonAnimatedStyle,
            {
              width: dimensions.button,
              height: dimensions.button,
              borderRadius: dimensions.button / 2,
              backgroundColor: isListening
                ? '#FF3B30'
                : disabled
                  ? colors.separator
                  : colors.tint,
            },
          ]}
        >
          <IconSymbol
            name={getIcon() as any}
            size={dimensions.icon}
            color="#fff"
          />
        </Animated.View>
      </Pressable>

      {/* Transcript preview */}
      {transcript && (
        <View style={[styles.transcriptContainer, { backgroundColor: colors.card }]}>
          <ThemedText style={[styles.transcript, { color: colors.text }]} numberOfLines={1}>
            {transcript}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

/**
 * Compact inline voice button for text inputs
 */
export function InlineVoiceButton({
  isListening,
  isProcessing,
  onPress,
  disabled = false,
}: {
  isListening: boolean;
  isProcessing: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    if (disabled || isProcessing) return;
    Haptics.selectionAsync();
    scale.value = withSequence(
      withTiming(0.85, { duration: 100 }),
      withSpring(1)
    );
    onPress();
  }, [disabled, isProcessing, onPress, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={handlePress} disabled={disabled || isProcessing}>
      <Animated.View
        style={[
          styles.inlineButton,
          animatedStyle,
          {
            backgroundColor: isListening
              ? '#FF3B30'
              : disabled
                ? colors.separator
                : colors.tint + '20',
          },
        ]}
      >
        <IconSymbol
          name={isListening ? 'stop.fill' : isProcessing ? 'ellipsis' : 'mic.fill'}
          size={16}
          color={isListening ? '#fff' : disabled ? colors.textTertiary : colors.tint}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  transcriptContainer: {
    position: 'absolute',
    bottom: -30,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    maxWidth: 200,
  },
  transcript: {
    fontSize: 12,
    textAlign: 'center',
  },
  inlineButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
