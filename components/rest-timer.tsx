import { useEffect, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Vibration } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from './ui/IconSymbol';

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
          // Vibrate on completion
          Vibration.vibrate([0, 200, 100, 200]);
          onComplete();
          return 0;
        }
        // Short vibration at 3, 2, 1
        if (prev <= 3) {
          Vibration.vibrate(100);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, timeRemaining, onComplete]);

  const progress = timeRemaining / duration;
  const circumference = 2 * Math.PI * 80; // radius = 80
  const strokeDashoffset = circumference * (1 - progress);

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

        {/* Circular Progress */}
        <View style={styles.timerContainer}>
          <svg width="200" height="200" viewBox="0 0 200 200">
            {/* Background circle */}
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke={colors.text + '20'}
              strokeWidth="12"
            />
            {/* Progress circle */}
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke={colors.tint}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 100 100)"
            />
          </svg>
          <View style={styles.timeDisplay}>
            <ThemedText style={styles.timeText}>{formatTime(timeRemaining)}</ThemedText>
          </View>
        </View>

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
  timerContainer: {
    position: 'relative',
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeDisplay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 48,
    fontWeight: 'bold',
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
