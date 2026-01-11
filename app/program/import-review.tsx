/**
 * Import Review Screen
 *
 * Human-in-the-loop verification screen for imported programs.
 * Allows users to:
 * - Review extracted workout data
 * - Fix unmatched exercise names
 * - Edit program metadata
 * - Save the finalized program
 */

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { UnmatchedExercise, useProgramImport } from '@/lib/context/program-import-context';
import { saveProgram } from '@/lib/db/storage';
import { ParsedProgram } from '@/lib/types/program';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

// ============================================
// EXERCISE MATCH MODAL
// ============================================

interface ExerciseMatchModalProps {
  visible: boolean;
  exercise: UnmatchedExercise | null;
  onSelect: (match: string | null, createAsCustom?: boolean) => void;
  onClose: () => void;
  colors: typeof Colors.light;
}

function ExerciseMatchModal({ visible, exercise, onSelect, onClose, colors }: ExerciseMatchModalProps) {
  const [customName, setCustomName] = useState('');

  if (!exercise) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.separator }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <ThemedText style={[styles.modalCancel, { color: colors.tint }]}>Cancel</ThemedText>
          </Pressable>
          <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Match Exercise</ThemedText>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentInner}>
          {/* Original Name */}
          <View style={[styles.originalNameCard, { backgroundColor: colors.card }]}>
            <ThemedText style={[styles.originalLabel, { color: colors.textTertiary }]}>
              EXTRACTED NAME
            </ThemedText>
            <ThemedText style={[styles.originalName, { color: colors.text }]}>
              {exercise.originalName}
            </ThemedText>
            <ThemedText style={[styles.locationText, { color: colors.textSecondary }]}>
              Week {exercise.location.week}, Day {exercise.location.day}
            </ThemedText>
          </View>

          {/* Suggestions */}
          {exercise.suggestions.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                SUGGESTED MATCHES
              </ThemedText>
              {exercise.suggestions.map((suggestion, idx) => (
                <Pressable
                  key={idx}
                  style={({ pressed }) => [
                    styles.suggestionItem,
                    { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelect(suggestion.suggestedName);
                  }}
                >
                  <View style={styles.suggestionInfo}>
                    <ThemedText style={[styles.suggestionName, { color: colors.text }]}>
                      {suggestion.suggestedName}
                    </ThemedText>
                    <View style={styles.confidenceBadge}>
                      <View
                        style={[
                          styles.confidenceBar,
                          {
                            width: `${Math.round(suggestion.confidence * 100)}%`,
                            backgroundColor: suggestion.confidence > 0.7 ? '#30D158' : suggestion.confidence > 0.4 ? '#FF9F0A' : '#FF453A',
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
                </Pressable>
              ))}
            </View>
          )}

          {/* Keep Original */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              OTHER OPTIONS
            </ThemedText>
            <Pressable
              style={({ pressed }) => [
                styles.optionItem,
                { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(exercise.originalName, true);
              }}
            >
              <IconSymbol name="plus.circle" size={20} color="#30D158" />
              <ThemedText style={[styles.optionText, { color: colors.text }]}>
                Create as Custom Exercise
              </ThemedText>
            </Pressable>

            {/* Custom name input */}
            <View style={[styles.customInputContainer, { backgroundColor: colors.card }]}>
              <TextInput
                style={[styles.customInput, { color: colors.text, borderColor: colors.separator }]}
                value={customName}
                onChangeText={setCustomName}
                placeholder="Or type a different name..."
                placeholderTextColor={colors.textTertiary}
              />
              {customName.length > 0 && (
                <Pressable
                  style={[styles.customSubmit, { backgroundColor: colors.tint }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onSelect(customName.trim());
                  }}
                >
                  <IconSymbol name="checkmark" size={16} color="#fff" />
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function ImportReviewScreen() {
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Try to use the import context first, fall back to params
  const importContext = useProgramImportSafe();

  // Local state for fallback mode (when coming from route params)
  const [programData, setProgramData] = useState<ParsedProgram | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingExercise, setEditingExercise] = useState<UnmatchedExercise | null>(null);
  const [localUnmatched, setLocalUnmatched] = useState<UnmatchedExercise[]>([]);

  // Initialize from params if context not available
  useEffect(() => {
    if (importContext?.state.extractedProgram) {
      setProgramData(importContext.state.extractedProgram);
      setLocalUnmatched(importContext.state.unmatchedExercises);
    } else if (typeof params.data === 'string') {
      try {
        const parsed = JSON.parse(params.data) as ParsedProgram;
        setProgramData(parsed);
        // Generate mock unmatched for demo (in real app, this comes from context)
      } catch (e) {
        console.error('Failed to parse program data:', e);
      }
    }
  }, [params.data, importContext?.state.extractedProgram]);

  const handleExerciseMatch = (originalName: string, selectedMatch: string | null, createAsCustom?: boolean) => {
    if (importContext) {
      importContext.updateExerciseMatch(originalName, selectedMatch, createAsCustom);
    } else {
      // Local fallback
      setLocalUnmatched(prev =>
        prev.map(ex =>
          ex.originalName === originalName
            ? { ...ex, selectedMatch, createAsCustom: createAsCustom ?? false }
            : ex
        )
      );
    }
    setEditingExercise(null);
  };

  const handleSave = async () => {
    if (!programData) return;

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Apply matches to program
      const finalProgram = importContext?.applyMatchesToProgram?.() || programData;

      await saveProgram({
        userId: 'demo-user',
        name: finalProgram.name || 'Imported Program',
        description: finalProgram.description || `${finalProgram.workouts.length} workouts`,
        sourceFileUri: importContext?.state.sourceFile?.uri || null,
        sourceType: (importContext?.state.sourceFile?.type?.toUpperCase() as 'CSV' | 'PDF' | 'EXCEL' | 'IMAGE') || 'CSV',
        status: 'READY',
        parsedData: JSON.stringify(finalProgram),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      importContext?.onSaveSuccess?.();

      // Navigate back to home
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Save failed:', error);
      importContext?.onSaveFailed?.(error.message);

      if (Platform.OS === 'web') {
        window.alert('Failed to save program: ' + error.message);
      } else {
        Alert.alert('Error', 'Failed to save program: ' + error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (!programData) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading program data...
          </ThemedText>
        </View>
      </Screen>
    );
  }

  const unmatchedList = importContext?.state.unmatchedExercises || localUnmatched;
  const pendingCount = unmatchedList.filter(u => !u.selectedMatch && !u.createAsCustom).length;
  const totalExercises = programData.workouts.reduce((sum, w) => sum + w.exercises.length, 0);

  // Detect rest days and multi-workout days
  const isRestDay = (workout: typeof programData.workouts[0]): boolean => {
    if (workout.exercises.length === 0) return true;
    if (workout.exercises.length === 1) {
      const name = workout.exercises[0].name.toLowerCase().trim();
      return name === 'rest' || name === 'off' || name === 'rest day' || name === 'recovery';
    }
    return false;
  };

  const restDayCount = programData.workouts.filter(isRestDay).length;
  const workoutDayCount = programData.workouts.filter(w => !isRestDay(w)).length;

  // Detect multi-workout days (same week/day with different workouts)
  const dayMap = new Map<string, number>();
  programData.workouts.forEach(w => {
    const key = `${w.week}-${w.day}`;
    dayMap.set(key, (dayMap.get(key) || 0) + 1);
  });
  const multiWorkoutDays = Array.from(dayMap.values()).filter(count => count > 1).length;

  // Calculate program duration
  const maxWeek = Math.max(...programData.workouts.map(w => w.week), 0);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={[styles.title, { color: colors.text }]}>Review Import</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
            Verify the extracted data before saving
          </ThemedText>
        </View>

        {/* Stats Card */}
        <View style={[styles.statsCard, { backgroundColor: colors.card }, Shadows.sm]}>
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: colors.tint }]}>
              {maxWeek}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Weeks</ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.separator }]} />
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: colors.tint }]}>{workoutDayCount}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Workouts</ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.separator }]} />
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: '#FF9F0A' }]}>
              {restDayCount}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Rest Days</ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.separator }]} />
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: pendingCount > 0 ? '#FF9F0A' : '#30D158' }]}>
              {pendingCount}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Review</ThemedText>
          </View>
        </View>

        {/* Multi-workout day notice */}
        {multiWorkoutDays > 0 && (
          <View style={[styles.noticeCard, { backgroundColor: '#30D158' + '15', borderColor: '#30D158' }]}>
            <IconSymbol name="calendar.badge.plus" size={18} color="#30D158" />
            <ThemedText style={[styles.noticeText, { color: colors.text }]}>
              {multiWorkoutDays} day{multiWorkoutDays > 1 ? 's' : ''} with multiple workouts detected (AM/PM)
            </ThemedText>
          </View>
        )}

        {/* Unmatched Exercises Section */}
        {unmatchedList.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#FF9F0A" />
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                Exercises Needing Review
              </ThemedText>
            </View>
            {unmatchedList.map((unmatched, idx) => (
              <Pressable
                key={idx}
                style={({ pressed }) => [
                  styles.unmatchedCard,
                  {
                    backgroundColor: unmatched.selectedMatch || unmatched.createAsCustom
                      ? '#30D158' + '15'
                      : colors.card,
                    borderColor: unmatched.selectedMatch || unmatched.createAsCustom
                      ? '#30D158'
                      : colors.separator,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setEditingExercise(unmatched);
                }}
              >
                <View style={styles.unmatchedInfo}>
                  <ThemedText style={[styles.unmatchedName, { color: colors.text }]}>
                    {unmatched.originalName}
                  </ThemedText>
                  {unmatched.selectedMatch && (
                    <View style={styles.matchedBadge}>
                      <IconSymbol name="arrow.right" size={10} color="#30D158" />
                      <ThemedText style={[styles.matchedText, { color: '#30D158' }]}>
                        {unmatched.selectedMatch}
                      </ThemedText>
                    </View>
                  )}
                  {unmatched.createAsCustom && !unmatched.selectedMatch && (
                    <ThemedText style={[styles.customBadge, { color: '#30D158' }]}>
                      Will create as custom
                    </ThemedText>
                  )}
                </View>
                <IconSymbol
                  name={unmatched.selectedMatch || unmatched.createAsCustom ? 'checkmark.circle.fill' : 'chevron.right'}
                  size={20}
                  color={unmatched.selectedMatch || unmatched.createAsCustom ? '#30D158' : colors.textTertiary}
                />
              </Pressable>
            ))}
          </View>
        )}

        {/* Program Preview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <IconSymbol name="list.bullet" size={16} color={colors.textSecondary} />
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Program Preview</ThemedText>
          </View>

          {programData.workouts.slice(0, 5).map((workout, idx) => (
            <View key={idx} style={[styles.workoutCard, { backgroundColor: colors.card }]}>
              <View style={styles.workoutHeader}>
                <ThemedText style={[styles.workoutTitle, { color: colors.text }]}>
                  Week {workout.week} - Day {workout.day}
                </ThemedText>
                <ThemedText style={[styles.exerciseCount, { color: colors.textTertiary }]}>
                  {workout.exercises.length} exercises
                </ThemedText>
              </View>
              {workout.exercises.slice(0, 3).map((ex, exIdx) => (
                <View key={exIdx} style={[styles.exerciseRow, { borderTopColor: colors.separator }]}>
                  <ThemedText style={[styles.exerciseName, { color: colors.text }]} numberOfLines={1}>
                    {ex.name}
                  </ThemedText>
                  <ThemedText style={[styles.exerciseDetails, { color: colors.textSecondary }]}>
                    {ex.sets} x {ex.reps} {ex.weight ? `@ ${ex.weight}` : ''}
                  </ThemedText>
                </View>
              ))}
              {workout.exercises.length > 3 && (
                <ThemedText style={[styles.moreExercises, { color: colors.textTertiary }]}>
                  +{workout.exercises.length - 3} more exercises
                </ThemedText>
              )}
            </View>
          ))}

          {programData.workouts.length > 5 && (
            <ThemedText style={[styles.moreWorkouts, { color: colors.textSecondary }]}>
              +{programData.workouts.length - 5} more workouts
            </ThemedText>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.separator }]}>
        <Pressable
          style={({ pressed }) => [
            styles.cancelButton,
            { borderColor: colors.separator, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => {
            importContext?.reset?.();
            router.back();
          }}
        >
          <ThemedText style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor: pendingCount > 0 ? colors.separator : colors.tint,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          onPress={handleSave}
          disabled={saving || pendingCount > 0}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <IconSymbol name="checkmark.circle.fill" size={18} color="#fff" />
              <ThemedText style={styles.saveButtonText}>
                {pendingCount > 0 ? `${pendingCount} to Review` : 'Save Program'}
              </ThemedText>
            </>
          )}
        </Pressable>
      </View>

      {/* Match Modal */}
      <ExerciseMatchModal
        visible={!!editingExercise}
        exercise={editingExercise}
        onSelect={(match, createAsCustom) =>
          editingExercise && handleExerciseMatch(editingExercise.originalName, match, createAsCustom)
        }
        onClose={() => setEditingExercise(null)}
        colors={colors}
      />
    </Screen>
  );
}

