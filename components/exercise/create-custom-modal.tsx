/**
 * Create Custom Exercise Modal
 *
 * Appears when user searches for an exercise not in the database.
 * Allows quick creation of custom exercises that sync to cloud.
 */

import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  createCustomExercise,
  type CustomExerciseInput,
} from '@/lib/services/exercise/custom-exercises';
import { EQUIPMENT_CATEGORIES, BODY_REGIONS } from '@/lib/services/exercise/categories';

interface CreateCustomModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (exercise: { id: string; name: string }) => void;
  initialName?: string;
}

// Common equipment options
const EQUIPMENT_OPTIONS = [
  'Barbell',
  'Dumbbell',
  'Cable',
  'Machine',
  'Bodyweight',
  'Kettlebell',
  'Resistance Band',
  'Other',
];

// Common muscle groups
const MUSCLE_OPTIONS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Legs',
  'Glutes',
  'Core',
  'Full Body',
];

export function CreateCustomModal({
  visible,
  onClose,
  onCreated,
  initialName = '',
}: CreateCustomModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Form state
  const [name, setName] = useState(initialName);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  const handleOpen = useCallback(() => {
    setName(initialName);
    setSelectedEquipment([]);
    setSelectedMuscles([]);
    setNotes('');
    setError(null);
  }, [initialName]);

  // Toggle equipment selection
  const toggleEquipment = (equipment: string) => {
    Haptics.selectionAsync();
    setSelectedEquipment((prev) =>
      prev.includes(equipment)
        ? prev.filter((e) => e !== equipment)
        : [...prev, equipment]
    );
  };

  // Toggle muscle selection
  const toggleMuscle = (muscle: string) => {
    Haptics.selectionAsync();
    setSelectedMuscles((prev) =>
      prev.includes(muscle)
        ? prev.filter((m) => m !== muscle)
        : [...prev, muscle]
    );
  };

  // Submit form
  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter an exercise name');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const input: CustomExerciseInput = {
        name: name.trim(),
        equipment: selectedEquipment.length > 0 ? selectedEquipment : undefined,
        muscleGroups: selectedMuscles.length > 0 ? selectedMuscles : undefined,
        notes: notes.trim() || undefined,
      };

      const exercise = await createCustomExercise(input);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCreated({ id: exercise.id, name: exercise.name });
      onClose();
    } catch (err) {
      console.error('Failed to create custom exercise:', err);
      setError('Failed to create exercise. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onShow={handleOpen}
      onRequestClose={onClose}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
      >
        <Pressable style={styles.backdropTouchable} onPress={onClose} />

        <Animated.View
          entering={SlideInUp.duration(200)}
          style={[styles.container, { backgroundColor: colors.card }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconContainer, { backgroundColor: colors.tint + '20' }]}>
                <IconSymbol name="plus.circle.fill" size={20} color={colors.tint} />
              </View>
              <View>
                <ThemedText style={styles.title}>Create Exercise</ThemedText>
                <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Add a custom exercise to your library
                </ThemedText>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <IconSymbol name="xmark" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Name Input */}
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                EXERCISE NAME *
              </ThemedText>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g., Cable Woodchop"
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: error && !name.trim() ? '#FF3B30' : colors.separator,
                  },
                ]}
                autoFocus
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

            {/* Equipment Selection */}
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                EQUIPMENT (OPTIONAL)
              </ThemedText>
              <View style={styles.chipContainer}>
                {EQUIPMENT_OPTIONS.map((equipment) => {
                  const isSelected = selectedEquipment.includes(equipment);
                  return (
                    <Pressable
                      key={equipment}
                      onPress={() => toggleEquipment(equipment)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? colors.tint + '20' : colors.background,
                          borderColor: isSelected ? colors.tint : colors.separator,
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.chipText,
                          { color: isSelected ? colors.tint : colors.textSecondary },
                        ]}
                      >
                        {equipment}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Muscle Groups Selection */}
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                TARGET MUSCLES (OPTIONAL)
              </ThemedText>
              <View style={styles.chipContainer}>
                {MUSCLE_OPTIONS.map((muscle) => {
                  const isSelected = selectedMuscles.includes(muscle);
                  return (
                    <Pressable
                      key={muscle}
                      onPress={() => toggleMuscle(muscle)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? colors.tint + '20' : colors.background,
                          borderColor: isSelected ? colors.tint : colors.separator,
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.chipText,
                          { color: isSelected ? colors.tint : colors.textSecondary },
                        ]}
                      >
                        {muscle}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                NOTES (OPTIONAL)
              </ThemedText>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Any additional details..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
                style={[
                  styles.textInput,
                  styles.textArea,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.separator,
                  },
                ]}
              />
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <IconSymbol name="exclamationmark.triangle" size={14} color="#FF3B30" />
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            )}

            {/* Info Note */}
            <View style={[styles.infoBox, { backgroundColor: colors.tint + '10' }]}>
              <IconSymbol name="info.circle" size={16} color={colors.tint} />
              <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>
                Custom exercises are saved to your device and synced to the cloud.
                Popular exercises may be added to the main database.
              </ThemedText>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              style={[styles.cancelButton, { borderColor: colors.separator }]}
            >
              <ThemedText style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                Cancel
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={[
                styles.submitButton,
                { backgroundColor: colors.tint, opacity: isSubmitting ? 0.6 : 1 },
              ]}
            >
              {isSubmitting ? (
                <ThemedText style={styles.submitButtonText}>Creating...</ThemedText>
              ) : (
                <>
                  <IconSymbol name="checkmark" size={16} color="#fff" />
                  <ThemedText style={styles.submitButtonText}>Create</ThemedText>
                </>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  container: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  textInput: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
