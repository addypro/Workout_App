import { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  View,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/screen';
import { Colors, Radius, Spacing, Shadows, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getFullWorkouts, getProgramById, type Workout } from '@/lib/services/programs';
import { saveProgram, getProgramByName } from '@/lib/db/storage';
import { downloadCSV, programToCSV } from '@/lib/utils/csv-export';

// Color mappings
const TYPE_COLORS: Record<string, string> = {
  STRENGTH: '#FF453A',
  HYPERTROPHY: '#0A84FF',
  ENDURANCE: '#30D158',
  ATHLETIC: '#FF9F0A',
  BODYWEIGHT: '#BF5AF2',
  WEIGHT_LOSS: '#FF6482',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  BEGINNER: '#30D158',
  INTERMEDIATE: '#FF9F0A',
  ADVANCED: '#FF453A',
};

export default function ProgramDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [installing, setInstalling] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number> | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutsLoading, setWorkoutsLoading] = useState(true);

  // Memoize program lookup to avoid recalculation on re-renders
  const program = useMemo(() => getProgramById(id as string), [id]);

  useEffect(() => {
    let cancelled = false;

    const loadWorkouts = async () => {
      if (!program) {
        setWorkouts([]);
        setWorkoutsLoading(false);
        return;
      }

      setWorkoutsLoading(true);
      try {
        const full = await getFullWorkouts(program);
        if (!cancelled) {
          setWorkouts(full);
        }
      } catch (error) {
        console.warn('[ProgramDetails] Failed to load full workouts, using embedded data:', error);
        if (!cancelled) {
          setWorkouts(program.workouts || []);
        }
      } finally {
        if (!cancelled) {
          setWorkoutsLoading(false);
        }
      }
    };

    loadWorkouts();

    return () => {
      cancelled = true;
    };
  }, [program]);

  const workoutsByWeek = useMemo(() => (
    workouts.reduce((acc, w) => {
      if (!acc[w.week]) acc[w.week] = [];
      acc[w.week].push(w);
      return acc;
    }, {} as Record<number, Workout[]>)
  ), [workouts]);

  const programDuration = program?.duration ?? 0;
  const coverageWeeks = workouts.length > 0
    ? Math.max(...workouts.map((w) => w.week || 1), 1)
    : 0;
  const displayWeeks = programDuration > 0
    ? Array.from({ length: programDuration }, (_, index) => index + 1)
    : Array.from({ length: coverageWeeks }, (_, index) => index + 1);
  const showPreviewNote = coverageWeeks > 0 && programDuration > coverageWeeks;

  // Initialize expanded weeks once data is ready
  useEffect(() => {
    if (!program || workoutsLoading || expandedWeeks !== null) return;
    const initialWeeks = displayWeeks.length > 0 ? displayWeeks.slice(0, 2) : [1];
    setExpandedWeeks(new Set(initialWeeks));
  }, [program, workoutsLoading, expandedWeeks, displayWeeks]);

  if (!program) {
    return (
      <Screen contentStyle={styles.screenContent}>
        <View style={styles.errorContainer}>
          <View style={[styles.errorIcon, { backgroundColor: colors.tintMuted }]}>
            <IconSymbol name="exclamationmark.triangle" size={32} color={colors.tint} />
          </View>
          <ThemedText style={[styles.errorTitle, { color: colors.text }]}>Program not found</ThemedText>
          <Pressable 
            style={[styles.errorButton, { backgroundColor: colors.tint }]}
            onPress={() => router.back()}
          >
            <ThemedText style={styles.errorButtonText}>Go Back</ThemedText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const typeColor = TYPE_COLORS[program.type] || colors.tint;
  const diffColor = DIFFICULTY_COLORS[program.difficulty] || colors.textSecondary;

  const toggleWeek = (week: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedWeeks(prev => {
      const newSet = new Set(prev ?? []);
      if (newSet.has(week)) newSet.delete(week);
      else newSet.add(week);
      return newSet;
    });
  };

  const doInstall = async () => {
    const installWorkouts = workouts.length > 0 ? workouts : program.workouts;
    await saveProgram({
      name: program.name,
      description: program.description || `${program.type} program - ${program.difficulty}`,
      userId: 'local',
      sourceType: 'KAGGLE',
      sourceFileUri: null,
      status: 'READY',
      parsedData: {
        type: program.type,
        duration: program.duration,
        difficulty: program.difficulty,
        muscleGroups: program.muscleGroups,
        equipment: program.equipment,
        workouts: installWorkouts.map(w => ({
          week: w.week,
          day: w.day,
          name: w.name,
          exercises: w.exercises.map(e => ({
            name: e.name,
            sets: e.sets,
            reps: e.reps,
            weight: e.weight,
            restTime: e.restTime,
          })),
        })),
      },
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (Platform.OS === 'web') {
      if (window.confirm('Success! Program installed. View My Programs?')) {
        router.push('/(tabs)');
      }
    } else {
      Alert.alert('Success!', 'Program installed to My Programs.', [
        { text: 'View Programs', onPress: () => router.push('/(tabs)') },
        { text: 'OK', style: 'cancel' },
      ]);
    }
  };

  const installProgram = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setInstalling(true);
    try {
      const existing = await getProgramByName(program.name);
      if (existing) {
        if (Platform.OS === 'web') {
          if (window.confirm(`"${program.name}" already exists. Add another copy?`)) {
            await doInstall();
          }
        } else {
          Alert.alert('Program Exists', `"${program.name}" is already saved. Add another?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Anyway', onPress: doInstall },
          ]);
        }
      } else {
        await doInstall();
      }
    } catch (e) {
      console.error(e);
      const msg = 'Failed to install program. Please try again.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setInstalling(false);
    }
  };

  const workoutCount = workoutsLoading ? program.workouts.length : workouts.length;
  const totalExercises = (workoutsLoading ? program.workouts : workouts)
    .reduce((sum, w) => sum + w.exercises.length, 0);

  return (
    <Screen contentStyle={styles.screenContent} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: '',
          headerShadowVisible: false,
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={[styles.hero, { backgroundColor: typeColor + '12' }]}>
          <View style={styles.heroContent}>
            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: typeColor + '20' }]}>
                <View style={[styles.badgeDot, { backgroundColor: typeColor }]} />
                <ThemedText style={[styles.badgeText, { color: typeColor }]}>{program.type}</ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: diffColor + '20' }]}>
                <ThemedText style={[styles.badgeText, { color: diffColor }]}>{program.difficulty}</ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.heroTitle, { color: colors.text }]}>{program.name}</ThemedText>
            {program.description && (
              <ThemedText style={[styles.heroDescription, { color: colors.textSecondary }]} numberOfLines={3}>
                {program.description}
              </ThemedText>
            )}
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard icon="calendar" value={program.duration} label="Weeks" color={colors.tint} colors={colors} />
          <StatCard icon="figure.strengthtraining.traditional" value={workoutCount} label="Workouts" color="#FF9F0A" colors={colors} />
          <StatCard icon="dumbbell" value={totalExercises} label="Exercises" color="#BF5AF2" colors={colors} />
        </View>

        {/* Muscle Groups */}
        {program.muscleGroups.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>TARGET MUSCLES</ThemedText>
            <View style={styles.tags}>
              {program.muscleGroups.map((group, i) => (
                <View key={i} style={[styles.tag, { backgroundColor: colors.tintMuted }]}>
                  <ThemedText style={[styles.tagText, { color: colors.tint }]}>{group}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Equipment */}
        {program.equipment.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>EQUIPMENT NEEDED</ThemedText>
            <View style={styles.tags}>
              {program.equipment.map((item, i) => (
                <View key={i} style={[styles.tag, { backgroundColor: colors.groupedBackground, borderColor: colors.separator, borderWidth: StyleSheet.hairlineWidth }]}>
                  <ThemedText style={[styles.tagText, { color: colors.textSecondary }]}>{item}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Workout Schedule */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>SCHEDULE</ThemedText>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const allExpanded = expandedWeeks?.size === displayWeeks.length;
                setExpandedWeeks(allExpanded ? new Set() : new Set(displayWeeks));
              }}
              hitSlop={8}
            >
              <ThemedText style={[styles.expandAllText, { color: colors.tint }]}>
                {expandedWeeks?.size === displayWeeks.length ? 'Collapse All' : 'Expand All'}
              </ThemedText>
            </Pressable>
          </View>
          {showPreviewNote && (
            <View style={styles.previewNote}>
              <ThemedText style={[styles.previewNoteText, { color: colors.textSecondary }]}>
                Preview only: {coverageWeeks} of {program.duration} weeks available.
              </ThemedText>
            </View>
          )}
          <View style={styles.weeksList}>
            {displayWeeks.map(week => {
              const isExpanded = expandedWeeks?.has(week) ?? false;
              const weekWorkouts = workoutsByWeek[week] || [];
              return (
                <View key={week} style={[styles.weekCard, { backgroundColor: colors.card, borderColor: colors.separator }, Shadows.sm]}>
                  <Pressable style={styles.weekHeader} onPress={() => toggleWeek(week)}>
                    <View style={styles.weekHeaderLeft}>
                      <View style={[styles.weekNumber, { backgroundColor: colors.tintMuted }]}>
                        <ThemedText style={[styles.weekNumberText, { color: colors.tint }]}>{week}</ThemedText>
                      </View>
                      <View>
                        <ThemedText style={[styles.weekTitle, { color: colors.text }]}>Week {week}</ThemedText>
                        <ThemedText style={[styles.weekSubtitle, { color: colors.textTertiary }]}>
                          {weekWorkouts.length} workout{weekWorkouts.length !== 1 ? 's' : ''}
                        </ThemedText>
                      </View>
                    </View>
                    <IconSymbol name={isExpanded ? 'chevron.up' : 'chevron.down'} size={16} color={colors.textTertiary} />
                  </Pressable>

                  {isExpanded && (
                    <View style={[styles.weekContent, { borderTopColor: colors.separator }]}>
                      {weekWorkouts.length === 0 && (
                        <View style={styles.weekEmptyState}>
                          <ThemedText style={[styles.weekEmptyText, { color: colors.textSecondary }]}>
                            Workout details for this week are not available yet.
                          </ThemedText>
                        </View>
                      )}
                      {weekWorkouts.map((workout, i) => (
                        <View key={i} style={[styles.workoutSection, i < weekWorkouts.length - 1 && { borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                          {/* Workout Header */}
                          <View style={styles.workoutRow}>
                            <View style={[styles.dayBadge, { backgroundColor: colors.tintMuted }]}>
                              <ThemedText style={[styles.dayText, { color: colors.tint }]}>D{workout.day}</ThemedText>
                            </View>
                            <View style={styles.workoutInfo}>
                              <ThemedText style={[styles.workoutName, { color: colors.text }]}>{workout.name}</ThemedText>
                              <ThemedText style={[styles.workoutMeta, { color: colors.textTertiary }]}>
                                {workout.exercises.length} exercises
                              </ThemedText>
                            </View>
                          </View>
                          {/* Exercise List */}
                          <View style={styles.exerciseList}>
                            {workout.exercises.map((exercise, j) => (
                              <View key={j} style={styles.exerciseRow}>
                                <View style={[styles.exerciseIndex, { backgroundColor: colors.groupedBackground }]}>
                                  <ThemedText style={[styles.exerciseIndexText, { color: colors.textTertiary }]}>{j + 1}</ThemedText>
                                </View>
                                <View style={styles.exerciseInfo}>
                                  <ThemedText style={[styles.exerciseName, { color: colors.text }]} numberOfLines={1}>
                                    {exercise.name}
                                  </ThemedText>
                                  <ThemedText style={[styles.exerciseMeta, { color: colors.textTertiary }]}>
                                    {exercise.sets} sets × {exercise.reps} reps
                                  </ThemedText>
                                </View>
                              </View>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer Actions */}
      <View style={[styles.footer, { backgroundColor: colors.glassBackground, borderTopColor: colors.separator, paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <Pressable
          style={({ pressed }) => [
            styles.exportButton,
            { borderColor: colors.separator, opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // Convert Kaggle program to our format for export
            const fakeProgram = {
              id: program.id,
              name: program.name,
              parsedData: { workouts: workouts.length > 0 ? workouts : program.workouts },
            };
            const content = programToCSV(fakeProgram as any);
            const safeName = program.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const success = await downloadCSV(content, `${safeName}.csv`);
            if (success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }}
        >
          <IconSymbol name="arrow.down.circle" size={20} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.installButton,
            { backgroundColor: colors.tint, transform: [{ scale: pressed ? 0.98 : 1 }] },
            installing && { opacity: 0.7 },
          ]}
          onPress={installProgram}
          disabled={installing}
        >
          <IconSymbol name={installing ? 'arrow.down.circle' : 'plus.circle.fill'} size={20} color="#fff" />
          <ThemedText style={styles.installButtonText}>
            {installing ? 'Installing...' : 'Add to My Programs'}
          </ThemedText>
        </Pressable>
      </View>
    </Screen>
  );
}

function StatCard({ icon, value, label, color, colors }: { icon: any; value: number; label: string; color: string; colors: any }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.separator }, Shadows.sm]}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <IconSymbol name={icon} size={18} color={color} />
      </View>
      <ThemedText style={[styles.statValue, { color: colors.text }]}>{value}</ThemedText>
      <ThemedText style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  hero: {
    paddingTop: 100,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  heroContent: {
    gap: Spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    ...Typography.caption1,
    fontWeight: '600',
  },
  heroTitle: {
    ...Typography.largeTitle,
    marginTop: Spacing.xs,
  },
  heroDescription: {
    ...Typography.body,
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: Spacing.md,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    ...Typography.title2,
  },
  statLabel: {
    ...Typography.caption1,
  },
  section: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...Typography.caption1,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  expandAllText: {
    ...Typography.footnote,
    fontWeight: '500',
  },
  previewNote: {
    paddingHorizontal: Spacing.xs,
  },
  previewNoteText: {
    ...Typography.caption1,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  tagText: {
    ...Typography.footnote,
    fontWeight: '500',
  },
  weeksList: {
    gap: Spacing.sm,
  },
  weekCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  weekHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  weekNumber: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNumberText: {
    ...Typography.headline,
  },
  weekTitle: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  weekSubtitle: {
    ...Typography.caption1,
  },
  weekContent: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  weekEmptyState: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  weekEmptyText: {
    ...Typography.caption1,
  },
  workoutSection: {
    paddingVertical: Spacing.sm,
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  dayBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    ...Typography.caption1,
    fontWeight: '600',
  },
  workoutInfo: {
    flex: 1,
    gap: 2,
  },
  workoutName: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  workoutMeta: {
    ...Typography.caption1,
  },
  exerciseList: {
    marginTop: Spacing.xs,
    marginLeft: Spacing.md + 32 + Spacing.sm, // Align with workout name
    paddingRight: Spacing.md,
    gap: 6,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  exerciseIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseIndexText: {
    ...Typography.caption2,
    fontWeight: '500',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    ...Typography.footnote,
    fontWeight: '500',
  },
  exerciseMeta: {
    ...Typography.caption2,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  exportButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  installButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: Radius.lg,
  },
  installButtonText: {
    ...Typography.headline,
    color: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    ...Typography.title3,
  },
  errorButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  errorButtonText: {
    ...Typography.headline,
    color: '#fff',
  },
});
