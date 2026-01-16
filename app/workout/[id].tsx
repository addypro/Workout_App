import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { VoiceLoggingModal } from '@/components/voice';
import { SupersetLinkButton } from '@/components/workout';
import { InlineRestTimerRow } from '@/components/workout/inline-rest-timer';
import {
  SET_TYPE_INFO,
  SetTypesGuide,
  SetTypesInfoButton,
  useSetTypesOnboarding,
} from '@/components/workout/set-types-guide';
import { SwipeableSetRow } from '@/components/workout/swipeable-set-row';
import { COMPLETED_SET_COLORS, SET_TYPE_COLORS } from '@/constants/set-type-colors';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserId } from '@/lib/context/auth-context';
import { usePreferences } from '@/lib/context/preferences-context';
import { useOptionalWorkoutMachine } from '@/lib/context/workout-machine-provider';
import {
  clearActiveWorkoutState,
  clearPendingWorkoutEdits,
  getActiveWorkoutState,
  getEffectiveProgramData,
  getPreviousExerciseData,
  getProgram,
  getWorkoutRecordById,
  setActiveWorkoutState,
  setPendingWorkoutEdits,
  type ActiveWorkoutState,
  type PreviousExerciseData,
  type StoredWorkoutSession
} from '@/lib/db/storage';
import { getCachedWorkoutById, isOnline, upsertCachedWorkout } from '@/lib/services/offline/workout-cache';
import { preloadExerciseDatabase } from '@/lib/services/exercise/database';
import { setWorkoutContext } from '@/lib/services/voice';
import { startWorkout } from '@/lib/services/coach';
import type { AssignedWorkout } from '@/lib/services/coach/types';
import { supabase } from '@/lib/supabase/client';
import {
  unsafeCoerceSetId,
  unsafeCoerceSupersetGroupId,
  unsafeCoerceWorkoutExerciseId,
  unsafeCoerceWorkoutSessionId,
} from '@/lib/types/brands';
import {
  calculateWorkoutProgress,
  formatDuration,
  getSupersetExercises,
  getSupersetGroup,
  linkMultipleExercisesAsSuperset,
  SetType,
  SUPERSET_COLORS,
  SupersetGroup,
  SupersetPhase,
  unlinkSuperset,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet
} from '@/lib/types/workout-session';
import { inferWorkoutTypeFromExercises } from '@/lib/utils/workout-utils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SELECTED_EXERCISE_KEY = '@selected_exercise_temp';

