/**
 * Program Overview Component
 *
 * Mobile-first vertical layout showing all weeks and days.
 * - Simple show/hide without height animations (iOS compatible)
 * - No nested ScrollViews (causes iOS issues)
 * - Tap day pill to expand and see exercises inline
 * - Multiple days can be expanded simultaneously
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// ============================================================================
// TYPES
// ============================================================================

type Exercise = {
  name: string;
  sets: number | string;
  reps: number | string;
  weight?: number | string;
};

export interface Workout {
  week: number;
  day: number;
  name: string;
  exercises?: Exercise[];
}

interface ProgramOverviewProps {
  workouts: Workout[];
  completedSet: Set<string>;
  onSelectWorkout: (week: number, day: number) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  programId?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProgramOverview = memo(function ProgramOverview({
  workouts,
  completedSet,
  onSelectWorkout,
  expanded,
  onToggleExpand,
  programId,
}: ProgramOverviewProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  // Track multiple expanded days using a Set
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  // Track collapsed weeks
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<number>>(new Set());

  // Group workouts by week
  const { weeks, workoutsByWeek, totalWeeks, totalDays } = useMemo(() => {
    const byWeek = workouts.reduce((acc, workout) => {
      if (!acc[workout.week]) acc[workout.week] = [];
      acc[workout.week].push(workout);
      return acc;
    }, {} as Record<number, Workout[]>);

    const weekNumbers = Object.keys(byWeek).map(Number).sort((a, b) => a - b);
    return {
      weeks: weekNumbers,
      workoutsByWeek: byWeek,
      totalWeeks: weekNumbers.length,
      totalDays: workouts.length,
    };
  }, [workouts]);

  const getWeekProgress = useCallback(
    (weekNum: number) => {
      const weekWorkouts = workoutsByWeek[weekNum] || [];
      const completed = weekWorkouts.filter(w =>
        completedSet.has(`${w.week}-${w.day}`)
      ).length;
      return { completed, total: weekWorkouts.length };
    },
    [workoutsByWeek, completedSet]
  );

  // Toggle individual day - allows multiple to be open
  const handleDayPress = useCallback((week: number, day: number) => {
    const key = `${week}-${day}`;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

  // Toggle week collapse
  const handleWeekPress = useCallback((weekNum: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCollapsedWeeks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(weekNum)) {
        newSet.delete(weekNum);
      } else {
        newSet.add(weekNum);
      }
      return newSet;
    });
  }, []);

  const handleStartWorkout = useCallback((week: number, day: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (programId) {
      router.push(`/workout/${programId}?week=${week}&day=${day}`);
    } else {
      onSelectWorkout(week, day);
    }
  }, [programId, router, onSelectWorkout]);

  // Collapsed state - just show the expand button
  if (!expanded) {
    return (
      <Pressable
        onPress={onToggleExpand}
        style={[
          styles.expandButton,
          { backgroundColor: colors.tint + '10', borderColor: colors.tint + '30' }
        ]}
      >
        <View style={styles.expandButtonContent}>
          <IconSymbol name="calendar" size={16} color={colors.tint} />
          <ThemedText style={[styles.expandText, { color: colors.tint }]}>
            View Program ({totalWeeks} week{totalWeeks !== 1 ? 's' : ''}, {totalDays} day{totalDays !== 1 ? 's' : ''})
          </ThemedText>
        </View>
        <IconSymbol name="chevron.down" size={14} color={colors.tint} />
      </Pressable>
    );
  }

  // Expanded state - show all weeks and days (no ScrollView, no height animation)
  return (
    <View style={styles.container}>
      {/* Header with collapse button */}
      <View style={styles.headerRow}>
        <ThemedText style={[styles.headerLabel, { color: colors.textSecondary }]}>
          {totalWeeks} week{totalWeeks !== 1 ? 's' : ''} · {totalDays} day{totalDays !== 1 ? 's' : ''}
        </ThemedText>
        <Pressable onPress={onToggleExpand} hitSlop={12}>
          <IconSymbol name="chevron.up" size={16} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* All Weeks - No ScrollView, just a flat list */}
      <View style={styles.weeksContent}>
        {weeks.map((weekNum) => {
          const progress = getWeekProgress(weekNum);
          const isWeekComplete = progress.completed === progress.total;
          const isWeekCollapsed = collapsedWeeks.has(weekNum);
          const weekWorkouts = workoutsByWeek[weekNum] || [];

          return (
            <View key={`week-${weekNum}`} style={styles.weekSection}>
              {/* Week Header - Tappable to collapse/expand */}
              <Pressable
                onPress={() => handleWeekPress(weekNum)}
                style={({ pressed }) => [
                  styles.weekHeader,
                  { backgroundColor: colors.elevated, opacity: pressed ? 0.8 : 1 }
                ]}
              >
                <View style={styles.weekHeaderLeft}>
                  <View style={[styles.weekBadge, { backgroundColor: colors.tint }]}>
                    <ThemedText style={styles.weekBadgeText}>W{weekNum}</ThemedText>
                  </View>
                  <ThemedText style={styles.weekTitle}>Week {weekNum}</ThemedText>
                </View>
                <View style={styles.weekHeaderRight}>
                  <ThemedText
                    style={[
                      styles.weekProgress,
                      { color: isWeekComplete ? StatusColors.success : colors.textSecondary },
                    ]}
                  >
                    {progress.completed}/{progress.total}
                  </ThemedText>
                  <IconSymbol
                    name={isWeekCollapsed ? "chevron.down" : "chevron.up"}
                    size={14}
                    color={colors.textSecondary}
                  />
                </View>
              </Pressable>

              {/* Days List (collapsible) */}
              {!isWeekCollapsed && (
                <View style={styles.daysContainer}>
                  {weekWorkouts.map((workout) => {
                    const key = `${workout.week}-${workout.day}`;
                    const isExpanded = expandedDays.has(key);
                    const isCompleted = completedSet.has(key);

                    return (
                      <DayPillExpandable
                        key={key}
                        workout={workout}
                        isCompleted={isCompleted}
                        isExpanded={isExpanded}
                        onPress={() => handleDayPress(workout.week, workout.day)}
                        onStartWorkout={() => handleStartWorkout(workout.week, workout.day)}
                        colors={colors}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
});

// ============================================================================
// EXPANDABLE DAY PILL
// ============================================================================

interface DayPillExpandableProps {
  workout: Workout;
  isCompleted: boolean;
  isExpanded: boolean;
  onPress: () => void;
  onStartWorkout: () => void;
  colors: typeof Colors.light;
}

const DayPillExpandable = memo(function DayPillExpandable({
  workout,
  isCompleted,
  isExpanded,
  onPress,
  onStartWorkout,
  colors,
}: DayPillExpandableProps) {
  const exercises = workout.exercises || [];

  return (
    <View style={styles.dayPillContainer}>
      {/* Pill Header */}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.dayPill,
          {
            backgroundColor: isCompleted ? colors.tint : colors.card,
            borderColor: isExpanded ? colors.tint : (isCompleted ? colors.tint : colors.separator),
            borderWidth: isExpanded ? 1.5 : StyleSheet.hairlineWidth,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <View style={styles.dayPillLeft}>
          <View style={[
            styles.dayBadge,
            { backgroundColor: isCompleted ? 'rgba(255,255,255,0.2)' : colors.tint + '15' }
          ]}>
            {isCompleted ? (
              <IconSymbol name="checkmark" size={12} color="#fff" />
            ) : (
              <ThemedText style={[styles.dayBadgeText, { color: isCompleted ? '#fff' : colors.tint }]}>
                {workout.day}
              </ThemedText>
            )}
          </View>
          <View style={styles.dayInfo}>
            <ThemedText
              style={[
                styles.dayName,
                { color: isCompleted ? '#fff' : colors.text },
              ]}
              numberOfLines={1}
            >
              {workout.name}
            </ThemedText>
            <ThemedText style={[styles.dayMeta, { color: isCompleted ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>
              {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
            </ThemedText>
          </View>
        </View>
        <IconSymbol
          name={isExpanded ? "chevron.up" : "chevron.down"}
          size={14}
          color={isCompleted ? 'rgba(255,255,255,0.7)' : colors.textSecondary}
        />
      </Pressable>

      {/* Expanded Content - Simple conditional render, no height animation */}
      {isExpanded && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={[
            styles.expandedContent,
            {
              backgroundColor: colors.groupedBackground,
              borderColor: colors.tint + '40',
            }
          ]}
        >
          {exercises.length === 0 ? (
            <View style={styles.emptyExercises}>
              <IconSymbol name="dumbbell" size={20} color={colors.textTertiary} />
              <ThemedText style={[styles.noExercisesText, { color: colors.textSecondary }]}>
                No exercises defined
              </ThemedText>
            </View>
          ) : (
            <View style={styles.exerciseList}>
              {exercises.map((ex, i) => (
                <View key={i} style={styles.exerciseRow}>
                  <View style={[styles.exerciseNumber, { backgroundColor: colors.tint }]}>
                    <ThemedText style={styles.exerciseNumberText}>{i + 1}</ThemedText>
                  </View>
                  <ThemedText style={[styles.exerciseName, { color: colors.text }]} numberOfLines={1}>
                    {ex.name}
                  </ThemedText>
                  <ThemedText style={[styles.exerciseSets, { color: colors.textSecondary }]}>
                    {ex.sets}×{ex.reps}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}

          {/* Start Workout Button */}
          <Pressable
            onPress={onStartWorkout}
            style={({ pressed }) => [
              styles.startButton,
              { backgroundColor: colors.tint, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <IconSymbol name="play.fill" size={14} color="#fff" />
            <ThemedText style={styles.startButtonText}>
              {isCompleted ? 'Start Again' : 'Start Workout'}
            </ThemedText>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
});

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  expandButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expandText: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: Spacing.sm,
  },
  headerLabel: {
    ...Typography.caption1,
    fontWeight: '600',
  },
  weeksContent: {
    gap: Spacing.sm,
  },
  weekSection: {
    gap: 6,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
  },
  weekHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weekBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  weekBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  weekTitle: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  weekHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekProgress: {
    ...Typography.caption1,
    fontWeight: '600',
  },
  daysContainer: {
    gap: 6,
    paddingLeft: Spacing.xs,
  },
  dayPillContainer: {
    // Container for pill + expanded content
  },
  dayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
    minHeight: 48,
  },
  dayPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  dayBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dayInfo: {
    flex: 1,
    gap: 2,
  },
  dayName: {
    ...Typography.body,
    fontWeight: '500',
  },
  dayMeta: {
    ...Typography.caption2,
  },
  expandedContent: {
    marginTop: 6,
    marginLeft: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 10,
  },
  emptyExercises: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  noExercisesText: {
    ...Typography.caption1,
    fontStyle: 'italic',
  },
  exerciseList: {
    gap: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exerciseNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNumberText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  exerciseName: {
    ...Typography.body,
    flex: 1,
  },
  exerciseSets: {
    ...Typography.caption1,
    fontWeight: '600',
    minWidth: 45,
    textAlign: 'right',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
    marginTop: 4,
  },
  startButtonText: {
    color: '#fff',
    ...Typography.subhead,
    fontWeight: '600',
  },
});
