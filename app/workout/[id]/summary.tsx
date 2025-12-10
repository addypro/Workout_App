import { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/IconSymbol';

type Difficulty = 'easy' | 'moderate' | 'challenging' | 'very_hard';

export default function WorkoutSummaryScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [notes, setNotes] = useState('');

  // TODO: Load actual workout data
  const workoutData = {
    name: 'Sample Workout',
    duration: 3245, // seconds
    totalSets: 12,
    completedSets: 12,
    totalExercises: 4,
    completedExercises: 4,
    estimatedCalories: 285,
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const handleSave = async () => {
    // TODO: Save workout log to Supabase
    console.log('Saving workout:', { difficulty, notes });
    router.push('/');
  };

  const handleDiscard = () => {
    router.push('/');
  };

  const difficulties: { value: Difficulty; label: string; emoji: string }[] = [
    { value: 'easy', label: 'Easy', emoji: '😊' },
    { value: 'moderate', label: 'Moderate', emoji: '😅' },
    { value: 'challenging', label: 'Challenging', emoji: '😰' },
    { value: 'very_hard', label: 'Very Hard', emoji: '🥵' },
  ];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Workout Complete!',
          headerBackVisible: false,
        }}
      />

      <ScrollView style={styles.content}>
        {/* Congratulations Banner */}
        <ThemedView style={styles.banner}>
          <IconSymbol name="checkmark.circle.fill" size={64} color={colors.tint} />
          <ThemedText type="title" style={styles.congrats}>
            Great Job!
          </ThemedText>
          <ThemedText style={styles.subtitle}>You completed {workoutData.name}</ThemedText>
        </ThemedView>

        {/* Stats Grid */}
        <ThemedView style={styles.statsGrid}>
          <ThemedView style={[styles.statCard, { backgroundColor: colors.tint + '10' }]}>
            <IconSymbol name="timer" size={32} color={colors.tint} />
            <ThemedText style={styles.statValue}>{formatDuration(workoutData.duration)}</ThemedText>
            <ThemedText style={styles.statLabel}>Duration</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.statCard, { backgroundColor: colors.tint + '10' }]}>
            <IconSymbol name="checkmark.circle" size={32} color={colors.tint} />
            <ThemedText style={styles.statValue}>
              {workoutData.completedSets}/{workoutData.totalSets}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Sets</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.statCard, { backgroundColor: colors.tint + '10' }]}>
            <IconSymbol name="figure.run" size={32} color={colors.tint} />
            <ThemedText style={styles.statValue}>{workoutData.completedExercises}</ThemedText>
            <ThemedText style={styles.statLabel}>Exercises</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.statCard, { backgroundColor: colors.tint + '10' }]}>
            <IconSymbol name="flame.fill" size={32} color={colors.tint} />
            <ThemedText style={styles.statValue}>~{workoutData.estimatedCalories}</ThemedText>
            <ThemedText style={styles.statLabel}>Calories</ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Difficulty Rating */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            How difficult was this workout?
          </ThemedText>
          <ThemedView style={styles.difficultyGrid}>
            {difficulties.map((diff) => (
              <TouchableOpacity
                key={diff.value}
                style={[
                  styles.difficultyButton,
                  { borderColor: colors.text + '20' },
                  difficulty === diff.value && {
                    borderColor: colors.tint,
                    backgroundColor: colors.tint + '20',
                  },
                ]}
                onPress={() => setDifficulty(diff.value)}
              >
                <ThemedText style={styles.difficultyEmoji}>{diff.emoji}</ThemedText>
                <ThemedText
                  style={[
                    styles.difficultyLabel,
                    difficulty === diff.value && { color: colors.tint, fontWeight: '600' },
                  ]}
                >
                  {diff.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ThemedView>
        </ThemedView>

        {/* Notes */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Notes (optional)
          </ThemedText>
          <TextInput
            style={[
              styles.notesInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.text + '20',
                color: colors.text,
              },
            ]}
            placeholder="How did you feel? Any observations?"
            placeholderTextColor={colors.text + '60'}
            multiline
            numberOfLines={4}
            value={notes}
            onChangeText={setNotes}
            textAlignVertical="top"
          />
        </ThemedView>
      </ScrollView>

      {/* Action Buttons */}
      <ThemedView style={styles.actions}>
        <TouchableOpacity
          style={[styles.discardButton, { borderColor: colors.text + '20' }]}
          onPress={handleDiscard}
        >
          <ThemedText style={styles.discardText}>Discard</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.tint }]}
          onPress={handleSave}
        >
          <IconSymbol name="checkmark" size={20} color="#fff" />
          <ThemedText style={styles.saveText}>Save Workout</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  banner: {
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  congrats: {
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  section: {
    padding: 16,
    gap: 16,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  difficultyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  difficultyButton: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    gap: 8,
  },
  difficultyEmoji: {
    fontSize: 32,
  },
  difficultyLabel: {
    fontSize: 14,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#00000010',
  },
  discardButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  discardText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  saveText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