export default function ActiveWorkoutScreen() {
  const { id, week, day, quick, repeatFrom, source, assignedWorkoutId } = useLocalSearchParams();
  const selectedWeek = week ? parseInt(week as string) : undefined;
  const selectedDay = day ? parseInt(day as string) : undefined;
  const isQuickWorkout = quick === 'true';
  const sourceParam = Array.isArray(source) ? source[0] : source;
  const assignedIdParam = Array.isArray(assignedWorkoutId) ? assignedWorkoutId[0] : assignedWorkoutId;
  const resolvedAssignedId = assignedIdParam ?? String(id);
  const isAssignedWorkout = sourceParam === 'assigned';
  const workoutKey = isAssignedWorkout ? String(resolvedAssignedId) : String(id);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { weightUnit, setWeightUnit, formatWeight, convertFromKg, convertToKg } = usePreferences();
  const userId = useUserId();

  // Workout state
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [programUserId, setProgramUserId] = useState<string | null>(null);
  const [baseParsedData, setBaseParsedData] = useState<any | null>(null);
  const [hasLiveEdits, setHasLiveEdits] = useState(false);
  const [workoutWeek, setWorkoutWeek] = useState<number | undefined>(undefined);
  const [workoutDay, setWorkoutDay] = useState<number | undefined>(undefined);
  const [previousData, setPreviousData] = useState<Record<string, PreviousExerciseData>>({});
  const [repeatPrevData, setRepeatPrevData] = useState<Record<string, PreviousExerciseData> | null>(null);
  const [lastCompletedSetId, setLastCompletedSetId] = useState<string | null>(null);

  // Rest timer editing state - prevents countdown from overwriting user edits
  const [isEditingRestTimer, setIsEditingRestTimer] = useState(false);
  const [editingRestValue, setEditingRestValue] = useState('');

  // Superset linking state - supports up to 4 exercises
  const [supersetSelectedIds, setSupersetSelectedIds] = useState<string[]>([]);
  const isInSupersetSelectionMode = supersetSelectedIds.length > 0;
  const canCompleteSupersetSelection = supersetSelectedIds.length >= 2 && supersetSelectedIds.length <= 4;

  // ============================================
  // XSTATE PARALLEL RUN (Gradual Migration)
  // ============================================
  // Machine runs alongside useState for validation & debugging.
  // The machine mirrors state changes but doesn't control UI yet.
  const workoutMachine = useOptionalWorkoutMachine();

  // Sync session changes to XState machine (parallel run)
  useEffect(() => {
    if (!workoutMachine || !session) return;

    // When useState session starts, also start the machine
    if (session.status === 'in_progress' && workoutMachine.status === 'idle') {
      console.log('[XState] Starting workout machine with session:', session.id);
      workoutMachine.startWorkout(session);
    }
  }, [session, workoutMachine, workoutMachine?.status]);

  // ============================================
  // XSTATE DIVERGENCE ASSERTIONS (Parallel Run Safety)
  // ============================================
  // Logs warnings when XState and useState states diverge.
  // This catches sync issues early during the parallel run phase.
  // To disable machine: see lib/machines/ROLLBACK.md
  useEffect(() => {
    if (!workoutMachine) return;

    const divergences: string[] = [];

    // Compare session status
    const useStateStatus = session?.status ?? 'null';
    const machineStatus = workoutMachine.status;

    // Map machine status to comparable session status
    const machineToSessionStatus: Record<string, string> = {
      'idle': 'null',
      'active.exercising': 'in_progress',
      'active.resting': 'in_progress',
      'paused': 'paused',
      'finished': 'completed',
    };
    const expectedSessionStatus = machineToSessionStatus[machineStatus] ?? machineStatus;

    if (useStateStatus !== expectedSessionStatus && useStateStatus !== 'null') {
      divergences.push(`status: useState=${useStateStatus} vs machine=${machineStatus}`);
    }

    // Compare resting state
    const useStateResting = session?.isResting ?? false;
    const machineResting = workoutMachine.isResting;
    if (useStateResting !== machineResting && session?.status === 'in_progress') {
      divergences.push(`isResting: useState=${useStateResting} vs machine=${machineResting}`);
    }

    // Compare exercise count (catches add/remove desync)
    const useStateExerciseCount = session?.exercises?.length ?? 0;
    const machineExerciseCount = workoutMachine.session?.exercises?.length ?? 0;
    if (useStateExerciseCount !== machineExerciseCount && machineExerciseCount > 0) {
      divergences.push(`exerciseCount: useState=${useStateExerciseCount} vs machine=${machineExerciseCount}`);
    }

    // Compare completed sets count
    const useStateCompletedSets = session?.exercises?.reduce(
      (sum, ex) => sum + ex.sets.filter(s => s.isCompleted).length, 0
    ) ?? 0;
    const machineCompletedSets = workoutMachine.progress.completedSets;
    if (useStateCompletedSets !== machineCompletedSets && machineCompletedSets > 0) {
      divergences.push(`completedSets: useState=${useStateCompletedSets} vs machine=${machineCompletedSets}`);
    }

    // Log result
    if (divergences.length > 0) {
      console.warn(
        `[XState DIVERGENCE WARNING] State mismatch detected:\n` +
        divergences.map(d => `  • ${d}`).join('\n') +
        `\n  See lib/machines/ROLLBACK.md for recovery instructions.`
      );
    } else if (__DEV__) {
      // Only log success in dev mode to reduce noise
      console.log(`[XState Sync] ✓ useState=${useStateStatus} | machine=${machineStatus}`);
    }
  }, [
    session?.status,
    session?.isResting,
    session?.exercises?.length,
    session?.exercises,
    workoutMachine?.status,
    workoutMachine?.isResting,
    workoutMachine?.session?.exercises?.length,
    workoutMachine?.progress.completedSets,
  ]);

  // Voice input state
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);


  // Set types onboarding
  const {
    hasSeenOnboarding,
    showGuide,
    triggerOnboarding,
    openGuide,
    closeGuide,
  } = useSetTypesOnboarding();

  // Animation values
  const progressRing = useSharedValue(0);
  const completionScale = useSharedValue(1);
  const lastRestEndReasonRef = useRef<'completed' | 'skipped' | null>(null);
  const wasRestingRef = useRef(false);
  const sessionRef = useRef<WorkoutSession | null>(null);

  // Bell sound player for rest timer completion
  const bellPlayer = useAudioPlayer('https://cdn.freesound.org/previews/411/411089_5121236-lq.mp3');

  // Play bell sound when rest timer completes
  const playRestCompleteBell = () => {
    try {
      // Strong vibration pattern for iOS
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Double vibration for emphasis
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 150);
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 300);

      // Play bell sound
      if (bellPlayer) {
        bellPlayer.seekTo(0);
        bellPlayer.play();
      }
    } catch (error) {
      // Fallback to speech if sound fails
      try {
        Speech.speak('Go', { rate: 1.2, pitch: 1.1 });
      } catch { }
    }
  };
  const isLoadedRef = useRef(false);

  // Keep sessionRef in sync for use in callbacks without causing re-renders
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const progress = useMemo(() => {
    if (!session) return { totalSetsCompleted: 0, totalSets: 0, setProgress: 0 };
    return calculateWorkoutProgress(session);
  }, [session]);

  // Current exercise and set
  const currentExercise = session?.exercises[session.currentExerciseIndex];
  const currentSetIndex = currentExercise?.currentSetIndex ?? 0;
  const currentSet = currentExercise?.sets[currentSetIndex];

  // Animate progress ring
  useEffect(() => {
    progressRing.value = withTiming(progress.setProgress, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress.setProgress, progressRing]);

  // Animated styles (must be defined at component level)
  const completionAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: completionScale.value }],
  }));

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progressRing.value * 100}%`,
  }));

  // Load workout from storage - only once per id
  useEffect(() => {
    if (isLoadedRef.current) return;
    isLoadedRef.current = true;

    // Preload exercise database to reduce Browse latency
    preloadExerciseDatabase();

    loadWorkout();
  }, [id]);

  // Trigger onboarding for first-time users when workout loads
  useEffect(() => {
    if (session && hasSeenOnboarding === false) {
      // Small delay to let the UI settle before showing onboarding
      const timer = setTimeout(() => {
        triggerOnboarding();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [session, hasSeenOnboarding, triggerOnboarding]);

  // Add exercise to session - uses functional update to avoid stale closures
  const addExerciseToSession = useCallback(async (exerciseData: {
    name: string;
    muscles?: string[];
    equipment?: string[];
    setsCount?: number;  // Voice input can specify number of sets
    reps?: number | string;  // Voice input can specify reps
    weight?: number;  // Voice input can specify weight
    perSetDetails?: { reps: string; weight?: number; setType?: 'warmup' | 'working' | 'drop' | 'top' | 'failure' | 'normal' }[]; // Per-set weight/reps
  }) => {
    const timestamp = Date.now();

    // CRITICAL DEBUG: Log what we receive
    console.log('[addExerciseToSession] Called with:', {
      name: exerciseData.name,
      setsCount: exerciseData.setsCount,
      reps: exerciseData.reps,
      weight: exerciseData.weight,
      perSetDetails: exerciseData.perSetDetails,
      hasPerSetDetails: !!exerciseData.perSetDetails,
      perSetDetailsLength: exerciseData.perSetDetails?.length,
    });

    // Look up previous workout data for this exercise
    const prevDataRecord = await getPreviousExerciseData([exerciseData.name], userId);
    const prevData = prevDataRecord[exerciseData.name];

    // Determine number of sets: voice input > previous data > default 3
    const numSets = exerciseData.perSetDetails?.length || exerciseData.setsCount || (prevData?.sets?.length) || 4;
    const defaultReps = exerciseData.reps ? String(exerciseData.reps) : '8';
    const voiceWeight = exerciseData.weight; // Weight from voice (already converted)

    // Create sets based on perSetDetails > previous data > defaults
    let sets: WorkoutSet[];
    if (exerciseData.perSetDetails && exerciseData.perSetDetails.length > 0) {
      // Use per-set details from voice (each set has different weight/reps)
      sets = exerciseData.perSetDetails.map((setDetail, i) => ({
        id: unsafeCoerceSetId(`s${timestamp}-${i}`),
        reps: setDetail.reps || defaultReps,
        weight: setDetail.weight ?? voiceWeight,
        setType: setDetail.setType === 'normal' ? 'working' : setDetail.setType,
        isCompleted: false,
      }));
      console.log('[Voice] Applied perSetDetails:', exerciseData.perSetDetails);
    } else if (voiceWeight !== undefined) {
      // Voice specified a single weight for all sets
      sets = Array.from({ length: numSets }, (_, i) => ({
        id: unsafeCoerceSetId(`s${timestamp}-${i}`),
        reps: defaultReps,
        weight: voiceWeight,
        isCompleted: false,
      }));
      console.log('[Voice] Applied weight to all sets:', voiceWeight);
    } else if (prevData && prevData.sets && prevData.sets.length > 0 && !exerciseData.setsCount) {
      // Use previous workout data if no voice-specified sets/weight
      sets = prevData.sets.map((prevSet, i) => ({
        id: unsafeCoerceSetId(`s${timestamp}-${i}`),
        reps: prevSet.reps ? String(prevSet.reps) : defaultReps,
        weight: prevSet.weight ?? undefined,
        setType: prevSet.setType,
        isCompleted: false,
      }));
    } else {
      // Create specified number of sets with no weight
      sets = Array.from({ length: numSets }, (_, i) => ({
        id: unsafeCoerceSetId(`s${timestamp}-${i}`),
        reps: defaultReps,
        isCompleted: false,
      }));
    }

    setSession(prev => {
      if (!prev) return prev;
      const exerciseCount = prev.exercises.length;
      const newExercise: WorkoutExercise = {
        id: unsafeCoerceWorkoutExerciseId(`ex${timestamp}-${exerciseCount}`),
        name: exerciseData.name,
        sets,
        restTime: 60,
        currentSetIndex: 0,
        muscleGroups: exerciseData.muscles || [],
      };
      return { ...prev, exercises: [...prev.exercises, newExercise] };
    });
    setHasLiveEdits(true);
  }, [userId]);

  // Poll for selected exercise - checks every 500ms when session is active
  useEffect(() => {
    if (!session) return;

    const checkForSelectedExercise = async () => {
      try {
        const selected = await AsyncStorage.getItem(SELECTED_EXERCISE_KEY);
        if (selected) {
          const data = JSON.parse(selected);
          await AsyncStorage.removeItem(SELECTED_EXERCISE_KEY);
          addExerciseToSession(data);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (e) {
        console.error('Error checking for selected exercise:', e);
      }
    };

    // Check immediately on mount/session change
    checkForSelectedExercise();

    // Then poll every 500ms
    const pollInterval = setInterval(checkForSelectedExercise, 500);

    return () => clearInterval(pollInterval);
  }, [session, addExerciseToSession]);

  const handleAddExercise = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/exercise-picker');
  };

  // Handle voice exercises extracted from VoiceLoggingModal
  // OPTIMIZED: Batches all exercises into a single state update for instant loading
  const handleVoiceExercisesExtracted = useCallback(async (
    voiceExercises: {
      nameRaw: string;
      nameNormalized?: string;
      exerciseId?: string;
      matchConfidence?: number;
      sets: number;
      reps: string;
      weight?: number;
      weightUnit?: 'lbs' | 'kg';
      rpe?: number;
      restSeconds?: number;
      perSetDetails?: {
        reps: string;
        weight?: number;
        setType?: 'warmup' | 'working' | 'drop' | 'top' | 'failure' | 'normal';
      }[];
    }[],
    supersets?: { type: 'superset' | 'giant_set' | 'circuit'; exerciseOrders: number[] }[]
  ) => {
    console.log('[Voice] Received', voiceExercises.length, 'exercises from VoiceLoggingModal');
    if (supersets?.length) {
      console.log('[Voice] Received', supersets.length, 'superset(s)');
    }

    // Guard: no exercises
    if (!voiceExercises || voiceExercises.length === 0) {
      console.log('[Voice] No exercises to process');
      setVoiceModalVisible(false);
      return;
    }

    try {
      // Import alias lookup function (instant, no fuzzy search needed)
      const { lookupExerciseByAlias } = await import('@/lib/services/exercise/search');

      // Weight conversion helper - converts from voice unit to user preference
      const convertWeight = (w: number | undefined, fromUnit?: 'lbs' | 'kg'): number | undefined => {
        if (w === undefined || w === null) return undefined;
        if (!fromUnit || fromUnit === weightUnit) return w;
        if (fromUnit === 'kg' && weightUnit === 'lbs') return Math.round(w * 2.205);
        if (fromUnit === 'lbs' && weightUnit === 'kg') return Math.round(w / 2.205);
        return w;
      };

      // ============================================
      // STEP 1: BATCH PREFETCH - Single DB query for all exercise names
      // ============================================
      const exerciseNames = voiceExercises
        .map(ex => ex.nameNormalized || ex.nameRaw?.trim())
        .filter(Boolean) as string[];

      const prevDataMap = await getPreviousExerciseData(exerciseNames, userId);
      console.log('[Voice] Prefetched previous data for', exerciseNames.length, 'exercises');

      // ============================================
      // STEP 2: BUILD ALL EXERCISES - No state updates yet
      // ============================================
      const timestamp = Date.now();
      const newExercises: WorkoutExercise[] = [];

      for (let i = 0; i < voiceExercises.length; i++) {
        const ex = voiceExercises[i];

        // Validate required fields
        if (!ex.nameRaw) {
          console.warn('[Voice] Skipping exercise with no nameRaw');
          continue;
        }

        const rawName = ex.nameRaw.trim();
        if (!rawName) {
          console.warn('[Voice] Skipping exercise with empty name');
          continue;
        }

        // Match exercise to database (instant lookup)
        let matchedName = rawName;
        const directMatch = lookupExerciseByAlias(rawName);
        if (directMatch) {
          matchedName = directMatch.canonical_name;
          console.log('[Voice] Alias match:', rawName, '→', matchedName);
        } else {
          matchedName = ex.nameNormalized || rawName;
          console.log('[Voice] Using LLM normalized:', rawName, '→', matchedName);
        }

        // Get previous data (already prefetched)
        const prevData = prevDataMap[matchedName];

        // Build sets
        const numSets = ex.perSetDetails?.length || ex.sets || prevData?.sets?.length || 4;
        const defaultReps = ex.reps || '8';
        const convertedWeight = convertWeight(ex.weight, ex.weightUnit);

        let sets: WorkoutSet[];
        if (ex.perSetDetails && ex.perSetDetails.length > 0) {
          // Per-set details from voice
          sets = ex.perSetDetails.map((sd, j) => ({
            id: unsafeCoerceSetId(`s${timestamp}-${i}-${j}`),
            reps: sd.reps || defaultReps,
            weight: convertWeight(sd.weight, ex.weightUnit) ?? convertedWeight,
            setType: sd.setType === 'normal' ? 'working' : sd.setType,
            isCompleted: false,
          }));
        } else if (convertedWeight !== undefined) {
          // Single weight for all sets
          sets = Array.from({ length: numSets }, (_, j) => ({
            id: unsafeCoerceSetId(`s${timestamp}-${i}-${j}`),
            reps: defaultReps,
            weight: convertedWeight,
            isCompleted: false,
          }));
        } else if (prevData?.sets?.length && !ex.sets) {
          // Use previous workout data
          sets = prevData.sets.map((prevSet, j) => ({
            id: unsafeCoerceSetId(`s${timestamp}-${i}-${j}`),
            reps: prevSet.reps ? String(prevSet.reps) : defaultReps,
            weight: prevSet.weight ?? undefined,
            setType: prevSet.setType,
            isCompleted: false,
          }));
        } else {
          // Default sets
          sets = Array.from({ length: numSets }, (_, j) => ({
            id: unsafeCoerceSetId(`s${timestamp}-${i}-${j}`),
            reps: defaultReps,
            isCompleted: false,
          }));
        }

        newExercises.push({
          id: unsafeCoerceWorkoutExerciseId(`ex${timestamp}-${i}`),
          name: matchedName,
          sets,
          restTime: ex.restSeconds || 60,
          currentSetIndex: 0,
          muscleGroups: [],
        });

        console.log(`[Voice] Built: ${matchedName} - ${sets.length} sets`);
      }

      // ============================================
      // STEP 3: SINGLE STATE UPDATE - All exercises at once
      // ============================================
      if (newExercises.length > 0) {
        setSession(prev => {
          if (!prev) return prev;

          let updatedSession = {
            ...prev,
            exercises: [...prev.exercises, ...newExercises],
          };

          // Apply supersets if specified
          if (supersets && supersets.length > 0) {
            const startIndex = prev.exercises.length;

            for (const superset of supersets) {
              if (superset.exerciseOrders && superset.exerciseOrders.length >= 2) {
                const exerciseIds = superset.exerciseOrders
                  .map(order => {
                    const idx = order - 1; // Convert 1-indexed to 0-indexed
                    return idx >= 0 && idx < newExercises.length
                      ? newExercises[idx].id
                      : null;
                  })
                  .filter(Boolean) as string[];

                if (exerciseIds.length >= 2) {
                  console.log(`[Voice] Linking ${exerciseIds.length} exercises as ${superset.type}`);
                  updatedSession = linkMultipleExercisesAsSuperset(
                    updatedSession,
                    exerciseIds.map(id => unsafeCoerceWorkoutExerciseId(id))
                  );
                }
              }
            }
          }

          return updatedSession;
        });

        setHasLiveEdits(true);
        console.log('[Voice] Added', newExercises.length, 'exercises in single state update');
      }

      // Success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log('[Voice] Successfully processed', voiceExercises.length, 'exercises');

    } catch (error) {
      console.error('[Voice] Fatal error processing exercises:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setVoiceModalVisible(false);
  }, [weightUnit]);

  // Update workout context for UFIRE scoring when session changes
  useEffect(() => {
    if (session) {
      setWorkoutContext({
        completedExercises: session.exercises.map(e => ({
          name: e.name,
          muscleGroups: e.muscleGroups || [],
          setsCompleted: e.sets.filter(s => s.isCompleted).length,
          totalSets: e.sets.length,
        })),
        workoutType: inferWorkoutTypeFromExercises(session.exercises),
        elapsedMinutes: Math.floor(elapsedSeconds / 60),
      });
    }
    return () => setWorkoutContext(null);
  }, [session?.exercises, elapsedSeconds]);




  // Workout timer
  useEffect(() => {
    if (!session || session.status !== 'in_progress') return;
    const interval = setInterval(() => setElapsedSeconds(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [session?.status]);

  // Load previous exercise data when session exercises change
  useEffect(() => {
    if (!session?.exercises?.length) return;
    const exerciseNames = session.exercises.map(e => e.name);
    getPreviousExerciseData(exerciseNames, userId).then(data => {
      setPreviousData(data);
    });
  }, [session?.exercises?.length]);

  // Helper to find previous data for an exercise (case-insensitive)
  const getPrevDataForExercise = useCallback((exerciseName: string): PreviousExerciseData | undefined => {
    const normalizedName = exerciseName.toLowerCase().trim();
    if (repeatPrevData) {
      if (repeatPrevData[exerciseName]) return repeatPrevData[exerciseName];
      const repeatKey = Object.keys(repeatPrevData).find(k => k.toLowerCase().trim() === normalizedName);
      if (repeatKey) return repeatPrevData[repeatKey];
    }

    if (previousData[exerciseName]) return previousData[exerciseName];
    const key = Object.keys(previousData).find(k => k.toLowerCase().trim() === normalizedName);
    return key ? previousData[key] : undefined;
  }, [previousData, repeatPrevData]);

  useEffect(() => {
    if (!repeatFrom) {
      setRepeatPrevData(null);
      return;
    }

    const repeatId = Array.isArray(repeatFrom) ? repeatFrom[0] : repeatFrom;
    if (!repeatId) {
      setRepeatPrevData(null);
      return;
    }

    (async () => {
      try {
        const record = await getWorkoutRecordById(repeatId);
        if (!record) {
          setRepeatPrevData(null);
          return;
        }

        const map: Record<string, PreviousExerciseData> = {};
        for (const exercise of record.exercises) {
          if (!exercise.name) continue;
          if (map[exercise.name]) continue;
          const sets = (exercise.sets || []).map(set => ({
            reps: set.reps,
            weight: set.weight,
            setType: set.setType,
          }));
          map[exercise.name] = {
            exerciseName: exercise.name,
            date: record.completedAt,
            sets,
          };
        }

        setRepeatPrevData(map);
      } catch (error) {
        console.warn('[ActiveWorkout] Failed to load repeat history:', error);
        setRepeatPrevData(null);
      }
    })();
  }, [repeatFrom]);

  const restoreSessionFromState = (existing: ActiveWorkoutState, storageUserId: string) => {
    const catchUp = existing.session.status === 'in_progress'
      ? Math.max(0, Math.floor((Date.now() - existing.lastUpdatedAt) / 1000))
      : 0;
    setElapsedSeconds(existing.elapsedSeconds + catchUp);

    const restoredSession: any = {
      ...existing.session,
      startTime: new Date(existing.session.startTime),
      endTime: existing.session.endTime ? new Date(existing.session.endTime) : undefined,
      exercises: existing.session.exercises.map((ex: any) => ({
        ...ex,
        sets: ex.sets.map((s: any) => ({
          ...s,
          completedAt: s.completedAt ? new Date(s.completedAt) : undefined,
        })),
      })),
      isResting: false,
      restTimeRemaining: 0,
    };

    setProgramUserId(storageUserId);
    setHasLiveEdits(false);
    setSession(restoredSession);
  };

  const mapAssignedWorkoutRow = (row: Record<string, unknown>): AssignedWorkout => {
    const exercises = row.exercises
      ? (typeof row.exercises === 'string' ? JSON.parse(row.exercises) : row.exercises)
      : [];

    return {
      id: row.id as string,
      assignmentId: (row.assignment_id as string) || '',
      athleteUserId: (row.athlete_user_id as string) || userId,
      scheduledDate: new Date(row.scheduled_date as string),
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at as string) : undefined,
      scheduledTime: row.scheduled_time ? new Date(row.scheduled_time as string) : undefined,
      weekNumber: (row.week_number as number) || 1,
      dayNumber: (row.day_number as number) || 1,
      workoutName: (row.workout_name as string) || 'Assigned Workout',
      exercises: exercises as any,
      status: (row.status as any) || 'pending',
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      skippedReasonCode: row.skipped_reason_code as string | undefined,
      skippedReasonText: row.skipped_reason_text as string | undefined,
      skippedAt: row.skipped_at ? new Date(row.skipped_at as string) : undefined,
      actualResults: (row.actual_results as Record<string, unknown>) || {},
      athleteFeedback: row.athlete_feedback as string | undefined,
      athleteRating: row.athlete_rating as number | undefined,
      coachFeedback: row.coach_feedback as string | undefined,
      reminderSent: row.reminder_sent as boolean | undefined,
      incompleteNotificationSent: row.incomplete_notification_sent as boolean | undefined,
      createdAt: row.created_at ? new Date(row.created_at as string) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : new Date(),
    };
  };

  const loadAssignedWorkout = async () => {
    if (!resolvedAssignedId) {
      Alert.alert('Error', 'Missing assigned workout.');
      router.back();
      return;
    }

    const source = isAssignedWorkout ? 'assigned' : 'self';
    const existing = await getActiveWorkoutState(userId, source, workoutKey);
    if (existing?.session) {
      restoreSessionFromState(existing, userId);
      return;
    }

    let assignedWorkout = await getCachedWorkoutById(workoutKey);
    if (!assignedWorkout) {
      const { data, error } = await supabase
        .from('assigned_workouts')
        .select('*')
        .eq('id', resolvedAssignedId)
        .single();
      if (error || !data) {
        throw error || new Error('Assigned workout not found');
      }
      assignedWorkout = mapAssignedWorkoutRow(data as Record<string, unknown>);
      await upsertCachedWorkout(assignedWorkout);
    }

    const normalizedExercises = assignedWorkout.exercises.map((ex: any) => ({
      ...ex,
      restTime: ex.restTime ?? ex.restSeconds,
    }));

    const targetWorkout = {
      name: assignedWorkout.workoutName || 'Assigned Workout',
      exercises: normalizedExercises,
    };

    setWorkoutWeek(assignedWorkout.weekNumber);
    setWorkoutDay(assignedWorkout.dayNumber);

    const exercises: WorkoutExercise[] = targetWorkout.exercises.map((ex: any, index: number) => {
      const numSets = ex.perSetDetails?.length || ex.sets || 3;
      const defaultReps = ex.reps || 10;
      const defaultWeight = ex.weight != null
        ? (typeof ex.weight === 'number' ? ex.weight : parseFloat(ex.weight))
        : undefined;

      let sets: WorkoutSet[];
      if (ex.perSetDetails && ex.perSetDetails.length > 0) {
        sets = ex.perSetDetails.map((sd: any, setIndex: number) => ({
          id: unsafeCoerceSetId(`s${index}-${setIndex}`),
          reps: sd.reps || defaultReps,
          weight: sd.weight != null
            ? (typeof sd.weight === 'number' ? sd.weight : parseFloat(sd.weight))
            : defaultWeight,
          isCompleted: false,
        }));
      } else {
        sets = Array.from({ length: numSets }, (_, setIndex) => ({
          id: unsafeCoerceSetId(`s${index}-${setIndex}`),
          reps: defaultReps,
          weight: defaultWeight,
          isCompleted: false,
        }));
      }

      return {
        id: unsafeCoerceWorkoutExerciseId(`ex${index}`),
        name: ex.name || 'Unknown Exercise',
        sets,
        restTime: ex.restTime || 60,
        currentSetIndex: 0,
        muscleGroups: [],
      };
    });

    const newSession: WorkoutSession = {
      id: unsafeCoerceWorkoutSessionId(workoutKey),
      workoutName: targetWorkout.name,
      exercises,
      startTime: new Date(),
      currentExerciseIndex: 0,
      isResting: false,
      restTimeRemaining: 0,
      status: 'in_progress',
    };

    setProgramUserId(assignedWorkout.athleteUserId || userId);
    setBaseParsedData(null);
    setHasLiveEdits(false);
    setSession(newSession);

    try {
      if (await isOnline()) {
        await startWorkout(assignedWorkout.id);
      }
    } catch (error) {
      console.warn('[AssignedWorkout] startWorkout failed:', error);
    }
  };

  const loadWorkout = async () => {
    try {
      if (isAssignedWorkout) {
        await loadAssignedWorkout();
        return;
      }
      const program = await getProgram(id as string);
      if (!program || program.status !== 'READY') {
        Alert.alert('Error', 'This program is not ready to start yet.');
        router.back();
        return;
      }

      // Restore existing session
      const source = isAssignedWorkout ? 'assigned' : 'self';
      const existing = await getActiveWorkoutState(program.userId, source, workoutKey);
      if (existing?.session) {
        restoreSessionFromState(existing, program.userId);
        return;
      }

      // Load fresh workout
      const effectiveParsedDataRaw = (await getEffectiveProgramData(program)) as any;
      const effectiveParsedData = typeof effectiveParsedDataRaw === 'string'
        ? JSON.parse(effectiveParsedDataRaw)
        : effectiveParsedDataRaw;

      let targetWorkout = effectiveParsedData?.workouts?.[0];
      let targetWeek = targetWorkout?.week;
      let targetDay = targetWorkout?.day;

      if (selectedWeek !== undefined && selectedDay !== undefined) {
        const found = effectiveParsedData?.workouts?.find(
          (w: any) => w.week === selectedWeek && w.day === selectedDay
        );
        if (found) {
          targetWorkout = found;
          targetWeek = selectedWeek;
          targetDay = selectedDay;
        }
      }

      // Allow starting with empty exercises - user can add during workout
      if (!targetWorkout) {
        if (isQuickWorkout) {
          // Create empty workout for quick workout mode
          targetWorkout = { week: 1, day: 1, name: 'Quick Workout', exercises: [] };
        } else {
          // Create empty workout for regular programs too
          targetWorkout = { week: selectedWeek || 1, day: selectedDay || 1, name: program.name, exercises: [] };
        }
      }

      setWorkoutWeek(targetWeek);
      setWorkoutDay(targetDay);

      const exercises: WorkoutExercise[] = targetWorkout.exercises.map((ex: any, index: number) => {
        // CRITICAL: Use perSetDetails if available, otherwise use default weight/reps for all sets
        const numSets = ex.perSetDetails?.length || ex.sets || 3;
        const defaultReps = ex.reps || 10;
        const defaultWeight = ex.weight != null
          ? (typeof ex.weight === 'number' ? ex.weight : parseFloat(ex.weight))
          : undefined;

        let sets: WorkoutSet[];
        if (ex.perSetDetails && ex.perSetDetails.length > 0) {
          // Use per-set details for variable weights/reps
          sets = ex.perSetDetails.map((sd: any, setIndex: number) => ({
            id: unsafeCoerceSetId(`s${index}-${setIndex}`),
            reps: sd.reps || defaultReps,
            weight: sd.weight != null
              ? (typeof sd.weight === 'number' ? sd.weight : parseFloat(sd.weight))
              : defaultWeight,
            isCompleted: false,
          }));
          console.log(`[loadWorkout] Exercise "${ex.name}" using perSetDetails:`, ex.perSetDetails);
        } else {
          // Use same weight/reps for all sets
          sets = Array.from({ length: numSets }, (_, setIndex) => ({
            id: unsafeCoerceSetId(`s${index}-${setIndex}`),
            reps: defaultReps,
            weight: defaultWeight,
            isCompleted: false,
          }));
        }

        return {
          id: unsafeCoerceWorkoutExerciseId(`ex${index}`),
          name: ex.name || 'Unknown Exercise',
          sets,
          restTime: ex.restTime || 60,
          currentSetIndex: 0,
          muscleGroups: [],
        };
      });

      const newSession: WorkoutSession = {
        id: unsafeCoerceWorkoutSessionId(workoutKey),
        workoutName: targetWorkout.name || program.name,
        exercises,
        startTime: new Date(),
        currentExerciseIndex: 0,
        isResting: false,
        restTimeRemaining: 0,
        status: 'in_progress',
      };

      setProgramUserId(program.userId);
      setBaseParsedData(effectiveParsedData);
      setHasLiveEdits(false);
      await clearPendingWorkoutEdits(program.userId, program.id);
      setSession(newSession);
    } catch (error) {
      console.error('Error loading workout:', error);
      Alert.alert('Error', 'Failed to load workout. Please try again.');
      router.back();
    }
  };

  const completeSet = () => {
    if (!session || !currentExercise || session.isResting) return;

    // Satisfying haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Completion animation
    completionScale.value = withSequence(
      withSpring(1.2, { damping: 8, stiffness: 400 }),
      withSpring(1, { damping: 12 })
    );

    setSession(prev => {
      if (!prev) return prev;
      const newSession = { ...prev };
      const exercise = newSession.exercises[prev.currentExerciseIndex];
      const set = exercise.sets[currentSetIndex];

      set.isCompleted = true;
      set.completedAt = new Date();
      set.actualReps = typeof set.reps === 'number' ? set.reps : parseInt(set.reps as string);
      set.actualWeight = set.weight;

      // Check if this exercise is part of a superset
      const supersetGroup = getSupersetGroup(newSession, exercise.id);

      if (supersetGroup) {
        // Handle superset flow: A → rest → B → rest → A...
        return handleSupersetSetCompletion(newSession, exercise, supersetGroup, currentSetIndex, prev.currentExerciseIndex);
      }

      // Standard (non-superset) flow
      if (currentSetIndex < exercise.sets.length - 1) {
        exercise.currentSetIndex = currentSetIndex + 1;
        newSession.isResting = true;
        newSession.restTimeRemaining = exercise.restTime;
        newSession.restExerciseIndex = prev.currentExerciseIndex;
        newSession.restAfterSetIndex = currentSetIndex;
      } else if (prev.currentExerciseIndex < newSession.exercises.length - 1) {
        newSession.currentExerciseIndex = prev.currentExerciseIndex + 1;
        newSession.exercises[prev.currentExerciseIndex + 1].currentSetIndex = 0;
      }
      // Last set of last exercise - user will click Finish manually

      return newSession;
    });
  };

  /**
   * Handle set completion within a superset
   * Flow: A1 → rest(45s) → B1 → rest(90s) → A2 → rest(45s) → B2 → rest(90s) → ...
   */
  const handleSupersetSetCompletion = (
    session: WorkoutSession,
    currentExercise: WorkoutExercise,
    group: SupersetGroup,
    completedSetIndex: number,
    exerciseIndex: number
  ): WorkoutSession => {
    const newSession = { ...session };
    const supersetExercises = getSupersetExercises(newSession, group.id);
    const isExerciseA = currentExercise.supersetOrder === 1;
    const isExerciseB = currentExercise.supersetOrder === 2;

    // Find partner exercise
    const partnerExercise = supersetExercises.find(e => e.id !== currentExercise.id);
    const partnerIndex = newSession.exercises.findIndex(e => e.id === partnerExercise?.id);

    // Update superset groups with new phase
    newSession.supersetGroups = newSession.supersetGroups?.map(g => {
      if (g.id !== group.id) return g;
      return { ...g };
    });

    const updatedGroup = newSession.supersetGroups?.find(g => g.id === group.id);
    if (!updatedGroup) return newSession;

    if (isExerciseA) {
      // Just completed a set in exercise A
      // → Short rest (restBetween) → Switch to exercise B
      if (partnerExercise && partnerIndex >= 0) {
        // Check if partner has sets remaining at current round
        const currentRoundSetIndex = updatedGroup.currentRound - 1;
        const partnerHasSetsRemaining = partnerExercise.sets[currentRoundSetIndex] &&
          !partnerExercise.sets[currentRoundSetIndex].isCompleted;

        if (partnerHasSetsRemaining) {
          // Switch to exercise B after short rest
          updatedGroup.currentPhase = 'rest_ab';
          newSession.isResting = true;
          newSession.restTimeRemaining = group.restBetween;
          newSession.restExerciseIndex = exerciseIndex;
          newSession.restAfterSetIndex = completedSetIndex;
          newSession.activeSupersetId = group.id;

          // Queue switch to exercise B after rest completes
          // (handled by rest completion effect)
          newSession.currentExerciseIndex = partnerIndex;
          partnerExercise.currentSetIndex = currentRoundSetIndex;
        } else {
          // Partner has no sets remaining, move to next round or finish superset
          moveToNextRoundOrFinish(newSession, updatedGroup, supersetExercises, exerciseIndex);
        }
      }
    } else if (isExerciseB) {
      // Just completed a set in exercise B
      // → Full rest (restAfterRound) → Back to exercise A for next round
      const exerciseA = supersetExercises.find(e => e.supersetOrder === 1);
      const exerciseAIndex = newSession.exercises.findIndex(e => e.id === exerciseA?.id);

      // Check if there are more rounds to do
      const nextRound = updatedGroup.currentRound + 1;
      const exerciseAHasMoreSets = exerciseA && exerciseA.sets.length >= nextRound;

      if (exerciseAHasMoreSets && exerciseA && exerciseAIndex >= 0) {
        // Start full rest, then return to exercise A
        updatedGroup.currentPhase = 'rest_ba';
        updatedGroup.currentRound = nextRound;
        newSession.isResting = true;
        newSession.restTimeRemaining = group.restAfterRound;
        newSession.restExerciseIndex = exerciseIndex;
        newSession.restAfterSetIndex = completedSetIndex;
        newSession.activeSupersetId = group.id;

        // Queue switch back to exercise A
        newSession.currentExerciseIndex = exerciseAIndex;
        exerciseA.currentSetIndex = nextRound - 1;
      } else {
        // Superset complete, move to next exercise outside superset
        moveToNextRoundOrFinish(newSession, updatedGroup, supersetExercises, exerciseIndex);
      }
    }

    return newSession;
  };

  /**
   * Move to next round in superset or finish and move to next exercise
   */
  const moveToNextRoundOrFinish = (
    session: WorkoutSession,
    group: SupersetGroup,
    supersetExercises: WorkoutExercise[],
    currentExerciseIndex: number
  ) => {
    // Check if all exercises in superset are complete
    const allSupersetComplete = supersetExercises.every(ex =>
      ex.sets.every(s => s.isCompleted)
    );

    if (allSupersetComplete) {
      // Find the highest index of superset exercises to move past
      const maxSupersetIndex = Math.max(
        ...supersetExercises.map(e => session.exercises.findIndex(ex => ex.id === e.id))
      );

      // Move to next exercise after the superset
      if (maxSupersetIndex < session.exercises.length - 1) {
        session.currentExerciseIndex = maxSupersetIndex + 1;
        session.exercises[maxSupersetIndex + 1].currentSetIndex = 0;
        session.activeSupersetId = undefined;
      } else {
        // Superset complete, stay here - user clicks Finish manually
      }
    }

    // Reset phase
    group.currentPhase = 'exercise_a';
  };

  // Rest countdown - only depends on isResting and status, not restTimeRemaining
  // The interval callback uses prev state so it always has the current value
  useEffect(() => {
    if (!session?.isResting || session.status !== 'in_progress') return;

    const interval = setInterval(() => {
      setSession(prev => {
        if (!prev?.isResting || prev.status !== 'in_progress') return prev;
        const currentRemaining = prev.restTimeRemaining ?? 0;
        if (currentRemaining <= 0) return prev;

        const nextRemaining = currentRemaining - 1;

        if (nextRemaining <= 0) {
          lastRestEndReasonRef.current = 'completed';

          // Handle superset phase transition when rest ends
          let updatedSession = { ...prev, isResting: false, restTimeRemaining: 0 };

          if (prev.activeSupersetId) {
            updatedSession = {
              ...updatedSession,
              supersetGroups: prev.supersetGroups?.map(g => {
                if (g.id !== prev.activeSupersetId) return g;
                // Transition from rest phase to exercise phase
                const newPhase: SupersetPhase =
                  g.currentPhase === 'rest_ab' ? 'exercise_b' :
                    g.currentPhase === 'rest_ba' ? 'exercise_a' :
                      g.currentPhase;
                return { ...g, currentPhase: newPhase };
              }),
            };
          }

          return updatedSession;
        }

        // Countdown haptics at 3, 2, 1
        if (nextRemaining <= 3) {
          Haptics.selectionAsync();
        }

        return { ...prev, restTimeRemaining: nextRemaining };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.isResting, session?.status]);

  // Rest completion audio cue - bell sound + vibration
  useEffect(() => {
    const isRestingNow = !!session?.isResting;
    const wasResting = wasRestingRef.current;
    wasRestingRef.current = isRestingNow;

    if (wasResting && !isRestingNow && lastRestEndReasonRef.current === 'completed') {
      lastRestEndReasonRef.current = null;
      // Defer to next tick to avoid setState during render warning
      setTimeout(playRestCompleteBell, 0);
    }
  }, [session?.isResting]);

  // Persist session
  useEffect(() => {
    if (!session || !programUserId) return;
    const t = setTimeout(() => {
      const stored: StoredWorkoutSession = {
        ...session,
        source: isAssignedWorkout ? 'assigned' : 'self',
        assignedWorkoutId: isAssignedWorkout ? resolvedAssignedId : undefined,
        workoutKey,
        programId: isAssignedWorkout ? undefined : (session as any).programId ?? String(id),
        startTime: session.startTime instanceof Date ? session.startTime.toISOString() : String(session.startTime),
        endTime: (session as any).endTime ? new Date((session as any).endTime).toISOString() : undefined,
        exercises: session.exercises.map((ex: any) => ({
          ...ex,
          sets: ex.sets.map((s: any) => ({
            ...s,
            completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : undefined,
          })),
        })),
      };
      const source = isAssignedWorkout ? 'assigned' : 'self';
      setActiveWorkoutState(programUserId, source, workoutKey, { session: stored, elapsedSeconds, lastUpdatedAt: Date.now() });
    }, 250);
    return () => clearTimeout(t);
  }, [session, elapsedSeconds, programUserId, workoutKey, isAssignedWorkout, resolvedAssignedId, id]);

  // Persist edits
  useEffect(() => {
    if (isAssignedWorkout || !hasLiveEdits || !session || !baseParsedData || !programUserId) return;
    const t = setTimeout(() => {
      try {
        const nextParsed = JSON.parse(JSON.stringify(baseParsedData));
        const firstWorkout = nextParsed?.workouts?.[0];
        if (firstWorkout) {
          firstWorkout.exercises = session.exercises.map((ex: any) => ({
            name: ex.name,
            sets: ex.sets.length,
            reps: ex.sets?.[0]?.reps ?? 10,
            weight: ex.sets?.[0]?.weight != null ? String(ex.sets[0].weight) : undefined,
            restTime: ex.restTime,
          }));
        }
        setPendingWorkoutEdits(programUserId, String(id), nextParsed);
      } catch (e) {
        console.error('Failed to persist workout edits', e);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [hasLiveEdits, session, baseParsedData, programUserId, id, isAssignedWorkout]);

  const updateSetTarget = (updates: { reps?: string; weight?: number | null }) => {
    if (!currentExercise) return;
    updateAnySet(session!.currentExerciseIndex, currentSetIndex, updates);
  };

  // Update any set in any exercise (including restAfter timer config)
  const updateAnySet = (exerciseIndex: number, setIndex: number, updates: {
    reps?: string;
    weight?: number | null;
    restAfter?: { enabled: boolean; duration: number };
  }) => {
    setHasLiveEdits(true);
    setSession(prev => {
      if (!prev) return prev;
      const next = { ...prev, exercises: [...prev.exercises] };
      const ex = { ...next.exercises[exerciseIndex], sets: [...next.exercises[exerciseIndex].sets] };
      const set = { ...ex.sets[setIndex] };
      if (updates.reps !== undefined) set.reps = updates.reps;
      if (updates.weight !== undefined) set.weight = updates.weight === null ? undefined : updates.weight;
      if (updates.restAfter !== undefined) set.restAfter = updates.restAfter;
      ex.sets[setIndex] = set;
      next.exercises[exerciseIndex] = ex;
      return next;
    });
  };

  // Update exercise rest time
  const updateExerciseRestTime = (exerciseIndex: number, restSeconds: number) => {
    setHasLiveEdits(true);
    setSession(prev => {
      if (!prev) return prev;
      const next = { ...prev, exercises: [...prev.exercises] };
      next.exercises[exerciseIndex] = { ...next.exercises[exerciseIndex], restTime: restSeconds };
      return next;
    });
  };

  // Add a set to an exercise
  const addSetToExercise = (exerciseIndex: number) => {
    setHasLiveEdits(true);
    setSession(prev => {
      if (!prev) return prev;
      const next = { ...prev, exercises: [...prev.exercises] };
      const ex = next.exercises[exerciseIndex];
      const lastSet = ex.sets[ex.sets.length - 1];
      const newSet: WorkoutSet = {
        id: unsafeCoerceSetId(`s${exerciseIndex}-${ex.sets.length}`),
        reps: lastSet?.reps ?? '10',
        weight: lastSet?.weight,
        isCompleted: false,
      };
      next.exercises[exerciseIndex] = { ...ex, sets: [...ex.sets, newSet] };
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Remove a set from an exercise
  const removeSetFromExercise = (exerciseIndex: number, setIndex: number) => {
    setHasLiveEdits(true);
    setSession(prev => {
      if (!prev) return prev;
      const ex = prev.exercises[exerciseIndex];

      // If this is the last set, remove the entire exercise
      if (ex.sets.length <= 1) {
        const newExercises = prev.exercises.filter((_, i) => i !== exerciseIndex);
        const newCurrentIndex = Math.min(prev.currentExerciseIndex, Math.max(0, newExercises.length - 1));
        return { ...prev, exercises: newExercises, currentExerciseIndex: newCurrentIndex };
      }

      // Otherwise just remove the set
      const next = { ...prev, exercises: [...prev.exercises] };
      const newSets = ex.sets.filter((_, i) => i !== setIndex);
      const newCurrentSetIndex = Math.min(ex.currentSetIndex, newSets.length - 1);
      next.exercises[exerciseIndex] = { ...ex, sets: newSets, currentSetIndex: newCurrentSetIndex };
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Remove an exercise from the workout
  const removeExercise = (exerciseIndex: number) => {
    if (!session || session.exercises.length <= 0) return;

    const exerciseName = session.exercises[exerciseIndex]?.name || 'this exercise';

    Alert.alert(
      'Remove Exercise',
      `Are you sure you want to remove "${exerciseName}" from this workout?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setHasLiveEdits(true);
            setSession(prev => {
              if (!prev) return prev;
              const newExercises = prev.exercises.filter((_, i) => i !== exerciseIndex);
              const newCurrentIndex = Math.min(prev.currentExerciseIndex, Math.max(0, newExercises.length - 1));
              return { ...prev, exercises: newExercises, currentExerciseIndex: newCurrentIndex };
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  // Update set type
  const updateSetType = (exerciseIndex: number, setIndex: number, setType: SetType) => {
    setHasLiveEdits(true);
    Haptics.selectionAsync();
    setSession(prev => {
      if (!prev) return prev;
      const next = { ...prev, exercises: [...prev.exercises] };
      const ex = { ...next.exercises[exerciseIndex], sets: [...next.exercises[exerciseIndex].sets] };
      ex.sets[setIndex] = { ...ex.sets[setIndex], setType };
      next.exercises[exerciseIndex] = ex;
      return next;
    });
  };

  // Cycle through set types
  const cycleSetType = (exerciseIndex: number, setIndex: number) => {
    const currentType = session?.exercises[exerciseIndex]?.sets[setIndex]?.setType || 'working';
    const types: SetType[] = ['warmup', 'working', 'top', 'drop', 'failure'];
    const currentIndex = types.indexOf(currentType);
    const nextType = types[(currentIndex + 1) % types.length];
    updateSetType(exerciseIndex, setIndex, nextType);
  };

  // Add a drop set (child of the current set)
  const addDropSet = (exerciseIndex: number, afterSetIndex: number) => {
    setHasLiveEdits(true);
    setSession(prev => {
      if (!prev) return prev;
      const next = { ...prev, exercises: [...prev.exercises] };
      const ex = next.exercises[exerciseIndex];
      const parentSet = ex.sets[afterSetIndex];

      const dropSet: WorkoutSet = {
        id: unsafeCoerceSetId(`s${exerciseIndex}-${ex.sets.length}-drop`),
        reps: parentSet.reps,
        weight: parentSet.weight ? Math.round(parentSet.weight * 0.7) : undefined, // 70% of parent weight
        isCompleted: false,
        setType: 'drop',
        parentSetId: parentSet.id,
      };

      // Insert drop set right after the parent
      const newSets = [...ex.sets];
      newSets.splice(afterSetIndex + 1, 0, dropSet);
      next.exercises[exerciseIndex] = { ...ex, sets: newSets };
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // ============ Superset Management (Multi-select up to 4 exercises) ============

  // Toggle exercise selection for superset (tap to select/deselect)
  const toggleSupersetSelection = (exerciseId: string) => {
    if (!session) return;
    const exercise = session.exercises.find(e => e.id === exerciseId);

    // Don't allow selecting if already in a superset
    if (exercise?.supersetGroupId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setSupersetSelectedIds(prev => {
      if (prev.includes(exerciseId)) {
        // Deselect
        Haptics.selectionAsync();
        return prev.filter(id => id !== exerciseId);
      } else {
        // Select (max 4)
        if (prev.length >= 4) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return prev;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return [...prev, exerciseId];
      }
    });
  };

  // Start superset selection mode (long-press or tap link button)
  const startSupersetSelection = (exerciseId: string) => {
    if (!session) return;
    const exercise = session.exercises.find(e => e.id === exerciseId);
    // Don't allow if already in a superset
    if (exercise?.supersetGroupId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSupersetSelectedIds([exerciseId]);
  };

  // Cancel superset selection mode
  const cancelSupersetSelection = () => {
    setSupersetSelectedIds([]);
  };

  // Complete superset creation with all selected exercises
  const completeSupersetSelection = () => {
    if (!session || supersetSelectedIds.length < 2) return;

    // Create the superset with all selected exercises
    setHasLiveEdits(true);
    const updatedSession = linkMultipleExercisesAsSuperset(
      session,
      supersetSelectedIds.map(id => unsafeCoerceWorkoutExerciseId(id)),
      45, // Short rest between exercises
      90  // Full rest after round
    );
    setSession(updatedSession);
    setSupersetSelectedIds([]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Update superset rest times
  const updateSupersetRestTimes = (groupId: string, restBetween?: number, restAfterRound?: number) => {
    setHasLiveEdits(true);
    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        supersetGroups: prev.supersetGroups?.map(g => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            restBetween: restBetween ?? g.restBetween,
            restAfterRound: restAfterRound ?? g.restAfterRound,
          };
        }),
      };
    });
  };

  // Remove a superset grouping
  const handleUnlinkSuperset = (groupId: string) => {
    if (!session) return;

    const doUnlink = () => {
      setHasLiveEdits(true);
      const updatedSession = unlinkSuperset(session, unsafeCoerceSupersetGroupId(groupId));
      setSession(updatedSession);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Unlink superset?\n\nThis will separate the exercises back to individual sets.')) {
        doUnlink();
      }
    } else {
      Alert.alert('Unlink superset?', 'This will separate the exercises back to individual sets.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unlink', style: 'destructive', onPress: doUnlink },
      ]);
    }
  };

  // Check if an exercise is selected for superset
  const isSelectedForSuperset = (exerciseId: string): boolean => {
    return supersetSelectedIds.includes(exerciseId);
  };

  // Check if an exercise can be selected for superset
  const canSelectForSuperset = (exerciseId: string): boolean => {
    const exercise = session?.exercises.find(e => e.id === exerciseId);
    return !exercise?.supersetGroupId;
  };

  const skipRest = () => {
    lastRestEndReasonRef.current = 'skipped';
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSession(prev => prev ? { ...prev, isResting: false, restTimeRemaining: 0 } : prev);
  };

  /**
   * Complete any set in any exercise, regardless of rest timer state.
   * If rest is in progress, logs the elapsed rest time and starts a new rest timer.
   */
  const completeAnySet = (exerciseIndex: number, setIndex: number) => {
    if (!session) return;

    const exercise = session.exercises[exerciseIndex];
    if (!exercise || !exercise.sets[setIndex] || exercise.sets[setIndex].isCompleted) return;
    setLastCompletedSetId(exercise.sets[setIndex].id);

    // Satisfying haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Completion animation
    completionScale.value = withSequence(
      withSpring(1.2, { damping: 8, stiffness: 400 }),
      withSpring(1, { damping: 12 })
    );

    setSession(prev => {
      if (!prev) return prev;

      // Deep copy the exercises array
      const newExercises = prev.exercises.map((ex, idx) => ({
        ...ex,
        sets: ex.sets.map(s => ({ ...s })),
      }));

      const newSession = { ...prev, exercises: newExercises };
      const ex = newSession.exercises[exerciseIndex];
      const set = ex.sets[setIndex];

      // If rest was in progress, log the elapsed rest time on the set that rest was for
      if (prev.isResting && prev.restExerciseIndex !== undefined && prev.restAfterSetIndex !== undefined) {
        const restExercise = newSession.exercises[prev.restExerciseIndex];
        if (restExercise) {
          const nextSetIndex = prev.restAfterSetIndex + 1;
          // The rest was before this next set, so log elapsed time there
          if (nextSetIndex < restExercise.sets.length) {
            const originalRestTime = restExercise.restTime || 60;
            const elapsedRest = originalRestTime - (prev.restTimeRemaining ?? 0);
            restExercise.sets[nextSetIndex].actualRestTime = Math.max(0, elapsedRest);
          }
        }
      }

      // Mark the set as complete
      set.isCompleted = true;
      set.completedAt = new Date();
      set.actualReps = typeof set.reps === 'number' ? set.reps : parseInt(set.reps as string);
      set.actualWeight = set.weight;

      // Update current exercise/set indices
      newSession.currentExerciseIndex = exerciseIndex;
      ex.currentSetIndex = setIndex < ex.sets.length - 1 ? setIndex + 1 : setIndex;

      // Start new rest timer for the completed set (unless it's the last set of the exercise)
      const restTime = ex.restTime || 60; // Default to 60 seconds if not set
      if (setIndex < ex.sets.length - 1) {
        newSession.isResting = true;
        newSession.restTimeRemaining = restTime;
        newSession.restExerciseIndex = exerciseIndex;
        newSession.restAfterSetIndex = setIndex;
      } else {
        // Last set of exercise - no rest needed, move to next exercise
        newSession.isResting = false;
        newSession.restTimeRemaining = 0;
        if (exerciseIndex < newSession.exercises.length - 1) {
          newSession.currentExerciseIndex = exerciseIndex + 1;
          newSession.exercises[exerciseIndex + 1].currentSetIndex = 0;
        } else {
          // All sets complete - user will click Finish manually
        }
      }

      return newSession;
    });

    setHasLiveEdits(true);
  };

  /**
   * Uncomplete a set (undo a mistaken check).
   * Resets the timer and marks the set as incomplete.
   */
  const uncompleteSet = (exerciseIndex: number, setIndex: number) => {
    if (!session) return;

    const exercise = session.exercises[exerciseIndex];
    if (!exercise || !exercise.sets[setIndex] || !exercise.sets[setIndex].isCompleted) return;

    // Light haptic for undo
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setSession(prev => {
      if (!prev) return prev;

      const newExercises = prev.exercises.map((ex, idx) => ({
        ...ex,
        sets: ex.sets.map(s => ({ ...s })),
      }));

      const targetExercise = newExercises[exerciseIndex];
      const targetSet = targetExercise.sets[setIndex];

      // Mark set as incomplete
      targetSet.isCompleted = false;
      targetSet.completedAt = undefined;
      targetSet.actualReps = undefined;
      targetSet.actualWeight = undefined;

      // Reset to this set as current
      targetExercise.currentSetIndex = setIndex;

      // Stop any active rest timer
      const newSession: WorkoutSession = {
        ...prev,
        exercises: newExercises,
        isResting: false,
        restTimeRemaining: 0,
        restExerciseIndex: undefined,
        restAfterSetIndex: undefined,
      };

      return newSession;
    });

    setHasLiveEdits(true);
  };

  const addRestSeconds = (delta: number) => {
    Haptics.selectionAsync();
    setSession(prev => {
      if (!prev?.isResting) return prev;
      return { ...prev, restTimeRemaining: Math.max(0, (prev.restTimeRemaining ?? 0) + delta) };
    });
  };

  const navigateToExercise = (index: number) => {
    if (!session || index < 0 || index >= session.exercises.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSession(prev => prev ? { ...prev, currentExerciseIndex: index } : prev);
  };

  const handleWorkoutComplete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSession(prev => prev ? { ...prev, status: 'completed', endTime: new Date() } : prev);
    const params = new URLSearchParams();
    if (workoutWeek !== undefined) params.set('week', String(workoutWeek));
    if (workoutDay !== undefined) params.set('day', String(workoutDay));
    params.set('duration', String(elapsedSeconds));
    if (isAssignedWorkout) {
      params.set('source', 'assigned');
      params.set('workoutId', workoutKey);
    }
    router.push(`/workout/${id}/summary?${params.toString()}`);
  };

  const finishEarly = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Finish workout?\n\nThis will end your workout and save your progress.')) {
        handleWorkoutComplete();
      }
    } else {
      Alert.alert('Finish workout?', 'This will end your workout and save your progress.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Finish', onPress: handleWorkoutComplete },
      ]);
    }
  };

  const discardWorkout = async () => {
    const doDiscard = async () => {
      if (programUserId) {
        const source = isAssignedWorkout ? 'assigned' : 'self';
        await clearActiveWorkoutState(programUserId, source, workoutKey);
        if (!isAssignedWorkout) {
          await clearPendingWorkoutEdits(programUserId, String(id));
        }
      }
      router.replace('/(tabs)');
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Discard workout?\n\nAll progress will be lost.')) doDiscard();
    } else {
      Alert.alert('Discard workout?', 'All progress will be lost.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: doDiscard },
      ]);
    }
  };

  const handleExit = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Leave workout?\n\nYour progress is saved.')) router.back();
    } else {
      Alert.alert('Leave workout?', 'Your progress is saved.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', onPress: () => router.back() },
      ]);
    }
  };

  // Format rest time
  const formatRest = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}`;
  };

  if (!session) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText style={{ color: colors.textSecondary }}>Loading...</ThemedText>
      </ThemedView>
    );
  }

  const completedSetsInExercise = currentExercise?.sets.filter(s => s.isCompleted).length ?? 0;
  const totalSetsInExercise = currentExercise?.sets.length ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Minimal Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.topBarButton} onPress={handleExit}>
          <IconSymbol name="xmark" size={20} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.timerContainer}>
          <IconSymbol name="timer" size={14} color={colors.textTertiary} />
          <ThemedText style={[styles.timerText, { color: colors.text }]}>
            {formatDuration(elapsedSeconds)}
          </ThemedText>
        </View>

        <View style={styles.topBarRight}>
          {/* Set Types Info Button - subtle access */}
          <SetTypesInfoButton onPress={openGuide} />

          <Pressable
            style={[styles.unitBadge, { backgroundColor: colors.tintMuted }]}
            onPress={() => {
              Haptics.selectionAsync();
              setWeightUnit(weightUnit === 'kg' ? 'lbs' : 'kg');
            }}
          >
            <ThemedText style={[styles.unitText, { color: colors.tint }]}>
              {weightUnit.toUpperCase()}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Exercise Navigation Pills - Only show when exercises exist */}
      {session.exercises.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.exerciseNav}
          style={styles.exerciseNavScroll}
        >
          {session.exercises.map((ex, idx) => {
            const isComplete = ex.sets.every(s => s.isCompleted);
            const isCurrent = idx === session.currentExerciseIndex;
            return (
              <Pressable
                key={ex.id}
                style={[
                  styles.exercisePill,
                  {
                    backgroundColor: isCurrent ? colors.tint : isComplete ? colors.tintMuted : colors.elevated,
                    borderColor: isCurrent ? colors.tint : colors.separator,
                  },
                ]}
                onPress={() => navigateToExercise(idx)}
              >
                {isComplete && !isCurrent ? (
                  <IconSymbol name="checkmark" size={12} color={colors.tint} />
                ) : (
                  <ThemedText
                    style={[
                      styles.exercisePillText,
                      { color: isCurrent ? '#fff' : colors.textSecondary },
                    ]}
                  >
                    {idx + 1}
                  </ThemedText>
                )}
              </Pressable>
            );
          })}
          <Pressable
            style={[styles.addExercisePill, { borderColor: colors.separator }]}
            onPress={handleAddExercise}
          >
            <IconSymbol name="plus" size={14} color={colors.tint} />
          </Pressable>
        </ScrollView>
      )}

      {/* Main Scrollable Content */}
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {session.exercises.length === 0 ? (
          <View style={styles.emptyContainer}>
            <EmptyWorkoutState colors={colors} onAddExercise={handleAddExercise} />
          </View>
        ) : (
          <>
            {/* Superset Multi-Select Banner */}
            {supersetSelectedIds.length > 0 && (
              <View style={[styles.linkingBanner, { backgroundColor: SUPERSET_COLORS.primaryLight }]}>
                <View style={styles.linkingBannerContent}>
                  <IconSymbol name="link" size={16} color={SUPERSET_COLORS.text} />
                  <ThemedText style={[styles.linkingBannerText, { color: SUPERSET_COLORS.text }]}>
                    {supersetSelectedIds.length === 1
                      ? 'Tap exercises to add (2-4)'
                      : `${supersetSelectedIds.length} selected`}
                  </ThemedText>
                  {/* Selection count badge */}
                  <View style={[styles.selectionCountBadge, { backgroundColor: SUPERSET_COLORS.primary }]}>
                    <ThemedText style={styles.selectionCountText}>
                      {supersetSelectedIds.length}/4
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.linkingBannerActions}>
                  {/* Done button - appears when 2+ selected */}
                  {supersetSelectedIds.length >= 2 && (
                    <Pressable
                      style={[styles.supersetDoneBtn, { backgroundColor: SUPERSET_COLORS.primary }]}
                      onPress={completeSupersetSelection}
                    >
                      <IconSymbol name="checkmark" size={14} color="#fff" />
                      <ThemedText style={styles.supersetDoneBtnText}>Done</ThemedText>
                    </Pressable>
                  )}
                  <Pressable onPress={cancelSupersetSelection} hitSlop={12}>
                    <ThemedText style={[styles.linkingBannerCancel, { color: colors.textSecondary }]}>
                      Cancel
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            )}

            {/* EXERCISE LIST: All Exercises with Sets */}
            <View style={styles.exerciseListSection}>
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                ALL EXERCISES
              </ThemedText>

              {session.exercises.map((exercise, exerciseIndex) => {
                const isCurrentExercise = exerciseIndex === session.currentExerciseIndex;
                const completedSets = exercise.sets.filter(s => s.isCompleted).length;
                const allComplete = completedSets === exercise.sets.length;
                const isInSupersetGroup = !!exercise.supersetGroupId;
                const isSelected = isSelectedForSuperset(exercise.id);
                const canSelect = canSelectForSuperset(exercise.id) && !isInSupersetGroup;
                const isInSelectionMode = supersetSelectedIds.length > 0;
                const isHighlightedForLinking = isSelected || (isInSelectionMode && canSelect);
                // Get selection order number (1-4) for selected exercises
                const selectionOrder = supersetSelectedIds.indexOf(exercise.id) + 1;

                return (
                  <View
                    key={exercise.id}
                    style={[
                      styles.exerciseListCard,
                      {
                        backgroundColor: isHighlightedForLinking ? SUPERSET_COLORS.primaryLight : colors.card,
                        borderColor: isSelected
                          ? SUPERSET_COLORS.primary
                          : (isInSelectionMode && canSelect)
                            ? SUPERSET_COLORS.primaryMuted
                            : isCurrentExercise
                              ? colors.tint
                              : colors.separator,
                        borderWidth: isHighlightedForLinking || isCurrentExercise ? 2 : StyleSheet.hairlineWidth,
                        borderStyle: (isInSelectionMode && canSelect && !isSelected) ? 'dashed' : 'solid',
                      },
                    ]}
                  >
                    {/* Selection order badge when selected for superset */}
                    {isSelected && selectionOrder > 0 && (
                      <View style={[styles.selectionOrderBadge, { backgroundColor: SUPERSET_COLORS.primary }]}>
                        <ThemedText style={styles.selectionOrderText}>{selectionOrder}</ThemedText>
                      </View>
                    )}
                    {/* Superset indicator badge with inline unlink */}
                    {isInSupersetGroup && (() => {
                      const supersetGroup = session.supersetGroups?.find(g => g.id === exercise.supersetGroupId);
                      const supersetLabel = exercise.supersetOrder
                        ? String.fromCharCode(64 + exercise.supersetOrder) // 1->A, 2->B, 3->C, 4->D
                        : 'A';
                      return (
                        <>
                          <View style={[styles.supersetBadge, { backgroundColor: SUPERSET_COLORS.primaryLight }]}>
                            <IconSymbol name="link" size={10} color={SUPERSET_COLORS.text} />
                            <ThemedText style={[styles.supersetBadgeText, { color: SUPERSET_COLORS.text }]}>
                              Superset {supersetLabel}
                            </ThemedText>
                            {/* Inline unlink button */}
                            <Pressable
                              onPress={() => handleUnlinkSuperset(exercise.supersetGroupId!)}
                              hitSlop={8}
                              style={styles.supersetUnlinkInline}
                            >
                              <IconSymbol name="xmark" size={10} color={SUPERSET_COLORS.text + '80'} />
                            </Pressable>
                          </View>

                          {/* Superset Rest Times (show on Exercise A only) */}
                          {exercise.supersetOrder === 1 && supersetGroup && (
                            <View style={styles.supersetRestRow}>
                              {/* Short Rest (A→B) */}
                              <View style={styles.supersetRestItem}>
                                <ThemedText style={[styles.supersetRestLabel, { color: SUPERSET_COLORS.text }]}>
                                  A→B rest
                                </ThemedText>
                                <View style={styles.restTimeControl}>
                                  <Pressable
                                    style={[styles.restTimeBtn, { backgroundColor: SUPERSET_COLORS.primaryLight }]}
                                    onPress={() => updateSupersetRestTimes(supersetGroup.id, Math.max(0, supersetGroup.restBetween - 15))}
                                  >
                                    <IconSymbol name="minus" size={12} color={SUPERSET_COLORS.text} />
                                  </Pressable>
                                  <TextInput
                                    value={String(supersetGroup.restBetween)}
                                    onChangeText={(v) => {
                                      const n = parseInt(v) || 0;
                                      updateSupersetRestTimes(supersetGroup.id, Math.max(0, n));
                                    }}
                                    style={[styles.supersetRestInput, { color: SUPERSET_COLORS.text, borderColor: SUPERSET_COLORS.border }]}
                                    keyboardType="number-pad"
                                  />
                                  <ThemedText style={[styles.restTimeUnit, { color: SUPERSET_COLORS.text }]}>s</ThemedText>
                                  <Pressable
                                    style={[styles.restTimeBtn, { backgroundColor: SUPERSET_COLORS.primaryLight }]}
                                    onPress={() => updateSupersetRestTimes(supersetGroup.id, supersetGroup.restBetween + 15)}
                                  >
                                    <IconSymbol name="plus" size={12} color={SUPERSET_COLORS.text} />
                                  </Pressable>
                                </View>
                              </View>

                              {/* Full Rest (after round) */}
                              <View style={styles.supersetRestItem}>
                                <ThemedText style={[styles.supersetRestLabel, { color: SUPERSET_COLORS.text }]}>
                                  Round rest
                                </ThemedText>
                                <View style={styles.restTimeControl}>
                                  <Pressable
                                    style={[styles.restTimeBtn, { backgroundColor: SUPERSET_COLORS.primaryLight }]}
                                    onPress={() => updateSupersetRestTimes(supersetGroup.id, undefined, Math.max(0, supersetGroup.restAfterRound - 15))}
                                  >
                                    <IconSymbol name="minus" size={12} color={SUPERSET_COLORS.text} />
                                  </Pressable>
                                  <TextInput
                                    value={String(supersetGroup.restAfterRound)}
                                    onChangeText={(v) => {
                                      const n = parseInt(v) || 0;
                                      updateSupersetRestTimes(supersetGroup.id, undefined, Math.max(0, n));
                                    }}
                                    style={[styles.supersetRestInput, { color: SUPERSET_COLORS.text, borderColor: SUPERSET_COLORS.border }]}
                                    keyboardType="number-pad"
                                  />
                                  <ThemedText style={[styles.restTimeUnit, { color: SUPERSET_COLORS.text }]}>s</ThemedText>
                                  <Pressable
                                    style={[styles.restTimeBtn, { backgroundColor: SUPERSET_COLORS.primaryLight }]}
                                    onPress={() => updateSupersetRestTimes(supersetGroup.id, undefined, supersetGroup.restAfterRound + 15)}
                                  >
                                    <IconSymbol name="plus" size={12} color={SUPERSET_COLORS.text} />
                                  </Pressable>
                                </View>
                              </View>
                            </View>
                          )}
                        </>
                      );
                    })()}

                    {/* Exercise Header */}
                    <Pressable
                      style={styles.exerciseListHeader}
                      onPress={() => {
                        if (isInSelectionMode) {
                          // In selection mode, toggle this exercise's selection
                          if (canSelect) {
                            toggleSupersetSelection(exercise.id);
                          }
                        } else {
                          navigateToExercise(exerciseIndex);
                        }
                      }}
                      onLongPress={() => {
                        if (!isInSupersetGroup && !isInSelectionMode) {
                          startSupersetSelection(exercise.id);
                        }
                      }}
                      delayLongPress={400}
                    >
                      <View style={styles.exerciseListHeaderLeft}>
                        <View style={[
                          styles.exerciseNumber,
                          { backgroundColor: isCurrentExercise ? colors.tint : colors.elevated }
                        ]}>
                          {allComplete ? (
                            <IconSymbol name="checkmark" size={12} color={isCurrentExercise ? '#fff' : colors.tint} />
                          ) : (
                            <ThemedText style={[
                              styles.exerciseNumberText,
                              { color: isCurrentExercise ? '#fff' : colors.textSecondary }
                            ]}>
                              {exerciseIndex + 1}
                            </ThemedText>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={[styles.exerciseListName, { color: colors.text }]}>
                            {exercise.name}
                          </ThemedText>
                          <ThemedText style={[styles.exerciseListMeta, { color: colors.textTertiary }]}>
                            {completedSets}/{exercise.sets.length} sets complete
                          </ThemedText>
                        </View>
                      </View>
                      <View style={styles.exerciseListHeaderRight}>
                        {/* Superset link button - only show when not in superset and not in selection mode */}
                        {!isInSupersetGroup && !isInSelectionMode && (
                          <SupersetLinkButton
                            onPress={() => startSupersetSelection(exercise.id)}
                            isHighlighted={false}
                          />
                        )}
                        {/* Show checkmark when selected in multi-select mode */}
                        {isSelected && (
                          <View style={[styles.selectedCheckmark, { backgroundColor: SUPERSET_COLORS.primary }]}>
                            <IconSymbol name="checkmark" size={12} color="#fff" />
                          </View>
                        )}
                        {/* Delete exercise button */}
                        {!isInSelectionMode && (
                          <Pressable
                            onPress={() => removeExercise(exerciseIndex)}
                            style={styles.deleteExerciseButton}
                            hitSlop={8}
                          >
                            <IconSymbol name="trash" size={16} color={colors.textTertiary} />
                          </Pressable>
                        )}
                      </View>
                    </Pressable>

                    {/* Rest Timer Toggle - like Hevy */}
                    <Pressable
                      style={[styles.restTimerToggle, { borderBottomColor: colors.separator }]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        // Toggle rest timer for this exercise
                        // restTimerEnabled: undefined/true = ON, false = OFF
                        setSession(prev => {
                          if (!prev) return prev;
                          const newExercises = [...prev.exercises];
                          const currentValue = newExercises[exerciseIndex].restTimerEnabled;
                          // If currently ON (undefined or true), turn OFF (false)
                          // If currently OFF (false), turn ON (true)
                          const newValue = currentValue !== false ? false : true;
                          newExercises[exerciseIndex] = {
                            ...newExercises[exerciseIndex],
                            restTimerEnabled: newValue,
                          };
                          return { ...prev, exercises: newExercises };
                        });
                      }}
                    >
                      <IconSymbol
                        name="timer"
                        size={14}
                        color={exercise.restTimerEnabled !== false ? colors.tint : colors.textTertiary}
                      />
                      <ThemedText
                        style={[
                          styles.restTimerToggleText,
                          { color: exercise.restTimerEnabled !== false ? colors.tint : colors.textTertiary }
                        ]}
                      >
                        Rest Timer: {exercise.restTimerEnabled !== false ? 'ON' : 'OFF'}
                      </ThemedText>
                    </Pressable>

                    {/* Sets Table with Column Headers */}
                    <View style={styles.setsList}>
                      {/* Column Headers */}
                      <View style={styles.setsHeader}>
                        <View style={styles.setsHeaderLeft}>
                          <ThemedText style={[styles.setsHeaderText, { color: colors.textTertiary }]}>SET</ThemedText>
                        </View>
                        <View style={styles.setsHeaderPrev}>
                          <ThemedText style={[styles.setsHeaderText, { color: colors.textTertiary }]}>PREVIOUS</ThemedText>
                        </View>
                        <View style={styles.setsHeaderCenter}>
                          <ThemedText style={[styles.setsHeaderText, { color: colors.textTertiary }]}>REPS</ThemedText>
                        </View>
                        <Pressable
                          style={styles.setsHeaderRight}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setWeightUnit(weightUnit === 'kg' ? 'lbs' : 'kg');
                          }}
                        >
                          <ThemedText style={[styles.setsHeaderText, { color: colors.tint }]}>
                            {weightUnit.toUpperCase()}
                          </ThemedText>
                          <IconSymbol name="arrow.triangle.2.circlepath" size={10} color={colors.tint} />
                        </Pressable>
                        <View style={styles.setsHeaderDone}>
                          <IconSymbol name="checkmark.circle" size={12} color={colors.textTertiary} />
                        </View>
                      </View>

                      {exercise.sets.map((set, setIndex) => {
                        const isCurrentSet = isCurrentExercise && setIndex === exercise.currentSetIndex && !set.isCompleted;
                        const setType = set.setType || 'working';
                        const typeColors = SET_TYPE_COLORS[setType];
                        const isDropSet = setType === 'drop';
                        const canDelete = true; // Can delete any set (last set removes exercise)
                        const completedColors = set.isCompleted ? COMPLETED_SET_COLORS : null;
                        // Check if this is the set that's currently resting (just completed)
                        const isRestingAfterThisSet = session.isResting &&
                          session.restExerciseIndex === exerciseIndex &&
                          session.restAfterSetIndex === setIndex;
                        // Show rest row for all non-last sets (visible in idle before completion)
                        const showRestRow = setIndex < exercise.sets.length - 1 && (exercise.restTimerEnabled !== false);
                        // Get previous data for this exercise/set
                        const prevExData = getPrevDataForExercise(exercise.name);
                        const prevSet = prevExData?.sets?.[setIndex];
                        const hasPrevData = prevSet && (prevSet.reps || prevSet.weight);

                        return (
                          <View key={set.id}>
                            <SwipeableSetRow
                              onDelete={() => removeSetFromExercise(exerciseIndex, setIndex)}
                              canDelete={canDelete}
                            >
                              <View
                                style={[
                                  styles.setRowCompact,
                                  {
                                    backgroundColor: set.isCompleted
                                      ? completedColors!.bg
                                      : isCurrentSet
                                        ? colors.tint + '08'
                                        : 'transparent',
                                    borderBottomColor: colors.separator,
                                    borderBottomWidth: StyleSheet.hairlineWidth,
                                    marginLeft: isDropSet ? Spacing.md : 0,
                                  },
                                ]}
                              >
                                {/* Set Type + Number */}
                                <View style={styles.setLeftCol}>
                                  <Pressable
                                    style={[
                                      styles.setTypeBadge,
                                      set.isCompleted ? {
                                        backgroundColor: completedColors!.checkBg,
                                      } : {
                                        backgroundColor: typeColors.bg,
                                      },
                                    ]}
                                    onPress={() => cycleSetType(exerciseIndex, setIndex)}
                                    onLongPress={() => {
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                      openGuide();
                                    }}
                                  >
                                    {set.isCompleted ? (
                                      <IconSymbol name="checkmark" size={10} color="#fff" />
                                    ) : (
                                      <ThemedText style={[styles.setTypeBadgeText, { color: typeColors.text }]}>
                                        {SET_TYPE_INFO[setType].shortLabel}
                                      </ThemedText>
                                    )}
                                  </Pressable>
                                  <ThemedText style={[styles.setNumberCompact, { color: colors.textTertiary }]}>
                                    {isDropSet ? '↳' : setIndex + 1}
                                  </ThemedText>
                                </View>

                                {/* Ghost Mode - Previous Workout Data Column */}
                                <View style={styles.setPrevCol}>
                                  {prevSet ? (() => {
                                    const currentWeight = set.weight || 0;
                                    const ghostWeight = prevSet.weight || 0;
                                    const currentReps = typeof set.reps === 'string' ? parseInt(set.reps) || 0 : (set.reps || 0);
                                    const ghostReps = prevSet.reps || 0;
                                    const isBeatingWeight = currentWeight > ghostWeight && ghostWeight > 0;
                                    const isBeatingReps = currentWeight === ghostWeight && currentReps > ghostReps && ghostReps > 0;
                                    const isBeating = isBeatingWeight || isBeatingReps;
                                    const ghostColor = isBeating ? '#30D158' : colors.textSecondary;
                                    const ghostIcon = isBeating ? '↑' : '👻';

                                    return (
                                      <ThemedText style={[styles.prevDataText, { color: ghostColor }]}>
                                        {ghostIcon} {ghostWeight ? `${ghostWeight}×${ghostReps || '—'}` : `—×${ghostReps || '—'}`}
                                      </ThemedText>
                                    );
                                  })() : (
                                    <ThemedText style={[styles.prevDataText, { color: colors.textTertiary }]}>—</ThemedText>
                                  )}
                                </View>

                                {/* Reps Input */}
                                <View style={styles.setCenterCol}>
                                  <TextInput
                                    value={String(set.reps ?? '')}
                                    onChangeText={(v) => updateAnySet(exerciseIndex, setIndex, { reps: v })}
                                    style={[
                                      styles.setInputCompact,
                                      { color: colors.text, backgroundColor: colors.elevated },
                                    ]}
                                    keyboardType="number-pad"
                                    placeholder="—"
                                    placeholderTextColor={colors.textTertiary}
                                  />
                                </View>

                                {/* Weight Input */}
                                <View style={styles.setRightCol}>
                                  <TextInput
                                    value={set.weight != null ? String(set.weight) : ''}
                                    onChangeText={(v) => {
                                      const n = v.trim() === '' ? null : Number(v);
                                      updateAnySet(exerciseIndex, setIndex, { weight: Number.isFinite(n as any) ? (n as any) : null });
                                    }}
                                    style={[
                                      styles.setInputCompact,
                                      { color: colors.text, backgroundColor: colors.elevated },
                                    ]}
                                    keyboardType="decimal-pad"
                                    placeholder="—"
                                    placeholderTextColor={colors.textTertiary}
                                  />
                                </View>

                                {/* Inline Checkbox to complete set */}
                                <View style={styles.setDoneCol}>
                                  <SetCompletionPulse active={set.id === lastCompletedSetId && set.isCompleted}>
                                    <Pressable
                                      style={[
                                        styles.setCheckbox,
                                        {
                                          borderColor: set.isCompleted
                                            ? COMPLETED_SET_COLORS.checkBg
                                            : colors.separator,
                                          backgroundColor: set.isCompleted
                                            ? COMPLETED_SET_COLORS.checkBg
                                            : 'transparent',
                                        },
                                      ]}
                                      onPress={() => {
                                        if (set.isCompleted) {
                                          uncompleteSet(exerciseIndex, setIndex);
                                        } else {
                                          completeAnySet(exerciseIndex, setIndex);
                                        }
                                      }}
                                    >
                                      {set.isCompleted && (
                                        <IconSymbol name="checkmark" size={14} color="#fff" />
                                      )}
                                    </Pressable>
                                  </SetCompletionPulse>
                                </View>
                              </View>
                            </SwipeableSetRow>

                            {/* Inline Rest Timer Row - swipe left to remove */}
                            {showRestRow && set.restAfter?.enabled !== false && (
                              <SwipeableSetRow
                                onDelete={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                  updateAnySet(exerciseIndex, setIndex, {
                                    restAfter: { enabled: false, duration: exercise.restTime },
                                  });
                                }}
                                canDelete={true}
                              >
                                <InlineRestTimerRow
                                  duration={set.restAfter?.duration ?? exercise.restTime}
                                  autoStart={set.isCompleted}
                                  isSetCompleted={set.isCompleted}
                                  onComplete={skipRest}
                                  onDisable={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    updateAnySet(exerciseIndex, setIndex, {
                                      restAfter: { enabled: false, duration: exercise.restTime },
                                    });
                                  }}
                                  onDurationChange={(newDuration) => {
                                    // Update the set's restAfter duration
                                    if (set.restAfter) {
                                      updateAnySet(exerciseIndex, setIndex, {
                                        restAfter: { ...set.restAfter, duration: newDuration },
                                      });
                                    } else {
                                      // Initialize restAfter with the new duration
                                      updateAnySet(exerciseIndex, setIndex, {
                                        restAfter: { enabled: true, duration: newDuration },
                                      });
                                    }
                                  }}
                                />
                              </SwipeableSetRow>
                            )}

                            {/* Add Timer placeholder - shows when timer is disabled for this set */}
                            {showRestRow && set.restAfter?.enabled === false && (
                              <Pressable
                                style={styles.addTimerPlaceholder}
                                onPress={() => {
                                  Haptics.selectionAsync();
                                  updateAnySet(exerciseIndex, setIndex, {
                                    restAfter: { enabled: true, duration: exercise.restTime },
                                  });
                                }}
                              >
                                <IconSymbol name="timer" size={12} color={colors.textTertiary} />
                                <ThemedText style={[styles.addTimerText, { color: colors.textTertiary }]}>
                                  + Add Timer
                                </ThemedText>
                              </Pressable>
                            )}

                            {/* Add Drop Set Link - visible for non-drop, non-completed sets */}
                            {!isDropSet && !set.isCompleted && (
                              <Pressable
                                style={[styles.dropSetLink, { marginLeft: Spacing.md }]}
                                onPress={() => addDropSet(exerciseIndex, setIndex)}
                              >
                                <IconSymbol name="arrow.turn.down.right" size={10} color={SET_TYPE_COLORS.drop.text} />
                                <ThemedText style={[styles.dropSetLinkText, { color: SET_TYPE_COLORS.drop.text }]}>
                                  + Drop
                                </ThemedText>
                              </Pressable>
                            )}
                          </View>
                        );
                      })}

                      {/* Add Set Button */}
                      <Pressable
                        style={[styles.addSetBtn, { borderColor: colors.separator }]}
                        onPress={() => addSetToExercise(exerciseIndex)}
                      >
                        <IconSymbol name="plus" size={14} color={colors.tint} />
                        <ThemedText style={[styles.addSetText, { color: colors.tint }]}>Add Set</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              {/* Add Exercise Button in List */}
              <Pressable
                style={[styles.addExerciseCard, { borderColor: colors.separator }]}
                onPress={handleAddExercise}
              >
                <IconSymbol name="plus.circle" size={20} color={colors.tint} />
                <ThemedText style={[styles.addExerciseText, { color: colors.tint }]}>
                  Add Exercise
                </ThemedText>
              </Pressable>
            </View>

            {/* Bottom spacing for fixed bar */}
            <View style={{ height: 140 }} />
          </>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16, backgroundColor: colors.background }]}>
        {/* Secondary action buttons row */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.secondaryButton, { borderColor: colors.separator }]}
            onPress={discardWorkout}
          >
            <IconSymbol name="trash" size={18} color="#FF3B30" />
          </Pressable>

          {/* Voice Input Button */}
          <Pressable
            style={[styles.voiceButton, { backgroundColor: colors.tint }]}
            onPress={() => setVoiceModalVisible(true)}
          >
            <IconSymbol name="mic.fill" size={24} color="#fff" />
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, { borderColor: colors.separator }]}
            onPress={handleAddExercise}
          >
            <IconSymbol name="plus" size={18} color={colors.tint} />
          </Pressable>
        </View>

        {/* Progress Summary */}
        <View style={styles.progressSummary}>
          <ThemedText style={[styles.progressText, { color: colors.textTertiary }]}>
            {progress.totalSetsCompleted} / {progress.totalSets} sets complete
          </ThemedText>
          <View style={[styles.miniProgressBar, { backgroundColor: colors.separator + '40' }]}>
            <Animated.View
              style={[
                styles.miniProgressFill,
                { backgroundColor: colors.tint },
                progressAnimatedStyle,
              ]}
            />
          </View>
        </View>

        {/* Always-visible centered Finish Workout button */}
        <Pressable
          style={({ pressed }) => [
            styles.finishButton,
            {
              backgroundColor: progress.totalSets > 0 && progress.totalSetsCompleted >= progress.totalSets
                ? colors.success
                : colors.tint,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
          onPress={finishEarly}
        >
          <IconSymbol name="checkmark.circle.fill" size={22} color="#fff" />
          <ThemedText style={styles.finishButtonText}>
            {progress.totalSets > 0 && progress.totalSetsCompleted >= progress.totalSets
              ? 'Finish Workout 🎉'
              : 'Finish Workout'}
          </ThemedText>
        </Pressable>
      </View>

      {/* Set Types Guide - Onboarding & Reference */}
      <SetTypesGuide
        visible={showGuide}
        onClose={closeGuide}
      />

      {/* Voice Logging Modal - Tap to record */}
      <VoiceLoggingModal
        visible={voiceModalVisible}
        onClose={() => setVoiceModalVisible(false)}
        onExercisesExtracted={handleVoiceExercisesExtracted}
      />
    </View>
  );
}

function EmptyWorkoutState({
  colors,
  onAddExercise,
}: {
  colors: typeof Colors.light;
  onAddExercise: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.tintMuted }]}>
        <IconSymbol name="dumbbell" size={48} color={colors.tint} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
        Ready to train?
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Tap the mic below to add exercises{"\n"}or browse our library
      </ThemedText>

      {/* Single Browse CTA */}
      <Pressable
        style={({ pressed }) => [
          styles.emptyBrowseCTA,
          {
            backgroundColor: colors.tint,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
        ]}
        onPress={onAddExercise}
      >
        <IconSymbol name="magnifyingglass" size={20} color="#fff" />
        <ThemedText style={styles.emptyVoiceCTAText}>Browse Exercises</ThemedText>
      </Pressable>

      {/* Hint pointing to bottom mic */}
      <View style={styles.emptyHintRow}>
        <IconSymbol name="arrow.down" size={14} color={colors.textTertiary} />
        <ThemedText style={[styles.emptyHint, { color: colors.textTertiary }]}>
          Hold the mic button to add with voice
        </ThemedText>
      </View>
    </View>
  );
}

function SetCompletionPulse({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (active) {
      scale.value = withSequence(
        withSpring(1.15, { damping: 8, stiffness: 300 }),
        withSpring(1, { damping: 12 })
      );
    }
  }, [active, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  topBarButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerText: {
    fontSize: 17,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  unitBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  unitText: {
    fontSize: 12,
    fontWeight: '700',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },

  // Exercise Navigation
  exerciseNavScroll: {
    flexGrow: 0,
    marginBottom: Spacing.md,
  },
  exerciseNav: {
    paddingHorizontal: Spacing.md,
    gap: 8,
  },
  exercisePill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  exercisePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  addExercisePill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },

  // Main Scroll
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  exerciseName: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  setProgress: {
    fontSize: 15,
    marginBottom: Spacing.lg,
  },
  heroCard: {
    width: '100%',
    maxWidth: 320,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    gap: Spacing.md,
  },
  heroInputRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  heroInputGroup: {
    flex: 1,
    gap: 8,
  },
  heroInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  heroInput: {
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  previousSetRef: {
    alignItems: 'center',
  },
  previousSetText: {
    fontSize: 13,
  },

  // Sets Indicator
  setsIndicator: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.lg,
  },
  setDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Bottom Bar
  bottomBar: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  secondaryButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  doneButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: 28,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  voiceButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  voiceHint: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  progressSummary: {
    alignItems: 'center',
    gap: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
  },
  miniProgressBar: {
    width: '100%',
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
  },

  // Rest Overlay
  restOverlay: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
  },
  restContent: {
    gap: Spacing.md,
  },
  restHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  restHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  restLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  restTimer: {
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  restTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  restFill: {
    height: '100%',
    borderRadius: 3,
  },
  restActions: {
    flexDirection: 'row',
    gap: 8,
  },
  restChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  restChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
  },

  // Exercise List Section
  exerciseListSection: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  exerciseListCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  exerciseListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseListHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  exerciseNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNumberText: {
    fontSize: 13,
    fontWeight: '600',
  },
  exerciseListName: {
    fontSize: 16,
    fontWeight: '600',
  },
  exerciseListMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // Rest Time Row
  restTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  restTimeLabel: {
    fontSize: 13,
  },
  restTimeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  restTimeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restTimeInput: {
    width: 50,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.xs,
  },
  restTimeUnit: {
    fontSize: 13,
  },

  // Sets List
  setsList: {
    gap: Spacing.xs,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  setTypePill: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setTypePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  setNumberInline: {
    fontSize: 12,
    fontWeight: '500',
    width: 18,
    textAlign: 'center',
  },
  setNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumberText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rpeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rpeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  setActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  setActionBtn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  setInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.xs,
    minWidth: 50,
  },
  setInputLabel: {
    fontSize: 11,
    minWidth: 28,
  },
  removeSetBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: Spacing.xs,
  },
  addSetText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dropSetLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  dropSetLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addExerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addExerciseText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Superset styles
  linkingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  linkingBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  linkingBannerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  linkingBannerCancel: {
    fontSize: 14,
    fontWeight: '600',
  },
  supersetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    marginBottom: Spacing.xs,
  },
  supersetBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  supersetRestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  supersetRestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  supersetRestLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  supersetRestInput: {
    width: 50,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: Radius.xs,
  },
  exerciseListHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  unlinkBtn: {
    padding: 4,
  },
  // Multi-select superset styles
  selectionCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    marginLeft: 4,
  },
  selectionCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  linkingBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  supersetDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  supersetDoneBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  selectionOrderBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  selectionOrderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteExerciseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  // Inline unlink button in superset badge
  supersetUnlinkInline: {
    marginLeft: 4,
    padding: 2,
  },
  // Sets table header styles
  setsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: 2,
  },
  setsHeaderLeft: {
    width: 70,
    flexDirection: 'row',
    alignItems: 'center',
  },
  setsHeaderPrev: {
    width: 72,
    alignItems: 'center',
  },
  setsHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  setsHeaderRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  setsHeaderDone: {
    width: 36,
    alignItems: 'center',
  },
  setsHeaderText: {
    ...Typography.caption2,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  // Compact set row styles
  setRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    minHeight: 44,
  },
  setLeftCol: {
    width: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  setTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
  },
  setTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  setPrevCol: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevDataText: {
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  setCenterCol: {
    flex: 1,
    alignItems: 'center',
  },
  setRightCol: {
    flex: 1,
    alignItems: 'center',
  },
  setDoneCol: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setTypePillCompact: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setTypePillTextCompact: {
    fontSize: 10,
    fontWeight: '700',
  },
  setNumberCompact: {
    ...Typography.caption1,
    fontWeight: '500',
  },
  setInputCompact: {
    width: 56,
    height: 36,
    borderRadius: Radius.sm,
    textAlign: 'center',
    ...Typography.body,
    fontWeight: '600',
  },
  // Rest Timer Toggle - Hevy-style
  restTimerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  restTimerToggleText: {
    ...Typography.footnote,
    fontWeight: '500',
  },
  addTimerPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    marginVertical: Spacing.xs,
    alignSelf: 'center',
    width: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: Radius.sm,
  },
  addTimerText: {
    fontSize: 11,
    fontWeight: '500',
  },
  // Inline rest row styles - centered with distinct background
  inlineRestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  inlineRestLabel: {
    ...Typography.caption2,
    fontWeight: '600',
  },
  inlineRestInput: {
    width: 48,
    height: 28,
    borderRadius: Radius.sm,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  inlineRestInputActive: {
    width: 56,
    height: 32,
    borderRadius: Radius.sm,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  inlineRestUnit: {
    ...Typography.caption2,
    fontWeight: '500',
  },
  inlineRestActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  inlineRestTimer: {
    ...Typography.headline,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  inlineRestSkip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  inlineRestSkipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Inline checkbox for completing sets
  setCheckbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevDataHint: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },

  // Empty State CTA Styles
  emptyCTARow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  emptyVoiceCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    minWidth: 140,
  },
  emptyVoiceCTAText: {
    color: '#fff',
    ...Typography.headline,
    fontWeight: '600',
  },
  emptyBrowseCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    minWidth: 120,
  },
  emptyBrowseCTAText: {
    ...Typography.headline,
    fontWeight: '600',
  },
  emptyHint: {
    ...Typography.caption1,
  },
  emptyHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
  },

  // Tap-to-open voice button
  voiceButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Always-visible Finish Workout button
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginTop: 12,
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
