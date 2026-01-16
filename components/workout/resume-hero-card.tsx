/**
 * Resume Hero Card
 *
 * Prominent card shown when user has an unfinished workout.
 * Part of P1 UX Redesign (Zeigarnik effect - people want to complete unfinished tasks).
 *
 * Features:
 * - Shows workout progress (X of Y sets done)
 * - Time since started
 * - Resume and Discard actions
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  formatElapsedTime,
  PendingWorkout,
} from '@/lib/hooks/use-pending-workout';

interface ResumeHeroCardProps {
  pendingWorkout: PendingWorkout;
  onDiscard: () => void;
}

export function ResumeHeroCard({ pendingWorkout, onDiscard }: ResumeHeroCardProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const progressPercent = pendingWorkout.totalSets > 0
    ? Math.round((pendingWorkout.completedSets / pendingWorkout.totalSets) * 100)
    : 0;

  const handleResume = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/workout/${pendingWorkout.programId}` as any);
  }, [pendingWorkout.programId, router]);

  const handleDiscard = useCallback(() => {
    Alert.alert(
      'Discard Workout?',
      'Your progress will be lost. This cannot be undone.',
      [
        { text: 'Keep Workout', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onDiscard();
          },
        },
      ]
    );
  }, [onDiscard]);

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      exiting={FadeOutUp.duration(200)}
    >
      <Pressable
        style={({ pressed }) => [
          styles.container,
          {
            backgroundColor: colors.tint,
            opacity: pressed ? 0.95 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
        onPress={handleResume}
      >
        {/* Progress Ring */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressRing, { borderColor: 'rgba(255,255,255,0.3)' }]}>
            <ThemedText style={styles.progressText}>{progressPercent}%</ThemedText>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>
              {pendingWorkout.status === 'paused' ? 'Paused Workout' : 'Continue Workout'}
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              {formatElapsedTime(pendingWorkout.startedAt, nowMs)} elapsed
            </ThemedText>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <IconSymbol name="dumbbell.fill" size={14} color="rgba(255,255,255,0.8)" />
              <ThemedText style={styles.statText}>
                {pendingWorkout.exerciseCount} exercise{pendingWorkout.exerciseCount !== 1 ? 's' : ''}
              </ThemedText>
            </View>
            <View style={styles.stat}>
              <IconSymbol name="checkmark.circle.fill" size={14} color="rgba(255,255,255,0.8)" />
              <ThemedText style={styles.statText}>
                {pendingWorkout.completedSets}/{pendingWorkout.totalSets} sets
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={styles.resumeButton}
            onPress={handleResume}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <IconSymbol name="play.fill" size={20} color="#fff" />
          </Pressable>

          <Pressable
            style={styles.discardButton}
            onPress={handleDiscard}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <IconSymbol name="xmark" size={14} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  progressContainer: {
    marginRight: Spacing.md,
  },
  progressRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  progressText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  header: {
    marginBottom: 4,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 2,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  resumeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
