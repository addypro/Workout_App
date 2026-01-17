/**
 * Quick Workout Screen
 *
 * Build a one-off workout by selecting exercises from the database.
 * After adding exercises, tap "Start Workout" to begin execution.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { VoiceLoggingModal } from '@/components/voice';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isFeatureEnabled } from '@/lib/config/feature-flags';
import { createProgram, saveWorkoutTemplate, updateProgram } from '@/lib/db/storage';
import { resolveExerciseName } from '@/lib/services/exercise/resolver';
import { searchExercisesEnhanced } from '@/lib/services/exercise/search';
import type { ExtractedExercise } from '@/lib/services/voice/direct-intent-types';

const SELECTED_EXERCISE_KEY = '@selected_exercise_temp';
const QUICK_WORKOUT_KEY = '@quick_workout_exercises';
const VOICE_MATCH_CONFIRMATIONS_KEY = '@voice_match_confirmations_v1';

interface QuickExercise {
  name: string;
  rawName?: string; // Original name from voice/input
  sets: number;
  reps: string;
  weight?: number; // Weight if specified (default for all sets)
  weightUnit?: 'lbs' | 'kg'; // Weight unit
  restTime: number;
  muscles?: string[];
  equipment?: string[];
  lowConfidence?: boolean; // True if match confidence < 80%, shows disambiguation UI
  confidenceScore?: number; // 0-100 confidence score
  isCustom?: boolean; // True if user created a custom exercise
  alternatives?: {
    name: string;
    confidence: 'exact' | 'high' | 'medium' | 'low';
    score: number;
  }[];
  // Per-set details for variable weights/reps across sets
  perSetDetails?: {
    reps: string;
    weight?: number;
  }[];
}

type VoiceMatchConfirmations = Record<string, string>;

function normalizeMatchKey(name: string): string {
  return name.toLowerCase().trim();
}

export default function QuickWorkoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const useVoiceFirst = isFeatureEnabled('voice_first');

  const [exercises, setExercises] = useState<QuickExercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [processingVoice, setProcessingVoice] = useState(false); // Shows after 800ms delay
  const confirmedMatchesRef = useRef<VoiceMatchConfirmations>({});

  // Track if component is mounted for async operations
  const isMountedRef = useRef(true);

  // Load exercises from storage on mount
  useEffect(() => {
    isMountedRef.current = true;

    const loadFromStorage = async () => {
      try {
        const saved = await AsyncStorage.getItem(QUICK_WORKOUT_KEY);
        if (saved && isMountedRef.current) {
          setExercises(JSON.parse(saved));
        }
        const confirmations = await AsyncStorage.getItem(VOICE_MATCH_CONFIRMATIONS_KEY);
        if (confirmations) {
          confirmedMatchesRef.current = JSON.parse(confirmations) as VoiceMatchConfirmations;
        }
      } catch (e) {
        console.error('Error loading exercises:', e);
      }
    };

    loadFromStorage();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Local voice processing was decommissioned - using cloud-only architecture

  // Check for selected exercise on focus (after returning from exercise picker)
  useFocusEffect(
    useCallback(() => {
      checkForSelectedExercise();
    }, [])
  );

  const saveExercises = async (newExercises: QuickExercise[]) => {
    try {
      await AsyncStorage.setItem(QUICK_WORKOUT_KEY, JSON.stringify(newExercises));
    } catch (e) {
      console.error('Error saving exercises:', e);
    }
  };

  const storeVoiceConfirmation = async (rawName: string, confirmedName: string) => {
    const key = normalizeMatchKey(rawName);
    confirmedMatchesRef.current = {
      ...confirmedMatchesRef.current,
      [key]: confirmedName,
    };
    try {
      await AsyncStorage.setItem(
        VOICE_MATCH_CONFIRMATIONS_KEY,
        JSON.stringify(confirmedMatchesRef.current)
      );
    } catch (error) {
      console.error('Error saving voice match confirmation:', error);
    }
  };

  const checkForSelectedExercise = async () => {
    try {
      const selected = await AsyncStorage.getItem(SELECTED_EXERCISE_KEY);
      if (selected) {
        const data = JSON.parse(selected);
        await AsyncStorage.removeItem(SELECTED_EXERCISE_KEY);

        const newExercise: QuickExercise = {
          name: data.name,
          sets: 4,
          reps: '8',
          restTime: 90,
          muscles: data.muscles,
          equipment: data.equipment,
        };

        // Read current from storage first to ensure consistency
        const currentSaved = await AsyncStorage.getItem(QUICK_WORKOUT_KEY);
        const currentList: QuickExercise[] = currentSaved ? JSON.parse(currentSaved) : [];
        const newList = [...currentList, newExercise];

        // Save to storage FIRST (source of truth)
        await AsyncStorage.setItem(QUICK_WORKOUT_KEY, JSON.stringify(newList));

        // Then update React state
        setExercises(newList);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.error('Error checking for selected exercise:', e);
    }
  };

  const handleAddExercise = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/exercise-picker');
  };

  const handleVoiceExercisesExtracted = async (voiceExercises: ExtractedExercise[]) => {
    console.log('Quick workout received voice exercises:', voiceExercises.length);

    // IMMEDIATELY add exercises with raw names (no waiting for matching)
    // This eliminates perceived latency - user sees exercises instantly
    const instantExercises: QuickExercise[] = voiceExercises.map((ex) => ({
      name: ex.nameRaw, // Use raw name initially
      rawName: ex.nameRaw,
      sets: ex.sets || 4,
      reps: ex.reps || '8',
      weight: ex.weight,
      weightUnit: ex.weightUnit || 'lbs',
      restTime: ex.restSeconds || 90,
      muscles: [],
      equipment: [],
      lowConfidence: true, // Mark for background matching
      confidenceScore: 0,
      alternatives: [],
      perSetDetails: ex.perSetDetails,
    }));

    // Add to exercise list IMMEDIATELY (user sees instant feedback)
    setExercises(prev => {
      const newList = [...prev, ...instantExercises];
      saveExercises(newList);
      return newList;
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // BACKGROUND: Match exercises to database after modal is closed
    // This happens asynchronously - no user-perceived latency
    setTimeout(async () => {
      if (!isMountedRef.current) return;

      const CONFIDENCE_THRESHOLD = 80;

      // Process all exercises in parallel using robust modifier-aware matching
      const matchedExercises = await Promise.all(
        instantExercises.map(async (ex, idx) => {
          try {
            const rawName = ex.rawName || ex.name;
            const confirmedMatch = confirmedMatchesRef.current[normalizeMatchKey(rawName)];
            if (confirmedMatch) {
              return {
                ...ex,
                name: confirmedMatch,
                muscles: [],
                equipment: [],
                lowConfidence: false,
                confidenceScore: 100,
                alternatives: [],
              };
            }

            // Use robust modifier-aware matching (Knuth-inspired)
            const robustMatch = resolveExerciseName(rawName);

            // Fallback to legacy search for alternatives
            const searchResults = await searchExercisesEnhanced(rawName, {});

            const confidenceScore = robustMatch.matched ? robustMatch.confidence : 0;

            const alternatives: QuickExercise['alternatives'] = [];
            if (searchResults.taxonomyMatches) {
              for (const match of searchResults.taxonomyMatches.slice(0, 5)) {
                alternatives.push({
                  name: match.taxonomyExercise.canonical_name,
                  confidence: match.matchType === 'exact' ? 'exact' : match.score >= 80 ? 'high' : match.score >= 60 ? 'medium' : 'low',
                  score: match.score,
                });
              }
            }

            if (confidenceScore < CONFIDENCE_THRESHOLD) {
              alternatives.push({
                name: `Create Custom: "${rawName}"`,
                confidence: 'low',
                score: 0,
              });
            }

            const bestMatch = robustMatch.matched ? robustMatch.name : (alternatives[0]?.name || rawName);
            const isLowConfidence = confidenceScore < CONFIDENCE_THRESHOLD;

            return {
              ...ex,
              name: bestMatch,
              muscles: [],
              equipment: [],
              lowConfidence: isLowConfidence,
              confidenceScore,
              alternatives: isLowConfidence ? alternatives : alternatives.slice(0, 3),
            };
          } catch (error) {
            console.error('Error matching exercise:', error);
            return ex; // Keep original on error
          }
        })
      );

      // Update exercises with matched data (silent background update)
      if (isMountedRef.current) {
        setExercises(prev => {
          // Find the exercises we just added and update them
          const startIdx = prev.length - instantExercises.length;
          const newList = [...prev];
          matchedExercises.forEach((matched, idx) => {
            if (newList[startIdx + idx]) {
              newList[startIdx + idx] = matched;
            }
          });
          saveExercises(newList);
          return newList;
        });
      }
    }, 50); // Tiny delay to let modal close first
  };

  const openVoiceModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVoiceModalVisible(true);
  };

  const handleRemoveExercise = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Use functional update to avoid stale closure
    setExercises(prev => {
      const newList = prev.filter((_, i) => i !== index);
      saveExercises(newList);
      return newList;
    });
  };

  const handleUpdateExercise = (index: number, updates: Partial<QuickExercise>) => {
    // Use functional update to avoid stale closure
    setExercises(prev => {
      const newList = [...prev];
      newList[index] = { ...newList[index], ...updates };
      saveExercises(newList);
      return newList;
    });
  };

  const handleStartWorkout = async () => {
    if (loading) return;

    // Read from storage as source of truth
    let currentExercises: QuickExercise[] = [];
    try {
      const saved = await AsyncStorage.getItem(QUICK_WORKOUT_KEY);
      if (saved) {
        currentExercises = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error reading storage:', e);
    }

    // Fallback to React state if storage empty
    if (currentExercises.length === 0 && exercises.length > 0) {
      currentExercises = exercises;
      await AsyncStorage.setItem(QUICK_WORKOUT_KEY, JSON.stringify(exercises));
    }

    // Allow starting with no exercises - user can add during workout
    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const workoutName = `Quick Workout - ${new Date().toLocaleDateString()}`;
      const program = await createProgram(workoutName, 'Quick workout session');

      const parsedData = {
        workouts: [
          {
            week: 1,
            day: 1,
            name: workoutName,
            exercises: currentExercises.map((ex, idx) => ({
              name: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              weight: ex.weight,
              weightUnit: ex.weightUnit || 'lbs',
              restTime: ex.restTime,
              notes: '',
              order: idx,
              // Include per-set details for variable weights/reps
              perSetDetails: ex.perSetDetails,
            })),
            order: 0,
          },
        ],
      };

      const updatedProgram = await updateProgram(program.id, {
        parsedData,
        sourceType: 'BUILTIN',
      });

      if (!updatedProgram) {
        throw new Error('Failed to update program with exercises');
      }

      // Small delay to ensure storage is committed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Clear the saved exercises
      await AsyncStorage.removeItem(QUICK_WORKOUT_KEY);
      setExercises([]);

      // Navigate to workout execution
      router.replace(`/workout/${updatedProgram.id}?week=1&day=1&quick=true`);
    } catch (e) {
      console.error('Error starting workout:', e);
      const msg = 'Failed to start workout';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = () => {
    if (exercises.length === 0) return;

    const doClear = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setExercises([]);
      saveExercises([]);
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Clear all exercises?')) {
        doClear();
      }
    } else {
      Alert.alert('Clear All', 'Remove all exercises from this workout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: doClear },
      ]);
    }
  };

  const handleSaveAsTemplate = () => {
    if (exercises.length === 0) {
      Alert.alert('No Exercises', 'Add some exercises before saving as a template.');
      return;
    }

    if (Platform.OS === 'web') {
      const name = window.prompt('Enter a name for this template:');
      if (name && name.trim()) {
        saveWorkoutTemplate({
          name: name.trim(),
          exercises: exercises.map(e => ({
            name: e.name,
            sets: e.sets,
            reps: e.reps,
            weight: e.weight ? String(e.weight) : undefined,
          })),
          userId: 'local',
        }).then(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Saved!', 'Template saved to Quick Workouts.');
        });
      }
    } else {
      Alert.prompt(
        'Save as Template',
        'Enter a name for this workout template:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: async (name: string | undefined) => {
              if (name && name.trim()) {
                await saveWorkoutTemplate({
                  name: name.trim(),
                  exercises: exercises.map(e => ({
                    name: e.name,
                    sets: e.sets,
                    reps: e.reps,
                    weight: e.weight ? String(e.weight) : undefined,
                  })),
                  userId: 'local',
                });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Saved!', 'Template saved to Quick Workouts.');
              }
            },
          },
        ],
        'plain-text',
        '',
        'default'
      );
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Quick Workout',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.groupedBackground },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <IconSymbol name="xmark" size={20} color={colors.text} />
            </Pressable>
          ),
          headerRight: exercises.length > 0 ? () => (
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Pressable onPress={handleSaveAsTemplate} hitSlop={12}>
                <ThemedText style={{ color: '#30D158' }}>Save</ThemedText>
              </Pressable>
              <Pressable onPress={handleClearAll} hitSlop={12}>
                <ThemedText style={{ color: colors.tint }}>Clear</ThemedText>
              </Pressable>
            </View>
          ) : undefined,
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
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Build Your Workout</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Add exercises and customize sets & reps
          </ThemedText>
        </View>

        {useVoiceFirst && (
          <Card style={styles.voiceInputCard} padding="md">
            <View style={styles.voiceInputHeader}>
              <View style={styles.voiceInputTitleRow}>
                <IconSymbol name="mic.fill" size={18} color={colors.tint} />
                <ThemedText style={styles.voiceInputTitle}>Just say what you did</ThemedText>
              </View>
              <ThemedText style={[styles.voiceInputSubtitle, { color: colors.textSecondary }]}>
                {'"3 sets of bench press at 135"'}
              </ThemedText>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.voicePrimaryButton,
                { backgroundColor: colors.tint, opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={openVoiceModal}
            >
              <IconSymbol name="waveform" size={18} color="#fff" />
              <ThemedText style={styles.voicePrimaryButtonText}>Tap to speak</ThemedText>
            </Pressable>

            <View style={styles.voiceDivider}>
              <View style={[styles.voiceDividerLine, { backgroundColor: colors.separator }]} />
              <ThemedText style={[styles.voiceDividerText, { color: colors.textSecondary }]}>
                or
              </ThemedText>
              <View style={[styles.voiceDividerLine, { backgroundColor: colors.separator }]} />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.voiceSecondaryButton,
                {
                  borderColor: colors.separator,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={handleAddExercise}
            >
              <IconSymbol name="plus" size={18} color={colors.text} />
              <ThemedText style={[styles.voiceSecondaryButtonText, { color: colors.text }]}>
                Add Exercise Manually
              </ThemedText>
            </Pressable>
          </Card>
        )}

        {/* Exercises List */}
        {exercises.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.tintMuted }]}>
              <IconSymbol name="dumbbell" size={32} color={colors.tint} />
            </View>
            <ThemedText style={styles.emptyTitle}>No exercises yet</ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {useVoiceFirst
                ? 'Use voice or add an exercise below'
                : 'Tap the button below to add your first exercise'}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.exercisesList}>
            {exercises.map((exercise, index) => (
              <ExerciseConfigCard
                key={`${exercise.name}-${index}`}
                exercise={exercise}
                index={index}
                colors={colors}
                onUpdate={(updates) => handleUpdateExercise(index, updates)}
                onRemove={() => handleRemoveExercise(index)}
                onConfirmMatch={storeVoiceConfirmation}
              />
            ))}
          </View>
        )}

        {/* Add Exercise Buttons */}
        {!useVoiceFirst && (
          <View style={styles.addButtonsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                styles.addButtonPrimary,
                { borderColor: colors.tint, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleAddExercise}
            >
              <IconSymbol name="magnifyingglass" size={18} color={colors.tint} />
              <ThemedText style={[styles.addButtonText, { color: colors.tint }]}>
                Browse
              </ThemedText>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                styles.addButtonSecondary,
                { backgroundColor: colors.tint, opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={openVoiceModal}
            >
              <IconSymbol name="mic.fill" size={18} color="#fff" />
              <ThemedText style={[styles.addButtonText, { color: '#fff' }]}>
                Voice Add
              </ThemedText>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Start Button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.startButton,
            {
              backgroundColor: colors.tint,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          onPress={handleStartWorkout}
          disabled={loading}
        >
          <IconSymbol name="bolt.fill" size={20} color="#fff" />
          <ThemedText style={styles.startButtonText}>
            {loading ? 'Starting...' : exercises.length > 0 ? `Start Workout (${exercises.length})` : 'Start Empty Workout'}
          </ThemedText>
        </Pressable>
      </View>

      {/* Voice Logging Modal */}
      <VoiceLoggingModal
        visible={voiceModalVisible}
        onClose={() => setVoiceModalVisible(false)}
        onExercisesExtracted={handleVoiceExercisesExtracted}
      />

      {/* Processing Overlay - Shows after 200ms delay */}
      <Modal
        visible={processingVoice}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.processingOverlay}>
          <View style={[styles.processingCard, { backgroundColor: colors.elevated }]}>
            <ActivityIndicator size="large" color={colors.tint} />
            <ThemedText style={[styles.processingText, { color: colors.text }]}>
              Matching exercises...
            </ThemedText>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

// Exercise Configuration Card
function ExerciseConfigCard({
  exercise,
  index,
  colors,
  onUpdate,
  onRemove,
  onConfirmMatch,
}: {
  exercise: QuickExercise;
  index: number;
  colors: typeof Colors['light'];
  onUpdate: (updates: Partial<QuickExercise>) => void;
  onRemove: () => void;
  onConfirmMatch: (rawName: string, confirmedName: string) => void;
}) {
  const [editing, setEditing] = useState<'sets' | 'reps' | null>(null);

  return (
    <Card style={styles.exerciseCard} padding="md">
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseInfo}>
          <ThemedText style={styles.exerciseNumber}>{index + 1}</ThemedText>
          <View style={styles.exerciseNameContainer}>
            <ThemedText style={styles.exerciseName} numberOfLines={1}>
              {exercise.name}
            </ThemedText>
            {exercise.lowConfidence && (
              <View style={[styles.confidenceBadge, { backgroundColor: colors.warning + '20' }]}>
                <ThemedText style={[styles.confidenceBadgeText, { color: colors.warning }]}>
                  {Math.round(exercise.confidenceScore || 0)}%
                </ThemedText>
              </View>
            )}
          </View>
        </View>
        <Pressable onPress={onRemove} hitSlop={12}>
          <IconSymbol name="xmark.circle.fill" size={22} color={colors.textTertiary} />
        </Pressable>
      </View>

      {/* Low Confidence Warning - Show alternatives */}
      {exercise.lowConfidence && exercise.alternatives && exercise.alternatives.length > 0 && (
        <View style={[styles.lowConfidenceWarning, { backgroundColor: colors.warning + '10', borderColor: colors.warning + '40' }]}>
          <View style={styles.warningHeader}>
            <IconSymbol name="exclamationmark.triangle.fill" size={14} color={colors.warning} />
            <ThemedText style={[styles.warningTitle, { color: colors.warning }]}>
              Not sure about this match
            </ThemedText>
          </View>
          <ThemedText style={[styles.warningSubtitle, { color: colors.textSecondary }]}>
            You said "{exercise.rawName}". Did you mean:
          </ThemedText>
          <View style={styles.alternativesList}>
            {exercise.rawName && (
              <Pressable
                style={[
                  styles.alternativeChip,
                  {
                    backgroundColor: colors.success + '20',
                    borderColor: colors.success,
                  }
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onConfirmMatch(exercise.rawName!, exercise.name);
                  onUpdate({ lowConfidence: false, isCustom: false });
                }}
              >
                <ThemedText
                  style={[
                    styles.alternativeText,
                    { color: colors.success }
                  ]}
                  numberOfLines={1}
                >
                  No, this is good
                </ThemedText>
              </Pressable>
            )}
            {exercise.alternatives.slice(0, 4).map((alt, i) => (
              <Pressable
                key={alt.name + i}
                style={[
                  styles.alternativeChip,
                  {
                    backgroundColor: alt.name.startsWith('Create Custom')
                      ? colors.tint + '20'
                      : colors.card,
                    borderColor: alt.name.startsWith('Create Custom')
                      ? colors.tint
                      : colors.separator,
                  }
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (alt.name.startsWith('Create Custom')) {
                    // Mark as custom and use raw name
                    const confirmedName = exercise.rawName || alt.name;
                    if (exercise.rawName) {
                      onConfirmMatch(exercise.rawName, confirmedName);
                    }
                    onUpdate({
                      name: confirmedName,
                      isCustom: true,
                      lowConfidence: false
                    });
                  } else {
                    if (exercise.rawName) {
                      onConfirmMatch(exercise.rawName, alt.name);
                    }
                    onUpdate({ name: alt.name, lowConfidence: false, isCustom: false });
                  }
                }}
              >
                <ThemedText
                  style={[
                    styles.alternativeText,
                    {
                      color: alt.name.startsWith('Create Custom')
                        ? colors.tint
                        : colors.text
                    }
                  ]}
                  numberOfLines={1}
                >
                  {alt.name.startsWith('Create Custom') ? '+ Create Custom' : alt.name}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Muscles/Equipment Tags */}
      {(Array.isArray(exercise.muscles) && exercise.muscles.length > 0) ||
        (Array.isArray(exercise.equipment) && exercise.equipment.length > 0) ? (
        <View style={styles.tagRow}>
          {Array.isArray(exercise.muscles) && exercise.muscles.slice(0, 2).map((m) => (
            <View key={m} style={[styles.tag, { backgroundColor: colors.tintMuted }]}>
              <ThemedText style={[styles.tagText, { color: colors.tint }]}>{m}</ThemedText>
            </View>
          ))}
          {Array.isArray(exercise.equipment) && exercise.equipment.slice(0, 1).map((e) => (
            <View key={e} style={[styles.tag, { backgroundColor: colors.separator }]}>
              <ThemedText style={[styles.tagText, { color: colors.textSecondary }]}>{e}</ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {/* Sets & Reps Configuration */}
      <View style={styles.configRow}>
        <Pressable
          style={[
            styles.configItem,
            { backgroundColor: colors.groupedBackground, borderColor: colors.separator },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            onUpdate({ sets: exercise.sets >= 5 ? 1 : exercise.sets + 1 });
          }}
        >
          <ThemedText style={[styles.configLabel, { color: colors.textSecondary }]}>Sets</ThemedText>
          <ThemedText style={styles.configValue}>{exercise.sets}</ThemedText>
        </Pressable>

        <Pressable
          style={[
            styles.configItem,
            { backgroundColor: colors.groupedBackground, borderColor: colors.separator },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            const repsOptions = ['5', '8', '10', '12', '15', '8-12', '10-15', 'AMRAP'];
            const currentIdx = repsOptions.indexOf(exercise.reps);
            const nextIdx = (currentIdx + 1) % repsOptions.length;
            onUpdate({ reps: repsOptions[nextIdx] });
          }}
        >
          <ThemedText style={[styles.configLabel, { color: colors.textSecondary }]}>Reps</ThemedText>
          <ThemedText style={styles.configValue}>{exercise.reps}</ThemedText>
        </Pressable>

        {/* Weight - only show if weight was specified */}
        {exercise.weight !== undefined && (
          <Pressable
            style={[
              styles.configItem,
              { backgroundColor: colors.tintMuted, borderColor: colors.tint },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              const weightOptions = [45, 65, 95, 115, 135, 155, 185, 205, 225, 275, 315];
              const currentIdx = weightOptions.indexOf(exercise.weight || 0);
              const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % weightOptions.length : 0;
              onUpdate({ weight: weightOptions[nextIdx] });
            }}
          >
            <ThemedText style={[styles.configLabel, { color: colors.tint }]}>Weight</ThemedText>
            <ThemedText style={[styles.configValue, { color: colors.tint }]}>
              {exercise.weight} {exercise.weightUnit || 'lbs'}
            </ThemedText>
          </Pressable>
        )}

        <Pressable
          style={[
            styles.configItem,
            { backgroundColor: colors.groupedBackground, borderColor: colors.separator },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            const restOptions = [30, 60, 90, 120, 180];
            const currentIdx = restOptions.indexOf(exercise.restTime);
            const nextIdx = (currentIdx + 1) % restOptions.length;
            onUpdate({ restTime: restOptions[nextIdx] });
          }}
        >
          <ThemedText style={[styles.configLabel, { color: colors.textSecondary }]}>Rest</ThemedText>
          <ThemedText style={styles.configValue}>{exercise.restTime}s</ThemedText>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    ...Typography.title2,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    ...Typography.body,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    ...Typography.headline,
    marginBottom: 4,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
  exercisesList: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  exerciseCard: {
    gap: Spacing.sm,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  exerciseNumber: {
    ...Typography.caption1,
    fontWeight: '600',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,122,255,0.1)',
    color: '#007AFF',
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
  },
  exerciseName: {
    ...Typography.headline,
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  tagText: {
    ...Typography.caption2,
    fontWeight: '500',
  },
  configRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  configItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  configLabel: {
    ...Typography.caption2,
    marginBottom: 2,
  },
  configValue: {
    ...Typography.headline,
    fontWeight: '600',
  },
  addButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.lg,
  },
  addButtonPrimary: {
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  addButtonSecondary: {
    borderWidth: 0,
  },
  addButtonText: {
    ...Typography.body,
    fontWeight: '600',
  },
  voiceInputCard: {
    gap: Spacing.md,
  },
  voiceInputHeader: {
    gap: 4,
  },
  voiceInputTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceInputTitle: {
    ...Typography.headline,
    fontWeight: '600',
  },
  voiceInputSubtitle: {
    ...Typography.caption1,
  },
  voicePrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: Radius.lg,
  },
  voicePrimaryButtonText: {
    color: '#fff',
    ...Typography.headline,
    fontWeight: '600',
  },
  voiceDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  voiceDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  voiceDividerText: {
    ...Typography.caption2,
    fontWeight: '500',
  },
  voiceSecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  voiceSecondaryButtonText: {
    ...Typography.body,
    fontWeight: '600',
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
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: Radius.lg,
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
  },
  startButtonText: {
    color: '#fff',
    ...Typography.headline,
    fontWeight: '600',
  },
  // Low confidence warning styles
  exerciseNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confidenceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  lowConfidenceWarning: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 8,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  warningSubtitle: {
    fontSize: 12,
  },
  alternativesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  alternativeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  alternativeText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Processing overlay styles
  processingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingCard: {
    paddingHorizontal: 32,
    paddingVertical: 28,
    borderRadius: 20,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
