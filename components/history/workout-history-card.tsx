/**
 * Workout History Card Component
 *
 * Displays a completed workout with:
 * - Workout name and type (program vs quick)
 * - Duration and exercise count
 * - Date completed
 * - Program source (if applicable)
 */

import React, { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { withOpacity, OPACITY } from '@/lib/utils/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { UnifiedWorkoutRecord } from '@/lib/db/storage';

interface WorkoutHistoryCardProps {
  record: UnifiedWorkoutRecord;
  onPress: (record: UnifiedWorkoutRecord) => void;
}

function WorkoutHistoryCardComponent({ record, onPress }: WorkoutHistoryCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  }, []);

  const formatDate = useCallback((dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }, []);

  const handlePress = useCallback(() => {
    onPress(record);
  }, [onPress, record]);

  const exerciseCount = record.exercises.length;
  const setsCompleted = useMemo(
    () => record.exercises.reduce((sum, ex) => sum + ex.setsCompleted, 0),
    [record.exercises]
  );

  // Build accessibility label
  const accessibilityDescription = useMemo(() => {
    const parts = [
      record.workoutName,
      formatDate(record.completedAt),
      formatDuration(record.durationSeconds),
      `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}`,
      `${setsCompleted} sets`,
    ];
    if (record.programName) {
      parts.push(`from ${record.programName}`);
    }
    return parts.join(', ');
  }, [record, exerciseCount, setsCompleted, formatDate, formatDuration]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityDescription}
      accessibilityHint="View workout details"
    >
      {({ pressed }) => (
        <Card
          style={[styles.card, pressed && styles.cardPressed]}
          padding="md"
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {/* Type Icon */}
              <View
                style={[
                  styles.typeIcon,
                  {
                    backgroundColor: record.type === 'quick'
                      ? withOpacity('#FF9500', OPACITY.muted)
                      : withOpacity(colors.tint, OPACITY.muted),
                  },
                ]}
              >
                <IconSymbol
                  name={record.type === 'quick' ? 'bolt.fill' : 'figure.strengthtraining.traditional'}
                  size={16}
                  color={record.type === 'quick' ? '#FF9500' : colors.tint}
                />
              </View>

              {/* Workout Info */}
              <View style={styles.info}>
                <ThemedText style={styles.workoutName} numberOfLines={1}>
                  {record.workoutName}
                </ThemedText>
                {record.programName && (
                  <ThemedText
                    style={[styles.programName, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    From: {record.programName}
                  </ThemedText>
                )}
              </View>
            </View>

            {/* Time */}
            <ThemedText style={[styles.date, { color: colors.textTertiary }]}>
              {formatDate(record.completedAt)}
            </ThemedText>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <IconSymbol name="clock" size={14} color={colors.textSecondary} />
              <ThemedText style={[styles.statText, { color: colors.textSecondary }]}>
                {formatDuration(record.durationSeconds)}
              </ThemedText>
            </View>

            <View style={[styles.statDivider, { backgroundColor: colors.separator }]} />

            <View style={styles.stat}>
              <IconSymbol name="dumbbell" size={14} color={colors.textSecondary} />
              <ThemedText style={[styles.statText, { color: colors.textSecondary }]}>
                {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
              </ThemedText>
            </View>

            <View style={[styles.statDivider, { backgroundColor: colors.separator }]} />

            <View style={styles.stat}>
              <IconSymbol name="checkmark.circle.fill" size={14} color={colors.textSecondary} />
              <ThemedText style={[styles.statText, { color: colors.textSecondary }]}>
                {setsCompleted} sets
              </ThemedText>
            </View>
          </View>

          {/* Exercises Preview */}
          {record.exercises.length > 0 && (
            <View style={styles.exercisesPreview}>
              {record.exercises.slice(0, 3).map((ex, idx) => (
                <View
                  key={idx}
                  style={[styles.exerciseTag, { backgroundColor: colors.groupedBackground }]}
                >
                  <ThemedText
                    style={[styles.exerciseTagText, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {ex.name}
                  </ThemedText>
                </View>
              ))}
              {record.exercises.length > 3 && (
                <View style={[styles.exerciseTag, { backgroundColor: colors.separator }]}>
                  <ThemedText style={[styles.exerciseTagText, { color: colors.textSecondary }]}>
                    +{record.exercises.length - 3}
                  </ThemedText>
                </View>
              )}
            </View>
          )}

          {/* Chevron */}
          <View style={styles.chevron}>
            <IconSymbol name="chevron.right" size={14} color={colors.textTertiary} />
          </View>
        </Card>
      )}
    </Pressable>
  );
}

// Memoized export with custom comparison for performance in lists
export const WorkoutHistoryCard = memo(WorkoutHistoryCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.record.id === nextProps.record.id &&
    prevProps.record.completedAt === nextProps.record.completedAt &&
    prevProps.record.durationSeconds === nextProps.record.durationSeconds &&
    prevProps.onPress === nextProps.onPress
  );
});

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  workoutName: {
    ...Typography.headline,
    fontWeight: '600',
  },
  programName: {
    ...Typography.caption1,
  },
  date: {
    ...Typography.caption1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    ...Typography.caption1,
  },
  statDivider: {
    width: 1,
    height: 12,
  },
  exercisesPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  exerciseTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    maxWidth: 120,
  },
  exerciseTagText: {
    ...Typography.caption2,
  },
  chevron: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -7,
  },
});
