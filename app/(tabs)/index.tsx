import { ExpandableFAB } from '@/components/expandable-fab';
import { MyProgramCard, type ProgramWithProgress } from '@/components/program';
import { Screen } from '@/components/screen';
import { SwipeTabs } from '@/components/swipe-tabs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SkeletonCardList } from '@/components/ui/skeleton';
import { VoiceLoggingModal } from '@/components/voice';
import { WorkoutPickerModal } from '@/components/workout-picker-modal';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/context/auth-context';
import {
  clearActiveWorkoutState,
  clearPendingWorkoutEdits,
  clearWorkoutHistory,
  createProgram,
  deleteProgram,
  deleteProgramTemplate,
  getCompletedWorkouts,
  getEffectiveProgramData,
  getPrograms,
} from '@/lib/db/storage';
import {
  AssignmentStatus,
  getAthleteAssignments,
  type ProgramAssignment,
} from '@/lib/services/coach';
import type { ExtractedExercise } from '@/lib/services/voice/direct-intent-types';
import { exportProgramToCSV } from '@/lib/utils/csv-export';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Dimensions, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DELETE_THRESHOLD = -100;
const SPRING_CONFIG = { damping: 20, stiffness: 200 };
const SCREEN_WIDTH = Dimensions.get('window').width;

// Swipeable Program Card Wrapper
function SwipeableProgramCard({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const translateX = useSharedValue(0);
  const isDeleting = useSharedValue(false);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      if (!isDeleting.value) {
        // Allow unlimited swipe left
        translateX.value = Math.min(0, e.translationX);
      }
    })
    .onEnd(() => {
      if (translateX.value <= DELETE_THRESHOLD && !isDeleting.value) {
        // Swipe off screen completely then delete
        isDeleting.value = true;
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 200 }, () => {
          runOnJS(onDelete)();
        });
      } else if (!isDeleting.value) {
        translateX.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-120, -60, 0], [1, 0.7, 0]),
    width: Math.max(80, Math.abs(Math.min(translateX.value, 0))),
  }));

  return (
    <View style={swipeStyles.container}>
      <Animated.View style={[swipeStyles.deleteBackground, deleteStyle]}>
        <IconSymbol name="trash.fill" size={24} color="#fff" />
      </Animated.View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: Radius.lg,
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#FF3B30',
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
    minWidth: 80,
  },
});

