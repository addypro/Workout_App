/**
 * Quick Workout Screen
 *
 * Allows coaches to create a quick workout on-the-fly:
 * - Add exercises with sets/reps/weight
 * - Save to library for later use
 * - OR assign immediately to athlete(s)
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ProgramExercise } from '@/lib/services/coach/types';
import { semanticSearch } from '@/lib/services/exercise/search';

// Quick add exercise templates
const QUICK_TEMPLATES = [
    { name: 'Bench Press', sets: 4, reps: '8-10' },
    { name: 'Squat', sets: 4, reps: '8-10' },
    { name: 'Deadlift', sets: 3, reps: '5' },
    { name: 'Pull-ups', sets: 3, reps: 'AMRAP' },
    { name: 'Shoulder Press', sets: 3, reps: '10-12' },
    { name: 'Rows', sets: 4, reps: '10-12' },
];

export default function QuickWorkoutScreen() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const insets = useSafeAreaInsets();

    const [workoutName, setWorkoutName] = useState('Quick Workout');
    const [exercises, setExercises] = useState<ProgramExercise[]>([]);
    const [showExercisePicker, setShowExercisePicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Add exercise from search results
    const handleAddExercise = (exercise: any) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newExercise: ProgramExercise = {
            exerciseId: exercise.id,
            name: exercise.name || exercise,
            sets: 3,
            reps: '10',
            restSeconds: 60,
        };
        setExercises([...exercises, newExercise]);
        setShowExercisePicker(false);
        setSearchQuery('');
        setSearchResults([]);
    };

    // Add from quick template
    const handleQuickAdd = (template: typeof QUICK_TEMPLATES[0]) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newExercise: ProgramExercise = {
            name: template.name,
            sets: template.sets,
            reps: template.reps,
            restSeconds: 60,
        };
        setExercises([...exercises, newExercise]);
    };

    // Update exercise
    const updateExercise = (index: number, updates: Partial<ProgramExercise>) => {
        const updated = [...exercises];
        updated[index] = { ...updated[index], ...updates };
        setExercises(updated);
    };

    // Remove exercise
    const removeExercise = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const updated = exercises.filter((_, i) => i !== index);
        setExercises(updated);
    };

    // Search exercises
    const handleSearch = useCallback(async (query: string) => {
        setSearchQuery(query);
        if (query.length >= 2) {
            const results = await semanticSearch(query);
            setSearchResults(results.slice(0, 15).map(r => ({ id: r.exercise.id, name: r.exercise.name })));
        } else {
            setSearchResults([]);
        }
    }, []);

    // Save workout to library
    const handleSaveToLibrary = async () => {
        if (exercises.length === 0) {
            const msg = 'Add at least one exercise';
            Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Empty Workout', msg);
            return;
        }

        setIsSaving(true);
        try {
            const { createQuickWorkout } = await import('@/lib/services/coach');
            const result = await createQuickWorkout(workoutName, exercises);

            if (result.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.back();
            } else {
                const msg = result.error || 'Failed to save workout';
                Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
            }
        } catch (error) {
            console.error('Error saving workout:', error);
            const msg = 'Failed to save workout';
            Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
        } finally {
            setIsSaving(false);
        }
    };

    // Assign to athletes
    const handleAssign = async () => {
        if (exercises.length === 0) {
            const msg = 'Add at least one exercise';
            Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Empty Workout', msg);
            return;
        }

        // Navigate to assign screen with workout data
        router.push({
            pathname: '/coach/assign-workout' as any,
            params: {
                workoutName,
                exercises: JSON.stringify(exercises),
            },
        });
    };

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: Spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.separator,
        },
        headerButton: {
            paddingVertical: Spacing.xs,
            paddingHorizontal: Spacing.md,
        },
        headerButtonText: {
            ...Typography.body,
            color: colors.tint,
            fontWeight: '600',
        },
        headerTitle: {
            ...Typography.headline,
            color: colors.text,
        },
        scrollContent: {
            padding: Spacing.lg,
            paddingBottom: 200,
        },
        nameInput: {
            ...Typography.title2,
            color: colors.text,
            backgroundColor: colors.groupedBackground,
            padding: Spacing.md,
            borderRadius: Radius.md,
            marginBottom: Spacing.lg,
        },
        sectionTitle: {
            ...Typography.headline,
            color: colors.text,
            marginBottom: Spacing.md,
        },
        quickAddRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: Spacing.sm,
            marginBottom: Spacing.lg,
        },
        quickAddChip: {
            paddingVertical: Spacing.xs,
            paddingHorizontal: Spacing.md,
            backgroundColor: colors.groupedBackground,
            borderRadius: Radius.full,
            borderWidth: 1,
            borderColor: colors.separator,
        },
        quickAddText: {
            ...Typography.footnote,
            color: colors.text,
        },
        exercisesList: {
            gap: Spacing.md,
        },
        exerciseCard: {
            backgroundColor: colors.groupedBackground,
            borderRadius: Radius.lg,
            overflow: 'hidden',
        },
        exerciseHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: Spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.separator,
        },
        exerciseNumber: {
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.tint + '15',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: Spacing.md,
        },
        exerciseNumberText: {
            ...Typography.footnote,
            color: colors.tint,
            fontWeight: '700',
        },
        exerciseName: {
            ...Typography.subhead,
            color: colors.text,
            fontWeight: '600',
            flex: 1,
        },
        removeButton: {
            padding: Spacing.xs,
        },
        exerciseDetails: {
            flexDirection: 'row',
            padding: Spacing.md,
            gap: Spacing.md,
        },
        detailInput: {
            flex: 1,
        },
        detailLabel: {
            ...Typography.caption1,
            color: colors.textSecondary,
            marginBottom: 4,
        },
        detailValue: {
            ...Typography.body,
            color: colors.text,
            backgroundColor: colors.background,
            padding: Spacing.sm,
            borderRadius: Radius.sm,
            textAlign: 'center',
        },
        addExerciseButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.sm,
            padding: Spacing.lg,
            backgroundColor: colors.groupedBackground,
            borderRadius: Radius.lg,
            borderWidth: 1,
            borderColor: colors.separator,
            borderStyle: 'dashed',
            marginTop: Spacing.md,
        },
        addExerciseText: {
            ...Typography.subhead,
            color: colors.textSecondary,
        },
        // Bottom Actions
        bottomActions: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.separator,
            padding: Spacing.lg,
            paddingBottom: Spacing.lg + insets.bottom,
        },
        actionRow: {
            flexDirection: 'row',
            gap: Spacing.md,
        },
        saveButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.sm,
            padding: Spacing.md,
            backgroundColor: colors.groupedBackground,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: colors.separator,
        },
        saveButtonText: {
            ...Typography.body,
            color: colors.text,
            fontWeight: '600',
        },
        assignButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.sm,
            padding: Spacing.md,
            backgroundColor: colors.tint,
            borderRadius: Radius.md,
        },
        assignButtonText: {
            ...Typography.body,
            color: '#FFFFFF',
            fontWeight: '600',
        },
        // Modal
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
        },
        modalContent: {
            backgroundColor: colors.background,
            borderTopLeftRadius: Radius.xl,
            borderTopRightRadius: Radius.xl,
            maxHeight: '80%',
        },
        modalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: Spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.separator,
        },
        modalTitle: {
            ...Typography.headline,
            color: colors.text,
        },
        searchInput: {
            ...Typography.body,
            color: colors.text,
            backgroundColor: colors.groupedBackground,
            padding: Spacing.md,
            borderRadius: Radius.md,
            margin: Spacing.md,
        },
        resultItem: {
            padding: Spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.separator,
        },
        resultText: {
            ...Typography.body,
            color: colors.text,
        },
        emptyExercises: {
            alignItems: 'center',
            padding: Spacing.xl * 2,
        },
        emptyText: {
            ...Typography.body,
            color: colors.textSecondary,
            textAlign: 'center',
            marginTop: Spacing.md,
        },
    });

    return (
        <Screen>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
                        <Text style={styles.headerButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Quick Workout</Text>
                    <View style={styles.headerButton} />
                </View>

                <ScrollView
                    style={styles.container}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Workout Name */}
                    <TextInput
                        style={styles.nameInput}
                        value={workoutName}
                        onChangeText={setWorkoutName}
                        placeholder="Workout Name"
                        placeholderTextColor={colors.textTertiary}
                    />

                    {/* Quick Add Templates */}
                    <Text style={styles.sectionTitle}>Quick Add</Text>
                    <View style={styles.quickAddRow}>
                        {QUICK_TEMPLATES.map((template, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.quickAddChip}
                                onPress={() => handleQuickAdd(template)}
                            >
                                <Text style={styles.quickAddText}>{template.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Exercises */}
                    <Text style={styles.sectionTitle}>Exercises ({exercises.length})</Text>

                    {exercises.length === 0 ? (
                        <View style={styles.emptyExercises}>
                            <Ionicons name="barbell-outline" size={48} color={colors.textTertiary} />
                            <Text style={styles.emptyText}>
                                Add exercises using quick add above{'\n'}or search for specific exercises
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.exercisesList}>
                            {exercises.map((exercise, index) => (
                                <View key={index} style={styles.exerciseCard}>
                                    <View style={styles.exerciseHeader}>
                                        <View style={styles.exerciseNumber}>
                                            <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                                        </View>
                                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                                        <TouchableOpacity
                                            style={styles.removeButton}
                                            onPress={() => removeExercise(index)}
                                        >
                                            <Ionicons name="trash-outline" size={20} color="#FF453A" />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.exerciseDetails}>
                                        <View style={styles.detailInput}>
                                            <Text style={styles.detailLabel}>Sets</Text>
                                            <TextInput
                                                style={styles.detailValue}
                                                value={String(exercise.sets)}
                                                onChangeText={(v) => updateExercise(index, { sets: parseInt(v) || 0 })}
                                                keyboardType="number-pad"
                                            />
                                        </View>
                                        <View style={styles.detailInput}>
                                            <Text style={styles.detailLabel}>Reps</Text>
                                            <TextInput
                                                style={styles.detailValue}
                                                value={exercise.reps}
                                                onChangeText={(v) => updateExercise(index, { reps: v })}
                                            />
                                        </View>
                                        <View style={styles.detailInput}>
                                            <Text style={styles.detailLabel}>Weight</Text>
                                            <TextInput
                                                style={styles.detailValue}
                                                value={exercise.weight || ''}
                                                onChangeText={(v) => updateExercise(index, { weight: v })}
                                                placeholder="--"
                                                placeholderTextColor={colors.textTertiary}
                                            />
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Add Exercise Button */}
                    <TouchableOpacity
                        style={styles.addExerciseButton}
                        onPress={() => setShowExercisePicker(true)}
                    >
                        <Ionicons name="add-circle-outline" size={24} color={colors.textSecondary} />
                        <Text style={styles.addExerciseText}>Search for Exercise</Text>
                    </TouchableOpacity>
                </ScrollView>

                {/* Bottom Actions */}
                <View style={styles.bottomActions}>
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSaveToLibrary}
                            disabled={isSaving}
                        >
                            <Ionicons name="bookmark-outline" size={20} color={colors.text} />
                            <Text style={styles.saveButtonText}>Save to Library</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.assignButton}
                            onPress={handleAssign}
                        >
                            <Ionicons name="send" size={20} color="#FFFFFF" />
                            <Text style={styles.assignButtonText}>Assign Now</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Exercise Search Modal */}
                <Modal
                    visible={showExercisePicker}
                    animationType="slide"
                    transparent
                    onRequestClose={() => setShowExercisePicker(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Add Exercise</Text>
                                <TouchableOpacity onPress={() => setShowExercisePicker(false)}>
                                    <Ionicons name="close" size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                style={styles.searchInput}
                                value={searchQuery}
                                onChangeText={handleSearch}
                                placeholder="Search exercises..."
                                placeholderTextColor={colors.textTertiary}
                                autoFocus
                            />
                            <FlatList
                                data={searchResults}
                                keyExtractor={(item, index) => item.id || String(index)}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.resultItem}
                                        onPress={() => handleAddExercise(item)}
                                    >
                                        <Text style={styles.resultText}>{item.name}</Text>
                                    </TouchableOpacity>
                                )}
                                keyboardShouldPersistTaps="handled"
                            />
                        </View>
                    </View>
                </Modal>
            </KeyboardAvoidingView>
        </Screen>
    );
}
