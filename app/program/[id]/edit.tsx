/**
 * Program Editor Screen - Redesigned
 *
 * Psychology-based UX principles:
 * 1. Progressive disclosure - hide complexity until needed
 * 2. Visual hierarchy - clear sections with consistent spacing
 * 3. Reduced cognitive load - one clear action at a time
 * 4. Positive reinforcement - visual feedback on actions
 * 5. Consistency - uniform containers and spacing
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TextField } from '@/components/ui/text-field';
import { Colors, Radius, StatusColors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getProgram, updateProgram, upsertProgramTemplate, type Program } from '@/lib/db/storage';
import { exportProgramToCSV } from '@/lib/utils/csv-export';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SELECTED_EXERCISE_KEY = '@selected_exercise_temp';

// Consistent spacing scale (8px base)
const SPACE = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

type EditableExercise = {
  name: string;
  sets: number;
  reps?: string;
  weight?: string;
  restTime?: number;
};

type EditableWorkout = {
  week: number;
  day: number;
  name?: string;
  exercises: EditableExercise[];
};

type EditableParsedData = {
  workouts: EditableWorkout[];
};

function normalizeParsedData(parsedData: any): EditableParsedData {
  const workouts: EditableWorkout[] = (parsedData?.workouts || []).map((w: any) => ({
    week: Number(w.week ?? 1),
    day: Number(w.day ?? 1),
    name: w.name,
    exercises: (w.exercises || []).map((ex: any) => ({
      name: String(ex.name ?? ''),
      sets: Number(ex.sets ?? 3),
      reps: ex.reps != null ? String(ex.reps) : undefined,
      weight: ex.weight != null ? String(ex.weight) : undefined,
      restTime: ex.restTime != null ? Number(ex.restTime) : undefined,
    })),
  }));
  return { workouts };
}

export default function EditProgramScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const navigation = useNavigation();

  const programId = String(id);
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<Program | null>(null);
  const [programName, setProgramName] = useState('');
  const [programDescription, setProgramDescription] = useState<string>('');
  const [data, setData] = useState<EditableParsedData>({ workouts: [] });
  const [pendingWorkoutIndex, setPendingWorkoutIndex] = useState<number | null>(null);
  const [expandedWorkout, setExpandedWorkout] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Track changes when user edits anything
  const markChanged = () => setHasChanges(true);

  // Intercept back navigation for unsaved changes
  useEffect(() => {
    const beforeRemoveListener = (e: any) => {
      // If saved or no changes, allow navigation
      if (isSaved || !hasChanges) return;

      // Prevent default back action
      e.preventDefault();

      // Show save/discard prompt
      if (Platform.OS === 'web') {
        const shouldDiscard = window.confirm('You have unsaved changes. Discard them?');
        if (shouldDiscard) {
          router.back();
        }
      } else {
        Alert.alert(
          'Unsaved Changes',
          'You have unsaved changes. What would you like to do?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => {
                setHasChanges(false);
                router.back();
              }
            },
            {
              text: 'Save',
              style: 'default',
              onPress: () => handleSave()
            },
          ]
        );
      }
    };

    // Add listener when screen has changes
    if (hasChanges && !isSaved) {
      const unsubscribe = navigation.addListener('beforeRemove', beforeRemoveListener);
      return () => unsubscribe();
    }
  }, [hasChanges, isSaved, navigation, router]);

  // Load program data
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const prog = await getProgram(programId);
      if (!prog) {
        Alert.alert('Not found', 'Program not found.');
        router.back();
        return;
      }
      setProgram(prog);
      setProgramName(prog.name);
      setProgramDescription(prog.description ?? '');
      setData(normalizeParsedData(prog.parsedData));
      // Auto-expand first workout for better onboarding
      if ((prog.parsedData?.workouts?.length ?? 0) > 0) {
        setExpandedWorkout(0);
      }
      setHasChanges(false); // Reset after loading
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load program.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [programId, router]);

  useEffect(() => {
    load();
  }, [load]);

  // Check for selected exercise when returning from picker
  useFocusEffect(
    useCallback(() => {
      const checkSelectedExercise = async () => {
        try {
          const stored = await AsyncStorage.getItem(SELECTED_EXERCISE_KEY);
          if (stored) {
            const selected = JSON.parse(stored);
            await AsyncStorage.removeItem(SELECTED_EXERCISE_KEY);

            const workoutIdx = selected.workoutIndex ?? pendingWorkoutIndex;
            if (workoutIdx !== null && workoutIdx !== undefined) {
              setData(prev => {
                const next = JSON.parse(JSON.stringify(prev)) as EditableParsedData;
                if (next.workouts[workoutIdx]) {
                  next.workouts[workoutIdx].exercises.push({
                    name: selected.name,
                    sets: 3,
                    reps: '10',
                    weight: '',
                    restTime: 60,
                  });
                }
                return next;
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            setPendingWorkoutIndex(null);
          }
        } catch (e) {
          console.error('Error checking selected exercise:', e);
        }
      };
      checkSelectedExercise();
    }, [pendingWorkoutIndex])
  );

  const toggleWorkout = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedWorkout(prev => prev === index ? null : index);
  };

  const openExercisePicker = (workoutIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingWorkoutIndex(workoutIndex);
    router.push({
      pathname: '/exercise-picker',
      params: { workoutIndex: String(workoutIndex) },
    });
  };

  const openVoiceInput = (workoutIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingWorkoutIndex(workoutIndex);
    router.push({
      pathname: '/workout/quick',
      params: { workoutIndex: String(workoutIndex), mode: 'voice' },
    });
  };

  const deleteExercise = (workoutIndex: number, exerciseIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as EditableParsedData;
      next.workouts[workoutIndex].exercises.splice(exerciseIndex, 1);
      return next;
    });
  };

  const addWorkout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as EditableParsedData;
      let nextWeek = 1;
      let nextDay = 1;
      if (next.workouts.length > 0) {
        const lastWorkout = next.workouts[next.workouts.length - 1];
        nextWeek = lastWorkout.week;
        nextDay = lastWorkout.day + 1;
        if (nextDay > 7) {
          nextWeek += 1;
          nextDay = 1;
        }
      }
      next.workouts.push({
        week: nextWeek,
        day: nextDay,
        name: `Day ${next.workouts.length + 1}`,
        exercises: [],
      });
      return next;
    });
    setExpandedWorkout(data.workouts.length);
  };

  const deleteWorkout = (workoutIndex: number) => {
    const confirmDelete = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setData((prev) => {
        const next = JSON.parse(JSON.stringify(prev)) as EditableParsedData;
        next.workouts.splice(workoutIndex, 1);
        return next;
      });
      if (expandedWorkout === workoutIndex) {
        setExpandedWorkout(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this workout day?')) {
        confirmDelete();
      }
    } else {
      Alert.alert('Delete Workout', 'Remove this workout day?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      ]);
    }
  };

  const updateWorkoutName = (workoutIndex: number, name: string) => {
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as EditableParsedData;
      next.workouts[workoutIndex].name = name;
      return next;
    });
  };

  const updateExerciseField = (
    workoutIndex: number,
    exerciseIndex: number,
    key: keyof EditableExercise,
    value: string
  ) => {
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as EditableParsedData;
      const ex = next.workouts[workoutIndex].exercises[exerciseIndex];
      if (key === 'sets' || key === 'restTime') {
        const n = Number(value);
        (ex as any)[key] = Number.isFinite(n) ? n : 0;
      } else {
        (ex as any)[key] = value;
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!program) return;

    for (const w of data.workouts) {
      for (const ex of w.exercises) {
        if (!String(ex.name || '').trim()) {
          const msg = 'Please fill in all exercise names before saving.';
          Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Missing exercise name', msg);
          return;
        }
      }
    }

    await updateProgram(program.id, {
      name: programName.trim() || program.name,
      description: programDescription.trim() || null,
      parsedData: data,
    });

    await upsertProgramTemplate({
      userId: program.userId,
      baseProgramId: program.id,
      name: programName.trim() || program.name,
      description: programDescription.trim() || null,
      parsedData: data,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSaved(true);
    setHasChanges(false);

    if (Platform.OS === 'web') {
      window.alert('Your program was saved!');
      router.back();
    } else {
      Alert.alert('Saved', 'Your program was saved.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  };

  const handleExport = async () => {
    if (!program) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const exportProgram = {
      ...program,
      parsedData: { workouts: data.workouts },
    };
    const success = await exportProgramToCSV(exportProgram as any);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // Section container for consistent styling
  const Section = ({ children, style }: { children: React.ReactNode; style?: any }) => (
    <View
      style={[
        styles.section,
        { backgroundColor: isDark ? colors.elevated : colors.card },
        style,
      ]}
    >
      {children}
    </View>
  );

  const headerRight = () => (
    <View style={styles.headerRight}>
      <Pressable onPress={handleExport} hitSlop={12}>
        <IconSymbol name="arrow.down.circle" size={22} color={colors.tint} />
      </Pressable>
      <Pressable onPress={handleSave} disabled={loading}>
        <ThemedText style={[styles.saveButton, { color: colors.tint }]}>Save</ThemedText>
      </Pressable>
    </View>
  );

  return (
    <Screen contentStyle={styles.screenContent} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Edit Program',
          headerBackTitle: 'My Programs',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.groupedBackground },
          headerRight,
        }}
      />

      {loading ? (
        <ThemedView style={styles.centered}>
          <ThemedText>Loading...</ThemedText>
        </ThemedView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* ═══════════════════════════════════════════════════════════════
              SECTION 1: PROGRAM INFO
              Psychology: Start with simple, low-effort fields to build momentum
          ═══════════════════════════════════════════════════════════════ */}
          <Section>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.tint + '15' }]}>
                <IconSymbol name="doc.text" size={16} color={colors.tint} />
              </View>
              <ThemedText style={styles.sectionHeaderText}>Program Info</ThemedText>
            </View>

            <View style={styles.fieldContainer}>
              <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                NAME
              </ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: colors.groupedBackground, borderColor: colors.separator }]}>
                <TextField
                  value={programName}
                  onChangeText={setProgramName}
                  placeholder="Program name"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                DESCRIPTION
              </ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: colors.groupedBackground, borderColor: colors.separator }]}>
                <TextField
                  value={programDescription}
                  onChangeText={setProgramDescription}
                  placeholder="Optional"
                  autoCapitalize="sentences"
                  autoCorrect
                />
              </View>
            </View>
          </Section>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 2: WORKOUTS
              Psychology: Show progress with count, make expansion obvious
          ═══════════════════════════════════════════════════════════════ */}
          <View style={styles.workoutsHeader}>
            <ThemedText style={[styles.workoutsLabel, { color: colors.textSecondary }]}>
              WORKOUTS
            </ThemedText>
            <View style={[styles.countBadge, { backgroundColor: colors.tint + '15' }]}>
              <ThemedText style={[styles.countText, { color: colors.tint }]}>
                {data.workouts.length}
              </ThemedText>
            </View>
          </View>

          {/* Workout Cards */}
          {data.workouts.map((w, wi) => {
            const isExpanded = expandedWorkout === wi;
            const exerciseCount = w.exercises.length;

            return (
              <Section key={`${w.week}-${w.day}-${wi}`} style={styles.workoutSection}>
                {/* ─────────────── Workout Header ─────────────── */}
                <Pressable
                  onPress={() => toggleWorkout(wi)}
                  style={({ pressed }) => [
                    styles.workoutHeader,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <View style={styles.workoutHeaderLeft}>
                    <View style={[styles.dayPill, { backgroundColor: colors.tint }]}>
                      <ThemedText style={styles.dayPillText}>
                        W{w.week}D{w.day}
                      </ThemedText>
                    </View>
                    <View style={styles.workoutInfo}>
                      <ThemedText style={styles.workoutTitle} numberOfLines={1}>
                        {w.name || `Day ${wi + 1}`}
                      </ThemedText>
                      <ThemedText style={[styles.exerciseCount, { color: colors.textSecondary }]}>
                        {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.workoutHeaderRight}>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        deleteWorkout(wi);
                      }}
                      hitSlop={12}
                      style={styles.deleteBtn}
                    >
                      <IconSymbol name="trash" size={16} color={StatusColors.error} />
                    </Pressable>
                    <IconSymbol
                      name={isExpanded ? 'chevron.up' : 'chevron.down'}
                      size={16}
                      color={colors.textSecondary}
                    />
                  </View>
                </Pressable>

                {/* ─────────────── Expanded Content ─────────────── */}
                {isExpanded && (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    style={[styles.expandedContent, { borderTopColor: colors.separator }]}
                  >
                    {/* Workout Name Input */}
                    <View style={styles.fieldContainer}>
                      <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                        WORKOUT NAME
                      </ThemedText>
                      <View style={[styles.inputWrapper, { backgroundColor: colors.groupedBackground, borderColor: colors.separator }]}>
                        <TextField
                          value={w.name || ''}
                          onChangeText={(val) => updateWorkoutName(wi, val)}
                          placeholder="e.g., Push Day"
                        />
                      </View>
                    </View>

                    {/* Exercise List */}
                    {w.exercises.map((ex, ei) => (
                      <View
                        key={`${wi}-${ei}`}
                        style={[styles.exerciseCard, { backgroundColor: colors.groupedBackground }]}
                      >
                        <View style={styles.exerciseCardHeader}>
                          <View style={[styles.exerciseNum, { backgroundColor: colors.tint }]}>
                            <ThemedText style={styles.exerciseNumText}>{ei + 1}</ThemedText>
                          </View>
                          <ThemedText style={styles.exerciseName} numberOfLines={1}>
                            {ex.name || 'Unnamed Exercise'}
                          </ThemedText>
                          <Pressable onPress={() => deleteExercise(wi, ei)} hitSlop={8}>
                            <IconSymbol name="xmark.circle.fill" size={20} color={colors.textTertiary} />
                          </Pressable>
                        </View>

                        <View style={styles.exerciseFields}>
                          <View style={styles.fieldCol}>
                            <ThemedText style={[styles.miniLabel, { color: colors.textTertiary }]}>Sets</ThemedText>
                            <View style={[styles.miniInput, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                              <TextField
                                value={String(ex.sets ?? '')}
                                onChangeText={(v) => updateExerciseField(wi, ei, 'sets', v)}
                                keyboardType="number-pad"
                                style={styles.miniInputText}
                              />
                            </View>
                          </View>
                          <View style={styles.fieldCol}>
                            <ThemedText style={[styles.miniLabel, { color: colors.textTertiary }]}>Reps</ThemedText>
                            <View style={[styles.miniInput, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                              <TextField
                                value={ex.reps ?? ''}
                                onChangeText={(v) => updateExerciseField(wi, ei, 'reps', v)}
                                placeholder="8-10"
                                style={styles.miniInputText}
                              />
                            </View>
                          </View>
                          <View style={[styles.fieldCol, { flex: 1.5 }]}>
                            <ThemedText style={[styles.miniLabel, { color: colors.textTertiary }]}>Weight</ThemedText>
                            <View style={[styles.miniInput, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                              <TextField
                                value={ex.weight ?? ''}
                                onChangeText={(v) => updateExerciseField(wi, ei, 'weight', v)}
                                placeholder="135 lbs"
                                style={styles.miniInputText}
                              />
                            </View>
                          </View>
                        </View>
                      </View>
                    ))}

                    {/* ─────────────── Add Exercise Buttons ─────────────── */}
                    <View style={styles.addExerciseContainer}>
                      <ThemedText style={[styles.addExerciseHint, { color: colors.textSecondary }]}>
                        Add exercises
                      </ThemedText>
                      <View style={styles.addExerciseButtons}>
                        {/* Browse Button */}
                        <Pressable
                          style={({ pressed }) => [
                            styles.actionButton,
                            styles.browseButton,
                            { backgroundColor: colors.tint, opacity: pressed ? 0.85 : 1 },
                          ]}
                          onPress={() => openExercisePicker(wi)}
                        >
                          <IconSymbol name="magnifyingglass" size={16} color="#fff" />
                          <ThemedText style={styles.actionButtonTextLight}>Browse</ThemedText>
                        </Pressable>

                        {/* Voice Button - REPLACED Custom */}
                        <Pressable
                          style={({ pressed }) => [
                            styles.actionButton,
                            styles.voiceButton,
                            {
                              backgroundColor: isDark ? colors.elevated : colors.card,
                              borderColor: colors.tint,
                              opacity: pressed ? 0.85 : 1
                            },
                          ]}
                          onPress={() => openVoiceInput(wi)}
                        >
                          <IconSymbol name="mic.fill" size={16} color={colors.tint} />
                          <ThemedText style={[styles.actionButtonText, { color: colors.tint }]}>
                            Voice
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  </Animated.View>
                )}
              </Section>
            );
          })}

          {/* ═══════════════════════════════════════════════════════════════
              ADD WORKOUT BUTTON
              Psychology: Clear affordance, dashed border = "add here"
          ═══════════════════════════════════════════════════════════════ */}
          <Pressable
            style={({ pressed }) => [
              styles.addWorkoutBtn,
              { borderColor: colors.tint, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={addWorkout}
          >
            <IconSymbol name="plus.circle.fill" size={20} color={colors.tint} />
            <ThemedText style={[styles.addWorkoutText, { color: colors.tint }]}>
              Add Workout Day
            </ThemedText>
          </Pressable>

          {/* Bottom spacer */}
          <View style={{ height: SPACE.xl }} />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 0,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  saveButton: {
    ...Typography.body,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: SPACE.md,
    paddingTop: SPACE.md,
    gap: SPACE.md,
  },

  // Section Container - consistent for all cards
  section: {
    borderRadius: Radius.lg,
    padding: SPACE.md,
    gap: SPACE.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: {
    ...Typography.headline,
    fontWeight: '700',
  },

  // Field Styles - consistent inputs
  fieldContainer: {
    gap: SPACE.xs,
  },
  fieldLabel: {
    ...Typography.caption1,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginLeft: SPACE.xs,
  },
  inputWrapper: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  textInput: {
    ...Typography.body,
    paddingHorizontal: SPACE.sm + 4,
    paddingVertical: SPACE.sm + 2,
  },

  // Workouts Header
  workoutsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.xs,
    marginTop: SPACE.sm,
  },
  workoutsLabel: {
    ...Typography.caption1,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  countBadge: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderRadius: Radius.full,
  },
  countText: {
    ...Typography.caption2,
    fontWeight: '700',
  },

  // Workout Card
  workoutSection: {
    padding: 0,
    overflow: 'hidden',
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACE.md,
  },
  workoutHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    flex: 1,
  },
  dayPill: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderRadius: Radius.sm,
  },
  dayPillText: {
    color: '#fff',
    ...Typography.caption2,
    fontWeight: '700',
  },
  workoutInfo: {
    flex: 1,
    gap: 2,
  },
  workoutTitle: {
    ...Typography.body,
    fontWeight: '600',
  },
  exerciseCount: {
    ...Typography.caption1,
  },
  workoutHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  deleteBtn: {
    padding: SPACE.xs,
  },

  // Expanded Content
  expandedContent: {
    padding: SPACE.md,
    paddingTop: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: SPACE.md,
  },

  // Exercise Card
  exerciseCard: {
    borderRadius: Radius.md,
    padding: SPACE.sm + 4,
    gap: SPACE.sm,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  exerciseNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNumText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseName: {
    ...Typography.body,
    fontWeight: '500',
    flex: 1,
  },
  exerciseFields: {
    flexDirection: 'row',
    gap: SPACE.sm,
  },
  fieldCol: {
    flex: 1,
    gap: SPACE.xs,
  },
  miniLabel: {
    ...Typography.caption2,
    marginLeft: 2,
  },
  miniInput: {
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  miniInputText: {
    fontSize: 14,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs + 2,
  },

  // Add Exercise
  addExerciseContainer: {
    gap: SPACE.sm,
    marginTop: SPACE.xs,
  },
  addExerciseHint: {
    ...Typography.caption1,
    textAlign: 'center',
  },
  addExerciseButtons: {
    flexDirection: 'row',
    gap: SPACE.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    paddingVertical: SPACE.sm + 4,
    borderRadius: Radius.md,
  },
  browseButton: {
    // Filled primary style
  },
  voiceButton: {
    borderWidth: 1.5,
  },
  actionButtonTextLight: {
    color: '#fff',
    ...Typography.subhead,
    fontWeight: '600',
  },
  actionButtonText: {
    ...Typography.subhead,
    fontWeight: '600',
  },

  // Add Workout Button
  addWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    paddingVertical: SPACE.md,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  addWorkoutText: {
    ...Typography.subhead,
    fontWeight: '600',
  },
});
