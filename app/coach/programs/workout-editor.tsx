/**
 * Workout Editor Screen
 *
 * Edit exercises for a specific workout day within a program.
 * Features:
 * - Add/remove exercises
 * - Sets/reps/weight configuration
 * - Exercise reordering
 * - Notes per exercise
 */

import { useAppTheme } from '@/lib/context/theme-context';
import { ProgramExercise, ProgramWorkout } from '@/lib/services/coach/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

// ============================================
// Types
// ============================================

interface LocalExercise extends ProgramExercise {
    id: string; // Temporary ID for list key
}

// ============================================
// Component
// ============================================

export default function WorkoutEditorScreen() {
    const { colors } = useAppTheme();
    const router = useRouter();
    const params = useLocalSearchParams<{
        programId: string;
        week: string;
        day: string;
        slot: string;
        workoutsJson: string;
    }>();

    const week = parseInt(params.week || '1', 10);
    const day = parseInt(params.day || '1', 10);
    const slot = (params.slot || 'primary') as 'primary' | 'secondary';

    // Parse existing workouts
    const existingWorkouts: ProgramWorkout[] = params.workoutsJson
        ? JSON.parse(params.workoutsJson)
        : [];

    // Find existing workout for this day/slot
    const existingWorkout = existingWorkouts.find(
        w => w.week === week && w.day === day && (w.slot || 'primary') === slot
    );

    // State
    const [workoutName, setWorkoutName] = useState(
        existingWorkout?.name || ''
    );
    const [exercises, setExercises] = useState<LocalExercise[]>(
        existingWorkout?.exercises.map((e, i) => ({
            ...e,
            id: `ex-${i}-${Date.now()}`,
        })) || []
    );
    const [notes, setNotes] = useState(existingWorkout?.notes || '');
    const [showExerciseSearch, setShowExerciseSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Day name helper
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayName = dayNames[day - 1] || `Day ${day}`;

    // Generate default workout name
    useEffect(() => {
        if (!workoutName && exercises.length > 0) {
            // Auto-generate name based on first exercise or muscle groups
            const firstExercise = exercises[0];
            if (firstExercise.name.toLowerCase().includes('bench') ||
                firstExercise.name.toLowerCase().includes('chest') ||
                firstExercise.name.toLowerCase().includes('push')) {
                setWorkoutName('Push Day');
            } else if (firstExercise.name.toLowerCase().includes('pull') ||
                firstExercise.name.toLowerCase().includes('row') ||
                firstExercise.name.toLowerCase().includes('back')) {
                setWorkoutName('Pull Day');
            } else if (firstExercise.name.toLowerCase().includes('squat') ||
                firstExercise.name.toLowerCase().includes('leg')) {
                setWorkoutName('Leg Day');
            }
        }
    }, [exercises, workoutName]);

    // Add exercise
    const handleAddExercise = useCallback(() => {
        const newExercise: LocalExercise = {
            id: `ex-${Date.now()}`,
            name: '',
            sets: 3,
            reps: '10',
        };
        setExercises(prev => [...prev, newExercise]);
    }, []);

    // Update exercise
    const handleUpdateExercise = useCallback(
        (id: string, field: keyof ProgramExercise, value: any) => {
            setExercises(prev =>
                prev.map(ex => (ex.id === id ? { ...ex, [field]: value } : ex))
            );
        },
        []
    );

    // Remove exercise
    const handleRemoveExercise = useCallback((id: string) => {
        setExercises(prev => prev.filter(ex => ex.id !== id));
    }, []);

    // Move exercise
    const handleMoveExercise = useCallback((id: string, direction: 'up' | 'down') => {
        setExercises(prev => {
            const index = prev.findIndex(ex => ex.id === id);
            if (index === -1) return prev;
            if (direction === 'up' && index === 0) return prev;
            if (direction === 'down' && index === prev.length - 1) return prev;

            const newExercises = [...prev];
            const swapIndex = direction === 'up' ? index - 1 : index + 1;
            [newExercises[index], newExercises[swapIndex]] = [
                newExercises[swapIndex],
                newExercises[index],
            ];
            return newExercises;
        });
    }, []);

    // Save workout
    const handleSave = useCallback(() => {
        if (!workoutName.trim()) {
            Alert.alert('Error', 'Please enter a workout name');
            return;
        }

        if (exercises.length === 0) {
            Alert.alert('Error', 'Please add at least one exercise');
            return;
        }

        // Filter out empty exercises and remove temp IDs
        const cleanExercises: ProgramExercise[] = exercises
            .filter(e => e.name.trim())
            .map(({ id, ...rest }) => rest);

        const workout: ProgramWorkout = {
            week,
            day,
            slot,
            name: workoutName.trim(),
            exercises: cleanExercises,
            notes: notes.trim() || undefined,
        };

        // Update workouts array
        const updatedWorkouts = existingWorkouts.filter(
            w => !(w.week === week && w.day === day && (w.slot || 'primary') === slot)
        );
        updatedWorkouts.push(workout);

        // Navigate back with updated data
        // In a real app, this would update state management or context
        router.back();
    }, [workoutName, exercises, notes, week, day, slot, existingWorkouts, router]);

    // Render exercise row
    const renderExerciseRow = (exercise: LocalExercise, index: number) => (
        <View
            key={exercise.id}
            style={[styles.exerciseRow, { backgroundColor: colors.cardBackground }]}
        >
            <View style={styles.exerciseHeader}>
                <Text style={[styles.exerciseNumber, { color: colors.primary }]}>
                    {index + 1}
                </Text>
                <View style={styles.exerciseMoveButtons}>
                    <TouchableOpacity
                        onPress={() => handleMoveExercise(exercise.id, 'up')}
                        disabled={index === 0}
                    >
                        <Ionicons
                            name="chevron-up"
                            size={20}
                            color={index === 0 ? colors.textMuted : colors.text}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => handleMoveExercise(exercise.id, 'down')}
                        disabled={index === exercises.length - 1}
                    >
                        <Ionicons
                            name="chevron-down"
                            size={20}
                            color={index === exercises.length - 1 ? colors.textMuted : colors.text}
                        />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => handleRemoveExercise(exercise.id)}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                </TouchableOpacity>
            </View>

            <TextInput
                style={[styles.exerciseNameInput, { color: colors.text, borderColor: colors.border }]}
                value={exercise.name}
                onChangeText={text => handleUpdateExercise(exercise.id, 'name', text)}
                placeholder="Exercise name"
                placeholderTextColor={colors.textMuted}
            />

            <View style={styles.exerciseDetails}>
                <View style={styles.detailField}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Sets</Text>
                    <TextInput
                        style={[styles.detailInput, { color: colors.text, borderColor: colors.border }]}
                        value={exercise.sets?.toString() || ''}
                        onChangeText={text =>
                            handleUpdateExercise(exercise.id, 'sets', parseInt(text) || 0)
                        }
                        keyboardType="numeric"
                        placeholder="3"
                        placeholderTextColor={colors.textMuted}
                    />
                </View>
                <View style={styles.detailField}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Reps</Text>
                    <TextInput
                        style={[styles.detailInput, { color: colors.text, borderColor: colors.border }]}
                        value={exercise.reps}
                        onChangeText={text => handleUpdateExercise(exercise.id, 'reps', text)}
                        placeholder="8-12"
                        placeholderTextColor={colors.textMuted}
                    />
                </View>
                <View style={styles.detailField}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Weight</Text>
                    <TextInput
                        style={[styles.detailInput, { color: colors.text, borderColor: colors.border }]}
                        value={exercise.weight || ''}
                        onChangeText={text => handleUpdateExercise(exercise.id, 'weight', text)}
                        placeholder="135 lbs"
                        placeholderTextColor={colors.textMuted}
                    />
                </View>
                <View style={styles.detailField}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>RPE</Text>
                    <TextInput
                        style={[styles.detailInput, { color: colors.text, borderColor: colors.border }]}
                        value={exercise.rpe?.toString() || ''}
                        onChangeText={text =>
                            handleUpdateExercise(exercise.id, 'rpe', parseFloat(text) || undefined)
                        }
                        keyboardType="decimal-pad"
                        placeholder="8"
                        placeholderTextColor={colors.textMuted}
                    />
                </View>
            </View>

            <TextInput
                style={[styles.notesInput, { color: colors.text, borderColor: colors.border }]}
                value={exercise.notes || ''}
                onChangeText={text => handleUpdateExercise(exercise.id, 'notes', text)}
                placeholder="Notes (optional)"
                placeholderTextColor={colors.textMuted}
                multiline
            />
        </View>
    );

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>
                        Week {week} • {dayName}
                    </Text>
                    {slot === 'secondary' && (
                        <View style={[styles.slotBadge, { backgroundColor: colors.success + '20' }]}>
                            <Text style={[styles.slotText, { color: colors.success }]}>PM</Text>
                        </View>
                    )}
                </View>
                <TouchableOpacity
                    onPress={handleSave}
                    style={[styles.saveButton, { backgroundColor: colors.primary }]}
                >
                    <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Workout Name */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: colors.text }]}>Workout Name</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border }]}
                        value={workoutName}
                        onChangeText={setWorkoutName}
                        placeholder="e.g., Push Day A"
                        placeholderTextColor={colors.textMuted}
                    />
                </View>

                {/* Exercises */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.label, { color: colors.text }]}>
                            Exercises ({exercises.length})
                        </Text>
                        <TouchableOpacity
                            style={[styles.addButton, { backgroundColor: colors.primary + '20' }]}
                            onPress={handleAddExercise}
                        >
                            <Ionicons name="add" size={18} color={colors.primary} />
                            <Text style={[styles.addButtonText, { color: colors.primary }]}>
                                Add Exercise
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {exercises.length === 0 ? (
                        <View style={[styles.emptyState, { borderColor: colors.border }]}>
                            <Ionicons name="barbell-outline" size={40} color={colors.textMuted} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No exercises yet
                            </Text>
                            <TouchableOpacity
                                style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                                onPress={handleAddExercise}
                            >
                                <Text style={styles.emptyButtonText}>Add First Exercise</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        exercises.map((exercise, index) => renderExerciseRow(exercise, index))
                    )}
                </View>

                {/* Workout Notes */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: colors.text }]}>Workout Notes</Text>
                    <TextInput
                        style={[styles.input, styles.textArea, { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border }]}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Coach notes for this workout (optional)"
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={3}
                    />
                </View>

                {/* Quick Add Templates */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: colors.text }]}>Quick Add</Text>
                    <View style={styles.quickAddRow}>
                        {['Bench Press', 'Squat', 'Deadlift', 'Row', 'OHP'].map(name => (
                            <TouchableOpacity
                                key={name}
                                style={[styles.quickAddChip, { borderColor: colors.border }]}
                                onPress={() => {
                                    setExercises(prev => [
                                        ...prev,
                                        { id: `ex-${Date.now()}`, name, sets: 3, reps: '8' },
                                    ]);
                                }}
                            >
                                <Text style={[styles.quickAddText, { color: colors.text }]}>{name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    slotBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    slotText: {
        fontSize: 12,
        fontWeight: '600',
    },
    saveButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    addButtonText: {
        fontSize: 13,
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        padding: 32,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: 12,
    },
    emptyText: {
        fontSize: 14,
        marginTop: 12,
    },
    emptyButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 16,
    },
    emptyButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    exerciseRow: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    exerciseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    exerciseNumber: {
        fontSize: 16,
        fontWeight: '700',
        width: 24,
    },
    exerciseMoveButtons: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
    },
    exerciseNameInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
        fontWeight: '500',
        marginBottom: 12,
    },
    exerciseDetails: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    detailField: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 11,
        marginBottom: 4,
    },
    detailInput: {
        borderWidth: 1,
        borderRadius: 6,
        padding: 8,
        fontSize: 14,
        textAlign: 'center',
    },
    notesInput: {
        borderWidth: 1,
        borderRadius: 6,
        padding: 10,
        fontSize: 13,
        minHeight: 40,
    },
    quickAddRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    quickAddChip: {
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    quickAddText: {
        fontSize: 13,
    },
});
