/**
 * Workout History Detail Screen
 *
 * Shows detailed workout information with:
 * - Full exercise breakdown
 * - Sets, reps, and weights used
 * - Ability to repeat the workout
 */

import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Card } from '@/components/ui/card';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getWorkoutRecordById,
  createProgram,
  type UnifiedWorkoutRecord,
} from '@/lib/db/storage';

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<UnifiedWorkoutRecord | null>(null);
  const [repeating, setRepeating] = useState(false);

  useEffect(() => {
    loadRecord();
  }, [id]);

  const loadRecord = async () => {
    try {
      const data = await getWorkoutRecordById(id as string);
      setRecord(data);
    } catch (error) {
      console.error('Error loading workout record:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleRepeatWorkout = async () => {
    if (!record) return;

    setRepeating(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Create a new program with the same exercises
      const workoutName = `${record.workoutName} (Repeat)`;
      const program = await createProgram(workoutName, 'Repeated workout');

      // Build the exercises for the program
      const exercises = record.exercises.map((ex, idx) => ({
        name: ex.name,
        sets: ex.totalSets,
        reps: ex.bestSet?.reps?.toString() || '8-12',
        restTime: 90,
        notes: '',
        order: idx,
      }));

      // Update the program with exercises
      const parsedData = {
        workouts: [
          {
            week: 1,
            day: 1,
            name: workoutName,
            exercises,
            order: 0,
          },
        ],
      };

      // Update the program
      const programs = await AsyncStorage.getItem('@workout_programs');
      if (programs) {
        const list = JSON.parse(programs);
        const index = list.findIndex((p: any) => p.id === program.id);
        if (index !== -1) {
          list[index].parsedData = parsedData;
          list[index].isQuickWorkout = true;
          await AsyncStorage.setItem('@workout_programs', JSON.stringify(list));
        }
      }

      // Navigate to workout execution
      router.replace(`/workout/${program.id}?week=1&day=1`);
    } catch (error) {
      console.error('Error repeating workout:', error);
      const msg = 'Failed to start workout';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setRepeating(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <Stack.Screen
          options={{
            title: 'Workout Details',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.groupedBackground },
          }}
        />
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  if (!record) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <Stack.Screen
          options={{
            title: 'Workout Details',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.groupedBackground },
          }}
        />
        <ThemedText style={{ color: colors.textSecondary }}>Workout not found</ThemedText>
      </ThemedView>
    );
  }

  const totalSets = record.exercises.reduce((sum, ex) => sum + ex.setsCompleted, 0);
  const totalVolume = record.exercises.reduce((sum, ex) => {
    if (ex.bestSet?.weight && ex.bestSet?.reps) {
      return sum + ex.bestSet.weight * ex.bestSet.reps * ex.setsCompleted;
    }
    return sum;
  }, 0);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Workout Details',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.groupedBackground },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <IconSymbol name="chevron.left" size={20} color={colors.tint} />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Card */}
        <Card style={styles.headerCard} padding="md">
          <View style={styles.headerTop}>
            <View
              style={[
                styles.typeIcon,
                {
                  backgroundColor: record.type === 'quick'
                    ? '#FF9500' + '18'
                    : colors.tint + '18',
                },
              ]}
            >
              <IconSymbol
                name={record.type === 'quick' ? 'bolt.fill' : 'figure.strengthtraining.traditional'}
                size={24}
                color={record.type === 'quick' ? '#FF9500' : colors.tint}
              />
            </View>
            <ThemedText style={styles.workoutName}>{record.workoutName}</ThemedText>
            {record.programName && (
              <ThemedText style={[styles.programName, { color: colors.textSecondary }]}>
                From: {record.programName}
              </ThemedText>
            )}
          </View>

          <View style={styles.dateRow}>
            <IconSymbol name="calendar" size={16} color={colors.textSecondary} />
            <ThemedText style={[styles.dateText, { color: colors.textSecondary }]}>
              {formatDate(record.completedAt)} at {formatTime(record.completedAt)}
            </ThemedText>
          </View>
        </Card>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="clock.fill"
            value={formatDuration(record.durationSeconds)}
            label="Duration"
            color="#5856D6"
            colors={colors}
          />
          <StatCard
            icon="checkmark.circle.fill"
            value={`${totalSets}`}
            label="Sets"
            color="#30D158"
            colors={colors}
          />
          <StatCard
            icon="dumbbell"
            value={`${record.exercises.length}`}
            label="Exercises"
            color="#FF9500"
            colors={colors}
          />
          {totalVolume > 0 && (
            <StatCard
              icon="scalemass.fill"
              value={`${Math.round(totalVolume / 1000)}k`}
              label="Volume (lbs)"
              color="#FF453A"
              colors={colors}
            />
          )}
        </View>

        {/* Exercises Section */}
        <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
          Exercises
        </ThemedText>

        <View style={styles.exercisesList}>
          {record.exercises.map((exercise, index) => (
            <Card key={index} style={styles.exerciseCard} padding="md">
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseNumber}>
                  <ThemedText style={styles.exerciseNumberText}>{index + 1}</ThemedText>
                </View>
                <View style={styles.exerciseInfo}>
                  <ThemedText style={styles.exerciseName}>{exercise.name}</ThemedText>
                  <ThemedText style={[styles.exerciseSets, { color: colors.textSecondary }]}>
                    {exercise.setsCompleted}/{exercise.totalSets} sets completed
                  </ThemedText>
                </View>
              </View>

              {exercise.bestSet && (
                <View style={[styles.bestSetRow, { backgroundColor: colors.groupedBackground }]}>
                  <IconSymbol name="star.fill" size={14} color="#FFD60A" />
                  <ThemedText style={[styles.bestSetText, { color: colors.text }]}>
                    Best set: {exercise.bestSet.reps} reps
                    {exercise.bestSet.weight ? ` @ ${exercise.bestSet.weight} lbs` : ''}
                  </ThemedText>
                </View>
              )}
            </Card>
          ))}
        </View>
      </ScrollView>

      {/* Repeat Button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.repeatButton,
            { backgroundColor: colors.tint, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={handleRepeatWorkout}
          disabled={repeating}
        >
          <IconSymbol name="arrow.counterclockwise" size={20} color="#fff" />
          <ThemedText style={styles.repeatButtonText}>
            {repeating ? 'Starting...' : 'Repeat This Workout'}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

// Stat Card Component
function StatCard({
  icon,
  value,
  label,
  color,
  colors,
}: {
  icon: string;
  value: string;
  label: string;
  color: string;
  colors: typeof Colors['light'];
}) {
  return (
    <Card style={styles.statCard} padding="sm">
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        <IconSymbol name={icon as any} size={18} color={color} />
      </View>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
        {label}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  headerCard: {
    marginBottom: Spacing.md,
  },
  headerTop: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutName: {
    ...Typography.title2,
    fontWeight: '700',
    textAlign: 'center',
  },
  programName: {
    ...Typography.subhead,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dateText: {
    ...Typography.subhead,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    gap: 6,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    ...Typography.headline,
    fontWeight: '700',
  },
  statLabel: {
    ...Typography.caption2,
  },
  sectionTitle: {
    ...Typography.title3,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  exercisesList: {
    gap: Spacing.sm,
  },
  exerciseCard: {
    gap: Spacing.sm,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  exerciseNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,122,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNumberText: {
    ...Typography.caption1,
    fontWeight: '600',
    color: '#007AFF',
  },
  exerciseInfo: {
    flex: 1,
    gap: 2,
  },
  exerciseName: {
    ...Typography.headline,
    fontWeight: '600',
  },
  exerciseSets: {
    ...Typography.caption1,
  },
  bestSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  bestSetText: {
    ...Typography.caption1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    backgroundColor: 'transparent',
  },
  repeatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: Radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  repeatButtonText: {
    color: '#fff',
    ...Typography.headline,
    fontWeight: '600',
  },
});