// Safe hook that doesn't throw if context is missing
function useProgramImportSafe() {
  try {
    return useProgramImport();
  } catch {
    return null;
  }
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: 120,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.title2,
    marginBottom: 4,
  },
  subtitle: {
    ...Typography.body,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    ...Typography.title2,
    fontWeight: '700',
  },
  statLabel: {
    ...Typography.caption1,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  noticeText: {
    ...Typography.footnote,
    flex: 1,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.headline,
  },
  unmatchedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  unmatchedInfo: {
    flex: 1,
    gap: 4,
  },
  unmatchedName: {
    ...Typography.body,
    fontWeight: '500',
  },
  matchedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchedText: {
    ...Typography.caption1,
    fontWeight: '500',
  },
  customBadge: {
    ...Typography.caption1,
    fontStyle: 'italic',
  },
  workoutCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  workoutTitle: {
    ...Typography.headline,
    fontWeight: '600',
  },
  exerciseCount: {
    ...Typography.caption1,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  exerciseName: {
    ...Typography.body,
    flex: 1,
    marginRight: Spacing.sm,
  },
  exerciseDetails: {
    ...Typography.footnote,
  },
  moreExercises: {
    ...Typography.caption1,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  moreWorkouts: {
    ...Typography.footnote,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  cancelButtonText: {
    ...Typography.headline,
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.md,
  },
  saveButtonText: {
    ...Typography.headline,
    color: '#fff',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalCancel: {
    ...Typography.body,
  },
  modalTitle: {
    ...Typography.headline,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
  },
  modalContentInner: {
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  originalNameCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: 4,
  },
  originalLabel: {
    ...Typography.caption2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  originalName: {
    ...Typography.title3,
    fontWeight: '600',
  },
  locationText: {
    ...Typography.footnote,
    marginTop: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.xs,
  },
  suggestionInfo: {
    flex: 1,
    gap: 6,
  },
  suggestionName: {
    ...Typography.body,
    fontWeight: '500',
  },
  confidenceBadge: {
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    overflow: 'hidden',
    width: 100,
  },
  confidenceBar: {
    height: '100%',
    borderRadius: 2,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.xs,
  },
  optionText: {
    ...Typography.body,
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  customInput: {
    flex: 1,
    ...Typography.body,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  customSubmit: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
