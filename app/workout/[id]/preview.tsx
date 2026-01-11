/**
 * Workout Preview Screen
 *
 * Shows an overview of the workout day before starting:
 * - Workout name and metadata
 * - List of exercises with sets/reps
 * - Estimated duration
 * - Start Workout button
 */

import { useEffect, useState, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getProgram,
  getEffectiveProgramData,
  getWorkoutHistory,
  type Program,
} from '@/lib/db/storage';

type Exercise = {
  name: string;
  sets: number | string;
  reps: number | string;
  weight?: number | string;
  restTime?: number;
  notes?: string;
  muscleGroups?: string[];
};

type WorkoutData = {
  week: number;
  day: number;
  name: string;
  exercises: Exercise[];
};

export default function WorkoutPreviewScreen() {
  const { id, week, day } = useLocalSearchParams();
  const programId = id as string;
  const selectedWeek = week ? parseInt(week as string) : 1;
  const selectedDay = day ? parseInt(day as string) : 1;

  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [program, setProgram] = useState<Program | null>(null);
  const [workout, setWorkout] = useState<WorkoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastCompleted, setLastCompleted] = useState<string | null>(null);

  useEffect(() => {
    loadWorkoutData();
  }, [programId, selectedWeek, selectedDay]);

  async function loadWorkoutData() {
    try {
      setLoading(true);
      const prog = await getProgram(programId);
      if (!prog) {
        router.back();
        return;
      }
      setProgram(prog);

      const effectiveData = await getEffectiveProgramData(prog);
      const workouts = effectiveData?.workouts || [];

      const found = workouts.find(
        (w: WorkoutData) => w.week === selectedWeek && w.day === selectedDay
      );
      setWorkout(found || null);

      // Check last completion
      const history = await getWorkoutHistory(programId);
      const completions = history.completions
        .filter(c => c.week === selectedWeek && c.day === selectedDay)
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

      if (completions.length > 0) {
        setLastCompleted(completions[0].completedAt);
      }
    } catch (error) {
      console.error('Error loading workout:', error);
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    if (!workout?.exercises) return { totalSets: 0, totalExercises: 0, estimatedMinutes: 0 };

    let totalSets = 0;
    workout.exercises.forEach(ex => {
      const sets = typeof ex.sets === 'string' ? parseInt(ex.sets) || 1 : ex.sets || 1;
      totalSets += sets;
    });

    // Rough estimate: 2 min per set + rest
    const estimatedMinutes = Math.round(totalSets * 2.5);

    return {
      totalSets,
      totalExercises: workout.exercises.length,
      estimatedMinutes,
    };
  }, [workout]);

  const handleStartWorkout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace(`/workout/${programId}?week=${selectedWeek}&day=${selectedDay}`);
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  if (!workout) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <IconSymbol name="exclamationmark.circle" size={48} color={colors.textSecondary} />
        <ThemedText style={{ color: colors.textSecondary, marginTop: Spacing.md }}>
          Workout not found
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: workout.name || `Week ${selectedWeek}, Day ${selectedDay}`,
          headerBackTitle: 'Back',
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Card */}
        <Card style={styles.headerCard} padding="md">
          <View style={styles.headerTop}>
            <View style={styles.weekDayBadge}>
              <ThemedText style={[styles.weekDayText, { color: colors.tint }]}>
                Week {selectedWeek} • Day {selectedDay}
              </ThemedText>
            </View>
            {lastCompleted && (
              <View style={[styles.completedBadge, { backgroundColor: StatusColors.success + '18' }]}>
                <IconSymbol name="checkmark.circle.fill" size={14} color={StatusColors.success} />
                <ThemedText style={[styles.completedText, { color: StatusColors.success }]}>
                  Completed
                </ThemedText>
              </View>
            )}
          </View>

          <ThemedText style={styles.workoutTitle}>{workout.name}</ThemedText>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <IconSymbol name="dumbbell" size={18} color={colors.textSecondary} />
              <ThemedText style={[styles.statValue, { color: colors.text }]}>
                {stats.totalExercises}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                exercises
              </ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.separator }]} />
            <View style={styles.stat}>
              <IconSymbol name="flame.fill" size={18} color={colors.textSecondary} />
              <ThemedText style={[styles.statValue, { color: colors.text }]}>
                {stats.totalSets}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                sets
              </ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.separator }]} />
            <View style={styles.stat}>
              <IconSymbol name="clock" size={18} color={colors.textSecondary} />
              <ThemedText style={[styles.statValue, { color: colors.text }]}>
                ~{stats.estimatedMinutes}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                min
              </ThemedText>
            </View>
          </View>

          {lastCompleted && (
            <ThemedText style={[styles.lastCompleted, { color: colors.textSecondary }]}>
              Last completed {formatRelativeDate(lastCompleted)}
            </ThemedText>
          )}
        </Card>

        {/* Exercises List */}
        <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          EXERCISES
        </ThemedText>

        {workout.exercises.map((exercise, index) => (
          <ExerciseRow
            key={`${exercise.name}-${index}`}
            exercise={exercise}
            index={index + 1}
            colors={colors}
          />
        ))}
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, Spacing.md),
            borderTopColor: colors.separator,
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.startButton,
            { backgroundColor: colors.tint, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={handleStartWorkout}
        >
          <IconSymbol name="play.fill" size={20} color="#fff" />
          <ThemedText style={styles.startButtonText}>
            {lastCompleted ? 'Start Again' : 'Start Workout'}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

// Exercise Row Component
function ExerciseRow({
  exercise,
  index,
  colors,
}: {
  exercise: Exercise;
  index: number;
  colors: typeof Colors.light;
}) {
  const sets = typeof exercise.sets === 'string' ? exercise.sets : `${exercise.sets || 1}`;
  const reps = typeof exercise.reps === 'string' ? exercise.reps : `${exercise.reps || '-'}`;
  const weight = exercise.weight ? `${exercise.weight} lbs` : null;

  return (
    <Card style={styles.exerciseCard} padding="md">
      <View style={styles.exerciseHeader}>
        <View style={[styles.exerciseIndex, { backgroundColor: colors.tint + '15' }]}>
          <ThemedText style={[styles.exerciseIndexText, { color: colors.tint }]}>
            {index}
          </ThemedText>
        </View>
        <View style={styles.exerciseInfo}>
          <ThemedText style={styles.exerciseName} numberOfLines={2}>
            {exercise.name}
          </ThemedText>
          <View style={styles.exerciseMeta}>
            <ThemedText style={[styles.exerciseDetail, { color: colors.textSecondary }]}>
              {sets} sets × {reps} reps
            </ThemedText>
            {weight && (
              <ThemedText style={[styles.exerciseWeight, { color: colors.tint }]}>
                {weight}
              </ThemedText>
            )}
          </View>
        </View>
      </View>
      {exercise.notes && (
        <ThemedText style={[styles.exerciseNotes, { color: colors.textSecondary }]}>
          {exercise.notes}
        </ThemedText>
      )}
    </Card>
  );
}

// Helper function
function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'today';
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  headerCard: {
    gap: Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekDayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  workoutTitle: {
    ...Typography.title2,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: Spacing.sm,
  },
  stat: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  lastCompleted: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  exerciseCard: {
    gap: Spacing.xs,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  exerciseIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseIndexText: {
    fontSize: 14,
    fontWeight: '700',
  },
  exerciseInfo: {
    flex: 1,
    gap: 2,
  },
  exerciseName: {
    ...Typography.body,
    fontWeight: '600',
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  exerciseDetail: {
    fontSize: 14,
  },
  exerciseWeight: {
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseNotes: {
    fontSize: 13,
    marginLeft: 44,
    fontStyle: 'italic',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: Radius.lg,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
