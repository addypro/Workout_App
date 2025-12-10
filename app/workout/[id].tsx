import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Vibration,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RestTimer } from '@/components/rest-timer';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import {
  WorkoutSession,
  WorkoutExercise,
  WorkoutSet,
  getCurrentExercise,
  getCurrentSet,
  getNextExercise,
  calculateWorkoutProgress,
  formatDuration,
  isWorkoutComplete,
} from '@/lib/types/workout-session';

export default function ActiveWorkoutScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Workout state
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [viewMode, setViewMode] = useState<'current' | 'overview'>('current');

  // Load workout from storage (placeholder - will integrate with actual data)
  useEffect(() => {
    loadWorkout();
  }, [id]);

  // Workout timer
  useEffect(() => {
    if (!session || session.status !== 'in_progress') return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.status]);

  const loadWorkout = async () => {
    // TODO: Load from storage/Supabase
    // For now, create a sample workout
    const sampleSession: WorkoutSession = {
      id: id as string,
      workoutName: 'Sample Workout',
      exercises: [
        {
          id: 'ex1',
          name: 'Barbell Bench Press',
          sets: [
            { id: 's1', reps: 10, weight: 135, isCompleted: false },
            { id: 's2', reps: 10, weight: 135, isCompleted: false },
            { id: 's3', reps: 8, weight: 145, isCompleted: false },
          ],
          restTime: 90,
          currentSetIndex: 0,
          muscleGroups: ['Chest', 'Triceps'],
        },
        {
          id: 'ex2',
          name: 'Dumbbell Incline Press',
          sets: [
            { id: 's4', reps: 12, weight: 50, isCompleted: false },
            { id: 's5', reps: 12, weight: 50, isCompleted: false },
            { id: 's6', reps: 10, weight: 55, isCompleted: false },
          ],
          restTime: 60,
          currentSetIndex: 0,
        },
      ],
      startTime: new Date(),
      currentExerciseIndex: 0,
      isResting: false,
      restTimeRemaining: 0,
      status: 'in_progress',
    };

    setSession(sampleSession);
  };

  const completeSet = (exerciseIndex: number, setIndex: number) => {
    if (!session) return;

    setSession((prev) => {
      if (!prev) return prev;

      const newSession = { ...prev };
      const exercise = newSession.exercises[exerciseIndex];
      const set = exercise.sets[setIndex];

      // Mark set as completed
      set.isCompleted = true;
      set.completedAt = new Date();
      set.actualReps = typeof set.reps === 'number' ? set.reps : parseInt(set.reps as string);
      set.actualWeight = set.weight;

      // Vibration feedback
      Vibration.vibrate(50);

      // Move to next set or exercise
      if (setIndex < exercise.sets.length - 1) {
        exercise.currentSetIndex = setIndex + 1;
        // Start rest timer
        newSession.isResting = true;
        newSession.restTimeRemaining = exercise.restTime;
      } else if (exerciseIndex < newSession.exercises.length - 1) {
        // Move to next exercise
        newSession.currentExerciseIndex = exerciseIndex + 1;
        newSession.exercises[exerciseIndex + 1].currentSetIndex = 0;
      } else {
        // Workout complete!
        handleWorkoutComplete();
      }

      return newSession;
    });
  };

  const skipRest = () => {
    setSession((prev) => {
      if (!prev) return prev;
      return { ...prev, isResting: false, restTimeRemaining: 0 };
    });
  };

  const handleWorkoutComplete = () => {
    setSession((prev) => {
      if (!prev) return prev;
      return { ...prev, status: 'completed', endTime: new Date() };
    });

    // Navigate to summary screen
    router.push(`/workout/${id}/summary`);
  };

  const handleExit = () => {
    Alert.alert(
      'Exit Workout?',
      'Your progress will be lost if you exit now.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: () => router.back(),
        },
      ]
    );
  };

  if (!session) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading workout...</ThemedText>
      </ThemedView>
    );
  }

  if (session.isResting) {
    const nextEx = getNextExercise(session);
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <RestTimer
          duration={session.restTimeRemaining}
          onComplete={skipRest}
          onSkip={skipRest}
          nextExercise={nextEx?.name}
        />
      </>
    );
  }

  const currentExercise = getCurrentExercise(session);
  const currentSet = getCurrentSet(session);
  const progress = calculateWorkoutProgress(session);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: session.workoutName,
          headerRight: () => (
            <TouchableOpacity onPress={handleExit}>
              <IconSymbol name="xmark" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Header with timer and progress */}
      <ThemedView style={styles.header}>
        <ThemedView style={styles.timerSection}>
          <IconSymbol name="timer" size={20} color={colors.tint} />
          <ThemedText style={styles.timerText}>{formatDuration(elapsedSeconds)}</ThemedText>
        </ThemedView>

        <ThemedView style={styles.progressSection}>
          <ThemedText style={styles.progressText}>
            {progress.totalSetsCompleted}/{progress.totalSets} sets
          </ThemedText>
          <View style={[styles.progressBar, { backgroundColor: colors.text + '20' }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress.setProgress * 100}%`, backgroundColor: colors.tint },
              ]}
            />
          </View>
        </ThemedView>

        {/* View Mode Toggle */}
        <ThemedView style={styles.viewToggle}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              viewMode === 'current' && { backgroundColor: colors.tint },
            ]}
            onPress={() => setViewMode('current')}
          >
            <ThemedText
              style={[
                styles.toggleText,
                viewMode === 'current' && { color: '#fff' },
              ]}
            >
              Current
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              viewMode === 'overview' && { backgroundColor: colors.tint },
            ]}
            onPress={() => setViewMode('overview')}
          >
            <ThemedText
              style={[
                styles.toggleText,
                viewMode === 'overview' && { color: '#fff' },
              ]}
            >
              Overview
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>

      <ScrollView style={styles.content}>
        {viewMode === 'current' ? (
          <CurrentExerciseView
            exercise={currentExercise!}
            exerciseIndex={session.currentExerciseIndex}
            onCompleteSet={completeSet}
            colors={colors}
          />
        ) : (
          <OverviewView
            session={session}
            onCompleteSet={completeSet}
            onSelectExercise={(index) => {
              setSession({ ...session, currentExerciseIndex: index });
              setViewMode('current');
            }}
            colors={colors}
          />
        )}
      </ScrollView>
    </ThemedView>
  );
}

function CurrentExerciseView({
  exercise,
  exerciseIndex,
  onCompleteSet,
  colors,
}: {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  onCompleteSet: (exerciseIndex: number, setIndex: number) => void;
  colors: any;
}) {
  const currentSet = exercise.sets[exercise.currentSetIndex];

  return (
    <ThemedView style={styles.currentView}>
      <ThemedText type="title" style={styles.exerciseName}>
        {exercise.name}
      </ThemedText>

      {exercise.muscleGroups && exercise.muscleGroups.length > 0 && (
        <ThemedView style={styles.muscleGroups}>
          {exercise.muscleGroups.map((muscle) => (
            <View key={muscle} style={[styles.muscleTag, { backgroundColor: colors.tint + '20' }]}>
              <ThemedText style={[styles.muscleText, { color: colors.tint }]}>
                {muscle}
              </ThemedText>
            </View>
          ))}
        </ThemedView>
      )}

      {/* Current Set Display */}
      <ThemedView style={styles.currentSetCard}>
        <ThemedText style={styles.setLabel}>
          Set {exercise.currentSetIndex + 1} of {exercise.sets.length}
        </ThemedText>

        <ThemedView style={styles.setDetails}>
          <ThemedView style={styles.setDetailItem}>
            <ThemedText style={styles.setDetailLabel}>Reps</ThemedText>
            <ThemedText style={styles.setDetailValue}>{currentSet.reps}</ThemedText>
          </ThemedView>

          {currentSet.weight && (
            <ThemedView style={styles.setDetailItem}>
              <ThemedText style={styles.setDetailLabel}>Weight</ThemedText>
              <ThemedText style={styles.setDetailValue}>{currentSet.weight} lbs</ThemedText>
            </ThemedView>
          )}
        </ThemedView>

        <TouchableOpacity
          style={[styles.completeButton, { backgroundColor: colors.tint }]}
          onPress={() => onCompleteSet(exerciseIndex, exercise.currentSetIndex)}
        >
          <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />
          <ThemedText style={styles.completeButtonText}>Complete Set</ThemedText>
        </TouchableOpacity>
      </ThemedView>

      {/* All Sets Overview */}
      <ThemedView style={styles.allSets}>
        <ThemedText type="subtitle" style={styles.allSetsTitle}>
          All Sets
        </ThemedText>
        {exercise.sets.map((set, index) => (
          <ThemedView
            key={set.id}
            style={[
              styles.setRow,
              index === exercise.currentSetIndex && { backgroundColor: colors.tint + '10' },
            ]}
          >
            <ThemedView style={styles.setInfo}>
              <ThemedText style={styles.setNumber}>Set {index + 1}</ThemedText>
              <ThemedText style={styles.setData}>
                {set.reps} reps {set.weight ? `× ${set.weight} lbs` : ''}
              </ThemedText>
            </ThemedView>
            {set.isCompleted && (
              <IconSymbol name="checkmark.circle.fill" size={24} color={colors.tint} />
            )}
          </ThemedView>
        ))}
      </ThemedView>
    </ThemedView>
  );
}

function OverviewView({
  session,
  onCompleteSet,
  onSelectExercise,
  colors,
}: {
  session: WorkoutSession;
  onCompleteSet: (exerciseIndex: number, setIndex: number) => void;
  onSelectExercise: (index: number) => void;
  colors: any;
}) {
  return (
    <ThemedView style={styles.overviewView}>
      {session.exercises.map((exercise, exerciseIndex) => {
        const completedSets = exercise.sets.filter((s) => s.isCompleted).length;
        const allComplete = completedSets === exercise.sets.length;

        return (
          <TouchableOpacity
            key={exercise.id}
            style={[
              styles.exerciseCard,
              { borderColor: colors.text + '20' },
              exerciseIndex === session.currentExerciseIndex && {
                borderColor: colors.tint,
                borderWidth: 2,
              },
            ]}
            onPress={() => onSelectExercise(exerciseIndex)}
          >
            <ThemedView style={styles.exerciseCardHeader}>
              <ThemedText type="subtitle">{exercise.name}</ThemedText>
              {allComplete && <IconSymbol name="checkmark.circle.fill" size={24} color={colors.tint} />}
            </ThemedView>

            <ThemedText style={styles.exerciseProgress}>
              {completedSets}/{exercise.sets.length} sets completed
            </ThemedText>

            <ThemedView style={styles.setsGrid}>
              {exercise.sets.map((set, setIndex) => (
                <TouchableOpacity
                  key={set.id}
                  style={[
                    styles.setCheckbox,
                    set.isCompleted && { backgroundColor: colors.tint },
                    !set.isCompleted && { borderColor: colors.text + '40', borderWidth: 2 },
                  ]}
                  onPress={() => !set.isCompleted && onCompleteSet(exerciseIndex, setIndex)}
                >
                  {set.isCompleted && (
                    <IconSymbol name="checkmark" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </ThemedView>
          </TouchableOpacity>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#00000010',
  },
  timerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  progressSection: {
    gap: 4,
  },
  progressText: {
    fontSize: 14,
    opacity: 0.7,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  toggleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#00000010',
  },
  toggleText: {
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  currentView: {
    padding: 20,
    gap: 20,
  },
  exerciseName: {
    textAlign: 'center',
  },
  muscleGroups: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  muscleTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  muscleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  currentSetCard: {
    padding: 24,
    borderRadius: 16,
    gap: 16,
    backgroundColor: '#00000005',
  },
  setLabel: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  setDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  setDetailItem: {
    alignItems: 'center',
    gap: 8,
  },
  setDetailLabel: {
    fontSize: 14,
    opacity: 0.6,
  },
  setDetailValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  completeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  allSets: {
    gap: 12,
  },
  allSetsTitle: {
    marginBottom: 4,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  setInfo: {
    gap: 4,
  },
  setNumber: {
    fontWeight: '600',
  },
  setData: {
    fontSize: 14,
    opacity: 0.7,
  },
  overviewView: {
    padding: 16,
    gap: 16,
  },
  exerciseCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseProgress: {
    fontSize: 14,
    opacity: 0.6,
  },
  setsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  setCheckbox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