export default function ProgramsScreen() {
  const [programs, setPrograms] = useState<ProgramWithProgress[]>([]);
  const [assignedPrograms, setAssignedPrograms] = useState<ProgramAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<ProgramWithProgress | null>(null);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuth();

  useFocusEffect(
    useCallback(() => {
      loadPrograms();
    }, [])
  );

  async function loadPrograms() {
    try {
      setLoading(true);

      // Load local programs
      const data = await getPrograms();
      const programsWithProgress: ProgramWithProgress[] = await Promise.all(
        data.map(async (program) => {
          // Get effective data (includes template customizations if any)
          const effectiveData = await getEffectiveProgramData(program);
          const workouts = getWorkoutsFromParsedData(effectiveData);
          const completed = await getCompletedWorkouts(program.id);
          return {
            ...program,
            // Update parsedData to include template customizations
            parsedData: effectiveData,
            completedCount: completed.size,
            totalWorkouts: workouts.length,
          };
        })
      );
      setPrograms(programsWithProgress);

      // Load assigned programs (only for logged-in users)
      if (!isGuest) {
        try {
          const assignResult = await getAthleteAssignments(AssignmentStatus.ACTIVE);
          if (assignResult.success && assignResult.data) {
            setAssignedPrograms(assignResult.data);
          }
        } catch (err) {
          // Silently fail - user might not have any coach assignments
          console.log('[MyPrograms] No coach assignments found');
        }
      }
    } catch (error) {
      console.error('Error loading programs:', error);
    } finally {
      setLoading(false);
    }
  }

  function getWorkoutsFromParsedData(parsedData: any) {
    const parsed =
      typeof parsedData === 'string' ? JSON.parse(parsedData) : parsedData;
    return parsed?.workouts || [];
  }

  function handleStartPress(program: ProgramWithProgress) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedProgram(program);
    setPickerVisible(true);
  }

  function handleWorkoutSelect(week: number, day: number) {
    if (selectedProgram) {
      setPickerVisible(false);
      router.push(`/workout/${selectedProgram.id}?week=${week}&day=${day}`);
    }
  }

  const handleDeleteProgram = async (program: ProgramWithProgress) => {
    try {
      const userId = program.userId || 'local';
      // Clear associated data (these don't throw on missing data)
      await clearActiveWorkoutState(userId, program.id);
      await clearPendingWorkoutEdits(userId, program.id);
      await deleteProgramTemplate(userId, program.id);
      await clearWorkoutHistory(program.id);
      // Delete the program itself
      const success = await deleteProgram(program.id);
      if (!success) {
        throw new Error('Failed to delete program from storage');
      }
      await loadPrograms();
    } catch (e) {
      console.error('Delete program error:', e);
      if (Platform.OS === 'web') {
        window.alert('Failed to delete program.');
      } else {
        Alert.alert('Error', 'Failed to delete program. Please try again.');
      }
    }
  };

  const confirmDeleteProgram = (program: ProgramWithProgress) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Delete Program?\n\nThis will remove the program from My Programs. Any saved template edits for this program will also be removed.'
      );
      if (confirmed) {
        handleDeleteProgram(program);
      }
    } else {
      Alert.alert(
        'Delete Program?',
        'This will remove the program from My Programs. Any saved template edits for this program will also be removed.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => handleDeleteProgram(program),
          },
        ]
      );
    }
  };

  const handleExport = async (program: ProgramWithProgress) => {
    const success = await exportProgramToCSV(program);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleCreateProgram = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const newProgram = await createProgram('New Program');
      router.push(`/program/${newProgram.id}/edit`);
    } catch (e) {
      console.error(e);
      const msg = 'Failed to create program';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    }
  };

  const handleQuickWorkout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to the Quick Workout builder screen where user can add exercises
    router.push('/workout/quick');
  };

  const handleVoiceLog = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVoiceModalVisible(true);
  };

  const handleVoiceExercisesExtracted = async (exercises: ExtractedExercise[]) => {
    console.log('Voice extracted exercises:', exercises.length);

    try {
      // Use the SAME search algorithm as the exercise picker (proven to work)
      const { searchExercisesEnhanced, lookupExerciseByAlias } = await import('@/lib/services/exercise/search');

      // Match each exercise to the database and format for quick workout
      // Include alternatives for disambiguation UI
      const quickExercises = await Promise.all(
        exercises.map(async (ex) => {
          const rawName = ex.nameRaw;

          // First try direct alias lookup (handles "lat pulldown", "bench", etc.)
          const directMatch = lookupExerciseByAlias(rawName);

          // Then get search results for alternatives
          const searchResults = await searchExercisesEnhanced(rawName, {});

          // Build alternatives from taxonomy matches (best) and database matches
          const alternatives: Array<{ name: string; confidence: 'exact' | 'high' | 'medium' | 'low'; score: number }> = [];

          // Add taxonomy matches (highest quality)
          if (searchResults.taxonomyMatches) {
            for (const match of searchResults.taxonomyMatches.slice(0, 4)) {
              alternatives.push({
                name: match.taxonomyExercise.canonical_name,
                confidence: match.matchType === 'exact' ? 'exact' : match.matchType === 'alias' ? 'high' : 'medium',
                score: match.taxonomyExercise.popularity_score || 50,
              });
            }
          }

          // Add database matches if we need more options
          if (alternatives.length < 4 && searchResults.databaseMatches) {
            for (const match of searchResults.databaseMatches.slice(0, 4 - alternatives.length)) {
              if (!alternatives.some(a => a.name.toLowerCase() === match.name.toLowerCase())) {
                alternatives.push({
                  name: match.name,
                  confidence: match.score > 80 ? 'high' : match.score > 50 ? 'medium' : 'low',
                  score: match.score,
                });
              }
            }
          }

          // Determine best match: direct lookup > first taxonomy match > first database match > raw name
          let bestMatch = rawName;
          if (directMatch) {
            bestMatch = directMatch.canonical_name;
          } else if (alternatives.length > 0) {
            bestMatch = alternatives[0].name;
          }

          console.log(`[Voice] "${rawName}" → "${bestMatch}" (direct: ${!!directMatch}, alts: ${alternatives.length})`);

          return {
            name: bestMatch,
            rawName: rawName, // Keep original for reference
            sets: ex.sets || 3,
            reps: ex.reps || '8-12',
            restTime: ex.restSeconds || 90,
            muscles: directMatch?.muscles?.primary || [],
            equipment: directMatch?.constraints?.equipment || [],
            // Include alternatives for disambiguation dropdown
            alternatives,
          };
        })
      );

      // Save to AsyncStorage for quick.tsx to pick up
      const QUICK_WORKOUT_KEY = '@quick_workout_exercises';
      await AsyncStorage.setItem(QUICK_WORKOUT_KEY, JSON.stringify(quickExercises));

      console.log('Saved exercises to storage:', quickExercises.length);

      // Navigate to quick workout - it will auto-load the exercises
      router.push('/workout/quick');
    } catch (error) {
      console.error('Error processing voice exercises:', error);
      // Fallback: just navigate without pre-filled exercises
      router.push('/workout/quick');
    }
  };

  if (loading) {
    return (
      <SwipeTabs current="index">
        <Screen contentStyle={styles.screenContent}>
          <SkeletonCardList count={3} />
        </Screen>
      </SwipeTabs>
    );
  }

  const hasContent = programs.length > 0 || assignedPrograms.length > 0;

  return (
    <SwipeTabs current="index">
      <Screen contentStyle={styles.screenContent}>
        {!hasContent ? (
          <EmptyState colors={colors} router={router} onCreateProgram={handleCreateProgram} onQuickWorkout={handleQuickWorkout} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {/* Assigned by Coach Section */}
            {assignedPrograms.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: '#30D158' + '20' }]}>
                    <IconSymbol name="person.badge.shield.checkmark.fill" size={16} color="#30D158" />
                  </View>
                  <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                    Assigned by Coach
                  </ThemedText>
                </View>
                {assignedPrograms.map((assignment) => (
                  <TouchableOpacity
                    key={assignment.id}
                    style={[styles.assignedCard, { backgroundColor: colors.groupedBackground }]}
                    onPress={() => {
                      // Navigate to assigned workout
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push(`/workout/${assignment.programId}?assignmentId=${assignment.id}` as any);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.assignedCardContent}>
                      <View style={styles.assignedCardInfo}>
                        <ThemedText style={[styles.assignedProgramName, { color: colors.text }]}>
                          {assignment.programName || 'Assigned Program'}
                        </ThemedText>
                        <ThemedText style={[styles.assignedMeta, { color: colors.textSecondary }]}>
                          Week {assignment.currentWeek} · {assignment.status}
                        </ThemedText>
                      </View>
                      <View style={[styles.startBadge, { backgroundColor: '#30D158' }]}>
                        <ThemedText style={styles.startBadgeText}>Start</ThemedText>
                      </View>
                    </View>
                    {assignment.coachNotes && (
                      <View style={[styles.coachNotes, { backgroundColor: colors.tint + '10' }]}>
                        <IconSymbol name="text.bubble" size={12} color={colors.tint} />
                        <ThemedText style={[styles.coachNotesText, { color: colors.textSecondary }]} numberOfLines={2}>
                          {assignment.coachNotes}
                        </ThemedText>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* My Programs Section */}
            {programs.length > 0 && (
              <View style={styles.section}>
                {assignedPrograms.length > 0 && (
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: colors.tint + '20' }]}>
                      <IconSymbol name="figure.strengthtraining.traditional" size={16} color={colors.tint} />
                    </View>
                    <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                      My Programs
                    </ThemedText>
                  </View>
                )}
                <ThemedText style={[styles.listMeta, { color: colors.textSecondary + 'CC' }]}>
                  {programs.length} program{programs.length !== 1 ? 's' : ''}
                </ThemedText>
                {programs.map((item) => (
                  <View key={item.id} style={{ marginBottom: Spacing.sm }}>
                    <SwipeableProgramCard onDelete={() => handleDeleteProgram(item)}>
                      <MyProgramCard
                        program={item}
                        onStart={handleStartPress}
                        onEdit={(p) => router.push(`/program/${p.id}/edit`)}
                        onDelete={confirmDeleteProgram}
                        onExport={handleExport}
                      />
                    </SwipeableProgramCard>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* Expandable Floating Action Button */}
        {hasContent && (
          <View style={[styles.fabContainer, { bottom: insets.bottom + 20 }]}>
            <ExpandableFAB
              onQuickWorkout={handleQuickWorkout}
              onNewProgram={handleCreateProgram}
              onVoiceLog={handleVoiceLog}
            />
          </View>
        )}
      </Screen>

      {selectedProgram && (
        <WorkoutPickerModal
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          onSelect={handleWorkoutSelect}
          programId={selectedProgram.id}
          programName={selectedProgram.name}
          workouts={getWorkoutsFromParsedData(selectedProgram.parsedData)}
        />
      )}

      {/* Voice Logging Modal - Direct-to-Intent Gemini Audio */}
      <VoiceLoggingModal
        visible={voiceModalVisible}
        onClose={() => setVoiceModalVisible(false)}
        onExercisesExtracted={handleVoiceExercisesExtracted}
      />
    </SwipeTabs>
  );
}

// Empty State Component
function EmptyState({
  colors,
  router,
  onCreateProgram,
  onQuickWorkout,
}: {
  colors: (typeof Colors)['light'];
  router: ReturnType<typeof useRouter>;
  onCreateProgram: () => void;
  onQuickWorkout: () => void;
}) {
  return (
    <ThemedView style={styles.emptyState}>
      {/* Quick Workout - Most prominent action */}
      <Pressable
        style={({ pressed }) => [
          styles.quickWorkoutCard,
          { backgroundColor: colors.tint, opacity: pressed ? 0.95 : 1 },
        ]}
        onPress={onQuickWorkout}
      >
        <View style={styles.quickWorkoutContent}>
          <IconSymbol name="bolt.fill" size={28} color="#fff" />
          <View style={styles.quickWorkoutText}>
            <ThemedText style={styles.quickWorkoutTitle}>Quick Workout</ThemedText>
            <ThemedText style={styles.quickWorkoutSubtitle}>
              Start now, add exercises as you go
            </ThemedText>
          </View>
        </View>
        <IconSymbol name="chevron.right" size={20} color="rgba(255,255,255,0.7)" />
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: colors.separator }]} />
        <ThemedText style={[styles.dividerText, { color: colors.textSecondary }]}>or</ThemedText>
        <View style={[styles.dividerLine, { backgroundColor: colors.separator }]} />
      </View>

      <ThemedView style={[styles.emptyIcon, { backgroundColor: colors.tint + '12' }]}>
        <IconSymbol name="figure.strengthtraining.traditional" size={32} color={colors.tint} />
      </ThemedView>
      <ThemedText type="subtitle" style={styles.emptyTitle}>
        Follow a Program
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
        Discover programs from our library or create your own
      </ThemedText>

      <View style={styles.emptyActions}>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: colors.tint, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => router.push('/(tabs)/browse')}
        >
          <IconSymbol name="sparkles" size={18} color={colors.tint} />
          <ThemedText style={[styles.secondaryButtonText, { color: colors.tint }]}>Discover</ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: colors.separator, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={onCreateProgram}
        >
          <IconSymbol name="plus" size={18} color={colors.tint} />
          <ThemedText style={[styles.secondaryButtonText, { color: colors.tint }]}>
            Create
          </ThemedText>
        </Pressable>
      </View>

      <Pressable
        style={styles.uploadLink}
        onPress={() => router.push('/(tabs)/upload')}
      >
        <ThemedText style={[styles.uploadLinkText, { color: colors.textSecondary }]}>
          or upload a CSV file
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 100,
  },
  listMeta: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    fontSize: 13,
  },
  // Section styles
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  // Assigned program card styles
  assignedCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  assignedCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assignedCardInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  assignedProgramName: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  assignedMeta: {
    fontSize: 13,
  },
  startBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
  },
  startBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  coachNotes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  coachNotesText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  quickWorkoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
  },
  quickWorkoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  quickWorkoutText: {
    gap: 2,
  },
  quickWorkoutTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  quickWorkoutSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    width: '100%',
    marginVertical: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    minWidth: 120,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 120,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  uploadLink: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  uploadLinkText: {
    fontSize: 14,
  },
  fabContainer: {
    position: 'absolute',
    right: Spacing.md,
  },
});
