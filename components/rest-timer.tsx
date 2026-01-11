import { useEffect, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface RestTimerProps {
  duration: number; // seconds
  onComplete: () => void;
  onSkip: () => void;
  nextExercise?: string;
}

export function RestTimer({ duration, onComplete, onSkip, nextExercise }: RestTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isPaused, setIsPaused] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    if (isPaused || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Completion feedback
          if (process.env.EXPO_OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            Vibration.vibrate(80);
          }
          onComplete();
          return 0;
        }
        // Subtle countdown ticks at 3, 2, 1
        if (prev <= 3) {
          if (process.env.EXPO_OS === 'ios') {
            Haptics.selectionAsync();
          } else {
            Vibration.vibrate(20);
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, timeRemaining, onComplete]);

  const progress = timeRemaining / duration;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Rest Time
        </ThemedText>

        {/* Progress */}
        <ThemedView style={styles.progressWrap}>
          <ThemedText style={styles.timeText}>{formatTime(timeRemaining)}</ThemedText>
          <View style={[styles.progressTrack, { backgroundColor: colors.separator + '66' }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.max(0, Math.min(1, progress)) * 100}%`, backgroundColor: colors.tint },
              ]}
            />
          </View>
        </ThemedView>

        {/* Next Exercise Preview */}
        {nextExercise && (
          <ThemedView style={styles.nextExercise}>
            <ThemedText style={styles.nextLabel}>Next:</ThemedText>
            <ThemedText type="subtitle" style={styles.nextName}>
              {nextExercise}
            </ThemedText>
          </ThemedView>
        )}

        {/* Controls */}
        <ThemedView style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.tint + '20' }]}
            onPress={() => setIsPaused(!isPaused)}
          >
            <IconSymbol
              name={isPaused ? 'play.fill' : 'pause.fill'}
              size={24}
              color={colors.tint}
            />
            <ThemedText style={[styles.controlText, { color: colors.tint }]}>
              {isPaused ? 'Resume' : 'Pause'}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.text + '10' }]}
            onPress={onSkip}
          >
            <IconSymbol name="forward.fill" size={24} color={colors.text} />
            <ThemedText style={styles.controlText}>Skip Rest</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    gap: 32,
    width: '100%',
  },
  title: {
    marginBottom: 8,
  },
  progressWrap: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 16,
  },
  timeText: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  nextExercise: {
    alignItems: 'center',
    gap: 4,
  },
  nextLabel: {
    fontSize: 14,
    opacity: 0.6,
  },
  nextName: {
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    maxWidth: 400,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  controlText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
