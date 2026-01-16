/**
 * Resume Mini Bar
 *
 * Compact global resume bar shown across tabs when a workout is in progress.
 */

import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatElapsedTime, type PendingWorkout } from '@/lib/hooks/use-pending-workout';

interface ResumeMiniBarProps {
  pendingWorkout: PendingWorkout;
  onResume: () => void;
  onDiscard: () => void;
}

export function ResumeMiniBar({
  pendingWorkout,
  onResume,
  onDiscard,
}: ResumeMiniBarProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleResume = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onResume();
  }, [onResume]);

  const handleDiscard = useCallback(() => {
    Alert.alert(
      'Discard Workout?',
      'Your progress will be lost. This cannot be undone.',
      [
        { text: 'Keep', style: 'cancel' },
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

  const progressText = pendingWorkout.totalSets > 0
    ? `${pendingWorkout.completedSets}/${pendingWorkout.totalSets} sets`
    : `${pendingWorkout.exerciseCount} exercises`;
  const elapsedLabel = formatElapsedTime(pendingWorkout.startedAt, nowMs);

  return (
    <View style={[styles.container, { backgroundColor: colors.elevated, borderColor: colors.separator }]}>
      <Pressable
        style={styles.content}
        onPress={handleResume}
      >
        <View style={[styles.iconBubble, { backgroundColor: colors.tint + '18' }]}>
          <IconSymbol name="play.fill" size={14} color={colors.tint} />
        </View>
        <View style={styles.details}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {pendingWorkout.name}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {progressText} · {elapsedLabel} elapsed
          </ThemedText>
        </View>
        <View style={[styles.resumeChip, { backgroundColor: colors.tint + '12' }]}>
          <ThemedText style={[styles.resumeChipText, { color: colors.tint }]}>Resume</ThemedText>
          <IconSymbol name="chevron.right" size={14} color={colors.tint} />
        </View>
      </Pressable>
      <Pressable
        style={styles.discardButton}
        onPress={handleDiscard}
        hitSlop={10}
      >
        <IconSymbol name="xmark" size={14} color={colors.textTertiary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  subtitle: {
    ...Typography.caption2,
  },
  resumeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  resumeChipText: {
    ...Typography.caption2,
    fontWeight: '600',
  },
  discardButton: {
    marginLeft: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
