import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getCompletedWorkouts } from '@/lib/db/storage';

type Workout = {
  week: number;
  day: number;
  name: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (week: number, day: number) => void;
  programId: string;
  programName: string;
  workouts: Workout[];
  /** If true, onSelect goes to preview screen instead of workout */
  goToPreview?: boolean;
};

export function WorkoutPickerModal({
  visible,
  onClose,
  onSelect,
  programId,
  programName,
  workouts,
}: Props) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      loadCompletions();
    }
  }, [visible, programId]);

  async function loadCompletions() {
    const completed = await getCompletedWorkouts(programId);
    setCompletedSet(completed);
  }

  // Group workouts by week
  const workoutsByWeek = workouts.reduce((acc, workout) => {
    if (!acc[workout.week]) {
      acc[workout.week] = [];
    }
    acc[workout.week].push(workout);
    return acc;
  }, {} as Record<number, Workout[]>);

  const weeks = Object.keys(workoutsByWeek).map(Number).sort((a, b) => a - b);

  // Calculate progress
  const totalWorkouts = workouts.length;
  const completedCount = completedSet.size;
  const progressPercent = totalWorkouts > 0 ? Math.round((completedCount / totalWorkouts) * 100) : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView
          intensity={25}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Pressable style={styles.backdrop} onPress={onClose} />
        <ThemedView
          style={[
            styles.sheet,
            {
              backgroundColor: colors.elevated,
              paddingBottom: Math.max(insets.bottom, Spacing.lg),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.titleRow}>
              <ThemedText type="headline" style={styles.title}>
                {programName}
              </ThemedText>
              <Pressable onPress={onClose} hitSlop={12}>
                <IconSymbol name="xmark" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Progress Summary */}
          <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.separator }]}>
            <View style={styles.progressInfo}>
              <ThemedText style={styles.progressLabel}>Progress</ThemedText>
              <ThemedText style={[styles.progressValue, { color: colors.tint }]}>
                {completedCount}/{totalWorkouts} workouts
              </ThemedText>
            </View>
            <View style={[styles.progressBarBg, { backgroundColor: colors.separator }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progressPercent}%`, backgroundColor: colors.tint },
                ]}
              />
            </View>
          </View>

          {/* Week/Day Grid */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {weeks.map(week => {
              const weekWorkouts = workoutsByWeek[week];
              const completedInWeek = weekWorkouts.filter(w =>
                completedSet.has(`${w.week}-${w.day}`)
              ).length;

              return (
                <View key={week} style={styles.weekSection}>
                  <View style={styles.weekHeader}>
                    <ThemedText style={styles.weekTitle}>Week {week}</ThemedText>
                    <ThemedText style={[styles.weekProgress, { color: colors.textSecondary }]}>
                      {completedInWeek}/{weekWorkouts.length}
                    </ThemedText>
                  </View>
                  <View style={styles.daysGrid}>
                    {weekWorkouts.map(workout => {
                      const isCompleted = completedSet.has(`${workout.week}-${workout.day}`);
                      return (
                        <Pressable
                          key={`${workout.week}-${workout.day}`}
                          style={({ pressed }) => [
                            styles.dayCard,
                            {
                              backgroundColor: isCompleted
                                ? colors.tint + '18'
                                : colors.card,
                              borderColor: isCompleted ? colors.tint : colors.separator,
                              opacity: pressed ? 0.8 : 1,
                            },
                          ]}
                          onPress={() => onSelect(workout.week, workout.day)}
                        >
                          <View style={styles.dayHeader}>
                            <ThemedText style={[styles.dayNumber, isCompleted && { color: colors.tint }]}>
                              Day {workout.day}
                            </ThemedText>
                            {isCompleted && (
                              <IconSymbol name="checkmark.circle.fill" size={16} color={colors.tint} />
                            )}
                          </View>
                          <ThemedText
                            style={[styles.dayName, { color: colors.textSecondary }]}
                            numberOfLines={2}
                          >
                            {workout.name}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#999',
    opacity: 0.4,
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingBottom: Spacing.md,
  },
  title: {
    flex: 1,
  },
  progressCard: {
    marginHorizontal: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  weekSection: {
    marginBottom: Spacing.lg,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  weekTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  weekProgress: {
    fontSize: 12,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dayCard: {
    width: '47%',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    minHeight: 70,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  dayName: {
    fontSize: 12,
    lineHeight: 16,
  },
});
