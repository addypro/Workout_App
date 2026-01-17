import { GymBusynessPrompt } from '@/components/gym/gym-busyness-prompt';
import { PathProgressCard } from '@/components/paths/PathProgressCard';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PRCelebration } from '@/components/workout/pr-celebration';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserId } from '@/lib/context/auth-context';
import { usePreferences } from '@/lib/context/preferences-context';
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
  upsertProgramTemplate
} from '@/lib/db/storage';
import { completeWorkout } from '@/lib/services/coach';
import { getCachedWorkoutById, isOnline, queueWorkoutCompletion, startNetworkMonitoring } from '@/lib/services/offline/workout-cache';
import { invalidateStatsCache } from '@/lib/services/stats';
import { detectPRsLocal, type DetectedPR } from '@/lib/services/workout/pr-detector-local';
import { supabase } from '@/lib/supabase/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Difficulty = 'easy' | 'moderate' | 'challenging' | 'very_hard';

const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', icon: 'checkmark.circle' as const, color: '#30D158' },
  moderate: { label: 'Good', icon: 'figure.run' as const, color: '#0A84FF' },
  challenging: { label: 'Hard', icon: 'flame.fill' as const, color: '#FF9F0A' },
  very_hard: { label: 'Brutal', icon: 'exclamationmark.triangle' as const, color: '#FF453A' },
};

