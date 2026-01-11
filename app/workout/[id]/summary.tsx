import { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  View,
  Animated,
  Modal,
  TouchableWithoutFeedback,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/screen';
import { Colors, Radius, Spacing, Shadows, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  clearActiveWorkoutState,
  clearPendingWorkoutEdits,
  createProgram,
  getActiveWorkoutState,
  getEffectiveProgramData,
  getPendingWorkoutEdits,
  getProgram,
  markWorkoutCompleted,
  saveWorkoutToHistory,
  upsertProgramTemplate,
  type UnifiedWorkoutRecord,
} from '@/lib/db/storage';

type Difficulty = 'easy' | 'moderate' | 'challenging' | 'very_hard';

const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', icon: 'checkmark.circle' as const, color: '#30D158' },
  moderate: { label: 'Good', icon: 'figure.run' as const, color: '#0A84FF' },
  challenging: { label: 'Hard', icon: 'flame.fill' as const, color: '#FF9F0A' },
  very_hard: { label: 'Brutal', icon: 'exclamationmark.triangle' as const, color: '#FF453A' },
};

export default function WorkoutSummaryScreen() {
  const { id, week, day, duration } = useLocalSearchParams();
  const workoutWeek = week ? parseInt(week as string) : undefined;
  const workoutDay = day ? parseInt(day as string) : undefined;
  const workoutDuration = duration ? parseInt(duration as string) : 0;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [notes, setNotes] = useState('');
  const [templateEdits, setTemplateEdits] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isQuickWorkout, setIsQuickWorkout] = useState(false);
  const [workoutExercises, setWorkoutExercises] = useState<any[]>([]);
  const [actualSessionData, setActualSessionData] = useState<any | null>(null);

  // Animations
  const checkScale = useRef(new Animated.Value(0)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Celebratory animation sequence
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    Animated.sequence([
      Animated.spring(checkScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(statsOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    (async () => {
      const program = await getProgram(String(id));
      if (!program) return;

      // Check if this is a quick workout
      const isQuick = (program as any).isQuickWorkout === true;
      setIsQuickWorkout(isQuick);

      // Get the ACTUAL workout session data (before it gets cleared)
      const activeState = await getActiveWorkoutState(program.userId, program.id);
      if (activeState?.session) {
        setActualSessionData(activeState.session);
      }

      // Get the workout exercises (template data as fallback)
      const effectiveData = await getEffectiveProgramData(program);
      const parsedData = typeof effectiveData === 'string' ? JSON.parse(effectiveData) : effectiveData;
      const workout = parsedData?.workouts?.find((w: any) =>
        w.week === workoutWeek && w.day === workoutDay
      );
      if (workout?.exercises) {
        setWorkoutExercises(workout.exercises);
        setTemplateName(workout.name || program.name);
      }

      const edits = await getPendingWorkoutEdits(program.userId, program.id);
      setTemplateEdits(edits);
    })();
  }, [id, workoutWeek, workoutDay]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);

    const program = await getProgram(String(id));
    if (program) {
      if (workoutWeek !== undefined && workoutDay !== undefined) {
        await markWorkoutCompleted(program.id, workoutWeek, workoutDay, workoutDuration);
      }

      // Save to unified history with ACTUAL workout data
      try {
        // Use actual session data if available, otherwise fall back to template
        const exerciseSource = actualSessionData?.exercises || workoutExercises;
        let totalVolume = 0;

        const historyExercises = exerciseSource.map((ex: any) => {
          // Check if this is actual session data (has sets array with isCompleted)
          const isActualData = ex.sets && Array.isArray(ex.sets) && ex.sets[0]?.hasOwnProperty('isCompleted');

          if (isActualData) {
            // Use actual completed data
            const completedSets = ex.sets.filter((s: any) => s.isCompleted);
            const setsWithData = ex.sets.map((s: any) => ({
              reps: s.actualReps || (typeof s.reps === 'number' ? s.reps : parseInt(s.reps) || 0),
              weight: s.actualWeight || s.weight || 0,
              isCompleted: s.isCompleted || false,
            }));

            // Calculate best set (highest weight, or highest reps if no weight)
            let bestSet = { reps: 0, weight: undefined as number | undefined };
            completedSets.forEach((s: any) => {
              const reps = s.actualReps || (typeof s.reps === 'number' ? s.reps : parseInt(s.reps) || 0);
              const weight = s.actualWeight || s.weight;
              if (weight && (!bestSet.weight || weight > bestSet.weight)) {
                bestSet = { reps, weight };
              } else if (!weight && reps > bestSet.reps) {
                bestSet = { reps, weight: undefined };
              }
              // Add to total volume
              if (weight && reps) {
                totalVolume += weight * reps;
              }
            });

            return {
              name: ex.name,
              setsCompleted: completedSets.length,
              totalSets: ex.sets.length,
              bestSet: bestSet.reps > 0 ? bestSet : undefined,
              sets: setsWithData,
            };
          } else {
            // Fallback to template data
            return {
              name: ex.name,
              setsCompleted: ex.sets || 3,
              totalSets: ex.sets || 3,
              bestSet: { reps: parseInt(ex.reps) || 10, weight: undefined },
            };
          }
        });

        await saveWorkoutToHistory({
          type: isQuickWorkout ? 'quick' : 'program',
          programId: isQuickWorkout ? undefined : program.id,
          programName: isQuickWorkout ? undefined : program.name,
          workoutName: templateName || program.name,
          week: workoutWeek,
          day: workoutDay,
          completedAt: new Date().toISOString(),
          durationSeconds: workoutDuration,
          exercises: historyExercises,
          userId: program.userId,
          difficulty: difficulty || undefined,
          notes: notes.trim() || undefined,
          totalVolume: totalVolume > 0 ? totalVolume : undefined,
        });
      } catch (historyError) {
        console.error('Error saving to history:', historyError);
      }

      await clearActiveWorkoutState(program.userId, program.id);
      await clearPendingWorkoutEdits(program.userId, program.id);

      // For quick workouts, optionally delete the temporary program
      if (isQuickWorkout) {
        try {
          const programs = await AsyncStorage.getItem('@workout_programs');
          if (programs) {
            const list = JSON.parse(programs);
            const filtered = list.filter((p: any) => p.id !== program.id);
            await AsyncStorage.setItem('@workout_programs', JSON.stringify(filtered));
          }
        } catch (e) {
          console.error('Error cleaning up quick workout:', e);
        }
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push('/');
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      const msg = 'Please enter a name for your program.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Name Required', msg);
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Create a new program with these exercises
      const newProgram = await createProgram(templateName.trim(), 'Saved from workout');

      // Update the program with exercises
      const parsedData = {
        workouts: [
          {
            week: 1,
            day: 1,
            name: templateName.trim(),
            exercises: workoutExercises.map((ex: any, idx: number) => ({
              name: ex.name,
              sets: ex.sets || 3,
              reps: ex.reps || '8-12',
              restTime: ex.restTime || 90,
              notes: ex.notes || '',
              order: idx,
            })),
            order: 0,
          },
        ],
      };

      const programs = await AsyncStorage.getItem('@workout_programs');
      if (programs) {
        const list = JSON.parse(programs);
        const index = list.findIndex((p: any) => p.id === newProgram.id);
        if (index !== -1) {
          list[index].parsedData = parsedData;
          await AsyncStorage.setItem('@workout_programs', JSON.stringify(list));
        }
      }

      setShowSaveAsTemplate(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const msg = `"${templateName.trim()}" has been saved to My Programs.`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Saved!', msg);
    } catch (error) {
      console.error('Error saving as template:', error);
      const msg = 'Failed to save program.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    }
  };

  const handleDiscard = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const program = await getProgram(String(id));
    if (program) {
      await clearActiveWorkoutState(program.userId, program.id);
      await clearPendingWorkoutEdits(program.userId, program.id);
    }
    router.push('/');
  };

  const applyEditsToTemplate = async () => {
    const program = await getProgram(String(id));
    if (!program || !templateEdits) return;
    await upsertProgramTemplate({
      userId: program.userId,
      baseProgramId: program.id,
      name: program.name,
      description: program.description,
      parsedData: templateEdits,
    });
    await clearPendingWorkoutEdits(program.userId, program.id);
    setTemplateEdits(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <Screen contentStyle={styles.screenContent} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: '',
          headerBackVisible: false,
          headerShadowVisible: false,
          headerTransparent: true,
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Celebration Hero */}
        <View style={[styles.hero, { backgroundColor: colors.tint + '10' }]}>
          <Animated.View style={[styles.checkCircle, { backgroundColor: colors.tint, transform: [{ scale: checkScale }] }]}>
            <IconSymbol name="checkmark" size={48} color="#fff" />
          </Animated.View>
          <ThemedText style={[styles.heroTitle, { color: colors.text }]}>Workout Complete!</ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            {workoutWeek && workoutDay ? `Week ${workoutWeek} • Day ${workoutDay}` : 'Great session'}
          </ThemedText>
        </View>

        {/* Stats Cards */}
        <Animated.View style={[styles.statsRow, { opacity: statsOpacity }]}>
          <StatCard 
            icon="timer" 
            value={formatDuration(workoutDuration)} 
            label="Duration" 
            color="#0A84FF"
            colors={colors}
          />
          <StatCard 
            icon="flame.fill" 
            value={`~${Math.round(workoutDuration * 0.1)}`} 
            label="Calories" 
            color="#FF9F0A"
            colors={colors}
          />
        </Animated.View>

        <Animated.View style={{ transform: [{ translateY: contentTranslateY }], opacity: statsOpacity }}>
          {/* Difficulty Rating */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>HOW DID IT FEEL?</ThemedText>
            <View style={styles.difficultyRow}>
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((key) => {
                const config = DIFFICULTY_CONFIG[key];
                const isSelected = difficulty === key;
                return (
                  <Pressable
                    key={key}
                    style={[
                      styles.difficultyChip,
                      { 
                        backgroundColor: isSelected ? config.color + '20' : colors.card,
                        borderColor: isSelected ? config.color : colors.separator,
                      },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setDifficulty(key);
                    }}
                  >
                    <IconSymbol name={config.icon} size={20} color={isSelected ? config.color : colors.textTertiary} />
                    <ThemedText style={[styles.difficultyText, { color: isSelected ? config.color : colors.textSecondary }]}>
                      {config.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>NOTES</ThemedText>
            <TextInput
              style={[
                styles.notesInput,
                { backgroundColor: colors.card, borderColor: colors.separator, color: colors.text },
              ]}
              placeholder="How did you feel? Any observations?"
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
              textAlignVertical="top"
            />
          </View>

          {/* Template Edits */}
          {templateEdits && (
            <View style={styles.section}>
              <View style={[styles.templateCard, { backgroundColor: colors.tintMuted, borderColor: colors.tint + '30' }]}>
                <View style={styles.templateHeader}>
                  <IconSymbol name="pencil" size={18} color={colors.tint} />
                  <ThemedText style={[styles.templateTitle, { color: colors.tint }]}>Template Changes</ThemedText>
                </View>
                <ThemedText style={[styles.templateDesc, { color: colors.textSecondary }]}>
                  You made changes during the workout. Save them to your program?
                </ThemedText>
                <View style={styles.templateActions}>
                  <Pressable
                    style={[styles.templateButton, { borderColor: colors.separator }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTemplateEdits(null);
                    }}
                  >
                    <ThemedText style={[styles.templateButtonText, { color: colors.textSecondary }]}>Discard</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.templateButton, styles.templateButtonPrimary, { backgroundColor: colors.tint }]}
                    onPress={applyEditsToTemplate}
                  >
                    <ThemedText style={[styles.templateButtonText, { color: '#fff' }]}>Save Changes</ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* Save as Template (for quick workouts) */}
          {isQuickWorkout && workoutExercises.length > 0 && (
            <View style={styles.section}>
              <Pressable
                style={[styles.saveAsTemplateButton, { backgroundColor: colors.card, borderColor: colors.separator }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowSaveAsTemplate(true);
                }}
              >
                <IconSymbol name="doc.badge.plus" size={20} color={colors.tint} />
                <View style={styles.saveAsTemplateText}>
                  <ThemedText style={[styles.saveAsTemplateTitle, { color: colors.text }]}>
                    Save as Program
                  </ThemedText>
                  <ThemedText style={[styles.saveAsTemplateDesc, { color: colors.textSecondary }]}>
                    Reuse this workout in the future
                  </ThemedText>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
              </Pressable>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Footer Actions */}
      <View style={[styles.footer, { backgroundColor: colors.glassBackground, borderTopColor: colors.separator, paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <Pressable
          style={({ pressed }) => [
            styles.discardButton,
            { borderColor: colors.separator, opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={handleDiscard}
        >
          <ThemedText style={[styles.discardButtonText, { color: colors.textSecondary }]}>Discard</ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: colors.tint, transform: [{ scale: pressed ? 0.98 : 1 }] },
            saving && { opacity: 0.7 },
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          <IconSymbol name="checkmark" size={18} color="#fff" />
          <ThemedText style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Workout'}</ThemedText>
        </Pressable>
      </View>

      {/* Save as Template Modal */}
      <Modal
        visible={showSaveAsTemplate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveAsTemplate(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowSaveAsTemplate(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
                  Save as Program
                </ThemedText>
                <ThemedText style={[styles.modalDesc, { color: colors.textSecondary }]}>
                  Give your workout a name to save it for future use.
                </ThemedText>
                <TextInput
                  style={[
                    styles.modalInput,
                    { backgroundColor: colors.groupedBackground, borderColor: colors.separator, color: colors.text },
                  ]}
                  placeholder="Program name"
                  placeholderTextColor={colors.textTertiary}
                  value={templateName}
                  onChangeText={setTemplateName}
                  autoFocus
                />
                <View style={styles.modalActions}>
                  <Pressable
                    style={[styles.modalButton, { borderColor: colors.separator }]}
                    onPress={() => setShowSaveAsTemplate(false)}
                  >
                    <ThemedText style={[styles.modalButtonText, { color: colors.textSecondary }]}>
                      Cancel
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: colors.tint }]}
                    onPress={handleSaveAsTemplate}
                  >
                    <ThemedText style={[styles.modalButtonText, { color: '#fff' }]}>
                      Save
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Screen>
  );
}

function StatCard({ icon, value, label, color, colors }: { icon: any; value: string; label: string; color: string; colors: any }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.separator }, Shadows.sm]}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <IconSymbol name={icon} size={22} color={color} />
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
  content: {
    paddingBottom: 120,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 100,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  heroTitle: {
    ...Typography.largeTitle,
  },
  heroSubtitle: {
    ...Typography.body,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: -Spacing.md,
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
    width: 44,
    height: 44,
    borderRadius: 12,
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
  sectionTitle: {
    ...Typography.caption1,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  difficultyChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  difficultyText: {
    ...Typography.caption1,
    fontWeight: '600',
  },
  notesInput: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    ...Typography.body,
    minHeight: 100,
  },
  templateCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  templateTitle: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  templateDesc: {
    ...Typography.footnote,
  },
  templateActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  templateButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  templateButtonPrimary: {
    borderWidth: 0,
  },
  templateButtonText: {
    ...Typography.footnote,
    fontWeight: '600',
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
  discardButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  discardButtonText: {
    ...Typography.headline,
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.lg,
  },
  saveButtonText: {
    ...Typography.headline,
    color: '#fff',
  },
  // Save as Template styles
  saveAsTemplateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  saveAsTemplateText: {
    flex: 1,
    gap: 2,
  },
  saveAsTemplateTitle: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  saveAsTemplateDesc: {
    ...Typography.caption1,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalTitle: {
    ...Typography.title3,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalDesc: {
    ...Typography.body,
    textAlign: 'center',
  },
  modalInput: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    ...Typography.body,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  modalButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalButtonPrimary: {
    borderWidth: 0,
  },
  modalButtonText: {
    ...Typography.headline,
    fontWeight: '600',
  },
});
