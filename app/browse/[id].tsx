import { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getProgramById } from '@/lib/kaggle-programs';
import { saveProgram } from '@/lib/db/storage';

export default function ProgramDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [installing, setInstalling] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));

  const program = getProgramById(id as string);

  if (!program) {
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={styles.errorContainer}>
          <IconSymbol name="exclamationmark.triangle" size={48} color={colors.text + '40'} />
          <ThemedText type="subtitle">Program not found</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'STRENGTH':
        return '#F44336';
      case 'HYPERTROPHY':
        return '#2196F3';
      case 'ENDURANCE':
        return '#4CAF50';
      case 'ATHLETIC':
        return '#FF9800';
      case 'BODYWEIGHT':
        return '#9C27B0';
      default:
        return colors.tint;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'BEGINNER':
        return '#4CAF50';
      case 'INTERMEDIATE':
        return '#FF9800';
      case 'ADVANCED':
        return '#F44336';
      default:
        return colors.text;
    }
  };

  const toggleWeek = (week: number) => {
    setExpandedWeeks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(week)) {
        newSet.delete(week);
      } else {
        newSet.add(week);
      }
      return newSet;
    });
  };

  const installProgram = async () => {
    try {
      setInstalling(true);

      // Convert Kaggle program to app format
      const programData = {
        name: program.name,
        description: program.description || `${program.type} program - ${program.difficulty}`,
        userId: 'local', // Local user for now
        sourceType: 'KAGGLE' as const,
        sourceFileUri: null,
        status: 'READY' as const,
        parsedData: {
          type: program.type,
          duration: program.duration,
          difficulty: program.difficulty,
          muscleGroups: program.muscleGroups,
          equipment: program.equipment,
          workouts: program.workouts.map(workout => ({
            week: workout.week,
            day: workout.day,
            name: workout.name,
            exercises: workout.exercises.map(exercise => ({
              name: exercise.name,
              sets: exercise.sets,
              reps: exercise.reps,
              weight: exercise.weight,
              restTime: exercise.restTime,
            })),
          })),
        },
      };

      await saveProgram(programData);

      Alert.alert(
        'Success!',
        'Program installed to My Programs. You can now start workouts from the Programs tab.',
        [
          {
            text: 'View My Programs',
            onPress: () => router.push('/(tabs)'),
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Error installing program:', error);
      Alert.alert(
        'Error',
        'Failed to install program. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setInstalling(false);
    }
  };

  // Group workouts by week
  const workoutsByWeek = program.workouts.reduce((acc, workout) => {
    if (!acc[workout.week]) {
      acc[workout.week] = [];
    }
    acc[workout.week].push(workout);
    return acc;
  }, {} as Record<number, typeof program.workouts>);

  const weeks = Object.keys(workoutsByWeek).map(Number).sort((a, b) => a - b);
  const totalExercises = program.workouts.reduce((sum, w) => sum + w.exercises.length, 0);

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <ThemedView style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color={colors.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={styles.title}>
            {program.name}
          </ThemedText>
        </ThemedView>

        {/* Badges */}
        <ThemedView style={styles.badges}>
          <ThemedView
            style={[styles.badge, { backgroundColor: getTypeColor(program.type) + '20' }]}
          >
            <ThemedText style={[styles.badgeText, { color: getTypeColor(program.type) }]}>
              {program.type}
            </ThemedText>
          </ThemedView>
          <ThemedView
            style={[styles.badge, { backgroundColor: getDifficultyColor(program.difficulty) + '20' }]}
          >
            <ThemedText style={[styles.badgeText, { color: getDifficultyColor(program.difficulty) }]}>
              {program.difficulty}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Description */}
        {program.description && (
          <ThemedView style={styles.section}>
            <ThemedText style={styles.description}>{program.description}</ThemedText>
          </ThemedView>
        )}

        {/* Stats */}
        <ThemedView style={styles.statsGrid}>
          <ThemedView style={[styles.statCard, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
            <IconSymbol name="calendar" size={24} color={colors.tint} />
            <ThemedText style={styles.statValue}>{program.duration}</ThemedText>
            <ThemedText style={styles.statLabel}>Weeks</ThemedText>
          </ThemedView>
          <ThemedView style={[styles.statCard, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
            <IconSymbol name="figure.strengthtraining.traditional" size={24} color={colors.tint} />
            <ThemedText style={styles.statValue}>{program.workouts.length}</ThemedText>
            <ThemedText style={styles.statLabel}>Workouts</ThemedText>
          </ThemedView>
          <ThemedView style={[styles.statCard, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
            <IconSymbol name="dumbbell" size={24} color={colors.tint} />
            <ThemedText style={styles.statValue}>{totalExercises}</ThemedText>
            <ThemedText style={styles.statLabel}>Exercises</ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Muscle Groups */}
        {program.muscleGroups.length > 0 && (
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Target Muscle Groups</ThemedText>
            <ThemedView style={styles.tags}>
              {program.muscleGroups.map((group, index) => (
                <ThemedView
                  key={index}
                  style={[styles.tag, { backgroundColor: colors.tint + '20' }]}
                >
                  <ThemedText style={[styles.tagText, { color: colors.tint }]}>
                    {group}
                  </ThemedText>
                </ThemedView>
              ))}
            </ThemedView>
          </ThemedView>
        )}

        {/* Equipment */}
        {program.equipment.length > 0 && (
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Required Equipment</ThemedText>
            <ThemedView style={styles.tags}>
              {program.equipment.map((item, index) => (
                <ThemedView
                  key={index}
                  style={[styles.tag, { backgroundColor: colors.text + '10', borderColor: colors.text + '20' }]}
                >
                  <ThemedText style={styles.tagText}>{item}</ThemedText>
                </ThemedView>
              ))}
            </ThemedView>
          </ThemedView>
        )}

        {/* Workout Schedule */}
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Workout Schedule</ThemedText>
          {weeks.map(week => (
            <ThemedView key={week} style={styles.weekContainer}>
              <TouchableOpacity
                style={[styles.weekHeader, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}
                onPress={() => toggleWeek(week)}
              >
                <ThemedText style={styles.weekTitle}>
                  Week {week} ({workoutsByWeek[week].length} workouts)
                </ThemedText>
                <IconSymbol
                  name={expandedWeeks.has(week) ? 'chevron.up' : 'chevron.down'}
                  size={20}
                  color={colors.text}
                />
              </TouchableOpacity>

              {expandedWeeks.has(week) && (
                <ThemedView style={styles.workoutsContainer}>
                  {workoutsByWeek[week].map((workout, index) => (
                    <ThemedView
                      key={`${week}-${workout.day}`}
                      style={[styles.workoutCard, { backgroundColor: colors.background, borderColor: colors.text + '10' }]}
                    >
                      <ThemedText style={styles.workoutName}>
                        Day {workout.day}: {workout.name}
                      </ThemedText>
                      <ThemedText style={styles.exerciseCount}>
                        {workout.exercises.length} exercises
                      </ThemedText>
                      <ThemedView style={styles.exerciseList}>
                        {workout.exercises.slice(0, 3).map((exercise, idx) => (
                          <ThemedText key={idx} style={styles.exerciseName}>
                            • {exercise.name} - {exercise.sets}x{exercise.reps}
                          </ThemedText>
                        ))}
                        {workout.exercises.length > 3 && (
                          <ThemedText style={styles.moreExercises}>
                            +{workout.exercises.length - 3} more exercises
                          </ThemedText>
                        )}
                      </ThemedView>
                    </ThemedView>
                  ))}
                </ThemedView>
              )}
            </ThemedView>
          ))}
        </ThemedView>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Install Button */}
      <ThemedView style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.text + '20' }]}>
        <TouchableOpacity
          style={[styles.installButton, { backgroundColor: colors.tint }]}
          onPress={installProgram}
          disabled={installing}
        >
          <IconSymbol name={installing ? 'arrow.down.circle' : 'plus.circle.fill'} size={20} color="#fff" />
          <ThemedText style={styles.installButtonText}>
            {installing ? 'Installing...' : 'Install to My Programs'}
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  title: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.6,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  weekContainer: {
    marginBottom: 12,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  workoutsContainer: {
    marginTop: 8,
    gap: 8,
    paddingLeft: 16,
  },
  workoutCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  workoutName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  exerciseCount: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 8,
  },
  exerciseList: {
    gap: 2,
  },
  exerciseName: {
    fontSize: 12,
    opacity: 0.7,
  },
  moreExercises: {
    fontSize: 12,
    opacity: 0.5,
    fontStyle: 'italic',
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  installButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  installButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
});