export default function WorkoutSummaryScreen() {
  const { id, week, day, duration, source, workoutId } = useLocalSearchParams();
  const workoutWeek = week ? parseInt(week as string) : undefined;
  const workoutDay = day ? parseInt(day as string) : undefined;
  const workoutDuration = duration ? parseInt(duration as string) : 0;
  const sourceParam = Array.isArray(source) ? source[0] : source;
  const workoutIdParam = Array.isArray(workoutId) ? workoutId[0] : workoutId;
  const isAssignedWorkout = sourceParam === 'assigned';
  const assignedWorkoutId = isAssignedWorkout ? (workoutIdParam ?? String(id)) : undefined;
  const workoutKey = assignedWorkoutId ?? String(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { homeGym } = usePreferences();
  const userId = useUserId();

  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [notes, setNotes] = useState('');
  const [templateEdits, setTemplateEdits] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isQuickWorkout, setIsQuickWorkout] = useState(false);
  const [workoutExercises, setWorkoutExercises] = useState<any[]>([]);
  const [actualSessionData, setActualSessionData] = useState<any | null>(null);
  const [detectedPRs, setDetectedPRs] = useState<DetectedPR[]>([]);
  const [pathProgress, setPathProgress] = useState<{ xpGained: number; nodesCompleted: string[] } | null>(null);
  const prSound = useAudioPlayer('https://cdn.freesound.org/previews/411/411089_5121236-lq.mp3');

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
      if (isAssignedWorkout) {
        setIsQuickWorkout(false);
        const source = isAssignedWorkout ? 'assigned' : 'self';
        const activeState = await getActiveWorkoutState(userId, source, workoutKey);
        if (activeState?.session) {
          setActualSessionData(activeState.session);
          try {
            const prs = await detectPRsLocal(activeState.session, userId);
            if (prs.length > 0) {
              setDetectedPRs(prs);
            }
          } catch (prError) {
            console.log('[Summary] PR detection error:', prError);
          }
        }

        let assignedWorkout = await getCachedWorkoutById(workoutKey);
        if (!assignedWorkout) {
          const { data, error } = await supabase
            .from('assigned_workouts')
            .select('*')
            .eq('id', workoutKey)
            .single();
          if (!error && data) {
            assignedWorkout = {
              id: data.id,
              assignmentId: (data.assignment_id as string) || '',
              athleteUserId: (data.athlete_user_id as string) || userId,
              scheduledDate: new Date(data.scheduled_date as string),
              scheduledAt: data.scheduled_at ? new Date(data.scheduled_at as string) : undefined,
              scheduledTime: data.scheduled_time ? new Date(data.scheduled_time as string) : undefined,
              weekNumber: (data.week_number as number) || 1,
              dayNumber: (data.day_number as number) || 1,
              workoutName: (data.workout_name as string) || 'Assigned Workout',
              exercises: typeof data.exercises === 'string' ? JSON.parse(data.exercises) : (data.exercises as any[] || []),
              status: (data.status as any) || 'pending',
              startedAt: data.started_at ? new Date(data.started_at as string) : undefined,
              completedAt: data.completed_at ? new Date(data.completed_at as string) : undefined,
              skippedReasonCode: data.skipped_reason_code as string | undefined,
              skippedReasonText: data.skipped_reason_text as string | undefined,
              skippedAt: data.skipped_at ? new Date(data.skipped_at as string) : undefined,
              actualResults: (data.actual_results as Record<string, unknown>) || {},
              athleteFeedback: data.athlete_feedback as string | undefined,
              athleteRating: data.athlete_rating as number | undefined,
              coachFeedback: data.coach_feedback as string | undefined,
              reminderSent: data.reminder_sent as boolean | undefined,
              incompleteNotificationSent: data.incomplete_notification_sent as boolean | undefined,
              createdAt: data.created_at ? new Date(data.created_at as string) : new Date(),
              updatedAt: data.updated_at ? new Date(data.updated_at as string) : new Date(),
            };
          }
        }

        if (assignedWorkout?.exercises) {
          setWorkoutExercises(assignedWorkout.exercises as any[]);
          setTemplateName(assignedWorkout.workoutName || 'Assigned Workout');
        }

        return;
      }

      const program = await getProgram(String(id));
      if (!program) return;

      // Check if this is a quick workout
      const isQuick = (program as any).isQuickWorkout === true;
      setIsQuickWorkout(isQuick);

      // Get the ACTUAL workout session data (before it gets cleared)
      const activeState = await getActiveWorkoutState(program.userId, 'self', program.id);
      if (activeState?.session) {
        setActualSessionData(activeState.session);

        // Detect PRs from this workout
        try {
          const prs = await detectPRsLocal(activeState.session, program.userId);
          if (prs.length > 0) {
            setDetectedPRs(prs);
          }
        } catch (prError) {
          console.log('[Summary] PR detection error:', prError);
        }
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
  }, [id, workoutWeek, workoutDay, isAssignedWorkout, assignedWorkoutId, userId]);

  useEffect(() => {
    if (detectedPRs.length === 0) return;
    try {
      prSound?.seekTo(0);
      prSound?.play();
    } catch {
      // Ignore audio errors
    }
  }, [detectedPRs.length, prSound]);

  // Load path progress from cache (set by handler after workout completion)
  useEffect(() => {
    (async () => {
      try {
        const { getLastResultForWorkout } = await import('@/lib/services/offline/paths-cache');
        const result = await getLastResultForWorkout(
          isAssignedWorkout ? workoutKey : String(id),
          isAssignedWorkout ? 'assigned' : undefined
        );
        if (result) {
          setPathProgress({
            xpGained: result.xpGained,
            nodesCompleted: result.nodesCompleted,
          });
        }
      } catch (error) {
        console.log('[Summary] Path progress load error:', error);
      }
    })();
  }, [id, isAssignedWorkout, workoutKey]);

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

    const assignedKey = isAssignedWorkout ? workoutKey : undefined;
    const program = isAssignedWorkout ? null : await getProgram(String(id));
    if (!isAssignedWorkout && !program) {
      setSaving(false);
      return;
    }

    if (!isAssignedWorkout && workoutWeek !== undefined && workoutDay !== undefined && program) {
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
            setType: s.setType,
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
        }
        // Fallback to template data
        return {
          name: ex.name,
          setsCompleted: ex.sets || 3,
          totalSets: ex.sets || 3,
          bestSet: { reps: parseInt(ex.reps) || 10, weight: undefined },
        };
      });

      const buildAssignedResults = () => {
        if (actualSessionData?.exercises?.length) {
          return {
            exercises: actualSessionData.exercises.map((ex: any) => ({
              exerciseName: ex.name,
              sets: ex.sets.map((s: any) => ({
                weight: s.actualWeight ?? s.weight,
                reps: s.actualReps ?? s.reps,
                completed: s.isCompleted ?? false,
              })),
            })),
          };
        }

        return {
          exercises: historyExercises.map((ex: { name: string; sets?: Array<{ weight?: number; reps?: number; isCompleted?: boolean }> }) => ({
            exerciseName: ex.name,
            sets: (ex.sets || []).map((s: { weight?: number; reps?: number; isCompleted?: boolean }) => ({
              weight: s.weight,
              reps: s.reps,
              completed: s.isCompleted ?? true,
            })),
          })),
        };
      };

      if (isAssignedWorkout && assignedKey) {
        const feedback = notes.trim() || undefined;
        const rating = difficulty
          ? { easy: 5, moderate: 4, challenging: 3, very_hard: 2 }[difficulty]
          : undefined;
        const resultsPayload = buildAssignedResults();
        const completedAt = new Date();
        let needsLocalPaths = false;

        try {
          const online = await isOnline();
          if (online) {
            const completion = await completeWorkout(assignedKey, resultsPayload, feedback, rating);
            if (!completion.success) {
              await queueWorkoutCompletion(assignedKey, resultsPayload, feedback, rating);
              needsLocalPaths = true;
            }
          } else {
            await queueWorkoutCompletion(assignedKey, resultsPayload, feedback, rating);
            needsLocalPaths = true;
          }
        } catch (completionError) {
          console.warn('[Summary] Assigned completion error:', completionError);
          await queueWorkoutCompletion(assignedKey, resultsPayload, feedback, rating);
          needsLocalPaths = true;
        }

        if (needsLocalPaths) {
          try {
            const { buildWorkoutCompletedEvent, handleWorkoutCompleted } = await import('@/lib/services/paths/handle-workout-completed');
            const pathExercises = (resultsPayload as { exercises?: Array<{ exerciseName: string; sets: Array<{ weight?: number; reps?: number; completed?: boolean }> }> }).exercises ?? [];
            const event = buildWorkoutCompletedEvent({
              userId,
              workoutId: assignedKey,
              source: 'assigned',
              originTable: 'assigned_workouts',
              completedAt,
              exercises: pathExercises.map(ex => ({
                name: ex.exerciseName,
                sets: ex.sets.map(s => ({
                  weight: s.weight,
                  reps: s.reps,
                  isCompleted: s.completed ?? true,
                })),
              })),
            });
            await handleWorkoutCompleted(event);
          } catch (pathsError) {
            console.warn('[Summary] Assigned paths processing failed:', pathsError);
          }
        }

        startNetworkMonitoring(completeWorkout);
      }

      const savedRecord = await saveWorkoutToHistory({
        type: isQuickWorkout ? 'quick' : 'program',
        source: isAssignedWorkout ? 'assigned' : 'self',
        externalWorkoutId: assignedKey ?? undefined,
        programId: isAssignedWorkout || isQuickWorkout ? undefined : program!.id,
        programName: isAssignedWorkout || isQuickWorkout ? undefined : program!.name,
        workoutName: templateName || program?.name || 'Workout',
        week: workoutWeek,
        day: workoutDay,
        completedAt: new Date().toISOString(),
        durationSeconds: workoutDuration,
        exercises: historyExercises,
        userId: isAssignedWorkout ? userId : program!.userId,
        difficulty: difficulty || undefined,
        notes: notes.trim() || undefined,
        totalVolume: totalVolume > 0 ? totalVolume : undefined,
        gymId: homeGym?.id,
        gymName: homeGym?.name,
      });

      // Load path progress from cache after sync completes
      // The sync and path handler run async, so we poll for the result
      try {
        const progressKey = isAssignedWorkout ? (assignedKey ?? savedRecord.id) : savedRecord.id;
        const progressSource = isAssignedWorkout ? 'assigned' : 'self';
        console.log('[Summary] Loading path progress, key:', progressKey, progressSource);
        const { getLastResultForWorkout } = await import('@/lib/services/offline/paths-cache');

        // Poll for up to 3 seconds (handler runs async)
        let result = null;
        for (let i = 0; i < 15; i++) {
          await new Promise(resolve => setTimeout(resolve, 200));
          result = await getLastResultForWorkout(progressKey, progressSource);
          if (result && result.xpGained > 0) {
            console.log('[Summary] Found path progress on attempt', i + 1);
            break;
          }
        }

        console.log('[Summary] Path progress result:', result);
        if (result && (result.xpGained > 0 || result.nodesCompleted.length > 0)) {
          console.log('[Summary] Setting path progress:', result.xpGained, result.nodesCompleted);
          setPathProgress({
            xpGained: result.xpGained,
            nodesCompleted: result.nodesCompleted,
          });
          // Give user a moment to see the XP
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.log('[Summary] No path progress found after polling');
        }
      } catch (e) {
        console.log('[Summary] Path progress post-save load error:', e);
      }

      // Invalidate stats cache so Stats tab shows fresh data
      invalidateStatsCache();
    } catch (historyError) {
      console.error('Error saving to history:', historyError);
    }

    if (isAssignedWorkout) {
      await clearActiveWorkoutState(userId, 'assigned', workoutKey);
    } else if (program) {
      await clearActiveWorkoutState(program.userId, 'self', program.id);
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
    router.replace('/(tabs)');
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
              reps: ex.reps || '8',
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
    if (isAssignedWorkout) {
      await clearActiveWorkoutState(userId, 'assigned', workoutKey);
    } else {
      const program = await getProgram(String(id));
      if (program) {
        await clearActiveWorkoutState(program.userId, 'self', program.id);
        await clearPendingWorkoutEdits(program.userId, program.id);
      }
    }
    router.replace('/(tabs)');
  };

  const applyEditsToTemplate = async () => {
    if (isAssignedWorkout) return;
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

        {/* PR Celebration */}
        {detectedPRs.length > 0 && (
          <View style={styles.section}>
            <PRCelebration prs={detectedPRs} />
          </View>
        )}

        {/* Gym Busyness Report - only if user has home gym */}
        {homeGym && (
          <GymBusynessPrompt
            gymId={homeGym.id}
            gymName={homeGym.name}
            colors={colors}
          />
        )}

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

        {/* Path Progress Card */}
        {pathProgress && pathProgress.xpGained > 0 && (
          <View style={styles.section}>
            <PathProgressCard
              xpGained={pathProgress.xpGained}
              nodesCompleted={pathProgress.nodesCompleted}
            />
          </View>
        )}

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
